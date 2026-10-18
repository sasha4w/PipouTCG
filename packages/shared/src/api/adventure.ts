import type { Rarity } from "../enums/card";
import type { AdventureRewardConfig } from "../game/adventure";

export type AdventureOpponentState = "beaten" | "available" | "locked";

export interface AdventureLoot {
  gold: number;
  xp: number;
  boosters: { boosterId: number; name: string; quantity: number }[];
  cards: { cardId: number; name: string; rarity: Rarity; imageUrl: string | null }[];
  /** true : plafond quotidien de farm atteint, récompenses de farm non données. */
  capped: boolean;
}

export interface AdventureOpponentView {
  id: number;
  position: number;
  level: number;
  name: string;
  quote: string;
  portrait: { cardId: number; imageUrl: string | null };
  state: AdventureOpponentState;
  wins: number;
  isBoss: boolean;
  firstWin: { gold: number; xp: number; boosterName: string | null; legendary: boolean };
  farm: { gold: number; xp: number; boosterPct: number; legendaryPct: number };
}

export interface AdventureWorldView {
  id: number;
  name: string;
  cardSetId: number;
  cardSetName: string;
  order: number;
  unlocked: boolean;
  requires: { id: number; name: string }[];
  beaten: number;
  completed: boolean;
  opponents: AdventureOpponentView[];
}

export interface AdventureOverview {
  worlds: AdventureWorldView[];
  farmRewardsToday: number;
  dailyCap: number;
}

export interface AdventureResultPayload {
  opponentId: number;
  worldId: number;
  won: boolean;
  firstWin: boolean;
  loot: AdventureLoot | null;
  worldCompleted: boolean;
  unlockedWorldIds: number[];
}

// ─── Corps admin ──────────────────────────────────────────────────────────────

export interface AdminAdventureWorldBody {
  name: string;
  cardSetId: number;
  boosterId: number;
  order: number;
  isActive: boolean;
  prerequisiteIds: number[];
}

export interface AdminAdventureOpponentBody extends AdventureRewardConfig {
  name: string;
  quote: string;
  portraitCardId: number;
}

export interface AdminAdventureDeckBody {
  cards: { cardId: number; quantity: number }[];
}

export interface AdminAdventureSettingsBody {
  dailyCap: number;
}
