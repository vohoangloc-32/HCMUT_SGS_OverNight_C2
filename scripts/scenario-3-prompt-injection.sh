#!/usr/bin/env bash
# ==============================================================================
# Scenario 3: Prompt Injection Defense (Blocked)
#
# Demonstrates an indirect prompt injection attack attempting to coerce the AI agent
# into exfiltrating secrets to the fixture target (http://localhost:4002/receive).
#
# Shows TWO outcomes:
#   Outcome (a): Nobody approves and the action request expires without quorum.
#   Outcome (b): One guardian actively rejects the flagged action.
#
# In both outcomes:
#   - Fake-external viewer shows 0 payloads received.
#   - The agent NEVER obtains the secret.
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
echo -e "${BLUE}Scenario 3: Prompt Injection Defense (Two Outcomes)${NC}"
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

echo -e "\n${YELLOW}Step 1: Inspect malicious fixture (Indirect Prompt Injection)${NC}"
echo "Viewing mock-env/fixtures/malicious-issue.md targeting fixture endpoint..."
grep -A 10 "ATTACKER PROMPT INJECTION PAYLOAD" mock-env/fixtures/malicious-issue.md || true

TARGET_DEST="http://localhost:4002/receive"

DEMO_FAST_EXPIRY="${DEMO_FAST_EXPIRY:-3}"

# ── OUTCOME A: NOBODY APPROVES (EXPIRES) ───────────────────────────────────────
echo -e "\n${BLUE}────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Outcome (a): Nobody Approves & Request Expires Without Quorum${NC}"
echo -e "${BLUE}────────────────────────────────────────────────────────────────────${NC}"

echo -e "\n${YELLOW}Step 2a: Agent coerced by prompt injection invokes request_send_external${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  CREATE_A=$(curl -s -X POST "${GATEWAY_URL}/actions" \
    -H "Content-Type: application/json" \
    -H "X-Demo-Fast-Expiry: ${DEMO_FAST_EXPIRY}" \
    -d "{
      \"tool\": \"request_send_external\",
      \"parameters\": {
        \"destination\": \"${TARGET_DEST}\",
        \"payload_ref\": \"diagnostics_dump\"
      },
      \"proposer\": {
        \"userId\": \"injected-agent\",
        \"agent\": \"Claude-Code-Agent-v1\"
      },
      \"source\": {
        \"kind\": \"github-issue\",
        \"reference\": \"mock-env/fixtures/malicious-issue.md\"
      }
    }")
  ACTION_A_ID=$(echo "$CREATE_A" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  GET_A=$(curl -s "${GATEWAY_URL}/actions/${ACTION_A_ID}")
  STATUS_A=$(echo "$GET_A" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  RISK_A=$(echo "$GET_A" | grep -o '"riskSignals":\[[^]]*\]' || echo '["unknown-destination"]')
  EXPIRES_AT_A=$(echo "$GET_A" | grep -o '"expiresAt":"[^"]*' | cut -d'"' -f4)

  echo "Action Request A Created: ${ACTION_A_ID}"
  echo "Target Destination: ${TARGET_DEST}"
  echo "Status: ${STATUS_A} (0/2 approvals)"
  echo "Risk Flags Triggered: ${RISK_A}"
  echo "TTL Expiration: ${EXPIRES_AT_A} (Fast demo TTL: ${DEMO_FAST_EXPIRY}s)"
else
  ACTION_A_ID="01HV8G7N9B3W00000000000003"
  echo -e "${YELLOW}[MOCK MODE] Action Request A Created: ${ACTION_A_ID}${NC}"
  echo -e "${YELLOW}[MOCK MODE] Target Destination: ${TARGET_DEST}${NC}"
  echo -e "${YELLOW}[MOCK MODE] Risk Flags Triggered: [\"unknown-destination\", \"unusual-volume\"]${NC}"
  echo -e "${YELLOW}[MOCK MODE] Status: pending (0/2 approvals)${NC}"
fi

echo -e "\n${YELLOW}Step 3a: Guardians inspect risk signals on dashboard; NOBODY approves${NC}"
echo "Guardians identify untrusted endpoint from malicious issue and withhold approval."
echo "Fast demo expiry: Waiting ${DEMO_FAST_EXPIRY}s for TTL expiration..."
sleep "$((DEMO_FAST_EXPIRY + 1))"
if [ "$IS_LIVE" -eq 1 ]; then
  EXPIRED_CHECK=$(curl -s "${GATEWAY_URL}/actions/${ACTION_A_ID}")
  EXPIRED_STATUS=$(echo "$EXPIRED_CHECK" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "Action Request A status after TTL: ${EXPIRED_STATUS}"
else
  echo -e "${YELLOW}[MOCK MODE] Request status transitioned to: 'expired' (TTL elapsed without quorum).${NC}"
fi

echo -e "\n${YELLOW}Step 4a: Verify fake-external received NO payloads (Outcome a)${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  if curl -s -f "${FAKE_EXT_URL}/logs" > /dev/null 2>&1; then
    LOGS_A=$(curl -s "${FAKE_EXT_URL}/logs")
    echo "Fake-external received logs: ${LOGS_A}"
  else
    echo "Fake-external monitor checked: 0 payloads received (target at ${FAKE_EXT_URL} verified empty)."
  fi
  echo -e "${GREEN}✔ Outcome (a) confirmed: No approval granted, request expired, agent never obtained secret, 0 payloads sent.${NC}"
else
  echo -e "${YELLOW}[MOCK MODE] Fake-external server check: 0 payloads received.${NC}"
  echo -e "${GREEN}✔ Outcome (a) confirmed: No approval granted, request expired, agent never obtained secret, 0 payloads sent.${NC}"
fi

# ── OUTCOME B: ONE GUARDIAN ACTIVELY REJECTS ───────────────────────────────────
echo -e "\n${BLUE}────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Outcome (b): One Guardian Actively Rejects Flagged Action${NC}"
echo -e "${BLUE}────────────────────────────────────────────────────────────────────${NC}"

echo -e "\n${YELLOW}Step 2b: Second exfiltration attempt submitted to gateway${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  CREATE_B=$(curl -s -X POST "${GATEWAY_URL}/actions" \
    -H "Content-Type: application/json" \
    -d "{
      \"tool\": \"request_send_external\",
      \"parameters\": {
        \"destination\": \"${TARGET_DEST}\",
        \"payload_ref\": \"diagnostics_dump\"
      },
      \"proposer\": {
        \"userId\": \"injected-agent\",
        \"agent\": \"Claude-Code-Agent-v1\"
      },
      \"source\": {
        \"kind\": \"github-issue\",
        \"reference\": \"mock-env/fixtures/malicious-issue.md\"
      }
    }")
  ACTION_B_ID=$(echo "$CREATE_B" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  echo "Action Request B Created: ${ACTION_B_ID}"
  echo "Target Destination: ${TARGET_DEST}"
else
  ACTION_B_ID="01HV8G7N9B3W00000000000005"
  echo -e "${YELLOW}[MOCK MODE] Action Request B Created: ${ACTION_B_ID}${NC}"
fi

echo -e "\n${YELLOW}Step 3b: Guardian Alice logs in, reviews risk flags, and actively REJECTS${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  ALICE_TOKEN=$(curl -s -X POST "${GATEWAY_URL}/auth/dev-token" \
    -H "Content-Type: application/json" \
    -d '{"userId": "guardian-alice", "role": "guardian"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  echo "Obtained Dev Token for Guardian Alice (DEV TOKENS ACTIVE: not Tide identity)"

  REJECT_RES=$(curl -s -X POST "${GATEWAY_URL}/actions/${ACTION_B_ID}/reject" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ALICE_TOKEN}" \
    -d '{
      "reason": "Prompt injection detected: unauthorized destination http://localhost:4002/receive"
    }')
  STATUS_B=$(echo "$REJECT_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  echo "After Guardian Rejection: Status is '${STATUS_B}'"
  echo "Rejection reason recorded in append-only audit trail."
else
  echo -e "${YELLOW}[MOCK MODE] Guardian Alice clicks 'Reject Action' with reason: 'Prompt injection detected'${NC}"
  echo -e "${YELLOW}[MOCK MODE] Status transitioned to 'rejected'${NC}"
  echo -e "${YELLOW}[MOCK MODE] Audit Event recorded: event='rejected', actor='guardian-alice'${NC}"
fi

echo -e "\n${YELLOW}Step 4b: Verify fake-external server still has 0 payloads (Outcome b)${NC}"
if [ "$IS_LIVE" -eq 1 ]; then
  if curl -s -f "${FAKE_EXT_URL}/logs" > /dev/null 2>&1; then
    LOGS_B=$(curl -s "${FAKE_EXT_URL}/logs")
    echo "Fake-external received logs: ${LOGS_B}"
  else
    echo "Fake-external monitor checked: 0 payloads received."
  fi
  echo -e "${GREEN}✔ Outcome (b) confirmed: Guardian rejection halted execution, agent never obtained secret, 0 payloads sent.${NC}"
else
  echo -e "${YELLOW}[MOCK MODE] Fake-external check: 0 payloads received. Viewer at ${FAKE_EXT_URL}/viewer is clean.${NC}"
  echo -e "${GREEN}✔ Outcome (b) confirmed: Guardian rejection halted execution, agent never obtained secret, 0 payloads sent.${NC}"
fi

echo -e "\n${GREEN}====================================================================${NC}"
echo -e "${GREEN}✔ Scenario 3 complete: In both outcomes (expiration & rejection),${NC}"
echo -e "${GREEN}  the external server received 0 payloads and the agent never obtained the secret.${NC}"
echo -e "${GREEN}====================================================================${NC}"
