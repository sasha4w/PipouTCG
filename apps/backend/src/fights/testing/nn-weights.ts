// apps/backend/src/fights/testing/nn-weights.ts
import {
  CARD_DIM,
  ENCODING_VERSION,
  GLOBAL_DIM,
  SET_NAMES,
} from '../ai/nn/encode';
import {
  CARD_HIDDEN,
  CARD_OUT,
  EMBED_DIM,
  HEAD_HIDDEN,
} from '../ai/nn/weights';
import type { DenseLayer, NnWeights } from '../ai/nn/weights';

/** Générateur déterministe (mulberry32), sans dépendre du moteur. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Poids aléatoires de forme valide (tests). Ligne 0 de l'embedding : carte inconnue, à 0. */
export function randomWeights(
  seed: number,
  cardIds: number[] = [],
  scale = 0.1,
): NnWeights {
  const r = mulberry32(seed);
  const v = () => (r() * 2 - 1) * scale;
  const dense = (out: number, inp: number): DenseLayer => ({
    w: Array.from({ length: out }, () => Array.from({ length: inp }, v)),
    b: Array.from({ length: out }, v),
  });
  return {
    encodingVersion: ENCODING_VERSION,
    generation: 0,
    trainedAt: 'test',
    positions: 0,
    valLoss: 0,
    cardIndex: Object.fromEntries(cardIds.map((id, k) => [String(id), k + 1])),
    layers: {
      emb: [
        new Array<number>(EMBED_DIM).fill(0),
        ...cardIds.map(() => Array.from({ length: EMBED_DIM }, v)),
      ],
      card1: dense(CARD_HIDDEN, CARD_DIM + EMBED_DIM),
      card2: dense(CARD_OUT, CARD_HIDDEN),
      head1: dense(HEAD_HIDDEN, GLOBAL_DIM + SET_NAMES.length * CARD_OUT),
      head2: dense(HEAD_HIDDEN, HEAD_HIDDEN),
      out: dense(1, HEAD_HIDDEN),
    },
  };
}

export function zeroWeights(cardIds: number[] = []): NnWeights {
  return randomWeights(0, cardIds, 0);
}
