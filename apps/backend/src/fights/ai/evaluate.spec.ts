import { DrakonStage } from '@pipou/shared';
import { equipmentCard, monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';
import { ARCHETYPE_PROFILES } from './archetype-profiles';
import { evaluate, handPotential } from './evaluate';

const baby = monsterCard('Bébé A', {
  stage: DrakonStage.BABY,
  lineage: 'A',
  atk: 100,
  hp: 300,
});
const young = (lineage: string) =>
  monsterCard(`Jeune ${lineage}`, {
    stage: DrakonStage.YOUNG,
    lineage,
    atk: 300,
    hp: 800,
    cost: 1,
  });

describe('evaluate', () => {
  it("les poids d'archétype viennent du profil", () => {
    expect(ARCHETYPE_PROFILES.pipou.perMonster).toBe(400);
    expect(ARCHETYPE_PROFILES.pixelman.perEquipment).toBe(400);
    expect(ARCHETYPE_PROFILES.dragon.perStage).toBe(300);
  });

  it("un Jeune compatible avec le Bébé en jeu vaut plus qu'un Jeune d'une autre lignée", () => {
    const withMatch = scenario({
      p1: { hand: [young('A')], monsters: [baby] },
    });
    const withOther = scenario({
      p1: { hand: [young('B')], monsters: [baby] },
    });
    expect(
      evaluate(withMatch, 'p1', 'dragon') - evaluate(withOther, 'p1', 'dragon'),
    ).toBeCloseTo(ARCHETYPE_PROFILES.dragon.prepEvolve);
  });

  it('un équipement sans porteur ne prépare rien', () => {
    const sword = equipmentCard('Épée', []);
    const alone = scenario({ p1: { hand: [sword] } });
    const carried = scenario({
      p1: { hand: [sword], monsters: [monsterCard('Porteur')] },
    });
    const profile = ARCHETYPE_PROFILES.pixelman;
    expect(handPotential(alone.player1, alone.player2, profile)).toBe(0);
    expect(handPotential(carried.player1, carried.player2, profile)).toBe(
      profile.prepEquip,
    );
  });
});
