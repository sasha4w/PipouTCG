import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type {
  AdventureResultPayload,
  AdventureStartPayload,
  GameAction,
  GamePhase,
  Seat,
  TutorialLessonId,
  TutorialResultPayload,
  TutorialStartPayload,
  TutorialStepView,
} from '@pipou/shared';
import { isTutorialLessonId } from '@pipou/shared';
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
  currentChoice,
  freshCandidates,
  getPlayerState,
  getOpponentState,
  seatOf,
  seatPlayer,
} from './helpers/game-state.helper';
import { finishGame } from './helpers/game-end.helper';
import { emitGameState } from './helpers/client-state.builder';
import { createGameState } from './helpers/game-factory';
import { aiMustAct } from './ai/ai-player';
import type { AiPlayer } from './ai/ai-player';
import { AI_DECISION_RECORDER } from '../ai-review/decision-recorder';
import type { DecisionRecorder } from '../ai-review/decision-recorder';
import { GAME_RECORDER } from '../game-records/game-recorder.port';
import type { GameRecorderPort } from '../game-records/game-recorder.port';
import { appendMatchEvent, fileSink } from './ai/decision-log';
import type { MatchEvent } from './ai/decision-log';
import { describeAction } from './ai/ai-review';
import { createLevelAi } from './ai/level-brains';
import {
  AI_ACTION_DELAY_MS,
  AI_MAX_ACTIONS_PER_TURN,
  PVE_HOOKS,
  PVE_MAX_TIMEOUTS,
  type PveHooks,
  type PveInfo,
  type PveStart,
} from './pve';
import {
  TUTORIAL_ACTION_DELAY_MS,
  TUTORIAL_HOOKS,
  type TutorialHooks,
} from './tutorial';
import type { LessonRunner } from '../tutorial/lesson-runner';

const NOT_IN_MATCH = 'Tu ne participes pas à ce match';

/** Délai laissé à un joueur déconnecté pour revenir avant de perdre. */
export const RECONNECT_GRACE_MS = 60_000;

/** Refus d'une action hors consigne dans une leçon. */
const TUTORIAL_READ_FIRST = "Lis l'explication, puis clique sur Suivant";
const TUTORIAL_WAIT = "L'adversaire joue, patiente un instant";
const TUTORIAL_WRONG_ACTION = "Ce n'est pas l'action demandée par la leçon";
const TUTORIAL_NEEDS_ACTION =
  'Cette étape demande une action, pas un clic sur Suivant';

const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;

/** Partie contre l'IA : infos de persistance et pilotage de l'IA. */
interface PveSession {
  info: PveInfo;
  /** Tour auquel se rapporte `info.aiActionsThisTurn`. */
  aiTurn: number;
  /** Prochain coup de l'IA programmé. */
  aiTimer?: NodeJS.Timeout;
  /** IA du combat, au cerveau du niveau de l'adversaire (plan propre au combat). */
  ai: AiPlayer;
}

/** Leçon du tutoriel en cours : le joueur est toujours `player1`. */
interface TutorialSession {
  lessonId: TutorialLessonId;
  runner: LessonRunner;
  humanId: number;
  /** Prochain coup scripté de l'adversaire programmé. */
  timer?: NodeJS.Timeout;
}

@Injectable()
export class FightsService {
  private readonly logger = new Logger(FightsService.name);
  private games = new Map<number, GameState>();
  private userToMatch = new Map<number, number>();
  private locks = new Map<number, Promise<unknown>>();
  private disconnectTimers = new Map<number, NodeJS.Timeout>();
  private pve = new Map<number, PveSession>();
  private tutorials = new Map<number, TutorialSession>();
  /** Joueurs dont le combat d'aventure est en cours de création. */
  private startingAdventure = new Set<number>();

  constructor(
    private matchmaking: MatchmakingService,
    private deckSubmission: DeckSubmissionService,
    private engine: GameEngine,
    private gameEnd: GameEndService,
    private turnTimeout: TurnTimeoutService,
    @Optional() @Inject(PVE_HOOKS) private pveHooks?: PveHooks,
    @Optional()
    @Inject(AI_DECISION_RECORDER)
    private decisionRecorder?: DecisionRecorder,
    @Optional()
    @Inject(GAME_RECORDER)
    private gameRecorder?: GameRecorderPort,
    @Optional()
    @Inject(TUTORIAL_HOOKS)
    private tutorialHooks?: TutorialHooks,
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
      this.userToMatch.has(userId) || this.startingAdventure.has(userId),
    );
    if (!result) return null;

    const game = this.matchmaking.buildInitialGameState(
      result.matchId,
      result.p1,
      result.p2,
    );
    this.adopt(game);
    this.gameRecorder?.begin(game, { mode: 'pvp' });
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

  // ── Aventure (PvE) ───────────────────────────────────────────────────────

  /**
   * Lance un combat contre l'IA : deck du joueur validé d'abord (un refus ne
   * prépare aucun combat d'aventure), puis deck de l'IA installé → mulligan.
   */
  async startAdventure(
    userId: number,
    username: string,
    socketId: string,
    payload: AdventureStartPayload,
    server: FightServer,
    /** Admin : les décisions de l'IA sont journalisées pour la revue. */
    isAdmin = false,
  ): Promise<{ error?: string }> {
    const hooks = this.pveHooks;
    if (!hooks) return { error: 'Mode Aventure indisponible' };
    // Corps socket non validé par Nest : on vérifie les identifiants ici.
    const { opponentId, deckId } = (payload ?? {}) as Partial<
      Record<keyof AdventureStartPayload, unknown>
    >;
    if (!isPositiveInt(opponentId) || !isPositiveInt(deckId))
      return { error: 'Demande de combat invalide' };
    if (
      this.userToMatch.has(userId) ||
      this.startingAdventure.has(userId) ||
      this.matchmaking.isQueued(userId)
    )
      return { error: 'Tu as déjà une partie en cours' };

    this.startingAdventure.add(userId);
    try {
      // Siège IA provisoire : identifiants fixés une fois le combat préparé
      const game = createGameState(
        0,
        { userId, username, socketId },
        { userId: 0, username: '', socketId: '' },
      );
      const deck = await this.deckSubmission.submitDeck(
        game,
        userId,
        payload.deckId,
      );
      if (deck.error) return deck;

      let start: PveStart;
      try {
        start = await hooks.prepareStart(userId, payload.opponentId);
      } catch (err) {
        if (err instanceof HttpException) return { error: err.message };
        this.logger.error(
          `Préparation du combat contre l'IA ${payload.opponentId} en échec`,
          err instanceof Error ? err.stack : String(err),
        );
        return { error: 'Impossible de lancer ce combat' };
      }

      const matchId = -start.adventureMatchId;
      game.matchId = matchId;
      Object.assign(game.player2, {
        userId: matchId,
        username: start.opponentName,
        socketId: `ai:${matchId}`,
      });
      const aiDeck = this.engine.setupDeck(
        game,
        'p2',
        start.aiCards.map((c) => ({ ...c, ownerId: matchId })),
      );
      if (aiDeck.error) {
        this.logger.error(
          `Deck de l'IA refusé (combat d'aventure ${start.adventureMatchId}) : ${aiDeck.error}`,
        );
        return { error: 'Impossible de lancer ce combat' };
      }

      const ai = createLevelAi(this.engine, start.profile.level);
      // AI_DECISION_LOG (diagnostic local) : journal fichier, sinon base pour les admins
      const logPath = process.env.AI_DECISION_LOG;
      const sink = logPath
        ? fileSink(logPath)
        : (this.decisionRecorder?.sinkFor(userId, isAdmin) ?? null);
      if (sink) ai.setDecisionSink(sink, `pve${Date.now()}`);
      this.adopt(game);
      this.gameRecorder?.begin(game, {
        mode: 'pve',
        aiSeat: 'p2',
        level: start.profile.level,
        archetype: start.profile.archetype,
        opponentId: start.opponentId,
      });
      this.pve.set(matchId, {
        info: {
          adventureMatchId: start.adventureMatchId,
          opponentId: start.opponentId,
          aiUserId: matchId,
          profile: start.profile,
          timeouts: 0,
          aiActionsThisTurn: 0,
        },
        aiTurn: game.turnNumber,
        ai,
      });
      server.to(socketId).emit('fight:matched', {
        matchId,
        opponentName: start.opponentName,
        adventureOpponentId: start.opponentId,
      });
      await this.withLock(matchId, () => this.afterChange(game, server));
      return {};
    } finally {
      this.startingAdventure.delete(userId);
    }
  }

  // ── Tutoriel ─────────────────────────────────────────────────────────────

  /** Lance une leçon : plateau préparé, adversaire scripté, aucun deck à soumettre. */
  async startTutorial(
    userId: number,
    username: string,
    socketId: string,
    payload: TutorialStartPayload,
    server: FightServer,
  ): Promise<{ error?: string }> {
    const hooks = this.tutorialHooks;
    if (!hooks) return { error: 'Tutoriel indisponible' };
    const lessonId = (payload as Partial<TutorialStartPayload> | undefined)
      ?.lessonId;
    if (!isTutorialLessonId(lessonId)) return { error: 'Leçon introuvable' };
    if (
      this.userToMatch.has(userId) ||
      this.startingAdventure.has(userId) ||
      this.matchmaking.isQueued(userId)
    )
      return { error: 'Tu as déjà une partie en cours' };

    this.startingAdventure.add(userId);
    try {
      let start;
      try {
        start = await hooks.prepare(userId, username, lessonId);
      } catch (err) {
        if (err instanceof HttpException) return { error: err.message };
        this.logger.error(
          `Préparation de la leçon ${lessonId} en échec`,
          err instanceof Error ? err.stack : String(err),
        );
        return { error: 'Impossible de lancer cette leçon' };
      }
      const { game } = start;
      game.player1.socketId = socketId;
      this.adopt(game);
      this.tutorials.set(game.matchId, {
        lessonId,
        runner: start.runner,
        humanId: userId,
      });
      server.to(socketId).emit('fight:matched', {
        matchId: game.matchId,
        opponentName: game.player2.username,
        tutorialLessonId: lessonId,
      });
      await this.withLock(game.matchId, () => this.afterChange(game, server));
      return {};
    } finally {
      this.startingAdventure.delete(userId);
    }
  }

  /** « Suivant » : passe l'étape d'explication de la leçon en cours. */
  tutorialAck(
    matchId: number,
    userId: number,
    server: FightServer,
  ): Promise<{ error?: string }> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      const tut = this.tutorials.get(matchId);
      if (!game || !tut) return { error: 'Match introuvable' };
      if (!seatOf(game, userId)) return { error: NOT_IN_MATCH };
      const kind = tut.runner.step?.kind;
      if (kind !== 'info')
        return {
          error: kind === 'player' ? TUTORIAL_NEEDS_ACTION : TUTORIAL_WAIT,
        };
      tut.runner.advance();
      await this.afterChange(game, server);
      return {};
    });
  }

  /** Action du joueur dans une leçon : seule celle de l'étape est jouée. */
  private async tutorialAct(
    game: GameState,
    tut: TutorialSession,
    seat: Seat,
    action: GameAction,
    server: FightServer,
  ): Promise<{ error?: string }> {
    const step = tut.runner.step;
    if (step?.kind !== 'player')
      return {
        error: step?.kind === 'opponent' ? TUTORIAL_WAIT : TUTORIAL_READ_FIRST,
      };
    if (!tut.runner.matches(game, seat, action))
      return { error: TUTORIAL_WRONG_ACTION };
    const result = this.engine.dispatch(game, seat, action);
    // Un refus du moteur n'avance pas la leçon, sauf quand elle le montre exprès
    if (result.error && !step.refused) return result;
    tut.runner.advance();
    await this.afterChange(game, server);
    return result;
  }

  private scheduleTutorialStep(
    matchId: number,
    tut: TutorialSession,
    server: FightServer,
  ): void {
    if (tut.timer) return;
    tut.timer = setTimeout(() => {
      tut.timer = undefined;
      this.tutorialStep(matchId, server).catch((err: unknown) =>
        this.logger.error(
          `Coup scripté de la leçon du match ${matchId} en échec`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
    }, TUTORIAL_ACTION_DELAY_MS);
  }

  /** Un coup scripté de l'adversaire ; refusé, la leçon s'arrête sans récompense. */
  private tutorialStep(matchId: number, server: FightServer): Promise<void> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      const tut = this.tutorials.get(matchId);
      if (!game || !tut || tut.runner.step?.kind !== 'opponent') return;
      const seat = seatOf(game, game.player2.userId)!;
      const action = tut.runner.scripted(game, seat);
      const error = action
        ? this.engine.dispatch(game, seat, action).error
        : 'coup introuvable';
      if (error) {
        this.logger.error(
          `Leçon ${tut.lessonId} : coup scripté ${JSON.stringify(action)} refusé — ${error}`,
        );
        finishGame(game, game.player2.userId, 'disconnect');
      } else tut.runner.advance();
      await this.afterChange(game, server);
    });
  }

  /** Étape de leçon montrée au joueur, ou rien hors tutoriel. */
  private tutorialView(game: GameState): TutorialStepView | undefined {
    return this.tutorials.get(game.matchId)?.runner.view(game, 'p1');
  }

  private async finishTutorial(
    game: GameState,
    tut: TutorialSession,
    server: FightServer,
  ): Promise<void> {
    const completed = tut.runner.done && game.winner === tut.humanId;
    let tutorial: TutorialResultPayload | undefined;
    try {
      tutorial = await this.tutorialHooks?.recordResult(
        tut.humanId,
        tut.lessonId,
        completed,
      );
    } catch (err) {
      this.logger.error(
        `Enregistrement de la leçon ${tut.lessonId} en échec`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    emitGameState(game, server);
    server.to(game.player1.socketId).emit('fight:game_over', {
      winner: game.winner ?? null,
      endReason: game.endReason!,
      ...(tutorial && { tutorial }),
    });
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

      const tut = this.tutorials.get(matchId);
      if (tut) return this.tutorialAct(game, tut, seat, action, server);

      const session0 = this.pve.get(matchId);
      // Diagnostic local : coup de l'humain, décrit sur l'état d'avant
      const logPath = process.env.AI_DECISION_LOG;
      const before =
        logPath && session0 && userId !== session0.info.aiUserId
          ? {
              turn: game.turnNumber,
              phase: game.phase,
              text: describeAction(action, game),
            }
          : null;
      const ticket = this.gameRecorder?.before(game, seat, action) ?? null;
      const result = this.engine.dispatch(game, seat, action);
      if (ticket && !result.error)
        this.gameRecorder?.after(game, ticket, 'human');
      if (logPath && before)
        this.logMatchEvent(logPath, {
          kind: 'human',
          matchId,
          ...before,
          action,
          ...(result.error && { error: result.error }),
        });
      if (!result.error) {
        const session = this.pve.get(matchId);
        if (session && userId !== session.info.aiUserId)
          session.info.timeouts = 0;
        await this.afterChange(game, server);
      }
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
  ): {
    matchId: number;
    opponentName: string;
    phase: GamePhase;
    adventureOpponentId?: number;
    tutorialLessonId?: TutorialLessonId;
  } | null {
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
    const session = this.pve.get(game.matchId);
    const tutorial = this.tutorials.get(game.matchId);
    return {
      matchId: game.matchId,
      opponentName: getOpponentState(game, userId).username,
      phase: game.phase,
      ...(session && { adventureOpponentId: session.info.opponentId }),
      ...(tutorial && { tutorialLessonId: tutorial.lessonId }),
    };
  }

  /** Renvoie l'état d'une partie commencée à ses deux joueurs. */
  emitState(matchId: number, server: FightServer): void {
    const game = this.games.get(matchId);
    if (game && game.phase !== 'waiting')
      emitGameState(game, server, this.tutorialView(game));
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

  /**
   * Après tout changement : fin de partie, ou émission de l'état puis
   * relance du timer (ou, en PvE, du prochain coup de l'IA).
   */
  private async afterChange(
    game: GameState,
    server: FightServer,
  ): Promise<void> {
    const tut = this.tutorials.get(game.matchId);
    // Toutes les étapes jouées : le joueur remporte la leçon
    if (tut?.runner.done && game.phase !== 'finished')
      finishGame(game, tut.humanId, 'surrender');
    if (game.phase === 'finished') {
      await this.finish(game, server);
      return;
    }
    emitGameState(game, server, this.tutorialView(game));
    if (tut) {
      // Ni minuteur de tour, ni IA : seul l'adversaire scripté joue
      this.turnTimeout.clear(game.matchId);
      if (tut.runner.step?.kind === 'opponent')
        this.scheduleTutorialStep(game.matchId, tut, server);
      return;
    }
    const session = this.pve.get(game.matchId);
    if (session && aiMustAct(game, session.info.aiUserId)) {
      // L'IA n'a pas de minuteur : seul le joueur humain en a un
      this.turnTimeout.clear(game.matchId);
      this.scheduleAiStep(game.matchId, session, server);
      return;
    }
    this.turnTimeout.schedule(game.matchId, () =>
      this.onTimeout(game.matchId, server),
    );
  }

  private onTimeout(matchId: number, server: FightServer): Promise<void> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game) return;
      const session = this.pve.get(matchId);
      if (session) {
        // Timeout périmé : la main est passée à l'IA entre-temps
        if (aiMustAct(game, session.info.aiUserId)) return;
        session.info.timeouts += 1;
        if (session.info.timeouts >= PVE_MAX_TIMEOUTS) {
          const human = getOpponentState(game, session.info.aiUserId);
          addLog(game, `💤 ${human.username} est absent depuis trop longtemps`);
          finishGame(game, session.info.aiUserId, 'surrender');
          await this.afterChange(game, server);
          return;
        }
      }
      this.timeoutRecorded(game);
      await this.afterChange(game, server);
    });
  }

  private scheduleAiStep(
    matchId: number,
    session: PveSession,
    server: FightServer,
  ): void {
    if (session.aiTimer) return;
    session.aiTimer = setTimeout(() => {
      session.aiTimer = undefined;
      // Rejet non géré dans un setTimeout = arrêt du processus Node
      this.aiStep(matchId, server).catch((err: unknown) =>
        this.logger.error(
          `Coup de l'IA du match ${matchId} en échec`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
    }, AI_ACTION_DELAY_MS);
  }

  /** Un coup de l'IA ; refusé ou au-delà du plafond, elle finit sa phase. */
  private aiStep(matchId: number, server: FightServer): Promise<void> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      const session = this.pve.get(matchId);
      if (!game || !session) return;
      const { info } = session;
      if (!aiMustAct(game, info.aiUserId)) return;
      if (session.aiTurn !== game.turnNumber) {
        session.aiTurn = game.turnNumber;
        info.aiActionsThisTurn = 0;
      }
      const seat = seatOf(game, info.aiUserId)!;

      let progressed = false;
      if (info.aiActionsThisTurn >= AI_MAX_ACTIONS_PER_TURN) {
        this.logger.warn(
          `Match ${matchId} : plafond de ${AI_MAX_ACTIONS_PER_TURN} coups IA atteint`,
        );
      } else {
        info.aiActionsThisTurn += 1;
        const action = session.ai.chooseAction(game, seat, info.profile);
        progressed = this.tryAiAction(game, seat, action);
      }
      if (!progressed) this.forceAiProgress(game, seat, info.aiUserId);
      await this.afterChange(game, server);
    });
  }

  /** Joue un coup de l'IA ; false (journalisé) s'il est refusé ou lève. */
  private tryAiAction(
    game: GameState,
    seat: Seat,
    action: GameAction,
  ): boolean {
    try {
      const ticket = this.gameRecorder?.before(game, seat, action) ?? null;
      const { error } = this.engine.dispatch(game, seat, action);
      if (!error) {
        if (ticket) this.gameRecorder?.after(game, ticket, 'ai');
        return true;
      }
      this.logger.warn(
        `Match ${game.matchId} : coup IA ${JSON.stringify(action)} refusé — ${error}`,
      );
    } catch (err) {
      this.logger.error(
        `Match ${game.matchId} : coup IA ${JSON.stringify(action)} en exception`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    return false;
  }

  /** `engine.timeout`, enregistré comme entrée sans action du joueur actif. */
  private timeoutRecorded(game: GameState): void {
    const seat = seatOf(game, game.currentTurnUserId) ?? 'p1';
    const ticket = this.gameRecorder?.before(game, seat, null) ?? null;
    this.engine.timeout(game);
    if (ticket) this.gameRecorder?.after(game, ticket, 'timeout');
  }

  /**
   * Filet de sécurité : l'IA ne doit jamais bloquer la partie. Coup minimal
   * pour elle seule (garder sa main, prendre les premiers candidats, finir
   * sa phase) ; `engine.timeout` seulement pendant son propre tour, car il
   * agit aussi sur le joueur humain. Si rien ne passe, l'IA est en panne :
   * le joueur gagne.
   */
  private forceAiProgress(game: GameState, seat: Seat, aiUserId: number): void {
    const choice = currentChoice(game);
    let fallback: GameAction | undefined;
    if (choice) {
      if (choice.forUserId === aiUserId)
        fallback = {
          type: 'pick_cards',
          instanceIds: freshCandidates(game, choice)
            .slice(0, choice.count)
            .map((c) => c.instanceId),
        };
    } else if (game.phase === 'mulligan') {
      if (!seatPlayer(game, seat).mulliganDone)
        fallback = { type: 'mulligan', redraw: false };
    } else if (game.currentTurnUserId === aiUserId) {
      fallback = { type: 'end_phase' };
    }
    if (fallback && this.tryAiAction(game, seat, fallback)) return;

    if (game.phase !== 'mulligan' && game.currentTurnUserId === aiUserId) {
      try {
        this.timeoutRecorded(game);
        return;
      } catch (err) {
        this.logger.error(
          `Match ${game.matchId} : timeout forcé de l'IA en exception`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    this.logger.error(
      `Match ${game.matchId} : l'IA ne peut plus jouer, victoire du joueur`,
    );
    finishGame(game, getOpponentState(game, aiUserId).userId, 'disconnect');
  }

  private async finish(game: GameState, server: FightServer): Promise<void> {
    this.turnTimeout.clear(game.matchId);
    this.gameRecorder?.finish(game);
    const session = this.pve.get(game.matchId);
    const tut = this.tutorials.get(game.matchId);
    this.cleanupGame(game);
    if (tut) {
      await this.finishTutorial(game, tut, server);
      return;
    }
    if (session) {
      await this.finishPve(game, session.info, server);
      return;
    }
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

  /** Le journal de diagnostic ne doit jamais gêner la partie. */
  private logMatchEvent(logPath: string, event: MatchEvent): void {
    try {
      appendMatchEvent(logPath, event);
    } catch (err) {
      this.logger.warn(
        `Journal de partie en échec — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Fin PvE : résultat d'aventure au lieu de l'ELO et de l'historique JcJ. */
  private async finishPve(
    game: GameState,
    info: PveInfo,
    server: FightServer,
  ): Promise<void> {
    const logPath = process.env.AI_DECISION_LOG;
    if (logPath)
      this.logMatchEvent(logPath, {
        kind: 'end',
        matchId: game.matchId,
        turn: game.turnNumber,
        winner: game.winner ?? null,
        endReason: game.endReason,
        primes: { p1: game.player1.primes, p2: game.player2.primes },
      });
    let adventure: AdventureResultPayload | undefined;
    try {
      adventure = await this.pveHooks?.recordResult(game, info);
    } catch (err) {
      this.logger.error(
        `Enregistrement du combat d'aventure ${info.adventureMatchId} en échec`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    emitGameState(game, server);
    server
      .to(getOpponentState(game, info.aiUserId).socketId)
      .emit('fight:game_over', {
        winner: game.winner ?? null,
        endReason: game.endReason!,
        ...(adventure && { adventure }),
      });
  }

  private cleanupGame(game: GameState): void {
    const session = this.pve.get(game.matchId);
    if (session) {
      clearTimeout(session.aiTimer);
      this.pve.delete(game.matchId);
    }
    const tutorial = this.tutorials.get(game.matchId);
    if (tutorial) {
      clearTimeout(tutorial.timer);
      this.tutorials.delete(game.matchId);
    }
    for (const p of [game.player1, game.player2]) {
      clearTimeout(this.disconnectTimers.get(p.userId));
      this.disconnectTimers.delete(p.userId);
      this.userToMatch.delete(p.userId);
    }
    this.games.delete(game.matchId);
  }
}
