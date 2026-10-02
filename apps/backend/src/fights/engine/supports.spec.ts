import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import type { Seat } from '@pipou/shared';
import type {
  GameState,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  equipmentCard,
  monsterCard,
} from '../testing/cards';
import {
  graveyardNames,
  handNames,
  monsterNamed,
  scenario,
} from '../testing/scenario';

const { ON_PLAY } = EffectTrigger;
const T = EffectTarget;
const A = ActionType;

const forceDelta = () =>
  ephemeralCard('Force Delta', [
    effect(ON_PLAY, [act(A.DESTROY_MONSTER, T.ENEMY_MONSTER)]),
  ]);
const soinUrgence = () =>
  ephemeralCard("Soin d'urgence", [
    effect(ON_PLAY, [act(A.HEAL, T.TARGET_ALLY, { value: 600 })]),
    effect(ON_PLAY, [act(A.HEAL, T.TARGET_ALLY, { value: 200 })], {
      type: EffectConditionType.SPECIFIC_CARD_ON_BOARD,
      value: 'Médecin Citrouille',
    }),
  ]);
const formatage = () =>
  ephemeralCard('Formatage', [
    effect(ON_PLAY, [act(A.DESTROY_MONSTER, T.TARGET_ALLY)]),
  ]);
const recyclage = () =>
  ephemeralCard('Recyclage', [
    effect(ON_PLAY, [
      act(A.DESTROY_MONSTER, T.TARGET_ALLY),
      act(A.DRAW, T.PLAYER),
    ]),
  ]);
const migration = () =>
  ephemeralCard('Migration', [
    effect(ON_PLAY, [act(A.RETURN_TO_HAND, T.TARGET_ALLY)]),
  ]);
const gel = () =>
  ephemeralCard('Gel', [
    effect(ON_PLAY, [act(A.BLOCK_ATTACK, T.ENEMY_MONSTER, { value: 3 })]),
  ]);
const verrou = () =>
  ephemeralCard('Verrou', [
    effect(ON_PLAY, [act(A.FORCE_GUARD_LOCK_ENEMY, T.ENEMY_MONSTER)]),
  ]);

describe('GameEngine — supports Éphémères ciblés', () => {
  const engine = createEngine();
  const play = (game: GameState, seat: Seat, target?: MonsterOnBoard) =>
    engine.dispatch(game, seat, {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: target?.instanceId,
    });

  it('Force Delta détruit le monstre adverse choisi et la victime pioche', () => {
    const game = scenario({
      p1: { hand: [forceDelta()] },
      p2: {
        monsters: [monsterCard('Lutin'), monsterCard('Golem')],
        deck: [monsterCard('A')],
      },
    });

    expect(play(game, 'p1', monsterNamed(game, 'p2', 'Golem'))).toEqual({});

    expect(graveyardNames(game, 'p2')).toEqual(['Golem']);
    expect(monsterNamed(game, 'p2', 'Lutin')).toBeDefined();
    expect(handNames(game, 'p2')).toEqual(['A']);
  });

  it('refuse une carte ciblée sans cible ou avec une cible du mauvais camp', () => {
    const game = scenario({
      p1: { hand: [forceDelta()], monsters: [monsterCard('Allié')] },
      p2: { monsters: [monsterCard('Lutin')] },
    });

    expect(play(game, 'p1').error).toBe(
      'Choisis un monstre adverse comme cible',
    );
    expect(play(game, 'p1', monsterNamed(game, 'p1', 'Allié')).error).toBe(
      'Choisis un monstre adverse comme cible',
    );
    expect(handNames(game, 'p1')).toEqual(['Force Delta']);
  });

  it("refuse une carte ciblée quand aucune cible n'existe", () => {
    const game = scenario({ p1: { hand: [forceDelta()] } });

    expect(play(game, 'p1').error).toBe('Aucune cible valide pour cette carte');
  });

  it("Soin d'urgence soigne l'allié choisi, davantage avec Médecin Citrouille", () => {
    const blesse = () => ({
      card: monsterCard('Blessé', { hp: 1000 }),
      currentHp: 100,
    });
    const seul = scenario({
      p1: { hand: [soinUrgence()], monsters: [blesse()] },
    });
    const avecMedecin = scenario({
      p1: {
        hand: [soinUrgence()],
        monsters: [blesse(), monsterCard('Médecin Citrouille', { hp: 1800 })],
      },
    });

    play(seul, 'p1', monsterNamed(seul, 'p1', 'Blessé'));
    play(avecMedecin, 'p1', monsterNamed(avecMedecin, 'p1', 'Blessé'));

    expect(monsterNamed(seul, 'p1', 'Blessé').currentHp).toBe(700);
    expect(monsterNamed(avecMedecin, 'p1', 'Blessé').currentHp).toBe(900);
  });

  it('Formatage détruit son propre monstre sans pioche', () => {
    const game = scenario({
      p1: { hand: [formatage()], monsters: [monsterCard('Pion')] },
    });

    play(game, 'p1', monsterNamed(game, 'p1', 'Pion'));

    expect(graveyardNames(game, 'p1')).toEqual(['Formatage', 'Pion']);
    expect(handNames(game, 'p1')).toEqual([]);
  });

  it('Recyclage détruit son propre monstre et pioche exactement une carte', () => {
    const game = scenario({
      p1: {
        hand: [recyclage()],
        monsters: [monsterCard('Pion')],
        deck: [monsterCard('A'), monsterCard('B')],
      },
    });

    play(game, 'p1', monsterNamed(game, 'p1', 'Pion'));

    expect(handNames(game, 'p1')).toEqual(['A']);
  });

  it('Migration renvoie le monstre et ses équipements en main', () => {
    const game = scenario({
      p1: {
        hand: [migration()],
        monsters: [
          {
            card: monsterCard('Pion'),
            equipments: [equipmentCard('Casque', [])],
          },
        ],
      },
    });

    play(game, 'p1', monsterNamed(game, 'p1', 'Pion'));

    expect(handNames(game, 'p1')).toEqual(['Casque', 'Pion']);
    expect(game.player1.monsterZones[0]).toBeNull();
  });

  it('Gel et Verrou agissent sur le monstre adverse choisi', () => {
    const game = scenario({
      p1: { hand: [gel(), verrou()] },
      p2: { monsters: [monsterCard('Lutin'), monsterCard('Golem')] },
    });

    play(game, 'p1', monsterNamed(game, 'p2', 'Golem'));
    play(game, 'p1', monsterNamed(game, 'p2', 'Lutin'));

    expect(monsterNamed(game, 'p2', 'Golem').blockAttackTurns).toBe(3);
    expect(monsterNamed(game, 'p2', 'Lutin')).toMatchObject({
      guardLocked: true,
      mode: 'guard',
    });
  });

  it("refuse un Éphémère dont aucun effet ON_PLAY n'a sa condition remplie", () => {
    const exigeant = ephemeralCard('Exigeant', [
      effect(ON_PLAY, [act(A.DRAW, T.PLAYER)], {
        type: EffectConditionType.HAND_SIZE_MIN,
        value: 5,
      }),
    ]);
    const game = scenario({ p1: { hand: [exigeant] } });

    expect(play(game, 'p1').error).toBe(
      'Condition non remplie pour jouer cette carte',
    );
  });
});
