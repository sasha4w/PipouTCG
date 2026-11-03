import {
  ActionType,
  EffectTarget,
  EffectTrigger,
  isImplanted,
  type EffectFilter,
} from "@pipou/shared";
import type { EffectSourceCard } from "./effectText";
import type { MonsterOnBoard } from "./fight.types";

/**
 * Ce qu'une Charge exige sur le terrain de son poseur pour que son effet ait
 * prise (miroir de support-requirements et de effect-actions.applier).
 */
export type ChargeRequirementKind = "card" | "receiver" | "evolvable" | "ally";

export interface ChargeRequirement {
  kind: ChargeRequirementKind;
  filter?: EffectFilter;
}

/** Sous-ensemble de carte suffisant pour tester un filtre. */
interface FilterableCard {
  name: string;
  archetype?: string | null;
  type?: string;
  rarity?: string;
  element?: string | null;
  stage?: string | null;
}

/** Miroir de matchesFilter (pick-candidates) côté moteur. */
function matchesFilter(c: FilterableCard, filter?: EffectFilter): boolean {
  if (!filter) return true;
  if (filter.archetype && c.archetype !== filter.archetype) return false;
  if (filter.rarities && !filter.rarities.includes(c.rarity as never))
    return false;
  if (filter.type && c.type !== filter.type) return false;
  if (filter.name && !c.name.toLowerCase().includes(filter.name.toLowerCase()))
    return false;
  if (filter.excludeName && c.name === filter.excludeName) return false;
  if (filter.element && c.element !== filter.element) return false;
  if (filter.stage && c.stage !== filter.stage) return false;
  return true;
}

export function chargeRequirements(
  card: EffectSourceCard,
): ChargeRequirement[] {
  if (card.supportType !== "CHARGE") return [];
  const out: ChargeRequirement[] = [];
  for (const e of card.effects ?? []) {
    for (const a of e.actions ?? []) {
      if (
        e.trigger === EffectTrigger.PASSIVE &&
        a.type === ActionType.REQUIRES_CARD_ON_BOARD
      )
        out.push({ kind: "card", filter: a.filter });
      if (e.trigger !== EffectTrigger.ON_CHARGED) continue;
      if (a.type === ActionType.TRANSFER_HALF_ATK)
        out.push({ kind: "receiver", filter: a.filter });
      else if (a.type === ActionType.FORCE_EVOLVE)
        out.push({ kind: "evolvable", filter: a.filter });
      else if (
        a.type === ActionType.GRANT_EXTRA_ATTACK &&
        a.target === EffectTarget.ALL_ALLIES
      )
        out.push({ kind: "ally" });
    }
  }
  return out;
}

/** Peut encore évoluer : le catalogue n'est pas côté client, le stade suffit. */
const EVOLVING_STAGES = new Set(["baby", "young"]);

function isMet(req: ChargeRequirement, allies: MonsterOnBoard[]): boolean {
  return allies.some((m) => {
    const c = m.card.baseCard;
    if (!matchesFilter(c, req.filter)) return false;
    return req.kind !== "evolvable" || EVOLVING_STAGES.has(c.stage ?? "");
  });
}

/**
 * Conditions non remplies par les monstres du poseur. Les monstres implantés
 * chez lui par l'adversaire (Zeta) ne comptent pas.
 */
export function unmetChargeRequirements(
  card: EffectSourceCard,
  monsterZones: readonly (MonsterOnBoard | null)[],
  ownerUserId: number,
): ChargeRequirement[] {
  const allies = monsterZones.filter(
    (m): m is MonsterOnBoard => !!m && !isImplanted(m, ownerUserId),
  );
  return chargeRequirements(card).filter((r) => !isMet(r, allies));
}
