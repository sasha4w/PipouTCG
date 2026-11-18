import { wilson } from './stats';

describe('wilson', () => {
  it('55 % sur 400 : borne basse juste au-dessus de 50 %', () => {
    const { lower, upper } = wilson(220, 400);
    expect(lower).toBeCloseTo(0.501, 3);
    expect(upper).toBeCloseTo(0.598, 3);
  });

  it('aucune partie : intervalle [0, 1]', () => {
    expect(wilson(0, 0)).toEqual({ lower: 0, upper: 1 });
  });
});
