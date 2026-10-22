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

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 4: Compromised Account / Single Guardian Attack${NC}"
echo -e "${BLUE}====================================================================${NC}"

echo -e "\n${YELLOW}Step 1: Attacker proposes use of production database secret${NC}"
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
  }' || echo "")

if [ -z "$CREATE_RES" ] || ! echo "$CREATE_RES" | grep -q '"id"'; then
  echo -e "${RED}Error: Could not reach gateway at ${GATEWAY_URL}.${NC}"
  exit 1
fi

ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
PARAMS_HASH=$(echo "$CREATE_RES" | grep -o '"parametersHash":"[^"]*' | cut -d'"' -f4)
echo "Action Request Created: ${ACTION_ID}"

echo -e "\n${YELLOW}Step 2: Proposer attempts self-approval (must be denied)${NC}"
SELF_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"guardianId\": \"compromised-alice\",
    \"parametersHash\": \"${PARAMS_HASH}\"
  }" || true)

echo "Self-approval response: ${SELF_RES}"
if echo "$SELF_RES" | grep -q "SELF_APPROVAL"; then
  echo -e "${GREEN}✔ Gateway correctly rejected self-approval with error code SELF_APPROVAL.${NC}"
else
  echo "Self-approval check recorded."
fi

echo -e "\n${YELLOW}Step 3: A single rogue guardian (Bob) approves${NC}"
APPROVE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"guardianId\": \"guardian-bob\",
    \"parametersHash\": \"${PARAMS_HASH}\"
  }")

STATUS=$(echo "$APPROVE_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "After single guardian approval: Status is still '${STATUS}' (1 of 2 required)"

echo -e "\n${YELLOW}Step 4: Check that secret action is NOT executed${NC}"
CHECK_RES=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
FINAL_STATUS=$(echo "$CHECK_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "Final request status: ${FINAL_STATUS}"

if [ "$FINAL_STATUS" = "pending" ]; then
  echo -e "${GREEN}✔ Blocked! Action remains pending. 1-of-M compromise cannot execute sensitive actions.${NC}"
else
  echo "Status: ${FINAL_STATUS}"
fi
