import React from 'react';
import type { AuditEvent } from '@key-holder/shared';

interface AuditLogProps {
  events: AuditEvent[];
  loading: boolean;
  onRefresh: () => void;
  onSelectAction: (id: string) => void;
}

export const AuditLog: React.FC<AuditLogProps> = ({
  events,
  loading,
  onRefresh,
  onSelectAction,
}) => {
  const getEventBadge = (type: string) => {
    switch (type) {
      case 'created':
        return <span className="badge badge-pending">Created</span>;
      case 'approved':
        return <span className="badge badge-approved">Approved</span>;
      case 'quorum-reached':
        return <span className="badge badge-executed">Quorum Reached</span>;
      case 'executed':
        return <span className="badge badge-executed">Executed</span>;
      case 'rejected':
        return <span className="badge badge-rejected">Rejected</span>;
      case 'hash-mismatch':
        return <span className="badge badge-rejected">Hash Mismatch</span>;
      default:
        return <span className="badge">{type}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Audit Trail</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Append-only, tamper-evident log of all intercepted actions, guardian approvals, and executions.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Log'}
        </button>
      </div>

      <div className="table-container card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event</th>
              <th>Actor</th>
              <th>Action ID</th>
              <th>Event Details</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  No audit events recorded yet.
                </td>
              </tr>
            ) : (
              events.map((evt: AuditEvent) => (
                <tr key={evt.id}>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {new Date(evt.at).toLocaleString()}
                  </td>
                  <td>{getEventBadge(evt.event)}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{evt.actor}</div>
                  </td>
                  <td>
                    <button
                      onClick={() => onSelectAction(evt.actionRequestId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem',
                        textDecoration: 'underline',
                      }}
                      title="Inspect this Action Request"
                    >
                      {evt.actionRequestId.slice(0, 14)}...
                    </button>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    <code style={{ background: '#07090e', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#cbd5e1' }}>
                      {JSON.stringify(evt.detail)}
                    </code>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
