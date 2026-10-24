import type { FightServer } from '../fight-socket.types';
import { GameState, ClientGameState } from '../interfaces/game-state.interface';
import {
  currentChoice,
  freshCandidates,
  getPlayerState,
  getOpponentState,
} from './game-state.helper';

export function buildClientState(
  game: GameState,
  userId: number,
): ClientGameState {
  const me = getPlayerState(game, userId);
  const opp = getOpponentState(game, userId);

  const choice = currentChoice(game);
  const pendingChoice =
    choice?.forUserId === userId
      ? {
          candidates: freshCandidates(game, choice).map((c) => ({
            instanceId: c.instanceId,
            baseCard: {
              id: c.baseCard.id,
              name: c.baseCard.name,
              type: c.baseCard.type,
              atk: c.baseCard.atk,
              hp: c.baseCard.hp,
              rarity: c.baseCard.rarity,
              supportType: c.baseCard.supportType,
              cost: c.baseCard.cost,
              image: c.baseCard.image ? { url: c.baseCard.image.url } : null,
              description: c.baseCard.description ?? null,
              element: c.baseCard.element ?? null,
              stage: c.baseCard.stage ?? null,
            },
            source: c.source,
          })),
          count: choice.count,
          prompt: choice.prompt,
          promptKey: choice.promptKey,
          promptParams: choice.promptParams,
          resolution: choice.resolution,
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
      title: me.title ?? null,
      primes: me.primes,
      hand: me.hand,
      deckCount: me.deck.length,
      graveyard: me.graveyard,
      banished: me.banished,
      monsterZones: me.monsterZones,
      supportZones: me.supportZones,
      recycleEnergy: me.recycleEnergy,
      transformUsedThisTurn: me.transformUsedThisTurn,
      freeSummonInstanceIds: me.freeSummonInstanceIds,
      mulliganDone: me.mulliganDone,
    },
    opponent: {
      userId: opp.userId,
      username: opp.username,
      title: opp.title ?? null,
      primes: opp.primes,
      handCount: opp.hand.length,
      deckCount: opp.deck.length,
      graveyard: opp.graveyard,
      banished: opp.banished,
      monsterZones: opp.monsterZones,
      supportZones: opp.supportZones,
      mulliganDone: opp.mulliganDone,
    },
    log: game.log.slice(-20),
    events: [...game.pendingEvents],
    winner: game.winner,
    endReason: game.endReason,
    pendingChoice,
    opponentChoosing: !!choice && choice.forUserId !== userId,
  };
}

export function emitGameState(game: GameState, server: FightServer): void {
  server
    .to(game.player1.socketId)
    .emit('fight:state', buildClientState(game, game.player1.userId));
  server
    .to(game.player2.socketId)
    .emit('fight:state', buildClientState(game, game.player2.userId));
  // Joués une seule fois : une reconnexion reçoit l'état sans événements
  game.pendingEvents = [];
}
