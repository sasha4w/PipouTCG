import type { CombatMode, GamePhase, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from './monster.factory';

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

let nextInstance = 1;

export function instanceOf(card: Card, ownerId: number): CardInstance {
  return {
    instanceId: `${card.name}#${nextInstance++}`,
    baseCard: card,
    ownerId,
  };
}

export function buildMonster(
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

/** Carte sans effet, pour remplir le deck et les Primes quand le plateau ne les précise pas. */
export type FillerCard = (name?: string) => Card;

export function buildPlayer(
  spec: PlayerSpec = {},
  userId: number,
  username: string,
  fillerCard: FillerCard,
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
    transformUsedThisTurn: false,
    hasDrawnThisTurn: false,
    handLimitEnforced: false,
    ready: true,
    mulliganDone: true,
    freeSummonInstanceIds: [],
  };
}

export interface SeatSpec {
  spec?: PlayerSpec;
  userId: number;
  username: string;
  socketId?: string;
}

export interface GameSpec {
  matchId: number;
  p1: SeatSpec;
  p2: SeatSpec;
  phase?: GamePhase;
  /** Joueur actif (p1 par défaut). */
  turn?: Seat;
  turnNumber?: number;
  fillerCard: FillerCard;
}

/** Partie en cours, plateau posé, prête à recevoir des actions. */
export function buildGameState(spec: GameSpec): GameState {
  const seat = (s: SeatSpec): PlayerGameState => {
    const player = buildPlayer(s.spec, s.userId, s.username, spec.fillerCard);
    if (s.socketId !== undefined) player.socketId = s.socketId;
    return player;
  };
  return {
    matchId: spec.matchId,
    player1: seat(spec.p1),
    player2: seat(spec.p2),
    currentTurnUserId:
      (spec.turn ?? 'p1') === 'p1' ? spec.p1.userId : spec.p2.userId,
    phase: spec.phase ?? 'main',
    turnNumber: spec.turnNumber ?? 2,
    log: [],
    pendingChoices: [],
    pendingEvents: [],
    supportSeq: 0,
  };
}
