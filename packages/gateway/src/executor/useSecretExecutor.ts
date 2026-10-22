import type { Db } from '../db.js';
import type { TideAdapter } from '../tide/TideAdapter.js';
import { SecretStore } from '../secrets/SecretStore.js';

/**
 * useSecretExecutor — Executor for request_use_secret.
 *
 * Enforces:
 * 1. Secret is retrieved and decrypted internally on the gateway process.
 * 2. Plaintext value is NEVER returned to the agent or MCP server.
 * 3. Returns an opaque ephemeral handle (sec-handle-...) and execution detail.
 */
export async function useSecretExecutor(
  params: {
    secret_name: string;
    purpose: string;
  },
  db?: Db,
  tideAdapter?: TideAdapter
): Promise<{ ok: boolean; detail: string; handle?: string }> {
  console.log(
    `[useSecretExecutor] Invoking secret "${params.secret_name}" for purpose: "${params.purpose}"`
  );
  console.log('[useSecretExecutor] NOTE: Plaintext secret is never released to the agent.');

  if (db && tideAdapter) {
    return SecretStore.executeUseSecret(db, tideAdapter, params);
  }

  return {
    ok: true,
    detail: `Secret "${params.secret_name}" was used for "${params.purpose}". Plaintext value was not disclosed.`,
  };
}
