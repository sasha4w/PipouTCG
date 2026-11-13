import type {
  GameAction,
  PuzzleObjective,
  PuzzleSolveStatus,
} from '@pipou/shared';
import type { GameEngine } from '../fights/engine/game-engine';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { listCandidates } from '../fights/ai/candidate-actions';
import { stateSignature } from '../fights/ai/planner';
import {
  puzzleOutcome,
  startTrack,
  type PuzzleTrack,
} from './puzzle-objective';
import { playPuzzleAction } from './puzzle-step';

export interface SolveLimits {
  maxNodes: number;
  maxMs: number;
}
export const DEFAULT_LIMITS: SolveLimits = { maxNodes: 200_000, maxMs: 20_000 };
/** Rend la main à la boucle d'événements tous les N nœuds. */
const SLICE = 200;

export interface SolveResult {
  status: PuzzleSolveStatus;
  solution: GameAction[];
  nodes: number;
  ms: number;
}

interface Node {
  game: GameState;
  track: PuzzleTrack;
  path: GameAction[];
}

const fork = (game: GameState): GameState =>
  structuredClone({ ...game, log: [], pendingEvents: [] });

/**
 * Cherche en profondeur une suite de coups qui atteint l'objectif dans le tour.
 * `listCandidates` élague (paiement le moins cher, combinaisons plafonnées) :
 * une recherche épuisée ne prouve donc pas qu'il n'y a pas de solution, d'où
 * `not_found` et jamais « insoluble ».
 */
export async function solvePuzzle(
  engine: GameEngine,
  start: GameState,
  objective: PuzzleObjective,
  seed: number,
  limits: SolveLimits = DEFAULT_LIMITS,
): Promise<SolveResult> {
  const t0 = Date.now();
  let nodes = 0;
  const done = (
    status: PuzzleSolveStatus,
    solution: GameAction[] = [],
  ): SolveResult => ({ status, solution, nodes, ms: Date.now() - t0 });
  const seen = new Set<string>();
  const key = (n: Node) =>
    `${stateSignature(n.game, 'p1')}|${n.track.destroyed.join(',')}`;
  const root: Node = { game: fork(start), track: startTrack(start), path: [] };
  if (puzzleOutcome(objective, root.game, root.track) === 'solved')
    return done('solved');
  const stack: Node[] = [root];
  seen.add(key(root));

  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const action of listCandidates(node.game, 'p1')) {
      if (nodes >= limits.maxNodes || Date.now() - t0 > limits.maxMs)
        return done('timeout');
      nodes++;
      if (nodes % SLICE === 0) await new Promise((r) => setImmediate(r));
      const next: Node = {
        game: fork(node.game),
        track: { ...node.track, destroyed: [...node.track.destroyed] },
        path: [...node.path, action],
      };
      let error: string | undefined;
      try {
        error = playPuzzleAction(
          engine,
          next.game,
          action,
          seed,
          next.track,
        ).error;
      } catch {
        continue; // coup que le moteur ne sait pas jouer : branche abandonnée
      }
      if (error) continue;
      const outcome = puzzleOutcome(objective, next.game, next.track);
      if (outcome === 'solved') return done('solved', next.path);
      if (outcome === 'failed') continue;
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push(next);
    }
  }
  return done('not_found');
}
