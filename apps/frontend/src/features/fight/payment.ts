/**
 * Bilan d'un paiement : la réserve d'énergie paie d'abord, puis chaque carte
 * recyclée rapporte 1 énergie. Le surplus n'est pas perdu, il reste en réserve.
 */
export function paymentBalance(
  cost: number,
  reserve: number,
  recycledCount: number,
): { missing: number; surplus: number } {
  const needed = Math.max(0, cost - reserve);
  return {
    missing: Math.max(0, needed - recycledCount),
    surplus: Math.max(0, recycledCount - needed),
  };
}
