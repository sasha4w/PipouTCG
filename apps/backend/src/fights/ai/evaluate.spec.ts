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
  it('le détail du score s’additionne au score, sans le changer', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { monsters: [baby], hand: [young('A')] },
      p2: { monsters: [monsterCard('Lame', { atk: 400, hp: 300 })] },
    });
    const parts: Record<string, number> = {};

    const score = evaluate(game, 'p1', 'dragon', true, parts);

    expect(score).toBe(evaluate(game, 'p1', 'dragon', true));
    const sum = Object.values(parts).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(score);
    expect(Object.keys(parts)).toEqual(
      expect.arrayContaining(['primes', 'myBoard', 'oppBoard', 'threat']),
    );
  });

  it('la menace compte deux attaquants qui tuent ensemble ce qu’aucun ne tue seul', () => {
    // Partie réelle (tour 3) : Général 800/1500 face à 1000 + 800 d'attaque
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p1: {
        monsters: [
          monsterCard('Mastodonte', { atk: 1000, hp: 1200 }),
          monsterCard('Chevalier', { atk: 800, hp: 500 }),
        ],
      },
      p2: { monsters: [monsterCard('Général', { atk: 800, hp: 1500 })] },
    });
    const parts: Record<string, number> = {};

    evaluate(game, 'p2', 'pipou', false, parts);

    expect(parts.threat).toBeLessThan(0);
  });

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
      evaluate(withMatch, 'p1', 'dragon', true) -
        evaluate(withOther, 'p1', 'dragon', true),
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

describe('evaluate sans préparation', () => {
  it("le glouton (aventure) ignore la préparation, comme à l'étape 1", () => {
    const withMatch = scenario({
      p1: { hand: [young('A')], monsters: [baby] },
    });
    const withOther = scenario({
      p1: { hand: [young('B')], monsters: [baby] },
    });
    expect(
      evaluate(withMatch, 'p1', 'dragon') - evaluate(withOther, 'p1', 'dragon'),
    ).toBeCloseTo(0);
  });
});
