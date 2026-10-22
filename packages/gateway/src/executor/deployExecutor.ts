/**
 * deployExecutor — MOCK executor for request_deploy.
 *
 * FAKE: Calls the fake-production server at FAKE_PRODUCTION_URL.
 * TODO(P2): Wire up the fake-production server in mock-env/.
 * TODO(P1): Replace with real deploy logic once TideCloak verification is done.
 */
export async function deployExecutor(params: {
  version: string;
  commit: string;
}): Promise<{ ok: boolean; detail: string }> {
  const url = process.env.FAKE_PRODUCTION_URL ?? 'http://localhost:4001';
  try {
    const res = await fetch(`${url}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const text = await res.text();
    return { ok: res.ok, detail: text };
  } catch (err: unknown) {
    const e = err as Error;
    console.error('[deployExecutor] Failed to call fake-production:', e.message);
    return { ok: false, detail: `Failed to reach fake-production: ${e.message}` };
  }
}
