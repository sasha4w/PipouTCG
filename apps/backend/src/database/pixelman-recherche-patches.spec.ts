import { validateEffects } from '@pipou/shared';
import {
  allRealCardsBeforeGarde,
  realCard,
} from '../fights/testing/real-cards';
import { PIXELMAN_RECHERCHE_PATCHES } from './pixelman-recherche-patches';

describe('patch Pixelman : recherche à la destruction', () => {
  it('chaque `before` décrit la carte avant le patch', () => {
    const before = allRealCardsBeforeGarde();
    for (const p of PIXELMAN_RECHERCHE_PATCHES) {
      const c = before.find((x) => x.name === p.before.name);
      expect(c?.effects).toEqual(p.before.effects);
      expect(c?.description).toBe(p.before.description);
    }
  });

  it('chaque `after` est appliqué et valide', () => {
    for (const p of PIXELMAN_RECHERCHE_PATCHES) {
      const c = realCard(p.after.name);
      expect(c.effects).toEqual(p.after.effects);
      expect(validateEffects('monster', c.effects ?? [])).toEqual([]);
    }
  });
});
