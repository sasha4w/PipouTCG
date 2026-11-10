// Fichier généré par `pnpm --filter @pipou/backend ai:train adopt`. Ne pas modifier à la main.
import type { LearnedWeights } from './learned-eval';
import { FEATURE_NAMES } from './features';

const zeros = FEATURE_NAMES.map(() => 0);

/** Génération 0 : aucun entraînement, poids nuls. */
export const LEARNED_WEIGHTS: LearnedWeights = {
  generation: 0,
  trainedAt: '',
  positions: 0,
  holdoutAccuracy: 0,
  features: [...FEATURE_NAMES],
  weights: { pipou: zeros, pixelman: zeros, dragon: zeros },
};
