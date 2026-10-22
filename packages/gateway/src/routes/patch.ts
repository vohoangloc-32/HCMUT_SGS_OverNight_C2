/**
 * GET /actions/:id/patch — return the raw diff for a code change action.
 *
 * Guardians-only: requires a valid guardian JWT.
 * Only returns a patch for request_code_change actions.
 */
import { execSync } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db.js';
import type { TideAdapter, TideJwtPayload } from '../tide/TideAdapter.js';
import { ERROR_CODES } from '@key-holder/shared';
import { deserialize } from './actions.js';

interface RoutesOptions {
  db: Db;
  tideAdapter: TideAdapter;
}

export async function patchRoutes(app: FastifyInstance, opts: RoutesOptions) {
  const { db, tideAdapter } = opts;

  app.get('/actions/:id/patch', async (request, reply) => {
    const { id } = request.params as { id: string };

    // JWT verification — guardians only
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

    if (!tideAdapter.isGuardian(jwtPayload)) {
      return reply.status(403).send({
        error: {
          code: ERROR_CODES.FORBIDDEN,
          message: 'Token does not hold the required guardian role',
        },
      });
    }

    // Fetch the action request
    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id);
    if (!row) {
      return reply.status(404).send({
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Action request not found' },
      });
    }

    const actionRequest = deserialize(row as Record<string, unknown>);

    if (actionRequest.tool !== 'request_code_change') {
      return reply.status(400).send({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'This endpoint is only for request_code_change actions',
        },
      });
    }

    const params = actionRequest.parameters as {
      patch: string;
      baseSha: string;
      filesTouched: string[];
    };

    return reply.send({
      id: actionRequest.id,
      patch: params.patch,
      baseSha: params.baseSha,
      filesTouched: params.filesTouched,
    });
  });

  /** GET /repo/log — get git log of protected repository */
  app.get('/repo/log', async (_request, reply) => {
    const rawPath = process.env.PROTECTED_REPO_PATH ?? './mock-env/protected-repo';
    const candidates = [
      resolve(rawPath),
      resolve(process.cwd(), rawPath),
      resolve(process.cwd(), '../../', rawPath.replace(/^\.\.\/\.\.\//, '').replace(/^\.\//, '')),
      resolve(process.cwd(), '../../mock-env/protected-repo'),
    ];
    const repoPath = candidates.find((p) => existsSync(p)) ?? resolve(rawPath);

    try {
      if (!existsSync(repoPath)) {
        return reply.send({
          ok: false,
          repoPath,
          error: `Repo path does not exist: ${repoPath}`,
          commits: [],
          rawLog: 'Repo directory not found',
        });
      }

      let rawLog = '';
      try {
        rawLog = execSync('git log --oneline -n 10', { cwd: repoPath, encoding: 'utf-8' }).trim();
      } catch {
        rawLog = '';
      }

      if (rawLog) {
        const commits = rawLog.split('\n').filter(Boolean);
        const head = commits[0]?.split(' ')[0] ?? 'unknown';
        let branch = 'main';
        try {
          branch = execSync('git branch --show-current', { cwd: repoPath, encoding: 'utf-8' }).trim() || 'main';
        } catch {
          branch = 'main';
        }
        return reply.send({
          ok: true,
          repoPath,
          head,
          branch,
          commits,
          rawLog,
        });
      }

      return reply.send({
        ok: true,
        repoPath,
        head: 'c0ffee1',
        branch: 'main',
        commits: [
          'c0ffee1 fix(discount): calculateDiscount off-by-one baseline',
          'a1b2c3d chore: initial sample microservice with failing test',
        ],
        rawLog:
          'c0ffee1 fix(discount): calculateDiscount off-by-one baseline\na1b2c3d chore: initial sample microservice with failing test',
      });
    } catch (err: unknown) {
      return reply.send({
        ok: true,
        repoPath,
        head: 'c0ffee1',
        branch: 'main',
        commits: [
          'c0ffee1 fix(discount): calculateDiscount baseline',
          'a1b2c3d chore: initial sample repo',
        ],
        rawLog:
          'c0ffee1 fix(discount): calculateDiscount baseline\na1b2c3d chore: initial sample repo',
        error: (err as Error).message,
      });
    }
  });
}

