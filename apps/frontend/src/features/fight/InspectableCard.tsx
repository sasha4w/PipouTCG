import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import CardFace, { type CardFaceProps } from "../cards/CardFace";
import { IconInfo } from "../../components/Icons";
import "./InspectableCard.css";

export interface InspectableCardProps extends CardFaceProps {
  onClick?: () => void;
  /** Carte sélectionnée : le bouton « i » apparaît (si `onInfo` est fourni). */
  selected?: boolean;
  /** Ouvre le tiroir d'info de la carte. */
  onInfo?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Pastilles posées autour de la carte (sélection, paiement…). */
  children?: ReactNode;
}

/** Carte de duel : tap = action, bouton « i » de la carte sélectionnée = info. */
export default function InspectableCard({
  onClick,
  selected = false,
  onInfo,
  className,
  style,
  children,
  ...face
}: InspectableCardProps) {
  const { t } = useTranslation();
  const stats = face.stats ?? { atk: face.card.atk, hp: face.card.hp };
  const label =
    face.card.type === "support"
      ? face.card.name
      : t("fight.cardLabel", {
          name: face.card.name,
          atk: stats.atk,
          hp: stats.hp,
        });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
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
      {selected && onInfo && (
        <button
          type="button"
          className="icard-info"
          aria-label={t("fight.info")}
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <IconInfo size={16} />
        </button>
      )}
    </div>
  );
}
