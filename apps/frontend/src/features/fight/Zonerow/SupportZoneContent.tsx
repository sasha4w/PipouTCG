import InspectableCard from "../InspectableCard";
import type { CardInstance } from "../fight.types";
import "./SupportZoneContent.css";

interface Props {
  zone: CardInstance;
  /** Carte touchée : le bouton « i » apparaît. */
  selected?: boolean;
  onInfo: () => void;
}

export default function SupportZoneContent({
  zone,
  selected,
  onInfo,
}: Props) {
  return (
    <div className="zr-support">
      <InspectableCard
        className="zr-card"
        card={zone.baseCard}
        size="xs"
        selected={selected}
        onInfo={onInfo}
      />
    </div>
  );
}
