import {
  ActionType,
  Archetype,
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
  passTurn,
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

  describe("refuse un Éphémère qui n'aurait aucun effet", () => {
    const ouilleAuRapport = () =>
      ephemeralCard('Ouille au rapport', [
        effect(ON_PLAY, [
          act(A.RETURN_FROM_GRAVEYARD, T.PLAYER, {
            value: 1,
            filter: { archetype: Archetype.PIPOU },
          }),
        ]),
      ]);

    it('récupération dans un cimetière sans carte éligible', () => {
      const game = scenario({
        p1: {
          hand: [ouilleAuRapport()],
          graveyard: [
            monsterCard('Dragon mort', { archetype: Archetype.DRAGON }),
          ],
        },
      });

      expect(play(game, 'p1').error).toBe(
        "Cette carte n'aurait aucun effet pour l'instant",
      );
      expect(handNames(game, 'p1')).toEqual(['Ouille au rapport']);
    });

    it('la même carte se joue dès qu’une carte est éligible', () => {
      const game = scenario({
        p1: {
          hand: [ouilleAuRapport()],
          graveyard: [
            monsterCard('Pipou mort', { archetype: Archetype.PIPOU }),
          ],
        },
      });

      expect(play(game, 'p1')).toEqual({});
      expect(game.pendingChoices).toHaveLength(1);
    });

    it('bonus à tous les alliés sans aucun allié', () => {
      const overclock = ephemeralCard('Overclock', [
        effect(ON_PLAY, [act(A.BUFF_ATK_TEMP, T.ALL_ALLIES, { value: 500 })]),
      ]);
      const game = scenario({ p1: { hand: [overclock] } });

      expect(play(game, 'p1').error).toBe(
        "Cette carte n'aurait aucun effet pour l'instant",
      );
    });

    it('pioche avec un deck vide', () => {
      const pioche = ephemeralCard('Pioche', [
        effect(ON_PLAY, [act(A.DRAW, T.PLAYER)]),
      ]);
      const game = scenario({ p1: { hand: [pioche], deck: [] } });

      expect(play(game, 'p1').error).toBe(
        "Cette carte n'aurait aucun effet pour l'instant",
      );
    });
  });
});

describe('GameEngine — DuplicateX (DUPLICATE_MONSTER)', () => {
  const engine = createEngine();
  const duplicateX = () =>
    ephemeralCard('DuplicateX', [
      effect(ON_PLAY, [act(A.DUPLICATE_MONSTER, T.TARGET_ALLY, { value: 2 })]),
    ]);
  const play = (game: GameState, target: MonsterOnBoard) =>
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: target.instanceId,
    });

  it('copie un allié abîmé et équipé : monstre token bloqué 2 tours', () => {
    const game = scenario({
      p1: {
        hand: [duplicateX()],
        monsters: [
          {
            card: monsterCard('Drakon', { hp: 1800 }),
            currentHp: 1200,
            equipments: [equipmentCard('Casque', [])],
          },
        ],
      },
    });

    expect(play(game, monsterNamed(game, 'p1', 'Drakon'))).toEqual({});

    const copie = game.player1.monsterZones[1]!;
    expect(copie.card.baseCard.name).toBe('Drakon');
    expect(copie.currentHp).toBe(1200);
    expect(copie.card.token).toBe(true);
    expect(copie.equipments).toHaveLength(1);
    expect(copie.equipments[0].token).toBe(true);
    expect(copie.equipments[0].baseCard.name).toBe('Casque');
    expect(copie.blockAttackTurns).toBe(2);
    expect(game.pendingEvents).toContainEqual(
      expect.objectContaining({ kind: 'monster_summoned', zoneIndex: 1 }),
    );
    // l'original reste intact
    expect(game.player1.monsterZones[0]!.card.token).toBeUndefined();
    expect(game.player1.monsterZones[0]!.equipments[0].token).toBeUndefined();
  });

  it('déclenche le ON_SUMMON de la copie', () => {
    const game = scenario({
      p1: {
        hand: [duplicateX()],
        monsters: [
          monsterCard('Gardien', {
            effects: [
              effect(EffectTrigger.ON_SUMMON, [act(A.SET_TAUNT, T.SELF)]),
            ],
          }),
        ],
      },
    });
    const original = monsterNamed(game, 'p1', 'Gardien');

    play(game, original);

    expect(game.player1.monsterZones[1]!.hasTaunt).toBe(true);
    expect(original.hasTaunt).toBe(false);
  });

  it('la copie ne peut pas attaquer le tour de pose ni le tour suivant, puis le peut', () => {
    const game = scenario({
      p1: { hand: [duplicateX()], monsters: [monsterCard('Drakon')] },
      p2: { monsters: [monsterCard('Cible', { hp: 9000 })] },
    });
    play(game, monsterNamed(game, 'p1', 'Drakon'));
    const copie = game.player1.monsterZones[1]!;
    const attack = () =>
      engine.dispatch(game, 'p1', {
        type: 'attack',
        attackerInstanceId: copie.instanceId,
        targetInstanceId: monsterNamed(game, 'p2', 'Cible').instanceId,
      });

    game.phase = 'battle';
    expect(attack().error).toBeDefined();
    passTurn(engine, game); // fin du tour de pose
    passTurn(engine, game); // tour adverse
    game.phase = 'battle';
    expect(attack().error).toBeDefined(); // tour suivant du propriétaire
    passTurn(engine, game);
    passTurn(engine, game);
    game.phase = 'battle';
    expect(attack()).toEqual({});
  });

  it('est injouable sans case libre', () => {
    const game = scenario({
      p1: {
        hand: [duplicateX()],
        monsters: [monsterCard('A'), monsterCard('B'), monsterCard('C')],
      },
    });

    expect(play(game, monsterNamed(game, 'p1', 'A')).error).toBe(
      "Cette carte n'aurait aucun effet pour l'instant",
    );
    expect(handNames(game, 'p1')).toEqual(['DuplicateX']);
  });

  it("détruire la copie rapporte une Prime à l'adversaire, cimetière inchangé", () => {
    const game = scenario({
      p1: {
        hand: [duplicateX()],
        monsters: [monsterCard('Drakon', { hp: 300 })],
      },
      p2: { monsters: [monsterCard('Ogre', { atk: 900 })] },
    });
    play(game, monsterNamed(game, 'p1', 'Drakon'));
    const copie = game.player1.monsterZones[1]!;
    const graveyardBefore = graveyardNames(game, 'p1');
    passTurn(engine, game);
    game.phase = 'battle';

    const res = engine.dispatch(game, 'p2', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p2', 'Ogre').instanceId,
      targetInstanceId: copie.instanceId,
    });

    expect(res.error).toBeUndefined();
    expect(game.player1.monsterZones[1]).toBeNull();
    expect(game.player2.primes).toBe(5);
    expect(graveyardNames(game, 'p1')).toEqual(graveyardBefore);
  });
});
