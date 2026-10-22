import React from 'react';
import type { RiskSignal } from '@key-holder/shared';

interface RiskBadgeProps {
  signals: RiskSignal[];
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ signals }) => {
  if (!signals || signals.length === 0) {
    return <span style={{ color: '#64748b', fontSize: '0.8rem' }}>None</span>;
  }

  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {signals.map((signal: RiskSignal) => {
        let label = String(signal);
        const colorClass = 'badge-risk';

        if (signal === 'external-domain') {
          label = '🌐 External Domain';
        } else if (signal === 'unknown-destination') {
          label = '⚠️ Unknown Destination';
        } else if (signal === 'sensitive-tag') {
          label = '🔑 Sensitive Secret Tag';
        } else if (signal === 'unusual-volume') {
          label = '⚡ Unusual Volume';
        }

        return (
          <span key={signal} className={`badge ${colorClass}`} title={signal}>
            {label}
          </span>
        );
      })}
    </div>
  );
};
