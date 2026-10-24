import { AchievementFamily } from '@pipou/shared';
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
    const inst = instanceOf(card, P1_ID);
    game.player1.graveyard.push(inst);
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...inst, source: 'graveyard' }],
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
      element: null,
      stage: null,
    });
  });

  it('transmet la clé de consigne et ses paramètres, pour la traduction', () => {
    const inst = instanceOf(monsterCard('Gobelin'), P1_ID);
    const game = scenario();
    game.player1.hand.push(inst);
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...inst, source: 'hand' }],
      count: 2,
      prompt: 'Choisissez 2 carte(s) à défausser',
      promptKey: 'discard',
      promptParams: { count: 2 },
      resolution: 'discard',
    });

    expect(buildClientState(game, P1_ID).pendingChoice).toMatchObject({
      prompt: 'Choisissez 2 carte(s) à défausser',
      promptKey: 'discard',
      promptParams: { count: 2 },
    });
  });

  it('transmet l’élément et le stade d’un Drakon', () => {
    const card = monsterCard('Bébé Feros', { element: 'fire', stage: 'baby' });
    const game = scenario();
    const inst = instanceOf(card, P1_ID);
    game.player1.deck.push(inst);
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...inst, source: 'deck' }],
      count: 1,
      prompt: 'Choisir',
    });

    const { baseCard } = buildClientState(game, P1_ID).pendingChoice!
      .candidates[0];

    expect(baseCard).toMatchObject({ element: 'fire', stage: 'baby' });
  });

  it('n’envoie que les candidats encore dans leur pile', () => {
    const game = scenario();
    const kept = instanceOf(monsterCard('Gardé'), P1_ID);
    const gone = instanceOf(monsterCard('Parti'), P1_ID);
    game.player1.deck.push(kept);
    game.player1.hand.push(gone);
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [
        { ...gone, source: 'deck' },
        { ...kept, source: 'deck' },
      ],
      count: 1,
      prompt: 'Choisir',
    });

    expect(
      buildClientState(game, P1_ID).pendingChoice?.candidates.map(
        (c) => c.baseCard.name,
      ),
    ).toEqual(['Gardé']);
  });

  it('envoie image null quand la carte n’a pas d’illustration', () => {
    const card = monsterCard('Ogre');
    const game = scenario();
    const inst = instanceOf(card, P1_ID);
    game.player1.deck.push(inst);
    game.pendingChoices.push({
      forUserId: P1_ID,
      candidates: [{ ...inst, source: 'deck' }],
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

describe('buildClientState — titres', () => {
  it('expose le titre équipé des deux joueurs', () => {
    const game = scenario();
    game.player2.title = AchievementFamily.LEVEL;
    const view = buildClientState(game, game.player1.userId);
    expect(view.opponent.title).toBe(AchievementFamily.LEVEL);
    expect(view.me.title).toBeNull();
  });
});

describe('buildClientState — Zeta implanté', () => {
  it('transmet le poseur et la protection de désinfection aux deux joueurs', () => {
    const game = scenario({
      p2: {
        monsters: [
          {
            card: monsterCard('Zeta'),
            patch: { ownerUserId: P1_ID, disinfectImmune: true },
          },
        ],
      },
    });

    for (const viewer of [game.player1.userId, game.player2.userId]) {
      const view = buildClientState(game, viewer);
      const zones = viewer === P1_ID ? view.opponent : view.me;
      expect(zones.monsterZones[0]).toMatchObject({
        ownerUserId: P1_ID,
        disinfectImmune: true,
      });
    }
  });
});
