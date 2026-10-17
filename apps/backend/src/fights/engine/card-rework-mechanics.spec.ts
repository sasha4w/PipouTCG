import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { attackWith, monsterNamed, scenario } from '../testing/scenario';

describe('mécaniques du retravail des cartes', () => {
  const engine = createEngine();

  describe('valueIf (quantité conditionnelle)', () => {
    const rappel = () =>
      ephemeralCard('Rappel', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.RETURN_FROM_GRAVEYARD, EffectTarget.PLAYER, {
            value: 2,
            valueIf: {
              condition: {
                type: 'SPECIFIC_CARD_ON_BOARD',
                value: 'Capitaine',
                match: 'contains',
              },
              value: 3,
            },
          }),
        ]),
      ]);
    const graveyard = ['A', 'B', 'C', 'D'].map((n) => monsterCard(n));

    it('condition fausse : la valeur de base', () => {
      const game = scenario({ p1: { hand: [rappel()], graveyard } });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.pendingChoices[0].count).toBe(2);
    });

    it('condition vraie : la valeur conditionnelle', () => {
      const game = scenario({
        p1: {
          hand: [rappel()],
          graveyard,
          monsters: [monsterCard('Vice Capitaine Patouille')],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.pendingChoices[0].count).toBe(3);
    });
  });

  describe('immunité aux effets adverses (SET_DEBUFF_IMMUNITY)', () => {
    const IMMUNE = {
      perm: {
        atk: 0,
        hp: 0,
        taunt: false,
        piercing: false,
        debuffImmune: true,
        attacksPerTurn: 1,
      },
      isImmuneToDebuffs: true,
    };
    const magouille = () => ({
      card: monsterCard('Magouille', { atk: 0, hp: 2000 }),
      patch: IMMUNE,
    });
    const destruction = () =>
      ephemeralCard('Destruction', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER),
        ]),
      ]);

    it('un Éphémère ciblé ne peut pas le choisir', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: { monsters: [magouille(), monsterCard('Lutin')] },
      });
      const result = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Magouille').instanceId,
      });
      expect(result.error).toBe('Ce monstre est insensible aux effets adverses');
    });

    it('seul monstre adverse : la carte ciblée est injouable', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: { monsters: [magouille()] },
      });
      const result = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Magouille').instanceId,
      });
      expect(result.error).toBe('Aucune cible valide pour cette carte');
    });

    it('les effets de zone adverses l’épargnent', () => {
      const meteore = ephemeralCard('Météore', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 300 }),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [meteore] },
        p2: { monsters: [magouille(), monsterCard('Lutin', { hp: 500 })] },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(game, 'p2', 'Magouille').currentHp).toBe(2000);
      expect(monsterNamed(game, 'p2', 'Lutin').currentHp).toBe(200);
    });

    it('le combat le blesse normalement', () => {
      const game = scenario({
        phase: 'battle',
        p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 3000 })] },
        p2: { monsters: [magouille()] },
      });
      attackWith(engine, game, 'p1', 'Ogre', 'Magouille');
      expect(monsterNamed(game, 'p2', 'Magouille').currentHp).toBe(1400);
    });

    it('les effets de son propre camp s’appliquent', () => {
      const soin = ephemeralCard('Soin', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.HEAL, EffectTarget.TARGET_ALLY, { value: 500 }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [soin],
          monsters: [{ ...magouille(), currentHp: 1000 }],
        },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Magouille').instanceId,
      });
      expect(monsterNamed(game, 'p1', 'Magouille').currentHp).toBe(1500);
    });
  });
});
