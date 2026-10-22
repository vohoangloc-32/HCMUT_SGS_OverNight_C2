# DECISIONS.md

> Log of every architectural and integration decision made during the hackathon.
> Entries are tagged: **VERIFIED** | **ASSUMED** | **FAKED** | **UNRESOLVED**

---

## Format

```
### [DATE] [TAG] Short title
- **Evidence**: where the decision comes from (doc URL, MCP output, code)
- **Decision**: what we chose and why
- **Impact**: what it affects
- **Fallback**: what we'll do if the assumption is wrong (for ASSUMED entries)
```

---

## TideCloak Integration (P1 Verification)

### [VERIFIED] TC-01 — TideCloak Docker image name and tag
- **Evidence**: `tide_playbook deploy-tidecloak-docker`, verified from `tidecloak-override` source tree.
- **Decision**: Use `tideorg/tidecloak-dev:latest`. Embedded H2 DB, T=14/N=20 production network defaults, pre-imports `myrealm`.
- **Impact**: Updated in `docker-compose.yml`. Preconfigured entrypoint (do NOT append `start-dev`).
- **Owner**: P1

### [VERIFIED / FALLBACK] TC-02 — Custom N-of-M quorum for arbitrary actions
- **Evidence**: `tide_canon feature-mapping` (IGA change requests scope) & `tide_canon custom-contracts`.
  1. TideCloak IGA change-requests gate 18 administrative actions with a fixed formula `max(1, floor(TotalAdmins * 0.7))`. It does not support arbitrary application actions.
  2. Custom Forseti contracts can enforce signing policies, but deployment is non-self-service (requires Tide team manual deployment).
  3. GAP-064/GAP-063: Autonomous agents cannot authenticate or sign; only human browser sessions can hold credentials.
- **Decision**: Gateway-level quorum engine (`QuorumEngine.ts`) enforcing 2-of-3 quorum across independent TideCloak Guardian tokens (`guardian` role).
- **Impact**: Authentication & guardian role claims are genuine TideCloak (PRISM threshold password verification + VVK threshold signatures). Quorum counting is enforced in the Gateway process.
- **Owner**: P1

### [VERIFIED / FALLBACK] TC-03 — Content-bound / parameter-bound approvals
- **Evidence**: `tide_canon custom-contracts`. Built-in contracts do not inspect application payload bytes.
- **Decision**: Gateway canonical parameter hashing (`packages/gateway/src/crypto/canonicalParamsHash.ts`). Every approval binds to `parametersHash`; gateway halts execution if parameters or hash differ (`HASH_MISMATCH`).
- **Impact**: Tamper-proofing against parameter swap (Scenario 5) is cryptographically deterministic in the gateway layer.
- **Owner**: P1

### [VERIFIED / FALLBACK] TC-04 — Tag-based encryption for server-side secrets
- **Evidence**: `tide_canon feature-mapping` (E2EE section) & GAP-064. Self-encryption (`doEncrypt`/`doDecrypt`) requires browser Web Enclave; headless server processes cannot hold dokens. Policy-governed shared encryption requires a custom deployed Forseti contract.
- **Decision**: Gateway stores secrets encrypted in SQLite/DB (AES-256-GCM fallback). Raw secret values are never returned to the agent or MCP server (least-privilege execution).
- **Impact**: Protects raw secrets from agent exfiltration (Scenario 3 & 4); clearly marked as gateway-encrypted fallback.
- **Owner**: P1

### [VERIFIED] TC-05 — Which SDK to use for JWT Verification
- **Evidence**: `tide_canon feature-mapping` & `keylessh (server/lib/auth/tideJWT.ts)`.
- **Decision**: Node.js + `jose` library in `packages/gateway/src/tide/TideAdapter.ts`. Local offline verification using embedded JWKS from adapter JSON (`config.jwk`).
- **Impact**: Full cryptographic verification of VVK threshold signatures without external runtime dependencies or .NET overhead.
- **Owner**: P1

### [VERIFIED] TC-06 — Dev license activation steps
- **Evidence**: `tide_playbook deploy-tidecloak-docker` and `tide_canon tidecloak-bootstrap`.
- **Decision**: `POST /admin/realms/{realm}/tideAdminResources/setUpTideRealm` with `Content-Type: application/x-www-form-urlencoded` (`email`, `TIDE_TERMS_ACCEPTED=yes`).
- **Impact**: Scripted in realm setup sequence; requires user acceptance of legal terms.
- **Owner**: P1

---

## Architecture & Policy

### [ASSUMED] A-01 — SQLite for Action Request store
- **Evidence**: Hackathon timebox; simplicity. Cross-platform compatibility without native C++ compilation (node-gyp) errors on Node 24/Windows.
- **Decision**: Zero-dependency pure TypeScript SQLite-compatible store in `packages/gateway/src/db.ts` persisting to JSON/file.
- **Impact**: Clean clone works instantly on any OS/Node version without requiring Visual Studio C++ build tools. Can easily swap to real SQLite/better-sqlite3/Postgres later if desired.
- **Fallback**: N/A (explicitly accepted design for hackathon skeleton).

### [ASSUMED] A-02 — Fastify for gateway HTTP server
- **Evidence**: Fastify is fast, TypeScript-native, well-suited for JSON APIs.
- **Decision**: Using Fastify for `packages/gateway/src/server.ts`.
- **Impact**: Minor; high throughput and native JSON schema validation.

### [VERIFIED] A-03 — Proposer cannot approve their own request
- **Evidence**: Principle of least privilege; four-eyes principle consistent with TideCloak IGA (AP-G03 in Tide MCP).
- **Decision**: Gateway rejects approval with `SELF_APPROVAL` if `guardianId === request.proposer.userId`.
- **Impact**: Enforced in gateway quorum engine.

### [FAKED] F-01 — InMemoryQuorumEngine
- **Evidence**: Dev stub for UI development before live TideCloak setup.
- **Decision**: `InMemoryQuorumEngine` counts approvals in memory; no cryptographic guarantees.
- **Impact**: Kept behind a configuration toggle (`QUORUM_ENGINE=inmemory|tide`) for offline testing and CI.
- **Label**: Clearly marked as `FAKE` / `InMemory` in all source files.

### [FAKED] F-02 — Mock executors
- **Evidence**: There is no real production deployment target or secret vault.
- **Decision**: Executors call fake-production and fake-external servers; read from fake-secrets.txt.
- **Impact**: Demonstrates the flow; no real side effects.

### [FAKED / LABELED] F-03 — Guardian UI Mock Login
- **Evidence**: TideCloak dev container is offline on the demo host (Docker engine unavailable). Real OIDC flow requires live Keycloak/TideCloak container with Web Enclave.
- **Decision**: Maintain simulated guardian sessions in `packages/guardian-ui/src/auth/` clearly labeled with visible `MOCK LOGIN` pills across the UI (`Login.tsx`, `Header.tsx`) and in README. Never present fake login as real Tide authentication.
- **Impact**: Enables smooth multi-guardian demo interactions (switching between Alice, Bob, Carol) without hard runtime Docker dependencies.
- **Owner**: P2

---

## Open Questions Status

- [x] TC-01: Correct TideCloak Docker image name? -> `tideorg/tidecloak-dev:latest`
- [x] TC-02: Can TideCloak enforce application-level N-of-M quorum cryptographically? -> Unsupported natively without custom Forseti contract; Gateway-level quorum engine backed by Tide guardian tokens.
- [x] TC-03: Can approvals be bound to a content hash natively in TideCloak? -> Unsupported natively; Gateway canonical parameter hash (`canonicalParamsHash`) fallback.
- [x] TC-04: Can the gateway decrypt a TideCloak-encrypted secret server-side? -> Unsupported for headless server; Gateway AES-256-GCM fallback with opaque handles.
- [x] TC-05: Is the JS SDK sufficient for server-side JWT verification in Node.js? -> Yes, `jose` with local JWKS.
- [x] TC-06: Exact dev license activation flow? -> `setUpTideRealm` with `x-www-form-urlencoded`.
