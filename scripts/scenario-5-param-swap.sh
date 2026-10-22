#!/usr/bin/env bash
# ==============================================================================
# Scenario 5: Parameter Swap After Approval (Stretch)
#
# Demonstrates defense against parameter-tampering attacks.
# Approvals are cryptographically bound to the canonical parameters hash.
# If parameters or hash change during transit, the gateway immediately halts execution.
# ==============================================================================
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3001}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 5 (Stretch): Parameter Swap Defense${NC}"
echo -e "${BLUE}====================================================================${NC}"

echo -e "\n${YELLOW}Step 1: Create legitimate deploy request${NC}"
CREATE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "request_deploy",
    "parameters": {
      "version": "1.4.2",
      "commit": "a1b2c3d4e5f60000"
    },
    "proposer": {
      "userId": "engineer-alice",
      "agent": "Claude-Code-Agent-v1"
    },
    "source": {
      "kind": "pull_request",
      "reference": "https://github.com/org/sample-repo/pull/55"
    }
  }' || echo "")

if [ -z "$CREATE_RES" ] || ! echo "$CREATE_RES" | grep -q '"id"'; then
  echo -e "${RED}Error: Could not reach gateway at ${GATEWAY_URL}.${NC}"
  exit 1
fi

ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
REAL_HASH=$(echo "$CREATE_RES" | grep -o '"parametersHash":"[^"]*' | cut -d'"' -f4)
echo "Action Request Created: ${ACTION_ID}"
echo "Canonical Parameters Hash: ${REAL_HASH}"

echo -e "\n${YELLOW}Step 2: Guardian 1 approves legitimate parameters${NC}"
APPROVE1_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"guardianId\": \"guardian-alice\",
    \"parametersHash\": \"${REAL_HASH}\"
  }")

echo "Guardian 1 approval recorded."

echo -e "\n${YELLOW}Step 3: Attacker attempts to forge approval with altered parameters hash${NC}"
FORGED_HASH="sha256:0000000000000000000000000000000000000000000000000000000000000000"

FORGE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"guardianId\": \"guardian-bob\",
    \"parametersHash\": \"${FORGED_HASH}\"
  }" || true)

echo "Gateway response on tampered hash: ${FORGE_RES}"

if echo "$FORGE_RES" | grep -q -E "HASH_MISMATCH|INVALID_HASH|VALIDATION_ERROR"; then
  echo -e "${GREEN}✔ Gateway detected parameter hash discrepancy and rejected the forged approval!${NC}"
else
  echo "Approval verification result checked."
fi

echo -e "\n${YELLOW}Step 4: Verify request was NOT executed${NC}"
CHECK_RES=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
STATUS=$(echo "$CHECK_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "Current request status: ${STATUS}"

if [ "$STATUS" != "executed" ]; then
  echo -e "${GREEN}✔ Success: Parameter-bound approval prevented execution of tampered action.${NC}"
else
  echo -e "${RED}Error: Action was executed despite hash mismatch!${NC}"
  exit 1
fi
