import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  GameState,
  GameEndReason,
  CombatMode,
} from './interfaces/game-state.interface';
import { PlayerStats } from './entities/player-stats.entity';

import {
  MatchmakingService,
  MatchFoundInfo,
} from './services/matchmaking.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { PhaseService } from './services/phase.service';
import { SummonService } from './services/summon.service';
import { SupportService } from './services/support.service';
import { BattleService } from './services/battle.service';
import { PickService } from './services/pick.service';
import { GameEndService } from './services/game-end.service';
import { TurnTimeoutService } from './services/turn-timeout.service';

import {
  addLog,
  getPlayerState,
  getOpponentState,
} from './helpers/game-state.helper';
import { emitGameState } from './helpers/client-state.builder';

/**
 * FightsService — thin orchestrator.
 *
 * Owns the in-memory maps (games, userToMatch) and wires the
 * sub-services together by passing callbacks. All business logic
 * lives in the dedicated service files.
 */
@Injectable()
export class FightsService {
  private games = new Map<number, GameState>();
  private userToMatch = new Map<number, number>();

  constructor(
    private matchmaking: MatchmakingService,
    private deckSubmission: DeckSubmissionService,
    private phase: PhaseService,
    private summon: SummonService,
    private support: SupportService,
    private battle: BattleService,
    private pick: PickService,
    private gameEnd: GameEndService,
    private turnTimeout: TurnTimeoutService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCHMAKING
  // ═══════════════════════════════════════════════════════════════════════════

  async joinQueue(
    userId: number,
    username: string,
    socketId: string,
    server: Server,
  ): Promise<MatchFoundInfo | null> {
    const result = await this.matchmaking.joinQueue(
      userId,
      username,
      socketId,
      this.userToMatch.has(userId),
    );
    if (!result) return null;

    const game = this.matchmaking.buildInitialGameState(
      result.matchId,
      result.p1,
      result.p2,
    );
    this.games.set(result.matchId, game);
    this.userToMatch.set(result.p1.userId, result.matchId);
    this.userToMatch.set(result.p2.userId, result.matchId);

    return result;
  }

  leaveQueue(userId: number): void {
    this.matchmaking.leaveQueue(userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECK SUBMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  async submitDeck(
    matchId: number,
    userId: number,
    deckId: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };

    return this.deckSubmission.submitDeck(
      game,
      userId,
      deckId,
      server,
      (g, s) => {
        g.phase = 'main';
        g.turnNumber = 1;
        addLog(g, `⚔️ Combat ! Tour 1 — ${g.player1.username} commence`);
        this.turnTimeout.start(g, s, (tg, ts) => this.timeoutEndPhase(tg, ts));
        emitGameState(g, s);
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE ADVANCEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async endPhase(
    matchId: number,
    userId: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.phase.endPhase(
      game,
      userId,
      server,
      this.endGameCallback(),
      (g, s) =>
        this.turnTimeout.reset(g, s, (tg, ts) => this.timeoutEndPhase(tg, ts)),
    );
    if (!result.error) {
      this.turnTimeout.reset(game, server, (tg, ts) =>
        this.timeoutEndPhase(tg, ts),
      );
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMON
  // ═══════════════════════════════════════════════════════════════════════════

  async summonMonster(
    matchId: number,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.summon.summonMonster(
      game,
      userId,
      handIndex,
      zoneIndex,
      paymentHandIndices,
      server,
    );
    if (!result.error) this.resetTimeout(game, server);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPORT
  // ═══════════════════════════════════════════════════════════════════════════

  async playSupport(
    matchId: number,
    userId: number,
    handIndex: number,
    zoneIndex: number | undefined,
    targetInstanceId: string | undefined,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.support.playSupport(
      game,
      userId,
      handIndex,
      zoneIndex,
      targetInstanceId,
      server,
      (g, s) => this.gameEnd.checkWinAndEmit(g, s, this.endGameCallback()),
    );
    if (!result.error) this.resetTimeout(game, server);
    return result;
  }

  async recycleFromHand(
    matchId: number,
    userId: number,
    handIndex: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.support.recycleFromHand(
      game,
      userId,
      handIndex,
      server,
      emitGameState,
    );
    if (!result.error) this.resetTimeout(game, server);
    return result;
  }

  async changeMode(
    matchId: number,
    userId: number,
    instanceId: string,
    mode: CombatMode,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.support.changeMode(
      game,
      userId,
      instanceId,
      mode,
      server,
      emitGameState,
    );
    if (!result.error) this.resetTimeout(game, server);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATTLE
  // ═══════════════════════════════════════════════════════════════════════════

  async attack(
    matchId: number,
    userId: number,
    attackerInstanceId: string,
    targetInstanceId: string | undefined,
    direct: boolean,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.battle.attack(
      game,
      userId,
      attackerInstanceId,
      targetInstanceId,
      direct,
      server,
      (g, s) => this.gameEnd.checkWinAndEmit(g, s, this.endGameCallback()),
    );
    if (!result.error) this.resetTimeout(game, server);
    return result;
  }

  async discard(
    matchId: number,
    userId: number,
    handIndex: number,
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    return this.phase.discard(game, userId, handIndex, server);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD PICK
  // ═══════════════════════════════════════════════════════════════════════════

  async pickCards(
    matchId: number,
    userId: number,
    instanceIds: string[],
    server: Server,
  ): Promise<{ error?: string }> {
    const game = this.getGame(matchId);
    if (!game) return { error: 'Match introuvable' };
    return this.pick.pickCards(game, userId, instanceIds, server);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SURRENDER / DISCONNECT
  // ═══════════════════════════════════════════════════════════════════════════

  async surrender(
    matchId: number,
    userId: number,
    server: Server,
  ): Promise<void> {
    const game = this.getGame(matchId);
    if (!game) return;
    const opp = getOpponentState(game, userId);
    addLog(game, `🏳️ ${getPlayerState(game, userId).username} abandonne`);
    await this.gameEnd.endGame(
      game,
      opp.userId,
      'surrender',
      server,
      this.cleanupGame.bind(this),
    );
    this.turnTimeout.clear(matchId);
  }

  async handleDisconnect(userId: number, server: Server): Promise<void> {
    this.leaveQueue(userId);
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;
    const game = this.getGame(matchId);
    if (!game || game.phase === 'finished') return;
    const opp = getOpponentState(game, userId);
    addLog(game, `🔌 ${getPlayerState(game, userId).username} déconnecté`);
    await this.gameEnd.endGame(
      game,
      opp.userId,
      'disconnect',
      server,
      this.cleanupGame.bind(this),
    );
    this.turnTimeout.clear(matchId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REST
  // ═══════════════════════════════════════════════════════════════════════════

  async getMatchHistory(userId: number, page = 1, limit = 20) {
    return this.gameEnd.getMatchHistory(userId, page, limit);
  }

  async getLeaderboard(limit = 50): Promise<PlayerStats[]> {
    return this.gameEnd.getLeaderboard(limit);
  }

  async getMyStats(userId: number): Promise<PlayerStats> {
    return this.gameEnd.getMyStats(userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getGame(matchId: number): GameState | undefined {
    return this.games.get(matchId);
  }

  private cleanupGame(game: GameState): void {
    this.games.delete(game.matchId);
    this.userToMatch.delete(game.player1.userId);
    this.userToMatch.delete(game.player2.userId);
  }

  private endGameCallback() {
    return (
      game: GameState,
      winnerId: number,
      reason: GameEndReason,
      server: Server,
    ) => {
      this.turnTimeout.clear(game.matchId);
      return this.gameEnd.endGame(
        game,
        winnerId,
        reason,
        server,
        this.cleanupGame.bind(this),
      );
    };
  }

  /**
   * Wraps endPhase so it returns Promise<void> — required by TurnTimeoutService
   * which expects a fire-and-forget callback (errors are logged, not bubbled).
   */
  private timeoutEndPhase(tg: GameState, ts: Server): Promise<void> {
    return this.phase
      .endPhase(tg, tg.currentTurnUserId, ts, this.endGameCallback(), () => {})
      .then(() => void 0);
  }

  private resetTimeout(game: GameState, server: Server): void {
    this.turnTimeout.reset(game, server, (tg, ts) =>
      this.timeoutEndPhase(tg, ts),
    );
  }
}
