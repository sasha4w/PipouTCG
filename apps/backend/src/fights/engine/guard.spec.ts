import { effectiveAtk } from '../helpers/game-state.helper';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { monsterNamed, passTurn, scenario } from '../testing/scenario';

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
    for (const mode of ['attack', 'guard'] as const)
      engine.dispatch(game, 'p1', {
        type: 'change_mode',
        instanceId: mur.instanceId,
        mode,
      });
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
