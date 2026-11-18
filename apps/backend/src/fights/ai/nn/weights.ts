// apps/backend/src/fights/ai/nn/weights.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_DIM, ENCODING_VERSION, GLOBAL_DIM, SET_NAMES } from './encode';
import type { CompactPosition } from './encode';

export const EMBED_DIM = 8;
export const CARD_HIDDEN = 64;
export const CARD_OUT = 32;
export const HEAD_HIDDEN = 128;

/** Couche linéaire au format PyTorch : w[sortie][entrée]. */
export interface DenseLayer {
  w: number[][];
  b: number[];
}

/** Positions et sorties PyTorch figées à l'export : l'inférence TS doit les retrouver. */
export interface ParityBlock {
  /** `x` des cartes statiques utilisées, par id. */
  cards: Record<string, number[]>;
  positions: CompactPosition[];
  values: number[];
}

export interface NnWeights {
  encodingVersion: number;
  generation: number;
  trainedAt: string;
  /** Positions d'entraînement. */
  positions: number;
  /** Perte MSE de validation. */
  valLoss: number;
  /** id de carte → ligne de l'embedding (0 : carte inconnue). */
  cardIndex: Record<string, number>;
  layers: {
    emb: number[][];
    card1: DenseLayer;
    card2: DenseLayer;
    head1: DenseLayer;
    head2: DenseLayer;
    out: DenseLayer;
  };
  parity?: ParityBlock;
}

/** Champion déployé ; copié dans dist par nest-cli (assets). */
export const CHAMPION_PATH = join(__dirname, 'weights', 'champion.json');

/** Lève si les poids ne correspondent pas à l'encodage ou au réseau actuels. */
export function validateWeights(w: NnWeights): void {
  const who = `Poids génération ${w.generation}`;
  if (w.encodingVersion !== ENCODING_VERSION)
    throw new Error(
      `${who} : encodage ${w.encodingVersion}, attendu ${ENCODING_VERSION}, il faut réentraîner`,
    );
  const check = (name: string, l: DenseLayer, out: number, inp: number) => {
    if (
      l.b.length !== out ||
      l.w.length !== out ||
      l.w.some((row) => row.length !== inp)
    )
      throw new Error(
        `${who} : couche ${name} de taille inattendue (attendu ${out}×${inp})`,
      );
  };
  check('card1', w.layers.card1, CARD_HIDDEN, CARD_DIM + EMBED_DIM);
  check('card2', w.layers.card2, CARD_OUT, CARD_HIDDEN);
  check(
    'head1',
    w.layers.head1,
    HEAD_HIDDEN,
    GLOBAL_DIM + SET_NAMES.length * CARD_OUT,
  );
  check('head2', w.layers.head2, HEAD_HIDDEN, HEAD_HIDDEN);
  check('out', w.layers.out, 1, HEAD_HIDDEN);
  const rows = w.layers.emb.length;
  if (rows === 0 || w.layers.emb.some((row) => row.length !== EMBED_DIM))
    throw new Error(`${who} : embedding de taille inattendue`);
  for (const [id, row] of Object.entries(w.cardIndex))
    if (!Number.isInteger(row) || row < 1 || row >= rows)
      throw new Error(
        `${who} : carte ${id} hors de l'embedding (ligne ${row})`,
      );
}

export function readWeights(path: string): NnWeights {
  const w = JSON.parse(readFileSync(path, 'utf8')) as NnWeights;
  validateWeights(w);
  return w;
}

/** Le champion, ou la raison pour laquelle il est inutilisable. */
export function loadChampion(
  path: string = CHAMPION_PATH,
): { weights: NnWeights } | { reason: string } {
  if (!existsSync(path)) return { reason: `fichier absent (${path})` };
  try {
    return { weights: readWeights(path) };
  } catch (err) {
    return { reason: err instanceof Error ? err.message : String(err) };
  }
}
