import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PARITY_TOLERANCE, parityError } from './mlp';
import { CHAMPION_PATH, readWeights } from './weights';

describe('parité PyTorch / TypeScript', () => {
  it('fixture : l’inférence TS retrouve les sorties PyTorch', () => {
    const w = readWeights(join(__dirname, 'parity-fixture.json'));
    expect(w.parity?.positions.length).toBe(50);
    expect(parityError(w)).toBeLessThan(PARITY_TOLERANCE);
  });

  (existsSync(CHAMPION_PATH) ? it : it.skip)(
    'champion déployé : parité respectée',
    () => {
      expect(parityError(readWeights(CHAMPION_PATH))).toBeLessThan(
        PARITY_TOLERANCE,
      );
    },
  );
});
