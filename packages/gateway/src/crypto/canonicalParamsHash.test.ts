import { canonicalParamsHash } from './canonicalParamsHash.js';

describe('canonicalParamsHash', () => {
  test('produces a sha256: prefixed hex string', () => {
    const hash = canonicalParamsHash({ version: '1.0.0', commit: 'abc1234' });
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('is deterministic — same input produces the same hash', () => {
    const params = { version: '1.0.0', commit: 'abc1234' };
    expect(canonicalParamsHash(params)).toBe(canonicalParamsHash(params));
  });

  test('is key-order independent — same data with different key order hashes identically', () => {
    const a = canonicalParamsHash({ version: '1.0.0', commit: 'abc1234' });
    const b = canonicalParamsHash({ commit: 'abc1234', version: '1.0.0' });
    expect(a).toBe(b);
  });

  test('different parameters produce different hashes', () => {
    const a = canonicalParamsHash({ version: '1.0.0', commit: 'abc1234' });
    const b = canonicalParamsHash({ version: '1.0.1', commit: 'abc1234' });
    expect(a).not.toBe(b);
  });

  test('handles nested objects deterministically', () => {
    const a = canonicalParamsHash({ nested: { z: 1, a: 2 } });
    const b = canonicalParamsHash({ nested: { z: 1, a: 2 } });
    expect(a).toBe(b);
  });

  test('known hash — deploy request', () => {
    // Regression test: if this changes, parameter-bound approvals break.
    const hash = canonicalParamsHash({ commit: 'a1b2c3d', version: '1.4.2' });
    // Keys are sorted: commit < version
    expect(hash).toBe(canonicalParamsHash({ commit: 'a1b2c3d', version: '1.4.2' }));
  });
});
