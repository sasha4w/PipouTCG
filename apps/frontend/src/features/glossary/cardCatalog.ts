import { useQuery } from "@tanstack/react-query";
import { Rarity, cardService, type Card } from "../../services/card.service";
import { QUERY_KEYS } from "../../utils/querykeys";

/** Toutes les cartes tiennent en une page (plafond du back : 500). */
const CATALOG_LIMIT = 500;

export type Kind = "monster" | "EQUIPMENT" | "TERRAIN" | "EPHEMERAL";
export const KINDS: Kind[] = ["monster", "EQUIPMENT", "TERRAIN", "EPHEMERAL"];

export const RARITIES = Object.values(Rarity);

/** « default » garde l'ordre du catalogue (set puis id). */
export type SortKey = "default" | "name" | "cost" | "atk" | "hp" | "rarity";
export const SORT_KEYS: SortKey[] = [
  "default",
  "name",
  "cost",
  "atk",
  "hp",
  "rarity",
];

type KindSource = Pick<Card, "type" | "supportType">;

export function cardKind(card: KindSource): Kind {
  if (card.type.toLowerCase() !== "support") return "monster";
  return (card.supportType as Kind | null | undefined) ?? "EPHEMERAL";
}

/** « Drakon - Les légendes primaires » → « Drakon ». */
export function shortSetName(name: string): string {
  return name.split(/\s[-–]\s/)[0];
}

/** Minuscules sans accents ni ligatures : « oeuf » trouve « Œuf ». */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export interface CardFilters {
  search: string;
  setId: number | null;
  kind: Kind | null;
  rarity: Rarity | null;
  cost: number | null;
  sort: SortKey;
  /** Ordre décroissant. */
  desc: boolean;
}

export const NO_FILTERS: CardFilters = {
  search: "",
  setId: null,
  kind: null,
  rarity: null,
  cost: null,
  sort: "default",
  desc: false,
};

/** Les filtres du panneau, tous désactivés. */
export const NO_PANEL_FILTERS = {
  setId: null,
  kind: null,
  rarity: null,
  cost: null,
} satisfies Partial<CardFilters>;

/**
 * Filtres du panneau actifs : pour le badge du bouton.
 * Pas d'archétype : il recoupe le set (PipouSquad, Drakon, SquareWorld).
 */
export function activeFilterCount(filters: CardFilters): number {
  return [filters.setId, filters.kind, filters.rarity, filters.cost].filter(
    (v) => v !== null,
  ).length;
}

/** Sets présents parmi les cartes, dans l'ordre de leur id. */
export function setsOf(cards: readonly Card[]): Card["cardSet"][] {
  return [
    ...new Map(cards.map((c) => [c.cardSet.id, c.cardSet])).values(),
  ].sort((a, b) => a.id - b.id);
}

/** Coûts présents parmi les cartes, croissants. */
export function costsOf(cards: readonly Card[]): number[] {
  return [...new Set(cards.map((c) => c.cost))].sort((a, b) => a - b);
}

export function matchesFilters(card: Card, filters: CardFilters): boolean {
  return (
    (filters.setId === null || card.cardSet.id === filters.setId) &&
    (filters.kind === null || cardKind(card) === filters.kind) &&
    (filters.rarity === null || card.rarity === filters.rarity) &&
    (filters.cost === null || card.cost === filters.cost) &&
    normalize(card.name).includes(normalize(filters.search.trim()))
  );
}

const SORT_VALUE: Record<
  Exclude<SortKey, "default" | "name">,
  (c: Card) => number
> = {
  cost: (c) => c.cost,
  atk: (c) => c.atk,
  hp: (c) => c.hp,
  rarity: (c) => RARITIES.indexOf(c.rarity),
};

/**
 * Trie sans muter. Égalités départagées par le nom (toujours A→Z), pour un
 * ordre stable quand on change de critère.
 */
export function sortCards<T>(
  items: readonly T[],
  toCard: (item: T) => Card,
  { sort, desc }: Pick<CardFilters, "sort" | "desc">,
): T[] {
  if (sort === "default") return desc ? [...items].reverse() : [...items];
  const byName = (a: Card, b: Card) => a.name.localeCompare(b.name);
  const sign = desc ? -1 : 1;
  return [...items].sort((x, y) => {
    const a = toCard(x);
    const b = toCard(y);
    if (sort === "name") return sign * byName(a, b);
    return sign * (SORT_VALUE[sort](a) - SORT_VALUE[sort](b)) || byName(a, b);
  });
}

/** Toutes les cartes du jeu, avec leurs effets. */
export function useCardCatalog() {
  return useQuery({
    queryKey: QUERY_KEYS.cardGlossary,
    queryFn: () => cardService.findAll(1, CATALOG_LIMIT),
  });
}
