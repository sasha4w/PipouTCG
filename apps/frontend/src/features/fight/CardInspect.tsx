import { useEffect } from "react";
import { createPortal } from "react-dom";
import CardFace, {
  type CardFaceCard,
  type CardFaceStats,
} from "../cards/CardFace";
import BuffDebuffSections, { type BuffEntry } from "./BuffDebuffSections";
import "./CardInspect.css";

interface Props {
  card: CardFaceCard;
  stats?: CardFaceStats;
  guard?: boolean;
  entries: BuffEntry[];
  onClose: () => void;
}

/** Carte en grand + effets actifs, par-dessus tout l'écran. */
export default function CardInspect({
  card,
  stats,
  guard,
  entries,
  onClose,
}: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="ci-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      onClick={(e) => {
        // Le portail propage les événements React aux ancêtres : on s'arrête ici
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="ci-panel" onClick={(e) => e.stopPropagation()}>
        <CardFace
          card={card}
          size="lg"
          showDescription
          stats={stats}
          guard={guard}
        />
        {entries.length > 0 && (
          <BuffDebuffSections entries={entries} defaultOpen />
        )}
      </div>
    </div>,
    document.body,
  );
}
