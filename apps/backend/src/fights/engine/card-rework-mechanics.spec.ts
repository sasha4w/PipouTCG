import {
  ActionType,
  DrakonStage,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { conditionMet } from '../effects/effect-conditions';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  equipmentCard,
  monsterCard,
  terrainCard,
} from '../testing/cards';
import {
  attackWith,
  graveyardNames,
  monsterNamed,
  P1_ID,
  passTurn,
  scenario,
} from '../testing/scenario';
import type { ScenarioSpec } from '../testing/scenario';
import type { GameState } from '../interfaces/game-state.interface';

describe('mécaniques du retravail des cartes', () => {
  const engine = createEngine();

  describe('valueIf (quantité conditionnelle)', () => {
    const rappel = () =>
      ephemeralCard('Rappel', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.RETURN_FROM_GRAVEYARD, EffectTarget.PLAYER, {
            value: 2,
            valueIf: {
              condition: {
                type: 'SPECIFIC_CARD_ON_BOARD',
                value: 'Capitaine',
                match: 'contains',
              },
              value: 3,
            },
          }),
        ]),
      ]);
    const graveyard = ['A', 'B', 'C', 'D'].map((n) => monsterCard(n));

    it('condition fausse : la valeur de base', () => {
      const game = scenario({ p1: { hand: [rappel()], graveyard } });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.pendingChoices[0].count).toBe(2);
    });

    it('condition vraie : la valeur conditionnelle', () => {
      const game = scenario({
        p1: {
          hand: [rappel()],
          graveyard,
          monsters: [monsterCard('Vice Capitaine Patouille')],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.pendingChoices[0].count).toBe(3);
    });
  });

  describe('immunité aux effets adverses (SET_DEBUFF_IMMUNITY)', () => {
    const IMMUNE = {
      perm: {
        atk: 0,
        hp: 0,
        taunt: false,
        piercing: false,
        debuffImmune: true,
        attacksPerTurn: 1,
      },
      isImmuneToDebuffs: true,
    };
    const magouille = () => ({
      card: monsterCard('Magouille', { atk: 0, hp: 2000 }),
      patch: IMMUNE,
    });
    const destruction = () =>
      ephemeralCard('Destruction', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER),
        ]),
      ]);

    it('un Éphémère ciblé ne peut pas le choisir', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: { monsters: [magouille(), monsterCard('Lutin')] },
      });
      const result = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Magouille').instanceId,
      });
      expect(result.error).toBe(
        'Ce monstre est insensible aux effets adverses',
      );
    });

    it('seul monstre adverse : la carte ciblée est injouable', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: { monsters: [magouille()] },
      });
      const result = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Magouille').instanceId,
      });
      expect(result.error).toBe('Aucune cible valide pour cette carte');
    });

    it('les effets de zone adverses l’épargnent', () => {
      const meteore = ephemeralCard('Météore', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 300 }),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [meteore] },
        p2: { monsters: [magouille(), monsterCard('Lutin', { hp: 500 })] },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(game, 'p2', 'Magouille').currentHp).toBe(2000);
      expect(monsterNamed(game, 'p2', 'Lutin').currentHp).toBe(200);
    });

    it('le combat le blesse normalement', () => {
      const game = scenario({
        phase: 'battle',
        p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 3000 })] },
        p2: { monsters: [magouille()] },
      });
      attackWith(engine, game, 'p1', 'Ogre', 'Magouille');
      expect(monsterNamed(game, 'p2', 'Magouille').currentHp).toBe(1400);
    });

    it('les effets de son propre camp s’appliquent', () => {
      const soin = ephemeralCard('Soin', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.HEAL, EffectTarget.TARGET_ALLY, { value: 500 }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [soin],
          monsters: [{ ...magouille(), currentHp: 1000 }],
        },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Magouille').instanceId,
      });
      expect(monsterNamed(game, 'p1', 'Magouille').currentHp).toBe(1500);
    });
  });

  describe('SET_COMBAT_IMMUNITY', () => {
    const pareFeu = () =>
      equipmentCard('Pare-feu', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.SET_COMBAT_IMMUNITY, EffectTarget.SELF),
        ]),
      ]);

    it('aucun dégât de combat jusqu’au début de son prochain tour', () => {
      const game = scenario({
        p1: {
          hand: [pareFeu()],
          monsters: [monsterCard('Mur', { atk: 100, hp: 500 })],
        },
        p2: { monsters: [monsterCard('Ogre', { atk: 900, hp: 3000 })] },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Mur').instanceId,
      });
      engine.dispatch(game, 'p1', { type: 'end_phase' });
      attackWith(engine, game, 'p1', 'Mur', 'Ogre');
      expect(monsterNamed(game, 'p1', 'Mur').currentHp).toBe(500);
      // Seul le monstre immunisé est épargné : l'Ogre encaisse l'ATK de Mur
      expect(monsterNamed(game, 'p2', 'Ogre').currentHp).toBe(2900);

      passTurn(engine, game);
      engine.dispatch(game, 'p2', { type: 'end_phase' });
      attackWith(engine, game, 'p2', 'Ogre', 'Mur');
      expect(monsterNamed(game, 'p1', 'Mur').currentHp).toBe(500);

      passTurn(engine, game);
      expect(monsterNamed(game, 'p1', 'Mur').combatImmune).toBeFalsy();
    });
  });

  describe('SET_SUPPORT_DESTROY_IMMUNITY', () => {
    const blindage = () =>
      equipmentCard('Blindage', [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.SET_SUPPORT_DESTROY_IMMUNITY, EffectTarget.SELF),
        ]),
      ]);
    const destruction = () =>
      ephemeralCard('Destruction', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER),
        ]),
      ]);

    it('le passif est recalculé et une destruction directe par Support échoue', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: {
          monsters: [{ card: monsterCard('Beta'), equipments: [blindage()] }],
        },
      });
      engine.settle(game); // recalcul des passifs
      expect(monsterNamed(game, 'p2', 'Beta').supportDestroyImmune).toBe(true);

      const res = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Beta').instanceId,
      });
      // Seul monstre adverse protégé : la carte ne peut pas être jouée
      expect(res.error).toBe('Aucune cible valide pour cette carte');
      expect(monsterNamed(game, 'p2', 'Beta')).toBeDefined();
      expect(graveyardNames(game, 'p1')).toEqual([]);
    });

    it('des dégâts mortels venant d’un Support le détruisent', () => {
      const meteore = ephemeralCard('Météore', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
            value: 5000,
          }),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [meteore] },
        p2: {
          monsters: [
            {
              card: monsterCard('Beta'),
              equipments: [blindage()],
              patch: { supportDestroyImmune: true },
            },
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.player2.monsterZones[0]).toBeNull();
    });
  });

  describe('IGNORE_TAUNT', () => {
    const TAUNT = {
      perm: {
        atk: 0,
        hp: 0,
        taunt: true,
        piercing: false,
        debuffImmune: false,
        attacksPerTurn: 1,
      },
      hasTaunt: true,
    };
    const viseur = () =>
      equipmentCard('Viseur', [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.IGNORE_TAUNT, EffectTarget.SELF),
        ]),
      ]);
    const defense = () => [
      { card: monsterCard('Gardien', { hp: 3000 }), patch: TAUNT },
      monsterCard('Cible', { hp: 3000 }),
    ];

    it('sans le passif, la Provocation s’impose', () => {
      const game = scenario({
        p1: { monsters: [monsterCard('Delta', { atk: 500 })] },
        p2: { monsters: defense() },
      });
      engine.dispatch(game, 'p1', { type: 'end_phase' });
      expect(attackWith(engine, game, 'p1', 'Delta', 'Cible').error).toBe(
        '⚠️ Vous devez attaquer le monstre avec Provocation !',
      );
    });

    it('avec le passif, il attaque la cible de son choix', () => {
      const game = scenario({
        p1: {
          monsters: [
            {
              card: monsterCard('Delta', { atk: 500 }),
              equipments: [viseur()],
            },
          ],
        },
        p2: { monsters: defense() },
      });
      engine.dispatch(game, 'p1', { type: 'end_phase' });
      expect(attackWith(engine, game, 'p1', 'Delta', 'Cible')).toEqual({});
      expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(2500);
    });
  });

  describe('Zeta implanté (SUMMONABLE_ON_ENEMY_SIDE)', () => {
    const SELF_ZETA = effect(EffectTrigger.PASSIVE, [
      act(ActionType.SUMMONABLE_ON_ENEMY_SIDE, EffectTarget.SELF),
    ]);
    const zeta = (name = 'Zeta') => monsterCard(name, { effects: [SELF_ZETA] });
    /** Zeta de p1 implanté chez p2, à côté d'un monstre ordinaire. */
    const hostWithZeta = (extra: ScenarioSpec = {}) =>
      scenario({
        ...extra,
        p2: {
          ...extra.p2,
          monsters: [
            { card: zeta(), patch: { ownerUserId: P1_ID } },
            monsterCard('Hôte'),
          ],
        },
      });
    const zetaId = (game: GameState) =>
      monsterNamed(game, 'p2', 'Zeta').instanceId;
    const ephemeral = (
      target: EffectTarget,
      type: ActionType = ActionType.BUFF_ATK,
    ) =>
      ephemeralCard('Éphémère', [
        effect(EffectTrigger.ON_PLAY, [act(type, target, { value: 100 })]),
      ]);

    it('p1 ne peut pas poser un second Zeta chez p2', () => {
      const game = hostWithZeta({ p1: { hand: [zeta('Zeta bis')] } });
      expect(
        engine.dispatch(game, 'p1', {
          type: 'summon',
          handIndex: 0,
          zoneIndex: 2,
          paymentHandIndices: [],
          onOpponentSide: true,
        }),
      ).toEqual({ error: "Un seul Zeta à la fois chez l'adversaire" });
    });

    it("p1 peut en poser un chez p2 quand il n'y en a pas", () => {
      const game = scenario({ p1: { hand: [zeta()] } });
      expect(
        engine.dispatch(game, 'p1', {
          type: 'summon',
          handIndex: 0,
          zoneIndex: 0,
          paymentHandIndices: [],
          onOpponentSide: true,
        }),
      ).toEqual({});
      expect(game.player2.monsterZones[0]!.ownerUserId).toBe(P1_ID);
    });

    it("l'hôte ne peut pas attaquer avec", () => {
      const game = hostWithZeta({
        turn: 'p2',
        phase: 'battle',
        p1: { monsters: [monsterCard('Cible')] },
      });
      const MINE = 'Zeta appartient à ton adversaire';
      expect(attackWith(engine, game, 'p2', 'Zeta').error).toBe(MINE);
      expect(attackWith(engine, game, 'p2', 'Zeta', 'Cible').error).toBe(MINE);
      expect(monsterNamed(game, 'p2', 'Zeta').attacksUsedThisTurn).toBe(0);
    });

    it("l'hôte ne peut pas changer son mode", () => {
      const game = hostWithZeta({ turn: 'p2' });
      const before = monsterNamed(game, 'p2', 'Zeta').mode;
      const result = engine.dispatch(game, 'p2', {
        type: 'change_mode',
        instanceId: zetaId(game),
        mode: before === 'attack' ? 'guard' : 'attack',
      });
      expect(result.error).toBe('Zeta appartient à ton adversaire');
      expect(monsterNamed(game, 'p2', 'Zeta').mode).toBe(before);
    });

    it("l'hôte ne peut pas l'équiper", () => {
      const game = hostWithZeta({
        turn: 'p2',
        p2: { hand: [equipmentCard('Casque', [])] },
      });
      const result = engine.dispatch(game, 'p2', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: zetaId(game),
      });
      expect(result.error).toBe('Monstre cible introuvable');
      expect(monsterNamed(game, 'p2', 'Zeta').equipments).toHaveLength(0);
    });

    it("l'hôte ne peut pas le viser avec un éphémère « allié »", () => {
      const game = hostWithZeta({
        turn: 'p2',
        p2: { hand: [ephemeral(EffectTarget.ALLY_MONSTER)] },
      });
      const result = engine.dispatch(game, 'p2', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: zetaId(game),
      });
      expect(result.error).toBe('Choisis un de tes monstres comme cible');
      expect(monsterNamed(game, 'p2', 'Zeta').perm.atk).toBe(0);
    });

    it("l'hôte ne peut pas faire évoluer dessus", () => {
      const game = scenario({
        turn: 'p2',
        p2: {
          hand: [
            monsterCard('Jeune', { stage: DrakonStage.YOUNG, lineage: 'L' }),
          ],
          monsters: [
            {
              card: monsterCard('Bébé', {
                stage: DrakonStage.BABY,
                lineage: 'L',
              }),
              patch: { ownerUserId: P1_ID },
            },
          ],
        },
      });
      const result = engine.dispatch(game, 'p2', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Bébé').instanceId,
        paymentHandIndices: [],
      });
      expect(result.error).toBe('Bébé appartient à ton adversaire');
      expect(game.player2.hand).toHaveLength(1);
    });

    it('un effet ALL_ENEMIES de p1 ne touche pas son propre Zeta', () => {
      const game = hostWithZeta({
        p1: {
          hand: [ephemeral(EffectTarget.ALL_ENEMIES, ActionType.DEAL_DAMAGE)],
        },
      });
      expect(
        engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 }),
      ).toEqual({});
      expect(monsterNamed(game, 'p2', 'Hôte').currentHp).toBe(400);
      expect(monsterNamed(game, 'p2', 'Zeta').currentHp).toBe(500);
    });

    it('un effet ALL_ALLIES de p2 ne compte pas le Zeta', () => {
      const game = hostWithZeta({
        turn: 'p2',
        p2: { hand: [ephemeral(EffectTarget.ALL_ALLIES)] },
      });
      expect(
        engine.dispatch(game, 'p2', { type: 'play_support', handIndex: 0 }),
      ).toEqual({});
      expect(monsterNamed(game, 'p2', 'Hôte').perm.atk).toBe(100);
      expect(monsterNamed(game, 'p2', 'Zeta').perm.atk).toBe(0);
    });

    it("un terrain de l'hôte ne buffe pas le Zeta implanté", () => {
      const game = hostWithZeta({
        p2: {
          supports: [
            terrainCard('Arène', [
              effect(EffectTrigger.PASSIVE, [
                act(ActionType.BUFF_ATK, EffectTarget.ALL_ALLIES, {
                  value: 100,
                }),
              ]),
            ]),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'end_phase' });
      expect(monsterNamed(game, 'p2', 'Hôte').atkBuff).toBe(100);
      expect(monsterNamed(game, 'p2', 'Zeta').atkBuff).toBe(0);
    });

    it("ADJACENT_ALLIES de l'hôte ne touche pas le Zeta voisin", () => {
      const game = scenario({
        turn: 'p2',
        p2: {
          hand: [
            equipmentCard('Aura', [
              effect(EffectTrigger.ON_PLAY, [
                act(ActionType.BUFF_ATK, EffectTarget.ADJACENT_ALLIES, {
                  value: 100,
                }),
              ]),
            ]),
          ],
          monsters: [
            { card: zeta(), patch: { ownerUserId: P1_ID } },
            monsterCard('Hôte'),
            monsterCard('Voisin'),
          ],
        },
      });
      expect(
        engine.dispatch(game, 'p2', {
          type: 'play_support',
          handIndex: 0,
          targetInstanceId: monsterNamed(game, 'p2', 'Hôte').instanceId,
        }),
      ).toEqual({});
      expect(monsterNamed(game, 'p2', 'Voisin').perm.atk).toBe(100);
      expect(monsterNamed(game, 'p2', 'Zeta').perm.atk).toBe(0);
    });

    describe('conditions de terrain', () => {
      const ctxOf = (game: GameState, userId: number) => ({
        game,
        ownerUserId: userId,
        log: [],
      });
      const pixel = (name: string) =>
        monsterCard(name, { archetype: 'pixelman' });

      it("l'hôte ne compte pas le Zeta implanté sur son terrain", () => {
        const game = scenario({
          p2: {
            monsters: [
              {
                card: pixel('Zeta Pixel'),
                patch: { ownerUserId: P1_ID },
              },
            ],
          },
        });
        const on = (type: string, value: string) =>
          conditionMet(
            { type, value, match: 'contains' } as never,
            ctxOf(game, 2),
          );
        expect(on('ARCHETYPE_ON_BOARD', 'pixelman')).toBe(false);
        expect(on('SPECIFIC_CARD_ON_BOARD', 'Zeta')).toBe(false);
        expect(on('DRAKON_ON_BOARD', '')).toBe(false);
        // Son poseur, lui, ne le compte pas non plus : il est sur le terrain adverse
        expect(
          conditionMet(
            { type: 'ARCHETYPE_ON_BOARD', value: 'pixelman' } as never,
            ctxOf(game, 1),
          ),
        ).toBe(false);
      });

      it("un monstre ordinaire de l'hôte est compté", () => {
        const game = scenario({ p2: { monsters: [pixel('Normal')] } });
        expect(
          conditionMet(
            { type: 'ARCHETYPE_ON_BOARD', value: 'pixelman' } as never,
            ctxOf(game, 2),
          ),
        ).toBe(true);
      });

      it('OPPONENT_HAS_NO_MONSTERS ignore les monstres implantés par le lanceur', () => {
        const only = scenario({
          p2: { monsters: [{ card: zeta(), patch: { ownerUserId: P1_ID } }] },
        });
        const cond = { type: 'OPPONENT_HAS_NO_MONSTERS' } as never;
        expect(conditionMet(cond, ctxOf(only, 1))).toBe(true);
        expect(conditionMet(cond, ctxOf(hostWithZeta(), 1))).toBe(false);
      });
    });

    it("l'attaque directe n'est pas bloquée par le Zeta du poseur", () => {
      const game = scenario({
        turn: 'p1',
        turnNumber: 2,
        phase: 'battle',
        p1: { monsters: [monsterCard('Frappeur')] },
        p2: {
          monsters: [{ card: zeta(), patch: { ownerUserId: P1_ID } }],
        },
      });
      expect(attackWith(engine, game, 'p1', 'Frappeur')).toEqual({});
    });

    it("l'attaque directe reste bloquée par un monstre ordinaire", () => {
      const game = hostWithZeta({
        turn: 'p1',
        turnNumber: 2,
        phase: 'battle',
        p1: { monsters: [monsterCard('Frappeur')] },
      });
      expect(attackWith(engine, game, 'p1', 'Frappeur').error).toBe(
        "Attaque directe impossible : détruisez d'abord les monstres adverses",
      );
    });

    it('p1 peut équiper son Zeta posé chez p2', () => {
      const game = hostWithZeta({
        p1: { hand: [equipmentCard('Casque', [])] },
      });
      expect(
        engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          targetInstanceId: zetaId(game),
        }),
      ).toEqual({});
      expect(monsterNamed(game, 'p2', 'Zeta').equipments).toHaveLength(1);
    });

    it('p1 ne peut pas équiper un monstre ordinaire de p2', () => {
      const game = hostWithZeta({
        p1: { hand: [equipmentCard('Casque', [])] },
      });
      expect(
        engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          targetInstanceId: monsterNamed(game, 'p2', 'Hôte').instanceId,
        }).error,
      ).toBe('Monstre cible introuvable');
    });
  });

  describe('Zeta implanté : explosion et remise du compteur', () => {
    const SELF_ZETA = effect(EffectTrigger.PASSIVE, [
      act(ActionType.SUMMONABLE_ON_ENEMY_SIDE, EffectTarget.SELF),
    ]);
    const zeta = () =>
      monsterCard('Zeta', {
        effects: [
          SELF_ZETA,
          effect(EffectTrigger.ON_SELF_DESTRUCT, [
            act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
              value: 500,
            }),
          ]),
        ],
      });
    const implanted = (counter: number) => ({
      card: zeta(),
      patch: { ownerUserId: P1_ID, turnCounter: counter },
    });

    it("explose au début du tour du poseur : Prime, pas de pioche, dégâts à l'hôte", () => {
      const game = scenario({
        p2: {
          hand: [],
          monsters: [
            implanted(1),
            monsterCard('Costaud', { hp: 600 }),
            monsterCard('Fragile', {
              hp: 400,
              effects: [
                effect(EffectTrigger.ON_DEATH, [
                  act(ActionType.DRAW, EffectTarget.PLAYER, { value: 1 }),
                ]),
              ],
            }),
          ],
        },
      });
      const zetaOnBoard = monsterNamed(game, 'p2', 'Zeta');
      const primesBefore = game.player1.primes;
      passTurn(engine, game); // fin du tour de p1 : début du tour de p2
      const p2HandBefore = game.player2.hand.length; // pioche du tour de p2 incluse
      expect(monsterNamed(game, 'p2', 'Zeta').turnCounter).toBe(1);
      passTurn(engine, game); // fin du tour de p2 : début du tour de p1

      expect(game.player1.primes).toBe(primesBefore - 1);
      expect(
        game.player2.monsterZones.some((z) => z?.card.baseCard.name === 'Zeta'),
      ).toBe(false);
      expect(graveyardNames(game, 'p1')).toContain('Zeta');
      expect(monsterNamed(game, 'p2', 'Costaud').currentHp).toBe(100);
      expect(
        game.player2.monsterZones.some(
          (z) => z?.card.baseCard.name === 'Fragile',
        ),
      ).toBe(false);
      // Fragile : pioche de son ON_DEATH + pioche de l'hôte pour sa destruction ;
      // la destruction de Zeta, elle, ne fait rien piocher
      expect(game.player2.hand.length).toBe(p2HandBefore + 2);
      // Zeta ne subit jamais ses propres 500 dégâts
      expect(zetaOnBoard.currentHp).toBe(500);
      expect(game.log.join('\n')).not.toMatch(/inflige \d+ à Zeta/);
      expect(game.log.join('\n')).toMatch(/inflige 500 à Costaud/);
    });

    it("la mort en chaîne de l'hôte (pioche + invocation) se résout sans erreur", () => {
      const game = scenario({
        p2: {
          hand: [],
          deck: Array.from({ length: 8 }, (_, i) =>
            monsterCard(`Réserve ${i}`),
          ),
          monsters: [
            implanted(1),
            monsterCard('Piocheur', {
              hp: 300,
              effects: [
                effect(EffectTrigger.ON_DEATH, [
                  act(ActionType.DRAW, EffectTarget.PLAYER, { value: 1 }),
                ]),
              ],
            }),
            monsterCard('Invocateur', {
              hp: 300,
              effects: [
                effect(EffectTrigger.ON_DEATH, [
                  act(ActionType.SUMMON_FROM_DECK, EffectTarget.PLAYER),
                ]),
              ],
            }),
          ],
        },
      });
      passTurn(engine, game);
      const handBefore = game.player2.hand.length;
      expect(() => passTurn(engine, game)).not.toThrow();

      const names = game.player2.monsterZones.map((z) => z?.card.baseCard.name);
      expect(names).not.toContain('Zeta');
      expect(names).not.toContain('Piocheur');
      expect(names).not.toContain('Invocateur');
      expect(game.player2.hand.length).toBeGreaterThan(handBefore);
      expect(game.pendingChoices.some((c) => c.forUserId === 2)).toBe(true);
      expect(graveyardNames(game, 'p1')).toContain('Zeta');
    });

    it("une copie token dont le compteur atteint 0 n'apporte pas de Prime, mais explose", () => {
      const game = scenario({
        p1: { monsters: [{ card: zeta(), patch: { turnCounter: 1 } }] },
        p2: { monsters: [monsterCard('Cible', { hp: 900 })] },
      });
      monsterNamed(game, 'p1', 'Zeta').card.token = true;
      const primesBefore = game.player1.primes;
      passTurn(engine, game);
      passTurn(engine, game); // début du tour de p1 : compteur à 0

      expect(game.player1.primes).toBe(primesBefore);
      expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(400);
    });

    describe('déclencheurs de tour du monstre implanté', () => {
      it("l'équipement d'un Zeta implanté soigne au début du tour du poseur, pas de l'hôte", () => {
        const heal = equipmentCard('Soigneur', [
          effect(EffectTrigger.ON_TURN_START, [
            act(ActionType.HEAL, EffectTarget.SELF, { value: 100 }),
          ]),
        ]);
        const game = scenario({
          p2: {
            monsters: [
              {
                card: zeta(),
                currentHp: 200,
                equipments: [heal],
                patch: { ownerUserId: P1_ID },
              },
            ],
          },
        });
        passTurn(engine, game); // début du tour de l'hôte
        expect(monsterNamed(game, 'p2', 'Zeta').currentHp).toBe(200);
        passTurn(engine, game); // début du tour du poseur
        expect(monsterNamed(game, 'p2', 'Zeta').currentHp).toBe(300);
      });

      it("ON_TURN_START ALL_ENEMIES d'un Zeta implanté frappe l'hôte au tour du poseur", () => {
        const pulse = monsterCard('Zeta', {
          effects: [
            SELF_ZETA,
            effect(EffectTrigger.ON_TURN_START, [
              act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
                value: 100,
              }),
            ]),
          ],
        });
        const game = scenario({
          p1: { monsters: [monsterCard('Allié', { hp: 1000 })] },
          p2: {
            monsters: [
              { card: pulse, patch: { ownerUserId: P1_ID } },
              monsterCard('Hôte', { hp: 1000 }),
            ],
          },
        });
        passTurn(engine, game); // tour de l'hôte : rien
        expect(monsterNamed(game, 'p1', 'Allié').currentHp).toBe(1000);
        expect(monsterNamed(game, 'p2', 'Hôte').currentHp).toBe(1000);
        passTurn(engine, game); // tour du poseur
        expect(monsterNamed(game, 'p2', 'Hôte').currentHp).toBe(900);
        expect(monsterNamed(game, 'p1', 'Allié').currentHp).toBe(1000);
      });
    });

    describe('RESET_TURN_COUNTER', () => {
      const reset = () =>
        ephemeralCard('Rechargeur', [
          effect(EffectTrigger.ON_PLAY, [
            act(ActionType.RESET_TURN_COUNTER, EffectTarget.PLAYER, {
              value: 3,
            }),
          ]),
        ]);

      it('remet le compteur du Zeta implanté du joueur', () => {
        const game = scenario({
          p1: { hand: [reset()] },
          p2: { monsters: [implanted(1)] },
        });
        expect(
          engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 }),
        ).toEqual({});
        expect(monsterNamed(game, 'p2', 'Zeta').turnCounter).toBe(3);
      });

      it('remet le compteur de deux monstres implantés du poseur', () => {
        const second = { ...implanted(2), card: monsterCard('Zeta bis') };
        const game = scenario({
          p1: { hand: [reset()] },
          p2: { monsters: [implanted(1), second] },
        });
        engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
        expect(monsterNamed(game, 'p2', 'Zeta').turnCounter).toBe(3);
        expect(monsterNamed(game, 'p2', 'Zeta bis').turnCounter).toBe(3);
      });

      it('injouable sans Zeta implanté', () => {
        const game = scenario({
          p1: { hand: [reset()] },
          p2: { monsters: [monsterCard('Hôte')] },
        });
        const result = engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
        });
        expect(result.error).toBeDefined();
        expect(game.player1.hand).toHaveLength(1);
      });
    });
  });
});
