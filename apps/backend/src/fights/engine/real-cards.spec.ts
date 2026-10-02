import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
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
  it('Noyau Alpha + Module .v2 + Firewall .sys : Provocation et dégâts divisés par 2', () => {
    const game = scenario({
      p1: {
        monsters: [realCard('Noyau Alpha')],
        hand: [
          realCard("Module d'Extension .v2"),
          realCard('Firewall de Surcharge .sys'),
        ],
      },
    });
    const alpha = monsterNamed(game, 'p1', 'Noyau Alpha ');

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: alpha.instanceId,
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: alpha.instanceId,
    });

    expect(alpha.hasTaunt).toBe(true);
    expect(alpha.damageReduction).toBe(2);
  });

  it('Noyau Beta + Module .v2 : 300 + 400 dégâts à chaque début de tour', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p1: {
        monsters: [
          {
            card: realCard('Noyau Beta'),
            equipments: [realCard("Module d'Extension .v2")],
          },
        ],
      },
      p2: { monsters: [monsterCard('Cible', { hp: 1000 })] },
    });

    engine.dispatch(game, 'p2', { type: 'end_phase' });

    expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(300);
  });

  it("Noyau Delta + Firewall .sys : deux attaques par tour dès l'équipement", () => {
    const game = scenario({
      p1: {
        monsters: [realCard('Noyau Delta')],
        hand: [realCard('Firewall de Surcharge .sys')],
      },
      p2: { monsters: [monsterCard('Mur', { atk: 0, hp: 99_999 })] },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Delta').instanceId,
    });
    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(attackWith(engine, game, 'p1', 'Noyau Delta', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Noyau Delta', 'Mur')).toEqual({});
    expect(
      attackWith(engine, game, 'p1', 'Noyau Delta', 'Mur').error,
    ).toContain('toutes ses attaques');
  });

  it('Noyau Delta + Module .v2 : +600 ATK', () => {
    const game = scenario({
      p1: {
        monsters: [
          {
            card: realCard('Noyau Delta'),
            equipments: [realCard("Module d'Extension .v2")],
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
    expect(graveyardNames(game, 'p2')).toContain('Noyau Zeta');
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

  it('Canon à Particules : +400 ATK et Perçant une fois équipé', () => {
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
      atkBuff: 400,
      hasPiercing: true,
    });
  });

  it('Champion Ouille-Ouille : +300 PV par allié adjacent', () => {
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

    expect(monsterNamed(game, 'p1', 'Champion Ouille-Ouille').hpBuff).toBe(600);
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
});
