import React, { useState } from 'react';
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
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = events.filter((evt) => {
    if (filterEvent !== 'all' && evt.event !== filterEvent) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        evt.actionRequestId.toLowerCase().includes(q) ||
        evt.actor.toLowerCase().includes(q) ||
        evt.event.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
      case 'expired':
        return <span className="badge badge-expired">Expired</span>;
      case 'hash-mismatch':
        return <span className="badge badge-rejected">Hash Mismatch</span>;
      default:
        return <span className="badge">{type}</span>;
    }
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
            Audit Trail
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Append-only, tamper-evident log of intercepted actions, guardian approvals, and
            execution results.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onRefresh}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem' }}
        >
          <span>{loading ? '⏳' : '🔄'}</span>
          <span>{loading ? 'Refreshing...' : 'Refresh Log'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['all', 'created', 'approved', 'executed', 'rejected', 'expired'].map((ev) => (
            <button
              key={ev}
              className={`nav-link ${filterEvent === ev ? 'active' : ''}`}
              onClick={() => setFilterEvent(ev)}
              style={{
                textTransform: 'capitalize',
                fontSize: '0.85rem',
                padding: '0.45rem 0.85rem',
              }}
            >
              {ev}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by action ID, actor, or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '0.55rem 0.9rem',
            borderRadius: '8px',
            background: '#07090e',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            width: '280px',
            outline: 'none',
          }}
        />
      </div>

      <div className="table-container card" style={{ padding: 0 }}>
        {loading && events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading Audit Trail...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📜</div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginBottom: '0.5rem',
              }}
            >
              No Audit Events Found
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No audit events matched your search or filter selection.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Timestamp</th>
                <th style={{ width: '14%' }}>Event</th>
                <th style={{ width: '18%' }}>Actor / Source</th>
                <th style={{ width: '22%' }}>Action Request ID</th>
                <th style={{ width: '28%' }}>Event Payload & Metadata</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evt: AuditEvent) => (
                <tr key={evt.id}>
                  <td
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Date(evt.at).toLocaleDateString()} {new Date(evt.at).toLocaleTimeString()}
                  </td>
                  <td>{getEventBadge(evt.event)}</td>
                  <td>
                    <div
                      style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}
                    >
                      {evt.actor}
                    </div>
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
                        padding: 0,
                      }}
                      title="Inspect this Action Request"
                    >
                      {evt.actionRequestId.slice(0, 18)}... &rarr;
                    </button>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    <code
                      style={{
                        background: '#05070c',
                        border: '1px solid var(--border-subtle)',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        color: '#cbd5e1',
                        display: 'inline-block',
                        maxWidth: '340px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {JSON.stringify(evt.detail)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
