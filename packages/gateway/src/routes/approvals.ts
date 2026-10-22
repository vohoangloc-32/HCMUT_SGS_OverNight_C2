import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';
import type { QuorumEngine } from '../quorum/QuorumEngine.js';
import type { TideAdapter, TideJwtPayload } from '../tide/TideAdapter.js';
import { ApproveRequestBodySchema, ERROR_CODES } from '@key-holder/shared';
import { appendAudit, deserialize } from './actions.js';
import { deployExecutor } from '../executor/deployExecutor.js';
import { useSecretExecutor } from '../executor/useSecretExecutor.js';
import { sendExternalExecutor } from '../executor/sendExternalExecutor.js';
import { codeChangeExecutor } from '../executor/codeChangeExecutor.js';
import type { ActionRequest } from '@key-holder/shared';

interface RoutesOptions {
  db: Db;
  quorumEngine: QuorumEngine;
  tideAdapter: TideAdapter;
}

export async function approvalsRoutes(app: FastifyInstance, opts: RoutesOptions) {
  const { db, quorumEngine, tideAdapter } = opts;

  /** POST /actions/:id/approve */
  app.post('/actions/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };

    // JWT verification — strictly require Authorization: Bearer token
    const authHeader = request.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer ')) {
      return reply.status(401).send({
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Missing Authorization header with Bearer token',
        },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return reply.status(401).send({
        error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Missing authentication token' },
      });
    }

    let jwtPayload: TideJwtPayload;
    try {
      jwtPayload = await tideAdapter.verifyJwt(token);
    } catch (err: unknown) {
      const e = err as Error;
      return reply.status(401).send({
        error: { code: ERROR_CODES.UNAUTHORIZED, message: e.message || 'Invalid token' },
      });
    }

    // Enforce guardian role
    if (!tideAdapter.isGuardian(jwtPayload)) {
      return reply.status(403).send({
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: 'Token does not hold the required guardian role',
        },
      });
    }

    // Derive guardianId ONLY from verified token claims; body guardianId is ignored
    const guardianId = jwtPayload.sub;

    const parseResult = ApproveRequestBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: parseResult.error.message },
      });
    }

    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id);
    if (!row) {
      return reply.status(404).send({
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Action request not found' },
      });
    }

    const actionRequest = deserialize(row as Record<string, unknown>);

    // Expiry check
    if (new Date(actionRequest.expiresAt) < new Date() || actionRequest.status === 'expired') {
      db.prepare("UPDATE action_requests SET status = 'expired' WHERE id = ?").run(id);
      appendAudit(db, id, 'expired', 'system', { at: new Date().toISOString() });
      return reply.status(409).send({
        error: { code: ERROR_CODES.EXPIRED, message: 'Action request has expired' },
      });
    }

    // Status check
    if (actionRequest.status !== 'pending') {
      return reply.status(409).send({
        error: {
          code: ERROR_CODES.ALREADY_DECIDED,
          message: `Request is already ${actionRequest.status}`,
        },
      });
    }

    // Self-approval check (proposer cannot approve own request)
    if (guardianId === actionRequest.proposer.userId) {
      return reply.status(409).send({
        error: {
          code: ERROR_CODES.SELF_APPROVAL,
          message: 'Proposer cannot approve their own request',
        },
      });
    }

    // Parameters hash check (parameter-bound approval)
    if (parseResult.data.parametersHash !== actionRequest.parametersHash) {
      appendAudit(db, id, 'hash-mismatch', guardianId, {
        submittedHash: parseResult.data.parametersHash,
        expectedHash: actionRequest.parametersHash,
      });
      return reply.status(409).send({
        error: {
          code: ERROR_CODES.HASH_MISMATCH,
          message: 'Parameters hash mismatch — parameters may have been tampered with',
        },
      });
    }

    let updated: { approvals: ActionRequest['approvals']; quorumReached: boolean };
    try {
      updated = await quorumEngine.recordApproval(
        actionRequest,
        guardianId,
        parseResult.data.parametersHash
      );
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      return reply.status(409).send({
        error: { code: e.code ?? 'INTERNAL_ERROR', message: e.message ?? 'Unknown error' },
      });
    }

    const newStatus = updated.quorumReached ? 'approved' : 'pending';

    db.prepare('UPDATE action_requests SET approvals = ?, status = ? WHERE id = ?').run(
      JSON.stringify(updated.approvals),
      newStatus,
      id
    );

    appendAudit(db, id, 'approved', guardianId, {
      parametersHash: parseResult.data.parametersHash,
      quorumStatus: `${updated.approvals.filter((a) => a.decision === 'approve').length}/${actionRequest.requiredApprovals}`,
    });

    let executed = false;
    let executionResult: { ok: boolean; detail: string } | undefined;

    if (updated.quorumReached) {
      appendAudit(db, id, 'quorum-reached', 'system', {
        required: actionRequest.requiredApprovals,
      });

      // Dispatch execution
      const approverIds = updated.approvals
        .filter((a) => a.decision === 'approve')
        .map((a) => a.guardianId);
      const result = await executeAction(actionRequest, db, tideAdapter, approverIds);
      executionResult = result;
      executed = result.ok;

      const finalStatus = result.ok ? 'executed' : 'failed';
      db.prepare('UPDATE action_requests SET approvals = ?, status = ? WHERE id = ?').run(
        JSON.stringify(updated.approvals),
        finalStatus,
        id
      );
      appendAudit(db, id, result.ok ? 'executed' : 'execution-failed', 'system', {
        ok: result.ok,
        detail: result.detail,
        parametersHash: actionRequest.parametersHash,
      });
    }

    return reply.send({
      id,
      status: executed ? 'executed' : updated.quorumReached ? 'failed' : newStatus,
      approvals: updated.approvals,
      executed,
      executionResult,
    });
  });

  /** POST /actions/:id/reject */
  app.post('/actions/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };

    // JWT verification — strictly require Authorization: Bearer token
    const authHeader = request.headers.authorization ?? '';
    if (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('bearer ')) {
      return reply.status(401).send({
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Missing Authorization header with Bearer token',
        },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return reply.status(401).send({
        error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Missing authentication token' },
      });
    }

    let jwtPayload: TideJwtPayload;
    try {
      jwtPayload = await tideAdapter.verifyJwt(token);
    } catch (err: unknown) {
      const e = err as Error;
      return reply.status(401).send({
        error: { code: ERROR_CODES.UNAUTHORIZED, message: e.message || 'Invalid token' },
      });
    }

    // Enforce guardian role
    if (!tideAdapter.isGuardian(jwtPayload)) {
      return reply.status(403).send({
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: 'Token does not hold the required guardian role',
        },
      });
    }

    // Derive guardianId ONLY from verified token
    const guardianId = jwtPayload.sub;

    const bodyRaw = (request.body ?? {}) as Record<string, unknown>;
    const reason = typeof bodyRaw.reason === 'string' ? bodyRaw.reason : undefined;

    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id);
    if (!row) {
      return reply.status(404).send({
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Action request not found' },
      });
    }

    const actionRequest = deserialize(row as Record<string, unknown>);

    const { approvals } = await quorumEngine.recordRejection(actionRequest, guardianId);

    db.prepare("UPDATE action_requests SET approvals = ?, status = 'rejected' WHERE id = ?").run(
      JSON.stringify(approvals),
      id
    );

    appendAudit(db, id, 'rejected', guardianId, { reason: reason ?? 'Manually rejected' });

    return reply.send({ id, status: 'rejected' });
  });
}

// ── Executors ─────────────────────────────────────────────────────────────────

async function executeAction(
  req: ActionRequest,
  db: Db,
  tideAdapter: TideAdapter,
  approverIds: string[] = []
): Promise<{ ok: boolean; detail: string; handle?: string }> {
  switch (req.tool) {
    case 'request_deploy':
      return deployExecutor(req.parameters as { version: string; commit: string });
    case 'request_use_secret':
      return useSecretExecutor(
        req.parameters as { secret_name: string; purpose: string },
        db,
        tideAdapter
      );
    case 'request_send_external':
      return sendExternalExecutor(req.parameters as { destination: string; payload_ref: string });
    case 'request_code_change':
      return codeChangeExecutor(req, approverIds);
    default:
      return { ok: false, detail: `Unknown tool: ${req.tool as string}` };
  }
}
