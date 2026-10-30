import { Immunity } from '@pipou/shared';
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import type { CardEffect } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, monsterCard } from '../testing/cards';
import type { MonsterSpec } from '../testing/scenario';
import {
  attackWith,
  graveyardNames,
  monsterNamed,
  scenario,
  seatState,
} from '../testing/scenario';

const engine = createEngine();

const passive = (type: ActionType, value?: number): CardEffect =>
  effect(EffectTrigger.PASSIVE, [act(type, EffectTarget.SELF, { value })]);
const reflect50 = passive(ActionType.REFLECT_DAMAGE, 50);
const reduction2 = passive(ActionType.SET_DAMAGE_REDUCTION, 2);

function duel(attacker: MonsterSpec, defender: MonsterSpec) {
  const game = scenario({
    turn: 'p1',
    phase: 'battle',
    p1: { monsters: [attacker] },
    p2: { monsters: [defender] },
  });
  engine.dispatch(game, 'p1', { type: 'end_phase' }); // recalcul des bonus
  game.phase = 'battle';
  expect(
    attackWith(engine, game, 'p1', attacker.card.name, defender.card.name)
      .error,
  ).toBeUndefined();
  return game;
}

describe('renvoi de dégâts', () => {
  it('renvoie la moitié des dégâts subis', () => {
    const game = duel(
      { card: monsterCard('Lame', { atk: 400, hp: 1000 }) },
      { card: monsterCard('Roc', { atk: 0, hp: 2000, effects: [reflect50] }) },
    );
    expect(monsterNamed(game, 'p2', 'Roc').currentHp).toBe(1600);
    expect(monsterNamed(game, 'p1', 'Lame').currentHp).toBe(800);
  });

  it('se calcule après réduction', () => {
    const game = duel(
      { card: monsterCard('Lame', { atk: 400, hp: 1000 }) },
      {
        card: monsterCard('Roc', {
          atk: 0,
          hp: 2000,
          effects: [reflect50, reduction2],
        }),
      },
    );
    expect(monsterNamed(game, 'p2', 'Roc').currentHp).toBe(1800);
    expect(monsterNamed(game, 'p1', 'Lame').currentHp).toBe(900);
  });

  it('en Garde, un attaquant tué par le renvoi ne donne pas de Prime', () => {
    const game = duel(
      { card: monsterCard('Lame', { atk: 400, hp: 100 }) },
      {
        card: monsterCard('Roc', { atk: 0, hp: 2000, effects: [reflect50] }),
        mode: 'guard',
      },
    );
    expect(graveyardNames(game, 'p1')).toContain('Lame');
    expect(seatState(game, 'p1').primes).toBe(6);
    expect(seatState(game, 'p2').primes).toBe(6);
  });

  it('pas de renvoi sur un attaquant insensible au combat', () => {
    const game = duel(
      {
        card: monsterCard('Lame', { atk: 400, hp: 1000 }),
        patch: {
          turnImmunities: [Immunity.COMBAT_DAMAGE],
          immunities: [Immunity.COMBAT_DAMAGE],
        },
      },
      { card: monsterCard('Roc', { atk: 0, hp: 2000, effects: [reflect50] }) },
    );
    expect(monsterNamed(game, 'p1', 'Lame').currentHp).toBe(1000);
  });

  it('une attaque perçante est renvoyée', () => {
    const game = duel(
      {
        card: monsterCard('Lame', {
          atk: 400,
          hp: 1000,
          effects: [passive(ActionType.SET_PIERCING)],
        }),
      },
      {
        card: monsterCard('Roc', {
          atk: 0,
          hp: 2000,
          effects: [reflect50, reduction2],
        }),
      },
    );
    expect(monsterNamed(game, 'p2', 'Roc').currentHp).toBe(1600);
    expect(monsterNamed(game, 'p1', 'Lame').currentHp).toBe(800);
  });
});
