// apps/backend/src/fights/ai/nn/mlp.spec.ts
import { zeroWeights, randomWeights } from '../../testing/nn-weights';
import { CARD_DIM, GLOBAL_DIM, SET_NAMES } from './encode';
import type { EncodedCard, EncodedPosition, SetName } from './encode';
import { NnModel } from './mlp';
import { CARD_OUT } from './weights';

function card(i: number, atk: number, onBoard = true): EncodedCard {
  const x = new Array<number>(CARD_DIM).fill(0);
  x[2] = atk;
  if (onBoard) x[18] = 1;
  return { i, x };
}

function position(
  sets: Partial<Record<SetName, EncodedCard[]>>,
): EncodedPosition {
  const all = Object.fromEntries(SET_NAMES.map((n) => [n, sets[n] ?? []]));
  return {
    global: new Array<number>(GLOBAL_DIM).fill(0),
    sets: all as Record<SetName, EncodedCard[]>,
  };
}

/** Réseau qui calcule tanh(somme des x[2] de l'ensemble k, × son échelle). */
function sumAtkOfSet(k: number) {
  const w = zeroWeights([1, 2]);
  w.layers.card1.w[0][2] = 1;
  w.layers.card2.w[0][0] = 1;
  w.layers.head1.w[0][GLOBAL_DIM + k * CARD_OUT] = 1;
  w.layers.head2.w[0][0] = 1;
  w.layers.out.w[0][0] = 1;
  return w;
}

describe('NnModel', () => {
  it('poids nuls : tanh du biais de sortie', () => {
    const w = zeroWeights();
    w.layers.out.b[0] = 0.5;
    expect(new NnModel(w).value(position({}))).toBeCloseTo(Math.tanh(0.5), 12);
  });

  it('calcul à la main : somme des ATK de mes monstres', () => {
    const model = new NnModel(sumAtkOfSet(0));
    const pos = position({ myMonsters: [card(1, 0.2), card(2, 0.3)] });
    expect(model.value(pos)).toBeCloseTo(Math.tanh(0.5), 12);
  });

  it('échelle de l’ensemble : mon deck restant compte pour 0,1', () => {
    const k = SET_NAMES.indexOf('myRemaining');
    const model = new NnModel(sumAtkOfSet(k));
    const pos = position({
      myRemaining: [card(1, 0.2, false), card(2, 0.3, false)],
    });
    expect(model.value(pos)).toBeCloseTo(Math.tanh(0.05), 12);
  });

  it('ordre des cartes sans effet (somme)', () => {
    const model = new NnModel(randomWeights(7, [1, 2]));
    const a = position({ oppMonsters: [card(1, 0.2), card(2, 0.3)] });
    const b = position({ oppMonsters: [card(2, 0.3), card(1, 0.2)] });
    expect(model.value(a)).toBeCloseTo(model.value(b), 12);
  });

  it('carte inconnue : embedding de la ligne 0', () => {
    const w = randomWeights(3, [1]);
    w.layers.emb[1] = [...w.layers.emb[0]];
    const model = new NnModel(w);
    const known = position({ myHand: [card(1, 0.2, false)] });
    const unknown = position({ myHand: [card(999, 0.2, false)] });
    expect(model.value(unknown)).toBeCloseTo(model.value(known), 12);
  });

  it('cache des cartes statiques : même valeur au second appel', () => {
    const model = new NnModel(randomWeights(5, [1, 2]));
    const pos = position({
      myHand: [card(1, 0.2, false), card(1, 0.2, false)],
    });
    expect(model.value(pos)).toBe(model.value(pos));
  });
});
