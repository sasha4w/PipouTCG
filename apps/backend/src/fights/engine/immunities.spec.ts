import {
  ActionType,
  EFFECT_IMMUNITIES,
  EffectTarget,
  EffectTrigger,
  Immunity,
  hasImmunity,
} from '@pipou/shared';
import type { CardEffect } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import {
  attackWith,
  graveyardNames,
  monsterNamed,
  scenario,
} from '../testing/scenario';
import type { MonsterSpec } from '../testing/scenario';

const engine = createEngine();

const passive = (type: ActionType, value?: number): CardEffect =>
  effect(EffectTrigger.PASSIVE, [act(type, EffectTarget.SELF, { value })]);

const gel = () =>
  ephemeralCard('Gel', [
    effect(EffectTrigger.ON_PLAY, [
      act(ActionType.BLOCK_ATTACK, EffectTarget.ENEMY_MONSTER, { value: 1 }),
    ]),
  ]);
const formatage = () =>
  ephemeralCard('Formatage', [
    effect(EffectTrigger.ON_PLAY, [
      act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER),
    ]),
  ]);

const withEffect = (name: string, type: ActionType) => ({
  card: monsterCard(name, { effects: [passive(type)] }),
});

function playOn(game: ReturnType<typeof scenario>, target: string) {
  return engine.dispatch(game, 'p1', {
    type: 'play_support',
    handIndex: 0,
    targetInstanceId: monsterNamed(game, 'p2', target).instanceId,
  });
}

function duel(
  attacker: MonsterSpec,
  defender: MonsterSpec,
  extra?: MonsterSpec,
) {
  const game = scenario({
    turn: 'p1',
    phase: 'battle',
    p1: { monsters: [attacker] },
    p2: { monsters: extra ? [extra, defender] : [defender] },
  });
  engine.dispatch(game, 'p1', { type: 'end_phase' });
  game.phase = 'battle';
  return {
    game,
    result: attackWith(
      engine,
      game,
      'p1',
      attacker.card.name,
      defender.card.name,
    ),
  };
}

describe('immunités', () => {
  it('SET_DEBUFF_IMMUNITY donne les quatre immunités d’effets', () => {
    const game = scenario({
      p2: { monsters: [withEffect('Mag', ActionType.SET_DEBUFF_IMMUNITY)] },
    });
    engine.settle(game);
    const mag = monsterNamed(game, 'p2', 'Mag');
    for (const i of EFFECT_IMMUNITIES) expect(hasImmunity(mag, i)).toBe(true);
    expect(hasImmunity(mag, Immunity.COMBAT_DESTRUCTION)).toBe(false);
  });

  it('SUPPORT_DEBUFF bloque le gel mais pas la destruction par Support', () => {
    const teros = () =>
      withEffect('Teros', ActionType.SET_SUPPORT_DEBUFF_IMMUNITY);
    const g1 = scenario({ p1: { hand: [gel()] }, p2: { monsters: [teros()] } });
    engine.settle(g1);
    expect(playOn(g1, 'Teros').error).toBeDefined();

    const g2 = scenario({
      p1: { hand: [formatage()] },
      p2: { monsters: [teros()] },
    });
    engine.settle(g2);
    expect(playOn(g2, 'Teros').error).toBeUndefined();
    expect(graveyardNames(g2, 'p2')).toContain('Teros');
  });

  it('SUPPORT_DESTRUCTION bloque la destruction mais pas le gel', () => {
    const beta = () =>
      withEffect('Beta', ActionType.SET_SUPPORT_DESTROY_IMMUNITY);
    const g1 = scenario({
      p1: { hand: [formatage()] },
      p2: { monsters: [beta()] },
    });
    engine.settle(g1);
    expect(playOn(g1, 'Beta').error).toBeDefined();

    const g2 = scenario({ p1: { hand: [gel()] }, p2: { monsters: [beta()] } });
    engine.settle(g2);
    expect(playOn(g2, 'Beta').error).toBeUndefined();
  });

  it('COMBAT_DESTRUCTION : subit les dégâts mais reste à 1 PV', () => {
    const { game } = duel(
      { card: monsterCard('Lame', { atk: 2000, hp: 3000 }) },
      {
        card: monsterCard('Roc', {
          atk: 0,
          hp: 500,
          effects: [passive(ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY)],
        }),
      },
    );
    expect(monsterNamed(game, 'p2', 'Roc').currentHp).toBe(1);
    expect(graveyardNames(game, 'p2')).not.toContain('Roc');
  });

  it('MONSTER_STATUS : l’attaquant ne subit pas le renvoi de dégâts', () => {
    const { game } = duel(
      {
        card: monsterCard('Lame', {
          atk: 400,
          hp: 1000,
          effects: [passive(ActionType.SET_MONSTER_STATUS_IMMUNITY)],
        }),
      },
      {
        card: monsterCard('Roc', {
          atk: 0,
          hp: 2000,
          effects: [passive(ActionType.REFLECT_DAMAGE, 50)],
        }),
      },
    );
    expect(monsterNamed(game, 'p2', 'Roc').currentHp).toBe(1600);
    expect(monsterNamed(game, 'p1', 'Lame').currentHp).toBe(1000);
  });

  it('MONSTER_STATUS : l’attaquant ignore la Provocation', () => {
    const mur = {
      card: monsterCard('Mur', {
        atk: 0,
        hp: 2000,
        effects: [passive(ActionType.SET_TAUNT)],
      }),
    };
    const lame = (effects: CardEffect[]) => ({
      card: monsterCard('Lame', { atk: 400, hp: 1000, effects }),
    });
    const cible = { card: monsterCard('Cible', { atk: 0, hp: 2000 }) };

    const sans = duel(lame([]), cible, mur);
    expect(sans.result.error).toBeDefined();

    const avec = duel(
      lame([passive(ActionType.SET_MONSTER_STATUS_IMMUNITY)]),
      cible,
      mur,
    );
    expect(avec.result.error).toBeUndefined();
  });
});
