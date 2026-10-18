import { Logger } from '@nestjs/common';
import { HAND_LIMIT } from '@pipou/shared';
import type { GameEngine } from '../engine/game-engine';
import { createEngine } from '../testing/engine';
import { equipmentCard, monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  P1_ID,
  P2_ID,
  monsterNamed,
  scenario,
  seatState,
} from '../testing/scenario';
import { AiPlayer, MISTAKE_RATE, aiMustAct } from './ai-player';
import type { AiProfile } from './ai-player';

const engine = createEngine();
const ai = new AiPlayer(engine, () => 0.99);
const profile: AiProfile = { archetype: 'pipou', level: 3 };

describe('AiPlayer', () => {
  it('niveaux : 25 % / 10 % puis aucune erreur volontaire', () => {
    expect(MISTAKE_RATE).toEqual({ 1: 0.25, 2: 0.1, 3: 0, 4: 0, 5: 0 });
  });

  it('phase de combat : choisit l’attaque qui fait gagner', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'battle',
      p1: {
        monsters: [
          monsterCard('Colosse', { atk: 50, hp: 5000 }),
          monsterCard('Moucheron', { atk: 0, hp: 100 }),
        ],
      },
      p2: {
        primes: 1,
        monsters: [monsterCard('Lame', { atk: 200, hp: 500 })],
      },
    });

    const action = ai.chooseAction(game, 'p2', profile);

    expect(action).toEqual({
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p2', 'Lame').instanceId,
      targetInstanceId: monsterNamed(game, 'p1', 'Moucheron').instanceId,
    });
    expect(engine.dispatch(game, 'p2', action).error).toBeUndefined();
    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P2_ID);
  });

  it('choix en attente pour l’IA : un pick_cards accepté par le moteur', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p2: { deck: [monsterCard('Petit'), monsterCard('Grand', { atk: 900 })] },
    });
    const deck = seatState(game, 'p2').deck;
    game.pendingChoices.push({
      forUserId: P2_ID,
      candidates: deck.map((c) => ({
        instanceId: c.instanceId,
        baseCard: c.baseCard,
        source: 'deck' as const,
      })),
      count: 1,
      prompt: 'Choisis une carte',
    });

    expect(aiMustAct(game, P2_ID)).toBe(true);
    expect(aiMustAct(game, P1_ID)).toBe(false);
    const action = ai.chooseAction(game, 'p2', profile);

    expect(action.type).toBe('pick_cards');
    expect(engine.dispatch(game, 'p2', action).error).toBeUndefined();
    expect(game.pendingChoices).toHaveLength(0);
  });

  it('main vide et terrain plein en phase principale : end_phase', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p2: {
        hand: [],
        monsters: [monsterCard('A'), monsterCard('B'), monsterCard('C')],
      },
    });

    expect(ai.chooseAction(game, 'p2', profile)).toEqual({
      type: 'end_phase',
    });
  });

  it('phase de fin avec une main trop pleine : défausse valide', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p2: {
        hand: Array.from({ length: HAND_LIMIT + 2 }, (_, i) =>
          monsterCard(`Carte ${i}`),
        ),
      },
    });

    expect(aiMustAct(game, P2_ID)).toBe(true);
    const action = ai.chooseAction(game, 'p2', profile);

    expect(action.type).toBe('discard');
    expect(engine.dispatch(game, 'p2', action).error).toBeUndefined();
  });

  it('ne modifie jamais l’état reçu', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p1: { monsters: [monsterCard('Cible', { atk: 300, hp: 400 })] },
      p2: {
        hand: [
          monsterCard('Recrue', { cost: 1 }),
          monsterCard('Soldat'),
          equipmentCard('Épée', []),
        ],
        monsters: [monsterCard('Garde')],
      },
    });
    const before = structuredClone(game);

    ai.chooseAction(game, 'p2', profile);

    expect(game).toEqual(before);
  });

  it('Pixelman : équipe le noyau en priorité', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p2: {
        hand: [realCard('Processeur de Calcul .bin')],
        monsters: [
          realCard('Sentinelle .cfg'),
          {
            card: realCard('Noyau Alpha'),
            equipments: [realCard('Firewall .sys')],
          },
        ],
      },
    });

    const action = ai.chooseAction(game, 'p2', {
      archetype: 'pixelman',
      level: 3,
    });

    expect(action).toEqual({
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p2', 'Noyau Alpha').instanceId,
    });
  });

  it('Pipou : protège le monstre qui booste ses alliés', () => {
    // Un seul attaquant adverse : il détruira l'un des deux monstres en mode ATK.
    // Le booster (+100 ATK au voisin) doit passer en Garde, pas le voisin.
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p1: { monsters: [monsterCard('Ogre', { atk: 700, hp: 3000 })] },
      p2: {
        hand: [],
        monsters: [
          monsterCard('Soldat', { atk: 200, hp: 600 }),
          realCard('Caporal Gazouille'),
        ],
      },
    });
    engine.settle(game);

    expect(ai.chooseAction(game, 'p2', profile)).toEqual({
      type: 'change_mode',
      instanceId: monsterNamed(game, 'p2', 'Caporal Gazouille').instanceId,
      mode: 'guard',
    });
  });

  it('niveau 1 : une erreur volontaire reste un coup accepté', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p1: { monsters: [monsterCard('Cible', { atk: 300, hp: 400 })] },
      p2: {
        hand: [monsterCard('Recrue', { cost: 1 }), monsterCard('Soldat')],
        monsters: [monsterCard('Garde')],
      },
    });
    const clumsy = new AiPlayer(engine, () => 0);

    const action = clumsy.chooseAction(game, 'p2', {
      archetype: 'pipou',
      level: 1,
    });

    expect(engine.dispatch(game, 'p2', action).error).toBeUndefined();
  });

  describe('pannes du moteur', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    });
    afterEach(() => warn.mockRestore());

    it('simulations qui lèvent : un seul avertissement, repli end_phase', () => {
      const broken = {
        dispatch: () => {
          throw new Error('boom');
        },
      } as unknown as GameEngine;
      const game = scenario({
        turn: 'p2',
        phase: 'main',
        p2: { hand: [monsterCard('A'), monsterCard('B')] },
      });

      const action = new AiPlayer(broken, () => 0.99).chooseAction(
        game,
        'p2',
        profile,
      );

      expect(action).toEqual({ type: 'end_phase' });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });

    it('décision qui lève : avertissement et repli', () => {
      const game = scenario({ turn: 'p2', phase: 'main' });
      // Choix pour un joueur absent : la lecture de l'état lève
      game.pendingChoices.push({
        forUserId: 999,
        candidates: [],
        count: 1,
        prompt: '',
      });

      expect(ai.chooseAction(game, 'p2', profile)).toEqual({
        type: 'end_phase',
      });
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('un simple refus du moteur ne logge rien', () => {
      const game = scenario({ turn: 'p2', phase: 'battle' });
      ai.chooseAction(game, 'p2', profile);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('aiMustAct : mulligan non décidé, tour adverse, partie finie', () => {
    const game = scenario({ turn: 'p1', phase: 'main' });
    expect(aiMustAct(game, P2_ID)).toBe(false);
    game.currentTurnUserId = P2_ID;
    expect(aiMustAct(game, P2_ID)).toBe(true);
    game.phase = 'mulligan';
    game.player2.mulliganDone = false;
    expect(aiMustAct(game, P2_ID)).toBe(true);
    game.player2.mulliganDone = true;
    expect(aiMustAct(game, P2_ID)).toBe(false);
    game.phase = 'finished';
    expect(aiMustAct(game, P2_ID)).toBe(false);
  });
});
