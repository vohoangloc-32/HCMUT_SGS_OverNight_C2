import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';
import type { QuorumEngine } from '../quorum/QuorumEngine.js';
import type { TideAdapter } from '../tide/TideAdapter.js';
import { ApproveRequestBodySchema } from '@key-holder/shared';
import { appendAudit, deserialize } from './actions.js';
import { deployExecutor } from '../executor/deployExecutor.js';
import { useSecretExecutor } from '../executor/useSecretExecutor.js';
import { sendExternalExecutor } from '../executor/sendExternalExecutor.js';
import type { ActionRequest } from '@key-holder/shared';

interface RoutesOptions {
  db: Db;
  quorumEngine: QuorumEngine;
  tideAdapter: TideAdapter;
}

export async function approvalsRoutes(app: FastifyInstance, opts: RoutesOptions) {
  const { db, quorumEngine } = opts;

  /** POST /actions/:id/approve */
  app.post('/actions/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };

    // TODO(P1): Replace stub JWT verification with real TideAdapter.verifyJwt()
    const authHeader = request.headers.authorization ?? '';
    const token = authHeader.replace('Bearer ', '');
    let guardianId = 'mock-guardian';
    try {
      const payload = await opts.tideAdapter.verifyJwt(token);
      guardianId = payload.sub;
      // TODO(P1): Enforce guardian role check: opts.tideAdapter.isGuardian(payload)
    } catch {
      // In stub mode, allow any non-empty token
      if (!token) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
      }
    }

    const parseResult = ApproveRequestBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
      });
    }

    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id);
    if (!row) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    }

    const actionRequest = deserialize(row as Record<string, unknown>);

    if (actionRequest.status !== 'pending') {
      return reply.status(409).send({
        error: { code: 'ALREADY_DECIDED', message: `Request is already ${actionRequest.status}` },
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

    appendAudit(db, id, 'approved', guardianId, { parametersHash: parseResult.data.parametersHash });

    let executed = false;
    let executionResult: { ok: boolean; detail: string } | undefined;

    if (updated.quorumReached) {
      appendAudit(db, id, 'quorum-reached', 'system', {});
      // Execute the action
      const result = await executeAction(actionRequest);
      executionResult = result;
      executed = result.ok;
      db.prepare("UPDATE action_requests SET status = 'executed' WHERE id = ?").run(id);
      appendAudit(db, id, 'executed', 'system', { ok: result.ok, detail: result.detail });
    }

    return reply.send({
      id,
      status: executed ? 'executed' : newStatus,
      approvals: updated.approvals,
      executed,
      executionResult,
    });
  });

  /** POST /actions/:id/reject */
  app.post('/actions/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };

    // TODO(P1): Replace with real JWT verification
    const authHeader = request.headers.authorization ?? '';
    const token = authHeader.replace('Bearer ', '');
    let guardianId = 'mock-guardian';
    try {
      const payload = await opts.tideAdapter.verifyJwt(token);
      guardianId = payload.sub;
    } catch {
      if (!token) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
      }
    }

    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id);
    if (!row) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    }

    const actionRequest = deserialize(row as Record<string, unknown>);

    const { approvals } = await quorumEngine.recordRejection(actionRequest, guardianId);

    db.prepare("UPDATE action_requests SET approvals = ?, status = 'rejected' WHERE id = ?").run(
      JSON.stringify(approvals),
      id
    );
    appendAudit(db, id, 'rejected', guardianId, {});

    return reply.send({ id, status: 'rejected' });
  });
}

// ── Executors ─────────────────────────────────────────────────────────────────

async function executeAction(req: ActionRequest): Promise<{ ok: boolean; detail: string }> {
  switch (req.tool) {
    case 'request_deploy':
      return deployExecutor(req.parameters as { version: string; commit: string });
    case 'request_use_secret':
      return useSecretExecutor(req.parameters as { secret_name: string; purpose: string });
    case 'request_send_external':
      return sendExternalExecutor(
        req.parameters as { destination: string; payload_ref: string }
      );
    default:
      return { ok: false, detail: `Unknown tool: ${req.tool as string}` };
  }
}
