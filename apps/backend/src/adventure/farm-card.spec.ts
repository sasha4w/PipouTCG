import { allRealCards } from '../fights/testing/real-cards';
import { farmCardFor } from './farm-card';
import { planOpponents } from './world-factory';
import { LAUNCH_SIGNATURES } from './signatures';

const CARDS = allRealCards();
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
});
