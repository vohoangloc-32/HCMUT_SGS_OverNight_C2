import type { TideAdapter, TideJwtPayload } from './TideAdapter.js';

/**
 * TideAdapterStub — no-op implementation for development without TideCloak.
 *
 * FAKE: This stub bypasses all authentication and encryption.
 * It exists so P2 can build and test the guardian UI without TideCloak running.
 *
 * TODO(P1): Replace with TideAdapterReal once TC-01 through TC-08 are verified.
 * See docs/VERIFY_TIDECLOAK.md.
 *
 * Usage: Active when TIDECLOAK_ADAPTER_FILE / TIDECLOAK_ADAPTER_JSON / TIDECLOAK_ADAPTER_B64
 * env vars are all absent.
 */
export class TideAdapterStub implements TideAdapter {
  async verifyJwt(token: string): Promise<TideJwtPayload> {
    // FAKE: In dev mode, accept any non-empty token and return a mock payload.
    // TODO(P1): Implement real JWT verification using jose + embedded JWKS.
    if (!token) throw new Error('Missing token');

    // Parse payload from mock bearer token (format: "mock:<userId>:<role>")
    const parts = token.replace('Bearer ', '').split(':');
    const userId = parts[1] ?? 'mock-user';
    const role = parts[2] ?? 'guardian';

    return {
      sub: userId,
      email: `${userId}@mock.local`,
      realm_access: { roles: [role, '_tide_enabled'] },
      resource_access: {},
      azp: 'gateway-client',
      exp: Math.floor(Date.now() / 1000) + 600,
      iat: Math.floor(Date.now() / 1000),
    };
  }

  isGuardian(payload: TideJwtPayload): boolean {
    // FAKE: Check for the 'guardian' role in realm_access.
    // TODO(P1): Verify correct role name and source (realm vs client role).
    return payload.realm_access?.roles.includes('gateway-guardian') ?? false;
  }

  async encryptSecret(plaintext: string, _tag: string): Promise<string> {
    // FAKE: No real encryption. Returns base64-encoded plaintext with prefix.
    // TODO(P1): Implement real encryption (TideCloak tag-based or AES-256-GCM fallback).
    console.warn('[TideAdapterStub] encryptSecret: FAKE — not encrypted');
    return `FAKE_ENCRYPTED:${Buffer.from(plaintext).toString('base64')}`;
  }

  async decryptSecret(ciphertext: string, _tag: string): Promise<string> {
    // FAKE: Reverse of encryptSecret above.
    // TODO(P1): Implement real decryption.
    console.warn('[TideAdapterStub] decryptSecret: FAKE — not decrypted');
    const b64 = ciphertext.replace('FAKE_ENCRYPTED:', '');
    return Buffer.from(b64, 'base64').toString('utf8');
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    return { ok: false, detail: 'TideCloak not configured (stub mode)' };
  }
}
