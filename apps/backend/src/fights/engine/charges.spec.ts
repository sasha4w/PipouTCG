import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, chargeCard, effect, ephemeralCard } from '../testing/cards';
import { passTurn, scenario } from '../testing/scenario';
import { EffectsResolverService } from '../effects-resolver.service';
import { PhaseService } from '../services/phase.service';

const engine = createEngine();
const draw2 = effect(EffectTrigger.ON_CHARGED, [
  act(ActionType.DRAW, EffectTarget.PLAYER, { value: 2 }),
]);
/** Fin du tour de p1 puis fin du tour de p2 : on revient au début du tour suivant de p1. */
const passTurns = (game: ReturnType<typeof scenario>, n: number) => {
  for (let i = 0; i < n; i++) {
    passTurn(engine, game);
    passTurn(engine, game);
  }
};

describe('Charges', () => {
  it('posée avec 0 compteur', () => {
    const game = scenario({ p1: { hand: [chargeCard('Rituel', 2, [draw2])] } });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        zoneIndex: 0,
      }).error,
    ).toBeUndefined();
    expect(game.player1.supportZones[0]?.chargeCounters).toBe(0);
  });

  it('+1 au début de chaque tour de son propriétaire, puis déclenchement et cimetière', () => {
    const game = scenario({
      p1: { supports: [chargeCard('Rituel', 2, [draw2])] },
    });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(game.player1.supportZones[0]?.chargeCounters).toBe(1);
    const handBefore = game.player1.hand.length;
    game.pendingEvents = [];
    passTurns(game, 1);
    expect(game.player1.supportZones[0]).toBeNull();
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain(
      'Rituel',
    );
    expect(game.player1.hand.length).toBe(handBefore + 1 + 2); // pioche du tour + DRAW 2
    expect(game.pendingEvents.some((e) => e.kind === 'charge_triggered')).toBe(
      true,
    );
    expect(game.pendingEvents.some((e) => e.kind === 'charge_progress')).toBe(
      true,
    );
  });

  it('ADD_CHARGE_COUNTERS accélère la charge', () => {
    const boost = ephemeralCard('Surcharge', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.ADD_CHARGE_COUNTERS, EffectTarget.PLAYER, { value: 2 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [boost], supports: [chargeCard('Rituel', 3, [draw2])] },
    });
    game.player1.supportZones[0]!.chargeCounters = 1;
    const handBefore = game.player1.hand.length;
    expect(
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 }).error,
    ).toBeUndefined();
    expect(game.player1.supportZones[0]).toBeNull(); // 1 + 2 = 3 → déclenchée
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain(
      'Rituel',
    );
    expect(game.player1.hand.length).toBe(handBefore - 1 + 2);
  });

  it('mode cyclique refusé', () => {
    const game = scenario({
      p1: {
        hand: [chargeCard('Cycle', 2, [], { chargeMode: 'CYCLIC' as never })],
      },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        zoneIndex: 0,
      }).error,
    ).toBe('Mode de charge cyclique pas encore disponible');
  });

  it('les charges adverses ne bougent pas pendant mon tour', () => {
    const game = scenario({ p2: { supports: [chargeCard('Rituel', 5, [])] } });
    game.player2.supportZones[0]!.chargeCounters = 0;
    const phase = new PhaseService(new EffectsResolverService());
    phase.startTurn(game, game.player1);
    expect(game.player2.supportZones[0]?.chargeCounters).toBe(0);
    phase.startTurn(game, game.player2);
    expect(game.player2.supportZones[0]?.chargeCounters).toBe(1);
  });
});
