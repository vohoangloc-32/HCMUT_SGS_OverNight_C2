/**
 * TideAdapter — interface for all TideCloak calls.
 *
 * ALL TideCloak interactions in the gateway MUST go through this interface.
 * See AGENTS.md rule 3.
 *
 * TODO(P1): Implement TideAdapterReal once TideCloak integration is verified.
 * See docs/VERIFY_TIDECLOAK.md for the checklist of unknowns.
 */

export interface TideJwtPayload {
  sub: string;
  email?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  azp?: string;
  exp: number;
  iat: number;
}

export interface TideAdapter {
  /**
   * Verify a JWT from the Authorization header.
   * Must use embedded JWKS from adapter JSON (not remote JWKS endpoint).
   *
   * TODO(P1): Implement using jose + embedded JWKS. Pattern verified in
   * canon/feature-mapping (JWT Verification section). See DECISIONS.md TC-05.
   */
  verifyJwt(token: string): Promise<TideJwtPayload>;

  /**
   * Check whether the given user has the guardian role.
   * Role name is configurable; defaults to "gateway-guardian".
   *
   * TODO(P1): Implement server-side role check from verified JWT payload.
   */
  isGuardian(payload: TideJwtPayload): boolean;

  /**
   * Encrypt a secret value for storage in the gateway DB.
   * After encryption, the DB should show only ciphertext.
   *
   * TODO(P1): Verify TC-04 — tag-based encryption for server-side secrets.
   * Fallback: AES-256-GCM with key from env var.
   */
  encryptSecret(plaintext: string, tag: string): Promise<string>;

  /**
   * Decrypt a secret value previously encrypted by encryptSecret.
   *
   * TODO(P1): Verify TC-04. Fallback: AES-256-GCM decryption.
   */
  decryptSecret(ciphertext: string, tag: string): Promise<string>;

  /**
   * Health check — returns whether TideCloak is reachable and configured.
   */
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
}
