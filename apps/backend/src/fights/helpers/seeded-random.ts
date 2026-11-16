/** mulberry32 : générateur déterministe. */
export function seeded(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** `Math.random` figé le temps de `f` : le moteur mélange avec lui. */
export function withRandom<T>(seed: number, f: () => T): T {
  const real = Math.random;
  Math.random = seeded(seed);
  try {
    return f();
  } finally {
    Math.random = real;
  }
}
