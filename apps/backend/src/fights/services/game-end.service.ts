import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from '../entities/match.entity';
import { MatchStatus } from '@pipou/shared';
import { PlayerStats } from '../entities/player-stats.entity';
import { GameState } from '../interfaces/game-state.interface';

const ELO_K = 32;

@Injectable()
export class GameEndService {
  constructor(
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(PlayerStats) private statsRepo: Repository<PlayerStats>,
  ) {}

  /** Enregistre le résultat d'une partie terminée (statut, gagnant, stats, ELO). */
  async persistResult(game: GameState): Promise<void> {
    const winnerId = game.winner ?? null;
    await this.matchRepo.update(game.matchId, {
      status: MatchStatus.FINISHED,
      winnerId,
      endReason: game.endReason ?? null,
      totalTurns: game.turnNumber,
      endedAt: new Date(),
    });
    const [s1, s2] = await Promise.all([
      this.getOrCreateStats(game.player1.userId),
      this.getOrCreateStats(game.player2.userId),
    ]);
    const score1 =
      winnerId === null ? 0.5 : winnerId === game.player1.userId ? 1 : 0;
    if (score1 === 1) {
      s1.wins += 1;
      s2.losses += 1;
    } else if (score1 === 0) {
      s1.losses += 1;
      s2.wins += 1;
    } else {
      s1.draws += 1;
      s2.draws += 1;
    }
    [s1.elo, s2.elo] = calcElo(s1.elo, s2.elo, score1);
    await this.statsRepo.save([s1, s2]);
  }

  // ── REST endpoints ──────────────────────────────────────────────────────────

  async getMatchHistory(userId: number, page = 1, limit = 20) {
    const [data, total] = await this.matchRepo
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.player1', 'player1')
      .leftJoinAndSelect('match.player2', 'player2')
      .leftJoinAndSelect('match.winner', 'winner')
      .where('match.player1Id = :u OR match.player2Id = :u', { u: userId })
      .andWhere('match.status != :s', { s: MatchStatus.IN_PROGRESS })
      .orderBy('match.startedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLeaderboard(limit = 50): Promise<PlayerStats[]> {
    return this.statsRepo.find({
      order: { elo: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async getMyStats(userId: number): Promise<PlayerStats> {
    let stats = await this.statsRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!stats) {
      stats = this.statsRepo.create({ userId });
      await this.statsRepo.save(stats);
    }
    return stats;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async getOrCreateStats(userId: number): Promise<PlayerStats> {
    let s = await this.statsRepo.findOne({ where: { userId } });
    if (!s) {
      s = this.statsRepo.create({ userId });
      await this.statsRepo.save(s);
    }
    return s;
  }
}

/** ELO après une partie ; scoreA = 1 (A gagne), 0,5 (nul) ou 0 (A perd). Plancher à 100. */
export function calcElo(
  eloA: number,
  eloB: number,
  scoreA: number,
): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const deltaA = ELO_K * (scoreA - expectedA);
  return [
    Math.max(100, Math.round(eloA + deltaA)),
    Math.max(100, Math.round(eloB - deltaA)),
  ];
}
