import {
  CARD_EFFECT_PATCHES,
  canonicalEffects,
  planPatch,
} from './card-effect-patches';
import { rawSnapshotCards } from '../fights/testing/real-cards';

describe('card-effect-patches', () => {
  const quenouille = CARD_EFFECT_PATCHES.find((p) => p.cardId === 9)!;

  it('chaque « before » correspond exactement aux effets du dump', () => {
    const snapshot = rawSnapshotCards();
    for (const patch of CARD_EFFECT_PATCHES) {
      const card = snapshot.find((c) => c.id === patch.cardId);
      expect({
        id: patch.cardId,
        effects: canonicalEffects(card?.effects),
      }).toEqual({
        id: patch.cardId,
        effects: canonicalEffects(patch.before),
      });
    }
  });

  it("applique le patch quand les effets valent « before », quel que soit l'ordre des clés", () => {
    const reordered = JSON.stringify([
      {
        condition: null,
        trigger: 'ON_SUMMON',
        actions: [{ target: 'SELF', value: 1, type: 'SET_DELAY_DOUBLE_ATK' }],
      },
    ]);
    expect(planPatch(reordered, quenouille.before, quenouille.after)).toBe(
      'apply',
    );
  });

  it('ne refait rien si le patch est déjà appliqué', () => {
    expect(
      planPatch(quenouille.after, quenouille.before, quenouille.after),
    ).toBe('already-done');
  });

  it('ne touche pas une carte modifiée entre-temps, ni une carte sans effets', () => {
    expect(planPatch([], quenouille.before, quenouille.after)).toBe(
      'skip-diverged',
    );
    expect(planPatch(null, quenouille.before, quenouille.after)).toBe(
      'skip-diverged',
    );
  });
});
