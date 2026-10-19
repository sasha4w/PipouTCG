import {
  CardType,
  DECK_RULES,
  Rarity,
  SupportType,
  type AdventureArchetype,
} from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import { allRealCards } from '../fights/testing/real-cards';
import { generateDeck } from './deck-generator';
import { LAUNCH_SIGNATURES, type Signature } from './signatures';

const ALL = allRealCards();
const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];
const LEVELS = [1, 2, 3, 4, 5] as const;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function setOf(a: AdventureArchetype): Card[] {
  return ALL.filter((c) => c.archetype === a);
}

/** mulberry32 : générateur déterministe. */
function rng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Entry = { cardId: number; quantity: number };
const total = (d: Entry[]) => d.reduce((s, e) => s + e.quantity, 0);
const byId = (cards: Card[]) => new Map(cards.map((c) => [c.id, c]));

describe('LAUNCH_SIGNATURES', () => {
  it.each(ARCHETYPES)('%s : 5 signatures dont la carte existe', (a) => {
    expect(LAUNCH_SIGNATURES[a]).toHaveLength(5);
    for (const s of LAUNCH_SIGNATURES[a]) {
      expect(s.archetype).toBe(a);
      expect(setOf(a).some((c) => c.name === s.cardName)).toBe(true);
    }
  });
});

describe('snapshot', () => {
  it('a la taille attendue des sets', () => {
    expect(setOf('pipou')).toHaveLength(27);
    expect(setOf('pixelman')).toHaveLength(26);
    expect(setOf('dragon')).toHaveLength(23);
  });
});

describe.each(ARCHETYPES)('generateDeck %s', (a) => {
  const set = setOf(a);
  const cards = byId(set);

  it.each(LEVELS)('niveau %i : deck valide', (level) => {
    const sig = LAUNCH_SIGNATURES[a][level - 1];
    for (const seed of SEEDS) {
      const deck = generateDeck(set, level, sig, rng(seed));
      const n = total(deck);
      expect(n).toBeGreaterThanOrEqual(DECK_RULES.MIN_CARDS);
      expect(n).toBeLessThanOrEqual(DECK_RULES.MAX_CARDS);
      expect(new Set(deck.map((e) => e.cardId)).size).toBe(deck.length);
      for (const e of deck) {
        expect(cards.has(e.cardId)).toBe(true);
        expect(e.quantity).toBeGreaterThanOrEqual(1);
        expect(e.quantity).toBeLessThanOrEqual(DECK_RULES.MAX_COPIES);
      }
    }
  });

  it.each(LEVELS)('niveau %i : contient la carte signature', (level) => {
    const sig = LAUNCH_SIGNATURES[a][level - 1];
    const sigCard = set.find((c) => c.name === sig.cardName)!;
    for (const seed of SEEDS) {
      const deck = generateDeck(set, level, sig, rng(seed));
      const e = deck.find((x) => x.cardId === sigCard.id);
      expect(e).toBeDefined();
      if (a === 'pixelman') {
        expect(e!.quantity).toBeGreaterThanOrEqual(2);
        expect(e!.quantity).toBeLessThanOrEqual(3);
      }
    }
  });

  it('est déterministe pour une même graine', () => {
    const sig = LAUNCH_SIGNATURES[a][2];
    expect(generateDeck(set, 3, sig, rng(7))).toEqual(
      generateDeck(set, 3, sig, rng(7)),
    );
  });

  it('la part de raretés épique+ ne décroît pas du niveau 1 au 5', () => {
    const high = [Rarity.EPIC, Rarity.LEGENDARY, Rarity.SECRET] as string[];
    const share = LEVELS.map((level) => {
      const sig = LAUNCH_SIGNATURES[a][level - 1];
      let acc = 0;
      for (const seed of SEEDS) {
        const deck = generateDeck(set, level, sig, rng(seed));
        const h = deck
          .filter((e) => high.includes(cards.get(e.cardId)!.rarity))
          .reduce((s, e) => s + e.quantity, 0);
        acc += h / total(deck);
      }
      return acc / SEEDS.length;
    });
    for (let i = 1; i < share.length; i++)
      expect(share[i]).toBeGreaterThanOrEqual(share[i - 1]);
    expect(share[4]).toBeGreaterThan(share[0]);
  });
});

describe('identité de chaque monde', () => {
  it('Pipou : au moins 60 % de monstres', () => {
    const set = setOf('pipou');
    const cards = byId(set);
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const deck = generateDeck(
          set,
          level,
          LAUNCH_SIGNATURES.pipou[level - 1],
          rng(seed),
        );
        const m = deck
          .filter((e) => cards.get(e.cardId)!.type === CardType.MONSTER)
          .reduce((s, e) => s + e.quantity, 0);
        expect(m / total(deck)).toBeGreaterThanOrEqual(0.6);
      }
  });

  it('Pipou : contient les cartes de boost d équipe', () => {
    const set = setOf('pipou');
    const ids = ["Clairon de l'Union", 'Tactique Gang Gang'].map(
      (n) => set.find((c) => c.name === n)!.id,
    );
    const deck = generateDeck(set, 3, LAUNCH_SIGNATURES.pipou[2], rng(5));
    for (const id of ids) expect(deck.some((e) => e.cardId === id)).toBe(true);
  });

  it('Pixelman : au moins 50 % de supports, tous les équipements', () => {
    const set = setOf('pixelman');
    const cards = byId(set);
    const equipments = set.filter(
      (c) => c.supportType === SupportType.EQUIPMENT,
    );
    expect(equipments.length).toBeGreaterThan(0);
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const deck = generateDeck(
          set,
          level,
          LAUNCH_SIGNATURES.pixelman[level - 1],
          rng(seed),
        );
        const s = deck
          .filter((e) => cards.get(e.cardId)!.type === CardType.SUPPORT)
          .reduce((x, e) => x + e.quantity, 0);
        expect(s / total(deck)).toBeGreaterThanOrEqual(0.5);
        for (const eq of equipments)
          expect(deck.some((e) => e.cardId === eq.id)).toBe(true);
      }
  });

  it('Pixelman : un seul noyau dans le deck', () => {
    const set = setOf('pixelman');
    const cards = byId(set);
    for (const level of LEVELS) {
      const deck = generateDeck(
        set,
        level,
        LAUNCH_SIGNATURES.pixelman[level - 1],
        rng(3),
      );
      const noyaux = deck.filter((e) =>
        cards.get(e.cardId)!.name.startsWith('Noyau'),
      );
      expect(noyaux).toHaveLength(1);
    }
  });

  it('Drakon : œuf, stades de l élément signature, bébé de chaque lignée jouée', () => {
    const set = setOf('dragon');
    const cards = byId(set);
    for (const level of LEVELS)
      for (const seed of SEEDS) {
        const sig = LAUNCH_SIGNATURES.dragon[level - 1];
        const deck = generateDeck(set, level, sig, rng(seed));
        const inDeck = new Set(deck.map((e) => e.cardId));
        expect(deck.some((e) => cards.get(e.cardId)!.stage === 'egg')).toBe(
          true,
        );
        if (level < 5) {
          const lineage = set.filter(
            (c) => c.element === sig.element && c.stage !== null,
          );
          expect(lineage).toHaveLength(3);
          for (const c of lineage) expect(inDeck.has(c.id)).toBe(true);
        } else {
          const complete = ['earth', 'fire', 'water', 'wind'].filter((el) =>
            set.filter((c) => c.element === el).every((c) => inDeck.has(c.id)),
          );
          expect(complete.length).toBeGreaterThanOrEqual(2);
        }
        // Jeune/Adulte ne se posent pas depuis la main : le bébé doit être là.
        for (const e of deck) {
          const c = cards.get(e.cardId)!;
          if (c.stage === 'young' || c.stage === 'adult')
            expect(
              set.some(
                (b) =>
                  b.stage === 'baby' &&
                  b.lineage === c.lineage &&
                  inDeck.has(b.id),
              ),
            ).toBe(true);
        }
      }
  });
});

describe('petits sets', () => {
  it('atteint 30 cartes avec 10 cartes distinctes (3 exemplaires)', () => {
    const small = setOf('pipou').slice(0, 10);
    const sig = { archetype: 'pipou', cardName: small[0].name } as Signature;
    const deck = generateDeck(small, 1, sig, rng(1));
    expect(total(deck)).toBeGreaterThanOrEqual(30);
    expect(deck.every((e) => e.quantity <= 3)).toBe(true);
  });

  it('lève une erreur si le set est trop petit (5 cartes)', () => {
    const small = setOf('pipou').slice(0, 5);
    const sig = { archetype: 'pipou', cardName: small[0].name } as Signature;
    expect(() => generateDeck(small, 1, sig, rng(1))).toThrow(/trop petit/);
  });
});

describe('robustesse', () => {
  it('échoue clairement si la carte signature est absente du set', () => {
    const sig: Signature = { archetype: 'pipou', cardName: 'Inconnu' };
    expect(() => generateDeck(setOf('pipou'), 1, sig, rng(1))).toThrow();
  });
});
