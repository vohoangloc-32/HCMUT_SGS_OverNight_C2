# Roles — P1 and P2 Ownership

> This file defines who owns what. Agents must not touch another owner's area
> without explicit coordination. See AGENTS.md rule 10.

---

## P1 — Core / Backend

| Area | Files |
|------|-------|
| TideCloak setup & verification | `docs/VERIFY_TIDECLOAK.md`, `DECISIONS.md` (TC-* entries) |
| Gateway backend | `packages/gateway/` |
| MCP server | `packages/mcp-server/` |
| Docker TideCloak config | `docker-compose.yml` (TideCloak service section) |

**Primary questions P1 must answer first**:
1. Correct TideCloak Docker image name/tag? (DECISIONS.md TC-01)
2. Can TideCloak enforce application-level N-of-M quorum? (TC-02)
3. Can tag-based encryption protect server-side secrets? (TC-04)
4. Which SDK for server-side JWT verification in Node.js? (TC-05)
5. Dev license activation steps? (TC-06)

---

## P2 — Surface / Demo

| Area | Files |
|------|-------|
| Guardian UI | `packages/guardian-ui/` |
| Mock environment | `mock-env/` |
| Demo scripts | `scripts/` |
| README | `README.md` |
| Demo script doc | `docs/DEMO_SCRIPT.md` |
| Threat model (draft) | `docs/THREAT_MODEL.md` |
| Video recording | (external artefact) |

**P2 can start immediately** against the mock API (gateway in dev mode with seeded data).
No TideCloak setup needed for UI development.

---

## Shared (Change Only by Agreement)

| Area | Files |
|------|-------|
| API contract | `docs/API.md` |
| Shared types | `packages/shared/src/` |
| Root config | `package.json`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc` |
| CI | `.github/workflows/ci.yml` |

Any change to shared files requires both P1 and P2 to review.

---

## Sync Points

| Sync | Trigger | What to verify |
|------|---------|---------------|
| **Contract freeze** | End of first session | `docs/API.md` and `packages/shared/` locked; both can build independently |
| **Core flow demo** | After gateway + MCP server + quorum engine working | Run scenarios 1 and 2 together from a clean clone |
| **Final polish** | T-4 hours before submission | Run all 4 scenarios; record video; review README and threat model |

---

## Escalation

If P1 finds that a TideCloak capability is unsupported:
1. Record in `docs/VERIFY_TIDECLOAK.md` with status `unsupported`.
2. Record fallback in `DECISIONS.md`.
3. Update `README.md` Real vs Mocked table.
4. Ping P2 before changing any shared types or API.

If P2 needs a new field in the API or a new endpoint:
1. Discuss with P1.
2. Update `docs/API.md` and `packages/shared/` together.
3. Gateway stub is P1's to add; UI integration is P2's.
