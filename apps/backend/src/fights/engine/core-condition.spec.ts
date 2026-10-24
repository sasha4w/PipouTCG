import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { P1_ID, monsterNamed, scenario } from '../testing/scenario';

const engine = createEngine();

/** Force Plasma : détruit un ennemi si un Noyau est sur mon terrain. */
const forcePlasma = () =>
  ephemeralCard('Force Plasma', [
    effect(
      EffectTrigger.ON_PLAY,
      [act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER)],
      { type: 'SPECIFIC_CARD_ON_BOARD', value: 'Noyau', match: 'contains' },
    ),
  ]);

function game(p1Monsters: ReturnType<typeof monsterCard>[], zeta = false) {
  const g = scenario({
    turn: 'p1',
    phase: 'main',
    p1: { hand: [forcePlasma()], monsters: p1Monsters },
    p2: {
      monsters: [
        monsterCard('Cible'),
        ...(zeta ? [monsterCard('Noyau Zeta')] : []),
      ],
    },
  });
  if (zeta) monsterNamed(g, 'p2', 'Noyau Zeta').ownerUserId = P1_ID;
  return g;
}

const play = (g: ReturnType<typeof game>) =>
  engine.dispatch(g, 'p1', {
    type: 'play_support',
    handIndex: 0,
    targetInstanceId: monsterNamed(g, 'p2', 'Cible').instanceId,
  });

describe('condition « un Noyau sur mon terrain »', () => {
  it('jouable avec Noyau Alpha en jeu', () => {
    const g = game([monsterCard('Noyau Alpha')]);
    expect(play(g).error).toBeUndefined();
    expect(
      g.player2.monsterZones.some((m) => m?.card.baseCard.name === 'Cible'),
    ).toBe(false);
  });

  it('refusée sans Noyau', () => {
    expect(play(game([monsterCard('Soldat')])).error).toBeDefined();
  });

  it('refusée si mon seul Noyau est un Zeta implanté chez l’adversaire', () => {
    expect(play(game([], true)).error).toBeDefined();
  });
});
