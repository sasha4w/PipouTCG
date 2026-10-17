import type React from "react";
import { useState } from "react";
import "./ZoneRow.css";
import { getRarityBorderColor, monsterFaceStats } from "./zoneRow.helpers";
import { useTranslation } from "react-i18next";
import { getMonsterStatusEntries } from "./zoneRow.effects";
import { useZoneAnimations } from "./useZoneAnimations";
import MonsterZoneContent from "./MonsterZoneContent";
import SupportZoneContent from "./SupportZoneContent";
import CardFace from "../../cards/CardFace";
import CardInspect from "../CardInspect";
import { isMonsterZone, type BoardZone } from "../fight.types";
import type { CombatMode } from "@pipou/shared";
import { useAnimationPrefs } from "../../../contexts/useAnimationPrefs";
import type { ZoneFxMap } from "../fightEvents";

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
  /** Surligne uniquement les cartes en jeu dont l'instanceId est listé. */
  highlightInstanceIds?: ReadonlySet<string>;
  highlightOpponentEmpty?: boolean;
  onSupportRecycle?: (idx: number) => void;
  selectedZone?: number | null;
  recycleEnergy?: number;
  attackingZone?: number | null;
  damagedZones?: Set<number>;
  /** Effets serveur de l'état courant, par index de zone. */
  fx?: ZoneFxMap;
}

export default function ZoneRow({
  label,
  zones,
  isSupport = false,
  isOpponent = false,
  dim = false,
  highlightEmpty = false,
  highlightFilled = false,
  highlightInstanceIds,
  highlightOpponentEmpty = false,
  onZoneClick,
  onMonsterClick,
  onModeChange,
  selectedZone,
  recycleEnergy,
  attackingZone,
  damagedZones,
  fx,
}: Props) {
  const { t } = useTranslation();
  const { reduced } = useAnimationPrefs();
  const { summoningZones, flippingZones, dyingZones } = useZoneAnimations(
    zones,
    isSupport,
    fx,
    reduced,
  );

  const [inspectId, setInspectId] = useState<string | null>(null);
  const inspected =
    inspectId !== null
      ? zones.find((z) => z?.instanceId === inspectId)
      : undefined;

  return (
    <div className={`zr-wrap${isOpponent ? " zr-wrap--opponent" : ""}`}>
      <div className="zr-label">
        {label}{" "}
        {recycleEnergy !== undefined && recycleEnergy > 0 && (
          <span className="zr-energy">⚡×{recycleEnergy}</span>
        )}
      </div>

      <div className="zr-row">
        {zones.map((zone, idx) => {
          const dying = !zone ? dyingZones.get(idx) : undefined;
          const isShattering = !!dying;
          const dyingData = dying?.zone;
          const summonTier = zone ? summoningZones.get(idx) : undefined;
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
            (highlightFilled && !!zone) ||
            (!!zone && !!highlightInstanceIds?.has(zone.instanceId))
              ? "zr-zone--pulse-equipment"
              : "",
            isZetaTarget ? "zr-zone--pulse-target zr-zone--zeta-target" : "",
            summonTier ? `zr-zone--summon-in zr-zone--summon-t${summonTier}` : "",
            dying ? `zr-zone--destroy-${dying.cause.replace(/_/g, "-")}` : "",
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
              style={
                rarityColor
                  ? ({
                      borderColor: rarityColor,
                      "--rarity-color": rarityColor,
                    } as React.CSSProperties)
                  : undefined
              }
              onClick={() => {
                if (zone && onMonsterClick && zone.instanceId)
                  onMonsterClick(zone.instanceId);
                else if (onZoneClick) onZoneClick(idx);
              }}
            >
              {summonTier && summonTier >= 2 && (
                <span className="zr-summon-fx" aria-hidden />
              )}
              {summonTier && summonTier >= 3 && (
                <span className="zr-summon-beam" aria-hidden />
              )}
              {zone ? (
                isMonsterZone(zone) ? (
                  <MonsterZoneContent
                    zone={zone}
                    isOpponent={isOpponent}
                    onModeChange={onModeChange}
                    onInspect={() => setInspectId(zone.instanceId)}
                    onInspectEnd={() => setInspectId(null)}
                  />
                ) : (
                  <SupportZoneContent
                    zone={zone}
                    onInspect={() => setInspectId(zone.instanceId)}
                    onInspectEnd={() => setInspectId(null)}
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
          status={
            isMonsterZone(inspected)
              ? getMonsterStatusEntries(inspected, t)
              : undefined
          }
          equipments={
            isMonsterZone(inspected)
              ? inspected.equipments.map((eq) => eq.baseCard)
              : undefined
          }
          onClose={() => setInspectId(null)}
        />
      )}
    </div>
  );
}
