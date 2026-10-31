import { EFFECT_IMMUNITIES, Immunity, hasImmunity } from "@pipou/shared";
import {
  isMonsterZone,
  type BoardZone,
  type MonsterOnBoard,
} from "./fight.types";
import { isBlockedFromAttacking } from "./Zonerow/zoneRow.helpers";

export const STATUS_FX_IDS = [
  "freeze",
  "guardLock",
  "stun",
  "taunt",
  "piercing",
  "supportDestroyImmune",
  "supportDebuffImmune",
  "monsterDebuffImmune",
  "monsterStatusImmune",
  "immuneAll",
  "combatShield",
  "combatEndure",
  "reflect",
  "ignoreTaunt",
  "charge",
  "hatch",
  "countdown",
  "evolve",
  "forcedAttack",
  "reduce",
] as const;

export type StatusFxId = (typeof STATUS_FX_IDS)[number];

export const STATUS_BURST_MS = 500;

/** Flags visuels actifs sur un monstre. Freeze masque stun. */
export function statusFlags(monster: MonsterOnBoard): ReadonlySet<StatusFxId> {
  const flags = new Set<StatusFxId>();
  const frozen = (monster.blockAttackTurns ?? 0) > 0;

  if (frozen) flags.add("freeze");
  if (monster.guardLocked) flags.add("guardLock");
  if (!frozen && isBlockedFromAttacking(monster)) flags.add("stun");
  if (monster.hasTaunt) flags.add("taunt");
  if (monster.hasPiercing) flags.add("piercing");
  // Immunités : les quatre d'effets cumulées = « immuneAll », sinon une par une.
  const has = (i: Immunity) => hasImmunity(monster, i);
  if (EFFECT_IMMUNITIES.every(has)) flags.add("immuneAll");
  else {
    if (has(Immunity.SUPPORT_DESTRUCTION)) flags.add("supportDestroyImmune");
    if (has(Immunity.SUPPORT_DEBUFF)) flags.add("supportDebuffImmune");
    if (has(Immunity.MONSTER_DEBUFF)) flags.add("monsterDebuffImmune");
    if (has(Immunity.MONSTER_STATUS)) flags.add("monsterStatusImmune");
  }
  if (has(Immunity.COMBAT_DAMAGE)) flags.add("combatShield");
  if (has(Immunity.COMBAT_DESTRUCTION)) flags.add("combatEndure");
  if ((monster.reflectPercent ?? 0) > 0) flags.add("reflect");
  if (monster.ignoresTaunt) flags.add("ignoreTaunt");
  if (monster.doubleAtkNextTurn || monster.attacksPerTurn > 1)
    flags.add("charge");
  if ((monster.hatchCounter ?? 0) > 0) flags.add("hatch");
  if ((monster.turnCounter ?? 0) > 0) flags.add("countdown");
  if (
    monster.canEvolveThisTurn ||
    monster.evolutionJoker ||
    monster.instantEvolution
  )
    flags.add("evolve");
  if (monster.forcedAttackMode) flags.add("forcedAttack");
  if ((monster.damageReduction ?? 0) > 1) flags.add("reduce");

  return flags;
}

function flagsOf(zone: BoardZone | null | undefined): ReadonlySet<StatusFxId> {
  if (zone && isMonsterZone(zone)) return statusFlags(zone);
  return new Set();
}

/**
 * Fronts montants (false → true). Un nouveau monstre sur la zone compte
 * comme prev vide. Freeze 0 → N est un front ; 2 → 1 ne l'est pas.
 */
export function statusRisingEdges(
  prev: BoardZone | null | undefined,
  next: BoardZone | null | undefined,
): StatusFxId[] {
  const nextFlags = flagsOf(next);
  if (nextFlags.size === 0) return [];

  const sameInstance =
    prev != null &&
    next != null &&
    prev.instanceId === next.instanceId;
  const prevFlags = sameInstance ? flagsOf(prev) : new Set<StatusFxId>();

  return STATUS_FX_IDS.filter(
    (id) => nextFlags.has(id) && !prevFlags.has(id),
  );
}

/** Un seul état « bloqué » dessiné à la fois, par priorité. */
const BLOCKED_PRIORITY = ["freeze", "stun", "guardLock", "forcedAttack"] as const;

/**
 * Effets dessinés sur la zone : l'anneau de Provocation, le reflet du
 * Bouclier, et la texture de l'état bloquant le plus fort. Le reste est
 * en badges.
 */
export function overlayFx(flags: ReadonlySet<StatusFxId>): StatusFxId[] {
  const out: StatusFxId[] = [];
  if (flags.has("taunt")) out.push("taunt");
  if (flags.has("combatShield")) out.push("combatShield");
  const blocked = BLOCKED_PRIORITY.find((id) => flags.has(id));
  if (blocked) out.push(blocked);
  return out;
}
