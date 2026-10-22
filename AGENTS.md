# AGENTS.md — Rules for AI Coding Agents Working in This Repo

> This file applies to **all** AI coding agents (Claude, Antigravity, Copilot, Cursor, etc.).
> Human contributors should read [docs/ROLES.md](docs/ROLES.md).

---

## 1. Read First

Before changing **any** file, read:
- [docs/CONCEPT.md](docs/CONCEPT.md) — what this system is and is not
- [docs/API.md](docs/API.md) — the single source-of-truth contract
- [docs/ROLES.md](docs/ROLES.md) — who owns what; do not touch another owner's area without coordination

## 2. Never Invent TideCloak / Tide APIs

- Do **not** write any TideCloak or Tide SDK call you have not verified in the official docs or via the Tide MCP.
- Every proposed TideCloak integration must be logged in [docs/VERIFY_TIDECLOAK.md](docs/VERIFY_TIDECLOAK.md) with status: `unknown` | `verified` | `unsupported`.
- Record your finding in [DECISIONS.md](DECISIONS.md) under the appropriate heading (verified / assumed / faked).
- If something is unsupported, propose a documented fallback — do **not** silently fake it.

## 3. TideCloak Calls in One Place Only

All calls to TideCloak (JWT verification, role checks, quorum approval, encryption/decryption) **must** go through `packages/gateway/src/tide/TideAdapter.ts`.

- Do **not** import TideCloak/OIDC libraries anywhere else.
- The interface is the contract; the stub is the starting point.
- The `InMemoryQuorumEngine` in `packages/gateway/src/quorum/` is for UI development only — it has **no cryptographic guarantees**.

## 4. API Contract Changes Require a Two-File Edit

Any change to the API (new endpoint, changed field, new error code) **must** update **both**:
1. `docs/API.md` — human-readable spec with JSON examples
2. `packages/shared/src/` — Zod schemas and TypeScript types

Both changes must be in the same commit/PR. Never let the spec and the code diverge.

## 5. Deny-by-Default Tool List

The MCP server exposes **exactly three tools**:
- `request_deploy`
- `request_use_secret`
- `request_send_external`

Do **not** add new tools or expand existing tool parameters without:
1. Updating `docs/API.md`
2. Updating `packages/shared/src/types.ts`
3. Getting explicit agreement from both P1 and P2

## 6. No Real Secrets — Ever

- Do **not** place real secrets, tokens, passwords, or private keys anywhere in the repo.
- Do **not** log secrets in any format (plain, hashed, base64, or otherwise).
- Fake/placeholder secrets in fixtures **must** carry the label `FAKE` in their name and content.
- The `.env.example` is the only place secrets are referenced; `.env` must stay git-ignored.

## 7. Scope Discipline

- Do **not** add features outside [docs/ROLES.md](docs/ROLES.md) without asking both P1 and P2.
- Keep changes minimal and focused; a working vertical slice beats breadth every time.
- Prefer touching fewer files per change.

## 8. Keep Quality Gates Green

Every change must leave these passing:
```bash
make lint && make typecheck && make test
```
Additionally, at least scenario scripts 1 and 2 must remain runnable from a clean state.

## 9. Be Honest in Docs

- Never claim a security property the system does not provide.
- Mark every mock/stub/fake in comments and in [DECISIONS.md](DECISIONS.md).
- Use the Real vs Mocked table in README.md to track what is genuine vs demo scaffolding.

## 10. Commit Discipline

- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
- Small, focused commits — one logical change per commit.
- Touch only files within your owner's area (P1 or P2) unless explicitly coordinated.
- Do not reformat files you did not logically change.
