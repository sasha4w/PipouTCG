import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import type {
  GameRecordListItem,
  GameRecordMode,
  GameRecordPage,
} from '@pipou/shared';
import { GameRecord } from './game-record.entity';
import type { GameRecordStore, NewGameRecord } from './game-recorder.port';

const PAGE_SIZE = 50;

export interface GameRecordListQuery {
  from?: Date;
  to?: Date;
  mode?: GameRecordMode;
  page: number;
}

function toListItem(r: GameRecord): GameRecordListItem {
  return {
    id: r.id,
    matchId: r.matchId,
    mode: r.mode,
    player1Id: r.player1Id,
    player2Id: r.player2Id,
    winnerSeat: r.winnerSeat,
    endReason: r.endReason,
    turns: r.turns,
    moves: r.moves,
    traceBytes: r.traceBytes,
    hasTrace: r.traceBytes > 0,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt.toISOString(),
    summary: r.summary,
  };
}

@Injectable()
export class GameRecordsService implements GameRecordStore {
  constructor(
    @InjectRepository(GameRecord)
    private readonly records: Repository<GameRecord>,
  ) {}

  async save(record: NewGameRecord): Promise<void> {
    await this.records.insert(record);
  }

  async totalTraceBytes(): Promise<number> {
    const row = await this.records
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.trace_bytes), 0)', 'total')
      .getRawOne<{ total: string | number }>();
    return Number(row?.total ?? 0);
  }

  async list(query: GameRecordListQuery): Promise<GameRecordPage> {
    const where: FindOptionsWhere<GameRecord> = {};
    if (query.mode) where.mode = query.mode;
    if (query.from && query.to) where.endedAt = Between(query.from, query.to);
    else if (query.from) where.endedAt = MoreThanOrEqual(query.from);
    else if (query.to) where.endedAt = LessThanOrEqual(query.to);
    const [rows, total] = await this.records.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    return { items: rows.map(toListItem), total, page: query.page };
  }

  /** Blob brotli de la trace ; null si absente ou abandonnée. */
  async trace(id: number): Promise<Buffer | null> {
    const row = await this.records
      .createQueryBuilder('r')
      .addSelect('r.trace')
      .where('r.id = :id', { id })
      .getOne();
    return row?.trace ?? null;
  }
}
