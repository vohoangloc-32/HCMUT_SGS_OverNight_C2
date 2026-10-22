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

## TideCloak Integration

### [UNRESOLVED] TC-01 — TideCloak Docker image name and tag
- **Evidence**: Not yet verified
- **Decision**: Using `tideorg/tidecloak:latest` as placeholder in docker-compose.yml
- **Impact**: `make docker-up` will fail until the correct image name is confirmed
- **Fallback**: P1 to run `tide_playbook` → `deploy-tidecloak-docker` and update docker-compose.yml
- **Owner**: P1

### [UNRESOLVED] TC-02 — Custom N-of-M quorum for arbitrary actions
- **Evidence**: Not yet verified. TideCloak IGA quorum formula is `max(1, floor(TotalAdmins * 0.7))` for admin changes (verified from Tide MCP `canon/feature-mapping`). Whether arbitrary application-level actions can use the same mechanism is unknown.
- **Decision**: Gateway implements its own quorum count as fallback; TideCloak quorum treated as aspirational.
- **Impact**: If unsupported natively, quorum is enforced in the gateway only — still single-server trust, not cryptographic multi-party.
- **Fallback**: Gateway-side approval counter with JWT-verified guardian identities.
- **Owner**: P1

### [UNRESOLVED] TC-03 — Content-bound / parameter-bound approvals
- **Evidence**: Not yet verified. TideCloak IGA approvals are for admin change-set objects, not arbitrary parameters.
- **Decision**: Gateway implements canonical parameter hashing (`packages/gateway/src/crypto/`); each approval record stores the hash; gateway verifies hash before execution.
- **Impact**: If TideCloak can bind approvals to a content hash natively, this fallback can be removed.
- **Fallback**: In-gateway hash verification (already implemented as fallback).
- **Owner**: P1

### [UNRESOLVED] TC-04 — Tag-based encryption for server-side secrets
- **Evidence**: TideCloak E2EE (self-encryption) requires live Fabric participation and client-side decrypt. Server-side encrypted secrets that the gateway decrypts on behalf of the agent is a different flow (policy-governed encryption / Forseti contract). Not yet verified.
- **Decision**: Stub TideAdapter.encryptSecret / decryptSecret; gateway stores plaintext secrets in mock for demo.
- **Impact**: Without this, the "DB shows only ciphertext" claim cannot be demonstrated.
- **Fallback**: AES-256-GCM with a key stored in env var (still better than plaintext, but not Tide-specific).
- **Owner**: P1

### [UNRESOLVED] TC-05 — Which SDK to use (JS vs .NET Asgard)
- **Evidence**: Tide MCP `canon/feature-mapping` shows JS SDK surface (`doLogin`, `useTideCloak`, `doEncrypt`). .NET Asgard SDK exists but is for different stack.
- **Decision**: Using JS/TypeScript SDK for gateway + React UI.
- **Impact**: If Tide recommends .NET for server-side JWT verification, a wrapper or alternative will be needed.
- **Fallback**: `jose` library for JWT verification using embedded JWKS from adapter JSON (pattern verified in `canon/feature-mapping`).
- **Owner**: P1

### [UNRESOLVED] TC-06 — Dev license activation steps
- **Evidence**: `setUpTideRealm` endpoint provisions a free-tier license (verified from Tide MCP). Exact activation steps (email required, license JSON returned) not yet walked through.
- **Decision**: Document in docs/VERIFY_TIDECLOAK.md as checklist item.
- **Impact**: Without license activation, IGA and E2EE features do not work.
- **Owner**: P1

---

## Architecture

### [ASSUMED] A-01 — SQLite for Action Request store
- **Evidence**: Hackathon timebox; simplicity. Cross-platform compatibility without native C++ compilation (node-gyp) errors on Node 24/Windows.
- **Decision**: Zero-dependency pure TypeScript SQLite-compatible store in `packages/gateway/src/db.ts` persisting to JSON/file.
- **Impact**: Clean clone works instantly on any OS/Node version without requiring Visual Studio C++ build tools. Can easily swap to real SQLite/better-sqlite3/Postgres later if desired.
- **Fallback**: N/A (explicitly accepted design for hackathon skeleton).

### [ASSUMED] A-02 — Fastify for gateway HTTP server
- **Evidence**: Fastify is fast, TypeScript-native, well-suited for JSON APIs.
- **Decision**: Using Fastify. If P1 prefers Express, switch is trivial since routes are stubs.
- **Impact**: Minor; only affects `packages/gateway/src/server.ts`.

### [ASSUMED] A-03 — Proposer cannot approve their own request
- **Evidence**: Principle of least privilege; four-eyes principle consistent with TideCloak IGA (AP-G03 in Tide MCP).
- **Decision**: Gateway rejects approval if `guardianId === request.proposer.userId`.
- **Impact**: Enforced in gateway quorum engine; must be enforced in TideAdapter too if/when Tide quorum is used.

### [FAKED] F-01 — InMemoryQuorumEngine
- **Evidence**: TideCloak quorum for application-level actions not yet verified.
- **Decision**: `InMemoryQuorumEngine` counts approvals in memory; no cryptographic guarantees.
- **Impact**: Demo shows the UX flow; security claim "cryptographically enforced by TideCloak" is pending P1 verification.
- **Label**: Clearly marked as `FAKE` / `InMemory` in all source files.

### [FAKED] F-02 — Mock executors
- **Evidence**: There is no real production deployment target or secret vault.
- **Decision**: Executors call fake-production and fake-external servers; read from fake-secrets.txt.
- **Impact**: Demonstrates the flow; no real side effects.

---

## Open Questions

- [ ] TC-01: Correct TideCloak Docker image name?
- [ ] TC-02: Can TideCloak enforce application-level N-of-M quorum cryptographically?
- [ ] TC-03: Can approvals be bound to a content hash natively in TideCloak?
- [ ] TC-04: Can the gateway decrypt a TideCloak-encrypted secret server-side (policy-governed encryption)?
- [ ] TC-05: Is the JS SDK sufficient for server-side JWT verification in Node.js?
- [ ] TC-06: Exact dev license activation flow?
