import { z } from 'zod';
import { TOOL_NAMES, STATUSES, SOURCE_KINDS, RISK_SIGNALS, APPROVAL_DECISIONS } from './types.js';

// ── Primitives ────────────────────────────────────────────────────────────────

export const ToolNameSchema = z.enum(TOOL_NAMES);
export const StatusSchema = z.enum(STATUSES);
export const SourceKindSchema = z.enum(SOURCE_KINDS);
export const RiskSignalSchema = z.enum(RISK_SIGNALS);
export const ApprovalDecisionSchema = z.enum(APPROVAL_DECISIONS);

export const ParametersHashSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, 'Must be sha256:<64 hex chars>');

export const ISO8601Schema = z.string().datetime({ offset: true });

// ── Tool parameters ───────────────────────────────────────────────────────────

export const DeployParametersSchema = z.object({
  version: z.string().min(1).max(100),
  commit: z
    .string()
    .min(7)
    .max(40)
    .regex(/^[0-9a-f]+$/, 'Must be a hex commit hash'),
});

export const UseSecretParametersSchema = z.object({
  secret_name: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Z0-9_]+$/, 'Must be uppercase alphanumeric with underscores'),
  purpose: z.string().min(1).max(500),
});

export const SendExternalParametersSchema = z.object({
  destination: z.string().url(),
  payload_ref: z.string().min(1).max(500),
});

export const CodeChangeParametersSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  patch: z.string().min(1),
  baseSha: z.string().regex(/^[0-9a-f]{7,40}$/, 'Must be a hex commit hash'),
  filesTouched: z.array(z.string().min(1)),
});

// ── Core schemas ──────────────────────────────────────────────────────────────

export const ProposerSchema = z.object({
  userId: z.string().min(1),
  agent: z.string().min(1).max(200),
});

export const SourceSchema = z.object({
  kind: SourceKindSchema,
  reference: z.string().min(1).max(1000).optional(),
});

export const ApprovalSchema = z.object({
  guardianId: z.string().min(1),
  decision: ApprovalDecisionSchema,
  at: ISO8601Schema,
  parametersHash: ParametersHashSchema,
});

export const ActionRequestSchema = z.object({
  id: z.string().min(1),
  tool: ToolNameSchema,
  parameters: z.record(z.unknown()),
  parametersHash: ParametersHashSchema,
  proposer: ProposerSchema,
  source: SourceSchema,
  riskSignals: z.array(RiskSignalSchema),
  createdAt: ISO8601Schema,
  expiresAt: ISO8601Schema,
  status: StatusSchema,
  approvals: z.array(ApprovalSchema),
  requiredApprovals: z.number().int().min(1),
  totalGuardians: z.number().int().min(1),
});

// ── API request schemas ───────────────────────────────────────────────────────

export const CreateActionRequestBodySchema = z.object({
  tool: ToolNameSchema,
  parameters: z.record(z.unknown()),
  proposer: ProposerSchema,
  source: SourceSchema,
});

export const ApproveRequestBodySchema = z.object({
  parametersHash: ParametersHashSchema,
});

export const ListActionsQuerySchema = z.object({
  status: StatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
