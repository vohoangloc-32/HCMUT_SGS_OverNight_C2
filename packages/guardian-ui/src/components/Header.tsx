import React from 'react';

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
  return (
    <header className="header">
      <div className="header-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setCurrentTab('requests')}>
            <div className="brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v4"/>
                <path d="M12 16h.01"/>
              </svg>
            </div>
            <div>
              <div className="brand-title">Key-Holder Gateway</div>
              <div className="brand-subtitle">N-of-M Guardian Quorum</div>
            </div>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-link ${currentTab === 'requests' || currentTab === 'detail' ? 'active' : ''}`}
              onClick={() => setCurrentTab('requests')}
            >
              Action Requests
            </button>
            <button
              className={`nav-link ${currentTab === 'audit' ? 'active' : ''}`}
              onClick={() => setCurrentTab('audit')}
            >
              Audit Log
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Toggle mock mode */}
          <button
            onClick={toggleMock}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            title="Toggle between Live Gateway and Mock Dataset"
          >
            Mode: {isMock ? '🟡 Canned Mock' : '🟢 Live Gateway'}
          </button>

          {/* Active Guardian Switcher */}
          <div className="user-badge">
            <span className="guardian-dot"></span>
            <select
              value={currentGuardian}
              onChange={(e) => setCurrentGuardian(e.target.value)}
              style={{
                background: 'transparent',
                color: 'inherit',
                border: 'none',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
              title="Switch guardian for multi-party testing"
            >
              <option value="guardian-alice" style={{ background: '#101622', color: '#fff' }}>Alice (Guardian #1)</option>
              <option value="guardian-bob" style={{ background: '#101622', color: '#fff' }}>Bob (Guardian #2)</option>
              <option value="guardian-carol" style={{ background: '#101622', color: '#fff' }}>Carol (Guardian #3)</option>
            </select>
          </div>

          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
