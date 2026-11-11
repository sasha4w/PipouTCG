import type { GamePhase, Seat } from '@pipou/shared';
import type { EngineResult, GameEngine } from '../engine/game-engine';
import type {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { buildGameState, type PlayerSpec } from '../helpers/board-builder';
import { fillerCard } from './cards';

export { instanceOf } from '../helpers/board-builder';
export type { MonsterSpec, PlayerSpec } from '../helpers/board-builder';

export interface ScenarioSpec {
  p1?: PlayerSpec;
  p2?: PlayerSpec;
  phase?: GamePhase;
  /** Joueur actif (p1 par défaut). */
  turn?: Seat;
  turnNumber?: number;
}

export const P1_ID = 1;
export const P2_ID = 2;

/** Partie en cours, prête à recevoir des actions (phase main du tour 2 par défaut). */
export function scenario(spec: ScenarioSpec = {}): GameState {
  return buildGameState({
    matchId: 1,
    p1: {
      spec: spec.p1,
      userId: P1_ID,
      username: 'Alice',
      socketId: `socket-${P1_ID}`,
    },
    p2: {
      spec: spec.p2,
      userId: P2_ID,
      username: 'Bob',
      socketId: `socket-${P2_ID}`,
    },
    phase: spec.phase,
    turn: spec.turn,
    turnNumber: spec.turnNumber,
    fillerCard,
  });
}

/** Match créé par le matchmaking, decks pas encore soumis. */
export function waitingScenario(): GameState {
  const game = scenario({ phase: 'waiting', turnNumber: 0 });
  for (const p of [game.player1, game.player2]) {
    p.ready = false;
    p.hand = [];
    p.deck = [];
    p.primeDeck = [];
    p.primes = 0;
    p.mulliganDone = false;
  }
  return game;
}

export function seatState(game: GameState, seat: Seat): PlayerGameState {
  return seat === 'p1' ? game.player1 : game.player2;
}

export function monsterNamed(
  game: GameState,
  seat: Seat,
  name: string,
): MonsterOnBoard {
  const found = seatState(game, seat).monsterZones.find(
    (z) => z?.card.baseCard.name === name,
  );
  if (!found) throw new Error(`Aucun monstre « ${name} » chez ${seat}`);
  return found;
}

/** Termine le tour du joueur actif (jusqu'au début du tour suivant). */
export function passTurn(engine: GameEngine, game: GameState): void {
  const seat: Seat = game.currentTurnUserId === P1_ID ? 'p1' : 'p2';
  const turn = game.turnNumber;
  while (game.turnNumber === turn && game.phase !== 'finished') {
    const result = engine.dispatch(game, seat, { type: 'end_phase' });
    if (result.error) throw new Error(result.error);
  }
}

/** Attaque un monstre adverse par son nom, ou attaque directe sans cible. */
export function attackWith(
  engine: GameEngine,
  game: GameState,
  seat: Seat,
  attacker: string,
  target?: string,
): EngineResult {
  const other: Seat = seat === 'p1' ? 'p2' : 'p1';
  const attackerInstanceId = monsterNamed(game, seat, attacker).instanceId;
  return engine.dispatch(
    game,
    seat,
    target
      ? {
          type: 'attack',
          attackerInstanceId,
          targetInstanceId: monsterNamed(game, other, target).instanceId,
        }
      : { type: 'attack', attackerInstanceId, direct: true },
  );
}

export const handNames = (game: GameState, seat: Seat): string[] =>
  seatState(game, seat).hand.map((c) => c.baseCard.name);

export const graveyardNames = (game: GameState, seat: Seat): string[] =>
  seatState(game, seat).graveyard.map((c) => c.baseCard.name);
