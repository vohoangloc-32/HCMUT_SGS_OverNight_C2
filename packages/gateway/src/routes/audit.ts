import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';

export async function auditRoutes(app: FastifyInstance, opts: { db: Db }) {
  const { db } = opts;

  /** GET /audit — append-only audit log */
  app.get('/audit', async (_request, reply) => {
    const events = db
      .prepare('SELECT * FROM audit_events ORDER BY at ASC')
      .all() as Array<Record<string, unknown>>;

    return reply.send({
      events: events.map((e) => ({
        id: e.id,
        actionRequestId: e.action_request_id,
        event: e.event,
        actor: e.actor,
        at: e.at,
        detail: JSON.parse(e.detail as string) as Record<string, unknown>,
      })),
    });
  });
}
