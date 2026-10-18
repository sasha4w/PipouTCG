import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { Match } from '../entities/match.entity';
import { AchievementFamily, MatchStatus } from '@pipou/shared';
import { GameState, PlayerGameState } from '../interfaces/game-state.interface';
import { createGameState, createPlayerState } from '../helpers/game-factory';

export interface QueueEntry {
  userId: number;
  username: string;
  socketId: string;
  title?: AchievementFamily | null;
}

export interface MatchFoundInfo {
  matchId: number;
  p1: QueueEntry;
  p2: QueueEntry;
}

@Injectable()
export class MatchmakingService {
  private queue = new Map<number, QueueEntry>();

  constructor(@InjectRepository(Match) private matchRepo: Repository<Match>) {}

  async joinQueue(
    userId: number,
    username: string,
    socketId: string,
    alreadyInMatch: boolean,
  ): Promise<MatchFoundInfo | null> {
    if (alreadyInMatch) return null;
    this.queue.set(userId, { userId, username, socketId });
    if (this.queue.size < 2) return null;

    const [p1, p2] = [...this.queue.values()];
    this.queue.delete(p1.userId);
    this.queue.delete(p2.userId);

    const match = await this.matchRepo.save(
      this.matchRepo.create({
        player1Id: p1.userId,
        player2Id: p2.userId,
        status: MatchStatus.IN_PROGRESS,
      }),
    );

    const titles = await this.matchRepo.manager.getRepository(User).find({
      where: { id: In([p1.userId, p2.userId]) },
      select: ['id', 'equippedTitle'],
    });
    const titleOf = (id: number) =>
      titles.find((u) => u.id === id)?.equippedTitle ?? null;

    return {
      matchId: match.id,
      p1: { ...p1, title: titleOf(p1.userId) },
      p2: { ...p2, title: titleOf(p2.userId) },
    };
  }

  leaveQueue(userId: number): void {
    this.queue.delete(userId);
  }

  createEmptyPlayerState(entry: QueueEntry): PlayerGameState {
    return createPlayerState(entry);
  }

  buildInitialGameState(
    matchId: number,
    p1: QueueEntry,
    p2: QueueEntry,
  ): GameState {
    return createGameState(matchId, p1, p2);
  }
}
