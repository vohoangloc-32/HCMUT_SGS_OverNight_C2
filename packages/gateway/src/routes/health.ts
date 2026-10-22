import type { FastifyInstance } from 'fastify';
import type { TideAdapter } from '../tide/TideAdapter.js';
const version = '0.1.0';

export async function healthRoutes(app: FastifyInstance, opts: { tideAdapter: TideAdapter }) {
  app.get('/health', async (_request, reply) => {
    const tideHealth = await opts.tideAdapter.healthCheck();
    return reply.send({
      status: 'ok',
      version,
      db: 'ok', // TODO(P1): actually ping the DB
      tide: tideHealth.ok ? 'ok' : 'unconfigured',
    });
  });
}
