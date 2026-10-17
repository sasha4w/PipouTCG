import { CARD_REWORK_PATCHES, planCardRework } from './card-rework-patches';
import { canonicalEffects } from './card-effect-patches';
import { allRealCardsBeforeRework } from '../fights/testing/real-cards';

describe('card-rework-patches', () => {
  it('chaque « before » correspond à la carte de l’instantané (après GenericCardEffects)', () => {
    const cards = allRealCardsBeforeRework();
    for (const patch of CARD_REWORK_PATCHES) {
      const card = cards.find((c) => c.name === patch.before.name);
      expect({
        name: patch.before.name,
        description: card?.description ?? null,
        effects: canonicalEffects(card?.effects ?? null),
      }).toEqual({
        name: patch.before.name,
        description: patch.before.description,
        effects: canonicalEffects(patch.before.effects),
      });
    }
  });

  const ouille = CARD_REWORK_PATCHES.find(
    (p) => p.before.name === 'Ouille au rapport',
  )!;

  it('applique quand la carte vaut « before »', () => {
    expect(planCardRework(ouille.before, ouille, 'up')).toBe('apply');
  });

  it('ne refait rien si déjà appliqué', () => {
    expect(planCardRework(ouille.after, ouille, 'up')).toBe('already-done');
  });

  it("ignore une carte modifiée depuis l'export", () => {
    expect(
      planCardRework(
        { ...ouille.before, description: 'Modifiée dans l’admin' },
        ouille,
        'up',
      ),
    ).toBe('skip-diverged');
  });

  it('down restaure « before »', () => {
    expect(planCardRework(ouille.after, ouille, 'down')).toBe('apply');
  });

  it('accepte des effets JSON bruts (colonne MySQL)', () => {
    expect(
      planCardRework(
        { ...ouille.before, effects: JSON.stringify(ouille.before.effects) },
        ouille,
        'up',
      ),
    ).toBe('apply');
  });
});
