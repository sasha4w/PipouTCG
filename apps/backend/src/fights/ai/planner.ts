import type { GameAction, Seat } from '@pipou/shared';
import type { GameEngine } from '../engine/game-engine';
import type {
  GameState,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { seatPlayer } from '../helpers/game-state.helper';
import type { AiProfile } from './ai-player';
import { aiMustAct } from './ai-player';
import { listCandidates } from './candidate-actions';
import { determinize } from './determinize';
import { evaluate } from './evaluate';

/** Profondeur de réflexion : faisceau, longueur des suites, ripostes, budget. */
export interface ThinkingProfile {
  /** États gardés à chaque profondeur. */
  beamWidth: number;
  /** Coups au plus dans une suite. */
  depth: number;
  /** Déterminisations sur lesquelles on simule la riposte adverse. */
  ripostes: number;
  /** Appels à `engine.dispatch` au plus par recherche. */
  budget: number;
}

export const STRONGEST: ThinkingProfile = {
  beamWidth: 3,
  depth: 8,
  ripostes: 2,
  budget: 2500,
};

/** Simulations consommées. */
export interface Counter {
  used: number;
}

/** Le même moteur, dont chaque `dispatch` est compté. */
export function countingEngine(
  engine: GameEngine,
  counter: Counter,
): GameEngine {
  return new Proxy(engine, {
    get(target, prop, receiver) {
      if (prop === 'dispatch')
        return (...args: Parameters<GameEngine['dispatch']>) => {
          counter.used++;
          return target.dispatch(...args);
        };
      const value: unknown = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? ((value as (...a: unknown[]) => unknown).bind(target) as unknown)
        : value;
    },
  });
}

/**
 * Ce que `seat` voit de l'état : ses cartes en main par identifiant, les
 * cartes cachées seulement par leur nombre. Deux états de même signature
 * offrent à `seat` les mêmes coups.
 */
export function stateSignature(game: GameState, seat: Seat): string {
  const player = (p: PlayerGameState, mine: boolean) => [
    p.primes,
    mine ? p.hand.map((c) => c.instanceId) : p.hand.length,
    p.deck.length,
    p.primeDeck.length,
    p.recycleEnergy,
    p.transformUsedThisTurn,
    p.monsterZones.map((m) =>
      m
        ? [
            // L'identifiant du monstre est tiré au hasard à sa pose ; celui de sa carte est stable
            m.card.instanceId,
            m.currentHp,
            m.mode,
            m.attacksUsedThisTurn,
            m.equipments.map((e) => e.instanceId),
          ]
        : null,
    ),
    p.supportZones.map((c) => c?.instanceId ?? null),
    p.graveyard.map((c) => c.instanceId),
  ];
  const me = seatPlayer(game, seat);
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
  return JSON.stringify([
    game.phase,
    game.turnNumber,
    game.currentTurnUserId,
    game.pendingChoices.map((c) => [c.forUserId, c.count]),
    player(me, true),
    player(opp, false),
  ]);
}

const MONSTER_FIELDS = [
  'instanceId',
  'targetInstanceId',
  'attackerInstanceId',
] as const;

/**
 * Le coup, avec chaque monstre en jeu désigné par sa carte : la même clé
 * désigne le même coup dans la simulation et dans la vraie partie, même si
 * le moteur a tiré un autre identifiant pour un monstre posé entre-temps.
 */
export function actionKey(game: GameState, action: GameAction): string {
  const byMonster = new Map<string, string>();
  for (const p of [game.player1, game.player2])
    for (const m of p.monsterZones)
      if (m) byMonster.set(m.instanceId, `carte:${m.card.instanceId}`);
  const out: Record<string, unknown> = { ...action };
  for (const field of MONSTER_FIELDS) {
    const id = out[field];
    if (typeof id === 'string') out[field] = byMonster.get(id) ?? id;
  }
  return JSON.stringify(out);
}

/** Suite de coups retenue, clé de chaque coup et signature attendue après. */
export interface Plan {
  actions: GameAction[];
  keys: string[];
  expected: string[];
  score: number;
}

interface Node extends Plan {
  state: GameState;
}

const clone = (game: GameState): GameState =>
  structuredClone({ ...game, log: [], pendingEvents: [] });

/** Les `width` meilleurs, plus le meilleur de chaque phase (diversité). */
function selectBeam(nodes: Node[], width: number): Node[] {
  const sorted = [...nodes].sort((a, b) => b.score - a.score);
  const kept = sorted.slice(0, width);
  for (const n of sorted)
    if (!kept.some((k) => k.state.phase === n.state.phase)) kept.push(n);
  return kept;
}

/**
 * Recherche en faisceau des suites de coups de `seat` jusqu'à la fin de son
 * tour, sur une copie déterminisée. Renvoie la meilleure suite, ou null si
 * aucun coup n'a pu être simulé.
 */
export function planTurn(
  engine: GameEngine,
  game: GameState,
  seat: Seat,
  profile: AiProfile,
  thinking: ThinkingProfile,
  random: () => number,
  counter: Counter,
): Plan | null {
  const me = seatPlayer(game, seat).userId;
  const score = (s: GameState) => evaluate(s, seat, profile.archetype);
  const root = determinize(game, seat, random);
  let beam: Node[] = [
    { state: root, actions: [], keys: [], expected: [], score: score(root) },
  ];
  const leaves = new Map<string, Node>();
  const keep = (map: Map<string, Node>, sig: string, node: Node) => {
    const old = map.get(sig);
    if (!old || node.score > old.score) map.set(sig, node);
  };

  let exhausted = false;
  for (let depth = 0; depth < thinking.depth && beam.length > 0; depth++) {
    const children = new Map<string, Node>();
    for (const node of beam) {
      for (const action of listCandidates(node.state, seat)) {
        if (counter.used >= thinking.budget) {
          exhausted = true;
          break;
        }
        const next = clone(node.state);
        counter.used++;
        try {
          if (engine.dispatch(next, seat, action).error) continue;
        } catch {
          continue;
        }
        const sig = stateSignature(next, seat);
        const child: Node = {
          state: next,
          actions: [...node.actions, action],
          keys: [...node.keys, actionKey(node.state, action)],
          expected: [...node.expected, sig],
          score: score(next),
        };
        // Fin de suite : partie finie, tour passé, choix pour l'adversaire
        keep(aiMustAct(next, me) ? children : leaves, sig, child);
      }
      if (exhausted) break;
    }
    if (exhausted) {
      for (const n of [...beam, ...children.values()])
        if (n.actions.length > 0) keep(leaves, n.expected.at(-1)!, n);
      beam = [];
      break;
    }
    beam = selectBeam([...children.values()], thinking.beamWidth);
  }
  // Profondeur atteinte : le faisceau restant est fait de fins de suite
  for (const n of beam)
    if (n.actions.length > 0) keep(leaves, n.expected.at(-1)!, n);
  if (leaves.size === 0) return null;

  const finalists = [...leaves.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, thinking.beamWidth);
  const best = finalists.reduce((a, b) => (b.score > a.score ? b : a));
  return {
    actions: best.actions,
    keys: best.keys,
    expected: best.expected,
    score: best.score,
  };
}
