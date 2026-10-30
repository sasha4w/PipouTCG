import type { TFunction } from "i18next";
import { GUARD_MAX_TURNS, Immunity, hasImmunity } from "@pipou/shared";
import type { MonsterOnBoard } from "./fight.types";
import { isBlockedFromAttacking } from "./Zonerow/zoneRow.helpers";

/** Badges sous le nom d'un monstre, dans l'ordre d'affichage. */
export const STATUS_BADGE_IDS = [
  "guard",
  "endure",
  "reflect",
  "reduce",
  "attacks",
  "piercing",
  "ignoreTaunt",
  "immunity",
  "hatch",
  "countdown",
  "evolve",
] as const;

export type StatusBadgeId = (typeof STATUS_BADGE_IDS)[number];

export type ImmunityQuarters = readonly [boolean, boolean, boolean, boolean];

export interface StatusBadge {
  id: StatusBadgeId;
  /** Chiffre affiché dans le badge (tours, attaques restantes). */
  count?: number;
  /** Compteur au bord de l'échéance : mis en avant. */
  urgent?: boolean;
  /** Badge Immunités : quarts remplis. */
  quarters?: ImmunityQuarters;
}

export const MAX_VISIBLE_BADGES = 3;

/** Quart du bouclier pour chaque immunité aux effets (haut g., haut d., bas g., bas d.). */
export const IMMUNITY_QUARTERS = [
  Immunity.SUPPORT_DESTRUCTION,
  Immunity.SUPPORT_DEBUFF,
  Immunity.MONSTER_DEBUFF,
  Immunity.MONSTER_STATUS,
] as const;

export function immunityQuarters(monster: MonsterOnBoard): ImmunityQuarters {
  const [a, b, c, d] = IMMUNITY_QUARTERS.map((i) => hasImmunity(monster, i));
  return [a, b, c, d];
}

/** Attaques encore possibles ce tour, ou 2 si la double attaque attend le prochain. */
function attacksBadge(monster: MonsterOnBoard): StatusBadge | null {
  if (monster.doubleAtkNextTurn) return { id: "attacks", count: 2 };
  const left = monster.attacksPerTurn - monster.attacksUsedThisTurn;
  if (monster.attacksPerTurn > 1 && left > 0 && !isBlockedFromAttacking(monster))
    return { id: "attacks", count: left };
  return null;
}

export function monsterBadges(monster: MonsterOnBoard): StatusBadge[] {
  const badges: (StatusBadge | null)[] = [];
  if (monster.mode === "guard") {
    const held = monster.guardTurns ?? 0;
    badges.push({ id: "guard", count: held, urgent: held + 1 >= GUARD_MAX_TURNS });
  }
  if (hasImmunity(monster, Immunity.COMBAT_DESTRUCTION)) badges.push({ id: "endure" });
  if ((monster.reflectPercent ?? 0) > 0) badges.push({ id: "reflect" });
  if ((monster.damageReduction ?? 0) > 1) badges.push({ id: "reduce" });
  badges.push(attacksBadge(monster));
  if (monster.hasPiercing) badges.push({ id: "piercing" });
  if (monster.ignoresTaunt) badges.push({ id: "ignoreTaunt" });
  const quarters = immunityQuarters(monster);
  if (quarters.some(Boolean)) badges.push({ id: "immunity", quarters });
  if ((monster.hatchCounter ?? 0) > 0)
    badges.push({
      id: "hatch",
      count: monster.hatchCounter,
      urgent: monster.hatchCounter! <= 1,
    });
  if (monster.turnCounter !== undefined)
    badges.push({
      id: "countdown",
      count: monster.turnCounter,
      urgent: monster.turnCounter <= 1,
    });
  if (
    monster.canEvolveThisTurn ||
    monster.evolutionJoker ||
    monster.instantEvolution
  )
    badges.push({ id: "evolve" });
  return badges.filter((b): b is StatusBadge => b !== null);
}

/** Les premiers badges, et combien restent cachés derrière « +N ». */
export function splitBadges(
  badges: StatusBadge[],
  max = MAX_VISIBLE_BADGES,
): { shown: StatusBadge[]; hidden: number } {
  return { shown: badges.slice(0, max), hidden: Math.max(0, badges.length - max) };
}

/**
 * Immunités aux effets en clair : « Insensible aux effets adverses » si les
 * quatre sont là, sinon la liste de celles qui sont actives.
 */
export function immunityText(
  quarters: ImmunityQuarters,
  t: TFunction,
  language: string,
): string {
  if (quarters.every(Boolean)) return t("keywords.debuffImmunity.name");
  const items = IMMUNITY_QUARTERS.filter((_, i) => quarters[i]).map((i) =>
    t(`effects.immunity.${i}`),
  );
  const list = new Intl.ListFormat(language, { type: "conjunction" }).format(
    items,
  );
  return t("effects.status.immunities", { list });
}
