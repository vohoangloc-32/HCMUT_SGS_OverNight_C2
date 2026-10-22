import React, { useState } from 'react';
import type { ActionRequest, Approval } from '@key-holder/shared';
import { RiskBadge } from '../components/RiskBadge';

interface RequestDetailProps {
  action: ActionRequest | null;
  currentGuardian: string;
  loading?: boolean;
  onBack: () => void;
  onApprove: (id: string, hash: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
}

export const RequestDetail: React.FC<RequestDetailProps> = ({
  action,
  currentGuardian,
  loading = false,
  onBack,
  onApprove,
  onReject,
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Loading State
  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Loading Action Request...</h2>
      </div>
    );
  }

  // Empty State (Not found)
  if (!action) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Action Request Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          The requested action ID does not exist in the Gateway repository or has been purged.
        </p>
        <button className="btn btn-secondary" onClick={onBack}>
          &larr; Back to Requests
        </button>
      </div>
    );
  }

  // Contract State Calculations
  const isExpired = action.status === 'expired' || new Date(action.expiresAt).getTime() <= Date.now();
  const isProposer = action.proposer.userId === currentGuardian;
  const existingVote = action.approvals.find((ap: Approval) => ap.guardianId === currentGuardian);
  const hasDecided = Boolean(existingVote);
  const approvalCount = action.approvals.filter((a: Approval) => a.decision === 'approve').length;
  const willReachQuorumOnApprove = approvalCount + 1 >= action.requiredApprovals;

  const hasSuspiciousDestination = action.riskSignals.includes('external-domain') || action.riskSignals.includes('unknown-destination');
  const hasSensitiveSecret = action.riskSignals.includes('sensitive-tag');

  const handleApprove = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onApprove(action.id, action.parametersHash);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to approve action request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onReject(action.id, rejectReason);
      setShowRejectModal(false);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to reject action request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Navigation */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.45rem 0.85rem' }}>
          &larr; Back to Requests
        </button>
        <span style={{ color: 'var(--text-dim)' }}>/</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {action.id}
        </span>
      </div>

      {/* Global Error Banner (Error State) */}
      {errorMessage && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>❌ Operation Failed:</strong> {errorMessage}
          </div>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}>
            ✕
          </button>
        </div>
      )}

      {/* Two Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Details & Exact Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span className="badge badge-risk" style={{ marginBottom: '0.5rem' }}>
                  {action.tool}
                </span>
                <h1 style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '0.25rem' }}>
                  Action Inspection
                </h1>
              </div>

              <div>
                {isExpired && <span className="badge badge-expired">Expired</span>}
                {!isExpired && action.status === 'pending' && <span className="badge badge-pending">Awaiting Quorum</span>}
                {!isExpired && action.status === 'approved' && <span className="badge badge-approved">Partially Approved</span>}
                {action.status === 'executed' && <span className="badge badge-executed">Executed</span>}
                {action.status === 'rejected' && <span className="badge badge-rejected">Rejected</span>}
              </div>
            </div>

            {/* Suspicious Alert Callout */}
            {hasSuspiciousDestination && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                  <span>🚨</span> High Risk: Unauthorized External Destination
                </div>
                <p style={{ fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.45, margin: 0 }}>
                  The agent is attempting to transmit data to an external address that is not on the corporate allowlist. Verify destination origin and source context carefully before deciding.
                </p>
              </div>
            )}

            {hasSensitiveSecret && !hasSuspiciousDestination && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', fontSize: '0.95rem' }}>
                  <span>🔑</span> Sensitive Credential Scope
                </div>
                <p style={{ fontSize: '0.85rem', color: '#e9d5ff', lineHeight: 1.45, margin: 0 }}>
                  This request requests access to high-privilege credentials ({String(action.parameters.secret_name ?? 'SECRET')}).
                </p>
              </div>
            )}

            {/* Risk Signals In Plain Language */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                Deterministic Risk Signals
              </label>
              <RiskBadge signals={action.riskSignals} showDescription={true} />
            </div>

            {/* Exact Parameters Prominently Displayed */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Exact Action Parameters (Verifiable Payload)
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  Tool: {action.tool}
                </span>
              </div>
              <pre className="code-block" style={{ fontSize: '0.9rem', lineHeight: 1.5, background: '#05070c', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: '8px', color: '#e2e8f0' }}>
                {JSON.stringify(action.parameters, null, 2)}
              </pre>
            </div>

            {/* Parameter-Bound Canonical Hash */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Parameter Binding (SHA-256 Hash)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                  ✓ Cryptographically Bound
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#94a3b8', wordBreak: 'break-all' }}>
                {action.parametersHash}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.45rem', lineHeight: 1.4, margin: 0 }}>
                Guardian approvals are cryptographically bound to this canonical hash. If an attacker swaps parameters in transit, the gateway will immediately reject execution with <code>HASH_MISMATCH</code>.
              </p>
            </div>
          </div>

          {/* Decision Box with Explicit Contract States */}
          <div className="card" style={{ border: '1px solid var(--border-highlight)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              Guardian Authority & Decision
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Active key-holder session: <strong>{currentGuardian}</strong>
            </p>

            {/* STATE 1: Expired State */}
            {isExpired ? (
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444' }}>
                <strong>⚠️ Action Request Expired:</strong> This request passed its expiration time ({new Date(action.expiresAt).toLocaleTimeString()}) without reaching quorum. Decision voting is permanently disabled.
              </div>
            ) : action.status === 'executed' ? (
              /* STATE 2: Executed State */
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#10b981' }}>
                <strong>✓ Action Already Executed:</strong> 2-of-3 quorum was met. The Gateway dispatched execution without exposing credentials to the agent.
              </div>
            ) : action.status === 'rejected' ? (
              /* STATE 3: Rejected State */
              <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444' }}>
                <strong>✗ Action Rejected:</strong> A guardian exercised veto authority. This action request has been terminated permanently.
              </div>
            ) : isProposer ? (
              /* STATE 4: Proposer Cannot Approve Own Request */
              <div style={{ padding: '1.25rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                  ⛔ Self-Approval Prohibited (Four-Eyes Principle)
                </div>
                <p style={{ fontSize: '0.85rem', color: '#fde68a', margin: 0, lineHeight: 1.45 }}>
                  You are logged in as <strong>{currentGuardian}</strong>, who is the proposer of this action request. Gateway policy strictly forbids proposers from approving their own sensitive actions. Another independent guardian must review and approve.
                </p>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-approve" disabled={true} style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                    ✓ Approve Request (Disabled for Proposer)
                  </button>
                  <button className="btn btn-reject" onClick={() => setShowRejectModal(true)}>
                    ✗ Reject / Cancel
                  </button>
                </div>
              </div>
            ) : hasDecided ? (
              /* STATE 5: Already Decided */
              <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', color: '#c7d2fe' }}>
                <strong>✓ Signature Recorded:</strong> You ({currentGuardian}) have already cast your vote (<code>{existingVote?.decision}</code>) at {new Date(existingVote?.at ?? '').toLocaleTimeString()}. Awaiting additional guardian signatures to form quorum ({approvalCount}/{action.requiredApprovals}).
              </div>
            ) : (
              /* STATE 6: Ready to Decide */
              <div>
                {/* Explanation: What happens after approval */}
                <div style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
                    {willReachQuorumOnApprove ? '⚡ What happens on approval:' : '⏳ What happens on approval:'}
                  </strong>
                  <span style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {willReachQuorumOnApprove
                      ? `Your approval will complete the ${action.requiredApprovals}-of-${action.totalGuardians} quorum threshold. The Gateway will immediately execute this ${action.tool} operation against the verified target.`
                      : `Your approval will record 1 of ${action.requiredApprovals} required signatures. The action will remain safely paused until another guardian signs.`}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    className="btn btn-approve"
                    style={{ flex: 1.2, padding: '0.9rem', fontSize: '0.95rem' }}
                    onClick={handleApprove}
                    disabled={submitting}
                  >
                    {submitting ? 'Signing...' : '✓ Approve Request (Sign Quorum)'}
                  </button>
                  <button
                    className="btn btn-reject"
                    style={{ flex: 1, padding: '0.9rem', fontSize: '0.95rem' }}
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting}
                  >
                    ✗ Reject Action
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quorum Progress & Origin Context */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quorum Progress Card */}
          <div className="card">
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem' }}>
              Quorum Authority State
            </h2>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Signatures Recorded</span>
                <strong>{approvalCount} of {action.requiredApprovals}</strong>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (approvalCount / action.requiredApprovals) * 100)}%`,
                    height: '100%',
                    background: approvalCount >= action.requiredApprovals ? '#10b981' : '#6366f1',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Requires {action.requiredApprovals} independent guardian approvals out of {action.totalGuardians} total guardians.
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.6rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                Recorded Guardian Decisions ({action.approvals.length})
              </div>
              {action.approvals.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  No guardian decisions recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {action.approvals.map((ap: Approval, i: number) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{ap.guardianId}</strong>
                        <span style={{
                          color: ap.decision === 'approve' ? '#10b981' : '#ef4444',
                          background: ap.decision === 'approve' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}>
                          {ap.decision}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                        {new Date(ap.at).toLocaleTimeString()} • Parameter hash verified
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Origin Context Card */}
          <div className="card">
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem' }}>
              Origin Context & Proposer
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.875rem' }}>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  Proposer User
                </span>
                <strong style={{ color: 'var(--text-main)' }}>{action.proposer.userId}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  AI Coding Agent
                </span>
                <span style={{ color: '#c7d2fe', fontWeight: 600 }}>{action.proposer.agent}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  Trigger Source
                </span>
                <span style={{ textTransform: 'capitalize' }}>{action.source.kind}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  Source Reference
                </span>
                <span style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#94a3b8' }}>
                  {action.source.reference}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  Created At
                </span>
                <span>{new Date(action.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  Expires At
                </span>
                <span style={{ color: isExpired ? '#ef4444' : 'inherit' }}>
                  {new Date(action.expiresAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '2rem', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f87171' }}>
              Confirm Action Rejection
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.45 }}>
              Rejection is permanent and immediately terminates this action request. The agent will receive an access denied response.
            </p>
            <textarea
              placeholder="Reason for rejection (e.g. prompt injection in issue, unexpected external destination)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{
                width: '100%',
                height: '90px',
                padding: '0.85rem',
                borderRadius: '8px',
                background: '#07090e',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                marginBottom: '1.25rem',
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button className="btn btn-reject" onClick={handleReject} disabled={submitting}>
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
