import { useTranslation } from "react-i18next";
import { equipmentSummary } from "./zoneRow.effects";
import {
  hasSpentAttacks,
  isBlockedFromAttacking,
  monsterFaceStats,
} from "./zoneRow.helpers";
import InspectableCard from "../InspectableCard";
import { IconEgg, IconGuard } from "../../../components/Icons";
import type { MonsterOnBoard } from "../fight.types";
import {
  EFFECT_IMMUNITIES,
  GUARD_MAX_TURNS,
  hasImmunity,
  type CombatMode,
} from "@pipou/shared";
import "./MonsterZoneContent.css";

interface Props {
  zone: MonsterOnBoard;
  isOpponent: boolean;
  onModeChange?: (instanceId: string, mode: CombatMode) => void;
  onInspect: () => void;
  onInspectEnd: () => void;
}

export default function MonsterZoneContent({
  zone,
  isOpponent,
  onModeChange,
  onInspect,
  onInspectEnd,
}: Props) {
  const { t } = useTranslation();
  const blocked = isBlockedFromAttacking(zone);

  const badges = (
    <>
      {zone.hasTaunt && (
        <span
          className="zr-badge zr-badge--taunt"
          title={t("keywords.taunt.name")}
        >
          🛡
        </span>
      )}
      {zone.hasPiercing && (
        <span
          className="zr-badge zr-badge--piercing"
          title={t("keywords.piercing.name")}
        >
          🗡
        </span>
      )}
      {EFFECT_IMMUNITIES.every((i) => hasImmunity(zone, i)) && (
        <span
          className="zr-badge zr-badge--immune"
          title={t("keywords.debuffImmunity.name")}
        >
          ✨
        </span>
      )}
      {blocked && (
        <span
          className="zr-badge zr-badge--sleep"
          title={t("fight.badge.sleep")}
        >
          💤
        </span>
      )}
      {zone.doubleAtkNextTurn && (
        <span
          className="zr-badge zr-badge--charge"
          title={t("effects.status.doubleAttack")}
        >
          ⚡
        </span>
      )}
      {zone.attacksPerTurn > 1 && !blocked && (
        <span
          className="zr-badge zr-badge--multi"
          title={t("fight.badge.attacksLeft", {
            count: zone.attacksPerTurn - zone.attacksUsedThisTurn,
          })}
        >
          ×{zone.attacksPerTurn - zone.attacksUsedThisTurn}
        </span>
      )}
      {zone.turnCounter !== undefined && (
        <span
          className={[
            "zr-badge zr-badge--counter",
            zone.turnCounter <= 1 ? "zr-badge--counter-urgent" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title={t("effects.status.countdown", { count: zone.turnCounter })}
        >
          ⏳{zone.turnCounter}
        </span>
      )}
      {zone.hatchCounter !== undefined && zone.hatchCounter > 0 && (
        <span
          className={[
            "zr-badge zr-badge--counter zr-badge--hatch",
            zone.hatchCounter <= 1 ? "zr-badge--counter-urgent" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title={t("effects.status.hatch", { count: zone.hatchCounter })}
        >
          <IconEgg size={11} />
          {zone.hatchCounter}
        </span>
      )}
      {(zone.blockAttackTurns ?? 0) > 0 && (
        <span
          className="zr-badge zr-badge--sleep"
          title={t("effects.status.freeze", {
            count: zone.blockAttackTurns,
          })}
        >
          🧊{zone.blockAttackTurns}
        </span>
      )}
      {zone.mode === "guard" && (
        <span
          className={[
            "zr-badge zr-badge--counter",
            (zone.guardTurns ?? 0) + 1 >= GUARD_MAX_TURNS
              ? "zr-badge--counter-urgent"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          title={t("effects.status.guard", {
            turns: zone.guardTurns ?? 0,
            max: GUARD_MAX_TURNS,
          })}
        >
          <IconGuard size={11} />
          {zone.guardTurns ?? 0}/{GUARD_MAX_TURNS}
        </span>
      )}
      {zone.guardLocked && (
        <span
          className="zr-badge zr-badge--taunt"
          title={t("keywords.guardLock.desc")}
        >
          🔒
        </span>
      )}
    </>
  );

  return (
    <div className="zr-monster">
      <InspectableCard
        className="zr-card"
        card={zone.card.baseCard}
        size="xs"
        stats={monsterFaceStats(zone)}
        guard={zone.mode === "guard"}
        spent={hasSpentAttacks(zone)}
        badges={badges}
        onInspect={onInspect}
        onInspectEnd={onInspectEnd}
      />

      {Array.isArray(zone.equipments) && zone.equipments.length > 0 && (
        <div className="zr-equipment-list">
          {zone.equipments.map((eq, eIdx) => {
            const effectSummary = equipmentSummary(eq, t);
            const shortName =
              (eq.baseCard?.name ?? "?").length > 10
                ? (eq.baseCard?.name ?? "?").slice(0, 9) + "…"
                : (eq.baseCard?.name ?? "?");
            return (
              <span
                key={eIdx}
                className="zr-equipment-chip"
                title={`${eq.baseCard?.name ?? "?"}\n${effectSummary}`}
              >
                🔧 {shortName}
              </span>
            );
          })}
        </div>
      )}

      {!isOpponent && onModeChange && !zone.forcedAttackMode && (
        <div className="zr-mode-btns">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onModeChange(zone.instanceId, "attack");
            }}
            className={`zr-mode-btn${zone.mode === "attack" ? " zr-mode-btn--active" : ""}`}
            aria-label={t("fight.mode.attack")}
            title={t("fight.mode.attack")}
          >
            ⚔️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onModeChange(zone.instanceId, "guard");
            }}
            className={`zr-mode-btn${zone.mode === "guard" ? " zr-mode-btn--active" : ""}`}
            aria-label={t("fight.mode.guard")}
            title={t("fight.mode.guard")}
          >
            🛡️
          </button>
        </div>
      )}
    </div>
  );
}
