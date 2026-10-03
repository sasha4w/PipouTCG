import type { Seat } from "@pipou/shared";
import Button from "../../components/Button";

interface Props {
  /** Siège affiché. */
  seat: Seat;
  /** null : la vue suit le tour. */
  forcedSeat: Seat | null;
  onForceSeat: (seat: Seat | null) => void;
  showOpponentHand: boolean;
  onToggleOpponentHand: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (name: string, description?: string) => void;
  onClose: () => void;
}

export default function SandboxToolbar({
  seat,
  forcedSeat,
  onForceSeat,
  showOpponentHand,
  onToggleOpponentHand,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="sb-toolbar" role="toolbar" aria-label="Outils du sandbox">
      <div className="sb-toolbar__group">
        <span>Vue :</span>
        <Button
          size="sm"
          variant="ghost-gold"
          active={forcedSeat === null}
          onClick={() => onForceSeat(null)}
        >
          Auto ({seat === "p1" ? "J1" : "J2"})
        </Button>
        {(["p1", "p2"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="ghost-gold"
            active={forcedSeat === s}
            onClick={() => onForceSeat(s)}
          >
            {s === "p1" ? "J1" : "J2"}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost-gold"
        active={showOpponentHand}
        onClick={onToggleOpponentHand}
      >
        👁 Main adverse
      </Button>
      <div className="sb-toolbar__group">
        <Button
          size="sm"
          variant="ghost-gold"
          disabled={!canUndo}
          onClick={onUndo}
        >
          ↶ Annuler
        </Button>
        <Button
          size="sm"
          variant="ghost-gold"
          disabled={!canRedo}
          onClick={onRedo}
        >
          ↷ Refaire
        </Button>
      </div>
      <Button
        size="sm"
        onClick={() => {
          const name = window.prompt("Nom du scénario ?")?.trim();
          if (!name) return;
          const description = window
            .prompt("Description (facultative) ?")
            ?.trim();
          onSave(name, description || undefined);
        }}
      >
        💾 Sauver
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          if (
            window.confirm(
              "Fermer ce sandbox ? L'état non sauvegardé sera perdu.",
            )
          )
            onClose();
        }}
      >
        ✖ Fermer
      </Button>
    </div>
  );
}
