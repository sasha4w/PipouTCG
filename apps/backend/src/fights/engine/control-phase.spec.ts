import {
  ActionType,
  EffectTarget,
  EffectTrigger,
  HAND_LIMIT,
} from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  fillerCard,
  monsterCard,
  persistentCard,
} from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  graveyardNames,
  handNames,
  monsterNamed,
  P2_ID,
  scenario,
  seatState,
} from '../testing/scenario';

const engine = createEngine();
const CONTROL_ERROR = 'Invocation normale interdite en phase de contrôle';

const pipou = (n: string) => monsterCard(n, { archetype: 'pipou' });
const adulte = (element: 'fire' | 'water' | 'earth' | 'wind') =>
  monsterCard(`Adulte ${element}`, {
    archetype: 'dragon',
    stage: 'adult',
    element,
  });

describe('phase de contrôle', () => {
  it('play_support : un support simple se pose', () => {
    const game = scenario({
      phase: 'end',
      p1: { hand: [persistentCard('Aura', [])] },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        zoneIndex: 0,
      }).error,
    ).toBeUndefined();
    expect(
      seatState(game, 'p1').supportZones.some(
        (c) => c?.baseCard.name === 'Aura',
      ),
    ).toBe(true);
  });

  it('evolve : un Bébé Drakon posé évolue', () => {
    const bebe = monsterCard('Bébé Feros', {
      archetype: 'dragon',
      stage: 'baby',
      lineage: 'feros',
      element: 'fire',
      cost: 1,
    });
    const jeune = monsterCard('Jeune Feros', {
      archetype: 'dragon',
      stage: 'young',
      lineage: 'feros',
      element: 'fire',
      cost: 2,
    });
    const game = scenario({
      phase: 'end',
      p1: { hand: [jeune], recycleEnergy: 1, monsters: [bebe] },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Bébé Feros').instanceId,
        paymentHandIndices: [],
      }).error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Jeune Feros')).toBeDefined();
  });

  const relevAction = (game: GameState, ids = ['A', 'B']) => ({
    type: 'summon' as const,
    handIndex: 0,
    zoneIndex: 0,
    paymentHandIndices: [],
    releveInstanceIds: ids.map((n) => monsterNamed(game, 'p1', n).instanceId),
  });

  it('summon avec Relève valide', () => {
    const game = scenario({
      phase: 'end',
      p1: {
        hand: [realCard('Général Chatouille')],
        monsters: [pipou('A'), pipou('B'), pipou('C')],
      },
    });
    expect(
      engine.dispatch(game, 'p1', relevAction(game)).error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Général Chatouille')).toBeDefined();
  });

  it('summon du Drakon des Origines avec les 4 éléments au cimetière', () => {
    const game = scenario({
      phase: 'end',
      p1: {
        hand: [realCard('Drakon des Origines')],
        recycleEnergy: 10,
        graveyard: [
          adulte('fire'),
          adulte('water'),
          adulte('earth'),
          adulte('wind'),
        ],
      },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 0,
        paymentHandIndices: [],
      }).error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Drakon des Origines')).toBeDefined();
  });

  describe('invocation normale interdite', () => {
    const normal = {
      type: 'summon' as const,
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    };
    const mk = () =>
      scenario({
        phase: 'end',
        p1: { hand: [monsterCard('Simple', { cost: 0 })], recycleEnergy: 3 },
      });

    it('sans Relève', () => {
      const game = mk();
      expect(engine.dispatch(game, 'p1', normal).error).toBe(CONTROL_ERROR);
      expect(handNames(game, 'p1')).toEqual(['Simple']);
    });

    it('avec releveInstanceIds vide', () => {
      const game = mk();
      expect(
        engine.dispatch(game, 'p1', { ...normal, releveInstanceIds: [] }).error,
      ).toBe(CONTROL_ERROR);
    });

    it('carte en invocation gratuite', () => {
      const game = mk();
      const p1 = seatState(game, 'p1');
      p1.freeSummonInstanceIds = [p1.hand[0].instanceId];
      expect(engine.dispatch(game, 'p1', normal).error).toBe(CONTROL_ERROR);
    });
  });

  describe('autres actions interdites', () => {
    it.each([
      ['recycle', { type: 'recycle', handIndex: 0 }],
      ['transform', { type: 'transform', handIndex: 0 }],
    ] as const)('%s', (_n, action) => {
      const game = scenario({
        phase: 'end',
        p1: { hand: [monsterCard('Simple')] },
      });
      expect(engine.dispatch(game, 'p1', action).error).toBeDefined();
      expect(handNames(game, 'p1')).toEqual(['Simple']);
      expect(graveyardNames(game, 'p1')).toEqual([]);
    });

    it('change_mode', () => {
      const game = scenario({
        phase: 'end',
        p1: { monsters: [monsterCard('Soldat')] },
      });
      const soldat = monsterNamed(game, 'p1', 'Soldat');
      const before = soldat.mode;
      expect(
        engine.dispatch(game, 'p1', {
          type: 'change_mode',
          instanceId: soldat.instanceId,
          mode: 'guard',
        } as never).error,
      ).toBeDefined();
      expect(soldat.mode).toBe(before);
    });
  });

  it('main à HAND_LIMIT + 1 : la Relève ramène à la limite, end_phase passe', () => {
    const filler = Array.from({ length: HAND_LIMIT }, () => fillerCard());
    const game = scenario({
      phase: 'end',
      p1: {
        hand: [realCard('Général Chatouille'), ...filler],
        monsters: [pipou('A'), pipou('B'), pipou('C')],
      },
    });
    expect(seatState(game, 'p1').hand).toHaveLength(HAND_LIMIT + 1);
    expect(
      engine.dispatch(game, 'p1', { type: 'end_phase' }).error,
    ).toBeDefined();
    expect(
      engine.dispatch(game, 'p1', relevAction(game)).error,
    ).toBeUndefined();
    expect(seatState(game, 'p1').hand).toHaveLength(HAND_LIMIT);
    expect(
      engine.dispatch(game, 'p1', { type: 'end_phase' }).error,
    ).toBeUndefined();
  });

  it('timeout après un support à choix : choix résolu d’office, tour à l’adversaire', () => {
    const cherche = ephemeralCard('Cherche', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.SEARCH_DECK, EffectTarget.PLAYER, {
          filter: { stage: 'young' },
        }),
      ]),
    ]);
    const game = scenario({
      phase: 'end',
      p1: {
        hand: [cherche],
        deck: [monsterCard('Jeune A', { archetype: 'dragon', stage: 'young' })],
      },
    });
    expect(
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 }).error,
    ).toBeUndefined();
    expect(game.pendingChoices).toHaveLength(1);
    engine.timeout(game);
    expect(game.pendingChoices).toHaveLength(0);
    expect(game.currentTurnUserId).toBe(P2_ID);
  });
});
