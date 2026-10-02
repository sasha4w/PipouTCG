import {
  GameState,
  PlayerGameState,
  MonsterOnBoard,
  CardInstance,
} from '../interfaces/game-state.interface';
import { EffectTrigger } from '@pipou/shared';
import type { Seat } from '@pipou/shared';
import { EffectsResolverService } from '../effects-resolver.service';

const LOG_MAX = 50;

export function addLog(game: GameState, msg: string): void {
  game.log.push(msg);
  if (game.log.length > LOG_MAX) game.log.shift();
}

export function seatPlayer(game: GameState, seat: Seat): PlayerGameState {
  return seat === 'p1' ? game.player1 : game.player2;
}

export function seatOf(game: GameState, userId: number): Seat | null {
  if (game.player1.userId === userId) return 'p1';
  if (game.player2.userId === userId) return 'p2';
  return null;
}

export function getPlayerState(
  game: GameState,
  userId: number,
): PlayerGameState {
  const seat = seatOf(game, userId);
  if (!seat)
    throw new Error(`Joueur ${userId} absent du match ${game.matchId}`);
  return seatPlayer(game, seat);
}

export function getOpponentState(
  game: GameState,
  userId: number,
): PlayerGameState {
  const seat = seatOf(game, userId);
  if (!seat)
    throw new Error(`Joueur ${userId} absent du match ${game.matchId}`);
  return seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
}

export function isCurrentPlayer(game: GameState, userId: number): boolean {
  return game.currentTurnUserId === userId;
}

export function drawCard(game: GameState, userId: number): CardInstance | null {
  const player = getPlayerState(game, userId);
  const card = player.deck.shift() ?? null;
  if (card) player.hand.push(card);
  return card;
}

export function applyDamage(target: MonsterOnBoard, dmg: number): number {
  const reduced = target.damageReduction
    ? Math.ceil(dmg / target.damageReduction)
    : dmg;
  target.currentHp -= reduced;
  return reduced;
}

export function gainPrime(
  game: GameState,
  userId: number,
  monsterName: string,
): void {
  const player = getPlayerState(game, userId);
  if (player.primeDeck.length === 0) return;
  const prime = player.primeDeck.shift()!;
  player.primes -= 1;
  player.hand.push(prime);
  addLog(
    game,
    `🏆 ${player.username} récupère une Prime avec ${monsterName} ! (${player.primes} restante${player.primes > 1 ? 's' : ''})`,
  );
}

export function removeMonster(
  player: PlayerGameState,
  instanceId: string,
  game: GameState,
  effectsResolver: EffectsResolverService,
): void {
  const idx = player.monsterZones.findIndex(
    (m) => m?.instanceId === instanceId,
  );
  if (idx === -1) return;
  const monster = player.monsterZones[idx]!;

  const log: string[] = [];
  effectsResolver.resolve(monster.card, EffectTrigger.ON_DEATH, {
    game,
    ownerUserId: player.userId,
    sourceMonster: monster,
    log,
  });
  log.forEach((l) => addLog(game, l));

  player.graveyard.push(...monster.equipments, monster.card);
  player.monsterZones[idx] = null;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Joueur ayant récupéré toutes ses Primes ; winnerUserId null si les deux (match nul). */
export function checkWinCondition(
  game: GameState,
): { winnerUserId: number | null } | null {
  const p1Done = game.player1.primes <= 0;
  const p2Done = game.player2.primes <= 0;
  if (p1Done && p2Done) return { winnerUserId: null };
  if (p1Done) return { winnerUserId: game.player1.userId };
  if (p2Done) return { winnerUserId: game.player2.userId };
  return null;
}
