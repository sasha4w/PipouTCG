import { appendFileSync, readFileSync } from 'node:fs';
import type { AdventureArchetype, GameAction, Seat } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import type { AiLevel } from './ai-player';

/** Comment le coup a été choisi. */
export type DecisionSource =
  'greedy' | 'plan' | 'mistake' | 'mulligan' | 'fallback';

/** Remplace ±Infinity (victoire/défaite), que JSON ne sait pas écrire. */
export const TERMINAL_SCORE = 1e9;

export function finiteScore(score: number): number {
  return Math.max(-TERMINAL_SCORE, Math.min(TERMINAL_SCORE, score));
}

/** Coup accepté par le moteur, avec son score `evaluate` (point de vue de l'IA). */
export interface CandidateRecord {
  action: GameAction;
  /**
   * Score de l'état simulé après ce seul coup ; pas la valeur du plan.
   * Victoire/défaite : ±TERMINAL_SCORE.
   */
  score: number;
}

/**
 * Une décision de l'IA. `state` est l'état COMPLET (mains et decks adverses
 * compris) : donnée de débogage pour rejouer le cas, jamais une entrée de l'IA.
 */
export interface DecisionRecord {
  /** Unique dans un journal : `${run}:${match}:${seat}:${n}`. */
  id: string;
  matchId: number;
  turn: number;
  phase: string;
  seat: Seat;
  archetype: AdventureArchetype;
  level: AiLevel;
  source: DecisionSource;
  chosen: GameAction;
  /**
   * Score de l'état avant de jouer, quand le glouton le compare à `end_phase` :
   * finir la phase n'est choisi que si aucun coup ne dépasse cette base.
   */
  baseline?: number;
  candidates: CandidateRecord[];
  /** Coups dont la simulation a levé une exception moteur. */
  simulationCrashes: { action: GameAction; message: string }[];
  /** Copie profonde de l'état avant la décision (sans journal ni événements). */
  state: GameState;
}

/** Reçoit les décisions ; l'appelant choisit où les écrire. */
export type DecisionSink = (record: DecisionRecord) => void;

/** Copie profonde de l'état, sans journal ni événements. */
export function snapshotState(game: GameState): GameState {
  return structuredClone({ ...game, log: [], pendingEvents: [] });
}

export function toJsonlLine(record: DecisionRecord): string {
  return JSON.stringify(record);
}

/** Lit un JSONL ; ligne vide ignorée, ligne invalide : erreur avec son numéro. */
export function parseJsonl<T>(text: string): T[] {
  const out: T[] = [];
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      throw new Error(`JSONL invalide à la ligne ${i + 1}`);
    }
  });
  return out;
}

/** Sink qui ajoute chaque décision à un fichier JSONL. */
export function fileSink(path: string): DecisionSink {
  return (record) => appendFileSync(path, toJsonlLine(record) + '\n');
}

export function readDecisions(path: string): DecisionRecord[] {
  return parseJsonl<DecisionRecord>(readFileSync(path, 'utf8'));
}
