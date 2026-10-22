#!/usr/bin/env bash
# ==============================================================================
# Scenario 1: Normal Agent Work (No Approval Needed)
#
# Demonstrates that normal developer agent workflows (code editing, local testing,
# running builds) do not require guardian approval. Only the 3 sensitive operations
# are gated by the gateway.
# ==============================================================================
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3001}"
MOCK_MODE="${MOCK_MODE:-0}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 1: Normal Agent Work (No Approval Needed)${NC}"
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

echo -e "\n${YELLOW}Step 1: Inspect available sensitive tools via MCP / Gateway contract${NC}"
echo "Registered Sensitive MCP Tools:"
echo "  1. request_deploy        (parameters: version, commit)"
echo "  2. request_use_secret    (parameters: secret_name, purpose)"
echo "  3. request_send_external (parameters: destination, payload_ref)"
echo "Normal developer actions (file reading, editing, testing, git branching) remain friction-free."

echo -e "\n${YELLOW}Step 2: Simulate AI agent performing normal local development in sample-repo${NC}"
pushd mock-env/sample-repo > /dev/null
echo "Agent runs unit tests in mock-env/sample-repo..."
npm test || true
popd > /dev/null

echo -e "\n${YELLOW}Step 3: Verify Gateway state${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  COUNT=$(curl -s "${GATEWAY_URL}/actions?status=pending" | grep -o '"id"' | wc -l || echo "0")
  echo "Current pending sensitive requests in live gateway: ${COUNT}"
else
  echo -e "${YELLOW}[MOCK MODE] Mock Action Requests checked: 0 new sensitive requests triggered.${NC}"
  echo -e "${YELLOW}[MOCK MODE] Normal agent development generated zero guardian approval overhead.${NC}"
fi

echo -e "\n${GREEN}✔ Scenario 1 complete: Normal development proceeded without guardian friction.${NC}"
