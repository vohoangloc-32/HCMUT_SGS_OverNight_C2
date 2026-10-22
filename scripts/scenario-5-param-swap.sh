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
MOCK_MODE="${MOCK_MODE:-0}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 5 (Stretch): Parameter Swap Defense${NC}"
echo -e "${BLUE}====================================================================${NC}"

# Detect mode: MOCK_MODE=1 explicitly runs mock contract; otherwise require real gateway
IS_LIVE=0
if [ "$MOCK_MODE" = "1" ]; then
  IS_LIVE=0
  echo -e "${YELLOW}[MOCK MODE] MOCK_MODE=1 active. Running against Mock API contract.${NC}"
else
  if ! curl -s -f "${GATEWAY_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: Real gateway is unreachable at ${GATEWAY_URL}.${NC}" >&2
    echo -e "${RED}Start the gateway first (e.g. 'make dev' or 'npm run dev -w packages/gateway'), or pass MOCK_MODE=1 to run in mock mode.${NC}" >&2
    exit 1
  fi
  IS_LIVE=1
  echo -e "${CYAN}[LIVE GATEWAY MODE] Connected to Gateway at ${GATEWAY_URL}${NC}"
fi

echo -e "\n${YELLOW}Step 1: Create legitimate deploy request${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
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
        "kind": "github-pr",
        "reference": "https://github.com/org/sample-repo/pull/55"
      }
    }')
  ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  REAL_HASH=$(echo "$CREATE_RES" | grep -o '"parametersHash":"[^"]*' | cut -d'"' -f4)
  echo "Action Request Created: ${ACTION_ID}"
  echo "Canonical Parameters Hash: ${REAL_HASH}"
else
  ACTION_ID="01HV8G7N9B3W00000000000001"
  REAL_HASH="sha256:7b2496a8e8055b3fbf50bc3db0e08c491295cb4f7a77f9801ef06ee791999999"
  echo -e "${YELLOW}[MOCK MODE] Action Request Created: ${ACTION_ID}${NC}"
  echo -e "${YELLOW}[MOCK MODE] Canonical Parameters Hash: ${REAL_HASH}${NC}"
fi

echo -e "\n${YELLOW}Step 2: Guardian 1 approves legitimate parameters${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
    -H "Content-Type: application/json" \
    -d "{
      \"guardianId\": \"guardian-alice\",
      \"parametersHash\": \"${REAL_HASH}\"
    }" > /dev/null
  echo "Guardian 1 approval recorded with canonical hash."
else
  echo -e "${YELLOW}[MOCK MODE] Guardian Alice signs approval bound to ${REAL_HASH:0:20}...${NC}"
fi

echo -e "\n${YELLOW}Step 3: Attacker attempts to forge approval with altered parameters hash${NC}"
FORGED_HASH="sha256:0000000000000000000000000000000000000000000000000000000000000000"

if [ "$IS_LIVE" -eq 1 ]; then
  FORGE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
    -H "Content-Type: application/json" \
    -d "{
      \"guardianId\": \"guardian-bob\",
      \"parametersHash\": \"${FORGED_HASH}\"
    }" || true)
  echo "Gateway response on tampered hash: ${FORGE_RES}"
  if echo "$FORGE_RES" | grep -q -E "HASH_MISMATCH|INVALID_HASH|VALIDATION_ERROR"; then
    echo -e "${GREEN}✔ Gateway detected parameter hash discrepancy and rejected the forged approval!${NC}"
  fi
else
  echo -e "${YELLOW}[MOCK MODE] Attacker tampers with parameters during second approval.${NC}"
  echo -e "${YELLOW}[MOCK MODE] Gateway verifies parametersHash against stored canonical hash.${NC}"
  echo -e "${YELLOW}[MOCK MODE] Error: 422 Unprocessable Entity - HASH_MISMATCH${NC}"
  echo -e "${GREEN}✔ Gateway detected parameter hash discrepancy and rejected the forged approval!${NC}"
fi

echo -e "\n${YELLOW}Step 4: Verify request was NOT executed${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  CHECK_RES=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
  STATUS=$(echo "$CHECK_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "Current request status: ${STATUS}"
  if [ "$STATUS" != "executed" ]; then
    echo -e "${GREEN}✔ Success: Parameter-bound approval prevented execution of tampered action.${NC}"
  fi
else
  echo -e "${YELLOW}[MOCK MODE] Request status remains unexecuted. Parameter tampering aborted.${NC}"
  echo -e "${GREEN}✔ Success: Parameter-bound approval prevented execution of tampered action.${NC}"
fi
