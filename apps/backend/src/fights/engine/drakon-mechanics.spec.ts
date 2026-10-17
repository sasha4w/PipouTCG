import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  equipmentCard,
  monsterCard,
} from '../testing/cards';
import { handNames, monsterNamed, scenario } from '../testing/scenario';

const dragon = (name: string, extra: Parameters<typeof monsterCard>[1] = {}) =>
  monsterCard(name, { archetype: 'dragon', ...extra });

describe('mécaniques Drakon', () => {
  const engine = createEngine();

  describe('cibles, conditions, filtres', () => {
    it('STRONGEST_ENEMY vise le monstre adverse de plus grande ATK', () => {
      const renvoi = ephemeralCard('Renvoi', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.RETURN_TO_HAND, EffectTarget.STRONGEST_ENEMY),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [renvoi] },
        p2: {
          monsters: [
            monsterCard('Faible', { atk: 100 }),
            monsterCard('Fort', { atk: 900 }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(handNames(game, 'p2')).toContain('Fort');
      expect(monsterNamed(game, 'p2', 'Faible')).toBeDefined();
    });

    it('DRAKON_ON_BOARD par stade et par élément (valueIf)', () => {
      const frappe = () =>
        ephemeralCard('Frappe', [
          effect(EffectTrigger.ON_PLAY, [
            act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
              value: 300,
              valueIf: {
                condition: {
                  type: EffectConditionType.DRAKON_ON_BOARD,
                  element: 'fire',
                },
                value: 600,
              },
            }),
          ]),
        ]);
      const sans = scenario({
        p1: {
          hand: [frappe()],
          monsters: [dragon('Eau', { element: 'water' })],
        },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(sans, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(sans, 'p2', 'Cible').currentHp).toBe(1700);

      const avec = scenario({
        p1: {
          hand: [frappe()],
          monsters: [dragon('Feu', { element: 'fire' })],
        },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(avec, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(avec, 'p2', 'Cible').currentHp).toBe(1400);
    });

    it('EQUIPPED_ON par stade (sans nom)', () => {
      const ecaille = equipmentCard('Écaille', [
        effect(
          EffectTrigger.PASSIVE,
          [act(ActionType.SET_DEBUFF_IMMUNITY, EffectTarget.SELF)],
          { type: EffectConditionType.EQUIPPED_ON, stage: 'egg' },
        ),
      ]);
      const game = scenario({
        p1: {
          monsters: [
            {
              card: dragon('Œuf', { stage: 'egg', atk: 0 }),
              equipments: [ecaille],
            },
            { card: dragon('Bébé', { stage: 'baby' }), equipments: [ecaille] },
          ],
        },
      });
      engine.settle(game);
      expect(monsterNamed(game, 'p1', 'Œuf').isImmuneToDebuffs).toBe(true);
      expect(monsterNamed(game, 'p1', 'Bébé').isImmuneToDebuffs).toBe(false);
    });

    it('filtre de recherche par stade', () => {
      const potion = ephemeralCard('Potion', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.SEARCH_DECK, EffectTarget.PLAYER, {
            filter: { stage: 'young' },
          }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [potion],
          deck: [
            dragon('Bébé A', { stage: 'baby' }),
            dragon('Jeune A', { stage: 'young' }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(
        game.pendingChoices[0].candidates.map((c) => c.baseCard.name),
      ).toEqual(['Jeune A']);
    });

    it('ARCHETYPE_ALLIES depuis un Éphémère (archetype de l’action)', () => {
      const souffle = ephemeralCard('Souffle', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.BUFF_ATK_TEMP, EffectTarget.ARCHETYPE_ALLIES, {
            value: 300,
            archetype: 'dragon',
          }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [souffle],
          monsters: [
            dragon('Drakon'),
            monsterCard('Pipou', { archetype: 'pipou' }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(game, 'p1', 'Drakon').tempAtkBuff).toBe(300);
      expect(monsterNamed(game, 'p1', 'Pipou').tempAtkBuff).toBe(0);
    });
  });
});
