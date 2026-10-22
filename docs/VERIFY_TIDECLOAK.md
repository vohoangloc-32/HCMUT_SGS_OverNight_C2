# TideCloak Verification Checklist

> **Owner**: P1
> Verified using the official Tide MCP (`tide_canon`, `tide_playbook`), canon documentation, and gap analysis.
> Record findings here AND in `DECISIONS.md`.
>
> Status values: `unknown` | `verified` | `unsupported` | `partial`

---

## TC-01 — TideCloak Docker Image

**Status**: `verified`

**Question**: What is the correct Docker image name and tag for the TideCloak development image?

**Verified Finding**:
- Correct image: `tideorg/tidecloak-dev:latest` (Source: `tide_playbook deploy-tidecloak-docker`, confirmed from `tidecloak-override` source tree).
- **Embedded H2 database**: Non-strict hostname, pre-imports `myrealm` on start.
- **Production network parameters**: Wired to `https://ork1.tideprotocol.com`, T=14, N=20 with production payer key baked in.
- **Entrypoint**: Do NOT append `start-dev` or any vanilla Keycloak command; image has a pre-configured entrypoint.
- Updated in `docker-compose.yml`.

---

## TC-02 — Custom N-of-M Quorum for Arbitrary Actions

**Status**: `unsupported` (natively for arbitrary application actions without manual Tide team contract deployment)

**Question**: Can TideCloak enforce cryptographic N-of-M quorum approval for **arbitrary actions** (deploy, secret use, external send)?

**Verified Finding**:
- **TideCloak IGA (Identity Governance & Administration)**: Native change requests (`/admin/realms/{realm}/iga/change-requests/...`) strictly gate **18 specific administrative identity operations** (e.g. role assignment, user creation, realm attribute toggle). Quorum formula is fixed: `max(1, floor(TotalAdmins * 0.7))`. It does not support arbitrary application action requests.
- **Forseti Smart Contracts**: Custom signing policies on ORK nodes are written in C# and can enforce arbitrary business rules. **HOWEVER**, canon `custom-contracts` explicitly confirms: *"Deploying a custom Forseti contract is not self-service... done by the Tide team (info@tide.org). Uploading it to a realm or the network is experimental, test-network only"*.
- **Autonomous Agents constraint (GAP-064 / GAP-063)**: Autonomous processes cannot authenticate to Tide or produce signatures by themselves. Only human-owned browser sessions holding client roles can exercise authority.

**Architecture / Fallback**:
- **Gateway Application-Level Quorum Engine**: The Gateway collects and verifies independent TideCloak-issued JWTs from N distinct guardians (holding the `guardian` role).
- Each guardian authenticates via TideCloak (PRISM threshold password verification); Gateway cryptographically verifies each token against the embedded JWKS from the realm adapter.
- The Gateway tallies approvals (2-of-3 threshold) and verifies non-self-approval (`guardianId !== proposer.userId`).

---

## TC-03 — Content-Bound / Parameter-Bound Approvals

**Status**: `unsupported` (natively without custom Forseti contract)

**Question**: Can TideCloak bind an approval to specific content (e.g. hash of action parameters) so changing parameters invalidates it cryptographically?

**Verified Finding**:
- Built-in contracts (`GenericRealmAccessThresholdRole:1`, `GenericResourceAccessThresholdRole:1`) validate approver role counts only; they do not inspect payload bytes.
- Only a custom Forseti C# contract can parse payload bytes and check parameter hashes, but cannot be self-deployed.

**Architecture / Fallback**:
- **Gateway Canonical Parameter Hashing**: Implemented in `packages/gateway/src/crypto/canonicalParamsHash.ts`.
- On action request creation, the Gateway computes a deterministic SHA-256 hash across canonicalized keys (`parametersHash`).
- Each guardian approval cryptographically records and endorses `parametersHash`.
- Before executing any executor (`deploy`, `use_secret`, `send_external`), the Gateway re-computes and asserts `parametersHash` matches. If tampered with, execution is aborted with `HASH_MISMATCH`.

---

## TC-04 — Tag-Based Encryption for Server-Side Secrets

**Status**: `partial` (Client-side E2EE only; unsupported for headless server-side)

**Question**: Can the **gateway server** (not the browser client) encrypt secrets with TideCloak tag-based encryption such that the DB shows ciphertext and decryption requires live Fabric threshold participation?

**Verified Finding**:
- **Self-Encryption (`doEncrypt`/`doDecrypt`)**: Designed exclusively for authenticated browser clients via Web Enclave (`_tide_{tag}.selfencrypt`/`.selfdecrypt`).
- **GAP-064**: Headless backend servers have no browser enclave and cannot hold dokens or produce enclave signatures independently.
- **Policy-governed VVK encryption**: Requires deploying a Forseti contract to the ORK network and storing signed policy bytes.

**Architecture / Fallback**:
- For the demo and gateway storage: The database stores encrypted secrets (AES-256-GCM fallback). Raw secrets are **never returned to the agent** or the MCP server (the gateway uses secrets on behalf of approved actions, returning only a status handle).
- For browser UI: Guardians can use standard TideCloak self-encryption for client-held credentials.

---

## TC-05 — JS/TypeScript SDK for Server-Side JWT Verification

**Status**: `verified`

**Question**: Is the `jose` library + embedded JWKS from adapter JSON the correct approach for server-side JWT verification in Node.js?

**Verified Finding**:
- **Pattern VERIFIED**: `canon/feature-mapping` and `keylessh (server/lib/auth/tideJWT.ts)` confirm using `jose` with `createLocalJWKSet(config.jwk)`.
- **Local offline verification**: The `jwk` field in the adapter JSON contains the VVK public key generated when IGA is enabled. Verification is performed offline locally without network requests to `{realm}/protocol/openid-connect/certs`.
- **Claims verified**: `iss` (issuer), `azp` (client ID), `exp`, `iat`, and `realm_access.roles` / `resource_access` for `guardian` role.
- **Recommendation**: Node.js + `jose` in `TideAdapter.ts`. Matches our TypeScript gateway perfectly without requiring .NET Asgard dependencies.

---

## TC-06 — Dev License Activation Steps

**Status**: `verified`

**Question**: What are the exact steps to activate the TideCloak development/free-tier license?

**Verified Finding**:
- **Endpoint**: `POST /admin/realms/{realm}/tideAdminResources/setUpTideRealm`.
- **Header**: `Content-Type: application/x-www-form-urlencoded` (JSON is rejected).
- **Parameters**: `email=<licensed-email>`, `TIDE_TERMS_ACCEPTED=yes`.
- **Legal requirement**: Must present `https://tide.org/legal` and obtain explicit user acceptance before activating.
- **Timing**: Generates gVRK and free-tier subscription within ~7 seconds on `tideorg/tidecloak-dev:latest`.

---

## TC-07 — Guardian Role Setup & Account Linking

**Status**: `verified`

**Question**: Do non-admin guardian users need account linking or specific roles?

**Verified Finding**:
- Regular login (PRISM password verification) works for any user created in the realm without required action linking.
- Account linking (`link-tide-account-action`) is specifically required for admin users who participate in IGA change-request enclave signing.
- For Guardians in our Gateway: Guardians are assigned the client/realm role `guardian`. When they log in via OIDC, their access token includes the `guardian` role in `realm_access.roles`.

---

## TC-08 — MCP Server Coexistence

**Status**: `verified`

**Question**: What does Tide MCP provide, and can agents connect to OUR MCP server alongside it?

**Verified Finding**:
- **Tide MCP scope**: Developer tooling for scaffolding Tide apps (`tide_canon`, `tide_playbook`, `tide_scenario`, `tide_doctor`). It does not provide runtime proxying or execution interception.
- **Coexistence**: Standard MCP clients (Claude Desktop, Cursor, Antigravity IDE) support multiple MCP servers concurrently in their configuration files.
- **Key-Holder MCP server**: Runs via stdio and exposes exactly 3 tools (`request_deploy`, `request_use_secret`, `request_send_external`). It coexists transparently alongside Tide MCP.

---

## Summary Table

| ID | Topic | Status | Genuine Tide Property | Gateway Fallback |
|---|---|:---:|---|---|
| **TC-01** | Docker Image | `verified` | `tideorg/tidecloak-dev:latest` (H2, T=14/N=20) | None needed |
| **TC-02** | N-of-M Quorum | `unsupported` | IGA fixed formula (`floor(Admins*0.7)`); custom contracts need Tide team | Gateway tallies independent guardian tokens (2-of-3) |
| **TC-03** | Content-Bound Hash | `unsupported` | Built-in contracts don't parse arbitrary payload bytes | Gateway canonical SHA-256 parameter hash verification |
| **TC-04** | Tag Encryption | `partial` | Client-side browser self-encryption verified | Gateway DB encryption (AES-256-GCM); agent never sees raw secret |
| **TC-05** | Server JWT Verify | `verified` | VVK threshold signature verified via local JWKS (`jose`) | None needed |
| **TC-06** | License Activation | `verified` | `setUpTideRealm` with `x-www-form-urlencoded` | None needed |
| **TC-07** | Guardian Roles | `verified` | Role-based JWT claims issued after PRISM auth | None needed |
| **TC-08** | MCP Coexistence | `verified` | Standard MCP multi-server stdio support | None needed |
