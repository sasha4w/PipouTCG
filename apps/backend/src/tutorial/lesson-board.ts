import { ActionType, EffectTrigger, type Seat } from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import { BuffsCalculatorService } from '../fights/buffs-calculator.service';
import { EffectsResolverService } from '../fights/effects-resolver.service';
import { normalizeCardName } from '../fights/effects/card-name';
import type { GameState } from '../fights/interfaces/game-state.interface';
import {
  buildGameState,
  type MonsterSpec,
  type PlayerSpec,
} from '../fights/helpers/board-builder';
import type {
  Lesson,
  MonsterSpecByName,
  PlayerSpecByName,
} from './lesson.types';

/** Carte inerte qui remplit les Primes ; jamais piochée dans une leçon qui ne le dit pas. */
export const PRIME_FILLER = 'Lieutenant Bidouille';

/**
 * États que l'arrivée d'un monstre lui donne durablement (Provocation, immunités…).
 * Un monstre déjà posé au départ d'une leçon les porte comme s'il avait été invoqué
 * plus tôt ; ses autres effets d'arrivée (dégâts, pioche…) ne se rejouent pas.
 */
const LASTING_STATE_ACTIONS: ReadonlySet<string> = new Set([
  ActionType.SET_TAUNT,
  ActionType.SET_PIERCING,
  ActionType.SET_DEBUFF_IMMUNITY,
  ActionType.SET_COMBAT_IMMUNITY,
  ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY,
  ActionType.SET_SUPPORT_DESTROY_IMMUNITY,
  ActionType.SET_SUPPORT_DEBUFF_IMMUNITY,
  ActionType.SET_MONSTER_DEBUFF_IMMUNITY,
  ActionType.SET_MONSTER_STATUS_IMMUNITY,
  ActionType.SET_DAMAGE_REDUCTION,
  ActionType.FORCE_ATTACK_MODE,
  ActionType.IGNORE_TAUNT,
]);

function applyLastingState(game: GameState): void {
  const effects = new EffectsResolverService();
  for (const player of [game.player1, game.player2])
    for (const monster of player.monsterZones) {
      if (!monster) continue;
      const base = monster.card.baseCard;
      const kept = (base.effects ?? [])
        .filter((e) => e.trigger === EffectTrigger.ON_SUMMON)
        .map((e) => ({
          ...e,
          actions: e.actions.filter((a) => LASTING_STATE_ACTIONS.has(a.type)),
        }))
        .filter((e) => e.actions.length > 0);
      if (!kept.length) continue;
      effects.resolve(
        { ...monster.card, baseCard: { ...base, effects: kept } },
        EffectTrigger.ON_SUMMON,
        {
          game,
          ownerUserId: monster.ownerUserId ?? player.userId,
          sourceMonster: monster,
          log: [],
        },
      );
    }
  new BuffsCalculatorService().recalculate(game);
}

export type CardResolver = (name: string) => Card;

/** Résolveur à partir d'une liste de cartes (base de données ou instantané de test). */
export function cardResolver(cards: readonly Card[]): CardResolver {
  const byName = new Map(cards.map((c) => [normalizeCardName(c.name), c]));
  return (name) => {
    const card = byName.get(normalizeCardName(name));
    if (!card) throw new Error(`Leçon : carte « ${name} » introuvable`);
    return card;
  };
}

function playerSpec(
  spec: PlayerSpecByName,
  card: CardResolver,
  ownerOf: (seat: Seat) => number,
): PlayerSpec {
  const cards = (names?: string[]) => names?.map(card);
  const monster = (
    m: MonsterSpecByName | string | null,
  ): MonsterSpec | Card | null => {
    if (!m) return null;
    if (typeof m === 'string') return card(m);
    return {
      card: card(m.card),
      mode: m.mode,
      currentHp: m.currentHp,
      equipments: cards(m.equipments),
      summonedThisTurn: m.summonedThisTurn,
      patch: {
        ...(m.implantedBy && { ownerUserId: ownerOf(m.implantedBy) }),
        ...(m.turnCounter !== undefined && { turnCounter: m.turnCounter }),
      },
    };
  };
  return {
    ...spec,
    hand: cards(spec.hand),
    deck: cards(spec.deck),
    graveyard: cards(spec.graveyard),
    monsters: spec.monsters?.map(monster),
    supports: spec.supports?.map((s) => (s ? card(s) : null)),
  };
}

export interface LessonGameIds {
  matchId: number;
  userId: number;
  username: string;
  /** Identifiant (négatif) de l'adversaire scripté. */
  opponentId: number;
  opponentName: string;
}

/** Plateau de départ d'une leçon : partie en cours, déjà au tour du joueur. */
export function buildLessonGame(
  lesson: Lesson,
  card: CardResolver,
  ids: LessonGameIds,
): GameState {
  const { board } = lesson;
  const ownerOf = (seat: Seat) => (seat === 'p1' ? ids.userId : ids.opponentId);
  const game = buildGameState({
    matchId: ids.matchId,
    p1: {
      spec: playerSpec(board.p1, card, ownerOf),
      userId: ids.userId,
      username: ids.username,
    },
    p2: {
      spec: playerSpec(board.p2, card, ownerOf),
      userId: ids.opponentId,
      username: ids.opponentName,
      socketId: `ai:${ids.matchId}`,
    },
    phase: board.phase,
    turn: board.turn,
    turnNumber: board.turnNumber,
    fillerCard: () => card(PRIME_FILLER),
  });
  applyLastingState(game);
  return game;
}
