import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { act, chargeCard, effect, monsterCard } from '../testing/cards';
import { createEngine } from '../testing/engine';
import { effectiveAtk } from '../helpers/game-state.helper';
import { realCard } from '../testing/real-cards';
import { monsterNamed, passTurn, scenario } from '../testing/scenario';

const engine = createEngine();
const passTurns = (game: ReturnType<typeof scenario>, n: number) => {
  for (let i = 0; i < n; i++) {
    passTurn(engine, game);
    passTurn(engine, game);
  }
};
const pick = (game: ReturnType<typeof scenario>, name: string) => {
  const c = game.pendingChoices[0].candidates.find(
    (x) => x.baseCard.name === name,
  )!;
  return engine.dispatch(game, 'p1', {
    type: 'pick_cards',
    instanceIds: [c.instanceId],
  });
};

const extraction = () =>
  chargeCard('Extraction', 1, [
    effect(EffectTrigger.ON_CHARGED, [
      act(ActionType.TRANSFER_HALF_ATK, EffectTarget.PLAYER, {
        filter: { name: 'Noyau', archetype: 'pixelman' },
      }),
    ]),
  ]);

describe('actions des cartes Charge', () => {
  it('GRANT_EXTRA_ATTACK : une attaque de plus ce tour', () => {
    const charge = chargeCard('Alerte', 1, [
      effect(EffectTrigger.ON_CHARGED, [
        act(ActionType.GRANT_EXTRA_ATTACK, EffectTarget.ALL_ALLIES, {
          value: 1,
        }),
      ]),
    ]);
    const game = scenario({
      p1: { supports: [charge], monsters: [monsterCard('Soldat')] },
    });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(monsterNamed(game, 'p1', 'Soldat').extraAttacksThisTurn).toBe(1);
  });

  it('TRANSFER_HALF_ATK : la moitié de l’ATK d’un monstre passe à un Noyau ce tour', () => {
    const game = scenario({
      p1: {
        supports: [extraction()],
        monsters: [
          monsterCard('Noyau Alpha', { atk: 500, archetype: 'pixelman' }),
        ],
      },
      p2: { monsters: [monsterCard('Colosse', { atk: 1000 })] },
    });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(
      game.pendingChoices[0].candidates.map((c) => c.baseCard.name).sort(),
    ).toEqual(['Colosse', 'Noyau Alpha']);
    expect(pick(game, 'Colosse').error).toBeUndefined();
    expect(pick(game, 'Noyau Alpha').error).toBeUndefined();
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Colosse'))).toBe(500);
    expect(effectiveAtk(monsterNamed(game, 'p1', 'Noyau Alpha'))).toBe(1000);
    passTurn(engine, game);
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Colosse'))).toBe(1000);
  });

  describe('FORCE_EVOLVE', () => {
    const meditation = () =>
      chargeCard('Méditation', 1, [
        effect(EffectTrigger.ON_CHARGED, [
          act(ActionType.FORCE_EVOLVE, EffectTarget.PLAYER, {
            filter: { archetype: 'dragon' },
          }),
        ]),
      ]);

    it('un Drakon choisi évolue sans carte en main ni dans le deck', () => {
      const game = scenario({
        p1: { supports: [meditation()], monsters: [realCard('Adulte Teros')] },
      });
      game.player1.supportZones[0]!.chargeCounters = 0;
      passTurns(game, 1);
      expect(pick(game, 'Adulte Teros').error).toBeUndefined();
      expect(monsterNamed(game, 'p1', 'Ancestral Teros')).toBeDefined();
      expect(game.player1.hand.map((c) => c.baseCard.name)).not.toContain(
        'Ancestral Teros',
      );
      expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain(
        'Adulte Teros',
      );
    });

    it('un Ancestral ne fait pas partie des choix', () => {
      const game = scenario({
        p1: {
          supports: [meditation()],
          monsters: [realCard('Ancestral Teros')],
        },
      });
      game.player1.supportZones[0]!.chargeCounters = 0;
      passTurns(game, 1);
      expect(game.pendingChoices).toEqual([]);
    });
  });

  describe('REQUIRES_CARD_ON_BOARD', () => {
    const alerte = () =>
      chargeCard('Alerte', 3, [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.REQUIRES_CARD_ON_BOARD, EffectTarget.SELF, {
            filter: { name: 'Général Chatouille' },
          }),
        ]),
      ]);

    it('refusé sans la carte exigée', () => {
      const game = scenario({ p1: { hand: [alerte()] } });
      expect(
        engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          zoneIndex: 0,
        }).error,
      ).toBe('Il faut Général Chatouille sur le terrain');
    });

    it('part au cimetière quand la carte exigée quitte le terrain', () => {
      const game = scenario({
        p1: {
          hand: [alerte()],
          monsters: [monsterCard('Général Chatouille')],
        },
      });
      expect(
        engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          zoneIndex: 0,
        }).error,
      ).toBeUndefined();
      game.player1.monsterZones[0] = null;
      engine.settle(game);
      expect(game.player1.supportZones[0]).toBeNull();
      expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain(
        'Alerte',
      );
    });
  });

  it('TRANSFER_HALF_ATK : rien sans Noyau allié', () => {
    const game = scenario({
      p1: { supports: [extraction()] },
      p2: { monsters: [monsterCard('Colosse', { atk: 1000 })] },
    });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(game.pendingChoices).toEqual([]);
  });
});
