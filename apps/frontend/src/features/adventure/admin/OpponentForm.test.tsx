import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Rarity, type AdminAdventureOpponent } from "@pipou/shared";
import i18n from "../../../i18n";
import type { Card } from "../../../services/card.service";
import { adventureService } from "../../../services/adventure.service";
import OpponentForm from "./OpponentForm";

vi.mock("../../../services/adventure.service", () => ({
  adventureService: { updateOpponent: vi.fn() },
}));

const cards = [
  { id: 1, name: "Pipou", rarity: Rarity.COMMON, cost: 1 },
  { id: 2, name: "Ancestral Feros", rarity: Rarity.LEGENDARY, cost: 0 },
] as unknown as Card[];

const opponent = (
  over: Partial<AdminAdventureOpponent> = {},
): AdminAdventureOpponent => ({
  id: 7,
  position: 1,
  name: "IA",
  quote: "",
  portraitCardId: 1,
  archetype: "pipou",
  deck: [],
  deckSize: 30,
  deckError: null,
  firstWinGold: 100,
  firstWinXp: 50,
  farmGold: 15,
  farmXp: 10,
  farmBoosterPct: 3,
  farmLegendaryPct: 0,
  farmCardId: null,
  farmCardPct: 0,
  ...over,
});

function renderForm(over: Partial<AdminAdventureOpponent> = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OpponentForm opponent={opponent(over)} cards={cards} onDone={() => {}} />
    </QueryClientProvider>,
  );
}

const farmCardSelect = () => screen.getByLabelText("Carte précise en farm");
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
const sentBody = () =>
  vi.mocked(adventureService.updateOpponent).mock.calls[0][1];

describe("OpponentForm", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adventureService.updateOpponent).mockResolvedValue(
      undefined as never,
    );
  });

  it("envoie la carte précise choisie et son taux", async () => {
    renderForm();
    fireEvent.change(farmCardSelect(), { target: { value: "2" } });
    fireEvent.change(
      screen.getByLabelText("Chance de la carte précise en farm (%)"),
      {
        target: { value: "5" },
      },
    );
    save();
    await waitFor(() =>
      expect(adventureService.updateOpponent).toHaveBeenCalled(),
    );
    expect(sentBody()).toMatchObject({ farmCardId: 2, farmCardPct: 5 });
  });

  it("« Aucune » envoie une carte nulle et un taux à 0", async () => {
    renderForm({ farmCardId: 2, farmCardPct: 5 });
    expect(farmCardSelect()).toHaveValue("2");
    fireEvent.change(farmCardSelect(), { target: { value: "" } });
    save();
    await waitFor(() =>
      expect(adventureService.updateOpponent).toHaveBeenCalled(),
    );
    expect(sentBody()).toMatchObject({ farmCardId: null, farmCardPct: 0 });
  });
});
