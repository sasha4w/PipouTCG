import { cardNameMatches, normalizeCardName } from './card-name';

describe('noms de cartes', () => {
  it('normalise accents, casse et espaces', () => {
    expect(normalizeCardName('  Médecin   Citrouille ')).toBe(
      'medecin citrouille',
    );
  });

  it("compare à l'égalité par défaut", () => {
    expect(cardNameMatches('Noyau Alpha ', 'noyau alpha')).toBe(true);
    expect(cardNameMatches('Noyau Alpha X', 'Noyau Alpha')).toBe(false);
  });

  it("vise une série avec 'contains'", () => {
    expect(cardNameMatches('Roi de la Rose', 'de la rose', 'contains')).toBe(
      true,
    );
    expect(
      cardNameMatches('Chevalier de la rose', 'de la rose', 'contains'),
    ).toBe(true);
    expect(cardNameMatches('Roi de la Rose', 'de la rose')).toBe(false);
  });
});
