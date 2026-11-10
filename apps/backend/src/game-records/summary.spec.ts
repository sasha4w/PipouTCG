import {
  Archetype,
  DrakonStage,
  type GameAction,
  type Seat,
} from '@pipou/shared';
import { createEngine } from '../fights/testing/engine';
import { monsterCard } from '../fights/testing/cards';
import { monsterNamed, scenario } from '../fights/testing/scenario';
import type { GameState } from '../fights/interfaces/game-state.interface';
import {
  actingCardId,
  applyMove,
  cardIndex,
  deckOf,
  dominantArchetype,
  emptySummary,
} from './summary';

const engine = createEngine();
const seats = {
  p1: { kind: 'human' as const, archetype: null, deck: [] },
  p2: { kind: 'human' as const, archetype: null, deck: [] },
};

/** Joue un coup comme FightsService : index et carte qui agit lus avant. */
function play(game: GameState, seat: Seat, action: GameAction) {
  const summary = emptySummary('pvp', seats);
  const before = cardIndex(game);
  const actorCardId = actingCardId(game, seat, action, before);
  const { error } = engine.dispatch(game, seat, action);
  expect(error).toBeUndefined();
  applyMove(summary, game, { seat, action, actorCardId, before });
  return summary;
}

describe('résumé de partie', () => {
  it("attaque mortelle : kill pour l'attaquant, destruction pour la cible", () => {
    const lame = monsterCard('Lame', { atk: 1000, hp: 1000 });
    const moucheron = monsterCard('Moucheron', { atk: 0, hp: 100 });
    const game = scenario({
      turn: 'p1',
      phase: 'battle',
      p1: { monsters: [lame] },
      p2: { monsters: [moucheron] },
    });

    const summary = play(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Lame').instanceId,
      targetInstanceId: monsterNamed(game, 'p2', 'Moucheron').instanceId,
    });

    expect(summary.cards.p1[lame.id]).toEqual({ kills: 1 });
    expect(summary.cards.p2[moucheron.id]).toEqual({ destroyed: 1 });
  });

  it('invocation comptée depuis son événement', () => {
    const recrue = monsterCard('Recrue', { cost: 0 });
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { hand: [recrue] },
    });

    const summary = play(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });

    expect(summary.cards.p1[recrue.id]).toEqual({ summoned: 1 });
  });

  it('recyclage compté sur la carte recyclée', () => {
    const recrue = monsterCard('Recrue');
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { hand: [recrue] },
    });

    const summary = play(game, 'p1', { type: 'recycle', handIndex: 0 });

    expect(summary.cards.p1[recrue.id]).toEqual({ recycled: 1 });
  });
  it('évolution : comptée évoluée, pas invoquée', () => {
    const bebe = monsterCard('Bébé', { stage: DrakonStage.BABY, lineage: 'A' });
    const jeune = monsterCard('Jeune', {
      stage: DrakonStage.YOUNG,
      lineage: 'A',
      cost: 0,
    });
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { hand: [jeune], monsters: [bebe] },
    });

    const summary = play(game, 'p1', {
      type: 'evolve',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Bébé').instanceId,
      paymentHandIndices: [],
    });

    expect(summary.cards.p1[jeune.id]).toEqual({ evolved: 1 });
  });

  it('deck : toutes les cartes du joueur, regroupées par carte', () => {
    const a = monsterCard('A');
    const game = scenario({ p1: { hand: [a, a], deck: [a], primes: 0 } });

    expect(deckOf(game.player1)).toEqual([{ cardId: a.id, count: 3 }]);
  });

  it('archétype dominant, null sans archétype', () => {
    const game = scenario({
      p1: {
        hand: [
          monsterCard('D1', { archetype: Archetype.DRAGON }),
          monsterCard('D2', { archetype: Archetype.DRAGON }),
          monsterCard('P', { archetype: Archetype.PIPOU }),
        ],
      },
    });

    expect(dominantArchetype(game.player1)).toBe(Archetype.DRAGON);
    expect(dominantArchetype(game.player2)).toBeNull();
  });
});
