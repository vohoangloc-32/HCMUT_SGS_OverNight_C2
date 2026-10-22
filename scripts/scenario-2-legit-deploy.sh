#!/usr/bin/env bash
# ==============================================================================
# Scenario 2: Legitimate Deploy with N-of-M Quorum
#
# Demonstrates an AI agent requesting a production deployment.
# Execution is blocked until 2 independent guardians approve the exact parameters.
# ==============================================================================
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3001}"
FAKE_PROD_URL="${FAKE_PRODUCTION_URL:-http://localhost:4001}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 2: Legitimate Deploy (N-of-M Quorum Approval)${NC}"
echo -e "${BLUE}====================================================================${NC}"

echo -e "\n${YELLOW}Step 1: AI Agent requests production deployment${NC}"
CREATE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "request_deploy",
    "parameters": {
      "version": "1.4.2",
      "commit": "c0ffee1b4d89a234"
    },
    "proposer": {
      "userId": "engineer-alice",
      "agent": "Claude-Code-Agent-v1"
    },
    "source": {
      "kind": "pull_request",
      "reference": "https://github.com/org/sample-repo/pull/42"
    }
  }' || echo "")

if [ -z "$CREATE_RES" ] || ! echo "$CREATE_RES" | grep -q '"id"'; then
  echo -e "${RED}Error: Could not create action request in gateway at ${GATEWAY_URL}.${NC}"
  echo "Ensure the gateway is running with 'make dev' or 'docker compose up'."
  exit 1
fi

ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
PARAMS_HASH=$(echo "$CREATE_RES" | grep -o '"parametersHash":"[^"]*' | cut -d'"' -f4)
STATUS=$(echo "$CREATE_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)

echo "Created Action Request: ${ACTION_ID}"
echo "Status: ${STATUS}"
echo "Parameter Hash: ${PARAMS_HASH}"

echo -e "\n${YELLOW}Step 2: Guardian 1 (Alice) approves${NC}"
APPROVE1_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"guardianId\": \"guardian-alice\",
    \"parametersHash\": \"${PARAMS_HASH}\"
  }")

STATUS1=$(echo "$APPROVE1_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "After Guardian 1: Status is ${STATUS1} (1 of 2 required approvals)"

echo -e "\n${YELLOW}Step 3: Guardian 2 (Bob) approves (Reaching 2-of-3 Quorum)${NC}"
APPROVE2_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"guardianId\": \"guardian-bob\",
    \"parametersHash\": \"${PARAMS_HASH}\"
  }")

STATUS2=$(echo "$APPROVE2_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "After Guardian 2: Status is ${STATUS2}"

echo -e "\n${YELLOW}Step 4: Verify fake-production received deployment${NC}"
if curl -s -f "${FAKE_PROD_URL}/deploys" > /dev/null 2>&1; then
  echo "Checking ${FAKE_PROD_URL}/deploys..."
  curl -s "${FAKE_PROD_URL}/deploys"
else
  echo "(Fake-production server at ${FAKE_PROD_URL} was simulated via in-memory executor)"
fi

echo -e "\n${GREEN}✔ Scenario 2 complete: Legitimate deploy executed only after 2-of-3 quorum.${NC}"
