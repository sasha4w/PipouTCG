import { useState } from "react";
import {
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

const SEAT_LABEL: Record<Seat, string> = { p1: "J1", p2: "J2" };

interface DraftPanelProps {
  seat: Seat;
  draft: DeckDraft;
  catalog: Card[];
  editing: boolean;
  onEdit: () => void;
  onChange: (draft: DeckDraft) => void;
  onCopyOther: () => void;
}

/** Contenu d'un deck en cours de composition. */
function DraftPanel({
  seat,
  draft,
  catalog,
  editing,
  onEdit,
  onChange,
  onCopyOther,
}: DraftPanelProps) {
  const label = `Deck ${SEAT_LABEL[seat]}`;
  const lines = catalog.filter((c) => draft[c.id]);
  return (
    <section className="sb-panel" aria-label={label}>
      <h3>
        {label} — {draftSize(draft)} / {DECK_RULES.MIN_CARDS}
        {draftIsValid(draft) ? " ✅" : ""}
      </h3>
      <div className="sb-toolbar">
        <Button
          size="sm"
          variant="ghost-gold"
          active={editing}
          onClick={onEdit}
        >
          {editing ? "En cours d'édition" : "Éditer ce deck"}
        </Button>
        <Button
          size="sm"
          variant="ghost-gold"
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
        <Button size="sm" variant="ghost-gold" onClick={onCopyOther}>
          Copier l'autre deck
        </Button>
        <Button size="sm" variant="ghost-bordeaux" onClick={() => onChange({})}>
          Vider
        </Button>
      </div>
      <ul className="sb-cardlist">
        {lines.map((c) => (
          <li key={c.id} className="sb-cardrow">
            <span className="sb-cardrow__name">{c.name}</span>
            <span>×{draft[c.id]}</span>
            <Button
              size="icon"
              variant="ghost-bordeaux"
              aria-label={`Retirer ${c.name} du deck ${SEAT_LABEL[seat]}`}
              onClick={() => onChange(removeCard(draft, c.id))}
            >
              −
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Props {
  catalog: Card[];
  onStart: (payload: SandboxCreatePayload) => void;
}

/** Composition libre des deux decks (tout le catalogue, règles de deck). */
export default function SandboxSetup({ catalog, onStart }: Props) {
  const [drafts, setDrafts] = useState<Record<Seat, DeckDraft>>({
    p1: {},
    p2: {},
  });
  const [editing, setEditing] = useState<Seat>("p1");
  const [filter, setFilter] = useState("");
  const [firstSeat, setFirstSeat] = useState<Seat>("p1");
  const [timer, setTimer] = useState(false);

  const setDraft = (seat: Seat, draft: DeckDraft) =>
    setDrafts((d) => ({ ...d, [seat]: draft }));
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? catalog.filter((c) => c.name.toLowerCase().includes(needle))
    : catalog;
  const ready = draftIsValid(drafts.p1) && draftIsValid(drafts.p2);

  return (
    <div className="sb-setup">
      <h1>🧪 Sandbox de duel</h1>
      <div className="sb-setup__decks">
        {(["p1", "p2"] as const).map((seat) => (
          <DraftPanel
            key={seat}
            seat={seat}
            draft={drafts[seat]}
            catalog={catalog}
            editing={editing === seat}
            onEdit={() => setEditing(seat)}
            onChange={(d) => setDraft(seat, d)}
            onCopyOther={() =>
              setDraft(seat, { ...drafts[seat === "p1" ? "p2" : "p1"] })
            }
          />
        ))}
      </div>

      <section className="sb-panel" aria-label="Catalogue">
        <h3>Catalogue → deck {SEAT_LABEL[editing]}</h3>
        <input
          type="search"
          placeholder="Filtrer par nom…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="sb-cardlist">
          {visible.map((c) => (
            <li key={c.id} className="sb-cardrow">
              <span className="sb-cardrow__name">
                {c.name}{" "}
                <small>
                  {c.type === "monster"
                    ? `${c.atk}⚔ ${c.hp}❤ · ${c.cost}⚡`
                    : (c.supportType ?? c.type)}
                </small>
              </span>
              <span>×{drafts[editing][c.id] ?? 0}</span>
              <Button
                size="icon"
                variant="ghost-gold"
                aria-label={`Ajouter ${c.name} au deck ${SEAT_LABEL[editing]}`}
                onClick={() =>
                  setDraft(editing, addCard(drafts[editing], c.id))
                }
              >
                +
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="sb-setup__options">
        {(["p1", "p2"] as const).map((seat) => (
          <label key={seat}>
            <input
              type="radio"
              name="first-seat"
              checked={firstSeat === seat}
              onChange={() => setFirstSeat(seat)}
            />{" "}
            {SEAT_LABEL[seat]} commence
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={timer}
            onChange={(e) => setTimer(e.target.checked)}
          />{" "}
          Timer de 90 s
        </label>
        <Button
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
      </div>
    </div>
  );
}
