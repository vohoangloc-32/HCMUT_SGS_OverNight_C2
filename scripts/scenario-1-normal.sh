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

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 1: Normal Agent Work (No Approval Needed)${NC}"
echo -e "${BLUE}====================================================================${NC}"

echo -e "\n${YELLOW}Step 1: Check available sensitive tools via MCP / Gateway contract${NC}"
echo "Sensitive MCP Tools: request_deploy, request_use_secret, request_send_external"
echo "Code editing, unit testing, git branching are unrestricted and out-of-band."

echo -e "\n${YELLOW}Step 2: Simulate agent performing normal local development in sample-repo${NC}"
pushd mock-env/sample-repo > /dev/null
echo "Running tests in mock-env/sample-repo..."
npm test || true
popd > /dev/null

echo -e "\n${YELLOW}Step 3: Verify Gateway state${NC}"
echo "Checking gateway at ${GATEWAY_URL}/actions..."
if curl -s -f "${GATEWAY_URL}/health" > /dev/null 2>&1; then
  COUNT=$(curl -s "${GATEWAY_URL}/actions?status=pending" | grep -o '"id"' | wc -l || echo "0")
  echo "Current pending requests in gateway: ${COUNT}"
else
  echo "(Gateway not running or in mock mode; no sensitive requests triggered)"
fi

echo -e "\n${GREEN}✔ Scenario 1 complete: Normal development proceeded without guardian friction.${NC}"
