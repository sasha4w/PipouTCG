import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ClientCard, DrakonElement, SupportType } from "@pipou/shared";
import type { TFunction } from "i18next";
import {
  IconEarth,
  IconFire,
  IconWater,
  IconWind,
} from "../../components/Icons";
import "./CardFace.css";

const SUPPORT_TYPE_LABELS: Record<string, string> = {
  EPHEMERAL: "Éphémère",
  EQUIPMENT: "Équipement",
  TERRAIN: "Terrain",
};

/** Forme minimale : satisfaite par Card (card.service) et par ClientCard (@pipou/shared). */
export type CardFaceCard = Pick<
  ClientCard,
  "id" | "name" | "rarity" | "type" | "atk" | "hp"
> & {
  supportType?: SupportType | null;
  cost?: number;
  description?: string | null;
  image?: { url: string } | null;
  element?: DrakonElement | null;
};

export type StatState = "up" | "down";

export interface CardFaceStats {
  atk: number;
  hp: number;
  atkState?: StatState;
  hpState?: StatState;
}

export type CardFaceSize = "xs" | "sm" | "md" | "lg";

export interface CardFaceProps {
  card: CardFaceCard;
  /** xs = taille duel (main, terrain), sans pied de carte. */
  size: CardFaceSize;
  /** Pied de carte avec description. Ignoré en xs/sm. */
  showDescription?: boolean;
  /** Stats courantes ; absent = stats de base de la carte. */
  stats?: CardFaceStats;
  guard?: boolean;
  spent?: boolean;
  /** Pastilles d'état, posées en haut à gauche de l'illustration. */
  badges?: ReactNode;
}

const ELEMENT_ICON = {
  earth: IconEarth,
  fire: IconFire,
  wind: IconWind,
  water: IconWater,
} as const;

/** Pastille d'élément d'un Drakon, posée dans l'en-tête à gauche du nom. */
function elementBadge(
  element: DrakonElement,
  size: CardFaceSize,
  t: TFunction,
) {
  const Icon = ELEMENT_ICON[element];
  return (
    <span
      className={`card-face__element card-face__element--${element}`}
      role="img"
      aria-label={t(`effects.element.${element}`)}
    >
      <Icon size={size === "xs" ? 9 : 13} />
    </span>
  );
}

function statBadgeClass(state: StatState | undefined): string {
  return state
    ? `card-face__stat-badge card-face__stat-badge--${state}`
    : "card-face__stat-badge";
}

/** Recto d'une carte, sans aucune interaction. */
export default function CardFace({
  card,
  size,
  showDescription = false,
  stats,
  guard = false,
  spent = false,
  badges,
}: CardFaceProps) {
  const { t } = useTranslation();
  const isSupport = card.type.toLowerCase() === "support";
  const supportLabel = card.supportType
    ? (SUPPORT_TYPE_LABELS[card.supportType] ?? card.supportType)
    : null;
  const current = stats ?? { atk: card.atk, hp: card.hp };
  const withFooter = showDescription && (size === "md" || size === "lg");

  return (
    <div
      className={[
        "card-face",
        `card-face--${size}`,
        guard ? "card-face--guard" : "",
        spent ? "card-face--spent" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-rarity={card.rarity.toLowerCase()}
    >
      <div className="card-face__header">
        {card.element && elementBadge(card.element, size, t)}
        <div className="card-face__name">{card.name}</div>
        {card.cost !== undefined && (
          <div className="card-face__cost">{card.cost}</div>
        )}
      </div>

      <div className="card-face__image-wrap">
        {card.image?.url ? (
          <img
            className="card-face__image"
            src={card.image.url}
            alt={card.name}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className="card-face__image-placeholder" aria-hidden="true">
            ✦
          </div>
        )}

        {badges && <div className="card-face__badges">{badges}</div>}

        {guard && (
          <div className="card-face__guard-shield" aria-hidden="true">
            🛡️
          </div>
        )}

        {spent && <div className="card-face__spent-label">a attaqué</div>}

        {!isSupport && (
          <div className="card-face__stats-overlay">
            <div className={statBadgeClass(current.atkState)}>
              <span className="card-face__stat-label">ATK</span>
              <span className="card-face__stat-value">{current.atk}</span>
            </div>
            <div className={statBadgeClass(current.hpState)}>
              <span className="card-face__stat-label">HP</span>
              <span className="card-face__stat-value">{current.hp}</span>
            </div>
          </div>
        )}

        {isSupport && supportLabel && (
          <div className="card-face__support-badge">{supportLabel}</div>
        )}
      </div>

      {withFooter && (
        <div className="card-face__footer">
          {card.description ? (
            <div className="card-face__description">{card.description}</div>
          ) : (
            <div className="card-face__description" style={{ opacity: 0.3 }}>
              —
            </div>
          )}
          <div className="card-face__id-row">
            <span className="card-face__id">#{card.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}
