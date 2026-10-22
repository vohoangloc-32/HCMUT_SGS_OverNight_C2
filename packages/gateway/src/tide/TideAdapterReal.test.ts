import { TideAdapterReal, createDevToken } from './TideAdapterReal.js';

describe('TideAdapterReal', () => {
  const devTokenSecret = 'test-dev-token-secret-12345';
  const adapter = new TideAdapterReal({
    encryptionKey: 'test-secret-key-for-testing-12345',
    devTokenSecret,
  });

  describe('Secret encryption / decryption (AES-256-GCM)', () => {
    test('encrypts plaintext into AES256GCM format', async () => {
      const plaintext = 'MY_SUPER_SECRET_TOKEN_9999';
      const ciphertext = await adapter.encryptSecret(plaintext, 'database-secret');

      expect(ciphertext).toMatch(/^AES256GCM:[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+:database-secret$/);
      expect(ciphertext).not.toContain(plaintext);
    });

    test('decrypts ciphertext back to original plaintext', async () => {
      const plaintext = 'DATABASE_CREDENTIALS_PASSWORD_XYZ';
      const ciphertext = await adapter.encryptSecret(plaintext, 'prod-tag');
      const decrypted = await adapter.decryptSecret(ciphertext, 'prod-tag');

      expect(decrypted).toBe(plaintext);
    });

    test('fails to decrypt if ciphertext was tampered with', async () => {
      const ciphertext = await adapter.encryptSecret('important-data', 'tag');
      const parts = ciphertext.split(':');
      // Tamper with encrypted data payload
      parts[3] = parts[3].slice(0, -2) + 'ff';
      const tampered = parts.join(':');

      await expect(adapter.decryptSecret(tampered, 'tag')).rejects.toThrow();
    });

    test('decrypts legacy FAKE_ENCRYPTED payloads for backwards compatibility', async () => {
      const legacy = 'FAKE_ENCRYPTED:' + Buffer.from('legacy-secret').toString('base64');
      const decrypted = await adapter.decryptSecret(legacy, 'any');
      expect(decrypted).toBe('legacy-secret');
    });
  });

  describe('JWT Verification & Guardian Role', () => {
    test('verifies valid dev token with guardian role', async () => {
      const token = await createDevToken('alice', 'guardian', devTokenSecret);
      const payload = await adapter.verifyJwt(`Bearer ${token}`);
      expect(payload.sub).toBe('alice');
      expect(adapter.isGuardian(payload)).toBe(true);
    });

    test('identifies non-guardian roles', async () => {
      const token = await createDevToken('charlie', 'viewer', devTokenSecret);
      const payload = await adapter.verifyJwt(`Bearer ${token}`);
      expect(payload.sub).toBe('charlie');
      expect(adapter.isGuardian(payload)).toBe(false);
    });

    test('rejects forged token / wrong signature', async () => {
      const forgedToken = await createDevToken('alice', 'guardian', 'forged-attacker-key');
      await expect(adapter.verifyJwt(`Bearer ${forgedToken}`)).rejects.toThrow();
    });

    test('rejects empty or missing token', async () => {
      await expect(adapter.verifyJwt('')).rejects.toThrow('Missing authentication token');
    });

    test('constructor fails if ENCRYPTION_KEY is missing', () => {
      const oldKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      try {
        expect(() => new TideAdapterReal({ devTokenSecret: 'secret' })).toThrow(
          /ENCRYPTION_KEY environment variable is required/
        );
      } finally {
        if (oldKey) process.env.ENCRYPTION_KEY = oldKey;
      }
    });

    test('constructor fails if DEV_TOKEN_SECRET is missing and no TideCloak config', () => {
      const oldSecret = process.env.DEV_TOKEN_SECRET;
      delete process.env.DEV_TOKEN_SECRET;
      try {
        expect(
          () => new TideAdapterReal({ encryptionKey: 'some-key' })
        ).toThrow(/DEV_TOKEN_SECRET environment variable is required/);
      } finally {
        if (oldSecret) process.env.DEV_TOKEN_SECRET = oldSecret;
      }
    });
  });
});
