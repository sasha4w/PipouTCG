import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { CardEffect } from "@pipou/shared";
import CardFace, {
  type CardFaceCard,
  type CardFaceStats,
} from "../cards/CardFace";
import type { BuffEntry } from "./BuffDebuffSections";
import CardEffectSheet from "./CardEffectSheet";
import "./CardInspect.css";

/** Carte inspectée : sa face, et de quoi rédiger ses effets. */
export type InspectCard = CardFaceCard & {
  archetype?: string | null;
  effects?: readonly CardEffect[] | null;
  /** Stade Drakon (règle « uniquement par évolution »). */
  stage?: string | null;
};

interface Props {
  card: InspectCard;
  stats?: CardFaceStats;
  guard?: boolean;
  /** État en direct d'un monstre en jeu (stats, statuts actifs). */
  status?: BuffEntry[];
  /** Équipements posés sur le monstre inspecté. */
  equipments?: InspectCard[];
  onClose: () => void;
}

/** Carte en grand + texte de ses effets, par-dessus tout l'écran. */
export default function CardInspect({
  card,
  stats,
  guard,
  status = [],
  equipments = [],
  onClose,
}: Props) {
  // Stats déjà sur la grande carte : seuls les statuts actifs sont listés.
  const statuses = status.filter((e) => !e.variant);
  const pressedRef = useRef(false);

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
      onPointerDown={() => {
        pressedRef.current = true;
      }}
      onClick={(e) => {
        // Le portail propage les événements React aux ancêtres : on s'arrête ici
        e.stopPropagation();
        // Le clic du doigt qui relâche l'appui long ouvrant l'inspection n'a pas
        // commencé ici : on l'ignore, sinon la fenêtre se referme aussitôt.
        if (pressedRef.current) onClose();
      }}
    >
      <div className="ci-panel" onClick={(e) => e.stopPropagation()}>
        {/* La description (texte d'ambiance) figure sur la grande carte. */}
        <CardFace
          card={card}
          size="lg"
          showDescription
          stats={stats}
          guard={guard}
        />
        <CardEffectSheet
          sources={[
            { card },
            ...equipments.map((eq) => ({ card: eq, title: eq.name })),
          ]}
          statuses={statuses}
        />
      </div>
    </div>,
    document.body,
  );
}
