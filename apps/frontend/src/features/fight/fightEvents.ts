import type { DestroyCause, FightEvent, Rarity } from "@pipou/shared";

/** Intensité de l'animation d'invocation, selon la rareté. */
export type SummonTier = 1 | 2 | 3 | 4;

const TIER_BY_RARITY: Record<Rarity, SummonTier> = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 2,
  legendary: 3,
  secret: 4,
};

export const summonTier = (rarity: Rarity): SummonTier =>
  TIER_BY_RARITY[rarity] ?? 1;

export const SUMMON_MS: Record<SummonTier, number> = {
  1: 500,
  2: 800,
  3: 1200,
  4: 1500,
};

export const DESTROY_MS: Record<DestroyCause, number> = {
  combat: 900,
  effect: 900,
  sacrifice: 800,
  self_destruct: 1000,
  hp_depleted: 800,
};

/** Durée de toute animation en mode réduit. */
export const REDUCED_MS = 250;

export interface ZoneFx {
  summonTier?: SummonTier;
  destroyCause?: DestroyCause;
  terrainPlayed?: boolean;
}

export type ZoneFxMap = ReadonlyMap<number, ZoneFx>;

export const EMPTY_ZONE_FX: ZoneFxMap = new Map();

export interface SideFx {
  monsters: ZoneFxMap;
  supports: ZoneFxMap;
}

export interface BoardFx {
  me: SideFx;
  opponent: SideFx;
  /** Invocation la plus forte de l'action (flash, secousse). */
  topSummon: { tier: SummonTier; rarity: Rarity } | null;
}

function merge(map: Map<number, ZoneFx>, zoneIndex: number, patch: ZoneFx) {
  map.set(zoneIndex, { ...map.get(zoneIndex), ...patch });
}

/** Effets à jouer par zone pour les événements d'un état reçu. */
export function boardFxFromEvents(
  events: readonly FightEvent[],
  myUserId: number,
): BoardFx {
  const sides = {
    me: { monsters: new Map<number, ZoneFx>(), supports: new Map<number, ZoneFx>() },
    opponent: { monsters: new Map<number, ZoneFx>(), supports: new Map<number, ZoneFx>() },
  };
  let topSummon: BoardFx["topSummon"] = null;

  for (const e of events) {
    const side = e.ownerId === myUserId ? sides.me : sides.opponent;
    switch (e.kind) {
      case "monster_summoned": {
        const tier = summonTier(e.rarity);
        merge(side.monsters, e.zoneIndex, { summonTier: tier });
        if (!topSummon || tier > topSummon.tier)
          topSummon = { tier, rarity: e.rarity };
        break;
      }
      case "monster_destroyed":
        merge(side.monsters, e.zoneIndex, { destroyCause: e.cause });
        break;
      case "terrain_played":
        merge(side.supports, e.zoneIndex, { terrainPlayed: true });
        break;
    }
  }
  return { ...sides, topSummon };
}
