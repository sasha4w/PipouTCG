import { EventEmitter } from 'node:events';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';
import { AiWorkerPool, WorkerMover } from './ai-mover';
import type { FromWorker, ToWorker, WorkerLike } from './ai-mover';

class FakeWorker extends EventEmitter implements WorkerLike {
  sent: ToWorker[] = [];
  terminated = false;
  constructor(private readonly reply: ((msg: ToWorker) => FromWorker) | null) {
    super();
  }
  postMessage(msg: ToWorker): void {
    this.sent.push(msg);
    if (this.reply && msg.type === 'decide') {
      const out = this.reply(msg);
      setImmediate(() => this.emit('message', out));
    }
  }
  terminate(): Promise<number> {
    this.terminated = true;
    return Promise.resolve(0);
  }
}

const engine = createEngine();
const game = () =>
  scenario({ p1: { monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] } });
const profile = { archetype: 'pipou' as const, level: 3 as const };

describe('WorkerMover', () => {
  it('coup du worker, décisions transmises au journal', async () => {
    const worker = new FakeWorker((msg) => ({
      type: 'decided',
      id: msg.type === 'decide' ? msg.id : 0,
      action: { type: 'end_phase' },
      records: [{ id: 'r1' } as never],
    }));
    const mover = new WorkerMover(new AiWorkerPool(() => worker), 1, 3, engine);
    const sink = jest.fn();
    mover.setDecisionSink(sink, 'pve');
    await expect(mover.decide(game(), 'p1', profile)).resolves.toEqual({
      type: 'end_phase',
    });
    expect(sink).toHaveBeenCalledWith({ id: 'r1' });
    expect(worker.sent[0]).toMatchObject({
      type: 'decide',
      matchId: 1,
      level: 3,
      log: 'pve',
    });
  });

  it('pas de réponse dans le délai : coup glouton légal, worker relancé', async () => {
    const spawned: FakeWorker[] = [];
    const pool = new AiWorkerPool(() => {
      const w = new FakeWorker(null);
      spawned.push(w);
      return w;
    }, 20);
    const mover = new WorkerMover(pool, 1, 3, engine);
    const state = game();
    const action = await mover.decide(state, 'p1', profile);
    expect(
      engine.dispatch(structuredClone(state), 'p1', action).error,
    ).toBeUndefined();
    expect(spawned[0].terminated).toBe(true);
    await mover.decide(state, 'p1', profile);
    expect(spawned).toHaveLength(2);
  });

  it('worker mort pendant la réflexion : repli', async () => {
    const worker = new FakeWorker(null);
    const mover = new WorkerMover(new AiWorkerPool(() => worker), 1, 3, engine);
    const pending = mover.decide(game(), 'p1', profile);
    worker.emit('exit', 1);
    await expect(pending).resolves.toHaveProperty('type');
  });

  it('dispose : le worker oublie la partie', async () => {
    const worker = new FakeWorker((msg) => ({
      type: 'decided',
      id: msg.type === 'decide' ? msg.id : 0,
      action: { type: 'end_phase' },
      records: [],
    }));
    const mover = new WorkerMover(new AiWorkerPool(() => worker), 7, 3, engine);
    await mover.decide(game(), 'p1', profile);
    mover.dispose();
    expect(worker.sent.at(-1)).toEqual({ type: 'dispose', matchId: 7 });
  });
});
