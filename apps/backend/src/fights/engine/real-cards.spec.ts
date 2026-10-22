import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { effectiveAtk } from '../helpers/game-state.helper';
import { realCard } from '../testing/real-cards';
import {
  attackWith,
  graveyardNames,
  handNames,
  monsterNamed,
  passTurn,
  scenario,
} from '../testing/scenario';

const engine = createEngine();

describe('vraies cartes — combos', () => {
  it('Noyau Delta + Module .v2 : +600 ATK', () => {
    const game = scenario({
      p1: {
        monsters: [
          {
            card: realCard('Noyau Delta'),
            equipments: [realCard('Module Bluetooth .v2')],
          },
        ],
      },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Noyau Delta').atkBuff).toBe(600);
  });

  it('Lieutenants Bidouille et Fripouille : +150/+150 seulement ensemble', () => {
    const game = scenario({
      p1: {
        monsters: [
          realCard('Lieutenant Bidouille'),
          realCard('Lieutenant Fripouille'),
        ],
      },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Lieutenant Bidouille').atkBuff).toBe(150);
    expect(monsterNamed(game, 'p1', 'Lieutenant Fripouille').atkBuff).toBe(150);
  });

  it('Commandant Quenouille ne peut pas attaquer le tour de son invocation', () => {
    const game = scenario({
      p1: { hand: [realCard('Commandant Quenouille')], recycleEnergy: 2 },
      p2: { monsters: [monsterCard('Mur', { atk: 0, hp: 99_999 })] },
    });
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });
    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(
      attackWith(engine, game, 'p1', 'Commandant Quenouille', 'Mur').error,
    ).toContain('ne peut pas attaquer');
  });

  it("Noyau Zeta : posé chez l'adversaire, il rapporte une Prime au poseur après 3 de ses tours", () => {
    const game = scenario({
      p1: { hand: [realCard('Noyau Zeta')], recycleEnergy: 2 },
    });
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
      onOpponentSide: true,
    });

    for (let i = 0; i < 6; i++) passTurn(engine, game);

    expect(game.player1.primes).toBe(5);
    expect(graveyardNames(game, 'p1')).toContain('Noyau Zeta');
  });

  it("Clairon de l'Union : +2 énergie en jeu, une pioche s'il est recyclé", () => {
    const game = scenario({
      p1: {
        hand: [realCard("Clairon de l'Union"), realCard("Clairon de l'Union")],
        deck: [monsterCard('Renfort')],
      },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
    engine.dispatch(game, 'p1', { type: 'recycle', handIndex: 0 });

    expect(game.player1.recycleEnergy).toBe(3);
    expect(handNames(game, 'p1')).toEqual(['Renfort']);
  });

  it("Chevalier Touille devient gratuit après l'invocation d'un pipou", () => {
    const game = scenario({
      p1: {
        hand: [
          realCard('Lieutenant Fripouille'),
          realCard('Chevalier Touille'),
        ],
        recycleEnergy: 1,
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
    });

    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 1,
        paymentHandIndices: [],
      }),
    ).toEqual({});
  });

  it("Soin d'urgence avec Médecin Citrouille : +600 puis +200", () => {
    const game = scenario({
      p1: {
        hand: [realCard("Soin d'urgence")],
        monsters: [
          { card: monsterCard('Blessé', { hp: 2000 }), currentHp: 100 },
          realCard('Médecin Citrouille'),
        ],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Blessé').instanceId,
    });

    expect(monsterNamed(game, 'p1', 'Blessé').currentHp).toBe(900);
  });

  it('Rootkit de Transmission ne force que le monstre choisi', () => {
    const game = scenario({
      p1: { hand: [realCard('Rootkit de Transmission')] },
      p2: {
        monsters: [
          { card: monsterCard('Lutin'), mode: 'guard' },
          { card: monsterCard('Golem'), mode: 'guard' },
        ],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p2', 'Golem').instanceId,
    });

    expect(monsterNamed(game, 'p2', 'Golem')).toMatchObject({
      mode: 'attack',
      forcedAttackMode: true,
    });
    expect(monsterNamed(game, 'p2', 'Lutin').mode).toBe('guard');
  });

  it('Canon à Particules : +250 ATK et Perçant une fois équipé', () => {
    const game = scenario({
      p1: {
        monsters: [monsterCard('Porteur')],
        hand: [realCard('Canon à Particules .vxd')],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Porteur').instanceId,
    });

    expect(monsterNamed(game, 'p1', 'Porteur')).toMatchObject({
      atkBuff: 250,
      hasPiercing: true,
    });
  });

  it('Champion Ouille-Ouille : +300 PV max à chaque allié adjacent', () => {
    const game = scenario({
      p1: {
        monsters: [
          monsterCard('Gauche'),
          realCard('Champion Ouille-Ouille'),
          monsterCard('Droite'),
        ],
      },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Gauche').hpBuff).toBe(300);
    expect(monsterNamed(game, 'p1', 'Droite').hpBuff).toBe(300);
    expect(monsterNamed(game, 'p1', 'Champion Ouille-Ouille').hpBuff).toBe(0);
  });

  it('Général Chatouille : +200 ATK à ses coéquipiers dès la Battle Phase', () => {
    const game = scenario({
      p1: {
        monsters: [realCard('Général Chatouille'), monsterCard('Soldat')],
      },
    });

    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(monsterNamed(game, 'p1', 'Soldat').tempAtkBuff).toBe(200);
    expect(monsterNamed(game, 'p1', 'Général Chatouille').tempAtkBuff).toBe(0);
  });

  it('Ouille au rapport ne se joue pas sans carte pipou commune à récupérer', () => {
    const game = scenario({
      p1: { hand: [realCard('Ouille au rapport')] },
    });

    expect(
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 }).error,
    ).toBe("Cette carte n'aurait aucun effet pour l'instant");
  });

  it('Pixel Ghost .tmp : sa destruction propose de chercher un Noyau', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 2000, hp: 2000 })] },
      p2: {
        monsters: [realCard('Pixel Ghost .tmp')],
        deck: [monsterCard('Bouche-trou'), realCard('Noyau Beta')],
      },
    });

    attackWith(engine, game, 'p1', 'Ogre', 'Pixel Ghost .tmp');

    expect(game.pendingChoices[0]).toMatchObject({
      forUserId: game.player2.userId,
      resolution: 'pick_to_hand',
    });
    expect(
      game.pendingChoices[0].candidates.map((c) => c.baseCard.name),
    ).toEqual(['Noyau Beta']);
  });

  describe('rééquilibrage Drakon / Pixelman / Zeta', () => {
    const candidateNames = (game: ReturnType<typeof scenario>) =>
      game.pendingChoices[0]?.candidates.map((c) => c.baseCard.name);

    it('Mont Drakon : au début du tour, propose les monstres Drakon du deck et du cimetière', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Mont Drakon')],
          deck: [
            monsterCard('Pioche'),
            realCard('Bébé Teros'),
            realCard('Potion de Lucidité'),
          ],
          graveyard: [realCard('Jeune Feros'), monsterCard('Pipou')],
        },
      });
      expect(
        engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          zoneIndex: 0,
        }),
      ).toEqual({});
      passTurn(engine, game);
      passTurn(engine, game);

      expect(candidateNames(game)?.sort()).toEqual(
        ['Bébé Teros', 'Jeune Feros'].sort(),
      );
    });

    it('Mont Drakon sans monstre Drakon : aucun choix, une ligne de log', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Mont Drakon')],
          deck: [monsterCard('Pioche')],
          graveyard: [realCard('Potion de Lucidité')],
        },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        zoneIndex: 0,
      });
      passTurn(engine, game);
      game.log.length = 0;
      passTurn(engine, game);

      expect(game.pendingChoices).toEqual([]);
      expect(
        game.log.filter((l) => l.includes('Mont Drakon — aucune carte')),
      ).toHaveLength(1);
    });

    it('Appel des ancêtres : propose 2 cartes Drakon du cimetière', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Appel des ancêtres')],
          graveyard: [
            realCard('Bébé Teros'),
            monsterCard('Pipou'),
            realCard('Jeune Feros'),
            realCard('Adulte Teros'),
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

      expect(game.pendingChoices[0].count).toBe(2);
      // La carte jouée est déjà au cimetière mais ne se propose pas elle-même.
      expect(candidateNames(game)).toEqual([
        'Bébé Teros',
        'Jeune Feros',
        'Adulte Teros',
      ]);
    });

    it('Mise à jour Système seule au cimetière : injouable, elle ne se récupère pas', () => {
      const game = scenario({
        p1: { hand: [realCard('Mise à jour Système')] },
      });
      const res = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
      });
      expect(res.error).toBe("Cette carte n'aurait aucun effet pour l'instant");
      expect(game.pendingChoices).toEqual([]);
    });

    it('Mise à jour Système ne se propose pas elle-même mais propose un autre support Pixelman', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Mise à jour Système')],
          graveyard: [realCard('Firewall .sys')],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(candidateNames(game)).toEqual(['Firewall .sys']);
    });

    it('Force Plasma : injouable sans Noyau, jouable avec Noyau Delta', () => {
      const cible = () => ({ monsters: [monsterCard('Cible', { hp: 500 })] });
      const sans = scenario({
        p1: { hand: [realCard('Force Plasma')] },
        p2: cible(),
      });
      const refus = engine.dispatch(sans, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(sans, 'p2', 'Cible').instanceId,
      });
      expect(refus.error).toBeDefined();
      expect(graveyardNames(sans, 'p2')).not.toContain('Cible');

      const avec = scenario({
        p1: {
          hand: [realCard('Force Plasma')],
          monsters: [realCard('Noyau Delta')],
        },
        p2: cible(),
      });
      const result = engine.dispatch(avec, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(avec, 'p2', 'Cible').instanceId,
      });
      expect(result.error).toBeUndefined();
      expect(graveyardNames(avec, 'p2')).toContain('Cible');
    });

    it('Formatage .exe : détruit l’allié puis propose un monstre Pixelman du cimetière', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Formatage .exe')],
          monsters: [monsterCard('Sacrifié')],
          graveyard: [
            realCard('Noyau Beta'),
            realCard('Firewall .sys'),
            monsterCard('Pipou'),
          ],
        },
      });
      const result = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Sacrifié').instanceId,
      });

      expect(result.error).toBeUndefined();
      expect(graveyardNames(game, 'p1')).toContain('Sacrifié');
      expect(candidateNames(game)).toEqual(['Noyau Beta']);
    });

    it('Module de Réparation .exe : +400 PV max au porteur', () => {
      const game = scenario({
        p1: {
          monsters: [
            {
              card: monsterCard('Porteur', { hp: 1000 }),
              equipments: [realCard('Module de Réparation .exe')],
            },
          ],
        },
      });
      engine.settle(game);

      expect(monsterNamed(game, 'p1', 'Porteur').hpBuff).toBe(400);
    });

    it('Noyau Zeta réel : 1200 PV, virus de 300 ATK, explosion de 500 à l’autodestruction', () => {
      expect(realCard('Noyau Zeta').hp).toBe(1200);
      const game = scenario({
        p1: { hand: [realCard('Noyau Zeta')], recycleEnergy: 2 },
        p2: { monsters: [monsterCard('Hôte', { atk: 1000, hp: 2000 })] },
      });
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 1,
        paymentHandIndices: [],
        onOpponentSide: true,
      });
      engine.settle(game);
      expect(effectiveAtk(monsterNamed(game, 'p2', 'Hôte'))).toBe(700);

      for (let i = 0; i < 6; i++) passTurn(engine, game);

      expect(monsterNamed(game, 'p2', 'Hôte').currentHp).toBe(1500);
      expect(effectiveAtk(monsterNamed(game, 'p2', 'Hôte'))).toBe(1000);
    });
  });
});
