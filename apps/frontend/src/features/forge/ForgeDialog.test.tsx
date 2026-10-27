import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Rarity } from "@pipou/shared";
import i18n from "../../i18n";
import type { UserCollection } from "../../services/user.service";
import { forgeService } from "../../services/forge.service";
import { AppError } from "../../utils/errors";
import ForgeDialog from "./ForgeDialog";

vi.mock("../../services/forge.service", () => ({
  forgeService: { usable: vi.fn(), forge: vi.fn(), destroy: vi.fn() },
}));

function card(id: number, name: string, rarity: Rarity, owned: boolean) {
  return {
    id,
    name,
    rarity,
    type: "CREATURE",
    supportType: null,
    atk: 1,
    hp: 1,
    cost: 1,
    description: null,
    image: null,
    owned,
    quantity: owned ? 12 : 0,
  };
}

const collection: UserCollection = {
  sets: [
    {
      id: 1,
      name: "Set A",
      owned: 3,
      total: 4,
      cards: [
        card(1, "Gelée", Rarity.COMMON, true),
        card(2, "Pipou", Rarity.COMMON, true),
        card(3, "Lame", Rarity.UNCOMMON, true),
        card(4, "Griffe", Rarity.UNCOMMON, false),
      ],
    },
  ],
};

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ForgeDialog collection={collection} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

const confirm = () => screen.getByRole("button", { name: "Forger" });
const addPipou = () =>
  screen.getByRole("button", { name: "Ajouter une copie de Pipou" });

async function fillSelection() {
  await waitFor(() => expect(addPipou()).toBeEnabled());
  for (let i = 0; i < 10; i++) fireEvent.click(addPipou());
}

describe("ForgeDialog", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(forgeService.usable).mockResolvedValue([
      { cardId: 1, owned: 12, usable: 0 },
      { cardId: 2, owned: 12, usable: 12 },
    ]);
  });

  it("garde la confirmation désactivée sans coût atteint ni cible", async () => {
    renderDialog();
    await fillSelection();
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Carte à obtenir"), {
      target: { value: "4" },
    });
    expect(confirm()).toBeEnabled();
  });

  it("reste désactivée tant que la somme n'atteint pas le coût", async () => {
    renderDialog();
    await waitFor(() => expect(addPipou()).toBeEnabled());
    fireEvent.click(addPipou());
    fireEvent.change(screen.getByLabelText("Carte à obtenir"), {
      target: { value: "4" },
    });
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it("ne permet pas de sélectionner une carte sans copie utilisable", async () => {
    renderDialog();
    await waitFor(() => expect(addPipou()).toBeEnabled());
    expect(
      screen.getByRole("button", { name: "Ajouter une copie de Gelée" }),
    ).toBeDisabled();
  });

  it("affiche le message d'erreur de l'API", async () => {
    vi.mocked(forgeService.forge).mockRejectedValue(
      new AppError("Carte dans un deck", { category: "API" }),
    );
    renderDialog();
    await fillSelection();
    fireEvent.change(screen.getByLabelText("Carte à obtenir"), {
      target: { value: "4" },
    });
    fireEvent.click(confirm());
    expect(await screen.findByText("Carte dans un deck")).toBeInTheDocument();
    expect(forgeService.forge).toHaveBeenCalledWith({
      inputs: [{ cardId: 2, quantity: 10 }],
      targetCardId: 4,
    });
  });
});
