import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import CardFace, { type CardFaceProps } from "../cards/CardFace";
import { useLongPress } from "../../hooks/useLongPress";
import "./InspectableCard.css";

export interface InspectableCardProps extends CardFaceProps {
  onInspect: () => void;
  onInspectEnd?: () => void;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Pastilles posées autour de la carte (sélection, paiement…). */
  children?: ReactNode;
}

/** Carte de duel : tap = action, appui long / clic droit = inspection. */
export default function InspectableCard({
  onInspect,
  onInspectEnd,
  onClick,
  className,
  style,
  children,
  ...face
}: InspectableCardProps) {
  const longPress = useLongPress({
    onLongPress: onInspect,
    onLongPressEnd: onInspectEnd,
  });
  const stats = face.stats ?? { atk: face.card.atk, hp: face.card.hp };
  const label =
    face.card.type === "support"
      ? face.card.name
      : `${face.card.name}, ${stats.atk} ATK, ${stats.hp} PV`;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      {...longPress}
      className={["icard", className].filter(Boolean).join(" ")}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <CardFace {...face} />
      {children}
    </div>
  );
}
