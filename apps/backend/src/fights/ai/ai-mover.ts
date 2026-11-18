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

/** Un seul worker pour toutes les parties ; relancé s'il dépasse le délai ou meurt. */
export class AiWorkerPool {
  private worker: WorkerLike | null = null;
  private next = 1;
  private readonly pending = new Map<
    number,
    (reply: FromWorker | null) => void
  >();

  constructor(
    private readonly spawn: () => WorkerLike,
    private readonly limitMs = AI_HARD_LIMIT_MS,
  ) {}

  /** Réponse du worker, ou null (délai dépassé, worker mort, état non transmissible). */
  ask(request: DecideRequest): Promise<FromWorker | null> {
    const id = this.next++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.restart();
        resolve(null);
      }, this.limitMs);
      this.pending.set(id, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
      try {
        this.ensure().postMessage({ ...request, id });
      } catch {
        this.settle(id, null);
      }
    });
  }

  post(msg: ToWorker): void {
    this.worker?.postMessage(msg);
  }

  dispose(): void {
    this.restart();
  }

  private settle(id: number, reply: FromWorker | null): void {
    const done = this.pending.get(id);
    if (!done) return;
    this.pending.delete(id);
    done(reply);
  }

  private ensure(): WorkerLike {
    if (this.worker) return this.worker;
    const w = this.spawn();
    w.on('message', (reply: FromWorker) => this.settle(reply.id, reply));
    w.on('error', () => {
      if (this.worker === w) this.restart();
    });
    w.on('exit', () => {
      if (this.worker === w) this.restart();
    });
    this.worker = w;
    return w;
  }

  /** Arrête le worker courant ; toutes les réflexions en cours passent en repli. */
  private restart(): void {
    const w = this.worker;
    this.worker = null;
    for (const id of [...this.pending.keys()]) this.settle(id, null);
    void w?.terminate();
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
