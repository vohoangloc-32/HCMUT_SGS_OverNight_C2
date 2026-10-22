import type { ActionRequest, Approval, AuditEvent } from '@key-holder/shared';

// Pre-seeded mock data for UI testing and demo when gateway is offline
const INITIAL_MOCK_ACTIONS: ActionRequest[] = [
  {
    id: '01HV8G7N9B3W00000000000001',
    tool: 'request_deploy',
    parameters: {
      version: '1.4.2',
      commit: 'c0ffee1b4d89a234',
    },
    parametersHash: 'sha256:7b2496a8e8055b3fbf50bc3db0e08c491295cb4f7a77f9801ef06ee791999999',
    proposer: {
      userId: 'engineer-alice',
      agent: 'Claude-Code-Agent-v1',
    },
    source: {
      kind: 'github-pr',
      reference: 'https://github.com/org/sample-repo/pull/42',
    },
    riskSignals: ['external-domain'],
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    status: 'pending',
    approvals: [
      {
        guardianId: 'guardian-alice',
        decision: 'approve',
        at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        parametersHash: 'sha256:7b2496a8e8055b3fbf50bc3db0e08c491295cb4f7a77f9801ef06ee791999999',
      },
    ],
    requiredApprovals: 2,
    totalGuardians: 3,
  },
  {
    id: '01HV8G7N9B3W00000000000002',
    tool: 'request_use_secret',
    parameters: {
      secret_name: 'PROD_DB_MIGRATION_TOKEN',
      purpose: 'Run post-deploy migration for schema v42',
    },
    parametersHash: 'sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    proposer: {
      userId: 'engineer-bob',
      agent: 'Cursor-Agent',
    },
    source: {
      kind: 'direct',
      reference: 'slack-incident-thread-99',
    },
    riskSignals: ['sensitive-tag'],
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    status: 'pending',
    approvals: [],
    requiredApprovals: 2,
    totalGuardians: 3,
  },
  {
    id: '01HV8G7N9B3W00000000000003',
    tool: 'request_send_external',
    parameters: {
      destination: 'https://evil.external-leak.site/collect',
      payload_ref: 'FAKE_EXFILTRATED_DATA_BLOB',
    },
    parametersHash: 'sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    proposer: {
      userId: 'malicious-agent',
      agent: 'Injected-Prompt-Agent',
    },
    source: {
      kind: 'github-issue',
      reference: 'mock-env/fixtures/malicious-issue.md',
    },
    riskSignals: ['external-domain', 'unknown-destination'],
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 58).toISOString(),
    status: 'pending',
    approvals: [],
    requiredApprovals: 2,
    totalGuardians: 3,
  },
  {
    id: '01HV8G7N9B3W00000000000004',
    tool: 'request_deploy',
    parameters: {
      version: '1.4.1',
      commit: 'a1b2c3d4e5f6',
    },
    parametersHash: 'sha256:f00dbabe00000000000000000000000000000000000000000000000000000000',
    proposer: {
      userId: 'engineer-alice',
      agent: 'Claude-Code-Agent-v1',
    },
    source: {
      kind: 'direct',
      reference: 'job-9810',
    },
    riskSignals: [],
    createdAt: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
    expiresAt: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
    status: 'executed',
    approvals: [
      {
        guardianId: 'guardian-alice',
        decision: 'approve',
        at: new Date(Date.now() - 1000 * 3600 * 2.8).toISOString(),
        parametersHash: 'sha256:f00dbabe00000000000000000000000000000000000000000000000000000000',
      },
      {
        guardianId: 'guardian-bob',
        decision: 'approve',
        at: new Date(Date.now() - 1000 * 3600 * 2.5).toISOString(),
        parametersHash: 'sha256:f00dbabe00000000000000000000000000000000000000000000000000000000',
      },
    ],
    requiredApprovals: 2,
    totalGuardians: 3,
  },
];

const INITIAL_MOCK_AUDIT: AuditEvent[] = [
  {
    id: '01HV8G7N9B3W000000000000A1',
    actionRequestId: '01HV8G7N9B3W00000000000004',
    event: 'created',
    actor: 'engineer-alice',
    at: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
    detail: { tool: 'request_deploy', version: '1.4.1' },
  },
  {
    id: '01HV8G7N9B3W000000000000A2',
    actionRequestId: '01HV8G7N9B3W00000000000004',
    event: 'approved',
    actor: 'guardian-alice',
    at: new Date(Date.now() - 1000 * 3600 * 2.8).toISOString(),
    detail: { decision: 'approve' },
  },
  {
    id: '01HV8G7N9B3W000000000000A3',
    actionRequestId: '01HV8G7N9B3W00000000000004',
    event: 'approved',
    actor: 'guardian-bob',
    at: new Date(Date.now() - 1000 * 3600 * 2.5).toISOString(),
    detail: { decision: 'approve' },
  },
  {
    id: '01HV8G7N9B3W000000000000A4',
    actionRequestId: '01HV8G7N9B3W00000000000004',
    event: 'quorum-reached',
    actor: 'gateway',
    at: new Date(Date.now() - 1000 * 3600 * 2.5).toISOString(),
    detail: { required: 2, reached: 2 },
  },
  {
    id: '01HV8G7N9B3W000000000000A5',
    actionRequestId: '01HV8G7N9B3W00000000000004',
    event: 'executed',
    actor: 'gateway',
    at: new Date(Date.now() - 1000 * 3600 * 2.4).toISOString(),
    detail: { message: 'Deployed version 1.4.1 to mock production' },
  },
];

const mockActions: ActionRequest[] = [...INITIAL_MOCK_ACTIONS];
const mockAudit: AuditEvent[] = [...INITIAL_MOCK_AUDIT];
let forceMockMode = false;

export function setForceMock(enabled: boolean) {
  forceMockMode = enabled;
}

export function isMockModeActive(): boolean {
  return forceMockMode;
}

export async function fetchActions(status?: string): Promise<{ data: ActionRequest[]; isMock: boolean }> {
  if (forceMockMode) {
    const filtered = status ? mockActions.filter((a) => a.status === status) : mockActions;
    return { data: filtered, isMock: true };
  }
  try {
    const url = status ? `/actions?status=${encodeURIComponent(status)}` : '/actions';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { data: json.items ?? json, isMock: false };
  } catch (err) {
    console.warn('Gateway unavailable, using mock data:', err);
    const filtered = status ? mockActions.filter((a) => a.status === status) : mockActions;
    return { data: filtered, isMock: true };
  }
}

export async function fetchActionById(id: string): Promise<{ data: ActionRequest | null; isMock: boolean }> {
  if (forceMockMode) {
    const found = mockActions.find((a) => a.id === id) ?? null;
    return { data: found, isMock: true };
  }
  try {
    const res = await fetch(`/actions/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { data: json, isMock: false };
  } catch {
    const found = mockActions.find((a) => a.id === id) ?? null;
    return { data: found, isMock: true };
  }
}

export async function approveAction(
  id: string,
  guardianId: string,
  parametersHash: string,
  token?: string
): Promise<{ success: boolean; data?: ActionRequest; error?: string }> {
  if (forceMockMode) {
    return handleMockApprove(id, guardianId, parametersHash);
  }
  try {
    const res = await fetch(`/actions/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ guardianId, parametersHash }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `HTTP ${res.status}`);
    }
    const json = await res.json();
    return { success: true, data: json };
  } catch (err: unknown) {
    const e = err as Error;
    console.warn('Gateway approve failed, falling back to mock operation:', e.message);
    return handleMockApprove(id, guardianId, parametersHash);
  }
}

export async function rejectAction(
  id: string,
  guardianId: string,
  reason?: string,
  token?: string
): Promise<{ success: boolean; data?: ActionRequest; error?: string }> {
  if (forceMockMode) {
    return handleMockReject(id, guardianId, reason);
  }
  try {
    const res = await fetch(`/actions/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ guardianId, reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `HTTP ${res.status}`);
    }
    const json = await res.json();
    return { success: true, data: json };
  } catch (err: unknown) {
    const e = err as Error;
    console.warn('Gateway reject failed, falling back to mock operation:', e.message);
    return handleMockReject(id, guardianId, reason);
  }
}

export async function fetchAudit(): Promise<{ data: AuditEvent[]; isMock: boolean }> {
  if (forceMockMode) {
    return { data: mockAudit, isMock: true };
  }
  try {
    const res = await fetch('/audit');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { data: json.events ?? json.items ?? json, isMock: false };
  } catch {
    return { data: mockAudit, isMock: true };
  }
}

function handleMockApprove(id: string, guardianId: string, parametersHash: string) {
  const req = mockActions.find((a) => a.id === id);
  if (!req) return { success: false, error: 'Request not found' };
  if (req.approvals.some((ap: Approval) => ap.guardianId === guardianId)) {
    return { success: false, error: 'Guardian has already approved this request' };
  }
  const newApproval: Approval = {
    guardianId,
    decision: 'approve',
    at: new Date().toISOString(),
    parametersHash,
  };
  req.approvals.push(newApproval);
  if (req.approvals.filter((a) => a.decision === 'approve').length >= req.requiredApprovals) {
    req.status = 'executed';
  }
  mockAudit.unshift({
    id: `01MOCK${Date.now()}`,
    actionRequestId: id,
    event: req.status === 'executed' ? 'executed' : 'approved',
    actor: guardianId,
    at: new Date().toISOString(),
    detail: { decision: 'approve', quorumStatus: `${req.approvals.length}/${req.requiredApprovals}` },
  });
  return { success: true, data: { ...req } };
}

function handleMockReject(id: string, guardianId: string, reason?: string) {
  const req = mockActions.find((a) => a.id === id);
  if (!req) return { success: false, error: 'Request not found' };
  req.status = 'rejected';
  req.approvals.push({
    guardianId,
    decision: 'reject',
    at: new Date().toISOString(),
    parametersHash: req.parametersHash,
  });
  mockAudit.unshift({
    id: `01MOCK${Date.now()}`,
    actionRequestId: id,
    event: 'rejected',
    actor: guardianId,
    at: new Date().toISOString(),
    detail: { decision: 'reject', reason: reason ?? 'Manually rejected by guardian' },
  });
  return { success: true, data: { ...req } };
}
