import { SupportType, validateEffects } from '@pipou/shared';
import {
  allRealCardsBeforeSecretes,
  realCard,
} from '../fights/testing/real-cards';
import {
  DELTA_EFFECTS,
  MAGOUILLE_EFFECTS,
  PROTOCOLE_DELTA,
  SECRETES_PATCHES,
} from './secretes-2026-11-patches';
import { IMMUNITY_PATCHES } from './immunities-2026-10-patches';

describe('patch secrètes 2026-11', () => {
  it('chaque `before` décrit la carte en base à ce patch', () => {
    const [magouille, delta] = SECRETES_PATCHES.map((p) => p.before);
    const immunity = IMMUNITY_PATCHES.find(
      (p) => p.cardName === 'Maître Magouille',
    )!;
    expect(magouille.effects).toEqual(immunity.after);
    expect(magouille.description).toBe(immunity.descriptionAfter);
    const c = allRealCardsBeforeSecretes().find(
      (x) => x.name === 'Noyau Delta',
    )!;
    expect(delta).toEqual({
      name: c.name,
      description: c.description,
      atk: c.atk,
      hp: c.hp,
      cost: c.cost,
      effects: c.effects,
    });
  });

  it('Magouille 1200/3500 coût 4, Delta 1800/2500 coût 4', () => {
    const after = Object.fromEntries(
      SECRETES_PATCHES.map((p) => [p.after.name, p.after]),
    );
    expect(after['Maître Magouille']).toMatchObject({
      atk: 1200,
      hp: 3500,
      cost: 4,
    });
    expect(after['Noyau Delta']).toMatchObject({
      atk: 1800,
      hp: 2500,
      cost: 4,
    });
  });

  it('effets valides au schéma', () => {
    expect(validateEffects('monster', MAGOUILLE_EFFECTS)).toEqual([]);
    expect(validateEffects('monster', DELTA_EFFECTS)).toEqual([]);
    expect(
      validateEffects(SupportType.CHARGE, PROTOCOLE_DELTA.effects),
    ).toEqual([]);
  });

  it('Protocole Delta : Charge pixelman epic à 4 compteurs', () => {
    expect(PROTOCOLE_DELTA).toMatchObject({
      rarity: 'epic',
      archetype: 'pixelman',
      chargeMax: 4,
      chargeMode: 'ONE_SHOT',
      setOf: 'Noyau Alpha',
    });
  });

  it('l’instantané de test reflète le patch', () => {
    expect(realCard('Noyau Delta')).toMatchObject({ atk: 1800, hp: 2500 });
    expect(realCard('Protocole Delta .core').chargeMax).toBe(4);
  });
});
