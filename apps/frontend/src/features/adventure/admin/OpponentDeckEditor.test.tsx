import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Rarity, type AdminAdventureOpponent } from "@pipou/shared";
import i18n from "../../../i18n";
import type { Card } from "../../../services/card.service";
import { adventureService } from "../../../services/adventure.service";
import OpponentDeckEditor from "./OpponentDeckEditor";

vi.mock("../../../services/adventure.service", () => ({
  adventureService: {
    saveDeck: vi.fn(),
    regenerateDeck: vi.fn(),
  },
}));

const CARD_COUNT = 15;
const cards = Array.from({ length: CARD_COUNT }, (_, i) => ({
  id: i + 1,
  name: `Carte ${i + 1}`,
  rarity: Rarity.COMMON,
  cost: 1,
})) as unknown as Card[];

/** Deck composé des `size` premières cartes, 3 exemplaires chacune (le reste sur la dernière). */
function opponentWith(size: number): AdminAdventureOpponent {
  const deck = [];
  let left = size;
  for (let i = 0; left > 0; i++) {
    const quantity = Math.min(3, left);
    deck.push({ cardId: i + 1, name: `Carte ${i + 1}`, rarity: Rarity.COMMON, quantity });
    left -= quantity;
  }
  return {
    id: 7,
    position: 1,
    name: "IA",
    quote: "",
    portraitCardId: 1,
    archetype: "pipou",
    deck,
    deckSize: size,
    deckError: null,
    firstWinGold: 0,
    firstWinXp: 0,
    farmGold: 0,
    farmXp: 0,
    farmBoosterPct: 0,
    farmLegendaryPct: 0,
    farmCardId: null,
    farmCardPct: 0,
  };
}

function renderEditor(size: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OpponentDeckEditor opponent={opponentWith(size)} cards={cards} onDone={() => {}} />
    </QueryClientProvider>,
  );
}

const saveButton = () => screen.getByRole("button", { name: "Enregistrer le deck" });
const add = (n: number) => screen.getByRole("button", { name: `Ajouter Carte ${n}` });
const remove = (n: number) => screen.getByRole("button", { name: `Retirer Carte ${n}` });

describe("OpponentDeckEditor", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le total et autorise l'enregistrement à 30 cartes", () => {
    renderEditor(30);
    expect(screen.getByText(/Total : 30 cartes/)).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("bloque l'enregistrement à 29 cartes avec une erreur", () => {
    renderEditor(30);
    fireEvent.click(remove(10));
    expect(screen.getByText(/Total : 29 cartes/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("entre 30 et 40");
  });

  it("bloque l'enregistrement à 41 cartes", () => {
    renderEditor(40);
    expect(saveButton()).toBeEnabled();
    fireEvent.click(add(14));
    expect(screen.getByText(/Total : 41 cartes/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("ne dépasse pas 3 exemplaires d'une carte", () => {
    renderEditor(30);
    expect(add(1)).toBeDisabled();
    fireEvent.click(add(1));
    expect(screen.getByText(/Total : 30 cartes/)).toBeInTheDocument();
  });

  it("envoie le deck au serveur à l'enregistrement", async () => {
    vi.mocked(adventureService.saveDeck).mockResolvedValue({} as never);
    renderEditor(30);
    fireEvent.click(remove(10));
    fireEvent.click(add(11));
    fireEvent.click(saveButton());
    await waitFor(() => expect(adventureService.saveDeck).toHaveBeenCalledTimes(1));
    const [id, body] = vi.mocked(adventureService.saveDeck).mock.calls[0];
    expect(id).toBe(7);
    expect(body.cards.reduce((n, c) => n + c.quantity, 0)).toBe(30);
    expect(body.cards.every((c) => c.quantity >= 1 && c.quantity <= 3)).toBe(true);
  });

  it("demande confirmation avant de régénérer", async () => {
    vi.mocked(adventureService.regenerateDeck).mockResolvedValue({} as never);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    renderEditor(30);
    const button = screen.getByRole("button", { name: "Régénérer" });
    fireEvent.click(button);
    expect(adventureService.regenerateDeck).not.toHaveBeenCalled();
    confirm.mockReturnValueOnce(true);
    fireEvent.click(button);
    await waitFor(() => expect(adventureService.regenerateDeck).toHaveBeenCalledWith(7));
    confirm.mockRestore();
  });
});
