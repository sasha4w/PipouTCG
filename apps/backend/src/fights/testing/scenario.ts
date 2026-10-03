import type { CombatMode, GamePhase, Seat } from '@pipou/shared';
import type { EngineResult, GameEngine } from '../engine/game-engine';
import type { Card } from '../../cards/card.entity';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from '../helpers/monster.factory';
import { fillerCard } from './cards';

export interface MonsterSpec {
  card: Card;
  mode?: CombatMode;
  currentHp?: number;
  equipments?: Card[];
  /** false par défaut : le monstre est en jeu depuis un tour précédent. */
  summonedThisTurn?: boolean;
  patch?: Partial<MonsterOnBoard>;
}

export interface PlayerSpec {
  hand?: Card[];
  /** Ordre de pioche : deck[0] est la prochaine carte piochée. 10 cartes neutres par défaut. */
  deck?: Card[];
  graveyard?: Card[];
  /** Primes restant à récupérer (6 par défaut). */
  primes?: number;
  monsters?: (MonsterSpec | Card | null)[];
  supports?: (Card | null)[];
  recycleEnergy?: number;
}

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

let nextInstance = 1;

export function instanceOf(card: Card, ownerId: number): CardInstance {
  return {
    instanceId: `${card.name}#${nextInstance++}`,
    baseCard: card,
    ownerId,
  };
}

function buildMonster(
  spec: MonsterSpec | Card,
  ownerId: number,
): MonsterOnBoard {
  const s: MonsterSpec = 'card' in spec ? spec : { card: spec };
  const monster = createMonsterOnBoard(instanceOf(s.card, ownerId), {
    instanceId: `${s.card.name}@board#${nextInstance++}`,
  });
  monster.mode = s.mode ?? 'attack';
  monster.summonedThisTurn = s.summonedThisTurn ?? false;
  monster.currentHp = s.currentHp ?? s.card.hp;
  monster.equipments = (s.equipments ?? []).map((e) => instanceOf(e, ownerId));
  Object.assign(monster, s.patch);
  return monster;
}

function padTo3<T>(items: (T | null)[]): (T | null)[] {
  const out = [...items];
  while (out.length < 3) out.push(null);
  return out;
}

function buildPlayer(
  spec: PlayerSpec = {},
  userId: number,
  username: string,
): PlayerGameState {
  const primes = spec.primes ?? 6;
  return {
    userId,
    username,
    socketId: `socket-${userId}`,
    primes,
    primeDeck: Array.from({ length: primes }, () =>
      instanceOf(fillerCard('Prime'), userId),
    ),
    hand: (spec.hand ?? []).map((c) => instanceOf(c, userId)),
    deck: (spec.deck ?? Array.from({ length: 10 }, () => fillerCard())).map(
      (c) => instanceOf(c, userId),
    ),
    graveyard: (spec.graveyard ?? []).map((c) => instanceOf(c, userId)),
    banished: [],
    monsterZones: padTo3(spec.monsters ?? []).map((m) =>
      m ? buildMonster(m, userId) : null,
    ),
    supportZones: padTo3(spec.supports ?? []).map((c) =>
      c ? instanceOf(c, userId) : null,
    ),
    recycleEnergy: spec.recycleEnergy ?? 0,
    hasDrawnThisTurn: false,
    handLimitEnforced: false,
    ready: true,
    mulliganDone: true,
    freeSummonInstanceIds: [],
  };
}

/** Partie en cours, prête à recevoir des actions (phase main du tour 2 par défaut). */
export function scenario(spec: ScenarioSpec = {}): GameState {
  return {
    matchId: 1,
    player1: buildPlayer(spec.p1, P1_ID, 'Alice'),
    player2: buildPlayer(spec.p2, P2_ID, 'Bob'),
    currentTurnUserId: (spec.turn ?? 'p1') === 'p1' ? P1_ID : P2_ID,
    phase: spec.phase ?? 'main',
    turnNumber: spec.turnNumber ?? 2,
    log: [],
    pendingChoices: [],
  };
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
