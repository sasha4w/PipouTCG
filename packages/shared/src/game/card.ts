import type {
  Archetype,
  CardType,
  ChargeMode,
  DrakonElement,
  DrakonStage,
  EquipmentSlot,
  Rarity,
  SupportType,
} from "../enums/card";
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
  /** Équipement uniquement. */
  equipmentSlot: EquipmentSlot | null;
  /** Persistant uniquement : un seul Terrain à la fois par joueur. */
  isTerrain: boolean;
  /** Charge uniquement : compteurs nécessaires au déclenchement. */
  chargeMax: number | null;
  chargeMode: ChargeMode | null;
  archetype: Archetype | null;
  element: DrakonElement | null;
  lineage: string | null;
  stage: DrakonStage | null;
  effects: CardEffect[] | null;
  description: string | null;
  image: { url: string } | null;
}
