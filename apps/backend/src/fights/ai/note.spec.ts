import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomWeights } from '../testing/nn-weights';
import { evaluateLegacy } from './evaluate';
import { championOrLegacy, defaultNote, evaluatorOf, parseNote } from './note';

describe('note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'note-'));

  it('legacy : la note manuelle', () => {
    expect(evaluatorOf('legacy')).toBe(evaluateLegacy);
  });

  it('champion absent ou de version différente : repli sur la manuelle', () => {
    expect(championOrLegacy(join(dir, 'absent.json'))).toBe(evaluateLegacy);
    const old = join(dir, 'old.json');
    writeFileSync(
      old,
      JSON.stringify({ ...randomWeights(1), encodingVersion: 999 }),
    );
    expect(championOrLegacy(old)).toBe(evaluateLegacy);
  });

  it('champion valide : note réseau', () => {
    const good = join(dir, 'good.json');
    writeFileSync(good, JSON.stringify(randomWeights(1)));
    expect(championOrLegacy(good)).not.toBe(evaluateLegacy);
  });

  it('AI_EVAL : nn par défaut, legacy sur demande', () => {
    const saved = process.env.AI_EVAL;
    delete process.env.AI_EVAL;
    expect(defaultNote()).toBe('nn');
    process.env.AI_EVAL = 'legacy';
    expect(defaultNote()).toBe('legacy');
    if (saved === undefined) delete process.env.AI_EVAL;
    else process.env.AI_EVAL = saved;
  });

  it('parseNote : mots-clés, fichier .json, erreur sinon', () => {
    expect(parseNote(undefined, 'legacy')).toBe('legacy');
    expect(parseNote('nn', 'legacy')).toBe('nn');
    const file = join(dir, 'w.json');
    writeFileSync(file, JSON.stringify(randomWeights(2)));
    expect(parseNote(file, 'legacy')).toMatchObject({ generation: 0 });
    expect(() => parseNote('learned', 'legacy')).toThrow(/inconnue/);
  });
});
