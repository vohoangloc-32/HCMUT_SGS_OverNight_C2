import { TideAdapterReal } from './TideAdapterReal.js';

describe('TideAdapterReal', () => {
  const adapter = new TideAdapterReal({
    encryptionKey: 'test-secret-key-for-testing-12345',
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
    test('handles mock dev tokens with guardian role', async () => {
      const payload = await adapter.verifyJwt('Bearer mock:alice:guardian');
      expect(payload.sub).toBe('alice');
      expect(adapter.isGuardian(payload)).toBe(true);
    });

    test('identifies non-guardian roles', async () => {
      const payload = await adapter.verifyJwt('Bearer mock:charlie:viewer');
      expect(payload.sub).toBe('charlie');
      expect(adapter.isGuardian(payload)).toBe(false);
    });

    test('handles UI mock-token- format', async () => {
      const payload = await adapter.verifyJwt('Bearer mock-token-guardian-carol');
      expect(payload.sub).toBe('guardian-carol');
      expect(adapter.isGuardian(payload)).toBe(true);
    });

    test('handles UI simulated JWT format', async () => {
      const b64 = Buffer.from(
        JSON.stringify({ sub: 'guardian-bob', role: 'guardian' })
      ).toString('base64');
      const payload = await adapter.verifyJwt(`Bearer fake-tidecloak-jwt.${b64}.fake-sig`);
      expect(payload.sub).toBe('guardian-bob');
      expect(adapter.isGuardian(payload)).toBe(true);
    });

    test('rejects empty or missing token', async () => {
      await expect(adapter.verifyJwt('')).rejects.toThrow('Missing authentication token');
    });
  });
});
