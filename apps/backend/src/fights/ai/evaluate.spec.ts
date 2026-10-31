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

  it('adversaire à une Prime de la victoire : se barricader vaut mieux que prendre une Prime', () => {
    // Partie réelle (tour 11) : l'IA prenait une Prime avec son Champion et le
    // laissait tuable, alors que l'adversaire n'avait plus qu'une Prime à prendre
    const opponent = (withChampion: boolean) => ({
      primes: 1,
      monsters: [
        monsterCard('Maraudeur', { atk: 800, hp: 1000 }),
        ...(withChampion
          ? [monsterCard('Champion adverse', { atk: 1200, hp: 900 })]
          : []),
        monsterCard('Général', { atk: 1100, hp: 1800 }),
      ],
    });
    const attacked = scenario({
      turn: 'p2',
      phase: 'end',
      p1: opponent(false),
      p2: {
        primes: 4,
        monsters: [
          {
            card: monsterCard('Champion', { atk: 1200, hp: 1800 }),
            currentHp: 600,
          },
        ],
        hand: [
          monsterCard('Lieutenant', { atk: 300, hp: 500, cost: 1 }),
          monsterCard('Médecin', { atk: 100, hp: 1800, cost: 3 }),
        ],
      },
    });
    const barricaded = scenario({
      turn: 'p2',
      phase: 'end',
      p1: opponent(true),
      p2: {
        primes: 5,
        monsters: [
          {
            card: monsterCard('Champion', { atk: 1200, hp: 1800 }),
            mode: 'guard',
          },
          {
            card: monsterCard('Lieutenant', { atk: 300, hp: 500, cost: 1 }),
            mode: 'guard',
          },
        ],
      },
    });

    expect(evaluate(barricaded, 'p2', 'pipou')).toBeGreaterThan(
      evaluate(attacked, 'p2', 'pipou'),
    );
  });

  it('la menace compte les monstres que l’adversaire peut poser et lancer aussitôt', () => {
    // Partie réelle (tour 2) : l'adversaire, terrain vide, a posé deux monstres
    // qui ont tué ensemble le Capitaine laissé en attaque
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p1: {
        hand: [
          monsterCard('Mastodonte', { atk: 700, hp: 800, cost: 0 }),
          monsterCard('Chevalier', { atk: 500, hp: 900, cost: 0 }),
        ],
      },
      p2: { monsters: [monsterCard('Capitaine', { atk: 500, hp: 1100 })] },
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

  it("garder une évolution en main vaut moins que d'évoluer (sinon l'IA passe son tour)", () => {
    // Partie réelle : prepEvolve 400 contre un gain d'évolution de 390,
    // l'IA gardait Ancestral Feros en main et finissait sa phase
    const profile = ARCHETYPE_PROFILES.dragon;
    expect(profile.prepEvolve).toBeLessThan(profile.perStage);
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
