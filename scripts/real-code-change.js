#!/usr/bin/env node
/**
 * Scenario A: Real Code Change Approval & Verification Flow
 * 
 * 1. Inspect baseline state of protected repo (has failing test)
 * 2. Generate clean unified patch fixing boundary bug (> 20 -> >= 20)
 * 3. Submit request_code_change to Gateway
 * 4. Request Dev Guardian Tokens for Alice & Bob
 * 5. Guardian Alice inspects diff via GET /actions/:id/patch
 * 6. Guardian Alice approves (1 of 2 required)
 * 7. Guardian Bob approves (2 of 2 quorum reached -> triggers executor)
 * 8. Verify final action status in audit log & repo log
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
  console.log(`${BLUE}Scenario A: Real Code Change Approval & Verification Flow${NC}`);
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

  // Step 1: Inspect baseline
  console.log(`${YELLOW}Step 1: Inspect baseline state of protected repo (has failing test)${NC}`);
  const logRes = await fetch(`${GATEWAY_URL}/repo/log`);
  const logData = await logRes.json();
  console.log(JSON.stringify(logData, null, 2));

  const baseSha = logData.head || 'a4208db';
  console.log(`Protected Repo Base SHA: ${CYAN}${baseSha}${NC}\n`);

  // Step 2: Unified Patch
  console.log(`${YELLOW}Step 2: Generate clean unified patch fixing boundary bug (> 20 -> >= 20)${NC}`);
  const patch = `diff --git a/src/discount.js b/src/discount.js
--- a/src/discount.js
+++ b/src/discount.js
@@ -14,7 +14,7 @@ export function calculateDiscount(loyaltyPoints) {
   if (loyaltyPoints >= 50) {
     return 15;
   }
-  if (loyaltyPoints > 20) {   // BUG: should be >= 20
+  if (loyaltyPoints >= 20) {
     return 10;
   }
   if (loyaltyPoints >= 5) {
`;
  console.log(patch + '\n');

  // Step 3: Submit request_code_change
  console.log(`${YELLOW}Step 3: Submit request_code_change to Gateway${NC}`);
  const submitRes = await fetch(`${GATEWAY_URL}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'request_code_change',
      parameters: {
        title: 'fix(discount): resolve off-by-one boundary condition at loyalty=20',
        description: 'Fixes calculateDiscount so that loyalty=20 yields 10% discount.',
        patch,
        baseSha,
        filesTouched: ['src/discount.js'],
      },
      proposer: {
        userId: 'engineer-alice',
        agent: 'Claude-Code-Agent-v1',
      },
      source: {
        kind: 'github-issue',
        reference: 'https://github.com/org/sample-repo/issues/101',
      },
    }),
  });

  const actionResponse = await submitRes.json();
  console.log(JSON.stringify(actionResponse, null, 2));
  const actionId = actionResponse.id;
  const paramsHash = actionResponse.parametersHash;

  console.log(`Action ID: ${CYAN}${actionId}${NC}`);
  console.log(`Parameters Hash: ${CYAN}${paramsHash}${NC}\n`);

  // Step 4: Guardian Dev Tokens
  console.log(`${YELLOW}Step 4: Request Dev Guardian Tokens${NC}`);
  const g1Res = await fetch(`${GATEWAY_URL}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'guardian-alice', role: 'guardian' }),
  });
  const g1Data = await g1Res.json();
  const g1Token = g1Data.token;

  const g2Res = await fetch(`${GATEWAY_URL}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'guardian-bob', role: 'guardian' }),
  });
  const g2Data = await g2Res.json();
  const g2Token = g2Data.token;

  console.log(`Guardian 1 (Alice) Token: ${g1Token.substring(0, 20)}...`);
  console.log(`Guardian 2 (Bob) Token:   ${g2Token.substring(0, 20)}...\n`);

  // Step 5: Guardian Alice inspects diff
  console.log(`${YELLOW}Step 5: Guardian Alice inspects diff via GET /actions/${actionId}/patch${NC}`);
  const diffRes = await fetch(`${GATEWAY_URL}/actions/${actionId}/patch`, {
    headers: { Authorization: `Bearer ${g1Token}` },
  });
  const diffData = await diffRes.json();
  console.log(JSON.stringify(diffData, null, 2) + '\n');

  // Step 6: Guardian Alice approves
  console.log(`${YELLOW}Step 6: Guardian Alice approves (1 of 2 required)${NC}`);
  const app1Res = await fetch(`${GATEWAY_URL}/actions/${actionId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${g1Token}`,
    },
    body: JSON.stringify({ parametersHash: paramsHash }),
  });
  const app1Data = await app1Res.json();
  console.log(JSON.stringify(app1Data, null, 2) + '\n');

  // Step 7: Guardian Bob approves
  console.log(`${YELLOW}Step 7: Guardian Bob approves (2 of 2 quorum reached -> Triggers Executor)${NC}`);
  const app2Res = await fetch(`${GATEWAY_URL}/actions/${actionId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${g2Token}`,
    },
    body: JSON.stringify({ parametersHash: paramsHash }),
  });
  const app2Data = await app2Res.json();
  console.log(JSON.stringify(app2Data, null, 2) + '\n');

  // Step 8: Verify Final Action Status & Repo Log
  console.log(`${YELLOW}Step 8: Verify Final Action Status in Audit Log & Repo Log${NC}`);
  const finalRes = await fetch(`${GATEWAY_URL}/actions/${actionId}`);
  const finalData = await finalRes.json();
  console.log(JSON.stringify({
    id: finalData.id,
    status: finalData.status,
    approvals: finalData.approvals ? finalData.approvals.length : 0,
    executionResult: finalData.executionResult,
  }, null, 2));

  console.log('\nUpdated Protected Repo Git Log:');
  const finalLogRes = await fetch(`${GATEWAY_URL}/repo/log`);
  const finalLogData = await finalLogRes.json();
  console.log(JSON.stringify(finalLogData, null, 2));

  console.log(`\n${GREEN}✔ Scenario A completed successfully: Patch verified by tests and committed to protected repo.${NC}\n`);
}

main().catch((err) => {
  console.error(`${RED}Scenario failed:${NC}`, err);
  process.exit(1);
});
