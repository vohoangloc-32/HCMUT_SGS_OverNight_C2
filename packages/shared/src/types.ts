/**
 * @key-holder/shared — TypeScript types and Zod schemas
 *
 * This is the single source of truth for the API contract.
 * Any change here must be accompanied by a matching update to docs/API.md.
 * See AGENTS.md rule 4.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export const TOOL_NAMES = [
  'request_deploy',
  'request_use_secret',
  'request_send_external',
  'request_code_change',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const STATUSES = ['pending', 'approved', 'rejected', 'executed', 'expired', 'failed'] as const;

export type Status = (typeof STATUSES)[number];

export const SOURCE_KINDS = ['direct', 'github-issue', 'github-pr', 'file', 'unknown'] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const RISK_SIGNALS = [
  'external-domain',
  'unknown-destination',
  'sensitive-tag',
  'unusual-volume',
  'new-network-call',
  'env-access',
  'new-dependency',
  'ci-config-change',
  'large-diff',
  'protected-path',
] as const;

export type RiskSignal = (typeof RISK_SIGNALS)[number];

export const APPROVAL_DECISIONS = ['approve', 'reject'] as const;

export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

// ── Error codes ───────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_DECIDED: 'ALREADY_DECIDED',
  SELF_APPROVAL: 'SELF_APPROVAL',
  QUORUM_NOT_MET: 'QUORUM_NOT_MET',
  EXPIRED: 'EXPIRED',
  HASH_MISMATCH: 'HASH_MISMATCH',
  BASE_CHANGED: 'BASE_CHANGED',
  PROTECTED_PATH: 'PROTECTED_PATH',
  TESTS_FAILED: 'TESTS_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ── Core types ────────────────────────────────────────────────────────────────

export interface Proposer {
  userId: string;
  agent: string;
}

export interface Source {
  kind: SourceKind;
  reference?: string;
}

export interface Approval {
  guardianId: string;
  decision: ApprovalDecision;
  at: string; // ISO8601
  parametersHash: string;
}

export interface ActionRequest {
  id: string;
  tool: ToolName;
  parameters: Record<string, unknown>;
  parametersHash: string; // "sha256:<hex>"
  proposer: Proposer;
  source: Source;
  riskSignals: RiskSignal[];
  createdAt: string; // ISO8601
  expiresAt: string; // ISO8601
  status: Status;
  approvals: Approval[];
  requiredApprovals: number;
  totalGuardians: number;
}

export interface AuditEvent {
  id: string;
  actionRequestId: string;
  event:
    | 'created'
    | 'approved'
    | 'rejected'
    | 'quorum-reached'
    | 'executed'
    | 'expired'
    | 'hash-mismatch';
  actor: string;
  at: string; // ISO8601
  detail: Record<string, unknown>;
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ── Tool parameter types ──────────────────────────────────────────────────────

export interface DeployParameters {
  version: string;
  commit: string;
}

export interface UseSecretParameters {
  secret_name: string;
  purpose: string;
}

export interface SendExternalParameters {
  destination: string;
  payload_ref: string;
}

export interface CodeChangeParameters {
  title: string;
  description: string;
  patch: string;
  baseSha: string;
  filesTouched: string[];
}

// ── API request/response shapes ───────────────────────────────────────────────

export interface CreateActionRequestBody {
  tool: ToolName;
  parameters: Record<string, unknown>;
  proposer: Proposer;
  source: Source;
}

export interface CreateActionRequestResponse {
  id: string;
  status: 'pending';
  parametersHash: string;
  expiresAt: string;
  requiredApprovals: number;
  totalGuardians: number;
}

export interface ApproveRequestBody {
  parametersHash: string;
}

export interface ApproveRequestResponse {
  id: string;
  status: Status;
  approvals: Approval[];
  executed: boolean;
  executionResult?: { ok: boolean; detail: string };
}

export interface PatchResponse {
  id: string;
  patch: string;
  baseSha: string;
  filesTouched: string[];
}

export interface ListActionsResponse {
  items: ActionRequest[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditLogResponse {
  events: AuditEvent[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  db: 'ok' | 'error';
  tide: 'ok' | 'unconfigured' | 'error';
}
