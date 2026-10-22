import { calculateDiscount } from './discount.js';
import { strict as assert } from 'assert';
import { describe, it } from 'node:test';

describe('calculateDiscount', () => {
  it('returns 0 for loyalty below 5', () => {
    assert.equal(calculateDiscount(0), 0);
    assert.equal(calculateDiscount(4), 0);
  });

  it('returns 5% for loyalty 5-19', () => {
    assert.equal(calculateDiscount(5), 5);
    assert.equal(calculateDiscount(19), 5);
  });

  it('returns 10% for loyalty 20-49', () => {
    assert.equal(calculateDiscount(20), 10, 'loyalty=20 should give 10% discount');
    assert.equal(calculateDiscount(30), 10);
    assert.equal(calculateDiscount(49), 10);
  });

  it('returns 15% for loyalty >= 50', () => {
    assert.equal(calculateDiscount(50), 15);
    assert.equal(calculateDiscount(100), 15);
  });
});
