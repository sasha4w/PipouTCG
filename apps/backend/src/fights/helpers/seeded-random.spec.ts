import { seeded, withRandom } from './seeded-random';

describe('seeded-random', () => {
  it('seeded : même graine, même suite', () => {
    const a = seeded(7);
    const b = seeded(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('withRandom : fige Math.random puis le restaure', () => {
    const real = Math.random;
    const x = withRandom(3, () => Math.random());
    const y = withRandom(3, () => Math.random());
    expect(x).toBe(y);
    expect(Math.random).toBe(real);
  });
});
