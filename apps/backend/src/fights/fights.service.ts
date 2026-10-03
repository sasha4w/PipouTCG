import { Injectable, Logger } from '@nestjs/common';
import type { GameAction, GamePhase } from '@pipou/shared';
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
  seatOf,
} from './helpers/game-state.helper';
import { finishGame } from './helpers/game-end.helper';
import { emitGameState } from './helpers/client-state.builder';

const NOT_IN_MATCH = 'Tu ne participes pas à ce match';

/** Délai laissé à un joueur déconnecté pour revenir avant de perdre. */
export const RECONNECT_GRACE_MS = 60_000;

@Injectable()
export class FightsService {
  private readonly logger = new Logger(FightsService.name);
  private games = new Map<number, GameState>();
  private userToMatch = new Map<number, number>();
  private locks = new Map<number, Promise<unknown>>();
  private disconnectTimers = new Map<number, NodeJS.Timeout>();

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

  submitDeck(
    matchId: number,
    userId: number,
    deckId: number,
    server: FightServer,
  ): Promise<{ error?: string }> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game) return { error: 'Match introuvable' };
      if (!seatOf(game, userId)) return { error: NOT_IN_MATCH };

      const result = await this.deckSubmission.submitDeck(game, userId, deckId);
      if (result.error) return result;

      if (game.phase === 'waiting') {
        server
          .to(getPlayerState(game, userId).socketId)
          .emit('fight:deck_accepted', { matchId });
      } else {
        await this.afterChange(game, server);
      }
      return {};
    });
  }

  act(
    matchId: number,
    userId: number,
    action: GameAction,
    server: FightServer,
  ): Promise<{ error?: string }> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game) return { error: 'Match introuvable' };
      const seat = seatOf(game, userId);
      if (!seat) return { error: NOT_IN_MATCH };

      const result = this.engine.dispatch(game, seat, action);
      if (!result.error) await this.afterChange(game, server);
      return result;
    });
  }

  surrender(
    matchId: number,
    userId: number,
    server: FightServer,
  ): Promise<{ error?: string }> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game || game.phase === 'finished')
        return { error: 'Match introuvable' };
      if (!seatOf(game, userId)) return { error: NOT_IN_MATCH };

      addLog(game, `🏳️ ${getPlayerState(game, userId).username} abandonne`);
      finishGame(game, getOpponentState(game, userId).userId, 'surrender');
      await this.afterChange(game, server);
      return {};
    });
  }

  /** Fermeture d'un socket : sortie de file, puis délai de grâce avant la défaite. */
  handleDisconnect(
    userId: number,
    socketId: string,
    server: FightServer,
  ): void {
    this.leaveQueue(userId);
    const matchId = this.userToMatch.get(userId);
    if (matchId === undefined || this.disconnectTimers.has(userId)) return;
    const game = this.games.get(matchId);
    if (!game || game.phase === 'finished') return;

    const player = getPlayerState(game, userId);
    // Un ancien onglet qui se ferme ne compte pas
    if (player.socketId !== socketId) return;

    addLog(
      game,
      `🔌 ${player.username} s'est déconnecté — ${RECONNECT_GRACE_MS / 1000} s pour revenir`,
    );
    this.disconnectTimers.set(
      userId,
      setTimeout(() => {
        this.disconnectTimers.delete(userId);
        this.forfeit(matchId, userId, server).catch((err: unknown) =>
          this.logger.error(
            `Défaite par déconnexion du match ${matchId} en échec`,
            err instanceof Error ? err.stack : String(err),
          ),
        );
      }, RECONNECT_GRACE_MS),
    );
  }

  /** Reconnexion : rattache le nouveau socket à la partie en cours, s'il y en a une. */
  reconnect(
    userId: number,
    socketId: string,
  ): { matchId: number; opponentName: string; phase: GamePhase } | null {
    const matchId = this.userToMatch.get(userId);
    const game = matchId === undefined ? undefined : this.games.get(matchId);
    if (!game || game.phase === 'finished') return null;

    const player = getPlayerState(game, userId);
    const pending = this.disconnectTimers.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.disconnectTimers.delete(userId);
      addLog(game, `🔌 ${player.username} est de retour`);
    }
    player.socketId = socketId;
    return {
      matchId: game.matchId,
      opponentName: getOpponentState(game, userId).username,
      phase: game.phase,
    };
  }

  /** Renvoie l'état d'une partie commencée à ses deux joueurs. */
  emitState(matchId: number, server: FightServer): void {
    const game = this.games.get(matchId);
    if (game && game.phase !== 'waiting') emitGameState(game, server);
  }

  private forfeit(
    matchId: number,
    userId: number,
    server: FightServer,
  ): Promise<void> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game || game.phase === 'finished') return;
      finishGame(game, getOpponentState(game, userId).userId, 'disconnect');
      await this.afterChange(game, server);
    });
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

  /** Exécute fn après les opérations déjà en cours sur ce match. */
  private withLock<T>(matchId: number, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.locks.get(matchId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    this.locks.set(matchId, run);
    run
      .finally(() => {
        if (this.locks.get(matchId) === run) this.locks.delete(matchId);
      })
      .catch(() => undefined);
    return run;
  }

  /** Après tout changement : fin de partie, ou émission de l'état et relance du timer. */
  private async afterChange(
    game: GameState,
    server: FightServer,
  ): Promise<void> {
    if (game.phase === 'finished') {
      await this.finish(game, server);
      return;
    }
    emitGameState(game, server);
    this.turnTimeout.schedule(game.matchId, () =>
      this.onTimeout(game.matchId, server),
    );
  }

  private onTimeout(matchId: number, server: FightServer): Promise<void> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game) return;
      this.engine.timeout(game);
      await this.afterChange(game, server);
    });
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
    const payload = {
      winner: game.winner ?? null,
      endReason: game.endReason!,
    };
    server.to(game.player1.socketId).emit('fight:game_over', payload);
    server.to(game.player2.socketId).emit('fight:game_over', payload);
  }

  private cleanupGame(game: GameState): void {
    for (const p of [game.player1, game.player2]) {
      clearTimeout(this.disconnectTimers.get(p.userId));
      this.disconnectTimers.delete(p.userId);
      this.userToMatch.delete(p.userId);
    }
    this.games.delete(game.matchId);
  }
}
