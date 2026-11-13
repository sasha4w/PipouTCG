import type { GameAction, PuzzleObjective } from '@pipou/shared';
import type { GameEngine } from '../../fights/engine/game-engine';
import type { GameState } from '../../fights/interfaces/game-state.interface';
import { listCandidates } from '../../fights/ai/candidate-actions';
import { stateSignature } from '../../fights/ai/planner';
import {
  puzzleOutcome,
  startTrack,
  type PuzzleTrack,
} from '../puzzle-objective';
import { playPuzzleAction } from '../puzzle-step';

const fork = (game: GameState): GameState =>
  structuredClone({ ...game, log: [], pendingEvents: [] });

/**
 * Le coup « évident » : passer en combat puis frapper avec ce qu'on a, sans rien
 * jouer en phase principale. Vrai si cette ligne suffit à réussir le défi.
 */
export function naiveLineSolves(
  engine: GameEngine,
  start: GameState,
  objective: PuzzleObjective,
  seed: number,
): boolean {
  const game = fork(start);
  const track = startTrack(game);
  if (playPuzzleAction(engine, game, { type: 'end_phase' }, seed, track).error)
    return false;
  for (let i = 0; i < 12; i++) {
    if (puzzleOutcome(objective, game, track) === 'solved') return true;
    const attacks = listCandidates(game, 'p1').filter(
      (a) => a.type === 'attack',
    );
    const played = attacks.some(
      (a) => !playPuzzleAction(engine, game, a, seed, track).error,
    );
    if (!played) break;
  }
  return puzzleOutcome(objective, game, track) === 'solved';
}

/**
 * Plus petit nombre d'actions d'une solution (parcours en largeur, mêmes
 * candidats élagués que le solveur). `null` si rien n'est trouvé dans la limite.
 */
export function shortestSolution(
  engine: GameEngine,
  start: GameState,
  objective: PuzzleObjective,
  seed: number,
  maxNodes = 60_000,
): GameAction[] | null {
  interface Node {
    game: GameState;
    track: PuzzleTrack;
    path: GameAction[];
  }
  const key = (n: Node) =>
    `${stateSignature(n.game, 'p1')}|${n.track.destroyed.join(',')}`;
  const root: Node = { game: fork(start), track: startTrack(start), path: [] };
  const seen = new Set([key(root)]);
  let layer = [root];
  let nodes = 0;
  while (layer.length > 0) {
    const nextLayer: Node[] = [];
    for (const node of layer)
      for (const action of listCandidates(node.game, 'p1')) {
        if (++nodes > maxNodes) return null;
        const next: Node = {
          game: fork(node.game),
          track: { ...node.track, destroyed: [...node.track.destroyed] },
          path: [...node.path, action],
        };
        try {
          if (
            playPuzzleAction(engine, next.game, action, seed, next.track).error
          )
            continue;
        } catch {
          continue;
        }
        const outcome = puzzleOutcome(objective, next.game, next.track);
        if (outcome === 'solved') return next.path;
        if (outcome === 'failed') continue;
        const k = key(next);
        if (seen.has(k)) continue;
        seen.add(k);
        nextLayer.push(next);
      }
    layer = nextLayer;
  }
  return null;
}
