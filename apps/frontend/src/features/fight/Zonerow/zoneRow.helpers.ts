import { QUENOUILLE_CARD_ID, RARITY_COLOR } from "../fight.types";

export function isBlockedFromAttacking(zone: any): boolean {
  if (!zone) return false;
  return (
    zone.summonedThisTurn && zone.card?.baseCard?.id === QUENOUILLE_CARD_ID
  );
}

export function getRarityBorderColor(
  zone: any,
  isSupport: boolean,
): string | undefined {
  if (!zone) return undefined;
  const rarity = isSupport
    ? zone.baseCard?.rarity
    : zone.card?.baseCard?.rarity;
  return rarity ? RARITY_COLOR[rarity] : undefined;
}

export function buildStatRecap(
  zone: any,
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
