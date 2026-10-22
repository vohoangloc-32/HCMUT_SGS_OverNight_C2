# Demo Script — Key-Holder Gateway

> **Owner**: P2 (Surface / Video Deliverable)
> **Target**: 2-Minute (120-Second) Hackathon Demo Video & Reproducible Walkthrough

---

## 1. Video Production Setup

- **Layout**: Split screen side-by-side:
  - **Left 50%**: Terminal (18pt font, dark mode, high contrast).
  - **Right 50%**: Guardian UI running at `http://localhost:5173` (zoom 125%).
- **Resolution**: 1920x1080 (1080p), 30 or 60 fps.
- **Audio**: Clear, steady narration; 1-second pause after each key transition.
- **On-Screen Captions**: Bold lower-third banners highlighting the security guarantee at each step.
- **One-Command Setup**: `make demo` starts the gateway, UI, fake production, and fake external endpoints.

---

## 2. 2-Minute Video Timeline (Exact 120 Seconds)

| Timestamp | Visual / Screen Focus | On-Screen Text Banner | Spoken Narration Script | Action / Terminal Command |
| :--- | :--- | :--- | :--- | :--- |
| **0:00–0:12**<br>*(12s)* | Split screen: terminal with agent prompt + Guardian UI header with `MOCK LOGIN` badge. | **The Problem: AI Agents Share Developer Authority** | "AI coding agents are gaining autonomy to deploy code and use credentials. But today, if an agent is tricked by prompt injection, it can exfiltrate secrets or deploy malicious code instantly. There is no multi-party authority." | Show agent terminal ready. |
| **0:12–0:24**<br>*(12s)* | Architecture diagram graphic & Guardian UI showing 2-of-3 Quorum. | **The Solution: Emergent Authority via Gateway & Tide** | "We built the Key-Holder Gateway. The agent never receives secrets. All sensitive actions require an N-of-M guardian quorum enforced by the gateway using Tide-verified guardian identities before execution." | Navigate to `http://localhost:5173`. |
| **0:24–0:50**<br>*(26s)* | Scenario 2: Agent requests deploy → Alice approves → Bob approves → Executed. | **Scenario 2: Legitimate Deploy via 2-of-3 Quorum** | "Here, the agent requests a production deploy. The gateway intercepts it with status 'pending'. Guardian Alice reviews the commit and approves. Quorum is 1 of 2. Guardian Bob approves — reaching 2-of-3 quorum. The gateway executes the deploy to production and records the immutable audit log." | `bash scripts/scenario-2-legit-deploy.sh`<br>Show UI progress bar: 0/2 → 1/2 → Executed. |
| **0:50–1:15**<br>*(25s)* | Scenario 3: Malicious issue with hidden injection targeting `http://localhost:4002/receive` → Two outcomes. | **Scenario 3: Prompt Injection Blocked (Two Outcomes)** | "Now, an attacker files an issue with hidden prompt injection commanding the agent to send secrets to an external target. The gateway flags risk signals. In outcome A, nobody approves and the request expires. In outcome B, a guardian actively rejects it. In both outcomes, zero payloads arrive and the agent never gets the secret." | `bash scripts/scenario-3-prompt-injection.sh`<br>Show risk badges in UI + `http://localhost:4002/viewer` (0 payloads). |
| **1:15–1:35**<br>*(20s)* | Scenario 4: Compromised account attempts self-approval + single approval + DB inspection. | **Scenario 4: Single Compromised Account Fails** | "What if an attacker steals a guardian account? First: self-approval is rejected under the four-eyes principle. Second: a single rogue signature leaves it pending 1/2. And inspecting the database proves secrets are stored as ciphertext only, with zero key material in the DB." | `bash scripts/scenario-4-manual-attacker.sh`<br>Show `SELF_APPROVAL` 409 rejection and DB ciphertext output. |
| **1:35–1:48**<br>*(13s)* | Scenario 5: Parameter hash verification failure. | **Scenario 5: Parameter-Bound Cryptographic Signatures** | "Every approval is cryptographically bound to the canonical parameter hash. If an attacker tampers with the payload after Alice approved, the gateway detects the hash mismatch and halts execution." | `bash scripts/scenario-5-param-swap.sh`<br>Show `HASH_MISMATCH` 422 error. |
| **1:48–2:00**<br>*(12s)* | Summary slide & GitHub repo link. | **Emergent Authority: No Single Party Holds the Master Key** | "Key-Holder Gateway: True emergent authority where sensitive operations only execute when independent guardians agree. Check out our open-source repo." | Show GitHub README + audit trail. |

---

## 3. Capability Responsibility Split: Genuine Tide vs Gateway vs Mocked

| Genuine Tide Capabilities | Enforced by Our Gateway | Mocked / Scaffolding |
| :--- | :--- | :--- |
| **Threshold (PRISM) Authentication**: Multi-party password verification without central hash storage. | **N-of-M Quorum Enforcement**: Gateway counts approvals (2-of-3 threshold) and gates execution. *(Tide does not enforce application quorum natively).* | **Fake Production Server**: Target on `:4001/viewer`. |
| **VVK Threshold-Signed JWTs**: Validation Verification Key threshold signatures from TideCloak ORK nodes. | **Parameter-Hash Binding**: Canonical JSON SHA-256 hash (`parametersHash`). Approval signatures bind to this hash; mismatch aborts execution (`HASH_MISMATCH`). | **Fake External Sink**: Stand-in on `:4002/viewer`. |
| **Offline JWT Verification**: Local `jose` verification using embedded JWKS from realm adapter JSON (`config.jwk`). | **Self-Approval Prevention**: Four-Eyes Principle enforced (`SELF_APPROVAL` 409 rejection if `guardianId === proposer.userId`). | **Fake Secrets Fixture**: Canned secrets in `fake-secrets.txt` carrying the `FAKE` prefix. |
| *(Note: UI login uses simulated profiles labeled `MOCK LOGIN` because live TideCloak container is not running on this host).* | **Secret Isolation & Handles**: Raw secrets never touch the agent; the gateway returns opaque ephemeral handles (`sec-handle-*`). | **Guardian UI Session**: Simulated session with prominent `MOCK LOGIN` badge. |
| | **AES-256-GCM Secret Store**: Secret table holds authenticated ciphertext only; key is in process memory/env. *(NOT Tide tag encryption).* | |

> [!NOTE]
> **Why Agents Do Not Hold Tide Identities**:
> Autonomous agents cannot hold Tide identities or sign Tide transactions directly because Tide authentication and cryptographic signing require a human-owned browser session (Web Enclave per GAP-064/GAP-063). Therefore, agents propose actions via MCP tools, and human guardians authenticate and approve in the browser.

---

## 4. Detailed Walkthrough of the 5 Demo Scenarios

### Scenario 1 — Normal Developer Agent Work (No Approval Friction)
- **Goal**: Prove that everyday development (editing code, running tests, local builds) is NOT impeded by the gateway.
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
  - Action request created for `request_deploy` (`version: 1.4.2`, commit `c0ffee1b4d89a234`).
  - Guardian 1 (Alice) approves &rarr; Status is `pending` (1/2 signatures).
  - Guardian 2 (Bob) approves &rarr; Status transitions to `approved`/`executed` (2/2 signatures).
  - Production mock server (`http://localhost:4001/viewer`) shows release recorded.
  - Audit log records full chronological trace.

### Scenario 3 — Prompt Injection Defense (Secret Exfiltration Blocked)
- **Goal**: Demonstrate resilience against indirect prompt injection targeting fixture endpoint (`http://localhost:4002/receive`).
- **Command**:
  ```bash
  bash scripts/scenario-3-prompt-injection.sh
  ```
- **Expected Outcome**:
  - Compromised agent invokes `request_send_external` targeting `http://localhost:4002/receive` with `payload_ref: "diagnostics_dump"`.
  - Gateway flags deterministic risk signals: `unknown-destination`, `unusual-volume`.
  - Shows two outcomes:
    - **Outcome (a)**: Nobody approves &rarr; request expires without quorum.
    - **Outcome (b)**: Guardian Alice actively rejects with reason.
  - In both outcomes: External endpoint (`http://localhost:4002/viewer`) shows **0 payloads received (Nothing arrived)**, and the agent never obtains the secret.

### Scenario 4 — Single Compromised Account Attack (Blocked)
- **Goal**: Demonstrate defense against rogue insider or stolen credential.
- **Command**:
  ```bash
  bash scripts/scenario-4-manual-attacker.sh
  ```
- **Expected Outcome**:
  - Proposer attempts to approve their own request &rarr; Gateway rejects with `SELF_APPROVAL (409 Conflict)`.
  - Single rogue guardian approves &rarr; Request remains `pending` (1 of 2 required, quorum not met).
  - Secret is NEVER released; execution does not trigger.
  - DB inspection command confirms the secrets table holds **ONLY AES-256-GCM ciphertext**; NO encryption key material is in the database.

### Scenario 5 — Parameter Swap Tampering Defense
- **Goal**: Demonstrate parameter-bound cryptographic binding.
- **Command**:
  ```bash
  bash scripts/scenario-5-param-swap.sh
  ```
- **Expected Outcome**:
  - Alice approves benign deploy parameters (hash recorded).
  - Malicious actor attempts second approval with altered parameter payload hash.
  - Gateway detects hash discrepancy and aborts with `HASH_MISMATCH (422)`.
  - Deploy does not execute.

---

## 5. Pre-Recording Checklist & Backup Plan

- [ ] Run `make demo` to start all 4 services concurrently.
- [ ] Verify health endpoints:
  - `curl -s http://localhost:3001/health` &rarr; `{"status":"ok",...}`
  - `curl -s http://localhost:4001/health` &rarr; `{"status":"ok",...}`
  - `curl -s http://localhost:4002/health` &rarr; `{"status":"ok",...}`
  - Open `http://localhost:5173` in browser.
- [ ] Run all scenarios against the live gateway:
  ```bash
  bash scripts/scenario-1-normal.sh
  bash scripts/scenario-2-legit-deploy.sh
  bash scripts/scenario-3-prompt-injection.sh
  bash scripts/scenario-4-manual-attacker.sh
  bash scripts/scenario-5-param-swap.sh
  ```
- [ ] Confirm no scenario prints `[MOCK MODE]` during live execution.
- [ ] **Backup Plan**: Record a full take early. If live network ports experience conflict on the recording machine, pass `MOCK_MODE=1` to run the deterministic offline contract tests (`MOCK_MODE=1 bash scripts/scenario-2-legit-deploy.sh`).
