# Key-Holder Gateway

[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)
[![CI](https://github.com/your-org/key-holder-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/key-holder-gateway/actions/workflows/ci.yml)

> **Hackathon**: Tide × RMIT UNLOCKED — Theme: *Emergent Authority*
>
> A guardian-approval gateway between any AI coding agent and sensitive actions.
> No single party holds a master key — authority only forms when enough independent guardians approve.

---

## Problem

AI coding agents (Claude, Copilot, Antigravity, etc.) can read files, edit code, run tests, and open PRs. But they can also — accidentally or through prompt injection — try to **deploy bad code**, **exfiltrate secrets**, or **send data to untrusted endpoints**.

Today there is no standard layer that prevents an agent from taking sensitive actions unilaterally.

## Concept

```
Agent A ─┐
         ├─► KEY-HOLDER GATEWAY (MCP + TideCloak) ─► mock production
Agent B ─┘            │                             ─► mock secrets vault
                      └─► Guardian UI               ─► mock external endpoint
                          (approve / reject)
```

- Agents can read, edit, test, and PR freely — those are out of scope.
- **Sensitive actions** (deploy, secret use, external send) go through the gateway as **Action Requests**.
- Requests execute **only after N-of-M guardian approval**, enforced by TideCloak.
- The agent is **never given the secret** — the gateway uses it on the agent's behalf after quorum.
- Any agent that supports MCP can connect — no agent-specific integration.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  packages/mcp-server   (MCP protocol, 3 tools)                 │
│    request_deploy · request_use_secret · request_send_external  │
└──────────────────────────┬─────────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼─────────────────────────────────────┐
│  packages/gateway  (Fastify)                                    │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────┐  │
│  │ Action   │  │ Quorum       │  │ Tide       │  │ Audit   │  │
│  │ Store    │  │ Engine       │  │ Adapter    │  │ Log     │  │
│  │ (SQLite) │  │ (interface)  │  │ (interface)│  │ (append)│  │
│  └──────────┘  └──────────────┘  └────────────┘  └─────────┘  │
└──────────────────────────┬─────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │  TideCloak  │  │  Guardian   │  │  Executors  │
   │  (identity  │  │  UI (React) │  │  (mock)     │
   │   + quorum) │  │             │  │             │
   └─────────────┘  └─────────────┘  └─────────────┘
```

## Quickstart

```bash
# 1. Clone and install
git clone https://github.com/your-org/key-holder-gateway
cd key-holder-gateway
make setup

# 2. Start mock environment (no TideCloak needed for UI development)
make dev

# 3. Open the guardian UI
open http://localhost:5173

# 4. (P1 only) Start with real TideCloak
# See docs/VERIFY_TIDECLOAK.md first, then:
make docker-up
```

## Demo Scenarios

| # | Scenario | Script | What to show |
|---|----------|--------|--------------|
| 1 | Normal agent work | `make demo-1` | Agent edits/tests/PRs — no approval needed |
| 2 | Legit deploy | `make demo-2` | Guardian 1 approves → quorum not met → Guardian 2 approves → deploy executes |
| 3 | Prompt injection | `make demo-3` | Malicious issue tricks agent → request flagged → nobody approves → nothing sent |
| 4 | Manual attacker | `make demo-4` | Single compromised guardian tries external send → blocked for lack of quorum |
| 5 | Parameter swap *(stretch)* | `make demo-5` | Approval bound to hash → param change invalidates approval |

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the full 2-minute video timeline.

## Threat Model

### What we defend against
- **Prompt injection**: Agent reads a malicious issue/doc and tries to exfiltrate secrets or deploy bad code. The gateway blocks execution until quorum approves — guardians see the exact parameters.
- **Single compromised account**: One guardian (or the agent account) cannot unilaterally execute sensitive actions.
- **DB or admin compromise**: Sensitive data is encrypted at rest via TideCloak tag-based encryption; the DB shows only ciphertext. *(See Real vs Mocked below.)*

### What we explicitly do NOT defend against
- Enough guardians being tricked or rubber-stamping (social engineering of the majority).
- Sensitive actions we forgot to put behind the gateway (deny-by-default tool list mitigates this).
- Malicious code merged through hasty review (quorum protects authority, not code quality).
- A legitimate guardian screenshotting or leaking displayed data.
- Agents with free terminal access and secrets already on the machine (precondition: secrets must be unreachable by the agent).

## Real vs Mocked

| Component | Status | Notes |
|-----------|--------|-------|
| MCP server / tool routing | **Real** | Uses official MCP TypeScript SDK |
| Action Request store | **Real** | SQLite via better-sqlite3 |
| Guardian approval UI | **Real** | React + Vite |
| Quorum count enforcement | **Real (in gateway)** | Gateway counts approvals and gates execution |
| TideCloak identity (JWT verify) | **Real** | Embedded JWKS from adapter JSON |
| TideCloak cryptographic quorum | **TODO(P1)** | Subject to verification — see docs/VERIFY_TIDECLOAK.md |
| Tag-based secret encryption | **TODO(P1)** | Fallback: gateway-side hash if unsupported |
| Deploy executor | **Mocked** | Calls fake-production server |
| Secret vault | **Mocked** | Reads from mock-env/fixtures/fake-secrets.txt |
| External send | **Mocked** | Calls fake-external endpoint |

## Limitations

- Single-node SQLite — not production-scale.
- No real secret vault integration (HashiCorp Vault, AWS Secrets Manager, etc.).
- TideCloak cryptographic quorum is not yet verified (see docs/VERIFY_TIDECLOAK.md).
- Expiry cleanup is not yet implemented (TTL checked on read, not actively garbage-collected).

## Structure

```
packages/
  shared/        — Zod schemas and TypeScript types (source of truth)
  gateway/       — Fastify HTTP backend + quorum engine + TideCloak adapter
  mcp-server/    — MCP server exposing the 3 tools
  guardian-ui/   — React guardian dashboard
mock-env/        — Fake production, fake external endpoint, fixtures
scripts/         — One script per demo scenario
docs/            — Concept, API contract, threat model, roles, demo script
```

## Contributing / Agent Rules

See [AGENTS.md](AGENTS.md) for rules that apply to both humans and AI coding agents.

---

*Built at the Tide × RMIT UNLOCKED Hackathon, 2026.*
