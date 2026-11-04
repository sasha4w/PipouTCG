import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CardType } from "@pipou/shared";
import i18n from "../../i18n";
import type { Deck } from "../../services/deck.service";
import { deckService } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import DeckWidget from "./DeckWidget";

vi.mock("../../services/deck.service", () => ({
  deckService: { getMyDecks: vi.fn(), setFavorite: vi.fn() },
}));

let nextId = 1;
function deck(over: Partial<Deck> = {}, total = 30): Deck {
  const deckCards: Deck["deckCards"] = [];
  for (let left = total; left > 0; left -= 3) {
    const id = nextId++;
    deckCards.push({
      quantity: Math.min(3, left),
      userCard: {
        id,
        quantity: 3,
        card: { id, name: `C${id}`, rarity: "common", type: CardType.MONSTER, atk: 100, hp: 100, cost: 1 } as Deck["deckCards"][number]["userCard"]["card"],
      },
    });
  }
  return { id: nextId++, name: "Deck", userId: 1, deckCards, createdAt: "", updatedAt: "", isFavorite: false, lastUsedAt: null, ...over };
}

function renderWidget(decks: Deck[], selectedDeckId?: number) {
  vi.mocked(deckService.getMyDecks).mockResolvedValue(decks);
  const onSelectDeck = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DeckWidget selectedDeckId={selectedDeckId} onSelectDeck={onSelectDeck} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onSelectDeck };
}

beforeAll(() => i18n.changeLanguage("fr"));
beforeEach(() => {
  vi.clearAllMocks();
});

describe("DeckWidget", () => {
  it("présélectionne le dernier deck utilisé", async () => {
    const fav = deck({ name: "Favori", isFavorite: true });
    const last = deck({ name: "Gang", lastUsedAt: "2026-11-03T10:00:00Z" });
    const { onSelectDeck } = renderWidget([fav, last]);
    await waitFor(() => expect(onSelectDeck).toHaveBeenCalledWith(last.id));
  });

  it("affiche le deck choisi en grand, avec « dernier utilisé »", async () => {
    const last = deck({ name: "Gang", lastUsedAt: "2026-11-03T10:00:00Z" });
    renderWidget([last], last.id);
    expect(await screen.findByText("Gang")).toBeTruthy();
    expect(screen.getByText(/dernier utilisé/)).toBeTruthy();
  });

  it("masque les decks injouables et les compte", async () => {
    const ok = deck({ name: "Complet" });
    const broken = deck({ name: "Cassé" }, 20);
    renderWidget([ok, broken], ok.id);
    fireEvent.click(await screen.findByRole("button", { name: "Changer" }));
    expect(screen.queryByText("Cassé")).toBeNull();
    expect(screen.getByText("1 deck incomplet masqué ›")).toBeTruthy();
  });

  it("« Changer » liste favoris d'abord et choisit au tap", async () => {
    const a = deck({ name: "A" });
    const z = deck({ name: "Z", isFavorite: true });
    const { onSelectDeck } = renderWidget([a, z], a.id);
    fireEvent.click(await screen.findByRole("button", { name: "Changer" }));
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Z"),
      expect.stringContaining("A"),
    ]);
    fireEvent.click(options[0]);
    expect(onSelectDeck).toHaveBeenCalledWith(z.id);
  });

  it("aucun deck jouable : lien pour compléter", async () => {
    renderWidget([deck({}, 20)]);
    expect(await screen.findByText("Aucun deck jouable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compléter un deck" })).toBeTruthy();
  });

  it("renvoie le deck par défaut quand le choix devient injouable", async () => {
    const a = deck({ name: "A", lastUsedAt: "2026-11-03T10:00:00Z" });
    const b = deck({ name: "B" });
    vi.mocked(deckService.getMyDecks).mockResolvedValue([a, b]);
    const onSelectDeck = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = (sel?: number) => (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DeckWidget selectedDeckId={sel} onSelectDeck={onSelectDeck} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(ui());
    await waitFor(() => expect(onSelectDeck).toHaveBeenCalledWith(a.id));
    rerender(ui(b.id));
    await screen.findByText("B");
    onSelectDeck.mockClear();
    client.setQueryData(QUERY_KEYS.decks, [a, { ...b, deckCards: [] }]);
    await waitFor(() => expect(onSelectDeck).toHaveBeenCalledWith(a.id));
  });
});
