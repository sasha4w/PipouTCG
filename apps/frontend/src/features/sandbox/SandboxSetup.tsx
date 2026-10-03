import { useState, type ReactNode } from "react";
import {
  CardType,
  DECK_RULES,
  type SandboxCreatePayload,
  type Seat,
} from "@pipou/shared";
import Button from "../../components/Button";
import type { Card } from "../../services/card.service";
import {
  addCard,
  draftIsValid,
  draftSize,
  draftToEntries,
  fillTo,
  removeCard,
  type DeckDraft,
} from "./deckDraft";

const SEATS: Seat[] = ["p1", "p2"];
const SEAT_LABEL: Record<Seat, string> = { p1: "J1", p2: "J2" };
const OTHER: Record<Seat, Seat> = { p1: "p2", p2: "p1" };

type Kind = "all" | "monster" | "support";
const KINDS: { key: Kind; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "monster", label: "Monstres" },
  { key: "support", label: "Supports" },
];

const SUPPORT_LABEL: Record<string, string> = {
  EPHEMERAL: "Éphémère",
  EQUIPMENT: "Équipement",
  TERRAIN: "Terrain",
};

function cardMeta(c: Card): string {
  if (c.type === CardType.MONSTER)
    return `⚔ ${c.atk} · ❤ ${c.hp} · ⚡ ${c.cost}`;
  return `Support · ${SUPPORT_LABEL[c.supportType ?? ""] ?? "—"}`;
}

/** Une carte et ses boutons −/+ pour le deck édité. */
function CardRow({
  card,
  count,
  canAdd,
  deckLabel,
  onAdd,
  onRemove,
}: {
  card: Card;
  count: number;
  canAdd: boolean;
  deckLabel: string;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <li className={`sb-row${count > 0 ? " sb-row--in" : ""}`}>
      <div className="sb-row__info">
        <span className="sb-row__name">{card.name}</span>
        <span className="sb-row__meta">{cardMeta(card)}</span>
      </div>
      <div className="sb-qty">
        <Button
          size="icon"
          variant="ghost-bordeaux"
          aria-label={`Retirer ${card.name} du deck ${deckLabel}`}
          disabled={count === 0}
          onClick={onRemove}
        >
          −
        </Button>
        <span className="sb-qty__n">{count}</span>
        <Button
          size="icon"
          aria-label={`Ajouter ${card.name} au deck ${deckLabel}`}
          disabled={!canAdd}
          onClick={onAdd}
        >
          +
        </Button>
      </div>
    </li>
  );
}

interface DraftPanelProps {
  seat: Seat;
  draft: DeckDraft;
  catalog: Card[];
  onChange: (draft: DeckDraft) => void;
  onCopyOther: () => void;
}

/** Résumé et contenu du deck en cours d'édition. */
function DraftPanel({
  seat,
  draft,
  catalog,
  onChange,
  onCopyOther,
}: DraftPanelProps) {
  const label = SEAT_LABEL[seat];
  const size = draftSize(draft);
  const valid = draftIsValid(draft);
  const lines = catalog.filter((c) => draft[c.id]);

  return (
    <section className="sb-card" aria-label={`Deck ${label}`}>
      <div className="sb-card__title">
        <span>Deck {label}</span>
        <span>
          {size} / {DECK_RULES.MIN_CARDS}
          {valid ? " ✓" : ""}
        </span>
      </div>
      <div className="sb-progress">
        <div
          className={`sb-progress__bar${valid ? " sb-progress__bar--ok" : ""}`}
          style={{
            width: `${Math.min(100, (size / DECK_RULES.MIN_CARDS) * 100)}%`,
          }}
        />
      </div>
      <div className="sb-actions">
        <Button
          size="sm"
          variant="ghost-bordeaux"
          onClick={() =>
            onChange(
              fillTo(
                draft,
                catalog.map((c) => c.id),
                DECK_RULES.MIN_CARDS,
              ),
            )
          }
        >
          Compléter jusqu'à {DECK_RULES.MIN_CARDS}
        </Button>
        <Button size="sm" variant="ghost-bordeaux" onClick={onCopyOther}>
          Copier le deck {SEAT_LABEL[OTHER[seat]]}
        </Button>
        <Button
          size="sm"
          variant="ghost-bordeaux"
          disabled={size === 0}
          onClick={() => onChange({})}
        >
          Vider
        </Button>
      </div>
      {lines.length === 0 ? (
        <p className="sb-muted">
          Deck vide : ajoute des cartes depuis le catalogue ci-dessous.
        </p>
      ) : (
        <ul className="sb-list sb-list--scroll">
          {lines.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              count={draft[c.id]}
              canAdd={addCard(draft, c.id) !== draft}
              deckLabel={label}
              onAdd={() => onChange(addCard(draft, c.id))}
              onRemove={() => onChange(removeCard(draft, c.id))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface Props {
  catalog: Card[];
  onStart: (payload: SandboxCreatePayload) => void;
  /** Lien de retour affiché au-dessus du titre. */
  back?: ReactNode;
}

/** Composition libre des deux decks (tout le catalogue, règles de deck). */
export default function SandboxSetup({ catalog, onStart, back }: Props) {
  const [drafts, setDrafts] = useState<Record<Seat, DeckDraft>>({
    p1: {},
    p2: {},
  });
  const [editing, setEditing] = useState<Seat>("p1");
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [firstSeat, setFirstSeat] = useState<Seat>("p1");
  const [timer, setTimer] = useState(false);

  const draft = drafts[editing];
  const setDraft = (seat: Seat, next: DeckDraft) =>
    setDrafts((d) => ({ ...d, [seat]: next }));

  const needle = filter.trim().toLowerCase();
  const visible = catalog.filter(
    (c) =>
      (kind === "all" ||
        (kind === "monster") === (c.type === CardType.MONSTER)) &&
      (!needle || c.name.toLowerCase().includes(needle)),
  );

  const missing = SEATS.filter((s) => !draftIsValid(drafts[s]));
  const ready = missing.length === 0;

  return (
    <div className="sb-setup">
      <header className="sb-setup__head">
        {back}
        <h1 className="sb-title">🧪 Sandbox de duel</h1>
        <p className="sb-muted">
          Compose les deux decks, puis joue les deux joueurs. Rien n'est
          enregistré (ni match, ni ELO).
        </p>
      </header>

      <div className="sb-tabs" role="group" aria-label="Deck à éditer">
        {SEATS.map((seat) => (
          <Button
            key={seat}
            variant="ghost-bordeaux"
            active={editing === seat}
            className="sb-tab"
            onClick={() => setEditing(seat)}
          >
            Deck {SEAT_LABEL[seat]}
            <span className="sb-tab__count">
              {draftSize(drafts[seat])} / {DECK_RULES.MIN_CARDS}
              {draftIsValid(drafts[seat]) ? " ✓" : ""}
            </span>
          </Button>
        ))}
      </div>

      <DraftPanel
        key={editing}
        seat={editing}
        draft={draft}
        catalog={catalog}
        onChange={(d) => setDraft(editing, d)}
        onCopyOther={() => setDraft(editing, { ...drafts[OTHER[editing]] })}
      />

      <section className="sb-card" aria-label="Catalogue">
        <div className="sb-card__title">
          <span>Catalogue</span>
          <span className="sb-muted">→ deck {SEAT_LABEL[editing]}</span>
        </div>
        <input
          type="search"
          className="sb-search"
          placeholder="Rechercher une carte…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="sb-chips">
          {KINDS.map((k) => (
            <Button
              key={k.key}
              size="sm"
              variant="ghost-bordeaux"
              active={kind === k.key}
              onClick={() => setKind(k.key)}
            >
              {k.label}
            </Button>
          ))}
        </div>
        {visible.length === 0 && <p className="sb-muted">Aucune carte.</p>}
        <ul className="sb-list">
          {visible.map((c) => (
            <CardRow
              key={c.id}
              card={c}
              count={draft[c.id] ?? 0}
              canAdd={addCard(draft, c.id) !== draft}
              deckLabel={SEAT_LABEL[editing]}
              onAdd={() => setDraft(editing, addCard(draft, c.id))}
              onRemove={() => setDraft(editing, removeCard(draft, c.id))}
            />
          ))}
        </ul>
      </section>

      <footer className="sb-footer">
        <div className="sb-footer__row">
          <div className="sb-pills" role="radiogroup" aria-label="Qui commence">
            {SEATS.map((seat) => (
              <label
                key={seat}
                className={`sb-pill${firstSeat === seat ? " sb-pill--active" : ""}`}
              >
                <input
                  type="radio"
                  name="first-seat"
                  className="sb-visually-hidden"
                  checked={firstSeat === seat}
                  onChange={() => setFirstSeat(seat)}
                />
                {SEAT_LABEL[seat]} commence
              </label>
            ))}
          </div>
          <label className="sb-check">
            <input
              type="checkbox"
              checked={timer}
              onChange={(e) => setTimer(e.target.checked)}
            />
            Timer 90 s
          </label>
        </div>
        <Button
          size="lg"
          fullWidth
          disabled={!ready}
          onClick={() =>
            onStart({
              decks: {
                p1: draftToEntries(drafts.p1),
                p2: draftToEntries(drafts.p2),
              },
              firstSeat,
              timer,
            })
          }
        >
          ▶ Lancer le sandbox
        </Button>
        {!ready && (
          <p className="sb-muted">
            Il faut {DECK_RULES.MIN_CARDS} à {DECK_RULES.MAX_CARDS} cartes dans
            le deck {missing.map((s) => SEAT_LABEL[s]).join(" et le deck ")}.
          </p>
        )}
      </footer>
    </div>
  );
}
