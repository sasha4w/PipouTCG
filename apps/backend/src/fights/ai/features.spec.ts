import { monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';
import { FEATURE_NAMES, features } from './features';
import type { FeatureName } from './features';

const named = (f: number[]) =>
  Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, f[i]])) as Record<
    FeatureName,
    number
  >;

describe('features', () => {
  const game = () =>
    scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        primes: 3,
        hand: [monsterCard('Recrue'), monsterCard('Recrue')],
        monsters: [monsterCard('Lame', { atk: 600, hp: 1500 })],
      },
      p2: {
        primes: 1,
        monsters: [
          {
            card: monsterCard('Colosse', { atk: 500, hp: 1000 }),
            currentHp: 400,
          },
        ],
      },
    });

  it('un nombre par nom, tous finis', () => {
    const f = features(game(), 'p1', 'pipou');
    expect(f).toHaveLength(FEATURE_NAMES.length);
    expect(f.every(Number.isFinite)).toBe(true);
    expect(new Set(FEATURE_NAMES).size).toBe(FEATURE_NAMES.length);
  });

  it('décrit les plateaux, la main et les Primes du point de vue du siège', () => {
    const f = named(features(game(), 'p1', 'pipou'));
    expect(f.bias).toBe(1);
    expect(f.myTurn).toBe(1);
    expect(f.myPrimesLeft).toBe(3);
    expect(f.oppPrimesLeft).toBe(1);
    expect(f.oppLastPrime).toBe(1);
    expect(f.myLastPrime).toBe(0);
    expect(f.handCount).toBe(2);
    expect(f.myMonsters).toBe(1);
    expect(f.myAtk).toBe(6);
    expect(f.myHp).toBe(15);
    expect(f.oppMonsters).toBe(1);
    expect(f.oppHp).toBe(4);
    // Moi : 2 en main + 1 monstre ; lui : 1 monstre
    expect(f.cardDiff).toBe(2);
  });

  it('compte les dégâts déjà infligés et ce qu’une attaque achève', () => {
    const f = named(features(game(), 'p1', 'pipou'));
    expect(f.oppMissingHp).toBe(6);
    // Lame (600) achève Colosse (400 PV restants)
    expect(f.finishable).toBe(1);
    // Colosse (500) n'achève pas Lame (1500 PV)
    expect(f.myFinishable).toBe(0);
    expect(f.myMissingHp).toBe(0);
  });

  it('vu de l’autre siège, les côtés s’échangent', () => {
    const f = named(features(game(), 'p2', 'pipou'));
    expect(f.myTurn).toBe(0);
    expect(f.myPrimesLeft).toBe(1);
    expect(f.myMissingHp).toBe(6);
    expect(f.myFinishable).toBe(1);
    expect(f.cardDiff).toBe(-2);
    // Lame tue Colosse en mode ATK (1 Prime), puis les 2 Recrues posées en
    // renfort frappent le terrain vide en direct (2 Primes) ; il ne m'en reste qu'une
    expect(f.threatPrimes).toBe(3);
    expect(f.threatLethal).toBe(1);
  });

  it('le potentiel ne compte qu’à mon tour', () => {
    expect(named(features(game(), 'p1', 'pipou')).potentialPrimes).toBe(1);
    expect(named(features(game(), 'p2', 'pipou')).potentialPrimes).toBe(0);
  });

  it('plateaux vides : tous finis', () => {
    const f = features(scenario({ turn: 'p1', phase: 'main' }), 'p1', 'pipou');
    expect(f.every(Number.isFinite)).toBe(true);
  });

  it('ne modifie pas l’état', () => {
    const g = game();
    const before = JSON.stringify(g);
    features(g, 'p1', 'dragon');
    expect(JSON.stringify(g)).toBe(before);
  });
});
