import { monsterCard } from '../../testing/cards';
import { scenario } from '../../testing/scenario';
import { determinize } from '../determinize';
import { seeded } from '../tournament';
import {
  CARD_DIM,
  GLOBAL_DIM,
  SET_NAMES,
  compactPosition,
  encodePosition,
  expandPosition,
  isStaticCard,
  staticCardFeatures,
} from './encode';

function position() {
  return scenario({
    turn: 'p2',
    phase: 'battle',
    turnNumber: 5,
    p1: {
      primes: 4,
      hand: [monsterCard('Main A'), monsterCard('Main B')],
      deck: [
        monsterCard('Deck A'),
        monsterCard('Deck B'),
        monsterCard('Deck C'),
      ],
      monsters: [monsterCard('Colosse', { atk: 50, hp: 5000 })],
    },
    p2: {
      primes: 2,
      hand: [monsterCard('Ma main')],
      monsters: [monsterCard('Lame', { atk: 200, hp: 500 })],
    },
  });
}

describe('encodePosition', () => {
  it('dimensions fixes, 7 ensembles', () => {
    const pos = encodePosition(position(), 'p2', 'pipou');
    expect(pos.global).toHaveLength(GLOBAL_DIM);
    expect(Object.keys(pos.sets)).toEqual([...SET_NAMES]);
    for (const name of SET_NAMES)
      for (const card of pos.sets[name]) expect(card.x).toHaveLength(CARD_DIM);
  });

  it('valeurs attendues : global et monstre sur le plateau', () => {
    const pos = encodePosition(position(), 'p2', 'pipou');
    expect(pos.global[0]).toBe(1); // mon tour
    expect(pos.global[1]).toBeCloseTo(5 / 30);
    expect(pos.global[2]).toBeCloseTo(2 / 6); // mes primes
    expect(pos.global[3]).toBeCloseTo(4 / 6); // primes adverses
    expect(pos.global[4]).toBeCloseTo(1 / 7); // ma main
    expect(pos.global[5]).toBeCloseTo(2 / 7); // main adverse
    expect(pos.global[13]).toBe(1); // phase battle
    expect(pos.global[16]).toBe(1); // moi : pipou
    const [lame] = pos.sets.myMonsters;
    expect(lame.x[0]).toBe(1);
    expect(lame.x[2]).toBeCloseTo(0.2);
    expect(lame.x[3]).toBeCloseTo(0.5);
    expect(lame.x[18]).toBe(1);
    expect(lame.x[20]).toBeCloseTo(0.5);
    expect(pos.sets.oppMonsters).toHaveLength(1);
    expect(pos.sets.myHand).toHaveLength(1);
  });

  it('menace cachée : main + deck + Primes adverses, mon deck restant à part', () => {
    const game = position();
    const pos = encodePosition(game, 'p2', 'pipou');
    const opp = game.player1;
    expect(pos.sets.oppHidden).toHaveLength(
      opp.hand.length + opp.deck.length + opp.primeDeck.length,
    );
    const me = game.player2;
    expect(pos.sets.myRemaining).toHaveLength(
      me.deck.length + me.primeDeck.length,
    );
  });

  it('la répartition main / deck adverse n’influe pas (seul le multiensemble compte)', () => {
    const game = position();
    const shuffled = determinize(game, 'p2', seeded(3));
    expect(encodePosition(shuffled, 'p2', 'pipou')).toEqual(
      encodePosition(game, 'p2', 'pipou'),
    );
    const swapped = structuredClone(game);
    const opp = swapped.player1;
    [opp.hand[0], opp.deck[0]] = [opp.deck[0], opp.hand[0]];
    expect(encodePosition(swapped, 'p2', 'pipou')).toEqual(
      encodePosition(game, 'p2', 'pipou'),
    );
  });

  it('symétrie : camps inversés, même encodage', () => {
    const game = position();
    const mirrored = { ...game, player1: game.player2, player2: game.player1 };
    expect(encodePosition(mirrored, 'p1', 'pipou')).toEqual(
      encodePosition(game, 'p2', 'pipou'),
    );
  });

  it('cartes hors plateau statiques ; monstre posé dynamique', () => {
    const pos = encodePosition(position(), 'p2', 'pipou');
    for (const card of pos.sets.myHand) expect(isStaticCard(card.x)).toBe(true);
    expect(isStaticCard(pos.sets.myMonsters[0].x)).toBe(false);
  });

  it('compact puis développé : même position (à l’arrondi près)', () => {
    const game = position();
    const pos = encodePosition(game, 'p2', 'pipou');
    const cards: Record<string, number[]> = {};
    for (const p of [game.player1, game.player2])
      for (const c of [...p.hand, ...p.deck, ...p.primeDeck])
        cards[String(c.baseCard.id)] = staticCardFeatures(c.baseCard);
    const back = expandPosition(compactPosition(pos), cards);
    for (const name of SET_NAMES)
      back.sets[name].forEach((card, k) => {
        expect(card.i).toBe(pos.sets[name][k].i);
        card.x.forEach((v, d) =>
          expect(v).toBeCloseTo(pos.sets[name][k].x[d], 4),
        );
      });
  });
});

describe('staticCardFeatures', () => {
  it('stats nulles ou absentes : uniquement des nombres finis', () => {
    const card = monsterCard('Sans stats', {
      atk: null,
      hp: undefined,
      cost: null,
    } as never);
    const x = staticCardFeatures(card);
    expect(x).toHaveLength(CARD_DIM);
    expect(x.every(Number.isFinite)).toBe(true);
  });
});
