import { planBalancePatch } from './balance-2026-10-patches';
import { canonicalEffects } from './card-effect-patches';
import { GARDE_PATCHES } from './garde-2026-10-patches';
import { allRealCardsBeforeGarde } from '../fights/testing/real-cards';

describe('garde-2026-10-patches', () => {
  it('15 patchs, sur les cartes du design', () => {
    expect(GARDE_PATCHES.map((p) => p.before.name).sort()).toEqual(
      [
        'Adulte Teros',
        'Bébé Teros',
        'Canon à Particules .vxd',
        'Capitaine Gribouille',
        'Champion Ouille-Ouille',
        'Force Delta',
        'Général Chatouille',
        'Jeune Teros',
        'Mastodonte Grossebouille',
        'Mise à jour .patch',
        'Noyau Alpha',
        'Sentinelle Gargouille',
        'Surcharge Overclock',
        'Tactique Gang Gang',
        'Œuf Céleste',
      ].sort(),
    );
  });

  it('Force Delta devient Force Plasma', () => {
    const p = GARDE_PATCHES.find((x) => x.before.name === 'Force Delta')!;
    expect(p.after.name).toBe('Force Plasma');
  });

  it('réglage du tournoi : Force Plasma, Œuf, Bébé Teros, Sentinelle', () => {
    const after = (name: string) =>
      GARDE_PATCHES.find((x) => x.before.name === name)!.after;
    expect(after('Force Delta').effects?.[0].actions[0]).toMatchObject({
      type: 'DEAL_DAMAGE',
      value: 1500,
    });
    expect(after('Œuf Céleste').cost).toBe(1);
    expect(after('Bébé Teros').hp).toBe(1300);
    expect(after('Sentinelle Gargouille').hp).toBe(1300);
  });

  it('chaque « before » correspond aux cartes actuelles', () => {
    const cards = allRealCardsBeforeGarde();
    for (const p of GARDE_PATCHES) {
      const card = cards.find((c) => c.name === p.before.name);
      expect({
        name: card?.name,
        description: card?.description ?? null,
        atk: card?.atk,
        hp: card?.hp,
        cost: card?.cost,
        effects: canonicalEffects(card?.effects ?? null),
      }).toEqual({
        name: p.before.name,
        description: p.before.description,
        atk: p.before.atk,
        hp: p.before.hp,
        cost: p.before.cost,
        effects: canonicalEffects(p.before.effects),
      });
    }
  });

  it.each(GARDE_PATCHES.map((p) => [p.before.name, p] as const))(
    '%s : up puis down',
    (_n, p) => {
      expect(planBalancePatch(p.before, p, 'up')).toBe('apply');
      expect(planBalancePatch(p.after, p, 'up')).toBe('already-done');
      expect(planBalancePatch(p.after, p, 'down')).toBe('apply');
      expect(planBalancePatch(p.before, p, 'down')).toBe('already-done');
      expect(
        planBalancePatch({ ...p.before, description: 'modifiée' }, p, 'up'),
      ).toBe('skip-diverged');
    },
  );

  it('chaque patch change quelque chose, descriptions ≤ 255', () => {
    for (const p of GARDE_PATCHES) {
      expect(p.after).not.toEqual(p.before);
      expect(p.after.description?.length ?? 0).toBeLessThanOrEqual(255);
    }
  });
});
