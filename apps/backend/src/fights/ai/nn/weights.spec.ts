// apps/backend/src/fights/ai/nn/weights.spec.ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomWeights } from '../../testing/nn-weights';
import { loadChampion, validateWeights } from './weights';

describe('weights', () => {
  it('poids de forme valide acceptés', () => {
    expect(() => validateWeights(randomWeights(1, [1, 2]))).not.toThrow();
  });

  it('version d’encodage différente : refusée', () => {
    const w = { ...randomWeights(1), encodingVersion: 999 };
    expect(() => validateWeights(w)).toThrow(/encodage/);
  });

  it('couche de mauvaise taille : refusée', () => {
    const w = randomWeights(1);
    w.layers.head1.w[0].pop();
    expect(() => validateWeights(w)).toThrow(/head1/);
  });

  it('loadChampion : fichier absent ou invalide → raison', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nn-'));
    expect(loadChampion(join(dir, 'absent.json'))).toEqual({
      reason: expect.stringContaining('absent') as string,
    });
    const bad = join(dir, 'bad.json');
    writeFileSync(
      bad,
      JSON.stringify({ ...randomWeights(1), encodingVersion: 999 }),
    );
    expect('reason' in loadChampion(bad)).toBe(true);
    const good = join(dir, 'good.json');
    writeFileSync(good, JSON.stringify(randomWeights(1)));
    expect('weights' in loadChampion(good)).toBe(true);
  });
});
