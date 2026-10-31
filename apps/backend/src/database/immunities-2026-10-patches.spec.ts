import { ActionType } from '@pipou/shared';
import type { CardEffect } from '@pipou/shared';
import { planPatch } from './card-effect-patches';
import { IMMUNITY_PATCHES } from './immunities-2026-10-patches';

const types = (effects: CardEffect[]) =>
  effects.flatMap((e) => e.actions.map((a) => a.type));

describe("patchs d'immunités", () => {
  it('couvre les cinq cartes', () => {
    expect(IMMUNITY_PATCHES.map((p) => p.cardId)).toEqual([
      10, 105, 116, 141, 145,
    ]);
  });

  it.each(IMMUNITY_PATCHES)(
    '$cardName : plus d’immunité globale, patch applicable et réversible',
    (p) => {
      expect(types(p.before)).toContain(ActionType.SET_DEBUFF_IMMUNITY);
      expect(types(p.after)).not.toContain(ActionType.SET_DEBUFF_IMMUNITY);
      expect(planPatch(p.before, p.before, p.after)).toBe('apply');
      expect(planPatch(p.after, p.before, p.after)).toBe('already-done');
      expect(p.descriptionAfter).not.toBe(p.descriptionBefore);
    },
  );

  it('Maître Magouille reste destructible en combat', () => {
    const t = types(IMMUNITY_PATCHES[0].after);
    expect(t).toContain(ActionType.SET_MONSTER_STATUS_IMMUNITY);
    expect(t).not.toContain(ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY);
    expect(t).not.toContain(ActionType.SET_COMBAT_IMMUNITY);
  });

  it('Ancestral Teros encaisse aussi la destruction par Support', () => {
    expect(types(IMMUNITY_PATCHES[3].after)).toContain(
      ActionType.SET_SUPPORT_DESTROY_IMMUNITY,
    );
    expect(types(IMMUNITY_PATCHES[1].after)).not.toContain(
      ActionType.SET_SUPPORT_DESTROY_IMMUNITY,
    );
  });
});
