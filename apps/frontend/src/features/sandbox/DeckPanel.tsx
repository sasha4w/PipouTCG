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

/** Ordre des pioches : remonter, réordonner, échanger avec la main. */
export default function DeckPanel({ seat, deck, hand, onCommand }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (instanceId: string, to: SandboxDestination) =>
    onCommand({ type: "move_card", seat, instanceId, to });

  return (
    <section className="sb-panel" aria-label="Deck">
      <h3>📚 Deck ({deck.length})</h3>
      <ol className="sb-cardlist" aria-label="Deck dans l'ordre de pioche">
        {deck.map((c, index) => (
          <li
            key={c.instanceId}
            className={`sb-cardrow sb-cardrow--drag${over === index ? " sb-cardrow--over" : ""}`}
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
            <span>{index + 1}.</span>
            <span className="sb-cardrow__name">{c.baseCard.name}</span>
            {index > 0 && (
              <Button
                size="icon"
                variant="ghost-gold"
                aria-label={`Mettre ${c.baseCard.name} en prochaine pioche`}
                onClick={() => move(c.instanceId, { zone: "deck", index: 0 })}
              >
                ⬆
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost-gold"
              aria-label={`Prendre ${c.baseCard.name} en main`}
              onClick={() => move(c.instanceId, { zone: "hand" })}
            >
              🖐
            </Button>
          </li>
        ))}
      </ol>

      <h3>🖐 Main ({hand.length})</h3>
      <ul className="sb-cardlist">
        {hand.map((c) => (
          <li key={c.instanceId} className="sb-cardrow">
            <span className="sb-cardrow__name">{c.baseCard.name}</span>
            <Button
              size="icon"
              variant="ghost-gold"
              aria-label={`Remettre ${c.baseCard.name} sur le deck`}
              onClick={() => move(c.instanceId, { zone: "deck", index: 0 })}
            >
              📚
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
