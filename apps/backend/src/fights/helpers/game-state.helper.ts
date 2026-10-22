import {
  GameState,
  PlayerGameState,
  MonsterOnBoard,
  CardInstance,
  ChoiceCandidate,
  PendingChoice,
} from '../interfaces/game-state.interface';
import { COUNTER_OFFENSIVE_PER_TURN, GUARD_MAX_TURNS } from '@pipou/shared';
import type { Seat } from '@pipou/shared';

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

/**
 * Candidats encore présents dans leur pile d'origine : une pioche ou un choix
 * précédent a pu les déplacer depuis la mise en file du choix.
 */
export function freshCandidates(
  game: GameState,
  choice: PendingChoice,
): ChoiceCandidate[] {
  const owner = getPlayerState(game, choice.forUserId);
  const ids = (source: ChoiceCandidate['source']): string[] => {
    switch (source) {
      case 'deck':
        return owner.deck.map((c) => c.instanceId);
      case 'graveyard':
        return owner.graveyard.map((c) => c.instanceId);
      case 'hand':
        return owner.hand.map((c) => c.instanceId);
      case 'board':
        return owner.monsterZones.flatMap((m) => (m ? [m.instanceId] : []));
    }
  };
  return choice.candidates.filter((c) => ids(c.source).includes(c.instanceId));
}

/**
 * Choix à résoudre en premier, s'il y en a un. Les choix dont plus aucun
 * candidat n'est disponible sont abandonnés pour ne pas bloquer la partie.
 */
export function currentChoice(game: GameState): PendingChoice | undefined {
  while (
    game.pendingChoices.length > 0 &&
    freshCandidates(game, game.pendingChoices[0]).length === 0
  )
    game.pendingChoices.shift();
  return game.pendingChoices[0];
}

/** Range un choix derrière ceux déjà en attente. */
export function queueChoice(game: GameState, choice: PendingChoice): void {
  game.pendingChoices.push(choice);
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

export function applyDamage(
  target: MonsterOnBoard,
  dmg: number,
  opts: { ignoreReduction?: boolean } = {},
): number {
  const reduced =
    target.damageReduction && !opts.ignoreReduction
      ? Math.ceil(dmg / target.damageReduction)
      : dmg;
  target.currentHp -= reduced;
  return reduced;
}

/** ATK effective : base + bonus (permanents et passifs) + bonus temporaire, jamais négative. */
export function effectiveAtk(m: MonsterOnBoard): number {
  return Math.max(0, m.card.baseCard.atk + m.atkBuff + (m.tempAtkBuff ?? 0));
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

/**
 * Envoie des cartes au cimetière d'un joueur. Les cartes `token` (copies
 * créées en jeu) disparaissent au lieu de l'atteindre.
 */
export function sendToGraveyard(
  player: PlayerGameState,
  ...cards: CardInstance[]
): void {
  player.graveyard.push(...cards.filter((c) => !c.token));
}

/**
 * Sortie de Garde (volontaire ou au bout de GUARD_MAX_TURNS) : le monstre
 * repasse en Attaque, libéré de tout verrou, avec la contre-offensive
 * (+COUNTER_OFFENSIVE_PER_TURN d'ATK par tour tenu, jusqu'à la fin du tour).
 */
export function leaveGuard(m: MonsterOnBoard): void {
  m.tempAtkBuff +=
    COUNTER_OFFENSIVE_PER_TURN * Math.min(m.guardTurns ?? 0, GUARD_MAX_TURNS);
  m.guardTurns = 0;
  m.guardLocked = false;
  m.mode = 'attack';
}
