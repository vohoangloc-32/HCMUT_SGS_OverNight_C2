import React, { useState } from 'react';
import type { ActionRequest, Approval, Status } from '@key-holder/shared';
import { RiskBadge } from '../components/RiskBadge';
import { DemoScenariosBar } from '../components/DemoScenariosBar';
import { authService } from '../auth';

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

  const getStatusBadge = (status: Status, expiresAt: string) => {
    const isPast = new Date(expiresAt).getTime() <= Date.now();
    if (status === 'expired' || (status === 'pending' && isPast)) {
      return <span className="badge badge-expired">Expired</span>;
    }
    switch (status) {
      case 'pending':
        return <span className="badge badge-pending">Pending Approval</span>;
      case 'approved':
        return <span className="badge badge-approved">Approved (Partial)</span>;
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

  const formatTimeLeft = (expiresAt: string, status: Status) => {
    const now = Date.now();
    const exp = new Date(expiresAt).getTime();
    const diffMs = exp - now;

    if (status === 'expired' || diffMs <= 0) {
      return <span style={{ color: '#ef4444', fontWeight: 600 }}>Expired</span>;
    }

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return (
        <span style={{ color: '#94a3b8' }}>
          {hours}h {minutes % 60}m left
        </span>
      );
    }
    return <span style={{ color: '#fbbf24', fontWeight: 600 }}>{minutes}m left</span>;
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '0.35rem',
            }}
          >
            Action Requests
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Intercepted sensitive operations requiring independent guardian quorum prior to
            execution.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Demo Showcase Bar for Judges & Presentations */}
      <DemoScenariosBar
        onRefresh={async () => onRefresh()}
        onSelectAction={onSelectAction}
        currentGuardian={authService.getCurrentSession().user.id}
      />

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'executed', 'rejected', 'expired'].map((st) => {
          const count =
            st === 'all'
              ? actions.length
              : actions.filter((a) => {
                  if (st === 'expired') {
                    return (
                      a.status === 'expired' ||
                      (a.status === 'pending' && new Date(a.expiresAt).getTime() <= Date.now())
                    );
                  }
                  return a.status === st;
                }).length;

          return (
            <button
              key={st}
              className={`nav-link ${filterStatus === st ? 'active' : ''}`}
              onClick={() => setFilterStatus(st)}
              style={{ textTransform: 'capitalize', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              {st}{' '}
              <span style={{ opacity: 0.7, fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Table Container */}
      <div className="table-container card" style={{ padding: 0 }}>
        {loading && actions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Action Requests...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛡️</div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '0.5rem',
              }}
            >
              No Requests in "{filterStatus}" State
            </div>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
                maxWidth: '400px',
                margin: '0 auto',
              }}
            >
              When AI coding agents invoke sensitive MCP tools, intercepted actions appear here for
              quorum inspection.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '26%' }}>Tool & Action ID</th>
                <th style={{ width: '22%' }}>Proposer & Source</th>
                <th style={{ width: '18%' }}>Quorum Progress</th>
                <th style={{ width: '16%' }}>Risk Signals</th>
                <th style={{ width: '10%' }}>Time Left</th>
                <th style={{ width: '8%', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((action) => {
                const approvalCount = action.approvals.filter(
                  (a: Approval) => a.decision === 'approve'
                ).length;
                const percent = Math.min(
                  100,
                  Math.round((approvalCount / action.requiredApprovals) * 100)
                );

                return (
                  <tr
                    key={action.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectAction(action.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                          {getToolIcon(action.tool)}
                        </span>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              fontSize: '0.95rem',
                            }}
                          >
                            {action.tool}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-dim)',
                              fontFamily: 'var(--font-mono)',
                              marginTop: '0.15rem',
                            }}
                          >
                            ID: {action.id.slice(0, 16)}...
                          </div>
                          <div style={{ marginTop: '0.35rem' }}>
                            {getStatusBadge(action.status, action.expiresAt)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div
                        style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}
                      >
                        {action.proposer.userId}
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.15rem',
                        }}
                      >
                        Agent:{' '}
                        <span style={{ color: '#c7d2fe', fontWeight: 500 }}>
                          {action.proposer.agent}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-dim)',
                          marginTop: '0.15rem',
                          wordBreak: 'break-all',
                        }}
                      >
                        Ref: {action.source.reference}
                      </div>
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.4rem',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: 'var(--text-main)',
                          }}
                        >
                          {approvalCount} of {action.requiredApprovals}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          ({action.totalGuardians} total)
                        </span>
                      </div>
                      <div
                        style={{
                          width: '120px',
                          height: '7px',
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
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

                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {formatTimeLeft(action.expiresAt, action.status)}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', fontWeight: 600 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAction(action.id);
                        }}
                      >
                        Inspect &rarr;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
