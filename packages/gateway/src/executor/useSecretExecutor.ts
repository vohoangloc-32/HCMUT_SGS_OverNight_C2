/**
 * useSecretExecutor — MOCK executor for request_use_secret.
 *
 * FAKE: Reads from mock-env/fixtures/fake-secrets.txt.
 * The gateway never returns the secret value to the agent.
 *
 * TODO(P1): Implement real secret retrieval from TideCloak-encrypted store.
 * See DECISIONS.md TC-04 / docs/VERIFY_TIDECLOAK.md TC-04.
 */
export async function useSecretExecutor(params: {
  secret_name: string;
  purpose: string;
}): Promise<{ ok: boolean; detail: string }> {
  // FAKE: The gateway "uses" the secret on behalf of the action but never returns it.
  console.log(
    `[useSecretExecutor] MOCK: Using secret "${params.secret_name}" for purpose: "${params.purpose}"`
  );
  console.log('[useSecretExecutor] NOTE: Secret value is NOT returned to the agent.');
  // TODO(P1): Actually decrypt from TideCloak-encrypted store and use it.
  return {
    ok: true,
    detail: `MOCK: Secret "${params.secret_name}" was used for "${params.purpose}". Value not disclosed.`,
  };
}
