import type {
  GameState,
  PlayerGameState,
} from '../interfaces/game-state.interface';

/** Joueur assis à une table : identité et socket de notification. */
export interface SeatEntry {
  userId: number;
  username: string;
  socketId: string;
}

/** Joueur sans deck, en attente de sa soumission. */
export function createPlayerState(entry: SeatEntry): PlayerGameState {
  return {
    userId: entry.userId,
    username: entry.username,
    socketId: entry.socketId,
    primes: 0,
    primeDeck: [],
    hand: [],
    deck: [],
    graveyard: [],
    banished: [],
    monsterZones: [null, null, null],
    supportZones: [null, null, null],
    recycleEnergy: 0,
    hasDrawnThisTurn: false,
    handLimitEnforced: false,
    ready: false,
    mulliganDone: false,
    freeSummonInstanceIds: [],
  };
}

/** Partie créée, decks pas encore installés (phase waiting). */
export function createGameState(
  matchId: number,
  p1: SeatEntry,
  p2: SeatEntry,
): GameState {
  return {
    matchId,
    player1: createPlayerState(p1),
    player2: createPlayerState(p2),
    currentTurnUserId: p1.userId,
    phase: 'waiting',
    turnNumber: 0,
    log: [],
    pendingChoices: [],
  };
}
