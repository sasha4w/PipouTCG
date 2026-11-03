import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  monsterNamed,
  passTurn,
  scenario,
  seatState,
} from '../testing/scenario';

const engine = createEngine();
const egg = () => ({
  card: realCard('Œuf Céleste'),
  patch: { hatchCounter: 1, hatchStage: 'adult' as const },
});
const fillers = () => Array.from({ length: 10 }, () => monsterCard('Filler'));

/** Fin du tour de p1 puis de p2 : l'œuf éclot au début du tour suivant de p1. */
function hatch(game: ReturnType<typeof scenario>) {
  passTurn(engine, game);
  passTurn(engine, game);
}

describe('Œuf Céleste : éclosion avec repli', () => {
  it('propose un Adulte du cimetière quand le deck n’en a plus', () => {
    const game = scenario({
      p1: {
        monsters: [egg()],
        deck: fillers(),
        graveyard: [realCard('Adulte Feros')],
      },
    });
    hatch(game);
    const choice = game.pendingChoices[0];
    expect(choice.candidates.map((c) => [c.baseCard.name, c.source])).toEqual([
      ['Adulte Feros', 'graveyard'],
    ]);
    expect(
      engine.dispatch(game, 'p1', {
        type: 'pick_cards',
        instanceIds: [choice.candidates[0].instanceId],
      }).error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Adulte Feros')).toBeDefined();
    expect(
      seatState(game, 'p1').graveyard.map((c) => c.baseCard.name),
    ).not.toContain('Adulte Feros');
  });

  it('prend un Jeune quand aucun Adulte n’est disponible', () => {
    const game = scenario({
      p1: { monsters: [egg()], deck: [realCard('Jeune Ackos'), ...fillers()] },
    });
    hatch(game);
    expect(
      game.pendingChoices[0].candidates.map((c) => c.baseCard.name),
    ).toEqual(['Jeune Ackos']);
  });

  it('prend un Bébé en dernier recours', () => {
    const game = scenario({
      p1: {
        monsters: [egg()],
        graveyard: [realCard('Bébé Teros')],
        deck: fillers(),
      },
    });
    hatch(game);
    expect(
      game.pendingChoices[0].candidates.map((c) => c.baseCard.name),
    ).toEqual(['Bébé Teros']);
  });
});
