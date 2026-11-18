import { Logger } from '@nestjs/common';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { GameAction, Seat } from '@pipou/shared';
import type { GameEngine } from '../engine/game-engine';
import { evolutionCatalog } from '../helpers/evolution-catalog';
import type { GameState } from '../interfaces/game-state.interface';
import { AiPlayer } from './ai-player';
import type { AiLevel, AiProfile } from './ai-player';
import type { DecisionRecord, DecisionSink } from './decision-log';

/** Au-delà, le coup glouton de la note manuelle est joué et le worker relancé. */
export const AI_HARD_LIMIT_MS = 4000;

/** L'IA d'un combat, vue par le service : asynchrone, qu'elle réfléchisse ici ou dans le worker. */
export interface AiMover {
  decide(game: GameState, seat: Seat, profile: AiProfile): Promise<GameAction>;
  setDecisionSink(sink: DecisionSink | null, run?: string): void;
  dispose(): void;
}

/** Réflexion dans le thread principal (tests, AI_WORKER=off). */
export class LocalMover implements AiMover {
  constructor(private readonly ai: AiPlayer) {}

  decide(game: GameState, seat: Seat, profile: AiProfile): Promise<GameAction> {
    return Promise.resolve(this.ai.chooseAction(game, seat, profile));
  }

  setDecisionSink(sink: DecisionSink | null, run = 'run'): void {
    this.ai.setDecisionSink(sink, run);
  }

  dispose(): void {}
}

export type ToWorker =
  | {
      type: 'decide';
      id: number;
      matchId: number;
      level: AiLevel;
      game: GameState;
      seat: Seat;
      profile: AiProfile;
      /** Préfixe du journal de décisions ; null : pas de journal. */
      log: string | null;
    }
  | { type: 'dispose'; matchId: number };

export type FromWorker =
  | {
      type: 'decided';
      id: number;
      action: GameAction;
      records: DecisionRecord[];
    }
  | { type: 'failed'; id: number; message: string };

/** Ce dont le pool a besoin d'un Worker (remplaçable en test). */
export interface WorkerLike {
  postMessage(msg: ToWorker): void;
  on(event: 'message', listener: (msg: FromWorker) => void): unknown;
  on(event: 'error' | 'exit', listener: (arg: unknown) => void): unknown;
  terminate(): Promise<number>;
}

type DecideRequest = Omit<Extract<ToWorker, { type: 'decide' }>, 'id'>;

interface Job {
  id: number;
  request: DecideRequest;
  resolve: (reply: FromWorker | null) => void;
}

/**
 * Un seul worker pour toutes les parties, une requête à la fois : les autres
 * attendent leur tour. Le plafond court à partir de l'envoi au worker. Un
 * dépassement ne tue que le worker occupé ; les requêtes en attente repartent
 * vers le nouveau.
 */
export class AiWorkerPool {
  private readonly logger = new Logger(AiWorkerPool.name);
  private worker: WorkerLike | null = null;
  private next = 1;
  private readonly queue: Job[] = [];
  private current: { job: Job; timer: NodeJS.Timeout } | null = null;

  constructor(
    private readonly spawn: () => WorkerLike,
    private readonly limitMs = AI_HARD_LIMIT_MS,
  ) {}

  /** Réponse du worker, ou null (délai dépassé, worker mort, état non transmissible). */
  ask(request: DecideRequest): Promise<FromWorker | null> {
    return new Promise((resolve) => {
      this.queue.push({ id: this.next++, request, resolve });
      this.pump();
    });
  }

  post(msg: ToWorker): void {
    this.worker?.postMessage(msg);
  }

  dispose(): void {
    for (const job of this.queue.splice(0)) job.resolve(null);
    this.failCurrent();
    this.kill();
  }

  private pump(): void {
    while (!this.current && this.queue.length > 0) {
      const job = this.queue.shift()!;
      const timer = setTimeout(() => {
        this.logger.warn(`Réflexion ${job.id} hors délai, worker relancé`);
        this.failCurrent();
        this.kill();
        this.pump();
      }, this.limitMs);
      this.current = { job, timer };
      try {
        this.ensure().postMessage({ ...job.request, id: job.id });
      } catch (err) {
        this.logger.warn(
          `Envoi au worker d'IA impossible (état non transmissible ?) — ${String(err)}`,
        );
        this.failCurrent();
      }
    }
  }

  /** Termine la requête en cours par un repli. */
  private failCurrent(): void {
    this.finishCurrent(null);
  }

  private finishCurrent(reply: FromWorker | null): void {
    const cur = this.current;
    if (!cur) return;
    clearTimeout(cur.timer);
    this.current = null;
    cur.job.resolve(reply);
  }

  private ensure(): WorkerLike {
    if (this.worker) return this.worker;
    const w = this.spawn();
    w.on('message', (reply: FromWorker) => {
      if (this.worker !== w || this.current?.job.id !== reply.id) return;
      this.finishCurrent(reply);
      this.pump();
    });
    const died = () => {
      if (this.worker !== w) return;
      this.failCurrent();
      this.kill();
      this.pump();
    };
    w.on('error', died);
    w.on('exit', died);
    this.worker = w;
    return w;
  }

  private kill(): void {
    const w = this.worker;
    this.worker = null;
    w?.terminate().catch(() => {});
  }
}

/** Réflexion dans le worker ; en cas d'échec, coup glouton de la note manuelle ici. */
export class WorkerMover implements AiMover {
  private readonly logger = new Logger(WorkerMover.name);
  private readonly fallback: AiPlayer;
  private sink: DecisionSink | null = null;
  private run = 'run';

  constructor(
    private readonly pool: AiWorkerPool,
    private readonly matchId: number,
    private readonly level: AiLevel,
    engine: GameEngine,
  ) {
    this.fallback = new AiPlayer(engine, Math.random);
  }

  async decide(
    game: GameState,
    seat: Seat,
    profile: AiProfile,
  ): Promise<GameAction> {
    const reply = await this.pool.ask({
      type: 'decide',
      matchId: this.matchId,
      level: this.level,
      game,
      seat,
      profile,
      log: this.sink ? this.run : null,
    });
    if (reply?.type === 'decided') {
      for (const record of reply.records) {
        try {
          this.sink?.(record);
        } catch (err) {
          this.logger.warn(`Journal de décisions en échec — ${String(err)}`);
        }
      }
      return reply.action;
    }
    this.logger.warn(
      `Match ${this.matchId} : IA ${reply ? `en échec (${reply.message})` : 'hors délai'}, coup glouton de repli`,
    );
    return this.fallback.chooseAction(game, seat, profile);
  }

  setDecisionSink(sink: DecisionSink | null, run = 'run'): void {
    this.sink = sink;
    this.run = run;
  }

  dispose(): void {
    this.pool.post({ type: 'dispose', matchId: this.matchId });
  }
}

/** Worker hors tests, sauf AI_WORKER=off. */
export function useAiWorker(): boolean {
  return process.env.NODE_ENV !== 'test' && process.env.AI_WORKER !== 'off';
}

/** Lance nn/ai-worker ; en développement (.ts), via ts-node. */
export function spawnAiWorker(): WorkerLike {
  const ts = extname(__filename) === '.ts';
  const file = join(__dirname, 'nn', `ai-worker${ts ? '.ts' : '.js'}`);
  const workerData = { catalog: evolutionCatalog() };
  if (!ts) return new Worker(file, { workerData });
  const boot = [
    "require('ts-node').register({ transpileOnly: true });",
    "require('tsconfig-paths/register');",
    `require(${JSON.stringify(file)});`,
  ].join('\n');
  return new Worker(boot, { eval: true, workerData });
}
