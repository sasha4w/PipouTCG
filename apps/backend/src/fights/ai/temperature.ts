/**
 * Tire un élément avec une probabilité proportionnelle à
 * exp((score - meilleur) / température). Température ≤ 0, un seul élément ou
 * meilleur score infini : le premier meilleur, sans consommer `random`.
 * Un score non fini (−Infinity) n'est jamais tiré.
 */
export function pickSoftmax<T>(
  items: readonly T[],
  score: (item: T) => number,
  temperature: number,
  random: () => number,
): T {
  if (items.length === 0) throw new Error('pickSoftmax : aucun élément');
  let best = items[0];
  for (const item of items) if (score(item) > score(best)) best = item;
  const top = score(best);
  if (temperature <= 0 || items.length === 1 || !Number.isFinite(top))
    return best;
  const weights = items.map((item) => {
    const s = score(item);
    return Number.isFinite(s) ? Math.exp((s - top) / temperature) : 0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let rest = random() * total;
  for (let k = 0; k < items.length; k++) {
    rest -= weights[k];
    if (rest < 0) return items[k];
  }
  return best;
}
