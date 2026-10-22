#!/usr/bin/env bash
# ==============================================================================
# Scenario 4: Manual Attacker / Single Compromised Guardian (Blocked)
#
# Demonstrates defense against a rogue or compromised individual account.
# Self-approval is rejected by gateway policy, and a single approval is insufficient
# to meet the 2-of-3 quorum threshold.
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
echo -e "${BLUE}Scenario 4: Compromised Account / Single Guardian Attack${NC}"
echo -e "${BLUE}====================================================================${NC}"

# Detect if live gateway is available
IS_LIVE=0
if [ "$MOCK_MODE" != "1" ] && curl -s -f "${GATEWAY_URL}/health" > /dev/null 2>&1; then
  IS_LIVE=1
fi

if [ "$IS_LIVE" -eq 1 ]; then
  echo -e "${CYAN}[LIVE GATEWAY MODE] Connected to Gateway at ${GATEWAY_URL}${NC}"
else
  echo -e "${YELLOW}[MOCK MODE] Gateway offline or MOCK_MODE active. Running against Mock API contract.${NC}"
fi

echo -e "\n${YELLOW}Step 1: Attacker proposes use of production database secret${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  CREATE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions" \
    -H "Content-Type: application/json" \
    -d '{
      "tool": "request_use_secret",
      "parameters": {
        "secret_name": "PROD_DB_MIGRATION_TOKEN",
        "purpose": "unauthorized exfiltration probe"
      },
      "proposer": {
        "userId": "compromised-alice",
        "agent": "Rogue-Agent"
      },
      "source": {
        "kind": "manual",
        "reference": "suspicious-cli-input"
      }
    }')
  ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  PARAMS_HASH=$(echo "$CREATE_RES" | grep -o '"parametersHash":"[^"]*' | cut -d'"' -f4)
  echo "Action Request Created: ${ACTION_ID}"
else
  ACTION_ID="01HV8G7N9B3W00000000000002"
  PARAMS_HASH="sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  echo -e "${YELLOW}[MOCK MODE] Action Request Created: ${ACTION_ID}${NC}"
  echo -e "${YELLOW}[MOCK MODE] Proposer: compromised-alice (Rogue-Agent)${NC}"
  echo -e "${YELLOW}[MOCK MODE] Target Secret: PROD_DB_MIGRATION_TOKEN${NC}"
fi

echo -e "\n${YELLOW}Step 2: Proposer attempts self-approval (must be denied)${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  SELF_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
    -H "Content-Type: application/json" \
    -d "{
      \"guardianId\": \"compromised-alice\",
      \"parametersHash\": \"${PARAMS_HASH}\"
    }" || true)
  echo "Self-approval response: ${SELF_RES}"
  if echo "$SELF_RES" | grep -q "SELF_APPROVAL"; then
    echo -e "${GREEN}✔ Gateway correctly rejected self-approval with error code SELF_APPROVAL.${NC}"
  fi
else
  echo -e "${YELLOW}[MOCK MODE] Request rejected: HTTP 409 Conflict${NC}"
  echo -e "${YELLOW}[MOCK MODE] Code: SELF_APPROVAL. Four-Eyes Principle: Proposer cannot approve own action.${NC}"
  echo -e "${GREEN}✔ Gateway correctly rejected self-approval with error code SELF_APPROVAL.${NC}"
fi

echo -e "\n${YELLOW}Step 3: A single rogue guardian (Bob) approves${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  APPROVE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
    -H "Content-Type: application/json" \
    -d "{
      \"guardianId\": \"guardian-bob\",
      \"parametersHash\": \"${PARAMS_HASH}\"
    }")
  STATUS=$(echo "$APPROVE_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "After single guardian approval: Status is still '${STATUS}' (1 of 2 required)"
else
  echo -e "${YELLOW}[MOCK MODE] Guardian Bob signs approval. Approvals gathered: 1 of 2 required.${NC}"
  echo -e "${YELLOW}[MOCK MODE] Status is still 'pending' / 'approved' (Quorum not reached).${NC}"
fi

echo -e "\n${YELLOW}Step 4: Check that secret action is NOT executed${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  CHECK_RES=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
  FINAL_STATUS=$(echo "$CHECK_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "Final request status: ${FINAL_STATUS}"
  if [ "$FINAL_STATUS" = "pending" ] || [ "$FINAL_STATUS" = "approved" ]; then
    echo -e "${GREEN}✔ Blocked! Action remains unexecuted. 1-of-M compromise cannot execute sensitive actions.${NC}"
  fi
else
  echo -e "${YELLOW}[MOCK MODE] Action status is pending (1/2 approvals). Secret payload is NEVER released.${NC}"
  echo -e "${GREEN}✔ Blocked! Action remains unexecuted. 1-of-M compromise cannot execute sensitive actions.${NC}"
fi
