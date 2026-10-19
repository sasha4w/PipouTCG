import { Logger } from '@nestjs/common';
import { HAND_LIMIT } from '@pipou/shared';
import type { GameAction } from '@pipou/shared';
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
import { listCandidates } from './candidate-actions';
import { evaluate } from './evaluate';
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

describe('IA et Zeta implanté', () => {
  const zeta = () => realCard('Noyau Zeta');
  /** Zeta de p1 implanté chez p2. */
  const implanted = () => ({
    card: zeta(),
    patch: { ownerUserId: P1_ID, turnCounter: 3 },
  });
  const attacks = (actions: GameAction[]) =>
    actions.filter((a) => a.type === 'attack');

  it('hôte : désinfecte le Zeta, sans jamais jouer avec', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'battle',
      p1: { monsters: [monsterCard('Cible')] },
      p2: { monsters: [implanted(), monsterCard('Hôte', { atk: 400 })] },
    });
    const zetaId = monsterNamed(game, 'p2', 'Noyau Zeta').instanceId;
    const hostId = monsterNamed(game, 'p2', 'Hôte').instanceId;

    const list = attacks(listCandidates(game, 'p2'));

    expect(list).toContainEqual({
      type: 'attack',
      attackerInstanceId: hostId,
      targetInstanceId: zetaId,
    });
    expect(
      list.some((a) => a.type === 'attack' && a.attackerInstanceId === zetaId),
    ).toBe(false);
  });

  it('hôte : ni changement de mode ni équipement sur le Zeta', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p2: {
        hand: [
          realCard('Firewall .sys'),
          realCard('Processeur de Calcul .bin'),
        ],
        monsters: [implanted(), monsterCard('Hôte')],
      },
    });
    const zetaId = monsterNamed(game, 'p2', 'Noyau Zeta').instanceId;

    for (const a of listCandidates(game, 'p2')) {
      if (a.type === 'change_mode') expect(a.instanceId).not.toBe(zetaId);
      if (a.type === 'play_support')
        expect(a.targetInstanceId).not.toBe(zetaId);
    }
  });

  it('poseur : équipe son Zeta chez l’adversaire, sans l’attaquer', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { hand: [realCard('Firewall .sys')], monsters: [monsterCard('A')] },
      p2: { monsters: [implanted(), monsterCard('Hôte')] },
    });
    const zetaId = monsterNamed(game, 'p2', 'Noyau Zeta').instanceId;

    expect(listCandidates(game, 'p1')).toContainEqual({
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: zetaId,
    });

    game.phase = 'battle';
    expect(
      attacks(listCandidates(game, 'p1')).some(
        (a) => a.type === 'attack' && a.targetInstanceId === zetaId,
      ),
    ).toBe(false);
  });

  it('poseur : le Zeta ne bloque pas l’attaque directe', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'battle',
      p1: { monsters: [monsterCard('A')] },
      p2: { monsters: [implanted()] },
    });

    expect(attacks(listCandidates(game, 'p1'))).toEqual([
      {
        type: 'attack',
        attackerInstanceId: monsterNamed(game, 'p1', 'A').instanceId,
        direct: true,
      },
    ]);
  });

  it('poseur : pas de second Zeta chez l’adversaire', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { hand: [zeta()] },
      p2: { monsters: [implanted()] },
    });
    const isEnemySide = (a: GameAction) =>
      a.type === 'summon' && a.onOpponentSide;
    expect(listCandidates(game, 'p1').filter(isEnemySide)).toEqual([]);

    const libre = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { hand: [zeta()], recycleEnergy: 5 },
    });
    expect(listCandidates(libre, 'p1').some(isEnemySide)).toBe(true);
  });

  it('evaluate : le Zeta implanté ne compte pas dans le plateau de l’hôte', () => {
    const seul = scenario({
      turn: 'p2',
      p2: { monsters: [monsterCard('Hôte')] },
    });
    const avecZeta = scenario({
      turn: 'p2',
      p2: { monsters: [monsterCard('Hôte'), implanted()] },
    });
    // Le Zeta ne rapporte rien à l'hôte (au mieux il lui coûte la Prime promise)
    expect(evaluate(avecZeta, 'p2', 'pipou')).toBeLessThan(
      evaluate(seul, 'p2', 'pipou'),
    );
  });

  it('evaluate : l’hôte préfère le Zeta désinfecté au Zeta qui sévit', () => {
    const hosts = () => [
      monsterCard('Hôte A', { atk: 600 }),
      monsterCard('Hôte B', { atk: 600 }),
    ];
    const virus = scenario({
      turn: 'p2',
      p2: { monsters: [implanted(), ...hosts()] },
    });
    const propre = scenario({ turn: 'p2', p2: { monsters: hosts() } });

    expect(evaluate(propre, 'p2', 'pixelman')).toBeGreaterThan(
      evaluate(virus, 'p2', 'pixelman'),
    );
    // Et pour le poseur, c'est l'inverse
    expect(evaluate(virus, 'p1', 'pixelman')).toBeGreaterThan(
      evaluate(propre, 'p1', 'pixelman'),
    );
  });
});

describe('IA Drakon : évolution immédiate', () => {
  it('Bébé éclos + Jeune en main + coût payable : évolue ce tour', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p2: {
        hand: [realCard('Jeune Feros')],
        recycleEnergy: 5,
        monsters: [
          {
            card: realCard('Bébé Feros'),
            summonedThisTurn: true,
            patch: { canEvolveThisTurn: true },
          },
        ],
      },
    });

    const action = ai.chooseAction(game, 'p2', {
      archetype: 'dragon',
      level: 3,
    });

    expect(action).toMatchObject({
      type: 'evolve',
      targetInstanceId: monsterNamed(game, 'p2', 'Bébé Feros').instanceId,
    });
    expect(engine.dispatch(game, 'p2', action).error).toBeUndefined();
  });
});

describe('IA : choisit les nouvelles cartes', () => {
  const lvl3 = (archetype: 'dragon' | 'pixelman'): AiProfile => ({
    archetype,
    level: 3,
  });

  it('Drakon : pose Mont Drakon sur une zone terrain libre', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p2: {
        hand: [realCard('Mont Drakon')],
        graveyard: [realCard('Bébé Feros')],
        monsters: [realCard('Bébé Teros')],
      },
    });

    expect(ai.chooseAction(game, 'p2', lvl3('dragon'))).toEqual({
      type: 'play_support',
      handIndex: 0,
      zoneIndex: 0,
    });
  });

  it('Pixelman : Mise à jour .patch quand le compteur du Zeta tombe à 1', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p1: {
        monsters: [
          {
            card: realCard('Noyau Zeta'),
            patch: { ownerUserId: P2_ID, turnCounter: 1 },
          },
        ],
      },
      p2: {
        hand: [realCard('Mise à jour .patch')],
        monsters: [monsterCard('Garde')],
      },
    });

    expect(ai.chooseAction(game, 'p2', lvl3('pixelman'))).toEqual({
      type: 'play_support',
      handIndex: 0,
    });
  });

  it('Pixelman : DuplicateX sur son allié le plus fort avec une zone libre', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'main',
      p2: {
        hand: [realCard('DuplicateX')],
        monsters: [
          monsterCard('Faible', { atk: 100, hp: 200 }),
          monsterCard('Fort', { atk: 900, hp: 1500 }),
        ],
      },
    });

    expect(ai.chooseAction(game, 'p2', lvl3('pixelman'))).toEqual({
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p2', 'Fort').instanceId,
    });
  });
});
