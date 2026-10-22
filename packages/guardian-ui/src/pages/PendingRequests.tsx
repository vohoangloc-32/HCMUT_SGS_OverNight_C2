import React, { useState } from 'react';
import type { ActionRequest, Approval, Status } from '@key-holder/shared';
import { RiskBadge } from '../components/RiskBadge';

interface PendingRequestsProps {
  actions: ActionRequest[];
  loading: boolean;
  onSelectAction: (actionId: string) => void;
  onRefresh: () => void;
}

export const PendingRequests: React.FC<PendingRequestsProps> = ({
  actions,
  loading,
  onSelectAction,
  onRefresh,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = actions.filter((act) => {
    if (filterStatus === 'all') return true;
    return act.status === filterStatus;
  });

  const getStatusBadge = (status: Status) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-pending">Pending Approval</span>;
      case 'approved':
        return <span className="badge badge-approved">Approved</span>;
      case 'executed':
        return <span className="badge badge-executed">Executed</span>;
      case 'rejected':
        return <span className="badge badge-rejected">Rejected</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getToolIcon = (tool: string) => {
    if (tool === 'request_deploy') return '🚀';
    if (tool === 'request_use_secret') return '🔑';
    if (tool === 'request_send_external') return '🌐';
    return '⚙️';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Action Requests</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Inspect, approve, or reject intercepted sensitive operations from AI coding agents.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['all', 'pending', 'approved', 'executed', 'rejected'].map((st) => (
          <button
            key={st}
            className={`nav-link ${filterStatus === st ? 'active' : ''}`}
            onClick={() => setFilterStatus(st)}
            style={{ textTransform: 'capitalize' }}
          >
            {st} ({st === 'all' ? actions.length : actions.filter((a) => a.status === st).length})
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="table-container card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Tool / Action</th>
              <th>Proposer & Source</th>
              <th>Quorum Progress</th>
              <th>Risk Signals</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  No action requests found matching criteria.
                </td>
              </tr>
            ) : (
              filtered.map((action) => {
                const approvalCount = action.approvals.filter((a: Approval) => a.decision === 'approve').length;
                const percent = Math.min(100, Math.round((approvalCount / action.requiredApprovals) * 100));

                return (
                  <tr key={action.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{getToolIcon(action.tool)}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                            {action.tool}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                            {action.id.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                        {action.proposer.userId}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Agent: <span style={{ color: '#c7d2fe' }}>{action.proposer.agent}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Ref: {action.source.reference}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {approvalCount} / {action.requiredApprovals}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          ({action.totalGuardians} guardians)
                        </span>
                      </div>
                      <div style={{ width: '100px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: percent >= 100 ? '#10b981' : '#6366f1',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </td>

                    <td>
                      <RiskBadge signals={action.riskSignals} />
                    </td>

                    <td>{getStatusBadge(action.status)}</td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                        onClick={() => onSelectAction(action.id)}
                      >
                        Inspect &rarr;
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
