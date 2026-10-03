import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, monsterCard } from '../testing/cards';
import { monsterNamed, passTurn, scenario } from '../testing/scenario';

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
