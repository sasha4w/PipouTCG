import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  attackWith,
  monsterNamed,
  scenario,
  seatState,
} from '../testing/scenario';

const engine = createEngine();

describe('Champion Ouille-Ouille : perte du bonus d’adjacence', () => {
  const duel = () => {
    const champion = realCard('Champion Ouille-Ouille');
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Brute', { atk: 5000, hp: 9000 })] },
      p2: { monsters: [champion, champion] },
    });
    // Recalcul des bonus : chaque Champion gagne +300 PV max grâce à l'autre
    engine.settle(game);
    return game;
  };

  it('le voisin survit avec ses PV courants quand le bonus disparaît', () => {
    const game = duel();
    const [first, second] = seatState(game, 'p2').monsterZones;
    expect(first!.currentHp).toBe(2100);
    second!.currentHp = 300;

    attackWith(engine, game, 'p1', 'Brute', 'Champion Ouille-Ouille');

    expect(seatState(game, 'p2').monsterZones.filter(Boolean)).toHaveLength(1);
    expect(monsterNamed(game, 'p2', 'Champion Ouille-Ouille').currentHp).toBe(
      300,
    );
  });

  it('les PV courants sont plafonnés au nouveau PV max', () => {
    const game = duel();
    const [first, second] = seatState(game, 'p2').monsterZones;
    first!.currentHp = 1;
    expect(second!.currentHp).toBe(2100);

    attackWith(engine, game, 'p1', 'Brute', 'Champion Ouille-Ouille');

    expect(monsterNamed(game, 'p2', 'Champion Ouille-Ouille').currentHp).toBe(
      1800,
    );
  });
});
