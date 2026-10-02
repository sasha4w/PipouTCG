import { Injectable, Logger } from '@nestjs/common';
import type { GameAction, Seat } from '@pipou/shared';
import type { FightServer } from './fight-socket.types';
import { GameState } from './interfaces/game-state.interface';
import { PlayerStats } from './entities/player-stats.entity';
import {
  MatchmakingService,
  MatchFoundInfo,
} from './services/matchmaking.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { GameEndService } from './services/game-end.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import { GameEngine } from './engine/game-engine';
import {
  addLog,
  getPlayerState,
  getOpponentState,
} from './helpers/game-state.helper';
import { finishGame } from './helpers/game-end.helper';
import { emitGameState } from './helpers/client-state.builder';

@Injectable()
export class FightsService {
  private readonly logger = new Logger(FightsService.name);
  private games = new Map<number, GameState>();
  private userToMatch = new Map<number, number>();

  constructor(
    private matchmaking: MatchmakingService,
    private deckSubmission: DeckSubmissionService,
    private engine: GameEngine,
    private gameEnd: GameEndService,
    private turnTimeout: TurnTimeoutService,
  ) {}

  // ── Matchmaking ──────────────────────────────────────────────────────────

  async joinQueue(
    userId: number,
    username: string,
    socketId: string,
  ): Promise<MatchFoundInfo | null> {
    const result = await this.matchmaking.joinQueue(
      userId,
      username,
      socketId,
      this.userToMatch.has(userId),
    );
    if (!result) return null;

    this.adopt(
      this.matchmaking.buildInitialGameState(
        result.matchId,
        result.p1,
        result.p2,
      ),
    );
    return result;
  }

  leaveQueue(userId: number): void {
    this.matchmaking.leaveQueue(userId);
  }

  /** Prend en charge une partie déjà construite (matchmaking, tests, sandbox). */
  adopt(game: GameState): void {
    this.games.set(game.matchId, game);
    this.userToMatch.set(game.player1.userId, game.matchId);
    this.userToMatch.set(game.player2.userId, game.matchId);
  }

  // ── Partie ───────────────────────────────────────────────────────────────

  async submitDeck(
    matchId: number,
    userId: number,
    deckId: number,
    server: FightServer,
  ): Promise<{ error?: string }> {
    const game = this.games.get(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.deckSubmission.submitDeck(game, userId, deckId);
    if (result.error) return result;

    if (game.phase === 'waiting') {
      server
        .to(getPlayerState(game, userId).socketId)
        .emit('fight:deck_accepted', { matchId });
    } else {
      this.afterChange(game, server);
    }
    return {};
  }

  act(
    matchId: number,
    userId: number,
    action: GameAction,
    server: FightServer,
  ): { error?: string } {
    const game = this.games.get(matchId);
    if (!game) return { error: 'Match introuvable' };

    const seat: Seat = game.player1.userId === userId ? 'p1' : 'p2';
    const result = this.engine.dispatch(game, seat, action);
    if (!result.error) this.afterChange(game, server);
    return result;
  }

  surrender(matchId: number, userId: number, server: FightServer): void {
    const game = this.games.get(matchId);
    if (!game || game.phase === 'finished') return;

    addLog(game, `🏳️ ${getPlayerState(game, userId).username} abandonne`);
    finishGame(game, getOpponentState(game, userId).userId, 'surrender');
    this.afterChange(game, server);
  }

  handleDisconnect(userId: number, server: FightServer): void {
    this.leaveQueue(userId);
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;

    const game = this.games.get(matchId);
    if (!game || game.phase === 'finished') return;

    addLog(game, `🔌 ${getPlayerState(game, userId).username} déconnecté`);
    finishGame(game, getOpponentState(game, userId).userId, 'disconnect');
    this.afterChange(game, server);
  }

  // ── REST ─────────────────────────────────────────────────────────────────

  async getMatchHistory(userId: number, page = 1, limit = 20) {
    return this.gameEnd.getMatchHistory(userId, page, limit);
  }

  async getLeaderboard(limit = 50): Promise<PlayerStats[]> {
    return this.gameEnd.getLeaderboard(limit);
  }

  async getMyStats(userId: number): Promise<PlayerStats> {
    return this.gameEnd.getMyStats(userId);
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  /** Après tout changement : fin de partie, ou émission de l'état + relance du timer. */
  private afterChange(game: GameState, server: FightServer): void {
    if (game.phase === 'finished') {
      void this.finish(game, server);
      return;
    }
    emitGameState(game, server);
    this.turnTimeout.schedule(game.matchId, () =>
      this.onTimeout(game.matchId, server),
    );
  }

  private onTimeout(matchId: number, server: FightServer): void {
    const game = this.games.get(matchId);
    if (!game) return;
    this.engine.timeout(game);
    this.afterChange(game, server);
  }

  private async finish(game: GameState, server: FightServer): Promise<void> {
    this.turnTimeout.clear(game.matchId);
    this.cleanupGame(game);
    try {
      await this.gameEnd.persistResult(game);
    } catch (err) {
      this.logger.error(
        `Enregistrement du match ${game.matchId} en échec`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    emitGameState(game, server);
    const payload = { winner: game.winner!, endReason: game.endReason! };
    server.to(game.player1.socketId).emit('fight:game_over', payload);
    server.to(game.player2.socketId).emit('fight:game_over', payload);
  }

  private cleanupGame(game: GameState): void {
    this.games.delete(game.matchId);
    this.userToMatch.delete(game.player1.userId);
    this.userToMatch.delete(game.player2.userId);
  }
}
