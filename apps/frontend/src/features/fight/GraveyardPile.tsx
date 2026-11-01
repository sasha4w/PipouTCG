import { useState } from "react";
import { useTranslation } from "react-i18next";
import BottomSheet from "../../components/BottomSheet";
import InspectableCard from "./InspectableCard";
import CardDrawer from "./CardDrawer";
import "./GraveyardPile.css";
import type { CardInstance } from "./fight.types";

interface Props {
  graveyard: CardInstance[];
  label: string;
  onClose: () => void;
}

/** Cimetière dans une feuille, ouverte depuis le HUD. */
export default function GraveyardPile({ graveyard, label, onClose }: Props) {
  const { t } = useTranslation();
  const [inspected, setInspected] = useState<CardInstance | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  return (
    <BottomSheet
      title={t("fight.graveyard.owner", {
        name: label,
        count: graveyard.length,
      })}
      closeLabel={t("fight.graveyard.close")}
      onClose={onClose}
    >
      <div className="gp-list">
        {[...graveyard].reverse().map((c) => (
          <InspectableCard
            key={c.instanceId}
            card={c.baseCard}
            size="sm"
            selected={pickedId === c.instanceId}
            onClick={() => setPickedId(c.instanceId)}
            onInfo={() => setInspected(c)}
          />
        ))}
      </div>
      {inspected && (
        <CardDrawer card={inspected.baseCard} onClose={() => setInspected(null)} />
      )}
    </BottomSheet>
  );
}
