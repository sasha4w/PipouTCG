import { useState } from "react";
import type { SandboxSetupCommand, SandboxState, Seat } from "@pipou/shared";
import Button from "../../components/Button";
import DeckPanel from "./DeckPanel";
import SetupDrawer from "./SetupDrawer";
import OpponentHand from "./OpponentHand";

type ToolTab = "deck" | "setup" | "opponent";

const TABS: { key: ToolTab; label: string }[] = [
  { key: "deck", label: "📚 Deck" },
  { key: "setup", label: "🛠 Placer" },
  { key: "opponent", label: "🖐 Adverse" },
];

const OTHER: Record<Seat, Seat> = { p1: "p2", p2: "p1" };

interface Props {
  state: SandboxState;
  /** Siège affiché : ses cartes alimentent le deck et la mise en place. */
  seat: Seat;
  onCommand: (command: SandboxSetupCommand) => void;
  onClose: () => void;
}

/** Panneau qui monte du bas : deck ordonné, mise en place, main adverse. */
export default function SandboxTools({
  state,
  seat,
  onCommand,
  onClose,
}: Props) {
  const [tab, setTab] = useState<ToolTab>("deck");
  const other = state.views[OTHER[seat]].me;

  return (
    <>
      <div className="sb-sheet-backdrop" onClick={onClose} />
      <div className="sb-sheet" role="dialog" aria-label="Outils du sandbox">
        <div className="sb-sheet__head">
          <div className="sb-sheet__tabs">
            {TABS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant="ghost-bordeaux"
                active={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <Button
            size="icon"
            variant="ghost-bordeaux"
            aria-label="Fermer les outils"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        <div className="sb-sheet__body">
          {tab === "deck" && (
            <DeckPanel
              seat={seat}
              deck={state.decks[seat]}
              hand={state.views[seat].me.hand}
              onCommand={onCommand}
            />
          )}
          {tab === "setup" && (
            <SetupDrawer state={state} seat={seat} onCommand={onCommand} />
          )}
          {tab === "opponent" && (
            <OpponentHand cards={other.hand} name={other.username} />
          )}
        </div>
      </div>
    </>
  );
}
