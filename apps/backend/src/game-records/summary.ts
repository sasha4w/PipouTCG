import type {
  Archetype,
  GameAction,
  GameRecordCardStats,
  GameRecordMode,
  GameRecordSeat,
  GameRecordSummary,
  Seat,
} from '@pipou/shared';
import type {
  CardInstance,
  GameState,
  PlayerGameState,
} from '../fights/interfaces/game-state.interface';
import { seatOf, seatPlayer } from '../fights/helpers/game-state.helper';

/** instanceId (carte, ou monstre posé : il a son propre id) → id de la carte de base. */
export type CardIndex = Map<string, number>;

function playerCards(p: PlayerGameState): CardInstance[] {
  const cards = [
    ...p.hand,
    ...p.deck,
    ...p.primeDeck,
    ...p.graveyard,
    ...p.banished,
  ];
  for (const m of p.monsterZones) if (m) cards.push(m.card, ...m.equipments);
  for (const s of p.supportZones) if (s) cards.push(s);
  return cards;
}

export function cardIndex(game: GameState): CardIndex {
  const index: CardIndex = new Map();
  for (const p of [game.player1, game.player2]) {
    for (const c of playerCards(p)) index.set(c.instanceId, c.baseCard.id);
    for (const m of p.monsterZones)
      if (m) index.set(m.instanceId, m.card.baseCard.id);
  }
  return index;
}

/** Composition du deck : toutes les cartes du joueur, où qu'elles soient. */
export function deckOf(
  p: PlayerGameState,
): { cardId: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const c of playerCards(p))
    counts.set(c.baseCard.id, (counts.get(c.baseCard.id) ?? 0) + 1);
  return [...counts]
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((a, b) => a.cardId - b.cardId);
}

export function dominantArchetype(p: PlayerGameState): Archetype | null {
  const counts = new Map<Archetype, number>();
  for (const c of playerCards(p)) {
    const a = c.baseCard.archetype;
    if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  let best: Archetype | null = null;
  let most = 0;
  for (const [a, n] of counts)
    if (n > most) {
      best = a;
      most = n;
    }
  return best;
}

export function emptySummary(
  mode: GameRecordMode,
  seats: Record<Seat, GameRecordSeat>,
): GameRecordSummary {
  return { v: 1, mode, seats, cards: { p1: {}, p2: {} } };
}

/** Carte qui agit, lue avant le coup (la main change ensuite). */
export function actingCardId(
  game: GameState,
  seat: Seat,
  action: GameAction | null,
  index: CardIndex,
): number | null {
  if (!action) return null;
  switch (action.type) {
    case 'attack':
      return index.get(action.attackerInstanceId) ?? null;
    case 'summon':
    case 'play_support':
    case 'evolve':
    case 'recycle':
      return seatPlayer(game, seat).hand[action.handIndex]?.baseCard.id ?? null;
    default:
      return null;
  }
}

/**
 * Coups dont la carte qui agit est créditée des monstres adverses détruits.
 * Approximation assumée : une destruction par une Charge en fin de phase ou
 * par un choix de cartes n'est créditée à personne (elle compte dans `destroyed`).
 */
const KILLER_ACTIONS = new Set<GameAction['type']>([
  'attack',
  'summon',
  'play_support',
  'evolve',
]);

export interface MoveFacts {
  seat: Seat;
  action: GameAction | null;
  actorCardId: number | null;
  /** Index construit avant le coup : retrouve les monstres détruits. */
  before: CardIndex;
}

function bump(
  summary: GameRecordSummary,
  seat: Seat,
  cardId: number,
  key: keyof GameRecordCardStats,
): void {
  const stats = (summary.cards[seat][cardId] ??= {});
  stats[key] = (stats[key] ?? 0) + 1;
}

/** Met à jour le résumé après un coup accepté, d'après l'action et ses événements. */
export function applyMove(
  summary: GameRecordSummary,
  game: GameState,
  move: MoveFacts,
): void {
  const { seat, action, actorCardId } = move;
  if (action && actorCardId !== null) {
    if (action.type === 'play_support')
      bump(summary, seat, actorCardId, 'supported');
    if (action.type === 'evolve') bump(summary, seat, actorCardId, 'evolved');
    if (action.type === 'recycle') bump(summary, seat, actorCardId, 'recycled');
  }
  const after = cardIndex(game);
  for (const e of game.pendingEvents) {
    if (e.kind !== 'monster_summoned' && e.kind !== 'monster_destroyed')
      continue;
    const owner = seatOf(game, e.ownerId);
    const cardId = after.get(e.instanceId) ?? move.before.get(e.instanceId);
    if (!owner || cardId === undefined) continue;
    if (e.kind === 'monster_summoned') {
      // Une évolution émet aussi monster_summoned : elle compte `evolved`, pas une invocation.
      if (action?.type !== 'evolve') bump(summary, owner, cardId, 'summoned');
      continue;
    }
    bump(summary, owner, cardId, 'destroyed');
    if (
      owner !== seat &&
      action &&
      actorCardId !== null &&
      KILLER_ACTIONS.has(action.type)
    )
      bump(summary, seat, actorCardId, 'kills');
  }
}
