import type { AdventureArchetype } from '@pipou/shared';
import { FEATURE_NAMES } from './features';
import type { LearnedWeights } from './learned-eval';
import type { Sample } from './selfplay-data';

export interface TrainOptions {
  /** Passes de descente de gradient sur toutes les positions. */
  iterations: number;
  learningRate: number;
  /** Régularisation L2 : retient les poids des caractéristiques peu informatives. */
  l2: number;
}

export const DEFAULT_TRAIN: TrainOptions = {
  iterations: 400,
  learningRate: 0.5,
  l2: 0.001,
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Probabilité de victoire prédite par des poids bruts. */
export function predict(
  weights: readonly number[],
  f: readonly number[],
): number {
  let x = 0;
  for (let j = 0; j < f.length; j++) x += weights[j] * f[j];
  return sigmoid(x);
}

/**
 * Régression logistique par descente de gradient sur tout le jeu de données.
 * L'indice 0 est le biais (caractéristique constante à 1). Les autres sont
 * centrées et réduites pour l'ajustement, puis les poids sont ramenés à
 * l'échelle brute : la note n'a rien à normaliser en partie.
 */
export function fit(
  rows: readonly { f: readonly number[]; y: number }[],
  opts: TrainOptions = DEFAULT_TRAIN,
): number[] {
  const n = rows.length;
  if (n === 0) return [];
  const d = rows[0].f.length;
  const mean = new Array<number>(d).fill(0);
  const std = new Array<number>(d).fill(0);
  for (const r of rows) for (let j = 1; j < d; j++) mean[j] += r.f[j] / n;
  for (const r of rows)
    for (let j = 1; j < d; j++) std[j] += (r.f[j] - mean[j]) ** 2 / n;
  for (let j = 1; j < d; j++) std[j] = Math.sqrt(std[j]);
  // Une caractéristique qui ne varie pas n'apprend rien : poids nul
  const live: number[] = [];
  for (let j = 1; j < d; j++) if (std[j] > 1e-9) live.push(j);

  const z = rows.map((r) =>
    Float64Array.from(live, (j) => (r.f[j] - mean[j]) / std[j]),
  );
  const w = new Float64Array(live.length);
  const grad = new Float64Array(live.length);
  let bias = 0;
  for (let it = 0; it < opts.iterations; it++) {
    grad.fill(0);
    let gradBias = 0;
    for (let i = 0; i < n; i++) {
      const zi = z[i];
      let x = bias;
      for (let k = 0; k < w.length; k++) x += w[k] * zi[k];
      const error = sigmoid(x) - rows[i].y;
      gradBias += error;
      for (let k = 0; k < w.length; k++) grad[k] += error * zi[k];
    }
    bias -= (opts.learningRate * gradBias) / n;
    for (let k = 0; k < w.length; k++)
      w[k] -= opts.learningRate * (grad[k] / n + opts.l2 * w[k]);
  }

  const raw = new Array<number>(d).fill(0);
  raw[0] = bias;
  live.forEach((j, k) => {
    raw[j] = w[k] / std[j];
    raw[0] -= (w[k] * mean[j]) / std[j];
  });
  return raw;
}

/** Une partie sur dix est mise de côté, entière, pour vérifier la prédiction. */
export const isHoldout = (g: number) => g % 10 === 0;

const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];

/** Un jeu de poids par archétype, et sa précision sur les parties mises de côté. */
export function train(
  samples: readonly Sample[],
  generation: number,
  trainedAt: string,
  opts: TrainOptions = DEFAULT_TRAIN,
): {
  weights: LearnedWeights;
  byArchetype: Record<
    AdventureArchetype,
    { positions: number; accuracy: number; loss: number }
  >;
} {
  const zeros = () => FEATURE_NAMES.map(() => 0);
  const weights = {} as Record<AdventureArchetype, number[]>;
  const byArchetype = {} as Record<
    AdventureArchetype,
    { positions: number; accuracy: number; loss: number }
  >;
  let positions = 0;
  let right = 0;
  let decided = 0;
  for (const a of ARCHETYPES) {
    const own = samples.filter((s) => s.a === a);
    const learn = own.filter((s) => !isHoldout(s.g));
    const check = own.filter((s) => isHoldout(s.g));
    const w = fit(learn, opts);
    weights[a] = w.length === FEATURE_NAMES.length ? w : zeros();
    positions += learn.length;
    let ok = 0;
    let n = 0;
    let loss = 0;
    for (const s of check) {
      const p = Math.min(1 - 1e-12, Math.max(1e-12, predict(weights[a], s.f)));
      loss -= s.y * Math.log(p) + (1 - s.y) * Math.log(1 - p);
      // Une partie sans vainqueur n'a pas de bonne réponse
      if (s.y === 0.5) continue;
      n++;
      if (p > 0.5 === (s.y === 1)) ok++;
    }
    right += ok;
    decided += n;
    byArchetype[a] = {
      positions: learn.length,
      accuracy: n === 0 ? 0 : ok / n,
      loss: check.length === 0 ? 0 : loss / check.length,
    };
  }
  return {
    weights: {
      generation,
      trainedAt,
      positions,
      holdoutAccuracy: decided === 0 ? 0 : right / decided,
      features: [...FEATURE_NAMES],
      weights,
    },
    byArchetype,
  };
}

/** Source de `learned-weights.ts` pour ces poids. */
export function weightsModule(w: LearnedWeights): string {
  return [
    '// Fichier généré par `pnpm --filter @pipou/backend ai:train adopt`. Ne pas modifier à la main.',
    "import type { LearnedWeights } from './learned-eval';",
    '',
    `/** Génération ${w.generation}, ${w.trainedAt} : ${w.positions} positions, ${(100 * w.holdoutAccuracy).toFixed(1)} % de vainqueurs bien prédits sur les parties mises de côté. */`,
    `export const LEARNED_WEIGHTS: LearnedWeights = ${JSON.stringify(w, null, 2)};`,
    '',
  ].join('\n');
}
