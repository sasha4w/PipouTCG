import type { AdventureArchetype, GameAction, Seat } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { seatPlayer } from '../helpers/game-state.helper';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { AiPlayer, aiMustAct } from './ai-player';
import { describeAction } from './ai-review';
import { listCandidates } from './candidate-actions';
import { determinize } from './determinize';
import { evaluateLegacy } from './evaluate';
import { scoreAfterChoice, stateSignature } from './planner';
import { MAX_ACTIONS, seeded } from './tournament';

/** Un coup candidat et son taux de victoire mesuré par fins de partie. */
export interface JudgedRow {
  action: GameAction;
  text: string;
  /** Note manuelle après le coup, pour comparaison. */
  eval: number;
  /** Victoires (0,5 par partie sans vainqueur) sur `n` fins de partie. */
  wins: number;
  n: number;
}

/** `Math.random` figé le temps de `f` : le moteur mélange avec lui. */
export function withRandom<T>(seed: number, f: () => T): T {
  const real = Math.random;
  Math.random = seeded(seed);
  try {
    return f();
  } finally {
    Math.random = real;
  }
}

/** Finit la partie en glouton des deux côtés (note manuelle) ; 1 si `seat` gagne. */
export function rollout(
  state: GameState,
  seat: Seat,
  archetypes: Record<Seat, AdventureArchetype>,
  seed: number,
): number {
  return withRandom(seed ^ 0x5bd1e995, () => {
    const engine = createEngine(fixedRng());
    const greedy = new AiPlayer(engine, seeded(seed));
    const ids = { p1: state.player1.userId, p2: state.player2.userId };
    for (let n = 0; state.phase !== 'finished' && n < MAX_ACTIONS; n++) {
      const actor = (['p1', 'p2'] as Seat[]).find((s) =>
        aiMustAct(state, ids[s]),
      );
      if (!actor) break;
      engine.dispatch(
        state,
        actor,
        greedy.chooseAction(state, actor, {
          archetype: archetypes[actor],
          level: 3,
        }),
      );
    }
    if (state.phase !== 'finished' || state.winner == null) return 0.5;
    return state.winner === seatPlayer(state, seat).userId ? 1 : 0;
  });
}

/**
 * Juge les coups de `seat` dans `game` : chacun est joué sur `rollouts` copies
 * déterminisées (le même tirage de cartes cachées pour tous les coups), puis
 * la partie est finie en glouton. null s'il y a moins de deux coups distincts.
 * Au-delà de `maxCandidates`, les coups jugés sont tirés au hasard, pas
 * choisis par une note : le banc ne favorise aucune note.
 */
export function judge(
  game: GameState,
  seat: Seat,
  archetypes: Record<Seat, AdventureArchetype>,
  rollouts: number,
  seed: number,
  maxCandidates = 12,
): JudgedRow[] | null {
  const engine = createEngine(fixedRng());
  const score = (s: GameState) =>
    evaluateLegacy(s, seat, archetypes[seat], false);
  const seen = new Set<string>();
  let options: { action: GameAction; eval: number }[] = [];
  for (const action of listCandidates(game, seat)) {
    const after = structuredClone(game);
    try {
      if (withRandom(seed, () => engine.dispatch(after, seat, action)).error)
        continue;
    } catch {
      continue;
    }
    const sig = stateSignature(after, seat);
    if (seen.has(sig)) continue;
    seen.add(sig);
    options.push({
      action,
      eval: scoreAfterChoice(engine, after, seat, score),
    });
  }
  if (options.length < 2) return null;
  if (options.length > maxCandidates) {
    const pick = seeded(seed ^ 0x2c1b3c6d);
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(pick() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    options = options.slice(0, maxCandidates);
  }
  return options.map((o) => {
    let wins = 0;
    for (let k = 0; k < rollouts; k++) {
      const s = determinize(game, seat, seeded(seed * 1000 + k));
      withRandom(seed * 1000 + k, () => {
        try {
          engine.dispatch(s, seat, o.action);
        } catch {
          /* coup refusé sur cette copie : la partie continue */
        }
      });
      wins += rollout(s, seat, archetypes, seed * 1000 + k);
    }
    return {
      action: o.action,
      text: describeAction(o.action, game),
      eval: o.eval,
      wins,
      n: rollouts,
    };
  });
}
