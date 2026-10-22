import React, { useState } from 'react';
import type { ActionRequest, Approval } from '@key-holder/shared';
import { RiskBadge } from '../components/RiskBadge';

interface RequestDetailProps {
  action: ActionRequest;
  currentGuardian: string;
  onBack: () => void;
  onApprove: (id: string, hash: string) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
}

export const RequestDetail: React.FC<RequestDetailProps> = ({
  action,
  currentGuardian,
  onBack,
  onApprove,
  onReject,
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasApproved = action.approvals.some(
    (ap: Approval) => ap.guardianId === currentGuardian && ap.decision === 'approve'
  );
  const approvalCount = action.approvals.filter((a: Approval) => a.decision === 'approve').length;

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await onApprove(action.id, action.parametersHash);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await onReject(action.id, rejectReason);
      setShowRejectModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          &larr; Back to Requests
        </button>
        <span style={{ color: 'var(--text-dim)' }}>/</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {action.id}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Details & Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <span className="badge badge-risk" style={{ marginBottom: '0.5rem' }}>
                  {action.tool}
                </span>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Action Request Details</h1>
              </div>

              <div>
                {action.status === 'pending' && <span className="badge badge-pending">Awaiting Quorum</span>}
                {action.status === 'approved' && <span className="badge badge-approved">Quorum Reached</span>}
                {action.status === 'executed' && <span className="badge badge-executed">Executed</span>}
                {action.status === 'rejected' && <span className="badge badge-rejected">Rejected</span>}
              </div>
            </div>

            {/* Risk Warnings */}
            {action.riskSignals.length > 0 && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, color: 'var(--risk-high)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚠️</span> Deterministic Risk Flags Detected
                </div>
                <RiskBadge signals={action.riskSignals} />
                <p style={{ fontSize: '0.8rem', color: '#fecdd3', marginTop: '0.5rem' }}>
                  This action triggered gateway risk rules. Review parameters and destination carefully before approving.
                </p>
              </div>
            )}

            {/* Parameters Payload */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Action Parameters
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                  JSON Payload
                </span>
              </div>
              <pre className="code-block">{JSON.stringify(action.parameters, null, 2)}</pre>
            </div>

            {/* Cryptographic Hash Binding */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Parameter Hash (Parameter-Bound Approval)
                </label>
                <span style={{ fontSize: '0.75rem', color: '#10b981' }}>✓ SHA-256 Canonical</span>
              </div>
              <div
                style={{
                  background: '#07090e',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: '#94a3b8',
                  wordBreak: 'break-all',
                }}
              >
                {action.parametersHash}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                Approvals cryptographically bind to this exact parameters hash. If parameters change during transit, approval becomes invalid.
              </p>
            </div>
          </div>

          {/* Action Execution / Approval Box */}
          {action.status === 'pending' && (
            <div className="card" style={{ border: '1px solid var(--border-highlight)' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>Guardian Decision</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Logged in as <strong>{currentGuardian}</strong>. Approving will cryptographically endorse this action.
              </p>

              {hasApproved ? (
                <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#10b981', fontSize: '0.9rem' }}>
                  ✓ You ({currentGuardian}) have already signed and approved this request. Waiting for additional guardians to reach quorum ({approvalCount}/{action.requiredApprovals}).
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    className="btn btn-approve"
                    style={{ flex: 1, padding: '0.85rem' }}
                    onClick={handleApprove}
                    disabled={submitting}
                  >
                    {submitting ? 'Signing...' : '✓ Approve Request (Sign Quorum)'}
                  </button>
                  <button
                    className="btn btn-reject"
                    style={{ flex: 1, padding: '0.85rem' }}
                    onClick={() => setShowRejectModal(true)}
                    disabled={submitting}
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Quorum Status & Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quorum Progress */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>N-of-M Quorum Threshold</h2>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span>Approvals Gathered</span>
                <strong>{approvalCount} / {action.requiredApprovals}</strong>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, (approvalCount / action.requiredApprovals) * 100)}%`,
                    height: '100%',
                    background: approvalCount >= action.requiredApprovals ? '#10b981' : '#6366f1',
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Requires {action.requiredApprovals} independent approvals out of {action.totalGuardians} total guardians.
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem', fontWeight: 600 }}>
                Signatures Recorded ({action.approvals.length})
              </div>
              {action.approvals.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  No guardian signatures recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {action.approvals.map((ap: Approval, i: number) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{ap.guardianId}</strong>
                        <span style={{ color: ap.decision === 'approve' ? '#10b981' : '#ef4444', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 600 }}>
                          {ap.decision}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                        {new Date(ap.at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Context & Metadata */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Origin Context</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>PROPOSER</span>
                <strong>{action.proposer.userId}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>AI AGENT</span>
                <span style={{ color: '#c7d2fe' }}>{action.proposer.agent}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>SOURCE KIND</span>
                <span>{action.source.kind}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>REFERENCE</span>
                <span style={{ wordBreak: 'break-all' }}>{action.source.reference}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>CREATED AT</span>
                <span>{new Date(action.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)', display: 'block', fontSize: '0.75rem' }}>EXPIRES AT</span>
                <span>{new Date(action.expiresAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Reject Action Request</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Are you sure you want to reject this action? Rejection is permanent and will prevent execution.
            </p>
            <textarea
              placeholder="Reason for rejection (e.g. suspicious payload, unverified commit)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{
                width: '100%',
                height: '80px',
                padding: '0.75rem',
                borderRadius: '8px',
                background: '#07090e',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                marginBottom: '1rem',
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
