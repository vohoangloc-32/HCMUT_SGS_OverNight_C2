export interface GuardianUser {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarColor: string;
}

export interface AuthSession {
  user: GuardianUser;
  token: string;
  isSimulated: boolean;
}

export interface AuthService {
  getCurrentSession(): AuthSession;
  login(guardianId: string, simulateOidc?: boolean): Promise<AuthSession>;
  logout(): Promise<void>;
  listAvailableGuardians(): GuardianUser[];
  getAuthToken(): string;
  onAuthStateChanged(callback: (session: AuthSession | null) => void): () => void;
}
