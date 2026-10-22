import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';
import type { QuorumEngine } from '../quorum/QuorumEngine.js';
import type { TideAdapter } from '../tide/TideAdapter.js';
import { ulid } from 'ulid';
import { canonicalParamsHash } from '../crypto/canonicalParamsHash.js';
import {
  CreateActionRequestBodySchema,
  ListActionsQuerySchema,
  RISK_SIGNALS,
  type ActionRequest,
  type RiskSignal,
} from '@key-holder/shared';

// TODO(P1): Replace with real guardian role check once TideAdapter is verified.
// TODO(P2): Seed 3 requests on startup in dev/mock mode.

interface RoutesOptions {
  db: Db;
  quorumEngine: QuorumEngine;
  tideAdapter: TideAdapter;
}

export async function actionsRoutes(app: FastifyInstance, opts: RoutesOptions) {
  const { db } = opts;

  /** POST /actions — create a new Action Request */
  app.post('/actions', async (request, reply) => {
    const parseResult = CreateActionRequestBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
      });
    }
    const body = parseResult.data;

    const id = ulid();
    const parametersHash = canonicalParamsHash(body.parameters as Record<string, unknown>);
    const now = new Date();
    const ttlSeconds = parseInt(process.env.ACTION_TTL_SECONDS ?? '3600', 10);
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // Deterministic risk signals
    const riskSignals: RiskSignal[] = computeRiskSignals(body);

    const actionRequest: ActionRequest = {
      id,
      tool: body.tool,
      parameters: body.parameters as Record<string, unknown>,
      parametersHash,
      proposer: body.proposer,
      source: body.source,
      riskSignals,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      approvals: [],
      requiredApprovals: parseInt(process.env.QUORUM_REQUIRED ?? '2', 10),
      totalGuardians: parseInt(process.env.QUORUM_TOTAL ?? '3', 10),
    };

    // Persist
    db.prepare(`
      INSERT INTO action_requests
        (id, tool, parameters, parameters_hash, proposer, source, risk_signals,
         created_at, expires_at, status, approvals, required_approvals, total_guardians)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      actionRequest.id,
      actionRequest.tool,
      JSON.stringify(actionRequest.parameters),
      actionRequest.parametersHash,
      JSON.stringify(actionRequest.proposer),
      JSON.stringify(actionRequest.source),
      JSON.stringify(actionRequest.riskSignals),
      actionRequest.createdAt,
      actionRequest.expiresAt,
      actionRequest.status,
      JSON.stringify(actionRequest.approvals),
      actionRequest.requiredApprovals,
      actionRequest.totalGuardians
    );

    // Audit
    appendAudit(db, id, 'created', body.proposer.userId, {});

    return reply.status(201).send({
      id,
      status: 'pending',
      parametersHash,
      expiresAt: expiresAt.toISOString(),
      requiredApprovals: actionRequest.requiredApprovals,
      totalGuardians: actionRequest.totalGuardians,
    });
  });

  /** GET /actions — list requests */
  app.get('/actions', async (request, reply) => {
    const queryResult = ListActionsQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: queryResult.error.message },
      });
    }
    const { status, limit, offset } = queryResult.data;

    const rows = status
      ? db.prepare('SELECT * FROM action_requests WHERE status = ? LIMIT ? OFFSET ?').all(status, limit, offset)
      : db.prepare('SELECT * FROM action_requests LIMIT ? OFFSET ?').all(limit, offset);

    const total = status
      ? (db.prepare('SELECT COUNT(*) as c FROM action_requests WHERE status = ?').get(status) as { c: number }).c
      : (db.prepare('SELECT COUNT(*) as c FROM action_requests').get() as { c: number }).c;

    return reply.send({ items: rows.map(deserialize), total, limit, offset });
  });

  /** GET /actions/:id — single request */
  app.get('/actions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id);
    if (!row) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Action request not found' } });
    return reply.send(deserialize(row as Record<string, unknown>));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRiskSignals(body: { tool: string; parameters: unknown }): RiskSignal[] {
  const signals: RiskSignal[] = [];
  // TODO(P1/P2): Expand rules as needed.
  if (body.tool === 'request_send_external') {
    const params = body.parameters as Record<string, unknown>;
    const dest = String(params.destination ?? '');
    try {
      const url = new URL(dest);
      const ALLOWLIST = (process.env.DESTINATION_ALLOWLIST ?? '').split(',').filter(Boolean);
      if (ALLOWLIST.length > 0 && !ALLOWLIST.includes(url.hostname)) {
        signals.push('external-domain');
      }
      // Unknown if never seen before — TODO: check audit log
      signals.push('unknown-destination');
    } catch {
      signals.push('external-domain');
    }
  }
  if (body.tool === 'request_use_secret') {
    const params = body.parameters as Record<string, unknown>;
    const name = String(params.secret_name ?? '');
    const SENSITIVE_PATTERNS = ['PROD', 'API_KEY', 'SECRET', 'PASSWORD', 'TOKEN'];
    if (SENSITIVE_PATTERNS.some((p) => name.toUpperCase().includes(p))) {
      signals.push('sensitive-tag');
    }
  }
  // Suppress unused warning
  void RISK_SIGNALS;
  return signals;
}

export function appendAudit(
  db: Db,
  actionRequestId: string,
  event: string,
  actor: string,
  detail: Record<string, unknown>
) {
  db.prepare(
    'INSERT INTO audit_events (id, action_request_id, event, actor, at, detail) VALUES (?,?,?,?,?,?)'
  ).run(ulid(), actionRequestId, event, actor, new Date().toISOString(), JSON.stringify(detail));
}

export function deserialize(row: Record<string, unknown>): ActionRequest {
  return {
    id: row.id as string,
    tool: row.tool as ActionRequest['tool'],
    parameters: JSON.parse(row.parameters as string) as Record<string, unknown>,
    parametersHash: row.parameters_hash as string,
    proposer: JSON.parse(row.proposer as string) as ActionRequest['proposer'],
    source: JSON.parse(row.source as string) as ActionRequest['source'],
    riskSignals: JSON.parse(row.risk_signals as string) as ActionRequest['riskSignals'],
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    status: row.status as ActionRequest['status'],
    approvals: JSON.parse(row.approvals as string) as ActionRequest['approvals'],
    requiredApprovals: row.required_approvals as number,
    totalGuardians: row.total_guardians as number,
  };
}
