import { PuzzleObjectiveType as T } from '@pipou/shared';
import type { PuzzleObjective, PuzzleOutcome } from '@pipou/shared';
import type { GameState } from '../fights/interfaces/game-state.interface';

/** Ce que l'état final seul ne dit pas : primes de départ, monstres réellement détruits. */
export interface PuzzleTrack {
  startPrimes: number;
  destroyed: string[];
}

export function startTrack(game: GameState): PuzzleTrack {
  return { startPrimes: game.player1.primes, destroyed: [] };
}

/** À appeler après chaque dispatch, avant de vider `pendingEvents`. */
export function recordEvents(track: PuzzleTrack, game: GameState): void {
  for (const e of game.pendingEvents)
    if (e.kind === 'monster_destroyed') track.destroyed.push(e.instanceId);
}

export function objectiveMet(
  o: PuzzleObjective,
  game: GameState,
  track: PuzzleTrack,
): boolean {
  switch (o.type) {
    case T.WIN_GAME:
      return game.winner === game.player1.userId;
    case T.DESTROY_MONSTER:
      return (
        !!o.targetInstanceId && track.destroyed.includes(o.targetInstanceId)
      );
    case T.CLEAR_ENEMY_BOARD:
      return game.player2.monsterZones.every((m) => m === null);
    case T.TAKE_PRIMES:
      // `primes` = primes restant à prendre : elles baissent à chaque prise
      return track.startPrimes - game.player1.primes >= (o.primes ?? 1);
  }
}

export function puzzleOutcome(
  o: PuzzleObjective,
  game: GameState,
  track: PuzzleTrack,
): PuzzleOutcome {
  if (objectiveMet(o, game, track)) return 'solved';
  const turnOver =
    game.phase === 'finished' || game.currentTurnUserId !== game.player1.userId;
  return turnOver ? 'failed' : 'ongoing';
}

export function validateStart(game: GameState): string | null {
  if (game.currentTurnUserId !== game.player1.userId)
    return 'Le défi doit commencer au tour du joueur 1.';
  if (game.phase !== 'main')
    return 'Le défi doit commencer en phase principale.';
  if (game.pendingChoices.length > 0)
    return 'Un choix est en attente : termine-le avant d’enregistrer.';
  return null;
}

export function validateObjective(
  o: PuzzleObjective,
  game: GameState,
): string | null {
  const enemies = game.player2.monsterZones.filter((m) => m !== null);
  switch (o.type) {
    case T.WIN_GAME:
      return null;
    case T.DESTROY_MONSTER:
      return enemies.some((m) => m.instanceId === o.targetInstanceId)
        ? null
        : 'La cible doit être un monstre adverse du plateau de départ.';
    case T.CLEAR_ENEMY_BOARD:
      return enemies.length > 0 ? null : 'Aucun monstre adverse à détruire.';
    case T.TAKE_PRIMES: {
      const n = o.primes ?? 0;
      return Number.isInteger(n) && n >= 1 && n <= game.player1.primes
        ? null
        : `Le nombre de primes doit être entre 1 et ${game.player1.primes}.`;
    }
    default:
      return 'Objectif inconnu.';
  }
}
