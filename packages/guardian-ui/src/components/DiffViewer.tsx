import React from 'react';
import type { RiskSignal } from '@key-holder/shared';

interface DiffViewerProps {
  patch: string;
  baseSha: string;
  filesTouched: string[];
  riskSignals: (RiskSignal | string)[];
}

interface ParsedLine {
  type: 'add' | 'del' | 'context' | 'hunk-header' | 'file-header';
  text: string;
  oldNum?: number;
  newNum?: number;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  patch,
  baseSha,
  filesTouched,
  riskSignals,
}) => {
  // Parse unified diff into structured lines with accurate line numbering
  const parseDiff = (rawDiff: string): ParsedLine[] => {
    const lines = rawDiff.split('\n');
    const result: ParsedLine[] = [];
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ')
      ) {
        result.push({ type: 'file-header', text: line });
      } else if (line.startsWith('@@')) {
        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        result.push({ type: 'hunk-header', text: line });
      } else if (line.startsWith('+')) {
        result.push({ type: 'add', text: line, newNum: newLine });
        newLine++;
      } else if (line.startsWith('-')) {
        result.push({ type: 'del', text: line, oldNum: oldLine });
        oldLine++;
      } else {
        result.push({
          type: 'context',
          text: line,
          oldNum: oldLine > 0 ? oldLine : undefined,
          newNum: newLine > 0 ? newLine : undefined,
        });
        if (oldLine > 0) oldLine++;
        if (newLine > 0) newLine++;
      }
    }

    return result;
  };

  const parsedLines = parseDiff(patch);

  // Plain-language translations of risk signals
  const getRiskExplanation = (signal: string) => {
    switch (signal) {
      case 'new-network-call':
        return {
          title: 'External Network Request Detected',
          desc: 'This patch introduces an outbound network call (fetch / http / axios). Attacker may be attempting data exfiltration to an external sink.',
          severity: 'high',
        };
      case 'env-access':
        return {
          title: 'Environment Secrets / Process.env Access',
          desc: 'This patch reads process.env, credentials, or .env files. Secret tokens risk being harvested or leaked.',
          severity: 'high',
        };
      case 'new-dependency':
        return {
          title: 'New Dependency Added',
          desc: 'This patch introduces new npm dependencies or external packages into package.json.',
          severity: 'medium',
        };
      case 'ci-config-change':
        return {
          title: 'CI / Build Configuration Modified',
          desc: 'This patch modifies CI workflows, Dockerfiles, or build manifests. Potential supply chain compromise.',
          severity: 'high',
        };
      case 'large-diff':
        return {
          title: 'Large Changeset',
          desc: 'This diff contains over 500 lines modified, increasing review complexity.',
          severity: 'low',
        };
      case 'protected-path':
        return {
          title: 'Protected System Path Touched',
          desc: 'This patch attempts to modify protected gateway infrastructure or repository system files.',
          severity: 'critical',
        };
      default:
        return {
          title: signal,
          desc: `Automated risk detector flagged: ${signal}`,
          severity: 'medium',
        };
    }
  };

  return (
    <div style={{ marginTop: '1.25rem' }}>
      {/* 1. Clear status line required by specification */}
      <div
        style={{
          background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '8px',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.4rem' }}>🛡️</span>
          <div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '-0.01em',
              }}
            >
              Protected repo is unchanged until quorum
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              The target repository main branch remains at base commit{' '}
              <code style={{ color: '#fbbf24', background: 'rgba(0,0,0,0.3)', padding: '2px 5px' }}>
                {baseSha.slice(0, 10)}
              </code>
              . No changes will be merged until 2/2 guardians approve and unit tests pass.
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.35rem 0.65rem',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            borderRadius: '6px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Isolation Active
        </span>
      </div>

      {/* 2. Metadata Cards: Base SHA & Files Touched */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '0.35rem',
            }}
          >
            Base Commit SHA
          </div>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '1.05rem',
              fontWeight: 600,
              color: '#fbbf24',
              wordBreak: 'break-all',
            }}
          >
            {baseSha}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            Executor rejects merge if protected repo HEAD differs from this SHA.
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '0.35rem',
            }}
          >
            Files Touched ({filesTouched.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {filesTouched.map((f) => (
              <span
                key={f}
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.85rem',
                  padding: '0.25rem 0.6rem',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  color: '#a5b4fc',
                  borderRadius: '5px',
                }}
              >
                📄 {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Plain Language Risk Signals */}
      {riskSignals.length > 0 && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '1.1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#f87171',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>⚠️ Automated Code Risk Analysis</span>
            <span
              style={{
                fontSize: '0.7rem',
                background: '#ef4444',
                color: 'white',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
              }}
            >
              {riskSignals.length} Flag{riskSignals.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {riskSignals.map((sig) => {
              const info = getRiskExplanation(String(sig));
              return (
                <div
                  key={String(sig)}
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    borderLeft: '4px solid #ef4444',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '0 6px 6px 0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#fca5a5',
                      marginBottom: '0.2rem',
                    }}
                  >
                    {info.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {info.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Real Diff Viewer: Monospace, line numbers, red/green lines, large readable font */}
      <div
        style={{
          border: '1px solid #334155',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#090d16',
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#111827',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1rem' }}>📝</span>
            <span
              style={{
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#f1f5f9',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Diff Preview ({filesTouched.join(', ') || 'patch'})
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Unified Diff Format • Large Readable Font for Review
          </div>
        </div>

        {/* Scrollable Diff Content */}
        <div
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '15px', // Large readable font for screen recording
            lineHeight: '1.6',
            overflowX: 'auto',
            maxHeight: '520px',
            overflowY: 'auto',
          }}
        >
          {parsedLines.map((line, idx) => {
            if (line.type === 'file-header') {
              return (
                <div
                  key={idx}
                  style={{
                    background: '#1e293b',
                    color: '#94a3b8',
                    padding: '0.35rem 1rem',
                    fontWeight: 700,
                    borderBottom: '1px solid #334155',
                    fontSize: '14px',
                  }}
                >
                  {line.text}
                </div>
              );
            }

            if (line.type === 'hunk-header') {
              return (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: '#38bdf8',
                    padding: '0.35rem 1rem',
                    fontWeight: 700,
                    borderTop: '1px solid rgba(56, 189, 248, 0.2)',
                    borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                    display: 'flex',
                  }}
                >
                  <span
                    style={{
                      width: '80px',
                      color: '#0284c7',
                      fontSize: '12px',
                      userSelect: 'none',
                    }}
                  >
                    ...
                  </span>
                  <span>{line.text}</span>
                </div>
              );
            }

            const isAdd = line.type === 'add';
            const isDel = line.type === 'del';

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  background: isAdd
                    ? 'rgba(34, 197, 94, 0.16)' // Distinct green
                    : isDel
                      ? 'rgba(239, 68, 68, 0.16)' // Distinct red
                      : 'transparent',
                  color: isAdd ? '#4ade80' : isDel ? '#f87171' : '#e2e8f0',
                  borderLeft: isAdd
                    ? '3px solid #22c55e'
                    : isDel
                      ? '3px solid #ef4444'
                      : '3px solid transparent',
                  padding: '1px 0',
                }}
              >
                {/* Gutter: Old Line Number */}
                <span
                  style={{
                    width: '45px',
                    textAlign: 'right',
                    paddingRight: '8px',
                    color: '#64748b',
                    fontSize: '12px',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  {line.oldNum ?? ''}
                </span>

                {/* Gutter: New Line Number */}
                <span
                  style={{
                    width: '45px',
                    textAlign: 'right',
                    paddingRight: '12px',
                    color: '#64748b',
                    fontSize: '12px',
                    userSelect: 'none',
                    flexShrink: 0,
                    borderRight: '1px solid #334155',
                  }}
                >
                  {line.newNum ?? ''}
                </span>

                {/* Sign (+ / - / space) */}
                <span
                  style={{
                    width: '24px',
                    textAlign: 'center',
                    fontWeight: 700,
                    userSelect: 'none',
                    flexShrink: 0,
                    color: isAdd ? '#22c55e' : isDel ? '#ef4444' : 'transparent',
                  }}
                >
                  {isAdd ? '+' : isDel ? '-' : ' '}
                </span>

                {/* Code Content */}
                <span
                  style={{
                    paddingRight: '1rem',
                    whiteSpace: 'pre',
                    wordBreak: 'normal',
                    flexGrow: 1,
                  }}
                >
                  {line.text.startsWith('+') || line.text.startsWith('-')
                    ? line.text.slice(1)
                    : line.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
