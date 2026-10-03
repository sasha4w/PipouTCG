import type { Card } from '../cards/card.entity';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { SeatEntry } from '../fights/helpers/game-factory';

/** Partie sauvegardée : JSON où chaque `baseCard` est remplacé par l'id de la carte. */
export type SerializedGame = Record<string, unknown>;

/** Champs portant un userId, à réattribuer au chargement. */
const USER_ID_KEYS = new Set([
  'userId',
  'ownerId',
  'ownerUserId',
  'currentTurnUserId',
  'forUserId',
  'winner',
]);

export function serializeGame(game: GameState): SerializedGame {
  return JSON.parse(
    JSON.stringify(game, (key, value: unknown) =>
      key === 'baseCard' ? (value as Card).id : value,
    ),
  ) as SerializedGame;
}

export function collectCardIds(state: SerializedGame): number[] {
  const ids = new Set<number>();
  JSON.stringify(state, (key, value: unknown) => {
    if (key === 'baseCard' && typeof value === 'number') ids.add(value);
    return value;
  });
  return [...ids];
}

/**
 * Reconstruit une partie : cartes rechargées depuis la BDD (effets à jour),
 * sièges réattribués au nouvel admin.
 */
export function deserializeGame(
  state: SerializedGame,
  cards: Map<number, Card>,
  seats: { matchId: number; p1: SeatEntry; p2: SeatEntry },
): GameState {
  const raw = state as unknown as GameState;
  const remap = new Map<number, number>([
    [raw.player1.userId, seats.p1.userId],
    [raw.player2.userId, seats.p2.userId],
  ]);

  const game = JSON.parse(JSON.stringify(state), (key, value: unknown) => {
    if (key === 'baseCard' && typeof value === 'number') {
      const card = cards.get(value);
      if (!card) throw new Error(`Carte #${value} introuvable`);
      return card;
    }
    if (USER_ID_KEYS.has(key) && typeof value === 'number')
      return remap.get(value) ?? value;
    return value;
  }) as GameState;

  game.matchId = seats.matchId;
  for (const [player, seat] of [
    [game.player1, seats.p1],
    [game.player2, seats.p2],
  ] as const) {
    player.username = seat.username;
    player.socketId = seat.socketId;
  }
  return game;
}
