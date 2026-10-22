import React from 'react';
import { authService, type GuardianUser } from '../auth';

interface HeaderProps {
  currentTab: 'requests' | 'audit' | 'detail';
  setCurrentTab: (tab: 'requests' | 'audit') => void;
  currentGuardian: string;
  setCurrentGuardian: (guardian: string) => void;
  isMock: boolean;
  toggleMock: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  currentGuardian,
  setCurrentGuardian,
  isMock,
  toggleMock,
  onLogout,
}) => {
  const availableGuardians = authService.listAvailableGuardians();
  const activeGuardianObj =
    availableGuardians.find((g) => g.id === currentGuardian) ?? availableGuardians[0];

  const handleGuardianChange = async (newId: string) => {
    await authService.login(newId);
    setCurrentGuardian(newId);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
          <div
            className="brand"
            style={{ cursor: 'pointer' }}
            onClick={() => setCurrentTab('requests')}
          >
            <div className="brand-icon">
              <svg
                width="22"
                height="22"
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
            <div>
              <div className="brand-title">Key-Holder Gateway</div>
              <div className="brand-subtitle">Emergent Authority • N-of-M Quorum</div>
            </div>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-link ${currentTab === 'requests' || currentTab === 'detail' ? 'active' : ''}`}
              onClick={() => setCurrentTab('requests')}
            >
              Pending Requests
            </button>
            <button
              className={`nav-link ${currentTab === 'audit' ? 'active' : ''}`}
              onClick={() => setCurrentTab('audit')}
            >
              Audit Trail
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Mode Switcher */}
          <button
            onClick={toggleMock}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '0.45rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderColor: isMock ? '#f59e0b' : '#10b981',
            }}
            title="Toggle between Live Gateway and Mock Dataset"
          >
            <span style={{ fontSize: '0.75rem' }}>{isMock ? '🟡' : '🟢'}</span>
            <span>{isMock ? 'Mode: Canned Mock' : 'Mode: Live Gateway'}</span>
          </button>

          {/* Active Guardian Profile & Switcher */}
          <div
            className="user-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.4rem 0.85rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '24px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: activeGuardianObj.avatarColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.75rem',
              }}
            >
              {activeGuardianObj.name.charAt(0)}
            </div>

            <select
              value={currentGuardian}
              onChange={(e) => handleGuardianChange(e.target.value)}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: 'none',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
              title="Switch guardian for multi-party testing"
            >
              {availableGuardians.map((g: GuardianUser) => (
                <option key={g.id} value={g.id} style={{ background: '#0f172a', color: '#fff' }}>
                  {g.name} ({g.role.split(' ')[0]})
                </option>
              ))}
            </select>

            <span
              style={{
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#fca5a5',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
              title="Simulated Guardian Session (TideCloak dev container is offline)"
            >
              MOCK LOGIN
            </span>
          </div>

          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
