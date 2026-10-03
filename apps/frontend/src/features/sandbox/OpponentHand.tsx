import type { CardInstance } from "@pipou/shared";

/** Main du joueur non affiché, visible en sandbox uniquement. */
export default function OpponentHand({
  cards,
  name,
}: {
  cards: CardInstance[];
  name: string;
}) {
  return (
    <section className="sb-panel" aria-label={`Main de ${name}`}>
      <h3>
        🖐 Main de {name} ({cards.length})
      </h3>
      <ul className="sb-cardlist">
        {cards.map((c) => (
          <li key={c.instanceId} className="sb-cardrow">
            <span className="sb-cardrow__name">{c.baseCard.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
