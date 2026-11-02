import { createEngine } from '../testing/engine';
import { persistentCard, terrainCard } from '../testing/cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();
const play = (
  game: ReturnType<typeof scenario>,
  handIndex: number,
  zoneIndex: number,
  replaceInstanceId?: string,
) =>
  engine.dispatch(game, 'p1', {
    type: 'play_support',
    handIndex,
    zoneIndex,
    ...(replaceInstanceId && { replaceInstanceId }),
  });

describe('Persistants', () => {
  it('refuse un second exemplaire de la même carte', () => {
    const b = persistentCard('Bannière', []);
    const game = scenario({ p1: { hand: [b, b] } });
    expect(play(game, 0, 0).error).toBeUndefined();
    expect(play(game, 0, 1).error).toBe('Cette carte est déjà en jeu');
  });

  it('cumule des Persistants différents', () => {
    const game = scenario({
      p1: { hand: [persistentCard('A', []), persistentCard('B', [])] },
    });
    expect(play(game, 0, 0).error).toBeUndefined();
    expect(play(game, 0, 1).error).toBeUndefined();
  });

  it('refuse un 4e support quand les 3 cases sont pleines', () => {
    const game = scenario({
      p1: {
        hand: [persistentCard('D', [])],
        supports: [
          persistentCard('A', []),
          persistentCard('B', []),
          persistentCard('C', []),
        ],
      },
    });
    expect(play(game, 0, 0).error).toBe('Zones support pleines');
  });

  it('accepte le même Persistant que l’adversaire', () => {
    const t = terrainCard('Tactique', []);
    const game = scenario({ p1: { hand: [t] }, p2: { supports: [t] } });
    expect(play(game, 0, 0).error).toBeUndefined();
  });
});

describe('Terrains', () => {
  it('un second Terrain sans confirmation est refusé', () => {
    const game = scenario({
      p1: {
        hand: [terrainCard('Tactique', [])],
        supports: [terrainCard('Mont', [])],
      },
    });
    expect(play(game, 0, 1).error).toBe(
      'Confirme le remplacement de ton Terrain',
    );
    expect(game.player1.hand).toHaveLength(1);
  });

  it('remplace le Terrain en place, dans sa case', () => {
    const game = scenario({
      p1: {
        hand: [terrainCard('Tactique', [])],
        supports: [null, terrainCard('Mont', []), null],
      },
    });
    const old = game.player1.supportZones[1]!;
    expect(play(game, 0, 0, old.instanceId).error).toBeUndefined();
    expect(game.player1.supportZones[1]?.baseCard.name).toBe('Tactique');
    expect(game.player1.supportZones[0]).toBeNull();
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain(
      'Mont',
    );
  });

  it('un Terrain et des Persistants cohabitent', () => {
    const game = scenario({
      p1: {
        hand: [terrainCard('Tactique', [])],
        supports: [persistentCard('Bannière', [])],
      },
    });
    expect(play(game, 0, 1).error).toBeUndefined();
  });
});
