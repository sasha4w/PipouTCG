import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconEye } from "../../components/Icons";
import { soundService } from "../../services/sound.service";
import CardFace from "../cards/CardFace";
import type { OwnedCard } from "./ownedCards";
import "./CardRow.css";

interface Props {
  item: OwnedCard;
  /** Texte secondaire sous le nom. */
  meta?: ReactNode;
  disabled?: boolean;
  selected?: boolean;
  onInspect: () => void;
  /** Emplacement d'un sélecteur (verrou, quantité). */
  children?: ReactNode;
}

/** Ligne de carte commune aux onglets : vignette, nom, sélecteur, œil. */
export default function CardRow({
  item,
  meta,
  disabled,
  selected,
  onInspect,
  children,
}: Props) {
  const { t } = useTranslation();
  const { card } = item;
  const cls = [
    "card-row",
    disabled && "card-row--disabled",
    selected && "card-row--selected",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className="card-row__thumb">
        <CardFace card={card} size="xs" />
      </div>
      <div className="card-row__body">
        <div className="card-row__name">{card.name}</div>
        {meta && <div className="card-row__meta">{meta}</div>}
        {children}
      </div>
      <button
        type="button"
        className="card-row__eye"
        aria-label={t("collection.view", { name: card.name })}
        onClick={() => {
          soundService.play("select");
          onInspect();
        }}
      >
        <IconEye size={20} />
      </button>
    </div>
  );
}
