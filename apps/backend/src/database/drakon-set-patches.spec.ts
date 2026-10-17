import {
  DRAKON_PATCHES,
  DRAKON_NEW_CARDS,
  planDrakonPatch,
} from './drakon-set-patches';
import { canonicalEffects } from './card-effect-patches';
import { allRealCardsBeforeRework } from '../fights/testing/real-cards';

describe('drakon-set-patches', () => {
  it('chaque « before » correspond à l’instantané (export de prod)', () => {
    const cards = allRealCardsBeforeRework();
    for (const p of DRAKON_PATCHES) {
      const card = cards.find((c) => c.name === p.before.name);
      expect({
        name: p.before.name,
        description: card?.description ?? null,
        hp: card?.hp,
        effects: canonicalEffects(card?.effects ?? null),
      }).toEqual({
        name: p.before.name,
        description: p.before.description,
        hp: p.before.hp,
        effects: canonicalEffects(p.before.effects),
      });
    }
  });

  it.each(DRAKON_PATCHES.map((p) => [p.before.name, p] as const))(
    '%s : up puis down',
    (_n, p) => {
      expect(planDrakonPatch(p.before, p, 'up')).toBe('apply');
      expect(planDrakonPatch(p.after, p, 'up')).toBe('already-done');
      expect(planDrakonPatch(p.after, p, 'down')).toBe('apply');
      expect(
        planDrakonPatch({ ...p.before, description: 'modifiée' }, p, 'up'),
      ).toBe('skip-diverged');
    },
  );

  it('les 2 œufs créés sont des œufs Drakon', () => {
    expect(DRAKON_NEW_CARDS.map((c) => c.name)).toEqual([
      'Œuf de la Dualité',
      'Œuf Céleste',
    ]);
  });
});
