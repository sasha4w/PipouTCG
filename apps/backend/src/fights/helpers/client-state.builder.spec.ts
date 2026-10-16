import { buildClientState } from './client-state.builder';
import { instanceOf, P1_ID, scenario } from '../testing/scenario';
import { monsterCard } from '../testing/cards';
import type { Card } from '../../cards/card.entity';

describe('buildClientState — candidats de choix', () => {
  it('transmet le coût, l’illustration et la description', () => {
    const card = monsterCard('Gobelin', {
      cost: 3,
      description: 'Un gobelin',
      image: { id: 9, url: 'https://cdn.test/gobelin.png' } as Card['image'],
    });
    const game = scenario();
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...instanceOf(card, P1_ID), source: 'graveyard' }],
      count: 1,
      prompt: 'Choisir',
    });

    const state = buildClientState(game, P1_ID);

    expect(state.pendingChoice?.candidates[0].baseCard).toEqual({
      id: card.id,
      name: 'Gobelin',
      type: 'monster',
      atk: 100,
      hp: 500,
      rarity: 'common',
      supportType: null,
      cost: 3,
      image: { url: 'https://cdn.test/gobelin.png' },
      description: 'Un gobelin',
    });
  });

  it('envoie image null quand la carte n’a pas d’illustration', () => {
    const card = monsterCard('Ogre');
    const game = scenario();
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...instanceOf(card, P1_ID), source: 'deck' }],
      count: 1,
      prompt: 'Choisir',
    });

    const state = buildClientState(game, P1_ID);

    expect(state.pendingChoice?.candidates[0].baseCard.image).toBeNull();
  });
});
