import "./SupportZoneContent.css";
interface Props {
  zone: any;
}

export default function SupportZoneContent({ zone }: Props) {
  return (
    <div className="zr-support">
      <div className="zr-support-name">{zone.baseCard.name}</div>
      <div className="zr-support-type">{zone.baseCard.supportType ?? ""}</div>
    </div>
  );
}
