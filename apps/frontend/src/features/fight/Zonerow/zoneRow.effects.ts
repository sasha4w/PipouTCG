import type { BuffEntry } from "../BuffDebuffList";
import {
  TRIGGER_LABEL,
  TARGET_SUFFIX,
  ACTION_META,
  type RawEffect,
} from "../fight.effects";
import { buildStatRecap } from "./zoneRow.helpers";

export function getEquipmentEntries(eq: any): BuffEntry[] {
  const entries: BuffEntry[] = [];
  const rawEffects: RawEffect[] = Array.isArray(eq.baseCard?.effects)
    ? eq.baseCard.effects
    : [];

  for (const eff of rawEffects) {
    const condition = (eff as any).condition;
    const conditionLabel =
      condition?.type === "SPECIFIC_CARD_ON_BOARD"
        ? `Si ${condition.value} présent`
        : null;
    const trigger = eff.trigger
      ? (TRIGGER_LABEL[eff.trigger] ?? eff.trigger)
      : null;

    for (const action of eff.actions ?? []) {
      const meta = action.type ? ACTION_META[action.type] : undefined;
      if (!meta) continue;
      const targetSuffix = action.target
        ? (TARGET_SUFFIX[action.target] ?? action.target)
        : null;
      entries.push({
        icon: meta.icon,
        label: [
          conditionLabel ?? trigger,
          meta.label(action.value),
          targetSuffix,
        ]
          .filter(Boolean)
          .join(" · "),
        type: meta.type,
      });
    }
  }

  const desc = eq.baseCard?.description;
  if (desc) entries.push({ icon: "📖", label: desc, type: "neutral" });
  return entries;
}

export function getSupportBuffEntries(zone: any): BuffEntry[] {
  if (!zone) return [];
  const entries: BuffEntry[] = [];
  const supportType: string | undefined = zone.baseCard?.supportType;

  if (supportType === "TERRAIN")
    entries.push({
      icon: "🗺️",
      label: "Terrain — affecte les deux camps",
      type: "neutral",
    });
  if (supportType === "EPHEMERAL")
    entries.push({
      icon: "⏳",
      label: "Éphémère — s'épuise après usage",
      type: "neutral",
    });
  if (supportType === "EQUIPMENT")
    entries.push({ icon: "🔧", label: "Équipement", type: "neutral" });

  const rawEffects: RawEffect[] = Array.isArray(zone.baseCard?.effects)
    ? zone.baseCard.effects
    : [];

  for (const eff of rawEffects) {
    const condition = (eff as any).condition;
    const conditionLabel =
      condition?.type === "SPECIFIC_CARD_ON_BOARD"
        ? `Si ${condition.value} est sur le terrain`
        : null;
    const trigger = eff.trigger
      ? (TRIGGER_LABEL[eff.trigger] ?? eff.trigger)
      : null;

    for (const action of eff.actions ?? []) {
      const meta = action.type ? ACTION_META[action.type] : undefined;
      if (!meta) continue;
      const targetSuffix = action.target
        ? (TARGET_SUFFIX[action.target] ?? action.target)
        : null;
      entries.push({
        icon: meta.icon,
        label: [
          conditionLabel ?? trigger,
          meta.label(action.value),
          targetSuffix,
        ]
          .filter(Boolean)
          .join(" · "),
        type: meta.type,
      });
    }
  }

  const desc = zone.baseCard?.description;
  if (desc && typeof desc === "string")
    entries.push({ icon: "📖", label: desc, type: "neutral" });
  return entries;
}

export function getMonsterBuffEntries(zone: any): BuffEntry[] {
  if (!zone) return [];
  const entries: BuffEntry[] = [];
  const rawEffects: RawEffect[] = Array.isArray(zone.card?.baseCard?.effects)
    ? zone.card.baseCard.effects
    : [];
  const effectActionTypes = new Set(
    rawEffects.flatMap((e) => e.actions ?? []).map((a) => a.type),
  );

  // Récap stats
  const recap = buildStatRecap(zone);
  if (recap) {
    entries.push({
      icon: "⚔️",
      label: recap.atkLine,
      type: "neutral",
      variant: "recap",
    });
    entries.push({
      icon: "❤️",
      label: recap.hpLine,
      type: "neutral",
      variant: "recap",
    });
  }

  // Séparateur
  const hasEquipments =
    Array.isArray(zone.equipments) && zone.equipments.length > 0;
  if (rawEffects.length > 0 || hasEquipments) {
    entries.push({
      icon: "─",
      label: "Effets de la carte",
      type: "neutral",
      variant: "separator",
    });
  }

  // Effets de base
  for (const eff of rawEffects) {
    const trigger = eff.trigger
      ? (TRIGGER_LABEL[eff.trigger] ?? eff.trigger)
      : null;
    for (const action of eff.actions ?? []) {
      const meta = action.type ? ACTION_META[action.type] : undefined;
      if (!meta) continue;
      const targetSuffix = action.target
        ? (TARGET_SUFFIX[action.target] ?? action.target)
        : null;
      entries.push({
        icon: meta.icon,
        label: [trigger, meta.label(action.value), targetSuffix]
          .filter(Boolean)
          .join(" · "),
        type: meta.type,
      });
    }
  }

  // Buffs actifs non couverts
  if (zone.atkBuff && zone.atkBuff !== 0 && !effectActionTypes.has("BUFF_ATK"))
    entries.push({
      icon: "⚔️",
      label: `${zone.atkBuff > 0 ? "+" : ""}${zone.atkBuff} ATK (buff actif)`,
      type: zone.atkBuff > 0 ? "buff" : "debuff",
    });
  if (zone.hpBuff && zone.hpBuff !== 0 && !effectActionTypes.has("BUFF_HP"))
    entries.push({
      icon: "❤️",
      label: `${zone.hpBuff > 0 ? "+" : ""}${zone.hpBuff} HP max (buff actif)`,
      type: zone.hpBuff > 0 ? "buff" : "debuff",
    });
  if (zone.tempAtkBuff && zone.tempAtkBuff !== 0)
    entries.push({
      icon: "⚡",
      label: `+${zone.tempAtkBuff} ATK (ce tour)`,
      type: "buff",
    });
  if (
    zone.damageReduction &&
    zone.damageReduction > 1 &&
    !effectActionTypes.has("SET_DAMAGE_REDUCTION")
  )
    entries.push({
      icon: "🛡",
      label: `Réduction dégâts ×${zone.damageReduction}`,
      type: "buff",
    });

  // Traits
  if (!effectActionTypes.has("SET_TAUNT") && zone.hasTaunt)
    entries.push({ icon: "🛡", label: "Provocation", type: "buff" });
  if (!effectActionTypes.has("SET_PIERCING") && zone.hasPiercing)
    entries.push({ icon: "🗡", label: "Perçant", type: "buff" });
  if (!effectActionTypes.has("SET_DEBUFF_IMMUNITY") && zone.isImmuneToDebuffs)
    entries.push({ icon: "✨", label: "Immunité débuffs", type: "buff" });
  if (!effectActionTypes.has("SET_DELAY_DOUBLE_ATK") && zone.doubleAtkNextTurn)
    entries.push({
      icon: "⚡",
      label: "Double attaque (prochain tour)",
      type: "buff",
    });
  if (!effectActionTypes.has("SET_ATTACKS_PER_TURN") && zone.attacksPerTurn > 1)
    entries.push({
      icon: "✖️",
      label: `Attaques ×${zone.attacksPerTurn}`,
      type: "buff",
    });
  if (!effectActionTypes.has("FORCE_ATTACK_MODE") && zone.forcedAttackMode)
    entries.push({ icon: "😈", label: "Mode Attaque forcé", type: "debuff" });

  // Équipements
  if (hasEquipments) {
    for (const eq of zone.equipments) {
      entries.push({
        icon: "🔧",
        label: eq.baseCard?.name ?? "Équipement",
        type: "neutral",
        variant: "separator",
      });
      const eqEntries = getEquipmentEntries(eq);
      entries.push(
        ...(eqEntries.length
          ? eqEntries
          : [
              {
                icon: "  ",
                label: "Aucun effet listé",
                type: "neutral" as const,
              },
            ]),
      );
    }
  }

  const desc = zone.card?.baseCard?.description;
  if (desc && typeof desc === "string")
    entries.push({ icon: "📖", label: desc, type: "neutral" });

  return entries;
}
