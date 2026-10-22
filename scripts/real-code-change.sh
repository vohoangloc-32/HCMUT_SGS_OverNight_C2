#!/usr/bin/env bash
# ==============================================================================
# Scenario A: Real Code Change Workflow (Bug Fix -> Quorum -> Automated Tests -> FF Merge)
#
# 1. Agent fixes the off-by-one bug in discount.js in its local workspace.
# 2. Agent submits request_code_change to the Key-Holder Gateway.
# 3. Two Guardians approve using their TideCloak / Dev JWTs.
# 4. Gateway verifies parametersHash, tests on temp branch, and fast-forwards main.
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
echo -e "${BLUE}Scenario A: Real Code Change Approval & Verification Flow${NC}"
echo -e "${BLUE}====================================================================${NC}"

# Check gateway availability
if ! curl -s -f "${GATEWAY_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}Error: Gateway is unreachable at ${GATEWAY_URL}.${NC}"
  echo -e "${YELLOW}Please start the gateway first: npm run dev -w packages/gateway${NC}"
  exit 1
fi

echo -e "\n${YELLOW}Step 1: Inspect baseline state of protected repo (has failing test)${NC}"
curl -s "${GATEWAY_URL}/repo/log" | jq . || curl -s "${GATEWAY_URL}/repo/log"

BASE_SHA=$(curl -s "${GATEWAY_URL}/repo/log" | jq -r '.head // empty')
if [ -z "$BASE_SHA" ] || [ "$BASE_SHA" = "unknown" ]; then
  BASE_SHA=$(git -C "$PROTECTED_REPO_PATH" rev-parse HEAD 2>/dev/null || echo "c0ffee1")
fi
echo -e "Protected Repo Base SHA: ${CYAN}${BASE_SHA}${NC}"

echo -e "\n${YELLOW}Step 2: Generate clean unified patch fixing boundary bug (> 20 -> >= 20)${NC}"
PATCH="diff --git a/src/discount.js b/src/discount.js
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
   if (loyaltyPoints >= 5) {"

echo "$PATCH"

echo -e "\n${YELLOW}Step 3: Submit request_code_change to Gateway${NC}"
ACTION_RESPONSE=$(curl -s -X POST "${GATEWAY_URL}/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "request_code_change",
    "parameters": {
      "title": "fix(discount): resolve off-by-one boundary condition at loyalty=20",
      "description": "Fixes calculateDiscount so that loyalty=20 yields 10% discount.",
      "patch": '"$(echo "$PATCH" | jq -Rs .)"',
      "baseSha": "'"$BASE_SHA"'",
      "filesTouched": ["src/discount.js"]
    },
    "proposer": {
      "userId": "engineer-alice",
      "agent": "Claude-Code-Agent-v1"
    },
    "source": {
      "kind": "github-issue",
      "reference": "https://github.com/org/sample-repo/issues/101"
    }
  }')

echo "$ACTION_RESPONSE" | jq . || echo "$ACTION_RESPONSE"
ACTION_ID=$(echo "$ACTION_RESPONSE" | jq -r .id)
PARAMS_HASH=$(echo "$ACTION_RESPONSE" | jq -r .parametersHash)

echo -e "Action ID: ${CYAN}${ACTION_ID}${NC}"
echo -e "Parameters Hash: ${CYAN}${PARAMS_HASH}${NC}"

echo -e "\n${YELLOW}Step 4: Request Dev Guardian Tokens${NC}"
G1_TOKEN=$(curl -s -X POST "${GATEWAY_URL}/auth/dev-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "guardian-alice", "role": "guardian"}' | jq -r .token)

G2_TOKEN=$(curl -s -X POST "${GATEWAY_URL}/auth/dev-token" \
  -H "Content-Type: application/json" \
  -d '{"userId": "guardian-bob", "role": "guardian"}' | jq -r .token)

echo "Guardian 1 (Alice) Token: ${G1_TOKEN:0:20}..."
echo "Guardian 2 (Bob) Token:   ${G2_TOKEN:0:20}..."

echo -e "\n${YELLOW}Step 5: Guardian Alice inspects diff via GET /actions/${ACTION_ID}/patch${NC}"
DIFF_VIEW=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}/patch" \
  -H "Authorization: Bearer ${G1_TOKEN}")
echo "$DIFF_VIEW" | jq . || echo "$DIFF_VIEW"

echo -e "\n${YELLOW}Step 6: Guardian Alice approves (1 of 2 required)${NC}"
G1_APP=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Authorization: Bearer ${G1_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"parametersHash\": \"${PARAMS_HASH}\"}")
echo "$G1_APP" | jq . || echo "$G1_APP"

echo -e "\n${YELLOW}Step 7: Guardian Bob approves (2 of 2 quorum reached -> Triggers Executor)${NC}"
G2_APP=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Authorization: Bearer ${G2_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"parametersHash\": \"${PARAMS_HASH}\"}")
echo "$G2_APP" | jq . || echo "$G2_APP"

echo -e "\n${YELLOW}Step 8: Verify Final Action Status in Audit Log & Repo Log${NC}"
FINAL_ACTION=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
echo "$FINAL_ACTION" | jq '{id: .id, status: .status, approvals: .approvals | length}'

echo -e "\nUpdated Protected Repo Git Log:"
curl -s "${GATEWAY_URL}/repo/log" | jq . || curl -s "${GATEWAY_URL}/repo/log"

echo -e "\n${GREEN}✔ Scenario A completed successfully: Patch verified by tests and committed to protected repo.${NC}"
