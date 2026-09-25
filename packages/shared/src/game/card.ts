import type { Archetype, CardType, Rarity, SupportType } from "../enums/card";
import type { CardEffect } from "./effect";

/** Carte telle que sérialisée vers le client (sous-ensemble de l'entité Card). */
export interface ClientCard {
  id: number;
  name: string;
  rarity: Rarity;
  type: CardType;
  atk: number;
  hp: number;
  cost: number;
  supportType: SupportType | null;
  archetype: Archetype | null;
  effects: CardEffect[] | null;
  description: string | null;
  image: { url: string } | null;
}
