import { monsterCard, equipmentCard } from './cards';
import {
  scenario,
  monsterNamed,
  handNames,
  P1_ID,
  P2_ID,
  seatState,
} from './scenario';

describe('scenario', () => {
  it('construit deux joueurs prêts, 3 zones de chaque type et 6 Primes', () => {
    const game = scenario();

    for (const seat of ['p1', 'p2'] as const) {
      const p = seatState(game, seat);
      expect(p.monsterZones).toHaveLength(3);
      expect(p.supportZones).toHaveLength(3);
      expect(p.primes).toBe(6);
      expect(p.primeDeck).toHaveLength(6);
      expect(p.deck).toHaveLength(10);
    }
    expect(game.player1.userId).toBe(P1_ID);
    expect(game.player2.userId).toBe(P2_ID);
    expect(game.currentTurnUserId).toBe(P1_ID);
    expect(game.phase).toBe('main');
    expect(game.turnNumber).toBe(2);
  });

  it('pose les monstres comme déjà en jeu, avec leurs équipements', () => {
    const game = scenario({
      p2: {
        monsters: [
          null,
          {
            card: monsterCard('Golem', { hp: 900 }),
            mode: 'guard',
            equipments: [equipmentCard('Casque', [])],
          },
        ],
      },
      turn: 'p2',
    });

    const golem = monsterNamed(game, 'p2', 'Golem');
    expect(game.player2.monsterZones[1]).toBe(golem);
    expect(golem.summonedThisTurn).toBe(false);
    expect(golem.currentHp).toBe(900);
    expect(golem.mode).toBe('guard');
    expect(golem.equipments.map((e) => e.baseCard.name)).toEqual(['Casque']);
    expect(game.currentTurnUserId).toBe(P2_ID);
  });

  it("respecte l'ordre de la main et du deck", () => {
    const game = scenario({
      p1: {
        hand: [monsterCard('A'), monsterCard('B')],
        deck: [monsterCard('C')],
      },
    });

    expect(handNames(game, 'p1')).toEqual(['A', 'B']);
    expect(game.player1.deck.map((c) => c.baseCard.name)).toEqual(['C']);
  });
});
