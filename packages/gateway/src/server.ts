import 'dotenv/config';
import Fastify from 'fastify';
import { actionsRoutes } from './routes/actions.js';
import { approvalsRoutes } from './routes/approvals.js';
import { auditRoutes } from './routes/audit.js';
import { healthRoutes } from './routes/health.js';
import { initDb } from './db.js';
import { InMemoryQuorumEngine } from './quorum/InMemoryQuorumEngine.js';
import { TideAdapterStub } from './tide/TideAdapterStub.js';
import { TideAdapterReal } from './tide/TideAdapterReal.js';
import { SecretStore } from './secrets/SecretStore.js';

const PORT = parseInt(process.env.GATEWAY_PORT ?? '3001', 10);
const HOST = process.env.GATEWAY_HOST ?? '0.0.0.0';

async function main() {
  // Initialise SQLite store
  const db = initDb(process.env.DATABASE_PATH ?? ':memory:');

  // Quorum engine — default 2 of 3 guardians
  const quorumEngine = new InMemoryQuorumEngine({
    required: parseInt(process.env.QUORUM_REQUIRED ?? '2', 10),
    total: parseInt(process.env.QUORUM_TOTAL ?? '3', 10),
  });

  // Tide adapter — TideAdapterReal (verified JWKS / AES-256-GCM) with fallback to stub if requested
  const useStub = process.env.TIDE_ADAPTER_MODE === 'stub';
  const tideAdapter = useStub ? new TideAdapterStub() : new TideAdapterReal();

  // Seed encrypted secrets into DB (stored as AES-256-GCM ciphertext, never plaintext)
  await SecretStore.seedSecrets(db, tideAdapter);

  const app = Fastify({ logger: true });

  // Register routes
  await app.register(healthRoutes, { tideAdapter });
  await app.register(actionsRoutes, { db, quorumEngine, tideAdapter });
  await app.register(approvalsRoutes, { db, quorumEngine, tideAdapter });
  await app.register(auditRoutes, { db });

  // CORS for guardian UI dev
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (request.method === 'OPTIONS') {
      await reply.status(204).send();
    }
  });

  await app.listen({ port: PORT, host: HOST });
  console.log(`Gateway listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});
