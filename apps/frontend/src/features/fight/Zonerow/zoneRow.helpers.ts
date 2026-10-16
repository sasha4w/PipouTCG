import type { CardFaceStats } from "../../cards/CardFace";
import {
  RARITY_COLOR,
  isMonsterZone,
  type BoardZone,
  type MonsterOnBoard,
} from "../fight.types";

export function isBlockedFromAttacking(zone: MonsterOnBoard | null): boolean {
  if (!zone) return false;
  return (
    (zone.summonedThisTurn && zone.cannotAttackOnSummonTurn) ||
    (zone.blockAttackTurns ?? 0) > 0
  );
}

export function getRarityBorderColor(
  zone: BoardZone | null | undefined,
): string | undefined {
  if (!zone) return undefined;
  const rarity = isMonsterZone(zone)
    ? zone.card.baseCard.rarity
    : zone.baseCard.rarity;
  return rarity ? RARITY_COLOR[rarity] : undefined;
}

export function buildStatRecap(
  zone: MonsterOnBoard | null,
): { atkLine: string; hpLine: string } | null {
  if (!zone) return null;
  const baseAtk: number = zone.card?.baseCard?.atk ?? 0;
  const baseHp: number = zone.card?.baseCard?.hp ?? 0;
  const atkBuff: number = zone.atkBuff ?? 0;
  const hpBuff: number = zone.hpBuff ?? 0;
  const tempAtk: number = zone.tempAtkBuff ?? 0;

  const totalAtk = baseAtk + atkBuff + tempAtk;
  const totalHp = baseHp + hpBuff;

  const atkParts = [`${baseAtk} base`];
  if (atkBuff !== 0) atkParts.push(`${atkBuff > 0 ? "+" : ""}${atkBuff} buff`);
  if (tempAtk !== 0) atkParts.push(`+${tempAtk} temp`);
  const atkLine =
    atkParts.length > 1
      ? `${atkParts.join(" ")} = ${totalAtk} ⚔`
      : `${totalAtk} ⚔`;

  const hpParts = [`${baseHp} base`];
  if (hpBuff !== 0) hpParts.push(`${hpBuff > 0 ? "+" : ""}${hpBuff} buff`);
  const hpLine =
    hpParts.length > 1
      ? `${hpParts.join(" ")} = ${totalHp} ❤  (actuel : ${zone.currentHp})`
      : `${zone.currentHp}/${totalHp} ❤`;

  return { atkLine, hpLine };
}

/** Stats affichées sur la carte d'un monstre en jeu, avec leur tendance. */
export function monsterFaceStats(zone: MonsterOnBoard): CardFaceStats {
  const base = zone.card.baseCard;
  const atk = base.atk + zone.atkBuff + (zone.tempAtkBuff ?? 0);
  const maxHp = base.hp + zone.hpBuff;
  return {
    atk,
    hp: zone.currentHp,
    atkState: atk > base.atk ? "up" : atk < base.atk ? "down" : undefined,
    hpState:
      zone.currentHp < maxHp
        ? "down"
        : zone.currentHp > base.hp
          ? "up"
          : undefined,
  };
}

/** Toutes les attaques du tour ont été utilisées. */
export function hasSpentAttacks(zone: MonsterOnBoard): boolean {
  return (
    zone.hasAttackedThisTurn && zone.attacksUsedThisTurn >= zone.attacksPerTurn
  );
}
