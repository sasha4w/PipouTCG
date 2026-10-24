import type { Card } from '../../cards/card.entity';
import { effectiveAtk } from '../helpers/game-state.helper';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import type { MonsterSpec } from '../testing/scenario';
import {
  attackWith,
  graveyardNames,
  monsterNamed,
  passTurn,
  scenario,
  seatState,
} from '../testing/scenario';

const engine = createEngine();
const recalc = (game: GameState) =>
  engine.dispatch(game, game.currentTurnUserId === 1 ? 'p1' : 'p2', {
    type: 'end_phase',
  });

describe('vraies cartes du patch Garde', () => {
  it('Tactique Gang Gang : +300 ATK aux Pipou seulement', () => {
    const game = scenario({
      p1: {
        supports: [realCard('Tactique Gang Gang')],
        monsters: [
          monsterCard('Soldat', { atk: 100, archetype: 'pipou' }),
          monsterCard('Drakon', { atk: 100, archetype: 'dragon' }),
        ],
      },
    });
    recalc(game);
    expect(effectiveAtk(monsterNamed(game, 'p1', 'Soldat'))).toBe(400);
    expect(effectiveAtk(monsterNamed(game, 'p1', 'Drakon'))).toBe(100);
  });

  it('Mise à jour .patch : propose 2 monstres Pixelman du cimetière', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Mise à jour .patch')],
        graveyard: [
          realCard('Noyau Alpha'),
          realCard('Noyau Beta'),
          realCard('Bébé Teros'),
        ],
      },
    });
    expect(
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 }).error,
    ).toBeUndefined();
    const choice = game.pendingChoices[0];
    expect(choice.count).toBe(2);
    expect(choice.candidates.map((c) => c.baseCard.name).sort()).toEqual([
      'Noyau Alpha',
      'Noyau Beta',
    ]);
  });

  it('Surcharge Overclock : +500 ATK, −200 PV, un allié fragile meurt sans Prime', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Surcharge Overclock')],
        monsters: [
          monsterCard('Fort', { atk: 100, hp: 1000 }),
          monsterCard('Fragile', { atk: 100, hp: 200 }),
        ],
      },
    });
    expect(
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 }).error,
    ).toBeUndefined();
    const fort = monsterNamed(game, 'p1', 'Fort');
    expect(fort.currentHp).toBe(800);
    expect(effectiveAtk(fort)).toBe(600);
    expect(graveyardNames(game, 'p1')).toContain('Fragile');
    expect(seatState(game, 'p2').primes).toBe(6);
  });

  it('Œuf Céleste : éclot au 3e début de tour de son propriétaire', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Œuf Céleste')],
        recycleEnergy: 2,
        deck: [
          realCard('Adulte Feros'),
          ...Array.from({ length: 10 }, () => monsterCard('Filler')),
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
    for (let turn = 1; turn <= 2; turn++) {
      passTurn(engine, game);
      passTurn(engine, game);
      expect(monsterNamed(game, 'p1', 'Œuf Céleste')).toBeDefined();
    }
    passTurn(engine, game);
    passTurn(engine, game);
    expect(
      seatState(game, 'p1').monsterZones.some(
        (m) => m?.card.baseCard.name === 'Œuf Céleste',
      ),
    ).toBe(false);
  });

  it('Œuf Céleste : soigne les Drakons de 200, sans dépasser les PV max', () => {
    const game = scenario({
      p1: {
        monsters: [
          { card: realCard('Œuf Céleste'), patch: { hatchCounter: 3 } },
          {
            card: monsterCard('Blessé', { archetype: 'dragon', hp: 1000 }),
            currentHp: 500,
          },
          monsterCard('Plein', { archetype: 'dragon', hp: 1000 }),
        ],
      },
    });
    passTurn(engine, game);
    passTurn(engine, game);
    expect(monsterNamed(game, 'p1', 'Blessé').currentHp).toBe(700);
    expect(monsterNamed(game, 'p1', 'Plein').currentHp).toBe(1000);
  });

  it('Jeune Teros : renvoie 40 % après sa réduction', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'battle',
      p1: { monsters: [monsterCard('Lame', { atk: 400, hp: 1000 })] },
      p2: { monsters: [realCard('Jeune Teros')] },
    });
    recalc(game);
    game.phase = 'battle';
    expect(
      attackWith(engine, game, 'p1', 'Lame', 'Jeune Teros').error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p2', 'Jeune Teros').currentHp).toBe(1600);
    expect(monsterNamed(game, 'p1', 'Lame').currentHp).toBe(1000 - 300 - 80);
  });

  /** Main de p2 après la destruction de `defender` en Garde par un monstre géant. */
  function handAfterDeath(defender: Card): number {
    const spec: MonsterSpec = { card: defender, mode: 'guard' };
    const game = scenario({
      turn: 'p1',
      phase: 'battle',
      p1: { monsters: [monsterCard('Géant', { atk: 20000, hp: 50000 })] },
      p2: { monsters: [spec] },
    });
    recalc(game);
    game.phase = 'battle';
    attackWith(engine, game, 'p1', 'Géant', defender.name);
    expect(graveyardNames(game, 'p2')).toContain(defender.name);
    return seatState(game, 'p2').hand.length;
  }

  it.each(['Sentinelle Gargouille', 'Jeune Teros', 'Noyau Alpha'])(
    '%s détruit : son propriétaire pioche 1 carte',
    (name) => {
      const card = realCard(name);
      const plain = monsterCard(name, { atk: card.atk, hp: card.hp });
      expect(handAfterDeath(card) - handAfterDeath(plain)).toBe(1);
    },
  );

  it('Général Chatouille : Relève (2) sur un terrain plein de Pipou', () => {
    const pipou = (n: string) => monsterCard(n, { archetype: 'pipou' });
    const game = scenario({
      p1: {
        hand: [realCard('Général Chatouille')],
        monsters: [pipou('A'), pipou('B'), pipou('C')],
      },
    });
    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 0,
        paymentHandIndices: [],
        releveInstanceIds: ['A', 'B'].map(
          (n) => monsterNamed(game, 'p1', n).instanceId,
        ),
      }).error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Général Chatouille')).toBeDefined();
  });
});
