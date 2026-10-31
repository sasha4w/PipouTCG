import { EFFECT_IMMUNITIES } from '@pipou/shared';
import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, equipmentCard, monsterCard } from '../testing/cards';
import { effectiveAtk } from '../helpers/game-state.helper';
import { monsterNamed, P1_ID, passTurn, scenario } from '../testing/scenario';

describe('GameEngine — bonus donnés aux coéquipiers', () => {
  const engine = createEngine();

  /** Général à la Chatouille : +200 ATK aux autres alliés dès la Battle Phase. */
  const general = () =>
    monsterCard('Général', {
      atk: 800,
      hp: 1500,
      effects: [
        effect(EffectTrigger.ON_BATTLE_PHASE_START, [
          act(ActionType.BUFF_ATK_TEMP, EffectTarget.ALLIES_EXCEPT_SELF, {
            value: 200,
          }),
        ]),
      ],
    });

  it("début du combat : les alliés gagnent +200 ATK jusqu'à la fin du tour, pas lui", () => {
    const game = scenario({
      p1: { monsters: [general(), monsterCard('Soldat')] },
    });

    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(game.phase).toBe('battle');
    expect(monsterNamed(game, 'p1', 'Soldat').tempAtkBuff).toBe(200);
    expect(monsterNamed(game, 'p1', 'Général').tempAtkBuff).toBe(0);

    passTurn(engine, game);

    expect(monsterNamed(game, 'p1', 'Soldat').tempAtkBuff).toBe(0);
  });

  it("le début du combat de l'adversaire ne déclenche pas le Général", () => {
    const game = scenario({
      turn: 'p2',
      p1: { monsters: [general(), monsterCard('Soldat')] },
    });

    engine.dispatch(game, 'p2', { type: 'end_phase' });

    expect(monsterNamed(game, 'p1', 'Soldat').tempAtkBuff).toBe(0);
  });

  it('Champion : +300 PV max à chaque allié adjacent, rien pour lui ni pour les autres', () => {
    const champion = monsterCard('Champion', {
      atk: 900,
      hp: 1800,
      effects: [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.BUFF_HP, EffectTarget.ADJACENT_ALLIES, { value: 300 }),
        ]),
      ],
    });
    const game = scenario({
      p1: {
        monsters: [monsterCard('Gauche'), champion, monsterCard('Droite')],
      },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Gauche').hpBuff).toBe(300);
    expect(monsterNamed(game, 'p1', 'Gauche').currentHp).toBe(800);
    expect(monsterNamed(game, 'p1', 'Droite').hpBuff).toBe(300);
    expect(monsterNamed(game, 'p1', 'Champion').hpBuff).toBe(0);
  });

  it('Champion en bord de terrain : seul son unique voisin en profite', () => {
    const champion = monsterCard('Champion', {
      effects: [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.BUFF_HP, EffectTarget.ADJACENT_ALLIES, { value: 300 }),
        ]),
      ],
    });
    const game = scenario({
      p1: {
        monsters: [champion, monsterCard('Voisin'), monsterCard('Lointain')],
      },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Voisin').hpBuff).toBe(300);
    expect(monsterNamed(game, 'p1', 'Lointain').hpBuff).toBe(0);
  });
});

describe('GameEngine — aura de virus du Zeta implanté', () => {
  const engine = createEngine();

  const zeta = (value = 300) =>
    monsterCard('Noyau Zeta', {
      effects: [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.VIRUS_ATK_DEBUFF, EffectTarget.SELF, { value }),
        ]),
      ],
    });
  const implanted = (value = 300) => ({
    card: zeta(value),
    patch: { ownerUserId: P1_ID },
  });

  it("chaque autre monstre de l'hôte perd l'ATK du virus, jusqu'à 0", () => {
    const game = scenario({
      p2: {
        monsters: [
          monsterCard('Fort', { atk: 800 }),
          monsterCard('Faible', { atk: 100 }),
          implanted(300),
        ],
      },
    });

    engine.settle(game);

    expect(effectiveAtk(monsterNamed(game, 'p2', 'Fort'))).toBe(500);
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Faible'))).toBe(0);
    expect(monsterNamed(game, 'p2', 'Noyau Zeta').atkBuff).toBe(0);
  });

  it("un monstre immunisé aux debuffs (passif ou permanent) n'est pas touché", () => {
    const passiveImmune = monsterCard('Passif', {
      atk: 800,
      effects: [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.SET_DEBUFF_IMMUNITY, EffectTarget.SELF),
        ]),
      ],
    });
    const game = scenario({
      p2: {
        monsters: [
          passiveImmune,
          monsterCard('Permanent', { atk: 800 }),
          implanted(300),
        ],
      },
    });
    monsterNamed(game, 'p2', 'Permanent').perm.immunities = [
      ...EFFECT_IMMUNITIES,
    ];

    engine.settle(game);

    expect(effectiveAtk(monsterNamed(game, 'p2', 'Passif'))).toBe(800);
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Permanent'))).toBe(800);
  });

  it("l'équipement du Zeta ajoute son virus : le plus fort compte, pas la somme", () => {
    const patch = equipmentCard('Patch viral', [
      effect(
        EffectTrigger.PASSIVE,
        [act(ActionType.VIRUS_ATK_DEBUFF, EffectTarget.SELF, { value: 600 })],
        { type: EffectConditionType.EQUIPPED_ON, value: 'Noyau Zeta' },
      ),
    ]);
    const game = scenario({
      p2: {
        monsters: [
          monsterCard('Fort', { atk: 1000 }),
          { ...implanted(300), equipments: [patch] },
        ],
      },
    });

    engine.settle(game);

    expect(effectiveAtk(monsterNamed(game, 'p2', 'Fort'))).toBe(400);
  });

  it("un Zeta sur son propre terrain n'a aucune aura sur ses alliés", () => {
    const game = scenario({
      p1: { monsters: [monsterCard('Allié', { atk: 800 }), zeta(300)] },
    });

    engine.settle(game);

    expect(effectiveAtk(monsterNamed(game, 'p1', 'Allié'))).toBe(800);
  });

  it('Zeta détruit : le malus disparaît au recalcul', () => {
    const game = scenario({
      p2: { monsters: [monsterCard('Fort', { atk: 800 }), implanted(300)] },
    });
    engine.settle(game);
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Fort'))).toBe(500);

    game.player2.monsterZones = game.player2.monsterZones.map((m) =>
      m?.card.baseCard.name === 'Noyau Zeta' ? null : m,
    );
    engine.settle(game);

    expect(effectiveAtk(monsterNamed(game, 'p2', 'Fort'))).toBe(800);
  });
});
