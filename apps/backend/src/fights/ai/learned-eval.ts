import { readFileSync } from 'node:fs';
import type { AdventureArchetype } from '@pipou/shared';
import { seatPlayer } from '../helpers/game-state.helper';
import { evaluateLegacy } from './evaluate';
import type { Evaluator } from './evaluate';
import { FEATURE_NAMES, features } from './features';
import { LEARNED_WEIGHTS } from './learned-weights';

/** Poids appris par auto-jeu : un vecteur par archétype, dans l'ordre de `features`. */
export interface LearnedWeights {
  generation: number;
  trainedAt: string;
  /** Positions d'entraînement. */
  positions: number;
  /** Part des parties mises de côté dont le vainqueur est bien prédit. */
  holdoutAccuracy: number;
  /** Noms des caractéristiques au moment de l'entraînement. */
  features: readonly string[];
  weights: Record<AdventureArchetype, number[]>;
}

/** La note d'un cerveau : la manuelle, l'apprise versionnée, ou des poids donnés (essai). */
export type Note = 'legacy' | 'learned' | LearnedWeights;

/**
 * La somme pondérée est un logit (1 = cote de victoire multipliée par e).
 * Multipliée par 1000, elle retrouve l'ordre de grandeur de la note manuelle :
 * `MODE_TOLL` (5) reste un départage, `MISTAKE_MAX_LOSS` (1000) vaut un logit.
 */
export const LEARNED_SCALE = 1000;

/** Partie nulle : à éviter, sans valoir une défaite. */
const DRAW = -10 * LEARNED_SCALE;

export function learnedEvaluator(w: LearnedWeights): Evaluator {
  if (
    w.features.length !== FEATURE_NAMES.length ||
    w.features.some((name, i) => name !== FEATURE_NAMES[i])
  )
    throw new Error(
      `Poids appris (génération ${w.generation}) : les caractéristiques ne correspondent plus à FEATURE_NAMES, il faut réentraîner`,
    );
  return (game, seat, archetype, _prepare, parts) => {
    if (game.phase === 'finished') {
      const me = seatPlayer(game, seat).userId;
      if (game.winner === me) return Infinity;
      if (game.winner != null) return -Infinity;
      return DRAW;
    }
    const f = features(game, seat, archetype);
    const row = w.weights[archetype];
    let score = 0;
    for (let i = 0; i < f.length; i++) {
      const value = LEARNED_SCALE * row[i] * f[i];
      score += value;
      if (parts && value !== 0) parts[FEATURE_NAMES[i]] = value;
    }
    return score;
  };
}

let versioned: Evaluator | undefined;

export function evaluatorOf(note: Note): Evaluator {
  if (note === 'legacy') return evaluateLegacy;
  if (note === 'learned')
    return (versioned ??= learnedEvaluator(LEARNED_WEIGHTS));
  return learnedEvaluator(note);
}

/** `legacy`, `learned`, ou le chemin d'un fichier de poids `.json` (outils en ligne de commande). */
export function parseNote(raw: string | undefined, fallback: Note): Note {
  if (raw === undefined) return fallback;
  if (raw === 'legacy' || raw === 'learned') return raw;
  if (raw.endsWith('.json'))
    return JSON.parse(readFileSync(raw, 'utf8')) as LearnedWeights;
  throw new Error(`Note inconnue « ${raw} » (legacy, learned, fichier .json)`);
}
