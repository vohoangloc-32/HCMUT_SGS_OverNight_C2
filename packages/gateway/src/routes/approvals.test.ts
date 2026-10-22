import Fastify from 'fastify';
import { initDb } from '../db.js';
import { InMemoryQuorumEngine } from '../quorum/InMemoryQuorumEngine.js';
import { TideAdapterReal, createDevToken } from '../tide/TideAdapterReal.js';
import { actionsRoutes } from './actions.js';
import { approvalsRoutes } from './approvals.js';
import { ERROR_CODES } from '@key-holder/shared';

describe('Approvals Routes & Authentication Boundary', () => {
  const devTokenSecret = 'test-approvals-secret-key-32bytes!!';
  const encryptionKey = 'test-encryption-key-32bytes-long!';

  let app: ReturnType<typeof Fastify>;
  let actionId: string;
  let parametersHash: string;

  beforeEach(async () => {
    const db = initDb(':memory:');
    const quorumEngine = new InMemoryQuorumEngine({ required: 2, total: 3 });
    const tideAdapter = new TideAdapterReal({
      encryptionKey,
      devTokenSecret,
    });

    app = Fastify();
    await app.register(actionsRoutes, { db, quorumEngine, tideAdapter });
    await app.register(approvalsRoutes, { db, quorumEngine, tideAdapter });
    await app.ready();

    // Create a pending action request (proposed by agent-proposer)
    const createRes = await app.inject({
      method: 'POST',
      url: '/actions',
      payload: {
        tool: 'request_deploy',
        parameters: {
          version: '1.2.3',
          commit: 'a1b2c3d',
        },
        proposer: {
          userId: 'agent-proposer',
          agent: 'ci-agent-01',
        },
        source: {
          kind: 'direct',
          reference: 'https://ci.example.com/build/123',
        },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const body = JSON.parse(createRes.body);
    actionId = body.id;
    parametersHash = body.parametersHash;
  });

  afterEach(async () => {
    await app.close();
  });

  // (a) request without token -> 401
  test('(a) request without token returns 401 UNAUTHORIZED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      payload: { parametersHash },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  // (b) forged token / wrong signature -> 401
  test('(b) forged token with wrong signature returns 401 UNAUTHORIZED', async () => {
    const forgedToken = await createDevToken('attacker', 'guardian', 'wrong-attacker-secret-key!');
    const res = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      headers: { authorization: `Bearer ${forgedToken}` },
      payload: { parametersHash },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  // (c) valid token for a user without guardian role -> 403
  test('(c) valid token for user without guardian role returns 403 FORBIDDEN', async () => {
    const viewerToken = await createDevToken('viewer-charlie', 'viewer', devTokenSecret);
    const res = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { parametersHash },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  // (d) claiming another guardianId in the body has no effect
  test('(d) claiming another guardianId in the body has no effect; identity derived only from token', async () => {
    const aliceToken = await createDevToken('guardian-alice', 'guardian', devTokenSecret);
    const res = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        parametersHash,
        guardianId: 'spoofed-bob-guardian', // Attacker attempts to spoof bob in request body
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    // Approval was attributed to alice (from verified token claim), NOT spoofed-bob-guardian
    expect(body.approvals).toHaveLength(1);
    expect(body.approvals[0].guardianId).toBe('guardian-alice');
  });

  // (e) one token cannot vote twice
  test('(e) one token / guardian cannot vote twice', async () => {
    const aliceToken = await createDevToken('guardian-alice', 'guardian', devTokenSecret);

    // First vote succeeds
    const firstVote = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { parametersHash },
    });
    expect(firstVote.statusCode).toBe(200);

    // Second vote with same token / guardian fails with 409
    const secondVote = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { parametersHash },
    });
    expect(secondVote.statusCode).toBe(409);
    const body = JSON.parse(secondVote.body);
    expect(body.error.code).toBe(ERROR_CODES.ALREADY_DECIDED);
  });

  // (f) one person cannot reach quorum alone
  test('(f) one person cannot reach quorum alone (requires 2 distinct guardians)', async () => {
    const aliceToken = await createDevToken('guardian-alice', 'guardian', devTokenSecret);
    const bobToken = await createDevToken('guardian-bob', 'guardian', devTokenSecret);

    // Alice approves: quorum not reached (1/2)
    const aliceVote = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { parametersHash },
    });
    expect(aliceVote.statusCode).toBe(200);
    const aliceBody = JSON.parse(aliceVote.body);
    expect(aliceBody.status).toBe('pending');
    expect(aliceBody.approvals).toHaveLength(1);

    // Check action state via GET
    const getRes = await app.inject({
      method: 'GET',
      url: `/actions/${actionId}`,
    });
    const getBody = JSON.parse(getRes.body);
    expect(getBody.status).toBe('pending');

    // Bob approves: quorum reached (2/2) -> transitions to approved/executed
    const bobVote = await app.inject({
      method: 'POST',
      url: `/actions/${actionId}/approve`,
      headers: { authorization: `Bearer ${bobToken}` },
      payload: { parametersHash },
    });
    expect(bobVote.statusCode).toBe(200);
    const bobBody = JSON.parse(bobVote.body);
    expect(['approved', 'executed']).toContain(bobBody.status);
    expect(bobBody.approvals).toHaveLength(2);
  });
});
