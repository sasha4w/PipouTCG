import { getEquipmentEntries } from "./zoneRow.effects";
import { isBlockedFromAttacking } from "./zoneRow.helpers";
import "./MonsterZoneContent.css";

interface Props {
  zone: any;
  isOpponent: boolean;
  onModeChange?: (instanceId: string, mode: "attack" | "guard") => void;
}

export default function MonsterZoneContent({
  zone,
  isOpponent,
  onModeChange,
}: Props) {
  const blocked = isBlockedFromAttacking(zone);

  return (
    <div className="zr-monster">
      <div className="zr-monster-badges">
        {zone.hasTaunt && (
          <span className="zr-badge zr-badge--taunt" title="Provocation">
            🛡
          </span>
        )}
        {zone.hasPiercing && (
          <span className="zr-badge zr-badge--piercing" title="Perçant">
            🗡
          </span>
        )}
        {zone.isImmuneToDebuffs && (
          <span className="zr-badge zr-badge--immune" title="Immunité débuffs">
            ✨
          </span>
        )}
        {blocked && (
          <span
            className="zr-badge zr-badge--sleep"
            title="Ne peut pas attaquer ce tour"
          >
            💤
          </span>
        )}
        {zone.doubleAtkNextTurn && (
          <span
            className="zr-badge zr-badge--charge"
            title="Double attaque au prochain tour"
          >
            ⚡
          </span>
        )}
        {zone.attacksPerTurn > 1 && !blocked && (
          <span className="zr-badge zr-badge--multi" title="Double attaque">
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
            title={`S'autodétruit dans ${zone.turnCounter} tour(s)`}
          >
            ⏳{zone.turnCounter}
          </span>
        )}
        {zone.blockAttackTurns > 0 && (
          <span
            className="zr-badge zr-badge--sleep"
            title={`Ne peut pas attaquer encore ${zone.blockAttackTurns} tour(s)`}
          >
            🧊{zone.blockAttackTurns}
          </span>
        )}
        {zone.guardLocked && (
          <span
            className="zr-badge zr-badge--taunt"
            title="Verrouillé en mode Garde jusqu'à être attaqué"
          >
            🔒
          </span>
        )}
      </div>

      <div className={`zr-mode-chip zr-mode-chip--${zone.mode}`}>
        {zone.mode === "attack" ? "⚔️" : "🛡️"}
      </div>

      <div className="zr-monster-name">{zone.card.baseCard.name}</div>

      <div className="zr-monster-stats">
        {zone.card.baseCard.atk + zone.atkBuff + (zone.tempAtkBuff ?? 0)}⚔{" "}
        {zone.currentHp}/{zone.card.baseCard.hp + zone.hpBuff}❤
      </div>

      {zone.hasAttackedThisTurn &&
        zone.attacksUsedThisTurn >= zone.attacksPerTurn && (
          <div className="zr-attacked">attaqué</div>
        )}

      {Array.isArray(zone.equipments) && zone.equipments.length > 0 && (
        <div className="zr-equipment-list">
          {(zone.equipments as any[]).map((eq, eIdx) => {
            const effectSummary = getEquipmentEntries(eq)
              .map((e) => e.label)
              .join(" | ");
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
          >
            ⚔️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onModeChange(zone.instanceId, "guard");
            }}
            className={`zr-mode-btn${zone.mode === "guard" ? " zr-mode-btn--active" : ""}`}
          >
            🛡️
          </button>
        </div>
      )}
    </div>
  );
}
