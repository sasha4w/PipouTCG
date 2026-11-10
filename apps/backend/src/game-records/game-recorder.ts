import { Logger } from '@nestjs/common';
import type {
  GameAction,
  GameRecordActor,
  GameRecordSeat,
  GameRecordSummary,
  Seat,
} from '@pipou/shared';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { seatOf, seatPlayer } from '../fights/helpers/game-state.helper';
import type {
  GameRecorderPort,
  GameRecordStore,
  MoveTicket,
  RecordMeta,
} from './game-recorder.port';
import {
  actingCardId,
  applyMove,
  cardIndex,
  deckOf,
  dominantArchetype,
  emptySummary,
} from './summary';
import { TraceWriter, snapshotState } from './trace';

export interface RecorderOptions {
  enabled: boolean;
  maxTotalBytes: number;
  maxEntries: number;
  maxOpenTraces: number;
}

const MB = 1024 * 1024;

export function recorderOptions(env: NodeJS.ProcessEnv): RecorderOptions {
  const mb = Number(env.GAME_RECORD_MAX_MB);
  return {
    enabled: env.GAME_RECORDING !== 'off',
    maxTotalBytes: (Number.isFinite(mb) && mb > 0 ? mb : 500) * MB,
    maxEntries: 3000,
    maxOpenTraces: 30,
  };
}

interface Recording {
  meta: RecordMeta;
  startedAt: Date;
  /** Construit au premier coup (decks en place) ou à la fin. */
  summary: GameRecordSummary | null;
  trace: TraceWriter | null;
  entries: number;
}

/**
 * Enregistre les parties en cours. Ne doit jamais gêner une partie : toute
 * erreur est journalisée et abandonne l'enregistrement de cette partie seule.
 */
export class GameRecorder implements GameRecorderPort {
  private readonly logger = new Logger(GameRecorder.name);
  private readonly games = new Map<number, Recording>();
  private usedBytes = 0;

  constructor(
    private readonly store: GameRecordStore,
    private readonly options: RecorderOptions,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (options.enabled)
      store.totalTraceBytes().then(
        (bytes) => (this.usedBytes += bytes),
        (err: unknown) => this.warn('taille des traces illisible', err),
      );
  }

  begin(game: GameState, meta: RecordMeta): void {
    if (!this.options.enabled) return;
    this.guard(game.matchId, () => {
      const traced =
        this.usedBytes < this.options.maxTotalBytes &&
        this.openTraces() < this.options.maxOpenTraces;
      this.games.set(game.matchId, {
        meta,
        startedAt: this.now(),
        summary: null,
        trace: traced ? new TraceWriter() : null,
        entries: 0,
      });
    });
  }

  before(
    game: GameState,
    seat: Seat,
    action: GameAction | null,
  ): MoveTicket | null {
    const rec = this.games.get(game.matchId);
    if (!rec) return null;
    return (
      this.guard(game.matchId, () => {
        this.ensureHeader(rec, game);
        const before = cardIndex(game);
        return {
          matchId: game.matchId,
          seat,
          action,
          snapshot: rec.trace ? snapshotState(game) : null,
          actorCardId: actingCardId(game, seat, action, before),
          before,
        };
      }) ?? null
    );
  }

  after(game: GameState, ticket: MoveTicket, by: GameRecordActor): void {
    const rec = this.games.get(ticket.matchId);
    if (!rec) return;
    this.guard(ticket.matchId, () => {
      applyMove(rec.summary!, game, ticket);
      rec.entries += 1;
      if (!rec.trace || ticket.snapshot === null) return;
      if (rec.entries > this.options.maxEntries) {
        rec.trace.abort();
        rec.trace = null;
        return;
      }
      const action = ticket.action
        ? `,"action":${JSON.stringify(ticket.action)}`
        : '';
      rec.trace.writeLine(
        `{"i":${rec.entries},"seat":"${ticket.seat}","by":"${by}"${action},"state":${ticket.snapshot}}`,
      );
    });
  }

  finish(game: GameState): void {
    const rec = this.games.get(game.matchId);
    if (!rec) return;
    this.guard(game.matchId, () => {
      this.ensureHeader(rec, game);
      this.games.delete(game.matchId);
      this.persist(rec, game).catch((err: unknown) =>
        this.warn(`partie ${game.matchId} non enregistrée`, err),
      );
    });
  }

  private async persist(rec: Recording, game: GameState): Promise<void> {
    const winnerSeat = game.winner == null ? null : seatOf(game, game.winner);
    let trace: Buffer | null = null;
    if (rec.trace) {
      rec.trace.writeLine(
        JSON.stringify({
          end: {
            winner: winnerSeat,
            endReason: game.endReason ?? null,
            primes: { p1: game.player1.primes, p2: game.player2.primes },
          },
        }),
      );
      trace = await rec.trace.finish();
      this.usedBytes += trace.length;
    }
    const summary = rec.summary!;
    await this.store.save({
      matchId: game.matchId,
      mode: rec.meta.mode,
      player1Id: game.player1.userId,
      player2Id: summary.seats.p2.kind === 'human' ? game.player2.userId : null,
      winnerSeat,
      endReason: game.endReason ?? null,
      turns: game.turnNumber,
      moves: rec.entries,
      summary,
      trace,
      traceBytes: trace?.length ?? 0,
      formatVersion: 1,
      startedAt: rec.startedAt,
      endedAt: this.now(),
    });
  }

  private ensureHeader(rec: Recording, game: GameState): void {
    if (rec.summary) return;
    const seats = {
      p1: this.seatInfo(rec.meta, game, 'p1'),
      p2: this.seatInfo(rec.meta, game, 'p2'),
    };
    rec.summary = emptySummary(rec.meta.mode, seats);
    rec.trace?.writeLine(JSON.stringify({ v: 1, mode: rec.meta.mode, seats }));
  }

  private seatInfo(
    meta: RecordMeta,
    game: GameState,
    seat: Seat,
  ): GameRecordSeat {
    const p = seatPlayer(game, seat);
    const deck = deckOf(p);
    if (meta.mode === 'pve' && meta.aiSeat === seat)
      return {
        kind: 'ai',
        archetype: meta.archetype,
        deck,
        level: meta.level,
        opponentId: meta.opponentId,
      };
    return {
      kind: 'human',
      userId: p.userId,
      archetype: dominantArchetype(p),
      deck,
    };
  }

  private openTraces(): number {
    let n = 0;
    for (const r of this.games.values()) if (r.trace) n += 1;
    return n;
  }

  /** Exécute `fn` ; en cas d'erreur, abandonne l'enregistrement de la partie. */
  private guard<T>(matchId: number, fn: () => T): T | undefined {
    try {
      return fn();
    } catch (err) {
      this.games.get(matchId)?.trace?.abort();
      this.games.delete(matchId);
      this.warn(`enregistrement de la partie ${matchId} abandonné`, err);
      return undefined;
    }
  }

  private warn(what: string, err: unknown): void {
    this.logger.warn(
      `${what} — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
