import { PuzzleObjectiveType as T } from '@pipou/shared';
import { createEngine } from '../fights/testing/engine';
import { playPuzzleAction } from './puzzle-step';
import { puzzleOutcome, startTrack } from './puzzle-objective';
import { solvePuzzle } from './puzzle-solver';
import { attackScenario } from './testing/attack-scenario';

const engine = createEngine();
const limits = { maxNodes: 20_000, maxMs: 5_000 };

describe('solvePuzzle', () => {
  it('trouve la solution en un coup', async () => {
    const g = attackScenario();
    const o = {
      type: T.DESTROY_MONSTER,
      targetInstanceId: g.player2.monsterZones[0]!.instanceId,
    };
    const r = await solvePuzzle(engine, g, o, 7, limits);
    expect(r.status).toBe('solved');
    expect(r.solution.at(-1)).toMatchObject({ type: 'attack' });
  });

  it('enchaîne phase principale puis combat', async () => {
    const g = attackScenario({ phase: 'main' });
    const r = await solvePuzzle(
      engine,
      g,
      { type: T.CLEAR_ENEMY_BOARD },
      7,
      limits,
    );
    expect(r.status).toBe('solved');
    expect(r.solution.length).toBeGreaterThanOrEqual(2);
  });

  it('la solution rejouée atteint bien l’objectif', async () => {
    const g = attackScenario({ phase: 'main' });
    const o = { type: T.CLEAR_ENEMY_BOARD };
    const r = await solvePuzzle(engine, g, o, 7, limits);
    const replay = structuredClone(g);
    const track = startTrack(replay);
    for (const a of r.solution) playPuzzleAction(engine, replay, a, 7, track);
    expect(puzzleOutcome(o, replay, track)).toBe('solved');
  });

  it('ne modifie pas l’état de départ', async () => {
    const g = attackScenario();
    const before = JSON.stringify(g);
    await solvePuzzle(engine, g, { type: T.CLEAR_ENEMY_BOARD }, 7, limits);
    expect(JSON.stringify(g)).toBe(before);
  });

  it('répond not_found, jamais « insoluble », quand rien ne marche', async () => {
    const g = attackScenario({ wallHp: 999_999 });
    const r = await solvePuzzle(
      engine,
      g,
      { type: T.CLEAR_ENEMY_BOARD },
      7,
      limits,
    );
    expect(r.status).toBe('not_found');
  });

  it('s’arrête au plafond de nœuds', async () => {
    const g = attackScenario({ phase: 'main' });
    const r = await solvePuzzle(
      engine,
      g,
      { type: T.TAKE_PRIMES, primes: 6 },
      7,
      {
        maxNodes: 1,
        maxMs: 5_000,
      },
    );
    expect(r.status).toBe('timeout');
  });
});
