import { useState } from "react";
import type { CardInstance } from "@pipou/shared";
import Button from "../../components/Button";
import InspectableCard from "./InspectableCard";
import CardInspect from "./CardInspect";
import { getCardEffectEntries } from "./fight.effects";
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
  const [inspected, setInspected] = useState<CardInstance | null>(null);

  return (
    <div className="mull-root">
      <h2 className="mull-title">Ta main de départ</h2>
      <div className="mull-hand">
        {hand.map((c) => (
          <InspectableCard
            key={c.instanceId}
            className="mull-card"
            card={c.baseCard}
            size="sm"
            onInspect={() => setInspected(c)}
            onInspectEnd={() => setInspected(null)}
          />
        ))}
      </div>
      {decided ? (
        <p className="mull-wait">
          {opponentDecided
            ? "La partie commence…"
            : `En attente de ${opponentName}…`}
        </p>
      ) : (
        <div className="mull-actions">
          <Button onClick={() => onDecide(false)}>Garder cette main</Button>
          <Button variant="ghost-bordeaux" onClick={() => onDecide(true)}>
            Mulligan (1 fois)
          </Button>
        </div>
      )}
      {inspected && (
        <CardInspect
          card={inspected.baseCard}
          entries={getCardEffectEntries(
            inspected.baseCard.effects,
            inspected.baseCard.description,
            inspected.baseCard.supportType,
          )}
          onClose={() => setInspected(null)}
        />
      )}
    </div>
  );
}
