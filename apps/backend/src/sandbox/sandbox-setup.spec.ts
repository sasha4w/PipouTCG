import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { applySetup } from './sandbox-setup';
import { createEngine } from '../fights/testing/engine';
import {
  act,
  effect,
  equipmentCard,
  monsterCard,
  terrainCard,
} from '../fights/testing/cards';
import {
  graveyardNames,
  handNames,
  monsterNamed,
  scenario,
  P2_ID,
} from '../fights/testing/scenario';

const names = (cards: { baseCard: { name: string } }[]) =>
  cards.map((c) => c.baseCard.name);

describe('applySetup', () => {
  it('déplace une carte du deck vers la main', () => {
    const game = scenario({
      p1: { deck: [monsterCard('A'), monsterCard('B')] },
    });
    const b = game.player1.deck[1];

    expect(
      applySetup(game, {
        type: 'move_card',
        seat: 'p1',
        instanceId: b.instanceId,
        to: { zone: 'hand' },
      }),
    ).toEqual({});

    expect(handNames(game, 'p1')).toEqual(['B']);
    expect(names(game.player1.deck)).toEqual(['A']);
  });

  it('réordonne le deck : une carte remonte sur le dessus', () => {
    const game = scenario({
      p1: { deck: [monsterCard('A'), monsterCard('B'), monsterCard('C')] },
    });

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.deck[2].instanceId,
      to: { zone: 'deck', index: 0 },
    });

    expect(names(game.player1.deck)).toEqual(['C', 'A', 'B']);
  });

  it("pose un monstre sans déclencher son effet d'invocation", () => {
    const gardien = monsterCard('Gardien', {
      effects: [
        effect(EffectTrigger.ON_SUMMON, [
          act(ActionType.SET_TAUNT, EffectTarget.SELF),
        ]),
      ],
    });
    const game = scenario({ p1: { hand: [gardien] } });

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.hand[0].instanceId,
      to: { zone: 'monster', index: 1, mode: 'guard' },
    });

    const posed = monsterNamed(game, 'p1', 'Gardien');
    expect(game.player1.monsterZones[1]).toBe(posed);
    expect(posed).toMatchObject({
      mode: 'guard',
      hasTaunt: false,
      summonedThisTurn: false,
    });
  });

  it('équipe un monstre, pose un terrain et envoie au cimetière', () => {
    const game = scenario({
      p1: {
        monsters: [monsterCard('Porteur')],
        hand: [equipmentCard('Casque', []), terrainCard('Plaine', [])],
        deck: [monsterCard('Perdu')],
      },
    });
    const host = monsterNamed(game, 'p1', 'Porteur');

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.hand[0].instanceId,
      to: { zone: 'equipment', hostInstanceId: host.instanceId },
    });
    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.hand[0].instanceId,
      to: { zone: 'support', index: 2 },
    });
    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.deck[0].instanceId,
      to: { zone: 'graveyard' },
    });

    expect(names(host.equipments)).toEqual(['Casque']);
    expect(game.player1.supportZones[2]?.baseCard.name).toBe('Plaine');
    expect(graveyardNames(game, 'p1')).toEqual(['Perdu']);
  });

  it('refuse une zone occupée ou une carte du mauvais type, sans rien déplacer', () => {
    const game = scenario({
      p1: {
        monsters: [monsterCard('Occupant')],
        hand: [monsterCard('Nouveau')],
      },
    });
    const card = game.player1.hand[0];

    expect(
      applySetup(game, {
        type: 'move_card',
        seat: 'p1',
        instanceId: card.instanceId,
        to: { zone: 'monster', index: 0, mode: 'attack' },
      }).error,
    ).toBe('Zone monstre occupée');
    expect(
      applySetup(game, {
        type: 'move_card',
        seat: 'p1',
        instanceId: card.instanceId,
        to: { zone: 'support', index: 0 },
      }).error,
    ).toBe('Seul un Terrain va en zone support');
    expect(handNames(game, 'p1')).toEqual(['Nouveau']);
  });

  it('retire un monstre du terrain vers la main, ses équipements au cimetière', () => {
    const game = scenario({
      p1: {
        monsters: [
          {
            card: monsterCard('Pion'),
            equipments: [equipmentCard('Casque', [])],
          },
        ],
      },
    });

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: monsterNamed(game, 'p1', 'Pion').instanceId,
      to: { zone: 'hand' },
    });

    expect(game.player1.monsterZones[0]).toBeNull();
    expect(handNames(game, 'p1')).toEqual(['Pion']);
    expect(graveyardNames(game, 'p1')).toEqual(['Casque']);
  });

  it('édite un monstre : bonus permanents et statuts, conservés au recalcul', () => {
    const game = scenario({ p1: { monsters: [monsterCard('Cobaye')] } });
    const cobaye = monsterNamed(game, 'p1', 'Cobaye');

    applySetup(game, {
      type: 'edit_monster',
      seat: 'p1',
      instanceId: cobaye.instanceId,
      patch: { atkBonus: 300, taunt: true, blockAttackTurns: 2, currentHp: 50 },
    });
    createEngine().settle(game);

    expect(cobaye).toMatchObject({
      atkBuff: 300,
      hasTaunt: true,
      blockAttackTurns: 2,
      currentHp: 50,
    });
  });

  it('édite le joueur et la partie', () => {
    const game = scenario();

    applySetup(game, {
      type: 'edit_player',
      seat: 'p2',
      patch: { primes: 2, recycleEnergy: 3 },
    });
    applySetup(game, {
      type: 'edit_game',
      patch: { phase: 'battle', turnNumber: 7, activeSeat: 'p2' },
    });

    expect(game.player2).toMatchObject({ primes: 2, recycleEnergy: 3 });
    expect(game).toMatchObject({
      phase: 'battle',
      turnNumber: 7,
      currentTurnUserId: P2_ID,
    });
  });
});
