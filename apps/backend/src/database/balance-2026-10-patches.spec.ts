import {
  BALANCE_NEW_CARDS,
  BALANCE_PATCHES,
  planBalancePatch,
} from './balance-2026-10-patches';
import { canonicalEffects } from './card-effect-patches';
import { allRealCardsBeforeBalance } from '../fights/testing/real-cards';

describe('balance-2026-10-patches', () => {
  it('chaque « before » correspond aux cartes avant rééquilibrage (base locale)', () => {
    const cards = allRealCardsBeforeBalance();
    for (const p of BALANCE_PATCHES) {
      const card = cards.find((c) => c.name === p.before.name);
      expect({
        name: p.before.name,
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

  it.each(BALANCE_PATCHES.map((p) => [p.before.name, p] as const))(
    '%s : up puis down',
    (_n, p) => {
      expect(planBalancePatch(p.before, p, 'up')).toBe('apply');
      expect(planBalancePatch(p.after, p, 'up')).toBe('already-done');
      expect(planBalancePatch(p.after, p, 'down')).toBe('apply');
      expect(planBalancePatch(p.before, p, 'down')).toBe('already-done');
      expect(
        planBalancePatch({ ...p.before, description: 'modifiée' }, p, 'up'),
      ).toBe('skip-diverged');
      expect(planBalancePatch(undefined, p, 'up')).toBe('skip-diverged');
    },
  );

  it('chaque patch change bien quelque chose', () => {
    for (const p of BALANCE_PATCHES) expect(p.after).not.toEqual(p.before);
  });

  it('descriptions : 255 caractères maximum (colonne varchar)', () => {
    for (const p of BALANCE_PATCHES)
      expect(p.after.description?.length ?? 0).toBeLessThanOrEqual(255);
    for (const c of BALANCE_NEW_CARDS)
      expect(c.description.length).toBeLessThanOrEqual(255);
  });

  it('les 5 nouvelles cartes', () => {
    expect(BALANCE_NEW_CARDS.map((c) => c.name)).toEqual([
      'Mont Drakon',
      'Appel des ancêtres',
      'Restauration .bak',
      'DuplicateX',
      'Mise à jour .patch',
    ]);
  });
});
