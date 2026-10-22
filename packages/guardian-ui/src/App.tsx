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
import { authService, type AuthSession } from './auth';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { PendingRequests } from './pages/PendingRequests';
import { RequestDetail } from './pages/RequestDetail';
import { AuditLog } from './pages/AuditLog';
import { ProtectedRepoPanel } from './components/ProtectedRepoPanel';

export const App: React.FC = () => {
  const [session, setSession] = useState<AuthSession>(authService.getCurrentSession());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<'requests' | 'audit' | 'detail' | 'repo'>('requests');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [decisionCount, setDecisionCount] = useState<number>(0);

  const [actions, setActions] = useState<ActionRequest[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionRequest | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isMock, setIsMock] = useState<boolean>(isMockModeActive());
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    return authService.onAuthStateChanged((newSession) => {
      if (newSession) {
        setSession(newSession);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [actionsRes, auditRes] = await Promise.all([fetchActions(), fetchAudit()]);
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
    const timer = setInterval(() => {
      loadData();
    }, 6000);
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
    const res = await approveAction(id, session.user.id, hash);
    if (res.success) {
      setDecisionCount((c) => c + 1);
      setNotification({
        message: `✓ Approved action ${id.slice(0, 10)}... by ${session.user.name} (${session.user.role.split(' ')[0]})`,
        type: 'success',
      });
      setTimeout(() => setNotification(null), 5000);
      await loadData();
      if (res.data) {
        setSelectedAction(res.data);
      }
    } else {
      setNotification({
        message: `Approval failed: [${res.errorCode ?? 'ERROR'}] ${res.error}`,
        type: 'error',
      });
      setTimeout(() => setNotification(null), 7000);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    const res = await rejectAction(id, session.user.id, reason);
    if (res.success) {
      setDecisionCount((c) => c + 1);
      setNotification({
        message: `Action ${id.slice(0, 10)}... was rejected by ${session.user.name}.`,
        type: 'info',
      });
      setTimeout(() => setNotification(null), 5000);
      await loadData();
      if (res.data) {
        setSelectedAction(res.data);
      }
    } else {
      setNotification({
        message: `Rejection failed: [${res.errorCode ?? 'ERROR'}] ${res.error}`,
        type: 'error',
      });
      setTimeout(() => setNotification(null), 7000);
    }
  };

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(guardianId) => {
          authService.login(guardianId);
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
        currentGuardian={session.user.id}
        setCurrentGuardian={async (newId) => {
          await authService.login(newId);
        }}
        isMock={isMock}
        toggleMock={handleToggleMock}
        onLogout={async () => {
          await authService.logout();
          setIsAuthenticated(false);
        }}
      />

      <main className="main-content">
        {/* Mock mode banner */}
        {isMock && (
          <div
            className="banner banner-mock"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <div>
              <strong>🟡 Demo Mock Mode Active:</strong> Consuming canned mock dataset. Actions and
              audit events operate deterministically in-memory.
            </div>
            <button
              onClick={handleToggleMock}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'inherit',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              Connect to Live Gateway
            </button>
          </div>
        )}

        {/* Global Notification Banner */}
        {notification && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              marginBottom: '1.25rem',
              borderRadius: '8px',
              background:
                notification.type === 'success'
                  ? 'rgba(16, 185, 129, 0.15)'
                  : notification.type === 'error'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
              border: `1px solid ${
                notification.type === 'success'
                  ? '#10b981'
                  : notification.type === 'error'
                    ? '#ef4444'
                    : '#3b82f6'
              }`,
              color:
                notification.type === 'success'
                  ? '#10b981'
                  : notification.type === 'error'
                    ? '#f87171'
                    : '#60a5fa',
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>{notification.message}</div>
            <button
              onClick={() => setNotification(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ✕
            </button>
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

        {currentTab === 'detail' && (
          <RequestDetail
            action={selectedAction}
            currentGuardian={session.user.id}
            loading={loading && !selectedAction}
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

        {currentTab === 'repo' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1
                style={{
                  fontSize: '1.85rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  marginBottom: '0.35rem',
                }}
              >
                Protected Repository Log
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Verifiable commit history of the protected repository. Changes appear only after 2-of-2 guardian approval and passing automated test suite.
              </p>
            </div>
            <ProtectedRepoPanel refreshTrigger={decisionCount} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
