// apps/backend/src/fights/ai/nn/mlp.ts
import {
  CARD_DIM,
  GLOBAL_DIM,
  SET_NAMES,
  SET_SCALE,
  expandPosition,
  isStaticCard,
} from './encode';
import type { EncodedCard, EncodedPosition } from './encode';
import { CARD_OUT, EMBED_DIM } from './weights';
import type { DenseLayer, NnWeights } from './weights';

/** Écart max toléré entre PyTorch et cette inférence. */
export const PARITY_TOLERANCE = 1e-5;

function dense(
  layer: DenseLayer,
  input: ArrayLike<number>,
  relu: boolean,
): Float64Array {
  const out = new Float64Array(layer.b.length);
  for (let o = 0; o < out.length; o++) {
    const row = layer.w[o];
    let s = layer.b[o];
    for (let k = 0; k < row.length; k++) s += row[k] * input[k];
    out[o] = relu && s < 0 ? 0 : s;
  }
  return out;
}

/**
 * Réseau de valeur, même calcul que `tools/ai-train/model.py` : encodeur de
 * carte partagé, somme par ensemble × échelle, MLP, tanh. Le vecteur d'une
 * carte statique ne dépend que de son id : calculé une fois.
 */
export class NnModel {
  private readonly cache = new Map<number, Float64Array>();

  constructor(private readonly w: NnWeights) {}

  private cardVector(card: EncodedCard): Float64Array {
    const isStatic = isStaticCard(card.x);
    if (isStatic) {
      const hit = this.cache.get(card.i);
      if (hit) return hit;
    }
    const input = new Float64Array(CARD_DIM + EMBED_DIM);
    input.set(card.x);
    input.set(
      this.w.layers.emb[this.w.cardIndex[String(card.i)] ?? 0],
      CARD_DIM,
    );
    const hidden = dense(this.w.layers.card1, input, true);
    const out = dense(this.w.layers.card2, hidden, true);
    if (isStatic) this.cache.set(card.i, out);
    return out;
  }

  /** Valeur dans [−1, 1] pour le joueur de la position. */
  value(pos: EncodedPosition): number {
    const z = new Float64Array(GLOBAL_DIM + SET_NAMES.length * CARD_OUT);
    z.set(pos.global);
    SET_NAMES.forEach((name, k) => {
      const base = GLOBAL_DIM + k * CARD_OUT;
      for (const card of pos.sets[name]) {
        const v = this.cardVector(card);
        for (let d = 0; d < CARD_OUT; d++) z[base + d] += v[d];
      }
      for (let d = 0; d < CARD_OUT; d++) z[base + d] *= SET_SCALE[name];
    });
    const h1 = dense(this.w.layers.head1, z, true);
    const h2 = dense(this.w.layers.head2, h1, true);
    return Math.tanh(dense(this.w.layers.out, h2, false)[0]);
  }
}

/** Plus grand écart entre cette inférence et les sorties PyTorch figées. */
export function parityError(w: NnWeights): number {
  if (!w.parity)
    throw new Error(`Poids génération ${w.generation} sans bloc de parité`);
  const model = new NnModel(w);
  const { cards, positions, values } = w.parity;
  let worst = 0;
  positions.forEach((p, k) => {
    worst = Math.max(
      worst,
      Math.abs(model.value(expandPosition(p, cards)) - values[k]),
    );
  });
  return worst;
}
