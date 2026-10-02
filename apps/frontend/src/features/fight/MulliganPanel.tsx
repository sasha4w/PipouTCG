import type { CardInstance } from "@pipou/shared";
import Button from "../../components/Button";
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
  return (
    <div className="mull-root">
      <h2 className="mull-title">Ta main de départ</h2>
      <div className="mull-hand">
        {hand.map((c) => (
          <div key={c.instanceId} className="mull-card">
            <div className="mull-card-name">{c.baseCard.name}</div>
            <div className="mull-card-sub">
              {c.baseCard.type === "monster"
                ? `${c.baseCard.atk}⚔ ${c.baseCard.hp}❤ · ${c.baseCard.cost}⚡`
                : c.baseCard.supportType}
            </div>
          </div>
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
    </div>
  );
}
