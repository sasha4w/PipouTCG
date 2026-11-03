import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { effectiveAtk } from '../helpers/game-state.helper';
import { listCandidates } from '../ai/candidate-actions';
import { monsterNamed, passTurn, scenario } from '../testing/scenario';

const engine = createEngine();
const passTurns = (game: ReturnType<typeof scenario>, n: number) => {
  for (let i = 0; i < n; i++) {
    passTurn(engine, game);
    passTurn(engine, game);
  }
};
const pick = (game: ReturnType<typeof scenario>, name: string) => {
  const c = game.pendingChoices[0].candidates.find(
    (x) => x.baseCard.name === name,
  )!;
  return engine.dispatch(game, 'p1', {
    type: 'pick_cards',
    instanceIds: [c.instanceId],
  });
};

describe('cartes Charge de novembre', () => {
  it('Alerte générale : après 3 tours, chaque allié attaque une fois de plus, puis cimetière', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Alerte générale')],
        monsters: [realCard('Général Chatouille')],
      },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        zoneIndex: 0,
      }).error,
    ).toBeUndefined();
    passTurns(game, 2);
    expect(game.player1.supportZones[0]).not.toBeNull();
    passTurns(game, 1);
    expect(
      monsterNamed(game, 'p1', 'Général Chatouille').extraAttacksThisTurn,
    ).toBe(1);
    expect(game.player1.supportZones[0]).toBeNull();
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain(
      'Alerte générale',
    );
  });

  it('Alerte générale : se dissipe quand le Général quitte le terrain', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Alerte générale')],
        monsters: [realCard('Général Chatouille')],
      },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      zoneIndex: 0,
    });
    game.player1.monsterZones[0] = null;
    engine.settle(game);
    expect(game.player1.supportZones[0]).toBeNull();
  });

  it('Extraction de données : cyclique, toutes les 2 charges', () => {
    const game = scenario({
      p1: {
        supports: [realCard('Extraction de données')],
        monsters: [realCard('Noyau Alpha')],
      },
      p2: { monsters: [monsterCard('Colosse', { atk: 1000 })] },
    });
    game.player1.supportZones[0]!.chargeCounters = 1;
    passTurns(game, 1);
    expect(pick(game, 'Colosse').error).toBeUndefined();
    expect(pick(game, 'Noyau Alpha').error).toBeUndefined();
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Colosse'))).toBe(500);
    expect(game.player1.supportZones[0]?.chargeCounters).toBe(0);
  });

  it('IA : propose des coups valides pour les choix d’Extraction et de Méditation', () => {
    const extraction = scenario({
      p1: {
        supports: [realCard('Extraction de données')],
        monsters: [realCard('Noyau Alpha')],
      },
      p2: { monsters: [monsterCard('Colosse', { atk: 1000 })] },
    });
    extraction.player1.supportZones[0]!.chargeCounters = 1;
    passTurns(extraction, 1);
    const first = listCandidates(extraction, 'p1');
    expect(first).toHaveLength(2);
    expect(engine.dispatch(extraction, 'p1', first[0]).error).toBeUndefined();
    expect(listCandidates(extraction, 'p1').length).toBeGreaterThan(0);

    const meditation = scenario({
      p1: {
        supports: [realCard('Méditation céleste')],
        monsters: [realCard('Adulte Feros')],
      },
    });
    meditation.player1.supportZones[0]!.chargeCounters = 2;
    passTurns(meditation, 1);
    const [action] = listCandidates(meditation, 'p1');
    expect(engine.dispatch(meditation, 'p1', action).error).toBeUndefined();
    expect(monsterNamed(meditation, 'p1', 'Ancestral Feros')).toBeDefined();
  });

  it('Méditation céleste : un Adulte devient Ancestral', () => {
    const game = scenario({
      p1: {
        supports: [realCard('Méditation céleste')],
        monsters: [realCard('Adulte Feros')],
      },
    });
    game.player1.supportZones[0]!.chargeCounters = 2;
    passTurns(game, 1);
    expect(pick(game, 'Adulte Feros').error).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Ancestral Feros')).toBeDefined();
    expect(game.player1.supportZones[0]).toBeNull();
  });
});
