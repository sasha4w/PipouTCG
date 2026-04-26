import { Server } from 'socket.io';
import { GameState, ClientGameState } from '../interfaces/game-state.interface';
import { getPlayerState, getOpponentState } from './game-state.helper';

export function buildClientState(
  game: GameState,
  userId: number,
): ClientGameState {
  const me = getPlayerState(game, userId);
  const opp = getOpponentState(game, userId);

  const pendingChoice =
    game.pendingChoice?.forUserId === userId
      ? {
          candidates: game.pendingChoice.candidates.map((c) => ({
            instanceId: c.instanceId,
            baseCard: {
              id: c.baseCard.id,
              name: c.baseCard.name,
              type: c.baseCard.type,
              atk: c.baseCard.atk,
              hp: c.baseCard.hp,
              rarity: c.baseCard.rarity,
              supportType: c.baseCard.supportType,
            },
            source: c.source,
          })),
          count: game.pendingChoice.count,
          prompt: game.pendingChoice.prompt,
        }
      : undefined;

  return {
    matchId: game.matchId,
    phase: game.phase,
    turnNumber: game.turnNumber,
    isMyTurn: game.currentTurnUserId === userId,
    me: {
      userId: me.userId,
      username: me.username,
      primes: me.primes,
      hand: me.hand,
      deckCount: me.deck.length,
      graveyard: me.graveyard,
      banished: me.banished,
      monsterZones: me.monsterZones,
      supportZones: me.supportZones,
      recycleEnergy: me.recycleEnergy,
      freeSummonAvailable: me.freeSummonAvailable, // ← ajoute ça
    },
    opponent: {
      userId: opp.userId,
      username: opp.username,
      primes: opp.primes,
      handCount: opp.hand.length,
      deckCount: opp.deck.length,
      graveyard: opp.graveyard,
      banished: opp.banished,
      monsterZones: opp.monsterZones,
      supportZones: opp.supportZones,
    },
    log: game.log.slice(-20),
    winner: game.winner,
    endReason: game.endReason,
    pendingChoice,
  };
}

export function emitGameState(game: GameState, server: Server): void {
  server
    .to(game.player1.socketId)
    .emit('fight:state', buildClientState(game, game.player1.userId));
  server
    .to(game.player2.socketId)
    .emit('fight:state', buildClientState(game, game.player2.userId));
}
