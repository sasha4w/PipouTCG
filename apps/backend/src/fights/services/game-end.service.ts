import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { Match, MatchStatus, MatchEndReason } from '../entities/match.entity';
import { PlayerStats } from '../entities/player-stats.entity';
import { GameState, GameEndReason } from '../interfaces/game-state.interface';
import { addLog, getPlayerState, checkWinCondition } from '../helpers/game-state.helper';
import { emitGameState } from '../helpers/client-state.builder';

const ELO_K = 32;

@Injectable()
export class GameEndService {
  constructor(
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(PlayerStats) private statsRepo: Repository<PlayerStats>,
  ) {}

  async endGame(
    game: GameState,
    winnerId: number,
    reason: GameEndReason,
    server: Server,
    onCleanup: (game: GameState) => void,
  ): Promise<void> {
    game.phase = 'finished';
    game.winner = winnerId;
    game.endReason = reason;
    game.pendingChoice = undefined;

    const reasonMap: Record<GameEndReason, MatchEndReason> = {
      primes_depleted: MatchEndReason.PRIMES_DEPLETED,
      deck_empty: MatchEndReason.DECK_EMPTY,
      surrender: MatchEndReason.SURRENDER,
      disconnect: MatchEndReason.DISCONNECT,
    };

    const loserId =
      game.player1.userId === winnerId ? game.player2.userId : game.player1.userId;
    const winner = getPlayerState(game, winnerId);

    addLog(game, `🎉 ${winner.username} remporte la victoire !`);

    await this.matchRepo.update(game.matchId, {
      status: MatchStatus.FINISHED,
      winnerId,
      endReason: reasonMap[reason],
      totalTurns: game.turnNumber,
      endedAt: new Date(),
    });
    await this.updateStats(winnerId, loserId);

    emitGameState(game, server);
    server.to(game.player1.socketId).emit('fight:game_over', { winner: winnerId, endReason: reason });
    server.to(game.player2.socketId).emit('fight:game_over', { winner: winnerId, endReason: reason });

    onCleanup(game);
  }

  async checkWinAndEmit(
    game: GameState,
    server: Server,
    onEndGame: (game: GameState, winnerId: number, reason: GameEndReason, server: Server) => Promise<void>,
  ): Promise<void> {
    const winner = checkWinCondition(game);
    if (winner !== null) {
      await onEndGame(game, winner, 'primes_depleted', server);
    } else {
      emitGameState(game, server);
    }
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

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getLeaderboard(limit = 50): Promise<PlayerStats[]> {
    return this.statsRepo.find({
      order: { elo: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async getMyStats(userId: number): Promise<PlayerStats> {
    let stats = await this.statsRepo.findOne({ where: { userId }, relations: ['user'] });
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
      newLoserElo: Math.max(100, Math.round(loserElo + ELO_K * (0 - (1 - exp)))),
    };
  }
}
