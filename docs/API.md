# API Contract — Key-Holder Gateway

> **Source of truth**: This file + `packages/shared/src/`.
> Any change here must be accompanied by a matching change in `packages/shared/`.
> See AGENTS.md rule 4.

---

## Data Types

### ActionRequest

```json
{
  "id": "01J9XXXXXXXXXXXXXXXXXXXXX",
  "tool": "request_deploy",
  "parameters": {
    "version": "1.4.2",
    "commit": "a1b2c3d"
  },
  "parametersHash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "proposer": {
    "userId": "guardian-id-abc",
    "agent": "claude-3-5-sonnet"
  },
  "source": {
    "kind": "github-issue",
    "reference": "https://github.com/org/repo/issues/42"
  },
  "riskSignals": [],
  "createdAt": "2026-10-22T06:00:00.000Z",
  "expiresAt": "2026-10-22T07:00:00.000Z",
  "status": "pending",
  "approvals": [],
  "requiredApprovals": 2,
  "totalGuardians": 3
}
```

#### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | ULID — time-sortable unique identifier |
| `tool` | `ToolName` | One of the three allowed tool names |
| `parameters` | `object` | Exact parameters passed by the agent (tool-specific) |
| `parametersHash` | `string` | `sha256:<hex>` — canonical JSON hash of `parameters`; approvals are invalid if this changes |
| `proposer.userId` | `string` | TideCloak user ID of the agent's authenticated session |
| `proposer.agent` | `string` | Agent identifier string (e.g. `"claude-3-5-sonnet"`, `"antigravity"`) |
| `source.kind` | `SourceKind` | Where the trigger came from: `"direct"`, `"github-issue"`, `"github-pr"`, `"file"`, `"unknown"` |
| `source.reference` | `string?` | URL or path of the triggering artefact |
| `riskSignals` | `string[]` | Deterministic flags: `"external-domain"`, `"sensitive-tag"`, `"unusual-volume"`, `"unknown-destination"` |
| `createdAt` | `ISO8601` | Creation timestamp |
| `expiresAt` | `ISO8601` | After this time, request status transitions to `expired` and cannot be approved |
| `status` | `Status` | `pending` → `approved` → `executed` or `rejected` or `expired` |
| `approvals` | `Approval[]` | List of guardian decisions |
| `requiredApprovals` | `number` | Quorum threshold (default 2) |
| `totalGuardians` | `number` | Total guardian count (default 3) |

### Approval

```json
{
  "guardianId": "guardian-id-xyz",
  "decision": "approve",
  "at": "2026-10-22T06:05:00.000Z",
  "parametersHash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `guardianId` | `string` | TideCloak user ID |
| `decision` | `"approve" \| "reject"` | Guardian's decision |
| `at` | `ISO8601` | Timestamp of decision |
| `parametersHash` | `string` | Hash of parameters at time of approval — gateway verifies this matches `ActionRequest.parametersHash` before executing |

### ToolName (enum)

```typescript
"request_deploy" | "request_use_secret" | "request_send_external"
```

### Status (enum)

```typescript
"pending" | "approved" | "rejected" | "executed" | "expired"
```

### Tool Parameters

#### `request_deploy`
```json
{ "version": "string", "commit": "string (7-40 char hex)" }
```

#### `request_use_secret`
```json
{ "secret_name": "string", "purpose": "string (max 500 chars)" }
```

#### `request_send_external`
```json
{ "destination": "string (URL)", "payload_ref": "string (reference to payload, not the payload itself)" }
```

### Error Response

```json
{
  "error": {
    "code": "QUORUM_NOT_MET",
    "message": "Human-readable description",
    "details": {}
  }
}
```

#### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | JWT valid but caller lacks required role |
| `NOT_FOUND` | 404 | Action request not found |
| `ALREADY_DECIDED` | 409 | Guardian already approved or rejected this request |
| `SELF_APPROVAL` | 409 | Proposer attempted to approve their own request |
| `QUORUM_NOT_MET` | 409 | Execution triggered before quorum reached |
| `EXPIRED` | 410 | Action request has expired |
| `HASH_MISMATCH` | 422 | Parameters changed after approval was recorded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Endpoints

### POST /actions

Create a new Action Request. Called by the MCP server on behalf of the agent.

**Request**
```json
{
  "tool": "request_deploy",
  "parameters": { "version": "1.4.2", "commit": "a1b2c3d" },
  "proposer": { "userId": "user-abc", "agent": "claude-3-5-sonnet" },
  "source": { "kind": "github-issue", "reference": "https://github.com/org/repo/issues/42" }
}
```

**Response** `201 Created`
```json
{
  "id": "01J9XXXXXXXXXXXXXXXXXXXXX",
  "status": "pending",
  "parametersHash": "sha256:...",
  "expiresAt": "2026-10-22T07:00:00.000Z",
  "requiredApprovals": 2,
  "totalGuardians": 3
}
```

---

### GET /actions

List action requests. Guardians poll this endpoint.

**Query params**: `status` (optional, one of Status enum), `limit` (default 50), `offset` (default 0)

**Response** `200 OK`
```json
{
  "items": [ /* ActionRequest[] */ ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

---

### GET /actions/:id

Get a single action request by ID.

**Response** `200 OK` — full `ActionRequest` object, or `404`.

---

### POST /actions/:id/approve

Guardian approves a request. Requires guardian JWT.

**Request**
```json
{ "parametersHash": "sha256:..." }
```

**Response** `200 OK`
```json
{
  "id": "01J9XXXXXXXXXXXXXXXXXXXXX",
  "status": "approved",
  "approvals": [ /* updated list */ ],
  "executed": false
}
```

If this approval brings the count to quorum, the gateway executes the action:
```json
{
  "id": "01J9XXXXXXXXXXXXXXXXXXXXX",
  "status": "executed",
  "approvals": [ /* ... */ ],
  "executed": true,
  "executionResult": { "ok": true, "detail": "..." }
}
```

**Rules**:
- Proposer **cannot** approve their own request → `SELF_APPROVAL 409`
- Guardian cannot approve twice → `ALREADY_DECIDED 409`
- `parametersHash` must match `ActionRequest.parametersHash` → `HASH_MISMATCH 422`
- Expired requests → `EXPIRED 410`

---

### POST /actions/:id/reject

Guardian rejects a request. Requires guardian JWT. Any single rejection immediately moves status to `rejected`.

**Request**: empty body `{}`

**Response** `200 OK`
```json
{ "id": "...", "status": "rejected" }
```

---

### GET /audit

Append-only audit log. Returns all events in chronological order.

**Response** `200 OK`
```json
{
  "events": [
    {
      "id": "01J9XXXXXXXXXXXXXXXXXXXXX",
      "actionRequestId": "01J9XXXXXXXXXXXXXXXXXXXXX",
      "event": "created",
      "actor": "user-abc",
      "at": "2026-10-22T06:00:00.000Z",
      "detail": {}
    }
  ]
}
```

---

### GET /health

Liveness and readiness probe.

**Response** `200 OK`
```json
{ "status": "ok", "version": "0.1.0", "db": "ok", "tide": "ok" }
```

---

### POST /auth/dev-token

Issues cryptographically signed HMAC-SHA256 tokens using `DEV_TOKEN_SECRET` when running locally without a live TideCloak container.
Clearly labeled: `DEV TOKENS ACTIVE: not Tide identity`. Never presented as Tide identity.

**Request**
```json
{
  "userId": "guardian-alice",
  "role": "guardian"
}
```

**Response** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "userId": "guardian-alice",
  "role": "guardian",
  "warning": "DEV TOKENS ACTIVE: not Tide identity"
}
```

---

## Business Rules

1. **Execution happens only in the gateway** after quorum is met — the MCP tool never executes directly.
2. **Approval is invalid if parametersHash changes** — if parameters are mutated after any approval is recorded, the gateway rejects execution with `HASH_MISMATCH`.
3. **Proposer cannot approve own request** — enforced in the gateway quorum engine.
4. **Expiry is enforced on read** — the gateway checks `expiresAt` on every approval or execution attempt and transitions to `expired` if past.
5. **Single rejection terminates the request** — any guardian can veto.
6. **Error responses always use the standard error format** — see Error Codes above.

---

## Mock Server

A canned mock API is provided by `packages/gateway` when `NODE_ENV=development` and no TideCloak config is present. It:
- Seeds 3 pending action requests in memory on startup.
- Accepts approvals and rejections in memory (resets on restart).
- Returns deterministic IDs for scripted demos.

P2 should build the UI against this mock from day one.
