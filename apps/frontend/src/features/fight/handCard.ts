import type { CardInstance } from "./fight.types";
import type { RawEffect } from "./fight.effects";

/** Carte de la main, aplatie pour l'affichage et les actions. */
export interface HandCard {
  id: number;
  name: string;
  type: string;
  atk: number;
  hp: number;
  cost: number;
  rarity: string;
  supportType?: string;
  // ── Enrichis pour le tooltip d'info ──────────────────────────────────────
  effects?: RawEffect[] | null;
  description?: string | null;
}

/** Convertit une CardInstance (envoyée par le serveur) en HandCard. */
export function toHandCard(c: CardInstance): HandCard {
  return {
    id: c.baseCard.id,
    name: c.baseCard.name,
    type: c.baseCard.type,
    atk: c.baseCard.atk,
    hp: c.baseCard.hp,
    cost: c.baseCard.cost,
    rarity: c.baseCard.rarity,
    supportType: c.baseCard.supportType ?? undefined,
    effects: c.baseCard.effects ?? null,
    description: c.baseCard.description ?? null,
  };
}
