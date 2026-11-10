import type { AdventureArchetype, GameAction, Seat } from '@pipou/shared';
import type { GameEngine } from '../engine/game-engine';
import type { GameState } from '../interfaces/game-state.interface';
import { determinize } from './determinize';
import type { Evaluator } from './evaluate';
import { scoreAfterChoice } from './planner';
import { seeded } from './tournament';

/** Une position du banc : l'état complet et le taux de victoire de chaque coup. */
export interface BenchPosition {
  id: string;
  seat: Seat;
  archetype: AdventureArchetype;
  state: GameState;
  rows: { action: GameAction; wins: number; n: number }[];
}

/** Graine stable tirée de l'identifiant de la position. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Regret de `evaluate` sur une position : taux de victoire du meilleur coup
 * moins celui du coup qu'elle préfère. La note voit une copie déterminisée,
 * comme en partie. null s'il reste moins de deux coups jouables.
 */
export function regretOf(
  engine: GameEngine,
  pos: BenchPosition,
  evaluate: Evaluator,
): { regret: number; best: boolean } | null {
  const view = determinize(pos.state, pos.seat, seeded(seedOf(pos.id)));
  const score = (s: GameState) => evaluate(s, pos.seat, pos.archetype, true);
  const scored: { rate: number; score: number }[] = [];
  for (const row of pos.rows) {
    const after = structuredClone(view);
    try {
      if (engine.dispatch(after, pos.seat, row.action).error) continue;
    } catch {
      continue;
    }
    scored.push({
      rate: row.wins / row.n,
      score: scoreAfterChoice(engine, after, pos.seat, score),
    });
  }
  if (scored.length < 2) return null;
  const chosen = scored.reduce((a, b) => (b.score > a.score ? b : a));
  const top = Math.max(...scored.map((s) => s.rate));
  return { regret: top - chosen.rate, best: chosen.rate === top };
}
