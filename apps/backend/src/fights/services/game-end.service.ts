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
    if (winnerId === null) return;
    const loserId =
      game.player1.userId === winnerId
        ? game.player2.userId
        : game.player1.userId;
    await this.updateStats(winnerId, loserId);
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

  private async updateStats(winnerId: number, loserId: number): Promise<void> {
    const [w, l] = await Promise.all([
      this.getOrCreateStats(winnerId),
      this.getOrCreateStats(loserId),
    ]);
    w.wins += 1;
    l.losses += 1;
    const { newWinnerElo, newLoserElo } = this.calcElo(w.elo, l.elo);
    w.elo = newWinnerElo;
    l.elo = newLoserElo;
    await this.statsRepo.save([w, l]);
  }

  private async getOrCreateStats(userId: number): Promise<PlayerStats> {
    let s = await this.statsRepo.findOne({ where: { userId } });
    if (!s) {
      s = this.statsRepo.create({ userId });
      await this.statsRepo.save(s);
    }
    return s;
  }

  private calcElo(winnerElo: number, loserElo: number) {
    const exp = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    return {
      newWinnerElo: Math.round(winnerElo + ELO_K * (1 - exp)),
      newLoserElo: Math.max(
        100,
        Math.round(loserElo + ELO_K * (0 - (1 - exp))),
      ),
    };
  }
}
