import { createHash } from 'crypto';

/**
 * canonicalParamsHash — deterministic SHA-256 hash of action parameters.
 *
 * This is the canonical implementation used for parameter-bound approvals.
 * Every approval stores this hash; the gateway verifies it before executing.
 *
 * Rules:
 * - Parameters are serialised to JSON with keys sorted alphabetically.
 * - The hash is prefixed with "sha256:" for clarity.
 * - This function is pure — same input always produces the same output.
 *
 * This is a REAL implementation with a REAL test.
 * See packages/gateway/src/crypto/canonicalParamsHash.test.ts
 */
export function canonicalParamsHash(parameters: Record<string, unknown>): string {
  const canonical = JSON.stringify(parameters, Object.keys(parameters).sort());
  const hex = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hex}`;
}
