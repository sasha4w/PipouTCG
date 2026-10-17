import {
  ActionType,
  DestroyCause,
  EffectTarget,
  EffectTrigger,
  Rarity,
} from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  monsterCard,
  terrainCard,
} from '../testing/cards';
import {
  attackWith,
  monsterNamed,
  P1_ID,
  P2_ID,
  scenario,
} from '../testing/scenario';

const destroyed = (game: GameState) =>
  game.pendingEvents.filter((e) => e.kind === 'monster_destroyed');

describe('GameEngine — événements de duel', () => {
  const engine = createEngine();

  it('combat : COMBAT sur la zone de la victime', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: { monsters: [null, monsterCard('Lutin', { atk: 0, hp: 300 })] },
    });
    const lutinId = monsterNamed(game, 'p2', 'Lutin').instanceId;

    attackWith(engine, game, 'p1', 'Ogre', 'Lutin');

    expect(destroyed(game)).toEqual([
      {
        kind: 'monster_destroyed',
        ownerId: P2_ID,
        zoneIndex: 1,
        instanceId: lutinId,
        cause: DestroyCause.COMBAT,
      },
    ]);
  });

  it("destruction par l'effet adverse : EFFECT", () => {
    const foudre = ephemeralCard('Foudre', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ENEMIES),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [foudre] },
      p2: { monsters: [monsterCard('Lutin')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 0, cause: DestroyCause.EFFECT },
    ]);
  });

  it('destruction de son propre monstre par son effet : SACRIFICE', () => {
    const sacrifice = ephemeralCard('Sacrifice', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ALLIES),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [sacrifice], monsters: [monsterCard('Pion')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P1_ID, zoneIndex: 0, cause: DestroyCause.SACRIFICE },
    ]);
  });

  it('dégâts mortels d’un effet : EFFECT (destruction immédiate par l’applier)', () => {
    const meteore = ephemeralCard('Météore', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 1000 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [meteore] },
      p2: { monsters: [monsterCard('Lutin')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 0, cause: DestroyCause.EFFECT },
    ]);
  });

  it('monstre à 0 PV ramassé par le moteur (perte de bonus) : HP_DEPLETED', () => {
    const game = scenario({
      p2: {
        monsters: [null, { card: monsterCard('Affaibli'), currentHp: 0 }],
      },
    });

    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 1, cause: DestroyCause.HP_DEPLETED },
    ]);
  });

  it('compteur de tour expiré : SELF_DESTRUCT sur la zone de l’hôte', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p2: {
        monsters: [
          {
            card: monsterCard('Virus', { atk: 0, hp: 400 }),
            patch: { turnCounter: 1, ownerUserId: P1_ID },
          },
        ],
      },
    });

    engine.dispatch(game, 'p2', { type: 'end_phase' });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 0, cause: DestroyCause.SELF_DESTRUCT },
    ]);
  });

  it('mort en chaîne via ON_DEATH : événements dans l’ordre de résolution', () => {
    const kamikaze = monsterCard('Kamikaze', {
      atk: 0,
      hp: 300,
      effects: [
        effect(EffectTrigger.ON_DEATH, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ENEMIES),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: { monsters: [kamikaze] },
    });

    attackWith(engine, game, 'p1', 'Ogre', 'Kamikaze');

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, cause: DestroyCause.COMBAT },
      { ownerId: P1_ID, cause: DestroyCause.EFFECT },
    ]);
  });

  it('invocation : monster_summoned avec la rareté, côté de la zone occupée', () => {
    const dragon = monsterCard('Dragon', { rarity: Rarity.LEGENDARY });
    const game = scenario({ p1: { hand: [dragon] } });

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 2,
      paymentHandIndices: [],
    });

    expect(game.pendingEvents).toEqual([
      {
        kind: 'monster_summoned',
        ownerId: P1_ID,
        zoneIndex: 2,
        instanceId: monsterNamed(game, 'p1', 'Dragon').instanceId,
        rarity: Rarity.LEGENDARY,
      },
    ]);
  });

  it('invocation sur le terrain adverse (Zeta) : ownerId = joueur de la zone', () => {
    const zeta = monsterCard('Zeta', {
      effects: [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.SUMMONABLE_ON_ENEMY_SIDE, EffectTarget.SELF),
        ]),
      ],
    });
    const game = scenario({ p1: { hand: [zeta] } });

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 1,
      paymentHandIndices: [],
      onOpponentSide: true,
    });

    expect(game.pendingEvents).toMatchObject([
      { kind: 'monster_summoned', ownerId: P2_ID, zoneIndex: 1 },
    ]);
  });

  it('pose de terrains : terrain_played et placedSeq croissant', () => {
    const game = scenario({
      p1: { hand: [terrainCard('Forêt', []), terrainCard('Volcan', [])] },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      zoneIndex: 2,
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      zoneIndex: 0,
    });

    const [volcan, , foret] = game.player1.supportZones;
    expect(foret?.placedSeq).toBe(1);
    expect(volcan?.placedSeq).toBe(2);
    expect(game.pendingEvents).toEqual([
      {
        kind: 'terrain_played',
        ownerId: P1_ID,
        zoneIndex: 2,
        instanceId: foret?.instanceId,
      },
      {
        kind: 'terrain_played',
        ownerId: P1_ID,
        zoneIndex: 0,
        instanceId: volcan?.instanceId,
      },
    ]);
  });
});
