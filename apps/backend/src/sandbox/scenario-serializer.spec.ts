import type { Card } from '../cards/card.entity';
import {
  collectCardIds,
  deserializeGame,
  serializeGame,
} from './scenario-serializer';
import { equipmentCard, monsterCard } from '../fights/testing/cards';
import { monsterNamed, scenario, P2_ID } from '../fights/testing/scenario';

function savedGame() {
  const game = scenario({
    turn: 'p2',
    p1: {
      hand: [monsterCard('Main')],
      monsters: [
        {
          card: monsterCard('Posé'),
          equipments: [equipmentCard('Casque', [])],
          patch: { ownerUserId: P2_ID },
        },
      ],
    },
  });
  return game;
}

describe('scenario-serializer', () => {
  it('réduit chaque carte à son id', () => {
    const json = JSON.stringify(serializeGame(savedGame()));

    expect(json).not.toContain('"effects"');
    expect(json).toContain('"baseCard":');
  });

  it('liste les ids de cartes utilisés, sans doublon', () => {
    const game = savedGame();
    const ids = collectCardIds(serializeGame(game));

    expect(ids).toContain(game.player1.hand[0].baseCard.id);
    expect(ids).toContain(monsterNamed(game, 'p1', 'Posé').card.baseCard.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reconstruit la partie avec les cartes de la BDD et les sièges du nouvel admin', () => {
    const game = savedGame();
    const state = serializeGame(game);
    const cards = new Map<number, Card>();
    for (const p of [game.player1, game.player2])
      for (const c of [...p.hand, ...p.deck, ...p.primeDeck])
        cards.set(c.baseCard.id, c.baseCard);
    const posed = monsterNamed(game, 'p1', 'Posé');
    cards.set(posed.card.baseCard.id, posed.card.baseCard);
    cards.set(posed.equipments[0].baseCard.id, posed.equipments[0].baseCard);

    const restored = deserializeGame(state, cards, {
      matchId: -7,
      p1: { userId: 40, username: 'Admin (J1)', socketId: 's' },
      p2: { userId: -40, username: 'Admin (J2)', socketId: 's' },
    });

    expect(restored.matchId).toBe(-7);
    expect(restored.player1).toMatchObject({
      userId: 40,
      username: 'Admin (J1)',
    });
    expect(restored.player2.userId).toBe(-40);
    expect(restored.currentTurnUserId).toBe(-40);
    expect(restored.player1.hand[0].ownerId).toBe(40);
    expect(restored.player1.hand[0].baseCard).toBe(
      cards.get(game.player1.hand[0].baseCard.id),
    );
    expect(monsterNamed(restored, 'p1', 'Posé').ownerUserId).toBe(-40);
  });

  it("échoue clairement si une carte n'existe plus", () => {
    const state = serializeGame(savedGame());

    expect(() =>
      deserializeGame(state, new Map(), {
        matchId: -1,
        p1: { userId: 1, username: 'a', socketId: 's' },
        p2: { userId: -1, username: 'b', socketId: 's' },
      }),
    ).toThrow(/Carte #\d+ introuvable/);
  });
});
