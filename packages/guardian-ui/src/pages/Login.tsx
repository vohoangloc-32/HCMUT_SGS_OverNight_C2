import React, { useState } from 'react';

interface LoginProps {
  onLogin: (guardianId: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedGuardian, setSelectedGuardian] = useState('guardian-alice');
  const [useOidcStub, setUseOidcStub] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(selectedGuardian);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M12 8v4"/>
              <path d="M12 16h.01"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Guardian Gateway</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Authenticate to inspect and approve AI agent sensitive action requests.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Select Guardian Account
            </label>
            <select
              value={selectedGuardian}
              onChange={(e) => setSelectedGuardian(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: '#07090e',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            >
              <option value="guardian-alice">Alice (Security Lead - Guardian 1)</option>
              <option value="guardian-bob">Bob (DevOps Eng - Guardian 2)</option>
              <option value="guardian-carol">Carol (Infra Eng - Guardian 3)</option>
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem', padding: '0.85rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useOidcStub}
                onChange={(e) => setUseOidcStub(e.target.checked)}
              />
              <span>Simulate TideCloak OIDC Bearer Token</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
              {/* TODO(P1): Replace with real TideCloak OIDC redirect after TC-01 verification */}
              When TideCloak OIDC is enabled, guardians authenticate via standard OAuth2 / OpenID Connect authorization code flow.
            </p>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }}>
            Enter Guardian Console
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          TideCloak N-of-M Threshold Quorum Protocol
        </div>
      </div>
    </div>
  );
};
