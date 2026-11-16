import { allRealCards } from '../fights/testing/real-cards';
import type { Card } from '../cards/card.entity';
import { farmCardFor, ORIGINES_FARM_PCT } from './farm-card';
import { planOpponents } from './world-factory';
import { LAUNCH_SIGNATURES } from './signatures';

const CARDS = allRealCards();
const card = (o: Partial<Card>) =>
  ({ effects: [], stage: null, element: null, ...o }) as unknown as Card;
const id = (name: string) => CARDS.find((c) => c.name === name)!.id;

describe('farmCardFor', () => {
  it("un niveau d'élément fait tomber son Ancestral à 5 %", () => {
    expect(farmCardFor(CARDS, LAUNCH_SIGNATURES.dragon[1], 2)).toEqual({
      farmCardId: id('Ancestral Feros'),
      farmCardPct: 5,
    });
  });

  it('le boss des 4 éléments fait tomber le Drakon des Origines à 1 %', () => {
    expect(farmCardFor(CARDS, LAUNCH_SIGNATURES.dragon[4], 5)).toEqual({
      farmCardId: id('Drakon des Origines'),
      farmCardPct: 1,
    });
  });

  it('ailleurs : aucune carte précise', () => {
    expect(farmCardFor(CARDS, LAUNCH_SIGNATURES.pipou[0], 1)).toEqual({
      farmCardId: null,
      farmCardPct: 0,
    });
  });

  it('les mondes créés au démarrage reçoivent leurs cartes précises', () => {
    const plans = planOpponents(CARDS, LAUNCH_SIGNATURES.dragon, () => 0.5);
    expect(plans.map((p) => p.farm.farmCardId)).toEqual([
      id('Ancestral Teros'),
      id('Ancestral Feros'),
      id('Ancestral Ackos'),
      id('Ancestral Tempestu'),
      id('Drakon des Origines'),
    ]);
  });

  it('boss niveau 5 à signature secrète sans condition d’éléments : sa carte à 1 %', () => {
    const magouille = card({
      id: 10,
      name: 'Maître Magouille',
      rarity: 'secret',
      archetype: 'pipou',
    });
    expect(
      farmCardFor(
        [magouille],
        { archetype: 'pipou', cardName: 'Maître Magouille' } as never,
        5,
      ),
    ).toEqual({ farmCardId: 10, farmCardPct: ORIGINES_FARM_PCT });
  });

  it('niveau 4 à signature secrète : pas de butin de boss', () => {
    const delta = card({
      id: 7,
      name: 'Noyau Delta',
      rarity: 'secret',
      archetype: 'pixelman',
    });
    expect(
      farmCardFor(
        [delta],
        { archetype: 'pixelman', cardName: 'Noyau Delta' } as never,
        4,
      ).farmCardPct,
    ).not.toBe(ORIGINES_FARM_PCT);
  });
});
