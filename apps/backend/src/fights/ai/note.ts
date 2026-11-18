import { Logger } from '@nestjs/common';
import { evaluateLegacy } from './evaluate';
import type { Evaluator } from './evaluate';
import { nnEvaluator } from './nn/nn-eval';
import { CHAMPION_PATH, loadChampion, readWeights } from './nn/weights';
import type { NnWeights } from './nn/weights';

/** La note d'un cerveau : la manuelle, le champion réseau déployé, ou des poids donnés (essai). */
export type Note = 'legacy' | 'nn' | NnWeights;

const logger = new Logger('NoteIA');

/** Le champion, ou la note manuelle (avec un avertissement) s'il est absent ou périmé. */
export function championOrLegacy(path: string = CHAMPION_PATH): Evaluator {
  const loaded = loadChampion(path);
  if ('weights' in loaded) return nnEvaluator(loaded.weights);
  logger.warn(
    `Note réseau indisponible, repli sur la note manuelle : ${loaded.reason}`,
  );
  return evaluateLegacy;
}

let champion: Evaluator | undefined;

export function evaluatorOf(note: Note): Evaluator {
  if (note === 'legacy') return evaluateLegacy;
  if (note === 'nn') return (champion ??= championOrLegacy());
  return nnEvaluator(note);
}

/** Note des niveaux d'aventure : `AI_EVAL=legacy` revient à la manuelle. */
export function defaultNote(): Note {
  return process.env.AI_EVAL === 'legacy' ? 'legacy' : 'nn';
}

/** `legacy`, `nn`, ou le chemin d'un fichier de poids `.json` (outils en ligne de commande). */
export function parseNote(raw: string | undefined, fallback: Note): Note {
  if (raw === undefined) return fallback;
  if (raw === 'legacy' || raw === 'nn') return raw;
  if (raw.endsWith('.json')) return readWeights(raw);
  throw new Error(`Note inconnue « ${raw} » (legacy, nn, fichier .json)`);
}
