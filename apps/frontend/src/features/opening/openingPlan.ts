import type { OpenedCard } from "../../services/opening.service";

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "secret"];

const BLACKOUT_MS: Record<string, number> = { epic: 400, legendary: 600, secret: 900 };

export type RevealStep = {
  card: OpenedCard;
  ritual: "none" | "short" | "full";
  blackoutMs: number;
  holdForClick: boolean;
  autoAdvanceMs: number | null;
};

export function rarityRank(r: string): number {
  return Math.max(0, RARITY_ORDER.indexOf(r));
}

export function bestRarity(cards: OpenedCard[]): string {
  return cards.reduce(
    (best, c) => (rarityRank(c.rarity) > rarityRank(best) ? c.rarity : best),
    "common",
  );
}

/** Défilé : du plus commun au plus rare (tri stable). */
export function sortForParade(cards: OpenedCard[]): OpenedCard[] {
  return [...cards].sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
}

/** Récapitulatif : du plus rare au plus commun, nouvelles d'abord à rareté égale. */
export function sortForSummary(cards: OpenedCard[]): OpenedCard[] {
  return [...cards].sort(
    (a, b) =>
      rarityRank(b.rarity) - rarityRank(a.rarity) || Number(b.isNew) - Number(a.isNew),
  );
}

export function buildReveal(cards: OpenedCard[], mega: boolean): RevealStep[] {
  const sorted = sortForParade(cards);
  const epicPlus = (c: OpenedCard) => rarityRank(c.rarity) >= rarityRank("epic");

  if (!mega) {
    return sorted.map((card) => ({
      card,
      ritual: epicPlus(card) ? "full" : "none",
      blackoutMs: BLACKOUT_MS[card.rarity] ?? 0,
      holdForClick: true,
      autoAdvanceMs: null,
    }));
  }

  const hasLegendary = sorted.some((c) => rarityRank(c.rarity) >= rarityRank("legendary"));
  let lastEpic = -1;
  sorted.forEach((c, i) => {
    if (c.rarity === "epic") lastEpic = i;
  });

  return sorted.map((card, i) => {
    const rank = rarityRank(card.rarity);
    if (rank >= rarityRank("legendary")) {
      return { card, ritual: "full", blackoutMs: BLACKOUT_MS[card.rarity], holdForClick: true, autoAdvanceMs: null };
    }
    if (card.rarity === "epic") {
      const full = !hasLegendary && i === lastEpic;
      return {
        card,
        ritual: full ? "full" : "short",
        blackoutMs: full ? BLACKOUT_MS.epic : 0,
        holdForClick: true,
        autoAdvanceMs: null,
      };
    }
    if (card.isNew) {
      return rank >= rarityRank("rare")
        ? { card, ritual: "none", blackoutMs: 0, holdForClick: true, autoAdvanceMs: null }
        : { card, ritual: "none", blackoutMs: 0, holdForClick: false, autoAdvanceMs: 400 };
    }
    return {
      card,
      ritual: "none",
      blackoutMs: 0,
      holdForClick: false,
      autoAdvanceMs: card.rarity === "rare" ? 480 : 110,
    };
  });
}
