# TideCloak Verification Checklist

> **Owner**: P1
> Verify each item using the Tide MCP (`tide_playbook`, `tide_canon`, `tide_scenario`) and official docs.
> Record findings here AND in DECISIONS.md.
>
> Status values: `unknown` | `verified` | `unsupported` | `partial`

---

## TC-01 — TideCloak Docker Image

**Status**: `unknown`

**Question**: What is the correct Docker image name and tag for the TideCloak development image?

**Why it matters**: `docker-compose.yml` uses `tideorg/tidecloak:latest` as a placeholder. If wrong, `make docker-up` fails.

**How to verify**:
```bash
# Try Tide MCP:
tide_playbook deploy-tidecloak-docker
# Or check Docker Hub: https://hub.docker.com/u/tideorg
```

**Notes**: *(fill in)*

---

## TC-02 — Custom N-of-M Quorum for Arbitrary Actions

**Status**: `unknown`

**Question**: Can TideCloak enforce cryptographic N-of-M quorum approval for **application-level actions** (not just admin IGA changes)?

**Context**: TideCloak IGA uses `max(1, floor(TotalAdmins * 0.7))` quorum for admin change sets. This is a fixed formula for admin governance, not configurable per-action. The question is whether Forseti contracts or a custom integration could gate arbitrary actions (deploy, secret use, external send) behind a configurable N-of-M threshold.

**Why it matters**: If yes, the gateway's quorum count is backed by cryptographic enforcement. If no, the gateway's quorum is application-level only (single-server trust).

**How to verify**:
```bash
tide_canon feature-mapping        # IGA Quorum Approval section
tide_scenario iga-admin-governance
tide_canon custom-contracts       # Forseti contracts for arbitrary policy
```

**Notes**: *(fill in)*

**Fallback if unsupported**: Gateway application-level quorum counter with JWT-verified guardian identities.

---

## TC-03 — Content-Bound / Parameter-Bound Approvals

**Status**: `unknown`

**Question**: Can TideCloak bind an approval to specific content (e.g., a hash of action parameters), so that changing parameters after approval invalidates it cryptographically?

**Why it matters**: Without this, parameter-bound approval (Scenario 5) is enforced only in the gateway layer, not cryptographically by TideCloak.

**How to verify**:
```bash
tide_canon custom-contracts       # Forseti — can a contract verify a hash?
tide_canon verifiable-claims
```

**Notes**: *(fill in)*

**Fallback if unsupported**: Gateway stores `parametersHash` with each approval and verifies before execution (already implemented as `packages/gateway/src/crypto/`).

---

## TC-04 — Tag-Based Encryption for Server-Side Secrets

**Status**: `unknown`

**Question**: Can the **gateway server** (not the browser client) encrypt secrets with TideCloak tag-based encryption, such that the database shows only ciphertext and decryption requires live Fabric threshold participation?

**Context**: TideCloak's `doEncrypt`/`doDecrypt` SDK calls are designed for **browser clients** (self-encryption). Server-side decryption of the same ciphertext would require policy-governed encryption (Forseti contract) or a different flow. The exact mechanism for a Node.js server is unclear.

**Why it matters**: The demo claim "DB shows only ciphertext" depends on this working.

**How to verify**:
```bash
tide_canon feature-mapping        # E2EE section, "Choosing the Encryption Model"
tide_playbook setup-forseti-e2ee
tide_playbook configure-e2ee-roles-and-policies
```

**Notes**: *(fill in)*

**Fallback if unsupported**: AES-256-GCM with key in env var (still encrypts DB, but not Tide-cryptographic). Clearly label as fallback in README.

---

## TC-05 — JS/TypeScript SDK for Server-Side JWT Verification

**Status**: `partial`

**Question**: Is the `jose` library + embedded JWKS from adapter JSON the correct approach for server-side JWT verification in Node.js (not browser)?

**Context**: Tide MCP `canon/feature-mapping` shows this pattern (verified from `keylessh tideJWT.ts`):
```typescript
import { createLocalJWKSet, jwtVerify } from 'jose';
const JWKS = createLocalJWKSet(config.jwk);
const { payload } = await jwtVerify(token, JWKS, { issuer: ... });
```
The `jwk` field is only present in the adapter JSON when IGA is enabled.

**Status**: Pattern appears verified from feature-mapping; needs runtime confirmation that it works with the dev image.

**How to verify**:
1. Start TideCloak dev image.
2. Enable IGA.
3. Export adapter JSON and confirm `jwk` field is present.
4. Generate a token and verify with `jose`.

**Notes**: *(fill in)*

---

## TC-06 — Dev License Activation Steps

**Status**: `unknown`

**Question**: What are the exact steps to activate the TideCloak development/free-tier license?

**Context**: The `setUpTideRealm` endpoint provisions a free-tier license (Content-Type must be `x-www-form-urlencoded`, not JSON; requires `email` param). Whether additional steps (email confirmation, license file, etc.) are needed is unclear.

**Why it matters**: Without a valid license, IGA and E2EE features do not activate.

**How to verify**:
```bash
tide_playbook start-tidecloak-dev
tide_playbook bootstrap-realm-from-template
tide_canon tidecloak-bootstrap
```

**Notes**: *(fill in)*

---

## TC-07 — Guardian Role Setup (Non-Admin Tide Account Linking)

**Status**: `unknown`

**Question**: Do non-admin guardian users need to complete the Tide account linking flow (`link-tide-account-action`)? Or is that only for admin users?

**Context**: Tide MCP `canon/feature-mapping` notes this as `PARTIALLY_RESOLVED (GAP-030)` for non-admin users.

**Why it matters**: If guardians need account linking, the bootstrap script must include invite generation for all 3 guardians, not just the admin.

**How to verify**:
```bash
tide_canon feature-mapping   # Account Linking section, GAP-030
```

**Notes**: *(fill in)*

---

## TC-08 — DPoP Requirements for Guardian UI

**Status**: `unknown`

**Question**: Does the guardian UI need DPoP-bound tokens when calling the gateway API? If DPoP is enabled on the TideCloak client, is standard `Bearer` token insufficient?

**Context**: Tide MCP confirms DPoP is required for Tide's full security guarantees and is the default for new projects. Whether the gateway needs to verify DPoP proofs (vs just JWT signatures) affects the implementation.

**Why it matters**: If DPoP is required, the gateway must implement `jti` replay cache and proof verification, not just JWT signature verification.

**How to verify**:
```bash
tide_canon feature-mapping   # DPoP Token Binding section
```

**Notes**: *(fill in)*

---

## Summary Table

| ID | Question | Status | Owner | Fallback |
|----|----------|--------|-------|---------|
| TC-01 | Docker image name/tag | `unknown` | P1 | Use official docs |
| TC-02 | App-level N-of-M quorum | `unknown` | P1 | Gateway-level counter |
| TC-03 | Content-bound approvals | `unknown` | P1 | Gateway hash verification |
| TC-04 | Server-side tag encryption | `unknown` | P1 | AES-256-GCM in gateway |
| TC-05 | JS JWT verification pattern | `partial` | P1 | Already stubbed with `jose` |
| TC-06 | Dev license activation | `unknown` | P1 | Follow docs step by step |
| TC-07 | Non-admin account linking | `unknown` | P1 | Add to guardian bootstrap |
| TC-08 | DPoP requirement for guardian | `unknown` | P1 | Skip DPoP if not required |
