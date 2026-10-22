/**
 * Calculate discount percentage for a customer.
 *
 * Specification:
 *   - loyalty >= 50 → 15% discount
 *   - loyalty >= 20 → 10% discount
 *   - loyalty >= 5  →  5% discount
 *   - otherwise     →  0%
 *
 * BUG: The second threshold uses `> 20` instead of `>= 20`.
 *      calculateDiscount(20) returns 5 instead of 10.
 */
export function calculateDiscount(loyaltyPoints) {
  if (loyaltyPoints >= 50) {
    return 15;
  }
  if (loyaltyPoints > 20) {   // BUG: should be >= 20
    return 10;
  }
  if (loyaltyPoints >= 5) {
    return 5;
  }
  return 0;
}
