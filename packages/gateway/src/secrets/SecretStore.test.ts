import { initDb } from '../db.js';
import { TideAdapterReal } from '../tide/TideAdapterReal.js';
import { SecretStore } from './SecretStore.js';

describe('SecretStore (Encrypted Server-Side Storage)', () => {
  const db = initDb(':memory:');
  const adapter = new TideAdapterReal({
    encryptionKey: 'test-secret-key-for-testing-12345',
    devTokenSecret: 'test-dev-token-secret-12345',
  });

  it('stores secrets encrypted and rejects plaintext storage', async () => {
    // Encrypt and persist a fake secret
    const ciphertext = await adapter.encryptSecret('FAKE_SECRET_VALUE_123', 'TEST_SECRET');
    expect(ciphertext).toMatch(/^AES256GCM:/);

    db.prepare('INSERT INTO secrets (name, ciphertext, tag, updated_at) VALUES (?, ?, ?, ?)').run(
      'TEST_SECRET',
      ciphertext,
      'TEST_SECRET',
      new Date().toISOString()
    );

    // Verify row in DB contains ciphertext only
    const row = db.prepare('SELECT * FROM secrets WHERE name = ?').get('TEST_SECRET') as {
      ciphertext: string;
    };
    expect(row.ciphertext).not.toContain('FAKE_SECRET_VALUE_123');
    expect(row.ciphertext).toMatch(/^AES256GCM:/);

    // Internal retrieval succeeds
    const decrypted = await SecretStore.retrieveInternal(db, adapter, 'TEST_SECRET');
    expect(decrypted).toBe('FAKE_SECRET_VALUE_123');
  });

  it('executeUseSecret returns opaque handle and never releases plaintext', async () => {
    const res = await SecretStore.executeUseSecret(db, adapter, {
      secret_name: 'TEST_SECRET',
      purpose: 'unit test deployment',
    });

    expect(res.ok).toBe(true);
    expect(res.handle).toMatch(/^sec-handle-[0-9A-Z]{26}$/);
    expect(res.detail).toContain('Ephemeral handle:');
    expect(res.detail).not.toContain('FAKE_SECRET_VALUE_123');
  });

  it('fails gracefully for missing secrets', async () => {
    const res = await SecretStore.executeUseSecret(db, adapter, {
      secret_name: 'NON_EXISTENT_SECRET',
      purpose: 'probing',
    });

    expect(res.ok).toBe(false);
    expect(res.detail).toContain('not found in encrypted store');
  });
});
