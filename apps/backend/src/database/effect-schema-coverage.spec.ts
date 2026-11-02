import { cardKindOf, validateEffects } from '@pipou/shared';
import { allRealCards } from '../fights/testing/real-cards';
import { DRAKON_ORIGINES_CARDS } from './drakon-origines-cards';

describe('effect-schema vs cartes réelles', () => {
  it.each(allRealCards().map((c) => [c.name, c] as const))(
    '%s respecte le schéma',
    (_name, card) => {
      expect(
        validateEffects(cardKindOf(card), card.effects ?? []),
      ).toEqual([]);
    },
  );

  it.each(DRAKON_ORIGINES_CARDS.map((c) => [c.name, c] as const))(
    'Origines %s respecte le schéma',
    (_name, card) => {
      expect(validateEffects('monster', card.effects)).toEqual([]);
    },
  );
});
