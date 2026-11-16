import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();

const pipouHigh = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    monsterCard(`Pipou haut ${i}`, {
      archetype: 'pipou',
      rarity: i % 2 ? 'legendary' : 'epic',
    }),
  );

function setupWithHand(name: string, graveyard = pipouHigh(0)) {
  return scenario({
    turn: 'p1',
    phase: 'main',
    p1: { hand: [realCard(name)], recycleEnergy: 10, graveyard },
  });
}

const summonFromHand = (game: ReturnType<typeof setupWithHand>) =>
  engine.dispatch(game, 'p1', {
    type: 'summon',
    handIndex: 0,
    zoneIndex: 0,
    paymentHandIndices: [],
  });

describe('invocation des secrètes', () => {
  it('Magouille refusé avec 3 Pipou épiques/légendaires au cimetière', () => {
    const game = setupWithHand('Maître Magouille', pipouHigh(3));
    expect(summonFromHand(game).error).toBe(
      'Il faut 4 monstres Pipou Épiques ou Légendaires au cimetière',
    );
  });
  it('Magouille accepté avec 4', () => {
    const game = setupWithHand('Maître Magouille', pipouHigh(4));
    expect(summonFromHand(game).error).toBeUndefined();
  });
  it('Delta toujours refusé depuis la main', () => {
    const game = setupWithHand('Noyau Delta');
    expect(summonFromHand(game).error).toBe(
      'Noyau Delta ne peut arriver en jeu que par un effet',
    );
  });
});
