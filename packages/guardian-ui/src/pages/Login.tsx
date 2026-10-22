import React, { useState } from 'react';
import { authService, type GuardianUser } from '../auth';

interface LoginProps {
  onLogin: (guardianId: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const availableGuardians = authService.listAvailableGuardians();
  const [selectedGuardian, setSelectedGuardian] = useState<string>(availableGuardians[0].id);
  const [useOidcStub, setUseOidcStub] = useState<boolean>(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await authService.login(selectedGuardian, useOidcStub);
    onLogin(selectedGuardian);
  };

  const currentGuardianObj =
    availableGuardians.find((g) => g.id === selectedGuardian) ?? availableGuardians[0];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '85vh',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '2.5rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '0.5rem',
            }}
          >
            Guardian Console
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', lineHeight: 1.5 }}>
            Key-Holder Gateway • Emergent Authority via N-of-M Quorum
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '9999px',
                color: '#f87171',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              ⚠️ MOCK LOGIN — SIMULATED IDENTITY
            </span>
          </div>
        </div>

        {/* Auth Boundary Notice */}
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.8rem',
            color: '#fca5a5',
            lineHeight: 1.45,
          }}
        >
          <strong>⚠️ MOCK LOGIN:</strong> TideCloak dev container is offline on this host. Guardian
          sessions are simulated for UI demo purposes and must not be presented as genuine Tide authentication.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
              }}
            >
              Select Guardian Key-Holder
            </label>
            <select
              value={selectedGuardian}
              onChange={(e) => setSelectedGuardian(e.target.value)}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background: '#07090e',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                fontWeight: 600,
                outline: 'none',
              }}
            >
              {availableGuardians.map((g: GuardianUser) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.role}
                </option>
              ))}
            </select>
          </div>

          {/* Active Guardian Profile Preview */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.85rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: currentGuardianObj.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
              }}
            >
              {currentGuardianObj.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {currentGuardianObj.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {currentGuardianObj.role} • {currentGuardianObj.email}
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: '1.5rem',
              padding: '0.85rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={useOidcStub}
                onChange={(e) => setUseOidcStub(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              <span>Generate Simulated TideCloak JWT Bearer Token</span>
            </label>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                marginTop: '0.4rem',
                lineHeight: 1.4,
              }}
            >
              Attaches simulated OIDC token to all outbound guardian approval requests.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.9rem',
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.01em',
            }}
          >
            Authenticate as {currentGuardianObj.name.split(' ')[0]} &rarr;
          </button>
        </form>

        <div
          style={{
            marginTop: '1.75rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
          }}
        >
          TideCloak Threshold Cryptography • No Single Master Key
        </div>
      </div>
    </div>
  );
};
