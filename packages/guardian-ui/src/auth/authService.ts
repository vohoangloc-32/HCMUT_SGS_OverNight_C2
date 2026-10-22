import type { GuardianUser, AuthSession, AuthService } from './types';

// Pre-configured guardian identities for the N-of-M quorum (2-of-3 default)
export const PRECONFIGURED_GUARDIANS: GuardianUser[] = [
  {
    id: 'guardian-alice',
    name: 'Alice Vance',
    role: 'Security Lead (Guardian #1)',
    email: 'alice@security.internal',
    avatarColor: '#6366f1',
  },
  {
    id: 'guardian-bob',
    name: 'Bob Chen',
    role: 'DevOps Engineer (Guardian #2)',
    email: 'bob@devops.internal',
    avatarColor: '#10b981',
  },
  {
    id: 'guardian-carol',
    name: 'Carol Martinez',
    role: 'Infra Lead (Guardian #3)',
    email: 'carol@infra.internal',
    avatarColor: '#f59e0b',
  },
];

const STORAGE_KEY = 'tidecloak_guardian_session';

class IsolatedAuthService implements AuthService {
  private currentSession: AuthSession;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();

  constructor() {
    this.currentSession = this.loadInitialSession();
  }

  private loadInitialSession(): AuthSession {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore localStorage errors
    }
    // Default to Alice for immediate UI presentation
    return this.createSession(PRECONFIGURED_GUARDIANS[0].id, false);
  }

  private createSession(guardianId: string, simulateOidc: boolean): AuthSession {
    const user =
      PRECONFIGURED_GUARDIANS.find((g) => g.id === guardianId) ?? PRECONFIGURED_GUARDIANS[0];
    const simulatedJwt = `fake-tidecloak-jwt.${btoa(
      JSON.stringify({
        sub: user.id,
        name: user.name,
        role: 'guardian',
        iat: Math.floor(Date.now() / 1000),
        iss: 'tidecloak:mock-realm',
      })
    )}.fake-signature`;

    return {
      user,
      token: simulateOidc ? simulatedJwt : `mock-token-${user.id}`,
      isSimulated: true,
    };
  }

  getCurrentSession(): AuthSession {
    return this.currentSession;
  }

  getAuthToken(): string {
    return this.currentSession.token;
  }

  listAvailableGuardians(): GuardianUser[] {
    return PRECONFIGURED_GUARDIANS;
  }

  async login(guardianId: string, simulateOidc: boolean = false): Promise<AuthSession> {
    const session = this.createSession(guardianId, simulateOidc);
    this.currentSession = session;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // LocalStorage error fallback
    }
    this.notify();
    return session;
  }

  async logout(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // LocalStorage error fallback
    }
    this.notify();
  }

  onAuthStateChanged(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentSession);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.currentSession);
    }
  }
}

// Singleton instance providing the isolated boundary
export const authService: AuthService = new IsolatedAuthService();
