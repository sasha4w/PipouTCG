import { SupportType } from "@pipou/shared";
import InspectableCard from "../InspectableCard";
import type { CardInstance } from "../fight.types";
import { IconTerrain } from "../../../components/Icons";
import { ChargeFrame } from "./ChargeFrame";
import "./SupportZoneContent.css";

interface Props {
  zone: CardInstance;
  /** Carte touchée : le bouton « i » apparaît. */
  selected?: boolean;
  chargeFx?: "pulse" | "burst";
  onInfo: () => void;
}

export default function SupportZoneContent({
  zone,
  selected,
  chargeFx,
  onInfo,
}: Props) {
  const card = (
    <InspectableCard
      className="zr-card"
      card={zone.baseCard}
      size="xs"
      selected={selected}
      onInfo={onInfo}
    />
  );
  return (
    <div className="zr-support">
      {zone.baseCard.supportType === SupportType.CHARGE ? (
        <ChargeFrame
          counters={zone.chargeCounters ?? 0}
          max={zone.baseCard.chargeMax ?? 1}
          fx={chargeFx}
        >
          {card}
        </ChargeFrame>
      ) : (
        card
      )}
      {zone.baseCard.isTerrain && (
        <span className="zr-support__terrain">
          <IconTerrain size={12} />
        </span>
      )}
    </div>
  );
}
