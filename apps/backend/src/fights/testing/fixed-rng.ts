import type { Rng } from '../engine/rng';

/** Hasard figé : aucun mélange ; p1 commence sauf indication contraire. */
export function fixedRng(opts: { p1Starts?: boolean } = {}): Rng {
  return {
    shuffle: <T>(arr: T[]) => arr,
    coinFlip: () => opts.p1Starts ?? true,
  };
}
