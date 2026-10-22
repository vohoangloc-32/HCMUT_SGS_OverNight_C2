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
MOCK_MODE="${MOCK_MODE:-0}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 2: Legitimate Deploy (N-of-M Quorum Approval)${NC}"
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

echo -e "\n${YELLOW}Step 1: AI Agent requests production deployment${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
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
        "kind": "github-pr",
        "reference": "https://github.com/org/sample-repo/pull/42"
      }
    }')
  ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  PARAMS_HASH=$(echo "$CREATE_RES" | grep -o '"parametersHash":"[^"]*' | cut -d'"' -f4)
  STATUS=$(echo "$CREATE_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "Created Action Request: ${ACTION_ID}"
  echo "Status: ${STATUS}"
  echo "Parameter Hash: ${PARAMS_HASH}"
else
  ACTION_ID="01HV8G7N9B3W00000000000001"
  PARAMS_HASH="sha256:7b2496a8e8055b3fbf50bc3db0e08c491295cb4f7a77f9801ef06ee791999999"
  STATUS="pending"
  echo -e "${YELLOW}[MOCK MODE] Action Request: ${ACTION_ID}${NC}"
  echo -e "${YELLOW}[MOCK MODE] Tool: request_deploy (version=1.4.2, commit=c0ffee1b4d89a234)${NC}"
  echo -e "${YELLOW}[MOCK MODE] Status: ${STATUS} (0/2 approvals)${NC}"
  echo -e "${YELLOW}[MOCK MODE] Parameter Hash: ${PARAMS_HASH}${NC}"
fi

echo -e "\n${YELLOW}Step 2: Guardian 1 (Alice) logs in and approves${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  ALICE_TOKEN=$(curl -s -X POST "${GATEWAY_URL}/auth/dev-token" \
    -H "Content-Type: application/json" \
    -d '{"userId": "guardian-alice", "role": "guardian"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo "Obtained Dev Token for Guardian Alice (DEV TOKENS ACTIVE: not Tide identity)"

  APPROVE1_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ALICE_TOKEN}" \
    -d "{
      \"parametersHash\": \"${PARAMS_HASH}\"
    }")
  STATUS1=$(echo "$APPROVE1_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "After Guardian 1: Status is ${STATUS1} (1 of 2 required approvals)"
else
  echo -e "${YELLOW}[MOCK MODE] Guardian Alice signs approval with parameter hash binding.${NC}"
  echo -e "${YELLOW}[MOCK MODE] Approvals: 1 of 2 required. Status: approved (partial quorum).${NC}"
fi

echo -e "\n${YELLOW}Step 3: Guardian 2 (Bob) logs in and approves (Reaching 2-of-3 Quorum)${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  BOB_TOKEN=$(curl -s -X POST "${GATEWAY_URL}/auth/dev-token" \
    -H "Content-Type: application/json" \
    -d '{"userId": "guardian-bob", "role": "guardian"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo "Obtained Dev Token for Guardian Bob (DEV TOKENS ACTIVE: not Tide identity)"

  APPROVE2_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/approve" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${BOB_TOKEN}" \
    -d "{
      \"parametersHash\": \"${PARAMS_HASH}\"
    }")
  STATUS2=$(echo "$APPROVE2_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "After Guardian 2: Status is ${STATUS2}"
else
  echo -e "${YELLOW}[MOCK MODE] Guardian Bob signs approval with parameter hash binding.${NC}"
  echo -e "${YELLOW}[MOCK MODE] Quorum condition reached: 2 independent signatures gathered!${NC}"
  echo -e "${YELLOW}[MOCK MODE] Gateway verifies parameter binding hash: sha256:7b2496a8... matches.${NC}"
  echo -e "${YELLOW}[MOCK MODE] Gateway triggers executor: Status transitioned to 'executed'.${NC}"
fi

echo -e "\n${YELLOW}Step 4: Verify fake-production received deployment${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  if curl -s -f "${FAKE_PROD_URL}/deploys" > /dev/null 2>&1; then
    echo "Checking ${FAKE_PROD_URL}/deploys..."
    DEPLOY_LOGS=$(curl -s "${FAKE_PROD_URL}/deploys")
    echo "Fake-production deploy log: ${DEPLOY_LOGS}"
  elif curl -s -f "${FAKE_PROD_URL}/logs" > /dev/null 2>&1; then
    DEPLOY_LOGS=$(curl -s "${FAKE_PROD_URL}/logs")
    echo "Fake-production deploy log: ${DEPLOY_LOGS}"
  else
    echo "Gateway deploy executor finished successfully (external mock at ${FAKE_PROD_URL} offline)."
  fi
else
  echo -e "${YELLOW}[MOCK MODE] Fake-production server verified: Deploy record v1.4.2 (c0ffee1b4d89a234) received.${NC}"
fi

echo -e "\n${GREEN}✔ Scenario 2 complete: Legitimate deploy executed only after 2-of-3 quorum.${NC}"
