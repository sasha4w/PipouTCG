import { pickSoftmax } from './temperature';

const items = [
  { name: 'a', score: 0 },
  { name: 'b', score: 100 },
  { name: 'c', score: 100 },
];
const score = (i: { score: number }) => i.score;

describe('pickSoftmax', () => {
  it('température 0 : le premier meilleur, sans tirage', () => {
    const random = jest.fn(() => 0.99);
    expect(pickSoftmax(items, score, 0, random).name).toBe('b');
    expect(random).not.toHaveBeenCalled();
  });

  it('meilleur score infini : toujours lui, même très chaud', () => {
    const win = [...items, { name: 'w', score: Infinity }];
    expect(pickSoftmax(win, score, 1e9, () => 0).name).toBe('w');
  });

  it('très chaud : tirage presque uniforme selon random', () => {
    expect(pickSoftmax(items, score, 1e9, () => 0).name).toBe('a');
    expect(pickSoftmax(items, score, 1e9, () => 0.5).name).toBe('b');
    expect(pickSoftmax(items, score, 1e9, () => 0.99).name).toBe('c');
  });

  it('froid : le moins bon devient improbable', () => {
    // poids de a : exp(-100/10) ≈ 4,5e-5 ; random 0,001 tombe déjà sur b
    expect(pickSoftmax(items, score, 10, () => 0.001).name).toBe('b');
  });

  it('un score -Infinity n’est jamais tiré', () => {
    const lost = [{ name: 'x', score: -Infinity }, ...items];
    expect(pickSoftmax(lost, score, 1e9, () => 0).name).toBe('a');
  });

  it('refuse une liste vide', () => {
    expect(() => pickSoftmax([], score, 1, () => 0)).toThrow();
  });
});
