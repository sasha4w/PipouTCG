import type { Rarity } from "../enums/card";
import type { DestroyCause } from "../enums/fight";

/**
 * Événement public de duel, produit pendant la résolution d'une action et envoyé
 * avec l'état qui suit (`ClientGameState.events`). Sert uniquement aux animations.
 * `ownerId` : userId du joueur dont la zone est concernée.
 */
export type FightEvent =
  | {
      kind: "monster_summoned";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
      rarity: Rarity;
    }
  | {
      kind: "monster_destroyed";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
      cause: DestroyCause;
    }
  | {
      kind: "support_placed";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
    }
  | {
      kind: "charge_progress";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
      counters: number;
      max: number;
    }
  | {
      kind: "charge_triggered";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
    }
  | {
      kind: "monster_healed";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
    };
