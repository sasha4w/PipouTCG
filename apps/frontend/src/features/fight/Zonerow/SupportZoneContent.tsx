import type { CardInstance } from "../fight.types";
import "./SupportZoneContent.css";

interface Props {
  zone: CardInstance;
}

export default function SupportZoneContent({ zone }: Props) {
  return (
    <div className="zr-support">
      <div className="zr-support-name">{zone.baseCard.name}</div>
      <div className="zr-support-type">{zone.baseCard.supportType ?? ""}</div>
    </div>
  );
}
