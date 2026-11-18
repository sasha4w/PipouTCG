/** Intervalle de Wilson (95 % par défaut) d'une proportion de succès. */
export function wilson(
  successes: number,
  n: number,
  z = 1.96,
): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { lower: (center - margin) / denom, upper: (center + margin) / denom };
}
