import type {
  Archetype,
  GameAction,
  GameRecordActor,
  GameRecordMode,
  GameRecordSummary,
  MatchEndReason,
  Seat,
} from '@pipou/shared';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { CardIndex } from './summary';

/** Jeton d'injection : FightsService ne dépend pas du module d'enregistrement. */
export const GAME_RECORDER = Symbol('GAME_RECORDER');

export type RecordMeta =
  | { mode: 'pvp' }
  | {
      mode: 'pve';
      aiSeat: Seat;
      level: number;
      archetype: Archetype;
      opponentId: number;
    };

/** Lu avant un coup, rendu après s'il est accepté. */
export interface MoveTicket {
  matchId: number;
  seat: Seat;
  /** null : timeout appliqué par le moteur. */
  action: GameAction | null;
  /** État avant le coup ; null si la partie n'a pas de trace. */
  snapshot: string | null;
  actorCardId: number | null;
  before: CardIndex;
}

export interface GameRecorderPort {
  begin(game: GameState, meta: RecordMeta): void;
  before(
    game: GameState,
    seat: Seat,
    action: GameAction | null,
  ): MoveTicket | null;
  after(game: GameState, ticket: MoveTicket, by: GameRecordActor): void;
  finish(game: GameState): void;
}

export interface NewGameRecord {
  matchId: number;
  mode: GameRecordMode;
  player1Id: number;
  player2Id: number | null;
  winnerSeat: Seat | null;
  endReason: MatchEndReason | null;
  turns: number;
  moves: number;
  summary: GameRecordSummary;
  trace: Buffer | null;
  traceBytes: number;
  formatVersion: 1;
  startedAt: Date;
  endedAt: Date;
}

export interface GameRecordStore {
  save(record: NewGameRecord): Promise<void>;
  /** Somme des tailles de traces déjà stockées (plafond global). */
  totalTraceBytes(): Promise<number>;
}
