import { effectiveAtk } from '../helpers/game-state.helper';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import {
  P2_ID,
  instanceOf,
  monsterNamed,
  passTurn,
  scenario,
} from '../testing/scenario';

const engine = createEngine();

function guarded(patch = {}): GameState {
  const game = scenario({
    turn: 'p1',
    phase: 'main',
    p1: {
      monsters: [{ card: monsterCard('Mur', { atk: 300, hp: 900 }), patch }],
    },
  });
  const mur = monsterNamed(game, 'p1', 'Mur');
  if (!mur.guardLocked)
    expect(
      engine.dispatch(game, 'p1', {
        type: 'change_mode',
        instanceId: mur.instanceId,
        mode: 'guard',
      }).error,
    ).toBeUndefined();
  else mur.mode = 'guard';
  return game;
}

/** Fin de mon tour puis de celui de l'adversaire : début de mon tour suivant. */
const nextOwnTurn = (game: GameState) => {
  passTurn(engine, game);
  passTurn(engine, game);
};

describe('Garde à durée limitée', () => {
  it('repasse en Attaque après 2 tours adverses, avec +200 ATK', () => {
    const game = guarded();
    nextOwnTurn(game);
    const mur = monsterNamed(game, 'p1', 'Mur');
    expect(mur.mode).toBe('guard');
    expect(mur.guardTurns).toBe(1);
    nextOwnTurn(game);
    expect(mur.mode).toBe('attack');
    expect(effectiveAtk(mur)).toBe(300 + 200);
  });

  it('contre-offensive volontaire après 1 tour tenu : +100 jusqu’à la fin du tour', () => {
    const game = guarded();
    nextOwnTurn(game);
    const mur = monsterNamed(game, 'p1', 'Mur');
    expect(
      engine.dispatch(game, 'p1', {
        type: 'change_mode',
        instanceId: mur.instanceId,
        mode: 'attack',
      }).error,
    ).toBeUndefined();
    expect(effectiveAtk(mur)).toBe(300 + 100);
    passTurn(engine, game);
    expect(effectiveAtk(mur)).toBe(300);
  });

  it('repasser en Garde remet le compteur à zéro', () => {
    const game = guarded();
    nextOwnTurn(game);
    const mur = monsterNamed(game, 'p1', 'Mur');
    const mode = (m: 'attack' | 'guard') =>
      engine.dispatch(game, 'p1', {
        type: 'change_mode',
        instanceId: mur.instanceId,
        mode: m,
      });
    expect(mode('attack').error).toBeUndefined();
    // Retour en Garde au tour suivant seulement, compteur reparti de zéro
    nextOwnTurn(game);
    expect(mode('guard').error).toBeUndefined();
    expect(mur.guardTurns).toBe(0);
    nextOwnTurn(game);
    expect(mur.mode).toBe('guard');
  });

  it('un monstre verrouillé en Garde est libéré après 2 tours adverses', () => {
    const game = guarded({ guardLocked: true });
    nextOwnTurn(game);
    nextOwnTurn(game);
    const mur = monsterNamed(game, 'p1', 'Mur');
    expect(mur.guardLocked).toBe(false);
    expect(mur.mode).toBe('attack');
  });
});

describe('Garde : pas de contournement de la limite', () => {
  it('après le retour automatique, pas de Garde avant le tour suivant', () => {
    const game = guarded();
    nextOwnTurn(game);
    nextOwnTurn(game);
    const mur = monsterNamed(game, 'p1', 'Mur');
    expect(mur.mode).toBe('attack');
    expect(
      engine.dispatch(game, 'p1', {
        type: 'change_mode',
        instanceId: mur.instanceId,
        mode: 'guard',
      }).error,
    ).toBeDefined();
    nextOwnTurn(game);
    expect(
      engine.dispatch(game, 'p1', {
        type: 'change_mode',
        instanceId: mur.instanceId,
        mode: 'guard',
      }).error,
    ).toBeUndefined();
  });

  it("l'évolution garde le compteur et le verrou", () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        recycleEnergy: 2,
        hand: [monsterCard('Jeune', { stage: 'young', lineage: 'l', cost: 1 })],
        monsters: [
          {
            card: monsterCard('Bébé', { stage: 'baby', lineage: 'l' }),
            mode: 'guard',
            patch: { guardTurns: 1, guardLocked: true },
          },
        ],
      },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Bébé').instanceId,
        paymentHandIndices: [],
      }).error,
    ).toBeUndefined();
    const jeune = monsterNamed(game, 'p1', 'Jeune');
    expect(jeune.guardTurns).toBe(1);
    expect(jeune.guardLocked).toBe(true);
  });

  it('un verrou posé par l’adversaire repart de zéro', () => {
    const game = guarded();
    nextOwnTurn(game); // 1 tour tenu
    const mur = monsterNamed(game, 'p1', 'Mur');
    expect(mur.guardTurns).toBe(1);
    // Verrou de Position joué par l'adversaire pendant son tour
    passTurn(engine, game);
    const verrou = ephemeralCard('Verrou', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.FORCE_GUARD_LOCK_ENEMY, EffectTarget.ENEMY_MONSTER),
      ]),
    ]);
    game.player2.hand.push(instanceOf(verrou, P2_ID));
    expect(
      engine.dispatch(game, 'p2', {
        type: 'play_support',
        handIndex: game.player2.hand.length - 1,
        targetInstanceId: mur.instanceId,
      }).error,
    ).toBeUndefined();
    expect(mur.guardTurns).toBe(0);
  });
});
