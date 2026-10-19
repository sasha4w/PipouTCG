import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { effectiveAtk } from '../helpers/game-state.helper';
import { act, effect, equipmentCard, monsterCard } from '../testing/cards';
import type { GameState } from '../interfaces/game-state.interface';
import {
  attackWith,
  graveyardNames,
  instanceOf,
  monsterNamed,
  P1_ID,
  passTurn,
  scenario,
  type ScenarioSpec,
} from '../testing/scenario';

describe('GameEngine — combat', () => {
  const engine = createEngine();

  /** Monstre en Garde qui divise par 2 les dégâts reçus. */
  const rempart = () => ({
    card: monsterCard('Rempart', { atk: 0, hp: 900 }),
    mode: 'guard' as const,
    patch: { damageReduction: 2 },
  });

  it('ATK effective jamais négative : un malus excessif plafonne à 0', () => {
    const game = scenario({
      phase: 'battle',
      p1: {
        monsters: [
          {
            card: monsterCard('Virusé', { atk: 100, hp: 500 }),
            patch: { atkBuff: -300 },
          },
        ],
      },
      p2: { monsters: [monsterCard('Cible', { atk: 0, hp: 500 })] },
    });

    expect(effectiveAtk(monsterNamed(game, 'p1', 'Virusé'))).toBe(0);
    attackWith(engine, game, 'p1', 'Virusé', 'Cible');

    expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(500);
  });

  it('Perçant ignore la réduction de dégâts et rapporte une Prime sur une Garde', () => {
    const game = scenario({
      phase: 'battle',
      p1: {
        monsters: [
          {
            card: monsterCard('Delta', { atk: 1000, hp: 800 }),
            patch: { hasPiercing: true },
          },
        ],
      },
      p2: { monsters: [rempart()] },
    });

    attackWith(engine, game, 'p1', 'Delta', 'Rempart');

    expect(graveyardNames(game, 'p2')).toContain('Rempart');
    expect(game.player1.primes).toBe(5);
  });

  it("sans Perçant, la réduction de dégâts s'applique", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Brute', { atk: 1000, hp: 800 })] },
      p2: { monsters: [rempart()] },
    });

    attackWith(engine, game, 'p1', 'Brute', 'Rempart');

    expect(monsterNamed(game, 'p2', 'Rempart').currentHp).toBe(400);
    expect(game.player1.primes).toBe(6);
  });

  it("l'ATK du défenseur est lue après ON_DEFEND, bonus temporaire compris", () => {
    const herisson = monsterCard('Hérisson', {
      atk: 100,
      hp: 2000,
      effects: [
        effect(EffectTrigger.ON_DEFEND, [
          act(ActionType.BUFF_ATK_TEMP, EffectTarget.SELF, { value: 500 }),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Imprudent', { atk: 100, hp: 550 })] },
      p2: { monsters: [herisson] },
    });

    attackWith(engine, game, 'p1', 'Imprudent', 'Hérisson');

    expect(graveyardNames(game, 'p1')).toContain('Imprudent');
  });

  it("si ON_ATTACK détruit la cible, l'attaque se perd sans erreur", () => {
    const artilleur = monsterCard('Artilleur', {
      atk: 100,
      hp: 500,
      effects: [
        effect(EffectTrigger.ON_ATTACK, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
            value: 1000,
          }),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [artilleur] },
      p2: { monsters: [monsterCard('Lutin', { atk: 400, hp: 300 })] },
    });

    expect(attackWith(engine, game, 'p1', 'Artilleur', 'Lutin')).toEqual({});
    expect(graveyardNames(game, 'p2')).toContain('Lutin');
    expect(monsterNamed(game, 'p1', 'Artilleur').currentHp).toBe(500);
    expect(game.player1.primes).toBe(6);
  });
});

describe('GameEngine — désinfection d’un Zeta implanté', () => {
  const engine = createEngine();

  const zeta = () => ({
    card: monsterCard('Zeta', { atk: 300, hp: 1000 }),
    patch: { ownerUserId: P1_ID },
  });
  /** Zeta de p1 implanté chez p2, au tour de p2 en phase de combat. */
  const infected = (extra: ScenarioSpec = {}) =>
    scenario({
      phase: 'battle',
      turn: 'p2',
      turnNumber: 2,
      ...extra,
      p1: { ...extra.p1 },
      p2: {
        ...extra.p2,
        monsters: [
          monsterCard('Soigneur', { atk: 400, hp: 800 }),
          zeta(),
          ...(extra.p2?.monsters ?? []),
        ],
      },
    });
  const disinfect = (game: GameState, attacker = 'Soigneur') =>
    engine.dispatch(game, 'p2', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p2', attacker).instanceId,
      targetInstanceId: monsterNamed(game, 'p2', 'Zeta').instanceId,
    });

  it("p2 attaque le Zeta chez lui : dégâts d'ATK, pas de riposte, attaque consommée, ni Prime ni pioche", () => {
    const game = infected();
    const handBefore = game.player2.hand.length;

    expect(disinfect(game)).toEqual({});

    expect(monsterNamed(game, 'p2', 'Zeta').currentHp).toBe(600);
    expect(monsterNamed(game, 'p2', 'Soigneur').currentHp).toBe(800);
    expect(monsterNamed(game, 'p2', 'Soigneur').attacksUsedThisTurn).toBe(1);
    expect(game.player1.primes).toBe(6);
    expect(game.player2.primes).toBe(6);
    expect(game.player2.hand).toHaveLength(handBefore);
  });

  it('à 0 PV, le Zeta est détruit et rejoint le cimetière de son poseur', () => {
    const game = infected({
      p2: { monsters: [] },
    });
    monsterNamed(game, 'p2', 'Zeta').currentHp = 300;
    const handBefore = game.player2.hand.length;

    disinfect(game);

    expect(
      game.player2.monsterZones.some((m) => m?.card.baseCard.name === 'Zeta'),
    ).toBe(false);
    expect(graveyardNames(game, 'p1')).toEqual(['Zeta']);
    expect(graveyardNames(game, 'p2')).toEqual([]);
    expect(game.player1.primes).toBe(6);
    expect(game.player2.primes).toBe(6);
    expect(game.player2.hand).toHaveLength(handBefore);
  });

  it('les équipements du poseur suivent la carte au cimetière du poseur', () => {
    const game = infected();
    const z = monsterNamed(game, 'p2', 'Zeta');
    z.currentHp = 100;
    z.equipments = [instanceOf(equipmentCard('Lame', []), P1_ID)];

    disinfect(game);

    expect(graveyardNames(game, 'p1').sort()).toEqual(['Lame', 'Zeta']);
    expect(graveyardNames(game, 'p2')).toEqual([]);
  });

  it("la Provocation de p1 n'oblige pas à attaquer ailleurs", () => {
    const game = infected({
      p1: {
        monsters: [
          {
            card: monsterCard('Gardien', { atk: 0, hp: 500 }),
            patch: { hasTaunt: true },
          },
        ],
      },
    });

    expect(disinfect(game)).toEqual({});
    expect(monsterNamed(game, 'p2', 'Zeta').currentHp).toBe(600);
  });

  it('un monstre en Garde ne peut pas désinfecter', () => {
    const game = infected();
    monsterNamed(game, 'p2', 'Soigneur').mode = 'guard';

    expect(disinfect(game)).toEqual({ error: 'Monstre en mode Garde' });
    expect(monsterNamed(game, 'p2', 'Zeta').currentHp).toBe(1000);
  });

  it('p1 ne peut pas attaquer son propre Zeta', () => {
    const game = infected({
      turn: 'p1',
      turnNumber: 3,
      p1: { monsters: [monsterCard('Brute', { atk: 500, hp: 500 })] },
    });
    const brute = monsterNamed(game, 'p1', 'Brute');

    expect(
      engine.dispatch(game, 'p1', {
        type: 'attack',
        attackerInstanceId: brute.instanceId,
        targetInstanceId: monsterNamed(game, 'p2', 'Zeta').instanceId,
      }),
    ).toEqual({ error: 'Tu ne peux pas attaquer ton propre Zeta' });
    expect(brute.attacksUsedThisTurn).toBe(0);
  });

  describe('Firewall de Surcharge (SET_DISINFECT_IMMUNITY)', () => {
    const firewall = () =>
      equipmentCard('Firewall', [
        effect(
          EffectTrigger.ON_PLAY,
          [act(ActionType.SET_DISINFECT_IMMUNITY, EffectTarget.SELF)],
          { type: EffectConditionType.EQUIPPED_ON, value: 'Noyau Zeta' },
        ),
      ]);

    it("protège le Zeta jusqu'au début du prochain tour de son poseur", () => {
      const game = scenario({
        p1: { hand: [firewall()] },
        p2: {
          monsters: [
            monsterCard('Soigneur', { atk: 400, hp: 800 }),
            {
              card: monsterCard('Noyau Zeta', { atk: 300, hp: 1000 }),
              patch: { ownerUserId: P1_ID },
            },
          ],
        },
      });
      const zetaId = monsterNamed(game, 'p2', 'Noyau Zeta').instanceId;
      expect(
        engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          targetInstanceId: zetaId,
        }),
      ).toEqual({});
      expect(monsterNamed(game, 'p2', 'Noyau Zeta').disinfectImmune).toBe(true);

      const tryDisinfect = () =>
        engine.dispatch(game, 'p2', {
          type: 'attack',
          attackerInstanceId: monsterNamed(game, 'p2', 'Soigneur').instanceId,
          targetInstanceId: zetaId,
        });

      passTurn(engine, game);
      engine.dispatch(game, 'p2', { type: 'end_phase' });
      expect(tryDisinfect()).toEqual({
        error: "Noyau Zeta est protégé jusqu'au prochain tour de son poseur",
      });
      expect(monsterNamed(game, 'p2', 'Soigneur').attacksUsedThisTurn).toBe(0);

      passTurn(engine, game);
      expect(monsterNamed(game, 'p2', 'Noyau Zeta').disinfectImmune).toBe(
        false,
      );
      passTurn(engine, game);
      engine.dispatch(game, 'p2', { type: 'end_phase' });
      expect(tryDisinfect()).toEqual({});
      expect(monsterNamed(game, 'p2', 'Noyau Zeta').currentHp).toBe(600);
    });
  });
});
