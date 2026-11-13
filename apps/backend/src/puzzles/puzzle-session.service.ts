import { Injectable } from '@nestjs/common';
import type {
  GameAction,
  PuzzleObjective,
  PuzzleObjectiveView,
  PuzzleOutcome,
  PuzzleReward,
  PuzzleStartPayload,
} from '@pipou/shared';
import { GameEngine } from '../fights/engine/game-engine';
import { buildClientState } from '../fights/helpers/client-state.builder';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { SocketUser } from '../fights/socket-auth';
import {
  puzzleOutcome,
  startTrack,
  validateObjective,
  validateStart,
  type PuzzleTrack,
} from './puzzle-objective';
import { playPuzzleAction } from './puzzle-step';
import type { PuzzleServer } from './puzzle-socket.types';
import { PuzzlesService } from './puzzles.service';

interface Session {
  socketId: string;
  puzzleId: number;
  objective: PuzzleObjective;
  objectiveView: PuzzleObjectiveView;
  seed: number;
  /** État de départ, jamais modifié : « Recommencer » en repart. */
  initial: GameState;
  game: GameState;
  track: PuzzleTrack;
  outcome: PuzzleOutcome;
  test: boolean;
  cleanup?: NodeJS.Timeout;
}

const CLEANUP_DELAY_MS = 10 * 60_000;

/** Parties de défi en mémoire, une par joueur ; rien n'est persisté hors résolution. */
@Injectable()
export class PuzzleSessionService {
  private readonly sessions = new Map<number, Session>();
  private server!: PuzzleServer;

  constructor(
    private readonly engine: GameEngine,
    private readonly puzzles: PuzzlesService,
  ) {}

  bind(server: PuzzleServer): void {
    this.server = server;
  }

  async start(
    user: SocketUser,
    socketId: string,
    payload: PuzzleStartPayload,
  ): Promise<void> {
    const test = payload.puzzleId !== undefined;
    if (test && !user.isAdmin) throw new Error('Réservé aux administrateurs.');
    const puzzleId =
      payload.puzzleId ?? (await this.puzzles.today()).puzzle?.id;
    if (puzzleId === undefined) throw new Error('Aucun défi aujourd’hui.');
    const { puzzle, objective, game } = await this.puzzles.load(puzzleId, user);
    const problem = validateStart(game) ?? validateObjective(objective, game);
    if (problem) throw new Error(problem);
    this.drop(user.userId);
    const session: Session = {
      socketId,
      puzzleId,
      objective,
      objectiveView: this.puzzles.objectiveView(puzzle, game),
      seed: puzzle.seed,
      initial: game,
      game: structuredClone(game),
      track: startTrack(game),
      outcome: 'ongoing',
      test,
    };
    this.sessions.set(user.userId, session);
    this.publish(user.userId, session);
  }

  async act(userId: number, action: GameAction): Promise<void> {
    const s = this.require(userId);
    if (s.outcome !== 'ongoing')
      throw new Error('Le défi est terminé : recommence pour rejouer.');
    const before = structuredClone(s.game);
    const trackBefore: PuzzleTrack = {
      ...s.track,
      destroyed: [...s.track.destroyed],
    };
    // Même graine à chaque coup : le résultat ne dépend que de l'état et de l'action.
    const { error } = playPuzzleAction(
      this.engine,
      s.game,
      action,
      s.seed,
      s.track,
    );
    if (error) {
      s.game = before;
      s.track = trackBefore;
      throw new Error(error);
    }
    s.outcome = puzzleOutcome(s.objective, s.game, s.track);
    let reward: PuzzleReward | undefined;
    if (s.outcome === 'solved' && !s.test) {
      try {
        reward = await this.puzzles.completeToday(userId, s.puzzleId);
      } catch (e) {
        // Le défi du jour a changé pendant la partie : résolu, mais rien à verser.
        this.publish(userId, s);
        throw e;
      }
    }
    this.publish(userId, s, reward);
  }

  restart(userId: number): void {
    const s = this.require(userId);
    s.game = structuredClone(s.initial);
    s.track = startTrack(s.initial);
    s.outcome = 'ongoing';
    this.publish(userId, s);
  }

  close(userId: number): void {
    const s = this.sessions.get(userId);
    this.drop(userId);
    if (s) this.server.to(s.socketId).emit('puzzle:closed');
  }

  /** Coupure réseau : la partie attend dix minutes, puis disparaît (rien à perdre). */
  disconnect(userId: number): void {
    const s = this.sessions.get(userId);
    if (!s) return;
    if (s.cleanup) clearTimeout(s.cleanup);
    s.cleanup = setTimeout(
      () => this.sessions.delete(userId),
      CLEANUP_DELAY_MS,
    );
    s.cleanup.unref();
  }

  private drop(userId: number): void {
    const s = this.sessions.get(userId);
    if (s?.cleanup) clearTimeout(s.cleanup);
    this.sessions.delete(userId);
  }

  private require(userId: number): Session {
    const s = this.sessions.get(userId);
    if (!s) throw new Error('Aucun défi en cours.');
    return s;
  }

  private publish(userId: number, s: Session, reward?: PuzzleReward): void {
    this.server.to(s.socketId).emit('puzzle:state', {
      puzzleId: s.puzzleId,
      view: buildClientState(s.game, userId),
      objective: s.objectiveView,
      outcome: s.outcome,
      reward,
      test: s.test,
    });
    // Joués une seule fois : l'état suivant ne rejoue pas ces événements.
    s.game.pendingEvents = [];
  }
}
