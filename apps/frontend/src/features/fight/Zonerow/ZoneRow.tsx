import { useState } from "react";
import "./ZoneRow.css";
import "../BuffDebuffList.css";
import { getRarityBorderColor } from "./zoneRow.helpers";
import {
  getSupportBuffEntries,
  getMonsterBuffEntries,
} from "./zoneRow.effects";
import { useZoneAnimations } from "./useZoneAnimations";
import MonsterZoneContent from "./MonsterZoneContent";
import SupportZoneContent from "./SupportZoneContent";
import BuffDebuffList from "../BuffDebuffList";

interface Props {
  label: string;
  zones: (any | null)[];
  isSupport?: boolean;
  isOpponent?: boolean;
  dim?: boolean;
  onZoneClick?: (idx: number) => void;
  onMonsterClick?: (instanceId: string) => void;
  onModeChange?: (instanceId: string, mode: "attack" | "guard") => void;
  highlightEmpty?: boolean;
  highlightFilled?: boolean;
  highlightOpponentEmpty?: boolean;
  onSupportRecycle?: (idx: number) => void;
  selectedZone?: number | null;
  recycleEnergy?: number;
  attackingZone?: number | null;
  damagedZones?: Set<number>;
}

export default function ZoneRow({
  label,
  zones,
  isSupport = false,
  isOpponent = false,
  dim = false,
  highlightEmpty = false,
  highlightFilled = false,
  highlightOpponentEmpty = false,
  onZoneClick,
  onMonsterClick,
  onModeChange,
  selectedZone,
  recycleEnergy,
  attackingZone,
  damagedZones,
}: Props) {
  const { summoningZones, flippingZones, dyingZones } = useZoneAnimations(
    zones,
    isSupport,
  );

  const [openBuffIdx, setOpenBuffIdx] = useState<number | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const handleBadgeClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    e.stopPropagation();
    if (openBuffIdx === idx) {
      setOpenBuffIdx(null);
      setAnchorRect(null);
    } else {
      setOpenBuffIdx(idx);
      setAnchorRect(e.currentTarget.getBoundingClientRect());
    }
  };

  return (
    <div className="zr-wrap">
      <div className="zr-label">
        {label}{" "}
        {recycleEnergy !== undefined && recycleEnergy > 0 && (
          <span className="zr-energy">⚡×{recycleEnergy}</span>
        )}
      </div>

      <div className="zr-row">
        {zones.map((zone, idx) => {
          const isShattering = !zone && !!dyingZones.get(idx);
          const dyingData = dyingZones.get(idx);
          const isZetaTarget = highlightOpponentEmpty && !zone && !isShattering;
          const rarityColor =
            getRarityBorderColor(zone ?? null, isSupport) ??
            getRarityBorderColor(dyingData, isSupport);

          const zoneClasses = [
            "zr-zone",
            dim ? "zr-zone--dim" : "",
            zone
              ? "zr-zone--filled"
              : isShattering
                ? "zr-zone--shattering"
                : "zr-zone--empty",
            selectedZone === idx ? "zr-zone--selected" : "",
            onZoneClick || (zone && onMonsterClick) ? "zr-zone--clickable" : "",
            highlightEmpty && !zone && !isShattering
              ? "zr-zone--pulse-target"
              : "",
            highlightFilled && !!zone ? "zr-zone--pulse-equipment" : "",
            isZetaTarget ? "zr-zone--pulse-target zr-zone--zeta-target" : "",
            summoningZones.has(idx) ? "zr-zone--summon-in" : "",
            flippingZones.has(idx) ? "zr-zone--mode-flip" : "",
            attackingZone === idx ? "zr-zone--attacking" : "",
            damagedZones?.has(idx) ? "zr-zone--damaged" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={idx}
              className={zoneClasses}
              style={rarityColor ? { borderColor: rarityColor } : undefined}
              onClick={() => {
                if (zone && onMonsterClick && zone.instanceId)
                  onMonsterClick(zone.instanceId);
                else if (onZoneClick) onZoneClick(idx);
              }}
            >
              {!!zone && (
                <button
                  className={`bdl-trigger${openBuffIdx === idx ? " bdl-trigger--active" : ""}`}
                  onClick={(e) => handleBadgeClick(e, idx)}
                  title="Voir les effets"
                >
                  i
                </button>
              )}

              {zone ? (
                isSupport ? (
                  <SupportZoneContent zone={zone} />
                ) : (
                  <MonsterZoneContent
                    zone={zone}
                    isOpponent={isOpponent}
                    onModeChange={onModeChange}
                  />
                )
              ) : isShattering && dyingData ? (
                isSupport ? (
                  <SupportZoneContent zone={dyingData} />
                ) : (
                  <div className="zr-monster zr-dying-content">
                    <div
                      className={`zr-mode-chip zr-mode-chip--${dyingData.mode}`}
                    >
                      {dyingData.mode === "attack" ? "⚔️" : "🛡️"}
                    </div>
                    <div className="zr-monster-name">
                      {dyingData.card?.baseCard?.name}
                    </div>
                    <div className="zr-monster-stats">
                      {dyingData.card?.baseCard?.atk}⚔ 0/
                      {dyingData.card?.baseCard?.hp}❤
                    </div>
                  </div>
                )
              ) : isZetaTarget ? (
                <span className="zr-zeta-hint">🦠 Poser Zeta</span>
              ) : (
                <span className="zr-empty-plus">+</span>
              )}
            </div>
          );
        })}
      </div>

      {openBuffIdx !== null && anchorRect && zones[openBuffIdx] && (
        <BuffDebuffList
          entries={
            isSupport
              ? getSupportBuffEntries(zones[openBuffIdx])
              : getMonsterBuffEntries(zones[openBuffIdx])
          }
          cardName={
            isSupport
              ? (zones[openBuffIdx]?.baseCard?.name ?? "")
              : (zones[openBuffIdx]?.card?.baseCard?.name ?? "")
          }
          supportType={
            isSupport ? zones[openBuffIdx]?.baseCard?.supportType : undefined
          }
          anchorRect={anchorRect}
          onClose={() => {
            setOpenBuffIdx(null);
            setAnchorRect(null);
          }}
        />
      )}
    </div>
  );
}
