# Threat Model — Key-Holder Gateway

> **Owner**: P2 (Surface/Threat Analysis) + P1 (TideCloak Verification Tracking)
> **Theme**: Emergent Authority (No single master key or rogue actor can execute sensitive actions)

---

## 1. System Overview & Security Boundary

```
[ AI Agent Context ] ──(MCP Protocol)──► [ Key-Holder Gateway ] ──► Sensitive Actions
  (Untrusted / Injected)                       │                     - Production Deploy
                                               │                     - Secret Decrypt
                                       [ Guardian Quorum ]            - External Send
                                   (N-of-M via TideCloak)
```

The Key-Holder Gateway acts as a reference monitor intercepting any sensitive action requested by an AI coding agent. The agent is strictly unprivileged: it never receives the plaintext credentials or deploy keys. All executions require an independent quorum of guardian signatures.

---

## 2. Protected Assets

| Asset | Sensitivity | Location | Protection Mechanism |
|-------|-------------|----------|----------------------|
| **Production Deploy Keys** | Critical | Host / Protected Env | Intercepted behind `request_deploy`; executed only after 2-of-3 quorum |
| **API Keys & Vault Secrets** | Critical | Secret Vault / Gateway | Intercepted behind `request_use_secret`; decrypted only post-quorum |
| **Outbound Data Channels** | High | Gateway Network Layer | Intercepted behind `request_send_external`; flagged by domain heuristics |
| **Guardian Identities** | High | TideCloak / Threshold | PRISM threshold authentication; no static password hashes |
| **Action Requests Store** | Medium | Gateway SQLite | Parameter hash binding (`sha256`); approvals bound to hash |
| **Audit Trail** | Medium | Gateway Append-Only Log | Cryptographically stamped chronological event trail |

---

## 3. What We Defend Against (Defend Scope)

### A. Indirect Prompt Injection → Secret Exfiltration
- **Attack Vector**: An attacker places hidden prompt injection instructions inside a GitHub issue, pull request diff, or documentation file (e.g., `mock-env/fixtures/malicious-issue.md`, `mock-env/fixtures/malicious-doc.md`). When an AI agent processes the file, the instruction tricks the agent into reading secrets and invoking `request_send_external`.
- **Mitigation**:
  1. The agent holds no ambient secrets: it cannot read env vars or files directly without triggering MCP tools.
  2. The gateway intercepts `request_send_external`, creates a pending Action Request, and flags deterministic risk signals (`external-domain`, `unknown-destination`).
  3. The request appears on the Guardian UI with large, prominent alerts.
  4. Guardians review the payload reference and untrusted destination, and reject the request.
  5. The external mock server (`fake-external`) receives **0 bytes**.

### B. Single Compromised Account (Rogue Guardian or Compromised Agent Session)
- **Attack Vector**: An attacker compromises a single developer or guardian credential and attempts to force an unauthorized deployment or extract credentials.
- **Mitigation**:
  1. **Strict 2-of-3 Quorum**: A single guardian cannot execute any sensitive action alone.
  2. **Proposer Cannot Approve Own Request (Four-Eyes Principle)**: The gateway explicitly rejects self-approval with `SELF_APPROVAL (409 Conflict)`.
  3. **TideCloak Identity Guarantees**: Guardian identities are backed by TideCloak threshold authentication; no single database breach leaks guardian master credentials.

### C. In-Flight Parameter Tampering (Parameter-Swap Attack)
- **Attack Vector**: A malicious actor or compromised intermediate proxy attempts to alter parameters after an initial approval is gathered (e.g., swapping a benign commit hash for a malicious payload).
- **Mitigation**:
  1. The gateway computes a canonical JSON SHA-256 hash (`parametersHash`).
  2. Each guardian signature cryptographically binds to this specific hash.
  3. Before execution, the gateway re-hashes the parameters and verifies equality against all recorded approval signatures.
  4. Any mismatch immediately aborts execution with `HASH_MISMATCH (422)`.

---

## 4. What We Explicitly Do NOT Defend Against (Out of Scope)

| Threat Scenario | Why Out of Hackathon Scope | Honest Engineering Statement |
|-----------------|----------------------------|------------------------------|
| **Majority Collusion / Rubber-Stamping** | Technical controls cannot prevent 2 out of 3 legitimate guardians blindly clicking approve. | *"Quorum security is strictly bounded by the human diligence of the minimum threshold (N guardians)."* |
| **Pre-existing Local Secrets on Developer Machine** | If secrets already reside in plain text within `.bashrc`, `.env`, or local files accessible to the agent process. | *"Gateway protection assumes secrets are segregated behind the gateway interface."* |
| **Bugs / Vulnerabilities in Approved Code** | The gateway enforces authority, not code correctness or AST safety analysis. | *"Approving a deploy authorizes the action, but does not certify the absence of logic bugs."* |
| **Compromised Host OS Running Gateway** | If an attacker has root access on the machine hosting the gateway process itself. | *"Host compromise requires containerization, remote HSMs, and live Tide Fabric participation."* |
| **Network Man-in-the-Middle (without TLS)** | The hackathon prototype runs locally over HTTP (`localhost`). | *"Production deployments require mandatory mutual TLS (mTLS) and TideCloak OIDC tokens."* |

---

## 5. Compromise Matrix: Ordinary Agent Setup vs. Key-Holder Gateway

This matrix compares an ordinary AI coding agent environment (e.g. direct CLI/API keys in environment variables or unrestricted MCP execution) against the **Key-Holder Gateway + TideCloak**.

| Attacker Controls | Capability | Ordinary Agent Architecture | Key-Holder Gateway + TideCloak | Enforcement Layer & Status |
| :--- | :--- | :--- | :--- | :--- |
| **Agent Context Only**<br>*(Prompt Injection)* | Deploy Malicious Code | 🔴 **Allowed** (Instant deploy) | 🟢 **Blocked** (Needs 2-of-3 quorum) | Enforced by Gateway Quorum Engine |
| | Exfiltrate Secrets | 🔴 **Allowed** (Agent reads env) | 🟢 **Blocked** (Agent never gets key) | Enforced by Vault Mediation |
| | Outbound Network Send | 🔴 **Allowed** (Direct curl/fetch) | 🟢 **Blocked** (Flagged & rejected in UI) | Enforced by Risk Signals & UI |
| | Bypass Audit Trail | 🔴 **Possible** (No audit) | 🟢 **Blocked** (Immutable audit log) | Enforced by Gateway Audit Store |
| **1 Guardian Account**<br>*(Stolen Credential)* | Deploy Malicious Code | 🔴 **Allowed** (Single-user CI/CD) | 🟢 **Blocked** (1/2 approvals, quorum fails) | Enforced by Gateway Quorum Engine |
| | Self-Approve Malicious PR | 🔴 **Allowed** (If permissions allow)| 🟢 **Blocked** (`SELF_APPROVAL` 409 error) | Enforced by Gateway Business Rules |
| | Exfiltrate Database Secret | 🔴 **Allowed** (Single token leak)| 🟢 **Blocked** (Requires 2nd signature) | Enforced by Multi-Party Threshold |
| | Forge Approval on Tampered Hash | 🔴 **Allowed** (No hash check) | 🟢 **Blocked** (`HASH_MISMATCH` 422 error) | Enforced by Parameter Binding |
| **Gateway DB Leaked**<br>*(Read Access to DB)* | Read Production Secrets | 🔴 **Plaintext exposed** | 🟡 **TBD** (Ciphertext only pending TC-04) | **Aspirational / TBD**: Depends on P1 TideCloak tag-based encryption verification. Mock currently uses labeled fake secrets. |
| | Fabricate Valid Approvals | 🔴 **Easy** (Update DB table) | 🟢 **Blocked** (Signatures bound to Tide JWTs) | Enforced by TideAdapter JWT verification |
| **2 Guardian Accounts**<br>*(Collusion / Breach)* | Force Malicious Deploy | 🔴 **Allowed** | 🔴 **Allowed** (Quorum satisfied) | **Accepted Limitation**: 2-of-3 compromise meets quorum by design. |
| **Full Host Compromise** | Tamper with Process Memory | 🔴 **Allowed** | 🔴 **Allowed** (Host root compromise) | **Accepted Limitation**: Out of scope for demo prototype. |

---

## 6. Deterministic Risk Signal Specification

Risk signals are computed deterministically on request ingress. They provide high-contrast advisory flags in the Guardian UI without introducing fragile non-deterministic heuristics:

```typescript
// packages/shared/src/types.ts
export type RiskSignal =
  | 'external-domain'       // Target URL hostname is outside trusted corporate domains
  | 'unknown-destination'   // Target URL has never previously succeeded in the audit log
  | 'sensitive-tag'         // Secret name matches high-privilege credentials pattern (PROD, KEY, TOKEN)
  | 'unusual-volume';       // Agent request burst exceeds anomalous threshold
```

---

## 7. Audit Event Specification

Every lifecycle state transition is committed to the append-only audit trail:
- `created`: Recorded on MCP ingress with canonical parameter hash.
- `approved`: Recorded with guardian ID, parameter hash, and timestamp.
- `rejected`: Recorded with guardian ID and rejection reason.
- `quorum-reached`: Recorded when valid approvals equal `requiredApprovals`.
- `executed`: Recorded when the gateway triggers the executor post-quorum.
- `expired`: Recorded when an action exceeds `ACTION_TTL_SECONDS` without quorum.
- `hash-mismatch`: Recorded if parameters are modified during transit.
