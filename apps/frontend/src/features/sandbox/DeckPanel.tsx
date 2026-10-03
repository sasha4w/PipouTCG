import { useState } from "react";
import type {
  CardInstance,
  SandboxDestination,
  SandboxSetupCommand,
  Seat,
} from "@pipou/shared";
import Button from "../../components/Button";

interface Props {
  seat: Seat;
  /** Deck dans l'ordre de pioche (index 0 = prochaine carte). */
  deck: CardInstance[];
  hand: CardInstance[];
  onCommand: (command: SandboxSetupCommand) => void;
}

const SEAT_LABEL: Record<Seat, string> = { p1: "J1", p2: "J2" };

/** Ordre des pioches : remonter, réordonner, échanger avec la main. */
export default function DeckPanel({ seat, deck, hand, onCommand }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (instanceId: string, to: SandboxDestination) =>
    onCommand({ type: "move_card", seat, instanceId, to });

  return (
    <>
      <section className="sb-card" aria-label="Deck">
        <div className="sb-card__title">
          <span>
            📚 Deck {SEAT_LABEL[seat]} ({deck.length})
          </span>
        </div>
        <p className="sb-muted">
          La carte n°1 est la prochaine pioche. ⬆ la met en haut, 🖐 la prend en
          main ; sur ordinateur, glisse une carte pour la déplacer.
        </p>
        <ol className="sb-list" aria-label="Deck dans l'ordre de pioche">
          {deck.map((c, index) => (
            <li
              key={c.instanceId}
              className={`sb-row sb-row--drag${over === index ? " sb-row--over" : ""}`}
              draggable
              onDragStart={() => setDragged(c.instanceId)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(index);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragged && dragged !== c.instanceId)
                  move(dragged, { zone: "deck", index });
                setDragged(null);
                setOver(null);
              }}
            >
              <span className="sb-row__pos">{index + 1}</span>
              <div className="sb-row__info">
                <span className="sb-row__name">{c.baseCard.name}</span>
              </div>
              <div className="sb-qty">
                {index > 0 && (
                  <Button
                    size="icon"
                    variant="ghost-bordeaux"
                    aria-label={`Mettre ${c.baseCard.name} en prochaine pioche`}
                    title="Prochaine pioche"
                    onClick={() =>
                      move(c.instanceId, { zone: "deck", index: 0 })
                    }
                  >
                    ⬆
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost-bordeaux"
                  aria-label={`Prendre ${c.baseCard.name} en main`}
                  title="Prendre en main"
                  onClick={() => move(c.instanceId, { zone: "hand" })}
                >
                  🖐
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="sb-card" aria-label="Main">
        <div className="sb-card__title">
          <span>
            🖐 Main {SEAT_LABEL[seat]} ({hand.length})
          </span>
        </div>
        <ul className="sb-list">
          {hand.map((c) => (
            <li key={c.instanceId} className="sb-row">
              <div className="sb-row__info">
                <span className="sb-row__name">{c.baseCard.name}</span>
              </div>
              <Button
                size="icon"
                variant="ghost-bordeaux"
                aria-label={`Remettre ${c.baseCard.name} sur le deck`}
                title="Remettre en haut du deck"
                onClick={() => move(c.instanceId, { zone: "deck", index: 0 })}
              >
                📚
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
