import type { CardType, Rarity, SupportType } from "@pipou/shared";
import type { CardInstance } from "./fight.types";
import type { RawEffect } from "./fight.effects";

/** Carte de la main, aplatie pour l'affichage et les actions. */
export interface HandCard {
  instanceId: string;
  id: number;
  name: string;
  type: CardType;
  atk: number;
  hp: number;
  cost: number;
  rarity: Rarity;
  supportType?: SupportType;
  image: { url: string } | null;
  // ── Enrichis pour l'inspection ───────────────────────────────────────────
  effects?: RawEffect[] | null;
  description?: string | null;
}

/** Convertit une CardInstance (envoyée par le serveur) en HandCard. */
export function toHandCard(c: CardInstance): HandCard {
  return {
    instanceId: c.instanceId,
    id: c.baseCard.id,
    name: c.baseCard.name,
    type: c.baseCard.type,
    atk: c.baseCard.atk,
    hp: c.baseCard.hp,
    cost: c.baseCard.cost,
    rarity: c.baseCard.rarity,
    supportType: c.baseCard.supportType ?? undefined,
    image: c.baseCard.image,
    effects: c.baseCard.effects ?? null,
    description: c.baseCard.description ?? null,
  };
}
