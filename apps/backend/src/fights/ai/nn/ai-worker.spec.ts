import { createEngine } from '../../testing/engine';
import { monsterCard } from '../../testing/cards';
import { scenario } from '../../testing/scenario';
import { AiWorkerPool, WorkerMover, spawnAiWorker } from '../ai-mover';

describe('worker d’IA réel', () => {
  const engine = createEngine(); // remplit le catalogue copié vers le worker
  const pool = new AiWorkerPool(spawnAiWorker, 60_000);
  afterAll(() => pool.dispose());

  it('rend un coup légal', async () => {
    const game = scenario({
      p1: { monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] },
    });
    const mover = new WorkerMover(pool, 1, 2, engine);
    const action = await mover.decide(game, 'p1', {
      archetype: 'pipou',
      level: 2,
    });
    expect(
      engine.dispatch(structuredClone(game), 'p1', action).error,
    ).toBeUndefined();
  }, 90_000);
});
