import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import type { CardNameMatch, EffectCondition } from '@pipou/shared';
import { checkCondition } from './effect-conditions';
import { createEngine } from '../testing/engine';
import { act, effect, equipmentCard, monsterCard } from '../testing/cards';
import { monsterNamed, scenario, P1_ID } from '../testing/scenario';

const onBoard = (value: string, match?: CardNameMatch): EffectCondition => ({
  type: EffectConditionType.SPECIFIC_CARD_ON_BOARD,
  value,
  match,
});
const cardEffect = (condition: EffectCondition) =>
  effect(EffectTrigger.PASSIVE, [], condition);

describe('checkCondition — noms de cartes', () => {
  it('SPECIFIC_CARD_ON_BOARD ignore casse, accents et espace final', () => {
    const game = scenario({
      p1: {
        monsters: [
          monsterCard('Noyau Alpha '),
          monsterCard('Médecin Citrouille'),
        ],
      },
    });
    const ctx = { game, ownerUserId: P1_ID, log: [] };

    expect(checkCondition(cardEffect(onBoard('noyau alpha')), ctx)).toBe(true);
    expect(checkCondition(cardEffect(onBoard('Medecin citrouille')), ctx)).toBe(
      true,
    );
  });

  it("match 'contains' vise une série", () => {
    const game = scenario({
      p1: { monsters: [monsterCard('Roi de la Rose')] },
    });
    const ctx = { game, ownerUserId: P1_ID, log: [] };

    expect(
      checkCondition(cardEffect(onBoard('de la rose', 'contains')), ctx),
    ).toBe(true);
    expect(checkCondition(cardEffect(onBoard('de la rose')), ctx)).toBe(false);
  });

  it('ne regarde que le terrain du propriétaire', () => {
    const game = scenario({ p2: { monsters: [monsterCard('Noyau Alpha')] } });

    expect(
      checkCondition(cardEffect(onBoard('Noyau Alpha')), {
        game,
        ownerUserId: P1_ID,
        log: [],
      }),
    ).toBe(false);
  });

  it("EQUIPPED_ON : l'équipement n'agit que sur le monstre nommé", () => {
    const module = () =>
      equipmentCard('Module', [
        effect(
          EffectTrigger.PASSIVE,
          [act(ActionType.SET_TAUNT, EffectTarget.SELF)],
          { type: EffectConditionType.EQUIPPED_ON, value: 'Noyau Alpha' },
        ),
      ]);
    const game = scenario({
      p1: {
        monsters: [
          { card: monsterCard('Noyau Alpha '), equipments: [module()] },
          { card: monsterCard('Noyau Beta'), equipments: [module()] },
        ],
      },
    });

    createEngine().settle(game);

    expect(monsterNamed(game, 'p1', 'Noyau Alpha ').hasTaunt).toBe(true);
    expect(monsterNamed(game, 'p1', 'Noyau Beta').hasTaunt).toBe(false);
  });
});
