import type { ClientGameState, FightEvent } from '@pipou/shared';
import { buildClientState, emitGameState } from './client-state.builder';
import { fakeServer } from '../testing/fake-server';
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

describe('buildClientState / emitGameState — événements', () => {
  const ev: FightEvent = {
    kind: 'terrain_played',
    ownerId: P1_ID,
    zoneIndex: 0,
    instanceId: 't1',
  };

  it('recopie les événements en attente', () => {
    const game = scenario();
    game.pendingEvents.push(ev);

    expect(buildClientState(game, P1_ID).events).toEqual([ev]);
  });

  it('envoie les mêmes événements aux deux joueurs puis vide le tampon', () => {
    const game = scenario();
    game.pendingEvents.push(ev);
    const { server, emitted } = fakeServer();

    emitGameState(game, server);
    emitGameState(game, server);

    const events = emitted.map((e) => (e.payload as ClientGameState).events);
    expect(events).toEqual([[ev], [ev], [], []]);
    expect(game.pendingEvents).toEqual([]);
  });
});
