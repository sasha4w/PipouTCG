import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  attackWith,
  handNames,
  monsterNamed,
  scenario,
} from '../testing/scenario';

describe('cartes retravaillées', () => {
  const engine = createEngine();
  const summon = (game: ReturnType<typeof scenario>, zoneIndex = 1) =>
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex,
      paymentHandIndices: [],
    });

  it('Ouille au rapport : 2 cartes, 3 avec un Capitaine', () => {
    const graveyard = [
      'Recrue Andouille',
      'Éclaireur Nouille',
      'Guerrier Bafouille',
      'Canouille le Bleu',
    ].map(realCard);
    const sans = scenario({
      p1: { hand: [realCard('Ouille au rapport')], graveyard },
    });
    engine.dispatch(sans, 'p1', { type: 'play_support', handIndex: 0 });
    expect(sans.pendingChoices[0].count).toBe(2);

    const avec = scenario({
      p1: {
        hand: [realCard('Ouille au rapport')],
        graveyard,
        monsters: [realCard('Capitaine Gribouille')],
      },
    });
    engine.dispatch(avec, 'p1', { type: 'play_support', handIndex: 0 });
    expect(avec.pendingChoices[0].count).toBe(3);
  });

  it('Module Bluetooth .v2 sur Beta : 600 à tous les ennemis à l’équipement', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Module Bluetooth .v2')],
        monsters: [realCard('Noyau Beta')],
      },
      p2: { monsters: [monsterCard('Lutin', { hp: 1000 })] },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Beta').instanceId,
    });
    expect(monsterNamed(game, 'p2', 'Lutin').currentHp).toBe(400);
  });

  it('Module Bluetooth .v2 sur Alpha : 2 attaques par tour', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Module Bluetooth .v2')],
        monsters: [realCard('Noyau Alpha')],
      },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Alpha').instanceId,
    });
    expect(monsterNamed(game, 'p1', 'Noyau Alpha').attacksPerTurn).toBe(2);
  });

  it('Firewall de Surcharge .sys sur Delta : ignore la Provocation', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Firewall de Surcharge .sys')],
        monsters: [realCard('Noyau Delta')],
      },
      p2: {
        monsters: [
          {
            card: realCard('Sentinelle Gargouille'),
            // Posée sans invocation : Provocation fournie directement
            patch: {
              perm: {
                atk: 0,
                hp: 0,
                taunt: true,
                piercing: false,
                debuffImmune: false,
                attacksPerTurn: 1,
              },
            },
          },
          monsterCard('Cible', { hp: 5000 }),
        ],
      },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Delta').instanceId,
    });
    engine.dispatch(game, 'p1', { type: 'end_phase' });
    expect(attackWith(engine, game, 'p1', 'Noyau Delta', 'Cible')).toEqual({});
  });

  it('Éclaireur Nouille : pioche une carte à l’invocation', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Éclaireur Nouille')],
        deck: [monsterCard('Pioche')],
        recycleEnergy: 3,
      },
    });
    summon(game);
    expect(handNames(game, 'p1')).toEqual(['Pioche']);
  });

  it('Canouille le Bleu : 100 dégâts à tous les ennemis', () => {
    const game = scenario({
      p1: { hand: [realCard('Canouille le Bleu')], recycleEnergy: 3 },
      p2: {
        monsters: [
          monsterCard('A', { hp: 500 }),
          monsterCard('B', { hp: 500 }),
        ],
      },
    });
    summon(game);
    expect(monsterNamed(game, 'p2', 'A').currentHp).toBe(400);
    expect(monsterNamed(game, 'p2', 'B').currentHp).toBe(400);
  });

  it('Sentinelle Gargouille : Provocation', () => {
    const game = scenario({
      p1: { hand: [realCard('Sentinelle Gargouille')], recycleEnergy: 3 },
    });
    summon(game);
    expect(monsterNamed(game, 'p1', 'Sentinelle Gargouille').hasTaunt).toBe(
      true,
    );
  });

  it('Recrue Andouille : mode Attaque forcé, +200 ATK en phase de combat', () => {
    const game = scenario({
      p1: { hand: [realCard('Recrue Andouille')], recycleEnergy: 3 },
    });
    summon(game);
    const recrue = monsterNamed(game, 'p1', 'Recrue Andouille');
    expect(recrue.forcedAttackMode).toBe(true);
    engine.dispatch(game, 'p1', { type: 'end_phase' });
    expect(recrue.tempAtkBuff).toBe(200);
  });

  it('Guerrier Bafouille : +100 ATK quand il attaque', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [realCard('Guerrier Bafouille')] },
      p2: { monsters: [monsterCard('Cible', { atk: 0, hp: 1000 })] },
    });
    attackWith(engine, game, 'p1', 'Guerrier Bafouille', 'Cible');
    expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(700);
  });

  it('Caporal Gazouille : +100 ATK aux alliés adjacents', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Caporal Gazouille')],
        monsters: [monsterCard('Gauche'), null, monsterCard('Droite')],
        recycleEnergy: 3,
      },
    });
    summon(game, 1);
    expect(monsterNamed(game, 'p1', 'Gauche').atkBuff).toBe(100);
    expect(monsterNamed(game, 'p1', 'Droite').atkBuff).toBe(100);
  });

  describe('Maître Magouille', () => {
    const magouilleSeule = (hand: ReturnType<typeof realCard>[]) =>
      scenario({
        p1: {
          hand,
          monsters: [realCard('Noyau Beta'), realCard('Noyau Delta')],
        },
        p2: {
          monsters: [
            {
              card: realCard('Maître Magouille'),
              patch: {
                perm: {
                  atk: 0,
                  hp: 0,
                  taunt: false,
                  piercing: false,
                  debuffImmune: true,
                  attacksPerTurn: 1,
                },
                isImmuneToDebuffs: true,
              },
            },
          ],
        },
      });

    it.each([
      'Force Plasma',
      'Rootkit de Transmission',
      'Protocole de Gel .frz',
      'Verrou de Position .lock',
    ])('%s ne peut pas le cibler', (name) => {
      const game = magouilleSeule([realCard(name)]);
      const res = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Maître Magouille')
          .instanceId,
      });
      expect(res.error).toBe('Aucune cible valide pour cette carte');
      expect(handNames(game, 'p1')).toEqual([name]);
    });

    it('Module Bluetooth .v2 sur Beta ne touche pas Magouille', () => {
      const game = magouilleSeule([realCard('Module Bluetooth .v2')]);
      const hp = monsterNamed(game, 'p2', 'Maître Magouille').currentHp;
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Noyau Beta').instanceId,
      });
      expect(monsterNamed(game, 'p2', 'Maître Magouille').currentHp).toBe(hp);
    });
  });

  describe('Éphémères destructeurs vs bouclier Support', () => {
    it('Recyclage .bat ne peut pas viser son propre Beta protégé', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Recyclage .bat')],
          deck: [monsterCard('Pioche')],
          monsters: [
            {
              card: realCard('Noyau Beta'),
              patch: { supportDestroyImmune: true },
            },
          ],
        },
      });
      const res = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Noyau Beta').instanceId,
      });
      expect(res.error).toBe('Aucune cible valide pour cette carte');
      expect(handNames(game, 'p1')).toEqual(['Recyclage .bat']);
    });

    it('Recyclage .bat sur Beta protégé avec un autre allié : erreur dédiée', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Recyclage .bat')],
          deck: [monsterCard('Pioche')],
          monsters: [
            {
              card: realCard('Noyau Beta'),
              patch: { supportDestroyImmune: true },
            },
            monsterCard('Autre'),
          ],
        },
      });
      const res = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Noyau Beta').instanceId,
      });
      expect(res.error).toBe(
        'Ce monstre ne peut pas être détruit par une carte Support',
      );
      expect(handNames(game, 'p1')).toEqual(['Recyclage .bat']);
    });

    it('Force Plasma inflige 1500 dégâts, même à un monstre protégé des destructions', () => {
      const game = scenario({
        p1: {
          hand: [realCard('Force Plasma')],
          monsters: [realCard('Noyau Delta')],
        },
        p2: {
          monsters: [
            {
              card: monsterCard('Mur', { hp: 3000 }),
              patch: { supportDestroyImmune: true },
            },
          ],
        },
      });
      const res = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Mur').instanceId,
      });
      expect(res.error).toBeUndefined();
      expect(monsterNamed(game, 'p2', 'Mur').currentHp).toBe(1500);
    });
  });
});
