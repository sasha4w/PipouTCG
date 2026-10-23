import { DRAKON_ORIGINES_CARDS } from './drakon-origines-cards';
import { realCard } from '../fights/testing/real-cards';

describe('drakon-origines-cards', () => {
  it('5 cartes aux valeurs du plan', () => {
    const pick = DRAKON_ORIGINES_CARDS.map(
      ({ name, rarity, stage, element, lineage, cost, atk, hp }) => ({
        name,
        rarity,
        stage,
        element,
        lineage,
        cost,
        atk,
        hp,
      }),
    );
    expect(pick).toEqual([
      {
        name: 'Ancestral Teros',
        rarity: 'legendary',
        stage: 'ancestral',
        element: 'earth',
        lineage: 'teros',
        cost: 4,
        atk: 800,
        hp: 3900,
      },
      {
        name: 'Ancestral Feros',
        rarity: 'legendary',
        stage: 'ancestral',
        element: 'fire',
        lineage: 'feros',
        cost: 4,
        atk: 2100,
        hp: 1800,
      },
      {
        name: 'Ancestral Ackos',
        rarity: 'legendary',
        stage: 'ancestral',
        element: 'water',
        lineage: 'ackos',
        cost: 4,
        atk: 1000,
        hp: 2900,
      },
      {
        name: 'Ancestral Tempestu',
        rarity: 'legendary',
        stage: 'ancestral',
        element: 'wind',
        lineage: 'tempestu',
        cost: 4,
        atk: 1300,
        hp: 2100,
      },
      {
        name: 'Drakon des Origines',
        rarity: 'secret',
        stage: null,
        element: null,
        lineage: null,
        cost: 4,
        atk: 1500,
        hp: 4000,
      },
    ]);
  });

  it('descriptions ≤ 255 et cartes présentes dans les vraies cartes', () => {
    for (const c of DRAKON_ORIGINES_CARDS) {
      expect(c.description.length).toBeLessThanOrEqual(255);
      expect(realCard(c.name).archetype).toBe('dragon');
    }
  });
});
