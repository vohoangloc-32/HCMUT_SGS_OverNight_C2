import React, { useState, useEffect, useCallback } from 'react';
import { fetchRepoLog, type RepoLogResponse } from '../api';

interface ProtectedRepoPanelProps {
  refreshTrigger?: number; // increments on decision to auto-refresh
  compact?: boolean;
}

export const ProtectedRepoPanel: React.FC<ProtectedRepoPanelProps> = ({
  refreshTrigger = 0,
  compact = false,
}) => {
  const [repoData, setRepoData] = useState<RepoLogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRepoLog();
      setRepoData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn('Failed to fetch protected repo log:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and whenever parent signals decision refresh
  useEffect(() => {
    loadLog();
  }, [loadLog, refreshTrigger]);

  return (
    <div
      style={{
        background: '#0d131f',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        marginTop: compact ? '1rem' : '1.5rem',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: '0.9rem 1.25rem',
          background: 'linear-gradient(90deg, #131d2e, #0f172a)',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              fontSize: '1.1rem',
            }}
          >
            🔒
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
              Protected Repository State
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {repoData?.repoPath ?? 'mock-env/sample-repo'} (branch:{' '}
              <strong style={{ color: '#38bdf8' }}>{repoData?.branch ?? 'main'}</strong>)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {repoData?.head && (
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.85rem',
                padding: '0.3rem 0.65rem',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#fbbf24',
                borderRadius: '6px',
                fontWeight: 700,
              }}
            >
              HEAD: {repoData.head.slice(0, 7)}
            </div>
          )}

          <button
            onClick={loadLog}
            disabled={loading}
            className="btn btn-secondary"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Description explanation */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid #1e293b',
          fontSize: '0.82rem',
          color: '#cbd5e1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          Live view of <code style={{ color: '#38bdf8' }}>git log --oneline</code>. Commit appears{' '}
          <strong>only after 2/2 guardian quorum AND passing unit tests</strong>.
        </span>
        {lastRefreshed && (
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Updated: {lastRefreshed}</span>
        )}
      </div>

      {/* Log Terminal Window */}
      <div
        style={{
          padding: '1rem 1.25rem',
          background: '#050811',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: '14.5px', // Large, crystal clear for screen recording
          lineHeight: '1.7',
          maxHeight: compact ? '220px' : '360px',
          overflowY: 'auto',
        }}
      >
        <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '0.5rem' }}>
          $ git -C protected-repo log --oneline -n 10
        </div>

        {repoData?.commits && repoData.commits.length > 0 ? (
          repoData.commits.map((commitLine, idx) => {
            const firstSpace = commitLine.indexOf(' ');
            const sha = firstSpace > -1 ? commitLine.slice(0, firstSpace) : commitLine;
            const message = firstSpace > -1 ? commitLine.slice(firstSpace + 1) : '';
            const isHead = idx === 0;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '2px 0',
                }}
              >
                <span
                  style={{
                    color: isHead ? '#fbbf24' : '#38bdf8',
                    fontWeight: 700,
                    width: '72px',
                    flexShrink: 0,
                  }}
                >
                  {sha}
                </span>

                <span
                  style={{
                    color: isHead ? '#f8fafc' : '#94a3b8',
                    fontWeight: isHead ? 600 : 400,
                    flexGrow: 1,
                  }}
                >
                  {message}
                </span>

                {isHead && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      color: '#4ade80',
                      borderRadius: '4px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    HEAD
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ color: '#64748b', fontStyle: 'italic' }}>
            No commits found or protected repo initializing...
          </div>
        )}
      </div>
    </div>
  );
};
