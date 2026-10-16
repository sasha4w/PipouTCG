import InspectableCard from "../InspectableCard";
import type { CardInstance } from "../fight.types";
import "./SupportZoneContent.css";

interface Props {
  zone: CardInstance;
  onInspect: () => void;
  onInspectEnd: () => void;
}

export default function SupportZoneContent({
  zone,
  onInspect,
  onInspectEnd,
}: Props) {
  return (
    <div className="zr-support">
      <InspectableCard
        className="zr-card"
        card={zone.baseCard}
        size="xs"
        onInspect={onInspect}
        onInspectEnd={onInspectEnd}
      />
    </div>
  );
}
