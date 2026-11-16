import { PuzzleObjectiveType } from '@pipou/shared';
import { createEngine } from '../../fights/testing/engine';
import { realCard } from '../../fights/testing/real-cards';
import { puzzleOutcome, startTrack } from '../puzzle-objective';
import { solvePuzzle } from '../puzzle-solver';
import { naiveLineSolves, shortestSolution } from './puzzle-analysis';
import { buildPuzzle } from './puzzle-builder';
import { PUZZLES } from './puzzle-catalog';

const engine = createEngine();
const limits = { maxNodes: 200_000, maxMs: 30_000 };

describe('catalogue de défis', () => {
  it('compte 28 défis aux titres uniques et bornés', () => {
    expect(PUZZLES).toHaveLength(28);
    expect(new Set(PUZZLES.map((p) => p.title)).size).toBe(28);
    for (const p of PUZZLES) {
      expect(p.title.length).toBeLessThanOrEqual(80);
      expect(p.description.length).toBeLessThanOrEqual(255);
    }
  });

  it('couvre les quatre types d’objectif', () => {
    const types = new Set(PUZZLES.map((p) => p.objective.type));
    expect(types).toEqual(new Set(Object.values(PuzzleObjectiveType)));
  });

  it('n’utilise que des cartes réelles et des plateaux valides', () => {
    for (const def of PUZZLES)
      expect(() => buildPuzzle(def, realCard)).not.toThrow();
  });

  describe.each(PUZZLES.map((p, i) => [i + 1, p.title, p] as const))(
    'défi %i « %s »',
    (_n, _title, def) => {
      const { game, objective } = buildPuzzle(def, realCard);

      it('est résolu par le solveur dans la limite de temps', async () => {
        const r = await solvePuzzle(engine, game, objective, def.seed, limits);
        expect(r.status).toBe('solved');
        expect(r.solution.length).toBeGreaterThanOrEqual(def.minSteps);
      }, 60_000);

      it('n’est pas trivial : pas de solution plus courte que prévu', () => {
        const shortest = shortestSolution(engine, game, objective, def.seed);
        expect(shortest).not.toBeNull();
        expect(shortest!.length).toBeGreaterThanOrEqual(def.minSteps);
      }, 60_000);

      it('n’est pas déjà gagné au départ', () => {
        expect(puzzleOutcome(objective, game, startTrack(game))).toBe(
          'ongoing',
        );
      });

      if (def.trap)
        it('cache un piège : le coup évident échoue', () => {
          expect(naiveLineSolves(engine, game, objective, def.seed)).toBe(
            false,
          );
        });
    },
  );
});
