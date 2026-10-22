/**
 * sendExternalExecutor — MOCK executor for request_send_external.
 *
 * FAKE: Calls the fake-external server at FAKE_EXTERNAL_URL.
 * In the real system this would actually send data to the destination.
 * For the demo, it logs the attempt to fake-external so the demo
 * can show "nothing was sent to evil.example" in scenario 3.
 *
 * TODO(P2): Wire up the fake-external server in mock-env/.
 */
export async function sendExternalExecutor(params: {
  destination: string;
  payload_ref: string;
}): Promise<{ ok: boolean; detail: string }> {
  const url = process.env.FAKE_EXTERNAL_URL ?? 'http://localhost:4002';
  try {
    const res = await fetch(`${url}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const text = await res.text();
    return { ok: res.ok, detail: text };
  } catch (err: unknown) {
    const e = err as Error;
    console.error('[sendExternalExecutor] Failed to call fake-external:', e.message);
    return { ok: false, detail: `Failed to reach fake-external: ${e.message}` };
  }
}
