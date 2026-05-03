import { useEffect, useRef } from "react";
import "./BuffDebuffList.css";

export interface BuffEntry {
  icon: string;
  label: string;
  type: "buff" | "debuff" | "neutral";
}

interface Props {
  entries: BuffEntry[];
  cardName: string;
  supportType?: string;
  /** Position du badge dans le viewport pour positionner le tooltip */
  anchorRect: DOMRect;
  onClose: () => void;
}

export default function BuffDebuffList({
  entries,
  cardName,
  supportType,
  anchorRect,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Fermer en cliquant hors du tooltip
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Positionner : au-dessus ou en-dessous selon l'espace dispo
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const above = spaceBelow < 180;

  return (
    <div
      ref={ref}
      className="bdl-popup"
      style={{
        left: anchorRect.left + anchorRect.width / 2,
        top: above ? anchorRect.top - 8 : anchorRect.bottom + 8,
        transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
    >
      <div className="bdl-header">
        <span className="bdl-card-name">{cardName}</span>
        {supportType && <span className="bdl-type-chip">{supportType}</span>}
      </div>

      {entries.length === 0 ? (
        <div className="bdl-empty">Aucun effet listé</div>
      ) : (
        <ul className="bdl-list">
          {entries.map((e, i) => (
            <li key={i} className={`bdl-entry bdl-entry--${e.type}`}>
              <span className="bdl-icon">{e.icon}</span>
              <span className="bdl-label">{e.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
