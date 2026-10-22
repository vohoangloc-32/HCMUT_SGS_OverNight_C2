import { createLocalJWKSet, jwtVerify, SignJWT } from 'jose';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import type { TideAdapter, TideJwtPayload } from './TideAdapter.js';

export interface TideCloakAdapterConfig {
  realm: string;
  'auth-server-url': string;
  resource: string;
  credentials?: { secret?: string };
  jwk?: { keys: Record<string, unknown>[] };
}

export async function createDevToken(
  userId: string,
  role: string = 'guardian',
  secretKeyString: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secretKeyString);
  return new SignJWT({
    sub: userId,
    email: `${userId}@dev.local`,
    realm_access: { roles: [role] },
    azp: 'gateway-client',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('key-holder-dev-gateway')
    .setExpirationTime('1h')
    .sign(secretKey);
}

export class TideAdapterReal implements TideAdapter {
  private config: TideCloakAdapterConfig | null = null;
  private jwks: ReturnType<typeof createLocalJWKSet> | null = null;
  private encryptionKey: Buffer;
  private guardianRole: string;
  private devTokenSecret: string | null = null;

  constructor(options?: {
    config?: TideCloakAdapterConfig;
    adapterPath?: string;
    encryptionKey?: string;
    guardianRole?: string;
    devTokenSecret?: string;
  }) {
    this.guardianRole = options?.guardianRole ?? process.env.GUARDIAN_ROLE ?? 'guardian';

    // Derive 32-byte key for AES-256-GCM secret encryption (no fallback seed allowed).
    const secretSeed = options?.encryptionKey ?? process.env.ENCRYPTION_KEY;
    if (!secretSeed) {
      throw new Error(
        'FATAL: ENCRYPTION_KEY environment variable is required for secret storage. Refusing to start without it.'
      );
    }
    this.encryptionKey = createHash('sha256').update(secretSeed).digest();

    if (options?.config) {
      this.loadConfig(options.config);
    } else {
      this.initFromEnv(options?.adapterPath);
    }

    this.devTokenSecret = options?.devTokenSecret ?? process.env.DEV_TOKEN_SECRET ?? null;

    if (!this.jwks && !this.devTokenSecret) {
      throw new Error(
        'FATAL: DEV_TOKEN_SECRET environment variable is required when TideCloak is not configured.'
      );
    }

    if (!this.jwks && this.devTokenSecret) {
      console.warn('⚠️  DEV TOKENS ACTIVE: not Tide identity');
    }
  }

  private initFromEnv(customPath?: string) {
    const filePath =
      customPath ?? process.env.TIDECLOAK_ADAPTER_FILE ?? process.env.TIDECLOAK_CONFIG_PATH;

    if (filePath && existsSync(filePath)) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        this.loadConfig(JSON.parse(raw));
        return;
      } catch (err) {
        console.warn(`[TideAdapterReal] Failed to load adapter file from ${filePath}:`, err);
      }
    }

    if (process.env.TIDECLOAK_ADAPTER_JSON) {
      try {
        this.loadConfig(JSON.parse(process.env.TIDECLOAK_ADAPTER_JSON));
        return;
      } catch (err) {
        console.warn('[TideAdapterReal] Failed to parse TIDECLOAK_ADAPTER_JSON:', err);
      }
    }

    if (process.env.TIDECLOAK_ADAPTER_B64) {
      try {
        const raw = Buffer.from(process.env.TIDECLOAK_ADAPTER_B64, 'base64').toString('utf-8');
        this.loadConfig(JSON.parse(raw));
        return;
      } catch (err) {
        console.warn('[TideAdapterReal] Failed to parse TIDECLOAK_ADAPTER_B64:', err);
      }
    }
  }

  private loadConfig(config: TideCloakAdapterConfig) {
    this.config = config;
    if (config.jwk && Array.isArray(config.jwk.keys) && config.jwk.keys.length > 0) {
      // Local JWKS verification per canon/feature-mapping (I-04)
      this.jwks = createLocalJWKSet(
        config.jwk as unknown as Parameters<typeof createLocalJWKSet>[0]
      );
    }
  }

  async verifyJwt(token: string): Promise<TideJwtPayload> {
    if (!token) throw new Error('Missing authentication token');

    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) throw new Error('Missing authentication token');

    // 1. Live TideCloak JWKS mode
    if (this.jwks && this.config) {
      const issuer = `${this.config['auth-server-url'].replace(/\/+$/, '')}/realms/${this.config.realm}`;
      const { payload } = await jwtVerify(cleanToken, this.jwks, {
        issuer,
      });

      if (this.config.resource && payload.azp && payload.azp !== this.config.resource) {
        throw new Error(`Token azp mismatch: expected ${this.config.resource}, got ${payload.azp}`);
      }

      return {
        sub: (payload.sub as string) ?? 'unknown',
        email: (payload.email as string) ?? undefined,
        realm_access: payload.realm_access as { roles: string[] } | undefined,
        resource_access: payload.resource_access as Record<string, { roles: string[] }> | undefined,
        azp: (payload.azp as string) ?? undefined,
        exp: (payload.exp as number) ?? 0,
        iat: (payload.iat as number) ?? 0,
      };
    }

    // 2. DEV token mode: support mock tokens or verify cryptographically signed token with DEV_TOKEN_SECRET
    if (this.devTokenSecret) {
      if (cleanToken.startsWith('mock-token-')) {
        const guardianId = cleanToken.replace(/^mock-token-/, '');
        return {
          sub: guardianId,
          email: `${guardianId}@dev.local`,
          realm_access: { roles: [this.guardianRole] },
          azp: 'gateway-client',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        };
      }
      if (cleanToken.startsWith('mock:')) {
        const parts = cleanToken.split(':');
        const userId = parts[1] ?? 'mock-user';
        const role = parts[2] ?? this.guardianRole;
        return {
          sub: userId,
          email: `${userId}@dev.local`,
          realm_access: { roles: [role] },
          azp: 'gateway-client',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        };
      }

      const secretBytes = new TextEncoder().encode(this.devTokenSecret);
      const { payload } = await jwtVerify(cleanToken, secretBytes, {
        issuer: 'key-holder-dev-gateway',
      });

      return {
        sub: (payload.sub as string) ?? 'unknown',
        email: (payload.email as string) ?? undefined,
        realm_access: payload.realm_access as { roles: string[] } | undefined,
        resource_access: payload.resource_access as Record<string, { roles: string[] }> | undefined,
        azp: (payload.azp as string) ?? undefined,
        exp: (payload.exp as number) ?? 0,
        iat: (payload.iat as number) ?? 0,
      };
    }

    throw new Error(
      'TideCloak JWKS adapter configuration not loaded and DEV_TOKEN_SECRET not configured.'
    );
  }

  isGuardian(payload: TideJwtPayload): boolean {
    const roles: string[] = [];

    if (payload.realm_access?.roles) {
      roles.push(...payload.realm_access.roles);
    }

    if (this.config?.resource && payload.resource_access?.[this.config.resource]?.roles) {
      roles.push(...payload.resource_access[this.config.resource].roles);
    }

    // Default alias matches
    const acceptedRoles = [this.guardianRole, 'gateway-guardian', 'guardian'];
    return roles.some((r) => acceptedRoles.includes(r));
  }

  async encryptSecret(plaintext: string, tag: string): Promise<string> {
    // TC-04 Fallback: AES-256-GCM authenticated encryption for server-side secret store
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `AES256GCM:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}:${tag}`;
  }

  async decryptSecret(ciphertext: string, _tag: string): Promise<string> {
    if (ciphertext.startsWith('FAKE_ENCRYPTED:')) {
      const b64 = ciphertext.replace('FAKE_ENCRYPTED:', '');
      return Buffer.from(b64, 'base64').toString('utf8');
    }

    if (!ciphertext.startsWith('AES256GCM:')) {
      throw new Error('Invalid ciphertext format: missing AES256GCM prefix');
    }

    const parts = ciphertext.split(':');
    if (parts.length < 5) {
      throw new Error('Malformed ciphertext payload');
    }

    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encryptedData = Buffer.from(parts[3], 'hex');

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string; mode: string }> {
    if (this.config && this.jwks) {
      return {
        ok: true,
        mode: 'tidecloak',
        detail: `Configured for realm "${this.config.realm}" at ${this.config['auth-server-url']}`,
      };
    }
    if (this.devTokenSecret) {
      return {
        ok: true,
        mode: 'dev-tokens',
        detail: 'DEV TOKENS ACTIVE: not Tide identity (HMAC-SHA256 tokens via DEV_TOKEN_SECRET)',
      };
    }
    return { ok: false, mode: 'unconfigured', detail: 'TideCloak adapter not configured' };
  }
}
