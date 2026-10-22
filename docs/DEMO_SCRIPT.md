# Demo Script — Key-Holder Gateway

> **Owner**: P2 (Surface / Video Deliverable)
> **Target**: 2-Minute (120-Second) Hackathon Demo Video & Reproducible Walkthrough

---

## 1. Video Production Setup

- **Layout**: Split screen or side-by-side:
  - **Left 50%**: Terminal (18pt font, dark mode, high contrast).
  - **Right 50%**: Guardian UI running at `http://localhost:5173` (zoom 125%).
- **Resolution**: 1920x1080 (1080p), 30 or 60 fps.
- **Audio**: Clear, steady narration; 1-second pause after each key transition.
- **On-Screen Captions**: Bold lower-third banners highlighting the security guarantee at each step.

---

## 2. 2-Minute Video Timeline (Exact 120 Seconds)

| Timestamp | Visual / Screen Focus | On-Screen Text Banner | Spoken Narration Script | Action / Terminal Command |
| :--- | :--- | :--- | :--- | :--- |
| **0:00–0:12**<br>*(12s)* | Split screen: terminal with agent prompt + Guardian UI header. | **The Problem: AI Agents Share Developer Authority** | "AI coding agents are gaining autonomy to deploy code and use credentials. But today, if an agent is tricked by prompt injection, it can exfiltrate secrets or deploy malicious code instantly. There is no multi-party authority." | Show agent terminal ready. |
| **0:12–0:24**<br>*(12s)* | Architecture diagram graphic & Guardian UI showing 2-of-3 Quorum. | **The Solution: Emergent Authority via TideCloak** | "We built the Key-Holder Gateway. The agent never receives secrets. All sensitive actions are intercepted and require N-of-M guardian quorum through TideCloak before execution." | Navigate to `http://localhost:5173`. |
| **0:24–0:50**<br>*(26s)* | Scenario 2: Agent requests deploy → Alice approves → Bob approves → Executed. | **Scenario 2: Legitimate Deploy via 2-of-3 Quorum** | "Here, the agent requests a production deploy. The gateway intercepts it with status 'pending'. Guardian Alice reviews the commit and approves. Quorum is 1 of 2. Guardian Bob approves — reaching 2-of-3 quorum. The gateway executes the deploy to production and records the immutable audit log." | `bash scripts/scenario-2-legit-deploy.sh`<br>Show UI progress bar: 0/2 → 1/2 → Executed. |
| **0:50–1:15**<br>*(25s)* | Scenario 3: Malicious issue with hidden injection → Flagged UI → Rejection → External viewer. | **Scenario 3: Prompt Injection Blocked by Risk Rules & Guardians** | "Now, an attacker files an issue with hidden prompt injection, commanding the agent to send API keys to an evil server. The agent tries to send it, but the gateway flags external domain risk signals. Guardian reviews the flag and rejects it. The evil receiver gets zero bytes. The agent never possessed the key." | `bash scripts/scenario-3-prompt-injection.sh`<br>Show red risk badge in UI + `http://localhost:4002/viewer` (0 payloads). |
| **1:15–1:35**<br>*(20s)* | Scenario 4: Compromised account attempts self-approval + single approval. | **Scenario 4: Single Compromised Account Fails** | "What if an attacker steals a guardian account? First: self-approval is strictly forbidden under the four-eyes principle. Second: a single rogue signature is not enough to meet quorum. The action remains blocked in pending status." | `bash scripts/scenario-4-manual-attacker.sh`<br>Show `SELF_APPROVAL` 409 rejection and pending state. |
| **1:35–1:48**<br>*(13s)* | Scenario 5: Parameter hash verification failure. | **Scenario 5: Parameter-Bound Cryptographic Signatures** | "Every approval is cryptographically bound to the canonical parameter hash. If an attacker tampers with the payload after Alice approved, the gateway detects the hash mismatch and halts execution." | `bash scripts/scenario-5-param-swap.sh`<br>Show `HASH_MISMATCH` 422 error. |
| **1:48–2:00**<br>*(12s)* | Summary slide & GitHub repo link. | **Emergent Authority: No Single Party Holds the Master Key** | "Key-Holder Gateway with TideCloak: True emergent authority where sensitive operations only execute when independent guardians agree. Check out our open-source repo." | Show GitHub README + audit trail. |

---

## 3. Detailed Walkthrough of the 5 Demo Scenarios

### Scenario 1 — Normal Developer Agent Work (No Approval Friction)
- **Goal**: Prove that normal development (editing code, running tests, local builds) is NOT impeded by the gateway.
- **Command**:
  ```bash
  bash scripts/scenario-1-normal.sh
  ```
- **Expected Outcome**:
  - Sample repository unit tests run and pass without guardian interaction.
  - Zero sensitive action requests created.
  - UI shows 0 pending requests.

### Scenario 2 — Legitimate Deploy with N-of-M Quorum
- **Goal**: Demonstrate the happy path for sensitive capabilities.
- **Command**:
  ```bash
  bash scripts/scenario-2-legit-deploy.sh
  ```
- **Expected Outcome**:
  - Action request created for `request_deploy` (`version: 1.4.2`).
  - Guardian 1 (Alice) approves &rarr; Status is `approved` (1/2 signatures).
  - Guardian 2 (Bob) approves &rarr; Status transitions to `executed` (2/2 signatures).
  - Production mock server (`http://localhost:4001/viewer`) shows release recorded.
  - Audit log shows full chronological trace.

### Scenario 3 — Prompt Injection Defense (Secret Exfiltration Blocked)
- **Goal**: Demonstrate resilience against indirect prompt injection.
- **Command**:
  ```bash
  bash scripts/scenario-3-prompt-injection.sh
  ```
- **Expected Outcome**:
  - Compromised agent invokes `request_send_external` targeting `evil.attacker-controlled-site.org`.
  - Gateway flags deterministic risk signals: `external-domain`, `unknown-destination`.
  - UI highlights high-contrast alert callout.
  - Guardian rejects the request with reason.
  - External endpoint (`http://localhost:4002/viewer`) shows **0 payloads received (Nothing arrived)**.

### Scenario 4 — Single Compromised Account Attack (Blocked)
- **Goal**: Demonstrate defense against rogue insider or stolen credential.
- **Command**:
  ```bash
  bash scripts/scenario-4-manual-attacker.sh
  ```
- **Expected Outcome**:
  - Proposer attempts to approve their own request &rarr; Gateway rejects with `SELF_APPROVAL (409 Conflict)`.
  - Single rogue guardian approves &rarr; Request remains `pending` (1 of 2 required).
  - Secret is NEVER released; execution does not trigger.

### Scenario 5 — Parameter Swap Tampering Defense (Stretch)
- **Goal**: Demonstrate parameter-bound cryptographic binding.
- **Command**:
  ```bash
  bash scripts/scenario-5-param-swap.sh
  ```
- **Expected Outcome**:
  - Alice approves benign deploy parameters (hash recorded).
  - Malicious actor attempts second approval with altered parameter payload.
  - Gateway detects hash discrepancy and aborts with `HASH_MISMATCH (422)`.
  - Deploy does not execute.

---

## 4. Pre-Recording Checklist

- [x] Node.js dependencies installed across all workspaces (`packages/*`).
- [x] `npm run build -w packages/shared` and `npm run build -w packages/guardian-ui` pass.
- [x] Guardian UI supports both **Live Gateway** and **Canned Mock Mode**.
- [x] Guardian UI demonstrates all 6 states:
  - `loading`
  - `empty`
  - `error`
  - `already-decided`
  - `expired`
  - `proposer-cannot-approve-own-request`
- [x] Fake external viewer at `http://localhost:4002/viewer` shows 0 payloads.
- [x] Scenario scripts 1–5 runnable with one command each in deterministic mock mode.
- [x] `make reset` command restores clean demonstration state.
