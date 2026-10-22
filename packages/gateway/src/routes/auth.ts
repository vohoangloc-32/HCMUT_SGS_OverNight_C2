import type { FastifyInstance } from 'fastify';
import { createDevToken } from '../tide/TideAdapterReal.js';

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /auth/dev-token
   *
   * Issues cryptographically signed HMAC-SHA256 tokens using DEV_TOKEN_SECRET.
   * DEV TOKENS ACTIVE: not Tide identity.
   * Exists for local development and demonstration when live TideCloak container is not running.
   */
  app.post('/auth/dev-token', async (request, reply) => {
    const devSecret = process.env.DEV_TOKEN_SECRET;
    if (!devSecret) {
      return reply.status(500).send({
        error: {
          code: 'DEV_TOKENS_DISABLED',
          message: 'DEV_TOKEN_SECRET is not configured on this gateway.',
        },
      });
    }

    const body = (request.body ?? {}) as { userId?: string; role?: string };
    if (!body.userId || typeof body.userId !== 'string') {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'userId is required (string).' },
      });
    }

    const role = typeof body.role === 'string' ? body.role : 'guardian';
    const token = await createDevToken(body.userId, role, devSecret);

    return reply.send({
      token,
      tokenType: 'Bearer',
      expiresIn: 3600,
      userId: body.userId,
      role,
      warning: 'DEV TOKENS ACTIVE: not Tide identity',
    });
  });
}
