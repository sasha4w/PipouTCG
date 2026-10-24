import { listCandidates } from '../ai/candidate-actions';
import { evaluate } from '../ai/evaluate';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import type { MonsterSpec } from '../testing/scenario';
import {
  graveyardNames,
  monsterNamed,
  scenario,
  seatState,
} from '../testing/scenario';

const engine = createEngine();

const adulte = () =>
  monsterCard('Adulte Feros', {
    stage: 'adult',
    lineage: 'feros',
    cost: 3,
    atk: 800,
    hp: 1600,
  });
const ancestral = () =>
  monsterCard('Ancestral Feros', {
    stage: 'ancestral',
    lineage: 'feros',
    cost: 4,
    atk: 1000,
    hp: 2000,
  });

function withAdult(spec: Partial<MonsterSpec> = {}) {
  return scenario({
    turn: 'p1',
    phase: 'main',
    p1: {
      hand: [ancestral()],
      recycleEnergy: 1,
      monsters: [{ card: adulte(), ...spec }],
    },
  });
}

const evolve = (game: ReturnType<typeof withAdult>) =>
  engine.dispatch(game, 'p1', {
    type: 'evolve',
    handIndex: 0,
    targetInstanceId: monsterNamed(game, 'p1', 'Adulte Feros').instanceId,
    paymentHandIndices: [],
  });

describe('Drakon Ancestral', () => {
  it("évolue sur l'Adulte de sa lignée", () => {
    const game = withAdult();
    expect(evolve(game).error).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Ancestral Feros')).toBeDefined();
    expect(graveyardNames(game, 'p1')).toContain('Adulte Feros');
  });

  it('pas sur un Adulte posé ce tour', () => {
    expect(evolve(withAdult({ summonedThisTurn: true })).error).toBeDefined();
  });

  it('Transformer un Ancestral coincé en main récupère le Bébé', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        hand: [ancestral()],
        graveyard: [
          monsterCard('Bébé Feros', { stage: 'baby', lineage: 'feros' }),
        ],
      },
    });
    expect(
      engine.dispatch(game, 'p1', { type: 'transform', handIndex: 0 }).error,
    ).toBeUndefined();
    expect(game.pendingChoices[0]?.candidates[0]?.baseCard.name).toBe(
      'Bébé Feros',
    );
  });

  it("IA : propose l'évolution en Ancestral, acceptée par le moteur", () => {
    const game = withAdult();
    const candidate = listCandidates(game, 'p1').find(
      (a) => a.type === 'evolve',
    );
    expect(candidate).toBeDefined();
    expect(engine.dispatch(game, 'p1', candidate!).error).toBeUndefined();
  });

  it('evaluate : un Ancestral vaut un stade de plus qu’un Adulte', () => {
    const same = { atk: 800, hp: 1600, cost: 3 };
    const ad = scenario({ p1: { monsters: [adulte()] } });
    const an = scenario({
      p1: {
        monsters: [
          monsterCard('Ancestral Feros', {
            stage: 'ancestral',
            lineage: 'feros',
            ...same,
          }),
        ],
      },
    });
    expect(evaluate(an, 'p1', 'dragon') - evaluate(ad, 'p1', 'dragon')).toBe(
      300,
    );
    expect(seatState(an, 'p1').monsterZones[0]).not.toBeNull();
  });
});
