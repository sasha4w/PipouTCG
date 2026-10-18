import {
  CardType,
  DECK_RULES,
  DrakonElement,
  Rarity,
  SupportType,
} from '@pipou/shared';
import type { Card } from '../cards/card.entity';
import { normalizeCardName } from '../fights/effects/card-name';
import type { Signature } from './signatures';

export type DeckEntry = { cardId: number; quantity: number };
type Level = 1 | 2 | 3 | 4 | 5;

/** Taille visée des decks d'IA (sous le maximum de 40, au-dessus du minimum de 30). */
const TARGET_SIZE = 35;

/**
 * Multiplicateur de poids par rareté et par niveau : le niveau 1 écarte les
 * raretés hautes, le niveau 5 les favorise. Ordre : common, uncommon, rare,
 * epic, legendary, secret.
 */
const RARITY_WEIGHTS: Record<Level, Record<Rarity, number>> = {
  1: weights(4, 3, 1, 0.1, 0.05, 0.05),
  2: weights(3, 2.5, 1.2, 0.3, 0.15, 0.15),
  3: weights(2, 2, 1.5, 0.8, 0.5, 0.5),
  4: weights(1, 1.5, 1.8, 2, 1.5, 1.5),
  5: weights(0.4, 0.8, 1.5, 3.5, 4, 4),
};

function weights(
  common: number,
  uncommon: number,
  rare: number,
  epic: number,
  legendary: number,
  secret: number,
): Record<Rarity, number> {
  return {
    [Rarity.COMMON]: common,
    [Rarity.UNCOMMON]: uncommon,
    [Rarity.RARE]: rare,
    [Rarity.EPIC]: epic,
    [Rarity.LEGENDARY]: legendary,
    [Rarity.SECRET]: secret,
  };
}

/** Courbe de coût : on préfère les monstres peu chers pour pouvoir invoquer. */
function costMultiplier(card: Card): number {
  if (card.type !== CardType.MONSTER) return 1;
  if (card.cost <= 1) return 1.3;
  if (card.cost === 2) return 1;
  return 0.8;
}

interface Plan {
  /** Cartes imposées (signature, cartes clés de l'archétype). */
  forced: { card: Card; quantity: number }[];
  /** Poids de base d'une carte pour le tirage ; 0 = exclue. */
  baseWeight(card: Card, counts: ReadonlyMap<number, number>): number;
  /** Jouable selon les règles du moteur (repli pour atteindre le minimum). */
  playable?(card: Card, counts: ReadonlyMap<number, number>): boolean;
  /** Plafonds en nombre de cartes, relâchés si le set est trop petit. */
  maxMonsters?: number;
  maxSupports?: number;
}

const isMonster = (c: Card) => c.type === CardType.MONSTER;
const isSupport = (c: Card) => c.type === CardType.SUPPORT;
const isHighRarity = (c: Card) =>
  c.rarity === Rarity.EPIC ||
  c.rarity === Rarity.LEGENDARY ||
  c.rarity === Rarity.SECRET;

function findByName(cards: Card[], name: string): Card | undefined {
  const n = normalizeCardName(name);
  return cards.find((c) => normalizeCardName(c.name) === n);
}

/** Pipou, « l'union fait la force » : un maximum de monstres + boosts d'équipe. */
function pipouPlan(set: Card[], sig: Card): Plan {
  const forced = [{ card: sig, quantity: isHighRarity(sig) ? 2 : 3 }];
  for (const name of ["Clairon de l'Union", 'Tactique Gang Gang']) {
    const c = findByName(set, name);
    if (c && c.id !== sig.id) forced.push({ card: c, quantity: 2 });
  }
  return {
    forced,
    baseWeight: (c) => (isMonster(c) ? 3 : 1),
    maxSupports: Math.floor(TARGET_SIZE * 0.4),
  };
}

/** Pixelman : un noyau (2-3 ex.), tous les équipements, majorité de supports. */
function pixelmanPlan(set: Card[], sig: Card, random: () => number): Plan {
  const isNoyau = (c: Card) => isMonster(c) && c.name.startsWith('Noyau');
  const forced = [{ card: sig, quantity: 2 + (random() < 0.5 ? 1 : 0) }];
  for (const c of set)
    if (c.supportType === SupportType.EQUIPMENT && c.id !== sig.id)
      forced.push({ card: c, quantity: 1 });
  return {
    forced,
    baseWeight: (c) => {
      if (isNoyau(c)) return 0; // un seul noyau par deck
      if (c.supportType === SupportType.EQUIPMENT) return 3;
      return isSupport(c) ? 2 : 1;
    },
    maxMonsters: Math.floor(TARGET_SIZE * 0.45),
  };
}

const ELEMENTS = Object.values(DrakonElement);

/**
 * Drakon : œuf → bébé → jeune → adulte. Jeune et Adulte ne se posent pas depuis
 * la main (`canSummonFromHand`) : ils arrivent par évolution depuis le stade
 * précédent de la même lignée, ou par l'éclosion d'un œuf (qui les cherche dans
 * le deck). Un deck doit donc porter le bébé de chaque lignée qu'il joue.
 */
function dragonPlan(
  set: Card[],
  sig: Card,
  signature: Signature,
  level: Level,
  random: () => number,
): Plan {
  let elements: DrakonElement[];
  if (signature.element) elements = [signature.element];
  else {
    const pool = [...ELEMENTS];
    elements = [];
    while (elements.length < 2) {
      elements.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
  }

  const forced: Plan['forced'] = [];
  const qty = { baby: 3, young: 2, adult: 2 } as const;
  for (const c of set) {
    if (
      c.element &&
      elements.includes(c.element) &&
      c.stage &&
      c.stage !== 'egg'
    )
      forced.push({ card: c, quantity: qty[c.stage] });
  }

  const eggs = set.filter((c) => c.stage === 'egg');
  let egg: Card | undefined = sig.stage === 'egg' ? sig : undefined;
  if (!egg && eggs.length > 0) {
    const w = eggs.map((e) => RARITY_WEIGHTS[level][e.rarity]);
    let r = random() * w.reduce((a, b) => a + b, 0);
    egg = eggs.find((_, i) => (r -= w[i]) < 0) ?? eggs[0];
  }
  if (egg) forced.push({ card: egg, quantity: 2 });
  if (!forced.some((f) => f.card.id === sig.id))
    forced.push({ card: sig, quantity: 2 });

  const hasBaby = (c: Card, counts: ReadonlyMap<number, number>) =>
    set.some(
      (b) =>
        b.stage === 'baby' &&
        b.lineage === c.lineage &&
        (counts.get(b.id) ?? 0) > 0,
    );

  return {
    forced,
    playable: (c, counts) =>
      (c.stage !== 'young' && c.stage !== 'adult') || hasBaby(c, counts),
    baseWeight: (c, counts) => {
      if (c.stage === 'egg') return 1.5;
      if (c.stage === 'baby') return 0.5;
      if (c.stage === 'young' || c.stage === 'adult') {
        // Seulement si le bébé de la lignée est déjà dans le deck.
        return hasBaby(c, counts) ? 0.8 : 0;
      }
      return 1;
    },
  };
}

function pickWeighted<T>(items: T[], w: number[], random: () => number): T {
  let r = random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Génère le deck d'une IA à partir des cartes de son set, de son niveau (1..5)
 * et de sa signature. Pure : le hasard vient de `random`.
 */
export function generateDeck(
  setCards: Card[],
  level: Level,
  signature: Signature,
  random: () => number,
): DeckEntry[] {
  const sig = findByName(setCards, signature.cardName);
  if (!sig)
    throw new Error(
      `Carte signature « ${signature.cardName} » absente du set (${setCards.length} cartes)`,
    );

  const plan =
    signature.archetype === 'pipou'
      ? pipouPlan(setCards, sig)
      : signature.archetype === 'pixelman'
        ? pixelmanPlan(setCards, sig, random)
        : dragonPlan(setCards, sig, signature, level, random);

  const counts = new Map<number, number>();
  let size = 0;
  let monsters = 0;
  let supports = 0;
  const add = (c: Card, n: number) => {
    counts.set(c.id, (counts.get(c.id) ?? 0) + n);
    size += n;
    if (isMonster(c)) monsters += n;
    if (isSupport(c)) supports += n;
  };
  for (const f of plan.forced) add(f.card, f.quantity);

  const capped = (c: Card, strict: boolean) =>
    strict &&
    ((isMonster(c) &&
      plan.maxMonsters !== undefined &&
      monsters >= plan.maxMonsters) ||
      (isSupport(c) &&
        plan.maxSupports !== undefined &&
        supports >= plan.maxSupports));

  while (size < TARGET_SIZE) {
    let candidates: Card[] = [];
    let w: number[] = [];
    for (const pass of [0, 1, 2] as const) {
      if (pass === 2 && size >= DECK_RULES.MIN_CARDS) break;
      const strict = pass === 0;
      candidates = [];
      w = [];
      for (const c of setCards) {
        if ((counts.get(c.id) ?? 0) >= DECK_RULES.MAX_COPIES) continue;
        if (capped(c, strict)) continue;
        let base = plan.baseWeight(c, counts);
        // Repli : n'importe quelle carte jouable pour atteindre le minimum.
        if (pass === 2 && plan.playable?.(c, counts) !== false) base = 1;
        if (base <= 0) continue;
        candidates.push(c);
        w.push(base * RARITY_WEIGHTS[level][c.rarity] * costMultiplier(c));
      }
      if (candidates.length > 0) break;
    }
    if (candidates.length === 0) break;
    add(pickWeighted(candidates, w, random), 1);
  }

  if (size < DECK_RULES.MIN_CARDS)
    throw new Error(
      `Set trop petit pour un deck de ${DECK_RULES.MIN_CARDS} cartes (${size} possibles)`,
    );
  if (size > DECK_RULES.MAX_CARDS)
    throw new Error(
      `Deck de ${size} cartes : maximum ${DECK_RULES.MAX_CARDS} dépassé`,
    );

  return [...counts.entries()]
    .map(([cardId, quantity]) => ({ cardId, quantity }))
    .sort((a, b) => a.cardId - b.cardId);
}
