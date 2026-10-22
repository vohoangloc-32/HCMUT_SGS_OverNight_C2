import React from 'react';
import type { RiskSignal } from '@key-holder/shared';

interface RiskBadgeProps {
  signals: RiskSignal[];
  showDescription?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ signals, showDescription = false }) => {
  if (!signals || signals.length === 0) {
    return (
      <span style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
        No risk flags
      </span>
    );
  }

  const getSignalMeta = (signal: RiskSignal) => {
    switch (signal) {
      case 'external-domain':
        return {
          icon: '🌐',
          label: 'External Domain',
          desc: 'Target URL is outside corporate whitelist. High risk of data exfiltration.',
          style: { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' },
        };
      case 'unknown-destination':
        return {
          icon: '⚠️',
          label: 'Unknown Destination',
          desc: 'Endpoint has never appeared in prior gateway audit history.',
          style: { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' },
        };
      case 'sensitive-tag':
        return {
          icon: '🔑',
          label: 'Sensitive Secret',
          desc: 'Target secret name matches critical production credentials pattern.',
          style: { background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' },
        };
      case 'unusual-volume':
        return {
          icon: '⚡',
          label: 'Unusual Volume',
          desc: 'Rapid succession of sensitive operations requested by this agent.',
          style: { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' },
        };
      default:
        return {
          icon: '🚩',
          label: String(signal),
          desc: 'Deterministic risk rule flagged by gateway.',
          style: { background: 'rgba(255, 255, 255, 0.1)', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.2)' },
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: showDescription ? 'column' : 'row', gap: '0.4rem', flexWrap: 'wrap' }}>
      {signals.map((signal: RiskSignal) => {
        const meta = getSignalMeta(signal);
        return (
          <div key={signal} style={{ display: 'inline-flex', flexDirection: 'column' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                ...meta.style,
              }}
              title={meta.desc}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
            </span>
            {showDescription && (
              <span style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.25rem', lineHeight: 1.35 }}>
                {meta.desc}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
