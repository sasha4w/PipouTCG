import type { TFunction } from "i18next";
import type { BuffEntry } from "../BuffDebuffSections";
import {
  KEYWORD_ICON,
  describeCardEffects,
  effectPlainText,
} from "../effectText";
import { buildStatRecap } from "./zoneRow.helpers";
import type { CardInstance, MonsterOnBoard } from "../fight.types";

/** Résumé texte des effets d'un équipement (infobulle du chip). */
export function equipmentSummary(eq: CardInstance, t: TFunction): string {
  return describeCardEffects(eq.baseCard, t)
    .rules.flatMap((rule) =>
      rule.lines.map((line) => effectPlainText(line.text)),
    )
    .join(" | ");
}

/**
 * État en direct d'un monstre en jeu : récap des stats puis statuts actifs.
 * Les effets écrits de la carte sont rédigés à part (CardEffectSheet).
 */
export function getMonsterStatusEntries(
  zone: MonsterOnBoard | null,
  t: TFunction,
): BuffEntry[] {
  if (!zone) return [];
  const entries: BuffEntry[] = [];

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

  const keyword = (id: keyof typeof KEYWORD_ICON, type: BuffEntry["type"]) =>
    entries.push({
      icon: KEYWORD_ICON[id],
      label: t(`keywords.${id}.name`),
      type,
    });

  if (zone.hasTaunt) keyword("taunt", "buff");
  if (zone.hasPiercing) keyword("piercing", "buff");
  if (zone.isImmuneToDebuffs) keyword("debuffImmunity", "buff");
  if (zone.combatImmune) keyword("combatImmunity", "buff");
  if (zone.supportDestroyImmune) keyword("supportShield", "buff");
  if (zone.ignoresTaunt) keyword("ignoreTaunt", "buff");
  if (zone.damageReduction && zone.damageReduction > 1)
    entries.push({
      icon: KEYWORD_ICON.damageReduction,
      label: t("effects.status.damageReduction", {
        value: zone.damageReduction,
      }),
      type: "buff",
    });
  if (zone.attacksPerTurn > 1)
    entries.push({
      icon: KEYWORD_ICON.multiAttack,
      label: t("effects.status.multiAttack", { count: zone.attacksPerTurn }),
      type: "buff",
    });
  if (zone.doubleAtkNextTurn)
    entries.push({
      icon: KEYWORD_ICON.doubleAttack,
      label: t("effects.status.doubleAttack"),
      type: "buff",
    });
  if (zone.forcedAttackMode) keyword("forcedAttack", "debuff");
  if (zone.guardLocked) keyword("guardLock", "debuff");
  if (zone.blockAttackTurns && zone.blockAttackTurns > 0)
    entries.push({
      icon: KEYWORD_ICON.freeze,
      label: t("effects.status.freeze", { count: zone.blockAttackTurns }),
      type: "debuff",
    });
  if (zone.turnCounter !== undefined && zone.turnCounter > 0)
    entries.push({
      icon: KEYWORD_ICON.countdown,
      label: t("effects.status.countdown", { count: zone.turnCounter }),
      type: "neutral",
    });

  return entries;
}
