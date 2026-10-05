import type { Seat } from "@pipou/shared";
import Button from "../../components/Button";

interface Props {
  /** Siège affiché. */
  seat: Seat;
  /** null : la vue suit le tour. */
  forcedSeat: Seat | null;
  onForceSeat: (seat: Seat | null) => void;
  toolsOpen: boolean;
  onToggleTools: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (name: string, description?: string) => void;
  onClose: () => void;
}

const SEAT_LABEL: Record<Seat, string> = { p1: "J1", p2: "J2" };

/** Barre du sandbox : vue jouée, annuler/refaire, outils, sauvegarde. */
export default function SandboxToolbar({
  seat,
  forcedSeat,
  onForceSeat,
  toolsOpen,
  onToggleTools,
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
        <span className="sb-toolbar__label">Vue</span>
        <Button
          size="sm"
          variant="ghost-bordeaux"
          active={forcedSeat === null}
          title="La vue suit le joueur qui doit agir"
          onClick={() => onForceSeat(null)}
        >
          Auto ({SEAT_LABEL[seat]})
        </Button>
        {(["p1", "p2"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="ghost-bordeaux"
            active={forcedSeat === s}
            onClick={() => onForceSeat(s)}
          >
            {SEAT_LABEL[s]}
          </Button>
        ))}
      </div>
      <div className="sb-toolbar__group">
        <Button
          size="icon"
          variant="ghost-bordeaux"
          aria-label="Annuler"
          title="Annuler"
          disabled={!canUndo}
          onClick={onUndo}
        >
          ↶
        </Button>
        <Button
          size="icon"
          variant="ghost-bordeaux"
          aria-label="Refaire"
          title="Refaire"
          disabled={!canRedo}
          onClick={onRedo}
        >
          ↷
        </Button>
        <Button
          size="icon"
          variant="ghost-bordeaux"
          active={toolsOpen}
          aria-label="Outils"
          title="Deck, mise en place, main adverse"
          onClick={onToggleTools}
        >
          🛠
        </Button>
        <Button
          size="icon"
          variant="ghost-bordeaux"
          aria-label="Sauver le scénario"
          title="Sauver le scénario"
          onClick={() => {
            const name = window.prompt("Nom du scénario ?")?.trim();
            if (!name) return;
            const description = window
              .prompt("Description (facultative) ?")
              ?.trim();
            onSave(name, description || undefined);
          }}
        >
          💾
        </Button>
        <Button
          size="icon"
          variant="ghost-bordeaux"
          aria-label="Fermer le sandbox"
          title="Fermer le sandbox"
          onClick={() => {
            if (
              window.confirm(
                "Fermer ce sandbox ? L'état non sauvegardé sera perdu.",
              )
            )
              onClose();
          }}
        >
          ✖
        </Button>
      </div>
    </div>
  );
}
