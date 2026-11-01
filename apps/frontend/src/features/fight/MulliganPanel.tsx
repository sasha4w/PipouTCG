import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CardInstance } from "@pipou/shared";
import Button from "../../components/Button";
import InspectableCard from "./InspectableCard";
import CardDrawer from "./CardDrawer";
import "./MulliganPanel.css";

interface Props {
  hand: CardInstance[];
  decided: boolean;
  opponentDecided: boolean;
  opponentName: string;
  onDecide: (redraw: boolean) => void;
}

/** Main de départ : la garder, ou la remélanger une seule fois. */
export default function MulliganPanel({
  hand,
  decided,
  opponentDecided,
  opponentName,
  onDecide,
}: Props) {
  const { t } = useTranslation();
  const [inspected, setInspected] = useState<CardInstance | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  return (
    <div className="mull-root">
      <h2 className="mull-title">{t("fight.mulligan.title")}</h2>
      <div className="mull-hand">
        {hand.map((c) => (
          <InspectableCard
            key={c.instanceId}
            className="mull-card"
            card={c.baseCard}
            size="sm"
            selected={pickedId === c.instanceId}
            onClick={() => setPickedId(c.instanceId)}
            onInfo={() => setInspected(c)}
          />
        ))}
      </div>
      {decided ? (
        <p className="mull-wait">
          {opponentDecided
            ? t("fight.mulligan.starting")
            : t("fight.mulligan.waiting", { name: opponentName })}
        </p>
      ) : (
        <div className="mull-actions">
          <Button onClick={() => onDecide(false)}>
            {t("fight.mulligan.keep")}
          </Button>
          <Button variant="ghost-bordeaux" onClick={() => onDecide(true)}>
            {t("fight.mulligan.redraw")}
          </Button>
        </div>
      )}
      {inspected && (
        <CardDrawer
          card={inspected.baseCard}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}
