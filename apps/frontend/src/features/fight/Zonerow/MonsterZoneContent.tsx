import { useTranslation } from "react-i18next";
import { EquipmentPips } from "./EquipmentPips";
import { hasSpentAttacks, monsterFaceStats } from "./zoneRow.helpers";
import InspectableCard from "../InspectableCard";
import {
  IconGuard,
  IconSwords,
} from "../../../components/Icons";
import type { MonsterOnBoard } from "../fight.types";
import type { CombatMode } from "@pipou/shared";
import StatusBadges from "./StatusBadges";
import "./MonsterZoneContent.css";

interface Props {
  zone: MonsterOnBoard;
  isOpponent: boolean;
  onModeChange?: (instanceId: string, mode: CombatMode) => void;
  /** Carte touchée : le bouton « i » apparaît. */
  selected?: boolean;
  onInfo: () => void;
}

export default function MonsterZoneContent({
  zone,
  isOpponent,
  onModeChange,
  selected,
  onInfo,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="zr-monster">
      <InspectableCard
        className="zr-card"
        card={zone.card.baseCard}
        size="xs"
        stats={monsterFaceStats(zone)}
        guard={zone.mode === "guard"}
        spent={hasSpentAttacks(zone)}
        badges={<StatusBadges monster={zone} />}
        selected={selected}
        onInfo={onInfo}
      />

      <EquipmentPips equipments={zone.equipments ?? []} />

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
            <IconSwords size={14} />
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
            <IconGuard size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
