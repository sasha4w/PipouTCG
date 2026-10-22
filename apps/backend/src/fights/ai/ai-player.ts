import { Logger } from '@nestjs/common';
import { CardType, HAND_LIMIT, canSummonFromHand } from '@pipou/shared';
import type { AdventureArchetype, GameAction, Seat } from '@pipou/shared';
import type { GameEngine } from '../engine/game-engine';
import type { GameState } from '../interfaces/game-state.interface';
import {
  freshCandidates,
  seatOf,
  seatPlayer,
} from '../helpers/game-state.helper';
import { activeChoice, listCandidates } from './candidate-actions';
import { determinize } from './determinize';
import { evaluate } from './evaluate';

export type AiLevel = 1 | 2 | 3 | 4 | 5;

/** Variante jouée par l'IA : archétype (heuristiques) et niveau (erreurs). */
export interface AiProfile {
  archetype: AdventureArchetype;
  level: AiLevel;
}

/** Probabilité de jouer un coup valide au hasard au lieu du meilleur. */
export const MISTAKE_RATE: Record<AiLevel, number> = {
  1: 0.25,
  2: 0.1,
  3: 0,
  4: 0,
  5: 0,
};

/** Écart minimal pour préférer une action à la fin de phase. */
const IMPROVEMENT_EPSILON = 1e-6;

/**
 * L'IA `aiUserId` doit-elle jouer maintenant ? Choix en attente pour elle,
 * mulligan non décidé, ou son tour (main/combat/fin) sans choix adverse.
 */
export function aiMustAct(game: GameState, aiUserId: number): boolean {
  if (game.phase === 'finished' || game.phase === 'waiting') return false;
  const seat = seatOf(game, aiUserId);
  if (!seat) return false;
  const choice = activeChoice(game);
  if (choice) return choice.forUserId === aiUserId;
  if (game.phase === 'mulligan') return !seatPlayer(game, seat).mulliganDone;
  return (
    game.currentTurnUserId === aiUserId &&
    (game.phase === 'main' || game.phase === 'battle' || game.phase === 'end')
  );
}

interface Scored {
  action: GameAction;
  score: number;
}

/**
 * Joueur heuristique : simule chaque coup candidat sur une copie de l'état
 * avec le vrai moteur, puis garde celui qui maximise `evaluate`.
 */
export class AiPlayer {
  private readonly logger = new Logger(AiPlayer.name);

  constructor(
    private readonly engine: GameEngine,
    private readonly random: () => number,
  ) {}

  /** Coup à jouer pour `seat`. Ne modifie pas `game` et ne lève jamais. */
  chooseAction(game: GameState, seat: Seat, profile: AiProfile): GameAction {
    const crashes: SimulationCrash[] = [];
    try {
      return (
        this.decide(game, seat, profile, crashes) ?? fallbackAction(game, seat)
      );
    } catch (err) {
      const fallback = safeFallback(game, seat);
      this.logger.warn(
        `Match ${game.matchId} (${seat}) : décision IA en échec, repli ${JSON.stringify(fallback)} — ${describe(err)}`,
      );
      return fallback;
    } finally {
      // Un seul message par décision, même si plusieurs simulations ont planté
      if (crashes.length > 0)
        this.logger.warn(
          `Match ${game.matchId} (${seat}) : ${crashes.length} simulation(s) du moteur ont levé une exception, ex. ${JSON.stringify(crashes[0].action)} — ${describe(crashes[0].error)}`,
        );
    }
  }

  private decide(
    game: GameState,
    seat: Seat,
    profile: AiProfile,
    crashes: SimulationCrash[],
  ): GameAction | null {
    // L'IA ne voit que ce qu'un joueur voit : cartes cachées redistribuées
    const known = determinize(game, seat, this.random);
    const valid: Scored[] = [];
    for (const action of listCandidates(known, seat)) {
      const clone = cloneForSimulation(known);
      try {
        if (this.engine.dispatch(clone, seat, action).error) continue;
      } catch (error) {
        crashes.push({ action, error });
        continue;
      }
      valid.push({
        action,
        score: Math.max(
          evaluate(clone, seat, profile.archetype),
          this.guardedScore(
            clone,
            seat,
            arrivalZone(game, seat, action),
            profile,
            crashes,
          ),
          action.type === 'transform'
            ? this.transformScore(clone, seat, profile, crashes)
            : -Infinity,
        ),
      });
    }
    if (valid.length === 0) return null;

    const rate = MISTAKE_RATE[profile.level] ?? 0;
    if (rate > 0 && this.random() < rate)
      return valid[Math.floor(this.random() * valid.length)].action;

    if (game.phase === 'mulligan') return mulliganChoice(game, seat, valid);

    const endPhase = valid.find((v) => v.action.type === 'end_phase');
    const others = valid.filter((v) => v.action.type !== 'end_phase');
    if (others.length === 0) return endPhase!.action;
    const best = others.reduce((a, b) => (b.score > a.score ? b : a));
    if (!endPhase) return best.action;
    const current = evaluate(known, seat, profile.archetype);
    return best.score > current + IMPROVEMENT_EPSILON
      ? best.action
      : endPhase.action;
  }

  /**
   * Transformer ne vaut que par ce qu'on fait du Bébé récupéré : meilleur
   * score après le choix du Bébé, puis son invocation éventuelle.
   * -Infinity sans objet.
   */
  private transformScore(
    after: GameState,
    seat: Seat,
    profile: AiProfile,
    crashes: SimulationCrash[],
  ): number {
    const play = (state: GameState, action: GameAction): GameState | null => {
      const clone = cloneForSimulation(state);
      try {
        return this.engine.dispatch(clone, seat, action).error ? null : clone;
      } catch (error) {
        crashes.push({ action, error });
        return null;
      }
    };
    let best = -Infinity;
    for (const pick of listCandidates(after, seat)) {
      if (pick.type !== 'pick_cards') continue;
      const picked = play(after, pick);
      if (!picked) continue;
      best = Math.max(best, evaluate(picked, seat, profile.archetype));
      for (const next of listCandidates(picked, seat)) {
        if (next.type !== 'summon') continue;
        const summoned = play(picked, next);
        if (summoned)
          best = Math.max(best, evaluate(summoned, seat, profile.archetype));
      }
    }
    return best;
  }

  /**
   * Un monstre qui vient d'arriver peut passer en Garde au coup suivant :
   * score de cette suite, pour ne pas écarter une invocation qui n'est bonne
   * qu'en défense. -Infinity si sans objet.
   */
  private guardedScore(
    after: GameState,
    seat: Seat,
    zone: number | null,
    profile: AiProfile,
    crashes: SimulationCrash[],
  ): number {
    if (zone === null || after.phase !== 'main') return -Infinity;
    const monster = seatPlayer(after, seat).monsterZones[zone];
    if (!monster || monster.mode === 'guard') return -Infinity;
    const action: GameAction = {
      type: 'change_mode',
      instanceId: monster.instanceId,
      mode: 'guard',
    };
    const clone = cloneForSimulation(after);
    try {
      if (this.engine.dispatch(clone, seat, action).error) return -Infinity;
    } catch (error) {
      crashes.push({ action, error });
      return -Infinity;
    }
    return evaluate(clone, seat, profile.archetype);
  }
}

/** Exception levée par le moteur pendant une simulation (bug moteur). */
interface SimulationCrash {
  action: GameAction;
  error: unknown;
}

function describe(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}

/** Zone de mon terrain où l'action fait arriver un monstre (invocation, évolution). */
function arrivalZone(
  game: GameState,
  seat: Seat,
  action: GameAction,
): number | null {
  if (action.type === 'summon' && !action.onOpponentSide)
    return action.zoneIndex;
  if (action.type === 'evolve') {
    const zone = seatPlayer(game, seat).monsterZones.findIndex(
      (m) => m?.instanceId === action.targetInstanceId,
    );
    return zone === -1 ? null : zone;
  }
  return null;
}

/** Copie jouable de l'état ; le journal et les événements n'influent pas sur le score. */
function cloneForSimulation(game: GameState): GameState {
  return structuredClone({ ...game, log: [], pendingEvents: [] });
}

/** Garde une main qui peut invoquer dès le premier tour, sinon la refait. */
function mulliganChoice(
  game: GameState,
  seat: Seat,
  valid: Scored[],
): GameAction {
  const hand = seatPlayer(game, seat).hand;
  const playable = hand.some(
    (c) =>
      c.baseCard.type === CardType.MONSTER &&
      canSummonFromHand(c.baseCard) &&
      (c.baseCard.cost ?? 0) <= hand.length - 1,
  );
  const wanted = valid.find(
    (v) => v.action.type === 'mulligan' && v.action.redraw === !playable,
  );
  return (wanted ?? valid[0]).action;
}

/** Aucun candidat valide : l'action qui fait avancer la partie. */
function fallbackAction(game: GameState, seat: Seat): GameAction {
  const me = seatPlayer(game, seat);
  const choice = activeChoice(game);
  if (choice && choice.forUserId === me.userId) {
    const fresh = freshCandidates(game, choice);
    return {
      type: 'pick_cards',
      instanceIds: fresh
        .slice(0, Math.min(choice.count, fresh.length))
        .map((c) => c.instanceId),
    };
  }
  if (game.phase === 'mulligan' && !me.mulliganDone)
    return { type: 'mulligan', redraw: false };
  if (game.phase === 'end' && me.hand.length > HAND_LIMIT)
    return { type: 'discard', handIndex: 0 };
  return { type: 'end_phase' };
}

/** Repli si même le calcul du repli échoue (état incohérent). */
function safeFallback(game: GameState, seat: Seat): GameAction {
  try {
    return fallbackAction(game, seat);
  } catch {
    return { type: 'end_phase' };
  }
}
