import { useState } from "react";
import "./ZoneRow.css";
import { getRarityBorderColor, monsterFaceStats } from "./zoneRow.helpers";
import {
  getSupportBuffEntries,
  getMonsterBuffEntries,
} from "./zoneRow.effects";
import { useZoneAnimations } from "./useZoneAnimations";
import MonsterZoneContent from "./MonsterZoneContent";
import SupportZoneContent from "./SupportZoneContent";
import CardFace from "../../cards/CardFace";
import CardInspect from "../CardInspect";
import { isMonsterZone, type BoardZone } from "../fight.types";
import type { CombatMode } from "@pipou/shared";

interface Props {
  label: string;
  zones: (BoardZone | null)[];
  isSupport?: boolean;
  isOpponent?: boolean;
  dim?: boolean;
  onZoneClick?: (idx: number) => void;
  onMonsterClick?: (instanceId: string) => void;
  onModeChange?: (instanceId: string, mode: CombatMode) => void;
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

  const [inspectIdx, setInspectIdx] = useState<number | null>(null);
  const inspected = inspectIdx !== null ? zones[inspectIdx] : null;

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
            getRarityBorderColor(zone) ?? getRarityBorderColor(dyingData);

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
              {zone ? (
                isMonsterZone(zone) ? (
                  <MonsterZoneContent
                    zone={zone}
                    isOpponent={isOpponent}
                    onModeChange={onModeChange}
                    onInspect={() => setInspectIdx(idx)}
                    onInspectEnd={() => setInspectIdx(null)}
                  />
                ) : (
                  <SupportZoneContent
                    zone={zone}
                    onInspect={() => setInspectIdx(idx)}
                    onInspectEnd={() => setInspectIdx(null)}
                  />
                )
              ) : isShattering && dyingData ? (
                <div className="zr-monster zr-dying-content">
                  <div className="zr-card">
                    {isMonsterZone(dyingData) ? (
                      <CardFace
                        card={dyingData.card.baseCard}
                        size="xs"
                        stats={{
                          atk: dyingData.card.baseCard.atk,
                          hp: 0,
                          hpState: "down",
                        }}
                        guard={dyingData.mode === "guard"}
                      />
                    ) : (
                      <CardFace card={dyingData.baseCard} size="xs" />
                    )}
                  </div>
                </div>
              ) : isZetaTarget ? (
                <span className="zr-zeta-hint">🦠 Poser Zeta</span>
              ) : (
                <span className="zr-empty-plus">+</span>
              )}
            </div>
          );
        })}
      </div>

      {inspected && (
        <CardInspect
          card={
            isMonsterZone(inspected)
              ? inspected.card.baseCard
              : inspected.baseCard
          }
          stats={
            isMonsterZone(inspected) ? monsterFaceStats(inspected) : undefined
          }
          guard={isMonsterZone(inspected) && inspected.mode === "guard"}
          entries={
            isMonsterZone(inspected)
              ? getMonsterBuffEntries(inspected)
              : getSupportBuffEntries(inspected)
          }
          onClose={() => setInspectIdx(null)}
        />
      )}
    </div>
  );
}
