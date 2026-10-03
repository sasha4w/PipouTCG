import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import {
  attackWith,
  handNames,
  monsterNamed,
  passTurn,
  scenario,
  P1_ID,
} from '../testing/scenario';

const toBattle = { type: 'end_phase' } as const;

describe('GameEngine — déroulé du tour', () => {
  const engine = createEngine();

  it('un joueur qui ne peut pas piocher en début de tour perd', () => {
    const game = scenario({ p2: { deck: [] } });

    passTurn(engine, game);

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P1_ID);
    expect(game.endReason).toBe('deck_empty');
  });

  it('ON_TURN_END se déclenche à la fin du tour de son propriétaire', () => {
    const horloger = monsterCard('Horloger', {
      effects: [
        effect(EffectTrigger.ON_TURN_END, [
          act(ActionType.DRAW, EffectTarget.PLAYER),
        ]),
      ],
    });
    const game = scenario({
      p1: { monsters: [horloger], deck: [monsterCard('Pioche de fin')] },
    });

    passTurn(engine, game);

    expect(handNames(game, 'p1')).toEqual(['Pioche de fin']);
  });

  it("les bonus d'ATK temporaires expirent en fin de tour, pour les deux camps", () => {
    const game = scenario({
      p1: {
        monsters: [{ card: monsterCard('A'), patch: { tempAtkBuff: 200 } }],
      },
      p2: {
        monsters: [{ card: monsterCard('B'), patch: { tempAtkBuff: 300 } }],
      },
    });

    passTurn(engine, game);

    expect(monsterNamed(game, 'p1', 'A').tempAtkBuff).toBe(0);
    expect(monsterNamed(game, 'p2', 'B').tempAtkBuff).toBe(0);
  });

  it('un monstre sans effet particulier peut attaquer le tour de son invocation', () => {
    const game = scenario({ p1: { hand: [monsterCard('Fonceur')] } });
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });
    engine.dispatch(game, 'p1', toBattle);

    expect(attackWith(engine, game, 'p1', 'Fonceur')).toEqual({});
  });

  it('Quenouille : attend un tour, attaque deux fois, puis une fois par tour', () => {
    const quenouille = monsterCard('Quenouille', {
      atk: 100,
      hp: 1300,
      effects: [
        effect(EffectTrigger.ON_SUMMON, [
          act(ActionType.CANNOT_ATTACK_ON_SUMMON_TURN, EffectTarget.SELF),
          act(ActionType.SET_DELAY_DOUBLE_ATK, EffectTarget.SELF, { value: 1 }),
        ]),
      ],
    });
    const game = scenario({
      p1: { hand: [quenouille] },
      p2: { monsters: [monsterCard('Mur', { atk: 0, hp: 99_999 })] },
    });

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });
    engine.dispatch(game, 'p1', toBattle);
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur').error).toContain(
      'ne peut pas attaquer le tour de son invocation',
    );

    passTurn(engine, game);
    passTurn(engine, game);
    engine.dispatch(game, 'p1', toBattle);
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur').error).toContain(
      'toutes ses attaques',
    );

    passTurn(engine, game);
    passTurn(engine, game);
    engine.dispatch(game, 'p1', toBattle);
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur').error).toContain(
      'toutes ses attaques',
    );
  });

  it('gel de N tours : bloque exactement N tours du propriétaire du monstre', () => {
    const gel = ephemeralCard('Gel', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.BLOCK_ATTACK, EffectTarget.ENEMY_MONSTER, { value: 2 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [gel] },
      p2: { monsters: [monsterCard('Cible')] },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p2', 'Cible').instanceId,
    });

    passTurn(engine, game); // fin du tour de p1 → tour de p2
    for (let blockedTurn = 0; blockedTurn < 2; blockedTurn++) {
      engine.dispatch(game, 'p2', toBattle);
      expect(attackWith(engine, game, 'p2', 'Cible').error).toContain('bloqué');
      passTurn(engine, game); // fin du tour de p2 (le gel décompte)
      passTurn(engine, game); // fin du tour de p1
    }

    engine.dispatch(game, 'p2', toBattle);
    expect(attackWith(engine, game, 'p2', 'Cible')).toEqual({});
  });
});
