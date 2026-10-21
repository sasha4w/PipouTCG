import {
  ActionType,
  CardEffect,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  equipmentCard,
  monsterCard,
} from '../testing/cards';
import {
  attackWith,
  graveyardNames,
  handNames,
  monsterNamed,
  passTurn,
  P1_ID,
  P2_ID,
  scenario,
} from '../testing/scenario';
import { buildClientState } from '../helpers/client-state.builder';

const dragon = (name: string, extra: Parameters<typeof monsterCard>[1] = {}) =>
  monsterCard(name, { archetype: 'dragon', ...extra });

describe('mécaniques Drakon', () => {
  const engine = createEngine();

  describe('cibles, conditions, filtres', () => {
    it('STRONGEST_ENEMY vise le monstre adverse de plus grande ATK', () => {
      const renvoi = ephemeralCard('Renvoi', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.RETURN_TO_HAND, EffectTarget.STRONGEST_ENEMY),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [renvoi] },
        p2: {
          monsters: [
            monsterCard('Faible', { atk: 100 }),
            monsterCard('Fort', { atk: 900 }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(handNames(game, 'p2')).toContain('Fort');
      expect(monsterNamed(game, 'p2', 'Faible')).toBeDefined();
    });

    it('DRAKON_ON_BOARD par stade et par élément (valueIf)', () => {
      const frappe = () =>
        ephemeralCard('Frappe', [
          effect(EffectTrigger.ON_PLAY, [
            act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
              value: 300,
              valueIf: {
                condition: {
                  type: EffectConditionType.DRAKON_ON_BOARD,
                  element: 'fire',
                },
                value: 600,
              },
            }),
          ]),
        ]);
      const sans = scenario({
        p1: {
          hand: [frappe()],
          monsters: [dragon('Eau', { element: 'water' })],
        },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(sans, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(sans, 'p2', 'Cible').currentHp).toBe(1700);

      const avec = scenario({
        p1: {
          hand: [frappe()],
          monsters: [dragon('Feu', { element: 'fire' })],
        },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(avec, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(avec, 'p2', 'Cible').currentHp).toBe(1400);
    });

    it('EQUIPPED_ON par stade (sans nom)', () => {
      const ecaille = equipmentCard('Écaille', [
        effect(
          EffectTrigger.PASSIVE,
          [act(ActionType.SET_DEBUFF_IMMUNITY, EffectTarget.SELF)],
          { type: EffectConditionType.EQUIPPED_ON, stage: 'egg' },
        ),
      ]);
      const game = scenario({
        p1: {
          monsters: [
            {
              card: dragon('Œuf', { stage: 'egg', atk: 0 }),
              equipments: [ecaille],
            },
            { card: dragon('Bébé', { stage: 'baby' }), equipments: [ecaille] },
          ],
        },
      });
      engine.settle(game);
      expect(monsterNamed(game, 'p1', 'Œuf').isImmuneToDebuffs).toBe(true);
      expect(monsterNamed(game, 'p1', 'Bébé').isImmuneToDebuffs).toBe(false);
    });

    it('filtre de recherche par stade', () => {
      const potion = ephemeralCard('Potion', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.SEARCH_DECK, EffectTarget.PLAYER, {
            filter: { stage: 'young' },
          }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [potion],
          deck: [
            dragon('Bébé A', { stage: 'baby' }),
            dragon('Jeune A', { stage: 'young' }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(
        game.pendingChoices[0].candidates.map((c) => c.baseCard.name),
      ).toEqual(['Jeune A']);
    });

    it('ARCHETYPE_ALLIES depuis un Éphémère (archetype de l’action)', () => {
      const souffle = ephemeralCard('Souffle', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.BUFF_ATK_TEMP, EffectTarget.ARCHETYPE_ALLIES, {
            value: 300,
            archetype: 'dragon',
          }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [souffle],
          monsters: [
            dragon('Drakon'),
            monsterCard('Pipou', { archetype: 'pipou' }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(game, 'p1', 'Drakon').tempAtkBuff).toBe(300);
      expect(monsterNamed(game, 'p1', 'Pipou').tempAtkBuff).toBe(0);
    });
  });

  describe('évolution', () => {
    const bebe = (extra = {}) =>
      dragon('Bébé Feros', {
        stage: 'baby',
        lineage: 'feros',
        element: 'fire',
        cost: 1,
        atk: 400,
        hp: 400,
        ...extra,
      });
    const jeune = (extra = {}) =>
      dragon('Jeune Feros', {
        stage: 'young',
        lineage: 'feros',
        element: 'fire',
        cost: 2,
        atk: 800,
        hp: 900,
        effects: [
          effect(EffectTrigger.ON_SUMMON, [
            act(ActionType.SET_PIERCING, EffectTarget.SELF),
          ]),
        ],
        ...extra,
      });
    const evolve = (
      game: ReturnType<typeof scenario>,
      name = 'Bébé Feros',
      paymentHandIndices: number[] = [],
    ) =>
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', name).instanceId,
        paymentHandIndices,
      });

    it('remplace la base : équipements et mode gardés, PV pleins, base au cimetière, ON_SUMMON', () => {
      const casque = equipmentCard('Casque', []);
      const game = scenario({
        p1: {
          hand: [jeune()],
          recycleEnergy: 1,
          monsters: [
            {
              card: bebe(),
              equipments: [casque],
              mode: 'guard',
              currentHp: 100,
            },
          ],
        },
      });
      expect(evolve(game)).toEqual({});
      const evolved = monsterNamed(game, 'p1', 'Jeune Feros');
      expect(game.player1.monsterZones[0]).toBe(evolved);
      expect(evolved.equipments.map((e) => e.baseCard.name)).toEqual([
        'Casque',
      ]);
      expect(evolved.mode).toBe('guard');
      expect(evolved.currentHp).toBe(900);
      expect(evolved.hasPiercing).toBe(true);
      expect(graveyardNames(game, 'p1')).toEqual(['Bébé Feros']);
      expect(game.player1.recycleEnergy).toBe(0);
      expect(game.pendingEvents.at(-1)).toMatchObject({
        kind: 'monster_summoned',
        zoneIndex: 0,
      });
    });

    it('coût en différence payé par défausse', () => {
      const game = scenario({
        p1: { hand: [jeune(), monsterCard('Payeur')], monsters: [bebe()] },
      });
      expect(evolve(game, 'Bébé Feros', [])).toEqual({
        error: 'Pas assez de cartes défaussées (besoin: 1)',
      });
      expect(evolve(game, 'Bébé Feros', [1])).toEqual({});
      expect(graveyardNames(game, 'p1')).toEqual(['Payeur', 'Bébé Feros']);
    });

    it('refuse le tour de pose, sauf Évolution immédiate ou Peut évoluer ce tour', () => {
      const posé = { card: bebe(), summonedThisTurn: true };
      const refus = scenario({
        p1: { hand: [jeune()], recycleEnergy: 1, monsters: [posé] },
      });
      expect(evolve(refus).error).toBe(
        "Bébé Feros doit attendre un tour avant d'évoluer",
      );

      const rapide = scenario({
        p1: {
          hand: [jeune()],
          recycleEnergy: 1,
          monsters: [{ ...posé, patch: { canEvolveThisTurn: true } }],
        },
      });
      expect(evolve(rapide)).toEqual({});
    });

    it('refuse une autre lignée', () => {
      const game = scenario({
        p1: {
          hand: [jeune({ lineage: 'teros' })],
          recycleEnergy: 1,
          monsters: [bebe()],
        },
      });
      expect(evolve(game).error).toBe(
        'Jeune Feros ne peut pas évoluer depuis Bébé Feros',
      );
    });

    it('le joker accepte un Jeune de toute lignée', () => {
      const oeuf = dragon('Œuf', {
        stage: 'egg',
        atk: 0,
        hp: 300,
        cost: 1,
        effects: [
          effect(EffectTrigger.PASSIVE, [
            act(ActionType.EVOLUTION_JOKER, EffectTarget.SELF),
          ]),
        ],
      });
      const game = scenario({
        p1: {
          hand: [jeune({ lineage: 'ackos' })],
          recycleEnergy: 1,
          monsters: [oeuf],
        },
      });
      engine.settle(game);
      expect(evolve(game, 'Œuf')).toEqual({});
    });

    it("pas d'attaque supplémentaire en évoluant", () => {
      const game = scenario({
        p1: {
          hand: [jeune()],
          recycleEnergy: 1,
          monsters: [
            {
              card: bebe(),
              patch: { attacksUsedThisTurn: 1, hasAttackedThisTurn: true },
            },
          ],
        },
      });
      evolve(game);
      expect(monsterNamed(game, 'p1', 'Jeune Feros').hasAttackedThisTurn).toBe(
        true,
      );
    });

    it('INSTANT_EVOLUTION (passif) et ALLOW_EVOLUTION_THIS_TURN (effet, expire en fin de tour)', () => {
      const vent = dragon('Bébé Vent', {
        stage: 'baby',
        lineage: 'tempestu',
        cost: 1,
        effects: [
          effect(EffectTrigger.PASSIVE, [
            act(ActionType.INSTANT_EVOLUTION, EffectTarget.SELF),
          ]),
        ],
      });
      const game = scenario({
        p1: { monsters: [{ card: vent, summonedThisTurn: true }] },
      });
      engine.settle(game);
      expect(monsterNamed(game, 'p1', 'Bébé Vent').instantEvolution).toBe(true);

      const accel = ephemeralCard('Accélère', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.ALLOW_EVOLUTION_THIS_TURN, EffectTarget.TARGET_ALLY),
        ]),
      ]);
      // Posé ce tour : l'effet lui sert (sinon la cible serait refusée)
      const g2 = scenario({
        p1: {
          hand: [accel],
          monsters: [{ card: bebe(), summonedThisTurn: true }],
        },
      });
      const id = monsterNamed(g2, 'p1', 'Bébé Feros').instanceId;
      engine.dispatch(g2, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: id,
      });
      expect(monsterNamed(g2, 'p1', 'Bébé Feros').canEvolveThisTurn).toBe(true);
      passTurn(engine, g2);
      expect(
        monsterNamed(g2, 'p1', 'Bébé Feros').canEvolveThisTurn,
      ).toBeFalsy();
    });

    it('un Œuf ne peut pas attaquer', () => {
      const game = scenario({
        phase: 'battle',
        p1: { monsters: [dragon('Œuf', { stage: 'egg', atk: 0 })] },
        p2: { monsters: [monsterCard('Cible')] },
      });
      expect(attackWith(engine, game, 'p1', 'Œuf', 'Cible').error).toBe(
        'Un Œuf ne peut pas attaquer',
      );
    });
  });

  describe('éclosion', () => {
    const oeuf = (
      turns: number,
      stage: 'baby' | 'adult',
      extra: CardEffect[] = [],
    ) =>
      dragon(`Œuf ${stage}`, {
        stage: 'egg',
        atk: 0,
        hp: 300,
        effects: [
          effect(EffectTrigger.ON_SUMMON, [
            act(ActionType.SET_HATCH_COUNTER, EffectTarget.SELF, {
              value: turns,
              filter: { stage },
            }),
          ]),
          ...extra,
        ],
      });
    // Cartes neutres d'abord : la pioche de début de tour ne prend pas les candidats
    const deck = () => [
      ...['F1', 'F2', 'F3', 'F4'].map((n) => monsterCard(n)),
      dragon('Bébé Deck', { stage: 'baby' }),
      dragon('Adulte Deck', { stage: 'adult' }),
    ];
    const pose = (game: ReturnType<typeof scenario>) =>
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 1,
        paymentHandIndices: [],
      });

    it('éclot après 2 tours du propriétaire en la carte choisie, dans la zone de l’œuf', () => {
      const game = scenario({ p1: { hand: [oeuf(2, 'baby')], deck: deck() } });
      pose(game);
      passTurn(engine, game); // tour p2
      passTurn(engine, game); // début du 1er tour de p1 après la pose : 2 → 1
      expect(game.pendingChoices).toHaveLength(0);
      passTurn(engine, game);
      passTurn(engine, game); // début du 2e tour de p1 après la pose : 1 → 0, éclosion
      const choice = game.pendingChoices[0];
      expect(choice).toMatchObject({
        resolution: 'summon_to_zone',
        zoneIndex: 1,
      });
      expect(choice.candidates.map((c) => c.baseCard.name)).toEqual([
        'Bébé Deck',
      ]);
      expect(game.player1.monsterZones[1]).toBeNull();
      engine.dispatch(game, 'p1', {
        type: 'pick_cards',
        instanceIds: [choice.candidates[0].instanceId],
      });
      expect(game.player1.monsterZones[1]?.card.baseCard.name).toBe(
        'Bébé Deck',
      );
      expect(graveyardNames(game, 'p1')).toContain('Œuf baby');
    });

    it('éclore ne déclenche pas ON_DEATH', () => {
      const piege = effect(EffectTrigger.ON_DEATH, [
        act(ActionType.DRAW, EffectTarget.PLAYER, { value: 3 }),
      ]);
      const game = scenario({
        p1: { hand: [oeuf(1, 'baby', [piege])], deck: deck() },
      });
      pose(game);
      const handBefore = game.player1.hand.length;
      passTurn(engine, game);
      passTurn(engine, game);
      // seule la pioche de début de tour : pas les 3 cartes d'ON_DEATH
      expect(game.player1.hand.length).toBe(handBefore + 1);
    });

    it('deck sans candidat : l’œuf part au cimetière, pas de choix', () => {
      const game = scenario({
        p1: { hand: [oeuf(1, 'adult')], deck: [monsterCard('Rien')] },
      });
      pose(game);
      passTurn(engine, game);
      passTurn(engine, game);
      expect(game.pendingChoices).toHaveLength(0);
      expect(game.player1.monsterZones[1]).toBeNull();
    });

    it('ADVANCE_HATCH jusqu’à 0 : éclosion immédiate', () => {
      const incub = ephemeralCard('Incubation', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.ADVANCE_HATCH, EffectTarget.TARGET_ALLY, { value: 2 }),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [oeuf(2, 'baby'), incub], deck: deck() },
      });
      pose(game);
      const egg = monsterNamed(game, 'p1', 'Œuf baby');
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: egg.instanceId,
      });
      expect(game.pendingChoices[0]).toMatchObject({
        resolution: 'summon_to_zone',
        zoneIndex: 1,
      });
    });

    it('SUMMON_FROM_DECK à la destruction : Jeune choisi invoqué dans la zone libérée', () => {
      const dualite = dragon('Dualité', {
        stage: 'egg',
        atk: 0,
        hp: 300,
        effects: [
          effect(EffectTrigger.ON_DEATH, [
            act(ActionType.SUMMON_FROM_DECK, EffectTarget.PLAYER, {
              filter: { stage: 'young' },
            }),
          ]),
        ],
      });
      const formatage = ephemeralCard('Formatage', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.TARGET_ALLY),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [formatage],
          monsters: [null, dualite],
          deck: [dragon('Jeune Deck', { stage: 'young' })],
        },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Dualité').instanceId,
      });
      const choice = game.pendingChoices[0];
      expect(choice).toMatchObject({
        resolution: 'summon_to_zone',
        zoneIndex: 1,
      });
      engine.dispatch(game, 'p1', {
        type: 'pick_cards',
        instanceIds: [choice.candidates[0].instanceId],
      });
      expect(game.player1.monsterZones[1]?.card.baseCard.name).toBe(
        'Jeune Deck',
      );
      // Invoqué pendant son propre tour : doit attendre avant d'évoluer
      expect(game.player1.monsterZones[1]?.summonedThisTurn).toBe(true);
    });

    it('SUMMON_FROM_DECK et éclosion ne proposent que des monstres', () => {
      const appel = ephemeralCard('Appel', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.SUMMON_FROM_DECK, EffectTarget.PLAYER, {
            filter: { archetype: 'dragon' },
          }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [appel],
          deck: [
            equipmentCard('Écaille Deck', [], { archetype: 'dragon' }),
            dragon('Jeune Deck', { stage: 'young' }),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(
        game.pendingChoices[0].candidates.map((c) => c.baseCard.name),
      ).toEqual(['Jeune Deck']);

      const couvee = scenario({
        turn: 'p2',
        p1: {
          monsters: [
            {
              card: dragon('Œuf', { stage: 'egg', atk: 0 }),
              patch: { hatchCounter: 1, hatchStage: 'baby' },
            },
          ],
          deck: [
            monsterCard('F1'),
            equipmentCard('Coquille', [], { stage: 'baby' }),
            dragon('Bébé Deck', { stage: 'baby' }),
          ],
        },
      });
      passTurn(engine, couvee);
      expect(
        couvee.pendingChoices[0].candidates.map((c) => c.baseCard.name),
      ).toEqual(['Bébé Deck']);
    });

    it('DRAKON_ON_BOARD sans élément ni stade ne compte que les Drakons', () => {
      const frappe = () =>
        ephemeralCard('Frappe', [
          effect(EffectTrigger.ON_PLAY, [
            act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, {
              value: 300,
              valueIf: {
                condition: { type: EffectConditionType.DRAKON_ON_BOARD },
                value: 600,
              },
            }),
          ]),
        ]);
      const sans = scenario({
        p1: { hand: [frappe()], monsters: [monsterCard('Pipou')] },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(sans, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(sans, 'p2', 'Cible').currentHp).toBe(1700);

      const avec = scenario({
        p1: {
          hand: [frappe()],
          monsters: [dragon('Bébé', { stage: 'baby' })],
        },
        p2: { monsters: [monsterCard('Cible', { hp: 2000 })] },
      });
      engine.dispatch(avec, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(avec, 'p2', 'Cible').currentHp).toBe(1400);
    });
  });

  describe('robustesse des choix', () => {
    const couvees = (deck: ReturnType<typeof monsterCard>[]) =>
      scenario({
        turn: 'p2',
        p1: {
          monsters: [0, 1].map((i) => ({
            card: dragon(`Œuf ${i}`, { stage: 'egg', atk: 0 }),
            patch: { hatchCounter: 1, hatchStage: 'baby' as const },
          })),
          deck,
        },
      });
    const pick = (game: ReturnType<typeof scenario>, instanceId: string) =>
      engine.dispatch(game, 'p1', {
        type: 'pick_cards',
        instanceIds: [instanceId],
      });

    it('deux œufs, un seul Drakon au deck : le second choix est abandonné', () => {
      const game = couvees([
        monsterCard('F1'),
        dragon('Bébé Deck', { stage: 'baby' }),
      ]);
      passTurn(engine, game);
      expect(game.pendingChoices).toHaveLength(2);
      expect(
        pick(game, game.pendingChoices[0].candidates[0].instanceId),
      ).toEqual({});
      expect(game.player1.monsterZones[0]?.card.baseCard.name).toBe(
        'Bébé Deck',
      );
      expect(buildClientState(game, P1_ID).pendingChoice).toBeUndefined();
      expect(buildClientState(game, P2_ID).opponentChoosing).toBe(false);
      expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({});
    });

    it('deux œufs, deux Drakons : chaque œuf éclot, candidats périmés exclus', () => {
      const game = couvees([
        monsterCard('F1'),
        dragon('Bébé A', { stage: 'baby' }),
        dragon('Bébé B', { stage: 'baby' }),
      ]);
      passTurn(engine, game);
      const idOf = (name: string) =>
        game.pendingChoices[0].candidates.find((c) => c.baseCard.name === name)!
          .instanceId;
      const idA = idOf('Bébé A');
      expect(pick(game, idA)).toEqual({});
      expect(
        buildClientState(game, P1_ID).pendingChoice?.candidates.map(
          (c) => c.baseCard.name,
        ),
      ).toEqual(['Bébé B']);
      expect(pick(game, idA).error).toBe(
        'Carte introuvable dans les choix disponibles',
      );
      expect(pick(game, idOf('Bébé B'))).toEqual({});
      expect(
        game.player1.monsterZones.map((m) => m?.card.baseCard.name),
      ).toEqual(['Bébé A', 'Bébé B', undefined]);
    });

    const dualite = () =>
      dragon('Dualité', {
        stage: 'egg',
        atk: 0,
        hp: 300,
        effects: [
          effect(EffectTrigger.ON_DEATH, [
            act(ActionType.SUMMON_FROM_DECK, EffectTarget.PLAYER, {
              filter: { stage: 'young' },
            }),
          ]),
        ],
      });
    const combat = (deck: ReturnType<typeof monsterCard>[]) => {
      const game = scenario({
        turn: 'p2',
        phase: 'battle',
        p1: { monsters: [dualite()], deck },
        p2: { monsters: [monsterCard('Ogre', { atk: 900, hp: 900 })] },
      });
      attackWith(engine, game, 'p2', 'Ogre', 'Dualité');
      return game;
    };

    it('Dualité détruite au combat : le seul Jeune, pioché, n’est plus proposé', () => {
      const game = combat([dragon('Jeune Deck', { stage: 'young' })]);
      expect(handNames(game, 'p1')).toContain('Jeune Deck');
      expect(buildClientState(game, P1_ID).pendingChoice).toBeUndefined();
      expect(engine.dispatch(game, 'p2', { type: 'end_phase' })).toEqual({});
    });

    it('Dualité détruite au combat : seuls les candidats encore au deck, Drakon prêt à évoluer', () => {
      const game = combat([
        dragon('Jeune A', { stage: 'young' }),
        dragon('Jeune B', { stage: 'young' }),
      ]);
      const offered = buildClientState(game, P1_ID).pendingChoice?.candidates;
      expect(offered?.map((c) => c.baseCard.name)).toEqual(['Jeune B']);
      expect(pick(game, offered![0].instanceId)).toEqual({});
      const jeune = monsterNamed(game, 'p1', 'Jeune B');
      expect(game.player1.monsterZones[0]).toBe(jeune);
      // Apparu pendant le tour adverse : pourra évoluer au prochain tour
      expect(jeune.summonedThisTurn).toBe(false);
    });

    it('timeout : un choix summon_to_zone en attente est résolu automatiquement', () => {
      const formatage = ephemeralCard('Formatage', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.TARGET_ALLY),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [formatage],
          monsters: [null, dualite()],
          deck: [monsterCard('F1'), dragon('Jeune Deck', { stage: 'young' })],
        },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Dualité').instanceId,
      });
      expect(game.pendingChoices).toHaveLength(1);
      engine.timeout(game);
      expect(game.pendingChoices).toEqual([]);
      expect(game.player1.monsterZones[1]?.card.baseCard.name).toBe(
        'Jeune Deck',
      );
    });
  });
  describe('invocation depuis la main', () => {
    const summon = (game: ReturnType<typeof scenario>) =>
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 0,
        paymentHandIndices: [],
      });

    it.each(['young', 'adult'] as const)(
      'un Drakon %s ne se pose pas depuis la main',
      (stage) => {
        const game = scenario({
          p1: {
            hand: [dragon('Drakon Test', { stage, lineage: 'feros', cost: 0 })],
          },
        });
        expect(summon(game).error).toBe(
          'Drakon Test ne peut arriver en jeu que par évolution',
        );
        expect(game.player1.monsterZones[0]).toBeNull();
        expect(game.player1.hand).toHaveLength(1);
      },
    );

    it('un Bébé et un Œuf se posent normalement', () => {
      const game = scenario({
        p1: {
          hand: [
            dragon('Bébé', { stage: 'baby', cost: 0 }),
            dragon('Œuf', { stage: 'egg', atk: 0, cost: 0 }),
          ],
        },
      });
      expect(summon(game)).toEqual({});
      expect(summon(game)).toEqual({ error: 'Zone occupée' });
    });
  });

  describe("ce qui sort d'un œuf évolue le tour même", () => {
    const evolveOn = (game: ReturnType<typeof scenario>, target: string) =>
      engine.dispatch(game, 'p1', {
        type: 'evolve',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', target).instanceId,
        paymentHandIndices: [],
      });
    const pickFirst = (game: ReturnType<typeof scenario>) =>
      engine.dispatch(game, 'p1', {
        type: 'pick_cards',
        instanceIds: [game.pendingChoices[0].candidates[0].instanceId],
      });
    const tue = () =>
      ephemeralCard('Tue', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.TARGET_ALLY),
        ]),
      ]);
    const invoqueJeune = effect(EffectTrigger.ON_DEATH, [
      act(ActionType.SUMMON_FROM_DECK, EffectTarget.PLAYER, {
        filter: { stage: 'young' },
      }),
    ]);
    const tueEtInvoque = (stage: 'egg' | 'baby') => {
      const game = scenario({
        p1: {
          hand: [
            tue(),
            dragon('Adulte D', { stage: 'adult', lineage: 'd', cost: 0 }),
          ],
          deck: [dragon('Jeune D', { stage: 'young', lineage: 'd', cost: 0 })],
          monsters: [
            dragon('Source', {
              stage,
              atk: 0,
              hp: 300,
              effects: [invoqueJeune],
            }),
          ],
        },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Source').instanceId,
      });
      expect(pickFirst(game)).toEqual({});
      return game;
    };

    it('le Bébé éclos en début de tour peut évoluer aussitôt', () => {
      const game = scenario({
        p1: {
          hand: [dragon('Jeune X', { stage: 'young', lineage: 'x', cost: 0 })],
          deck: [
            monsterCard('F1'),
            monsterCard('F2'),
            dragon('Bébé X', { stage: 'baby', lineage: 'x', cost: 0 }),
          ],
          monsters: [
            {
              card: dragon('Œuf X', { stage: 'egg', atk: 0, hp: 300 }),
              patch: { hatchCounter: 1, hatchStage: 'baby' },
            },
          ],
        },
      });
      passTurn(engine, game);
      passTurn(engine, game);
      expect(pickFirst(game)).toEqual({});
      expect(evolveOn(game, 'Bébé X')).toEqual({});
      expect(monsterNamed(game, 'p1', 'Jeune X')).toBeDefined();
    });

    it('le Jeune invoqué par la mort de la Dualité pendant mon tour peut évoluer', () => {
      const game = tueEtInvoque('egg');
      expect(evolveOn(game, 'Jeune D')).toEqual({});
      expect(monsterNamed(game, 'p1', 'Adulte D')).toBeDefined();
    });

    it('un monstre invoqué depuis le deck par un non-œuf attend toujours', () => {
      const game = tueEtInvoque('baby');
      expect(evolveOn(game, 'Jeune D').error).toBe(
        "Jeune D doit attendre un tour avant d'évoluer",
      );
    });
  });

  describe("transformation d'un Jeune ou d'un Adulte coincé en main", () => {
    const feros = (name: string, stage: 'baby' | 'young' | 'adult') =>
      dragon(name, { stage, lineage: 'feros' });
    const kind = (stage: 'baby' | 'young' | 'adult', name: string = stage) =>
      feros(name, stage);

    it('défausse le Jeune et propose les Bébés du deck et du cimetière', () => {
      const game = scenario({
        p1: {
          hand: [kind('young', 'Jeune Feros')],
          deck: [
            kind('baby', 'Bébé Deck'),
            dragon('Autre Lignée', { stage: 'baby', lineage: 'aqua' }),
          ],
          graveyard: [kind('baby', 'Bébé Cimetière')],
        },
      });
      expect(
        engine.dispatch(game, 'p1', { type: 'transform', handIndex: 0 }),
      ).toEqual({});
      expect(handNames(game, 'p1')).toEqual([]);
      expect(graveyardNames(game, 'p1')).toContain('Jeune Feros');
      expect(game.pendingChoices).toHaveLength(1);
      expect(game.pendingChoices[0]).toMatchObject({
        forUserId: P1_ID,
        count: 1,
        resolution: 'pick_to_hand',
      });
      expect(
        game.pendingChoices[0].candidates.map((c) => [
          c.baseCard.name,
          c.source,
        ]),
      ).toEqual([
        ['Bébé Cimetière', 'graveyard'],
        ['Bébé Deck', 'deck'],
      ]);
    });

    it('choisir le Bébé du cimetière le met en main, deck inchangé', () => {
      const game = scenario({
        p1: {
          hand: [kind('adult', 'Adulte Feros')],
          deck: [kind('baby', 'Bébé Deck')],
          graveyard: [kind('baby', 'Bébé Cimetière')],
        },
      });
      const deckBefore = game.player1.deck.map((c) => c.instanceId);
      engine.dispatch(game, 'p1', { type: 'transform', handIndex: 0 });
      const choice = game.pendingChoices[0];
      const wanted = choice.candidates.find((c) => c.source === 'graveyard')!;
      expect(
        engine.dispatch(game, 'p1', {
          type: 'pick_cards',
          instanceIds: [wanted.instanceId],
        }),
      ).toEqual({});
      expect(handNames(game, 'p1')).toEqual(['Bébé Cimetière']);
      expect(game.player1.deck.map((c) => c.instanceId)).toEqual(deckBefore);
    });

    it('une seule transformation par tour, de nouveau permise au tour suivant', () => {
      const game = scenario({
        p1: {
          hand: [kind('young', 'Jeune 1'), kind('young', 'Jeune 2')],
          graveyard: [kind('baby', 'Bébé A'), kind('baby', 'Bébé B')],
        },
      });
      engine.dispatch(game, 'p1', { type: 'transform', handIndex: 0 });
      engine.dispatch(game, 'p1', {
        type: 'pick_cards',
        instanceIds: [game.pendingChoices[0].candidates[0].instanceId],
      });
      expect(game.player1.hand.map((c) => c.baseCard.name)).toContain(
        'Jeune 2',
      );
      const handBefore = handNames(game, 'p1');
      expect(
        engine.dispatch(game, 'p1', {
          type: 'transform',
          handIndex: handBefore.indexOf('Jeune 2'),
        }),
      ).toEqual({
        error: 'Une seule transformation par tour',
      });
      expect(handNames(game, 'p1')).toEqual(handBefore);

      passTurn(engine, game);
      passTurn(engine, game);
      expect(game.currentTurnUserId).toBe(P1_ID);
      const idx = handNames(game, 'p1').indexOf('Jeune 2');
      expect(
        engine.dispatch(game, 'p1', { type: 'transform', handIndex: idx }),
      ).toEqual({});
    });

    it('sans Bébé de la lignée : refusé, la main ne change pas', () => {
      const game = scenario({
        p1: {
          hand: [kind('young', 'Jeune Feros')],
          deck: [dragon('Bébé Aqua', { stage: 'baby', lineage: 'aqua' })],
          graveyard: [kind('adult', 'Adulte Feros')],
        },
      });
      expect(
        engine.dispatch(game, 'p1', { type: 'transform', handIndex: 0 }),
      ).toEqual({
        error: 'Aucun Bébé feros à récupérer',
      });
      expect(handNames(game, 'p1')).toEqual(['Jeune Feros']);
      expect(game.pendingChoices).toHaveLength(0);
      // l'échec ne consomme pas la transformation du tour
      expect(game.player1.transformUsedThisTurn).toBe(false);
    });

    it('refusé hors phase principale, hors de son tour et sur un Bébé', () => {
      const mk = (over: Parameters<typeof scenario>[0] = {}) =>
        scenario({
          p1: {
            hand: [kind('young', 'Jeune Feros')],
            graveyard: [kind('baby', 'Bébé Feros')],
          },
          ...over,
        });
      expect(
        engine.dispatch(mk({ phase: 'battle' }), 'p1', {
          type: 'transform',
          handIndex: 0,
        }).error,
      ).toBe('Phase principale uniquement');
      expect(
        engine.dispatch(mk({ turn: 'p2' }), 'p1', {
          type: 'transform',
          handIndex: 0,
        }).error,
      ).toBe("Ce n'est pas ton tour");
      const bebe = scenario({
        p1: {
          hand: [kind('baby', 'Bébé Feros')],
          graveyard: [kind('baby', 'Autre Bébé')],
        },
      });
      expect(
        engine.dispatch(bebe, 'p1', { type: 'transform', handIndex: 0 }).error,
      ).toBe('Seul un Jeune ou un Adulte peut se transformer');
      expect(handNames(bebe, 'p1')).toEqual(['Bébé Feros']);
    });
  });
});
