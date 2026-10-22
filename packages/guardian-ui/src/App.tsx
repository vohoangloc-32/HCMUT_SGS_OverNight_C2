import React, { useState, useEffect, useCallback } from 'react';
import type { ActionRequest, AuditEvent } from '@key-holder/shared';
import {
  fetchActions,
  fetchAudit,
  fetchActionById,
  approveAction,
  rejectAction,
  setForceMock,
  isMockModeActive,
} from './api';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { PendingRequests } from './pages/PendingRequests';
import { RequestDetail } from './pages/RequestDetail';
import { AuditLog } from './pages/AuditLog';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentGuardian, setCurrentGuardian] = useState<string>('guardian-alice');
  const [currentTab, setCurrentTab] = useState<'requests' | 'audit' | 'detail'>('requests');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const [actions, setActions] = useState<ActionRequest[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionRequest | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isMock, setIsMock] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [actionsRes, auditRes] = await Promise.all([
        fetchActions(),
        fetchAudit(),
      ]);
      setActions(actionsRes.data);
      setAuditEvents(auditRes.data);
      setIsMock(actionsRes.isMock);

      if (selectedActionId) {
        const actionRes = await fetchActionById(selectedActionId);
        setSelectedAction(actionRes.data);
      }
    } catch (err: unknown) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedActionId]);

  useEffect(() => {
    loadData();
    // Refresh periodically
    const timer = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleToggleMock = () => {
    const nextMock = !isMockModeActive();
    setForceMock(nextMock);
    setIsMock(nextMock);
    loadData();
  };

  const handleSelectAction = async (id: string) => {
    setSelectedActionId(id);
    setLoading(true);
    try {
      const res = await fetchActionById(id);
      setSelectedAction(res.data);
      setCurrentTab('detail');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, hash: string) => {
    const res = await approveAction(id, currentGuardian, hash);
    if (res.success) {
      setNotification(`✓ Approved action ${id.slice(0, 8)}... by ${currentGuardian}`);
      setTimeout(() => setNotification(null), 4000);
      await loadData();
      if (res.data) {
        setSelectedAction(res.data);
      }
    } else {
      alert(`Approval failed: ${res.error}`);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    const res = await rejectAction(id, currentGuardian, reason);
    if (res.success) {
      setNotification(`Action ${id.slice(0, 8)}... was rejected.`);
      setTimeout(() => setNotification(null), 4000);
      await loadData();
      if (res.data) {
        setSelectedAction(res.data);
      }
    } else {
      alert(`Rejection failed: ${res.error}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(guardianId) => {
          setCurrentGuardian(guardianId);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="app-container">
      <Header
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setSelectedActionId(null);
        }}
        currentGuardian={currentGuardian}
        setCurrentGuardian={setCurrentGuardian}
        isMock={isMock}
        toggleMock={handleToggleMock}
        onLogout={() => setIsAuthenticated(false)}
      />

      <main className="main-content">
        {/* Mock mode banner */}
        {isMock && (
          <div className="banner banner-mock">
            <div>
              <strong>🟡 Running in Demo Mock Mode:</strong> Using pre-seeded canned requests and audit events because the live Gateway is either not running or Mock Mode is toggled.
            </div>
            <button
              onClick={handleToggleMock}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: 'inherit',
                padding: '0.25rem 0.6rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Try Live Gateway
            </button>
          </div>
        )}

        {/* Global Notification Banner */}
        {notification && (
          <div
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#10b981',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            {notification}
          </div>
        )}

        {currentTab === 'requests' && (
          <PendingRequests
            actions={actions}
            loading={loading}
            onSelectAction={handleSelectAction}
            onRefresh={loadData}
          />
        )}

        {currentTab === 'detail' && selectedAction && (
          <RequestDetail
            action={selectedAction}
            currentGuardian={currentGuardian}
            onBack={() => setCurrentTab('requests')}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {currentTab === 'audit' && (
          <AuditLog
            events={auditEvents}
            loading={loading}
            onRefresh={loadData}
            onSelectAction={handleSelectAction}
          />
        )}
      </main>
    </div>
  );
};
export default App;
