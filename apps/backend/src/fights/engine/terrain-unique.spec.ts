import { createEngine } from '../testing/engine';
import { terrainCard } from '../testing/cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();
const play = (
  game: ReturnType<typeof scenario>,
  handIndex: number,
  zoneIndex: number,
) =>
  engine.dispatch(game, 'p1', { type: 'play_support', handIndex, zoneIndex });

describe('un seul exemplaire d’un même terrain', () => {
  it('refuse un second exemplaire du même terrain', () => {
    const tactique = terrainCard('Tactique', []);
    const game = scenario({ p1: { hand: [tactique, tactique] } });
    expect(play(game, 0, 0).error).toBeUndefined();
    expect(play(game, 0, 1).error).toBe('Ce terrain est déjà en jeu');
    expect(game.player1.hand).toHaveLength(1);
  });

  it('accepte deux terrains différents', () => {
    const game = scenario({
      p1: { hand: [terrainCard('Tactique', []), terrainCard('Mont', [])] },
    });
    expect(play(game, 0, 0).error).toBeUndefined();
    expect(play(game, 0, 1).error).toBeUndefined();
  });

  it('accepte le même terrain que l’adversaire', () => {
    const tactique = terrainCard('Tactique', []);
    const game = scenario({
      p1: { hand: [tactique] },
      p2: { supports: [tactique] },
    });
    expect(play(game, 0, 0).error).toBeUndefined();
  });
});
