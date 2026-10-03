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
    <section className="sb-card" aria-label={`Main de ${name}`}>
      <div className="sb-card__title">
        <span>
          🖐 Main de {name} ({cards.length})
        </span>
      </div>
      {cards.length === 0 && <p className="sb-muted">Main vide.</p>}
      <ul className="sb-list">
        {cards.map((c) => (
          <li key={c.instanceId} className="sb-row">
            <div className="sb-row__info">
              <span className="sb-row__name">{c.baseCard.name}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
