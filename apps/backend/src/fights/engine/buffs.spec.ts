import {
  ActionType,
  Archetype,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import type { GameAction } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  equipmentCard,
  monsterCard,
  terrainCard,
} from '../testing/cards';
import { graveyardNames, monsterNamed, scenario } from '../testing/scenario';

const { PASSIVE, ON_SUMMON } = EffectTrigger;

/** Lieutenant à la Bidouille/Fripouille : +150/+150 si son binôme est sur le terrain. */
const lieutenant = (name: string, partner: string, hp: number) =>
  monsterCard(name, {
    atk: 300,
    hp,
    effects: [
      effect(
        PASSIVE,
        [
          act(ActionType.BUFF_ATK, EffectTarget.SELF, { value: 150 }),
          act(ActionType.BUFF_HP, EffectTarget.SELF, { value: 150 }),
        ],
        { type: EffectConditionType.SPECIFIC_CARD_ON_BOARD, value: partner },
      ),
    ],
  });

const summon = (handIndex: number, zoneIndex: number): GameAction => ({
  type: 'summon',
  handIndex,
  zoneIndex,
  paymentHandIndices: [],
});

describe('GameEngine — buffs', () => {
  const engine = createEngine();

  it('un buff ON_SUMMON est permanent malgré les recalculs suivants', () => {
    const heraut = monsterCard('Héraut', {
      effects: [
        effect(ON_SUMMON, [
          act(ActionType.BUFF_ATK, EffectTarget.ALL_ALLIES, { value: 200 }),
        ]),
      ],
    });
    const game = scenario({
      p1: {
        monsters: [monsterCard('Allié')],
        hand: [heraut, monsterCard('Recrue')],
      },
    });

    engine.dispatch(game, 'p1', summon(0, 1));
    engine.dispatch(game, 'p1', summon(0, 2));

    expect(monsterNamed(game, 'p1', 'Allié').atkBuff).toBe(200);
    expect(monsterNamed(game, 'p1', 'Héraut').atkBuff).toBe(200);
    expect(monsterNamed(game, 'p1', 'Recrue').atkBuff).toBe(0);
  });

  it("un passif conditionnel ne s'applique que si sa condition est remplie", () => {
    const game = scenario({
      p1: {
        monsters: [lieutenant('Bidouille', 'Fripouille', 500)],
        hand: [lieutenant('Fripouille', 'Bidouille', 700)],
      },
    });

    engine.settle(game);
    expect(monsterNamed(game, 'p1', 'Bidouille').atkBuff).toBe(0);

    engine.dispatch(game, 'p1', summon(0, 1));

    const bidouille = monsterNamed(game, 'p1', 'Bidouille');
    expect(bidouille.atkBuff).toBe(150);
    expect(bidouille.currentHp).toBe(650);
    expect(monsterNamed(game, 'p1', 'Fripouille').currentHp).toBe(850);
  });

  it('perdre un bonus de PV max plafonne les PV courants', () => {
    const game = scenario({
      p1: {
        monsters: [
          lieutenant('Bidouille', 'Fripouille', 500),
          lieutenant('Fripouille', 'Bidouille', 700),
        ],
      },
    });
    engine.settle(game);
    game.player1.monsterZones[1] = null;

    engine.settle(game);

    const bidouille = monsterNamed(game, 'p1', 'Bidouille');
    expect(bidouille.atkBuff).toBe(0);
    expect(bidouille.currentHp).toBe(500);
  });

  it('un monstre qui tombe à 0 PV en perdant un bonus est détruit', () => {
    const game = scenario({
      p1: {
        monsters: [
          lieutenant('Bidouille', 'Fripouille', 500),
          lieutenant('Fripouille', 'Bidouille', 700),
        ],
      },
    });
    engine.settle(game);
    monsterNamed(game, 'p1', 'Bidouille').currentHp = 100;
    game.player1.monsterZones[1] = null;

    engine.settle(game);

    expect(game.player1.monsterZones[0]).toBeNull();
    expect(graveyardNames(game, 'p1')).toContain('Bidouille');
  });

  it("un terrain ARCHETYPE_ALLIES ne buffe que l'archétype visé", () => {
    const terrain = terrainCard('Fanfare', [
      effect(PASSIVE, [
        act(ActionType.BUFF_ATK, EffectTarget.ARCHETYPE_ALLIES, {
          value: 300,
          archetype: Archetype.PIPOU,
        }),
      ]),
    ]);
    const game = scenario({
      p1: {
        supports: [terrain],
        monsters: [
          monsterCard('Pipou', { archetype: Archetype.PIPOU }),
          monsterCard('Dragon', { archetype: Archetype.DRAGON }),
        ],
      },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Pipou').atkBuff).toBe(300);
    expect(monsterNamed(game, 'p1', 'Dragon').atkBuff).toBe(0);
  });

  it('un passif ALL_ALLIES de monstre buffe tous les alliés', () => {
    const banniere = monsterCard('Bannière', {
      effects: [
        effect(PASSIVE, [
          act(ActionType.BUFF_ATK, EffectTarget.ALL_ALLIES, { value: 100 }),
        ]),
      ],
    });
    const game = scenario({
      p1: { monsters: [banniere, monsterCard('Soldat')] },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Bannière').atkBuff).toBe(100);
    expect(monsterNamed(game, 'p1', 'Soldat').atkBuff).toBe(100);
  });

  it("Provocation : celle d'un passif suit sa condition, celle d'ON_SUMMON reste", () => {
    const bouclier = equipmentCard('Bouclier', [
      effect(PASSIVE, [act(ActionType.SET_TAUNT, EffectTarget.SELF)], {
        type: EffectConditionType.SPECIFIC_CARD_ON_BOARD,
        value: 'Introuvable',
      }),
    ]);
    const gardien = monsterCard('Gardien', {
      effects: [
        effect(ON_SUMMON, [act(ActionType.SET_TAUNT, EffectTarget.SELF)]),
      ],
    });
    const game = scenario({
      p1: {
        monsters: [{ card: monsterCard('Porteur'), equipments: [bouclier] }],
        hand: [gardien],
      },
    });

    engine.dispatch(game, 'p1', summon(0, 1));

    expect(monsterNamed(game, 'p1', 'Porteur').hasTaunt).toBe(false);
    expect(monsterNamed(game, 'p1', 'Gardien').hasTaunt).toBe(true);
  });
});
