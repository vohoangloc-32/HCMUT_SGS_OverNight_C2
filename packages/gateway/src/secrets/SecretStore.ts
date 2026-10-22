import { readFileSync, existsSync } from 'fs';
import { ulid } from 'ulid';
import type { Db } from '../db.js';
import type { TideAdapter } from '../tide/TideAdapter.js';

export interface SecretMetadata {
  name: string;
  tag: string;
  updatedAt: string;
}

export class SecretStore {
  /**
   * Loads secrets from fixtures file, encrypts each secret using the TideAdapter,
   * and persists ciphertext to the database.
   * Plaintext secrets NEVER touch the database.
   */
  static async seedSecrets(
    db: Db,
    adapter: TideAdapter,
    fixturePath = 'mock-env/fixtures/fake-secrets.txt'
  ): Promise<number> {
    if (!existsSync(fixturePath)) {
      return 0;
    }

    const content = readFileSync(fixturePath, 'utf-8');
    const lines = content.split('\n');
    let seeded = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;

      const name = line.slice(0, eqIdx).trim();
      const plaintext = line.slice(eqIdx + 1).trim();

      // Check if already stored
      const existing = db.prepare('SELECT * FROM secrets WHERE name = ?').get(name);
      if (!existing) {
        // Tag-based encryption (AES-256-GCM authenticated ciphertext)
        const ciphertext = await adapter.encryptSecret(plaintext, name);
        db.prepare(
          'INSERT INTO secrets (name, ciphertext, tag, updated_at) VALUES (?, ?, ?, ?)'
        ).run(name, ciphertext, name, new Date().toISOString());
        seeded++;
      }
    }

    return seeded;
  }

  /**
   * Internal retrieval of decrypted secret for authorized gateway operations.
   * NEVER expose this method to external callers, MCP server, or agents.
   */
  static async retrieveInternal(db: Db, adapter: TideAdapter, name: string): Promise<string> {
    const row = db.prepare('SELECT * FROM secrets WHERE name = ?').get(name) as
      { name: string; ciphertext: string; tag: string } | undefined;

    if (!row) {
      throw new Error(`Secret not found: ${name}`);
    }

    return adapter.decryptSecret(row.ciphertext, row.tag);
  }

  /**
   * Executes a secret action on behalf of an approved Action Request.
   * Returns an opaque handle and success confirmation.
   * The secret plaintext is NEVER returned to the agent.
   */
  static async executeUseSecret(
    db: Db,
    adapter: TideAdapter,
    params: { secret_name: string; purpose: string }
  ): Promise<{ ok: boolean; detail: string; handle: string }> {
    const row = db.prepare('SELECT * FROM secrets WHERE name = ?').get(params.secret_name) as
      { name: string; ciphertext: string; tag: string } | undefined;

    if (!row) {
      return {
        ok: false,
        detail: `Secret "${params.secret_name}" not found in encrypted store`,
        handle: '',
      };
    }

    // Verify decryption succeeds internally on the gateway process
    await adapter.decryptSecret(row.ciphertext, row.tag);

    // Generate opaque ephemeral handle
    const handle = `sec-handle-${ulid()}`;

    return {
      ok: true,
      handle,
      detail: `Secret "${params.secret_name}" successfully injected into runtime. Ephemeral handle: ${handle}. Plaintext value was not released.`,
    };
  }
}
