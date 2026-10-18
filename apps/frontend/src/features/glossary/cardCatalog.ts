import { useQuery } from "@tanstack/react-query";
import { cardService, type Card } from "../../services/card.service";
import { QUERY_KEYS } from "../../utils/querykeys";

/** Toutes les cartes tiennent en une page (plafond du back : 500). */
const CATALOG_LIMIT = 500;

export type Kind = "monster" | "EQUIPMENT" | "TERRAIN" | "EPHEMERAL";

export const KIND_LABELS: Record<Kind, string> = {
  monster: "Monstre",
  EQUIPMENT: "Équipement",
  TERRAIN: "Terrain",
  EPHEMERAL: "Éphémère",
};
export const KINDS = Object.keys(KIND_LABELS) as Kind[];

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
}

export const NO_FILTERS: CardFilters = { search: "", setId: null, kind: null };

/** Sets présents parmi les cartes, dans l'ordre de leur id. */
export function setsOf(cards: readonly Card[]): Card["cardSet"][] {
  return [...new Map(cards.map((c) => [c.cardSet.id, c.cardSet])).values()].sort(
    (a, b) => a.id - b.id,
  );
}

export function matchesFilters(card: Card, filters: CardFilters): boolean {
  return (
    (filters.setId === null || card.cardSet.id === filters.setId) &&
    (filters.kind === null || cardKind(card) === filters.kind) &&
    normalize(card.name).includes(normalize(filters.search.trim()))
  );
}

/** Toutes les cartes du jeu, avec leurs effets. */
export function useCardCatalog() {
  return useQuery({
    queryKey: QUERY_KEYS.cardGlossary,
    queryFn: () => cardService.findAll(1, CATALOG_LIMIT),
  });
}
