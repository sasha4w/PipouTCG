import { freshCandidates } from '../helpers/game-state.helper';
import type { GameState } from '../interfaces/game-state.interface';
import { fillerCard, monsterCard } from '../testing/cards';
import { P1_ID, P2_ID, scenario, seatState } from '../testing/scenario';
import { determinize } from './determinize';
import { seeded } from './tournament';

const named = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => fillerCard(`${prefix}${i}`));

function game(): GameState {
  return scenario({
    turn: 'p1',
    p1: {
      hand: named('MaMain', 2),
      deck: named('MonDeck', 6),
      monsters: [monsterCard('Lame', { atk: 100, hp: 500 })],
      graveyard: named('MonCim', 1),
    },
    p2: {
      hand: named('SaMain', 3),
      deck: named('SonDeck', 6),
      monsters: [monsterCard('Mur', { atk: 0, hp: 900 })],
      graveyard: named('SonCim', 1),
    },
  });
}

const ids = (cards: { instanceId: string }[]) =>
  cards.map((c) => c.instanceId).sort();

describe('determinize', () => {
  it("ne modifie pas l'état d'origine", () => {
    const g = game();
    const before = structuredClone(g);
    determinize(g, 'p1', seeded(3));
    expect(g).toEqual(before);
  });

  it('garde ma main, les terrains et les cimetières', () => {
    const g = game();
    const copy = determinize(g, 'p1', seeded(3));
    expect(copy.player1.hand).toEqual(g.player1.hand);
    for (const seat of ['p1', 'p2'] as const) {
      expect(seatState(copy, seat).monsterZones).toEqual(
        seatState(g, seat).monsterZones,
      );
      expect(seatState(copy, seat).supportZones).toEqual(
        seatState(g, seat).supportZones,
      );
      expect(seatState(copy, seat).graveyard).toEqual(
        seatState(g, seat).graveyard,
      );
    }
  });

  it('conserve les tailles et le contenu du pool adverse', () => {
    const g = game();
    const copy = determinize(g, 'p1', seeded(3));
    const [o, c] = [g.player2, copy.player2];
    expect(c.hand).toHaveLength(o.hand.length);
    expect(c.deck).toHaveLength(o.deck.length);
    expect(c.primeDeck).toHaveLength(o.primeDeck.length);
    expect(ids([...c.hand, ...c.deck, ...c.primeDeck])).toEqual(
      ids([...o.hand, ...o.deck, ...o.primeDeck]),
    );
  });

  it('redistribue la main adverse, de façon reproductible', () => {
    const g = game();
    const a = determinize(g, 'p1', seeded(3));
    const b = determinize(g, 'p1', seeded(3));
    expect(ids(a.player2.hand)).not.toEqual(ids(g.player2.hand));
    expect(a).toEqual(b);
  });

  it('mélange mon deck sans toucher à son contenu ni à mes Primes', () => {
    const g = game();
    // Une carte de mon deck parmi mes Primes : elle ne doit pas passer au deck
    g.player1.primeDeck[0] = g.player1.deck.pop()!;
    const copy = determinize(g, 'p1', seeded(3));
    expect(ids(copy.player1.deck)).toEqual(ids(g.player1.deck));
    expect(ids(copy.player1.primeDeck)).toEqual(ids(g.player1.primeDeck));
  });

  it('laisse en place une carte adverse citée par un choix en attente', () => {
    const g = game();
    const cited = g.player2.hand[1];
    g.pendingChoices.push({
      forUserId: P2_ID,
      candidates: [{ ...cited, source: 'hand' }],
      count: 1,
      prompt: 'test',
    });
    for (let s = 1; s <= 5; s++) {
      const copy = determinize(g, 'p1', seeded(s));
      expect(copy.player2.hand[1].instanceId).toBe(cited.instanceId);
    }
  });

  it("un choix de l'IA dans son deck reste valide", () => {
    const g = game();
    const choice = {
      forUserId: P1_ID,
      candidates: g.player1.deck
        .slice(0, 3)
        .map((c) => ({ ...c, source: 'deck' as const })),
      count: 1,
      prompt: 'test',
    };
    g.pendingChoices.push(choice);
    const copy = determinize(g, 'p1', seeded(3));
    expect(freshCandidates(copy, copy.pendingChoices[0])).toHaveLength(3);
  });
});
