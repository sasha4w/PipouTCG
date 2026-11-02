import { EquipmentSlot } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import {
  equipmentCard,
  monsterCard,
  persistentCard,
  terrainCard,
} from '../testing/cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();
const play = (
  game: ReturnType<typeof scenario>,
  zoneIndex: number | undefined,
  replaceInstanceId?: string,
) =>
  engine.dispatch(game, 'p1', {
    type: 'play_support',
    handIndex: 0,
    zoneIndex,
    ...(replaceInstanceId && { replaceInstanceId }),
  });

describe('pose en zone de support : erreurs', () => {
  it('refuse une zone occupée', () => {
    const game = scenario({
      p1: {
        hand: [persistentCard('B', [])],
        supports: [persistentCard('A', [])],
      },
    });
    expect(play(game, 0).error).toBe('Zone de support occupée');
    expect(game.player1.hand).toHaveLength(1);
  });

  it.each([-1, 3, undefined])('refuse la zone %s', (zone) => {
    const game = scenario({ p1: { hand: [persistentCard('A', [])] } });
    expect(play(game, zone).error).toBe('Zone invalide (0-2)');
    expect(game.player1.hand).toHaveLength(1);
  });

  it('Terrain : mauvais replaceInstanceId refusé', () => {
    const game = scenario({
      p1: {
        hand: [terrainCard('Tactique', [])],
        supports: [terrainCard('Mont', [])],
      },
    });
    expect(play(game, 1, 'inconnu').error).toBe(
      'Confirme le remplacement de ton Terrain',
    );
    expect(game.player1.supportZones[0]?.baseCard.name).toBe('Mont');
    expect(game.player1.hand).toHaveLength(1);
  });

  it('Terrain : remplacement quand les 3 zones sont pleines', () => {
    const game = scenario({
      p1: {
        hand: [terrainCard('Tactique', [])],
        supports: [
          persistentCard('A', []),
          terrainCard('Mont', []),
          persistentCard('C', []),
        ],
      },
    });
    const old = game.player1.supportZones[1]!;
    expect(play(game, undefined, old.instanceId).error).toBeUndefined();
    expect(game.player1.supportZones[1]?.baseCard.name).toBe('Tactique');
  });

  it('Persistant ordinaire : zones pleines avec un Terrain, refusé', () => {
    const game = scenario({
      p1: {
        hand: [persistentCard('D', [])],
        supports: [
          persistentCard('A', []),
          terrainCard('Mont', []),
          persistentCard('C', []),
        ],
      },
    });
    expect(play(game, 0).error).toBe('Zones support pleines');
  });

  it('Équipement : mauvais replaceInstanceId refusé', () => {
    const off = (n: string) =>
      equipmentCard(n, [], { equipmentSlot: EquipmentSlot.OFFENSIVE });
    const game = scenario({
      p1: {
        hand: [off('Canon')],
        monsters: [
          {
            card: monsterCard('Alpha', { hp: 1000 }),
            equipments: [off('Proc')],
          },
        ],
      },
    });
    const host = game.player1.monsterZones[0]!;
    const res = engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: host.instanceId,
      replaceInstanceId: 'inconnu',
    });
    expect(res.error).toBe('Équipement à remplacer introuvable');
    expect(host.equipments).toHaveLength(1);
    expect(game.player1.hand).toHaveLength(1);
  });
});
