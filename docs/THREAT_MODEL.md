# Threat Model — Key-Holder Gateway

> **Owner**: P2 (Surface/Threat Analysis) + P1 (TideCloak Verification Tracking)
> **Theme**: Emergent Authority (No single master key or rogue actor can execute sensitive actions)

---

## 1. System Overview & Security Boundary

```
[ AI Agent Context ] ──(MCP Protocol)──► [ Key-Holder Gateway ] ──► Sensitive Actions
  (Untrusted / Injected)                       │                     - Production Deploy
                                               │                     - Secret Decrypt
                                       [ Gateway Quorum Engine ]     - External Send
                                   (N-of-M threshold verification
                                   using TideCloak guardian JWTs)
```

The Key-Holder Gateway acts as a reference monitor intercepting any sensitive action requested by an AI coding agent. The agent is strictly unprivileged: it never receives plaintext credentials or deploy keys. All executions require an independent quorum of guardian signatures.

### Why Agents Do Not Hold Tide Identities
An autonomous agent process cannot hold a Tide identity or sign Tide transactions directly. Tide authentication (PRISM threshold password verification) and cryptographic signing require a human-owned browser session running the Tide Web Enclave (GAP-064 / GAP-063). Therefore, agents propose sensitive actions via MCP tools, and human guardians authenticate and approve within their browser sessions.

---

## 2. Capability Responsibility Split: Genuine Tide vs Gateway vs Mocked

To maintain strict truth-in-documentation, the system separates capabilities across three distinct enforcement layers:

| Genuine Tide Capabilities | Enforced by Our Gateway | Mocked / Demonstration Scaffolding |
| :--- | :--- | :--- |
| **Threshold (PRISM) Authentication**: Multi-node threshold verification — no password hash stored on any central server. | **N-of-M Quorum Enforcement**: Gateway counts approvals (2-of-3 threshold) and gates execution. *(Tide does not enforce application quorum natively).* | **Fake Production Server**: Target HTTP server on `:4001` verifying release dispatch. |
| **VVK Threshold-Signed JWTs**: Validation Verification Key threshold signatures issued by TideCloak ORK nodes. | **Parameter-Hash Binding**: Canonical JSON SHA-256 hash (`parametersHash`). Approval signatures bind to this hash; mismatch aborts execution (`HASH_MISMATCH`). | **Fake External Server**: Sink HTTP server on `:4002` verifying 0 leaked bytes during exfiltration attempts. |
| **Offline JWT Verification**: Verified locally using `jose` with embedded JWKS from realm adapter JSON (`config.jwk`), without remote cert lookups. | **Self-Approval Prevention**: Four-Eyes Principle enforced (`SELF_APPROVAL` 409 rejection if `guardianId === proposer.userId`). | **Fake Secrets Fixture**: Canned secrets in `fake-secrets.txt` explicitly labeled with the `FAKE` prefix. |
| *(Note: UI login in the local demo uses simulated profiles labeled `MOCK LOGIN` because live TideCloak container is not running on this host).* | **Secret Isolation & Handles**: Raw secrets never touch the agent; the gateway returns opaque ephemeral handles (`sec-handle-*`). | **Guardian UI Session**: Simulated session with high-contrast `MOCK LOGIN` badges. |
| | **AES-256-GCM Secret Store**: Secret table holds authenticated ciphertext only; key is in process memory/env. *(NOT Tide tag encryption, which requires browser enclave).* | |

> [!IMPORTANT]
> **Tide's Role in this Demonstration**:
> Tide's role is **implemented in code and unit tests, NOT demonstrated live in this demo**.
> When running locally without a live TideCloak container, the gateway operates in DEV token mode (signed via `DEV_TOKEN_SECRET`, logging startup warning `⚠️ DEV TOKENS ACTIVE: not Tide identity`). Dev tokens are strictly for local development and scenario testing and are **never presented as Tide identity**.
>
> **Terminology Discipline**:
> - We do **NOT** claim *"Tide enforces quorum"* — the gateway's internal quorum engine tallies approvals backed by TideCloak guardian identities.
> - We do **NOT** claim *"Tide encrypts our secrets"* — server-side secret storage uses AES-256-GCM authenticated encryption because Tide tag encryption requires client browser Web Enclaves.

---

## 3. Protected Assets

| Asset | Sensitivity | Location | Protection Mechanism |
|-------|-------------|----------|----------------------|
| **Production Deploy Keys** | Critical | Host / Protected Env | Intercepted behind `request_deploy`; executed only after 2-of-3 quorum |
| **API Keys & Vault Secrets** | Critical | Secret Vault / Gateway | Intercepted behind `request_use_secret`; decrypted only post-quorum; agent receives only opaque handle |
| **Protected Git Repository** | Critical | `PROTECTED_REPO_PATH` | Intercepted behind `request_code_change`; agent has NO write access; tests executed on temp branch; merged only after 2/2 quorum |
| **Outbound Data Channels** | High | Gateway Network Layer | Intercepted behind `request_send_external`; flagged by deterministic risk signals |
| **Guardian Identities** | High | TideCloak / Threshold | PRISM threshold authentication; VVK threshold-signed JWTs |
| **Action Requests Store** | Medium | Gateway Store | Parameter hash binding (`sha256`); approvals bound to hash |
| **Audit Trail** | Medium | Gateway Append-Only Log | Cryptographically stamped chronological event trail |

---

## 4. What We Defend Against (Defend Scope)

### A. Indirect Prompt Injection → Secret Exfiltration
- **Attack Vector**: An attacker places hidden prompt injection instructions inside a GitHub issue, pull request diff, or documentation file (e.g., `mock-env/fixtures/malicious-issue.md`). When an AI agent processes the file, the instruction tricks the agent into reading secrets and invoking `request_send_external` targeting `http://localhost:4002/receive`.
- **Mitigation**:
  1. The agent holds no ambient secrets: it cannot read env vars or files directly without triggering MCP tools.
  2. The gateway intercepts `request_send_external`, creates a pending Action Request, and flags deterministic risk signals (`unknown-destination`, `unusual-volume`).
  3. The request appears on the Guardian UI with high-contrast alert callouts.
  4. Guardians review the payload reference and untrusted destination:
     - **Outcome (a)**: Nobody approves &rarr; the request expires without quorum.
     - **Outcome (b)**: A guardian actively rejects the request with a logged reason.
  5. In both outcomes, the external mock server (`fake-external`) receives **0 bytes**, and the agent never obtains secret plaintext.

### B. Single Compromised Account (Rogue Guardian or Compromised Agent Session)
- **Attack Vector**: An attacker compromises a single developer or guardian credential and attempts to force an unauthorized deployment or extract credentials.
- **Mitigation**:
  1. **Strict 2-of-3 Quorum**: A single guardian cannot execute any sensitive action alone (leaves request pending at 1/2).
  2. **Proposer Cannot Approve Own Request (Four-Eyes Principle)**: The gateway explicitly rejects self-approval with `SELF_APPROVAL (409 Conflict)`.
  3. **TideCloak Identity Guarantees**: Guardian identities are backed by TideCloak threshold authentication; no single database breach leaks guardian master credentials.
  4. **Database Leak Protection**: The database stores only AES-256-GCM ciphertext, IV, and auth tag; the encryption key is held in gateway process memory/environment variables, so leaking the database exposes no key material.

### C. In-Flight Parameter Tampering (Parameter-Swap Attack)
- **Attack Vector**: A malicious actor or compromised intermediate proxy attempts to alter parameters after an initial approval is gathered (e.g., swapping a benign commit hash for a malicious payload).
- **Mitigation**:
  1. The gateway computes a canonical JSON SHA-256 hash (`parametersHash`).
  2. Each guardian signature cryptographically binds to this specific hash.
  3. Before execution, the gateway re-hashes the parameters and verifies equality against all recorded approval signatures.
  4. Any mismatch immediately aborts execution with `HASH_MISMATCH (422)`.

---

## 5. What We Explicitly Do NOT Defend Against (Known Limitations)

| Threat Scenario | Why Out of Scope | Honest Engineering Statement |
|-----------------|------------------|------------------------------|
| **Guardians Being Deceived / Social Engineering** | Technical controls cannot prevent human guardians from being tricked into approving a malicious request. | *"Quorum security is strictly bounded by the human diligence and verification of the minimum threshold (N guardians)."* |
| **Hasty Review / Rubber-Stamping** | If 2 out of 3 guardians hastily approve without inspecting commit hashes or payload references. | *"Quorum enforces authority distribution, not the depth of human code review."* |
| **Shared OS User (PoC Boundary)** | In this local prototype, the agent and gateway share the host OS user. | *"Filesystem separation between agent workspace and PROTECTED_REPO_PATH is an architectural pattern, not an OS sandbox."* |
| **Forgotten Gates** | Sensitive actions not placed behind the gateway's MCP tools (`request_deploy`, `request_use_secret`, `request_send_external`, `request_code_change`). | *"The gateway can only protect capabilities explicitly mediated through its interface."* |
| **Agents with Unrestricted Local Terminal Access & Secrets on the Machine** | If secrets already reside in plain text within `.bashrc`, `.env`, or local files accessible to the agent process. | *"Gateway protection assumes secrets are segregated behind the gateway interface; local secrets on the agent's host bypass mediation."* |
| **Compromised Host OS Running Gateway** | If an attacker has root access on the machine hosting the gateway process itself. | *"Host compromise requires container isolation, remote HSMs, and live Tide Fabric participation."* |
| **Network Man-in-the-Middle (without TLS)** | The hackathon prototype runs locally over HTTP (`localhost`). | *"Production deployments require mandatory mutual TLS (mTLS) and verified TideCloak OIDC tokens."* |

---

## 6. Compromise Matrix: Ordinary Agent Setup vs. Key-Holder Gateway

| Attacker Controls | Capability | Ordinary Agent Architecture | Key-Holder Gateway + TideCloak | Enforcement Layer & Status |
| :--- | :--- | :--- | :--- | :--- |
| **Agent Context Only**<br>*(Prompt Injection)* | Deploy Malicious Code | 🔴 **Allowed** (Instant deploy) | 🟢 **Blocked** (Needs 2-of-3 quorum) | Enforced by Gateway Quorum Engine |
| | Exfiltrate Secrets | 🔴 **Allowed** (Agent reads env) | 🟢 **Blocked** (Agent never gets key) | Enforced by Gateway SecretStore mediation |
| | Outbound Network Send | 🔴 **Allowed** (Direct curl/fetch) | 🟢 **Blocked** (Flagged & rejected in UI) | Enforced by Gateway Risk Signals & UI |
| | Inject Malicious Code Patch | 🔴 **Allowed** (Pushes directly to repo) | 🟢 **Blocked** (Diff reviewed in UI, tests verified, needs 2/2 quorum) | Enforced by CodeChangeExecutor & Quorum |
| | Bypass Audit Trail | 🔴 **Possible** (No audit) | 🟢 **Blocked** (Append-only audit log) | Enforced by Gateway Audit Store |
| **1 Guardian Account**<br>*(Stolen Credential)* | Deploy Malicious Code | 🔴 **Allowed** (Single-user CI/CD) | 🟢 **Blocked** (1/2 approvals, quorum fails) | Enforced by Gateway Quorum Engine |
| | Self-Approve Malicious PR | 🔴 **Allowed** (If permissions allow)| 🟢 **Blocked** (`SELF_APPROVAL` 409 error) | Enforced by Gateway Business Rules |
| | Exfiltrate Database Secret | 🔴 **Allowed** (Single token leak)| 🟢 **Blocked** (Requires 2nd signature) | Enforced by Multi-Party Threshold |
| | Force Malicious Code Merge | 🔴 **Allowed** (Single approval push)| 🟢 **Blocked** (Requires 2 independent guardian signatures) | Enforced by Gateway Quorum Engine |
| | Forge Approval on Tampered Hash | 🔴 **Allowed** (No hash check) | 🟢 **Blocked** (`HASH_MISMATCH` 409/422 error) | Enforced by Parameter Binding |
| **Gateway DB Leaked**<br>*(Read Access to DB)* | Read Production Secrets | 🔴 **Plaintext exposed** | 🟢 **Blocked** (Ciphertext only) | Enforced by Gateway AES-256-GCM secret store (key in memory/env; NOT Tide tag encryption). |
| | Fabricate Valid Approvals | 🔴 **Easy** (Update DB table) | 🟢 **Blocked** (Signatures bound to Tide JWTs) | Enforced by TideAdapter JWT verification |
| **2 Guardian Accounts**<br>*(Collusion / Breach)* | Force Malicious Deploy | 🔴 **Allowed** | 🔴 **Allowed** (Quorum satisfied) | **Accepted Limitation**: 2-of-3 compromise meets quorum by design. |
| **Full Host Compromise** | Tamper with Process Memory | 🔴 **Allowed** | 🔴 **Allowed** (Host root compromise) | **Accepted Limitation**: Out of scope for demo prototype. |

---

## 7. Deterministic Risk Signal Specification

Risk signals are computed deterministically on request ingress:
```typescript
export type RiskSignal =
  | 'external-domain'       // Target URL hostname is outside trusted corporate domains
  | 'unknown-destination'   // Target URL has never previously succeeded in the audit log
  | 'sensitive-tag'         // Secret name matches high-privilege credentials pattern (PROD, KEY, TOKEN)
  | 'unusual-volume'        // Agent request burst or diagnostic payload exceeds threshold
  | 'new-network-call'      // Code patch introduces outbound fetch/http request
  | 'env-access'            // Code patch references process.env, credentials, or .env files
  | 'new-dependency'        // Code patch modifies package dependencies
  | 'ci-config-change'      // Code patch alters CI workflows or build scripts
  | 'large-diff'            // Code patch exceeds 500 lines modified
  | 'protected-path';       // Code patch targets protected system or gateway files
```

---

## 8. Audit Event Specification

Every lifecycle state transition is committed to the append-only audit trail:
- `created`: Recorded on MCP ingress with canonical parameter hash.
- `approved`: Recorded with guardian ID, parameter hash, and timestamp.
- `rejected`: Recorded with guardian ID and rejection reason.
- `quorum-reached`: Recorded when valid approvals equal `requiredApprovals`.
- `executed`: Recorded when the gateway triggers the executor post-quorum.
- `expired`: Recorded when an action exceeds TTL without quorum.
- `hash-mismatch`: Recorded if parameters are modified during transit.
