import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Archetype, type StarterStatus } from "@pipou/shared";
import i18n from "../../i18n";
import { cardService, type Card } from "../../services/card.service";
import { starterDeckService } from "../../services/starterDeck.service";
import { AppError } from "../../utils/errors";
import StarterDeckModal from "./StarterDeckModal";

vi.mock("../../services/card.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/card.service")>()),
  cardService: { findAll: vi.fn() },
}));
vi.mock("../../services/starterDeck.service", () => ({
  starterDeckService: { getStatus: vi.fn(), claim: vi.fn() },
}));
vi.mock("../../services/sound.service");

const cards = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  name: `Carte ${i + 1}`,
  rarity: "common",
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 1,
  effects: null,
  image: null,
  cardSet: { id: 1, name: "PipouSquad" },
})) as unknown as Card[];

const ORDER = [Archetype.PIPOU, Archetype.PIXELMAN, Archetype.DRAGON];
const status: StarterStatus = {
  claimed: false,
  available: true,
  decks: ORDER.map((archetype, d) => ({
    archetype,
    isValid: true,
    cards: Array.from({ length: 5 }, (_, i) => ({
      cardId: d * 5 + i + 1,
      quantity: 2,
      isFeatured: i < 4,
    })),
  })),
};

const t = (key: string, opts?: Record<string, unknown>) =>
  i18n.t(key, opts) as string;

function setup() {
  vi.mocked(cardService.findAll).mockResolvedValue({
    data: cards,
    meta: { total: 15, page: 1, limit: 500, totalPages: 1 },
  } as never);
  const onClose = vi.fn();
  const addToast = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <StarterDeckModal status={status} onClose={onClose} addToast={addToast} />
    </QueryClientProvider>,
  );
  return { onClose, addToast, invalidate };
}

const chooseName = (name: string) =>
  screen.getByRole("button", { name: t("starter.choose", { name }) });

describe("StarterDeckModal", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("change de deck avec les onglets", async () => {
    setup();
    expect(
      screen.getByText(t("starter.deck.pipou.gameplay")),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Pixelman" }));
    expect(
      screen.getByText(t("starter.deck.pixelman.gameplay")),
    ).toBeInTheDocument();
  });

  it("affiche le toast d'indice quand on ferme sans choisir", async () => {
    const { onClose, addToast } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(addToast).toHaveBeenCalledWith(t("starter.closed_hint"), "warning");
    expect(onClose).toHaveBeenCalled();
  });

  it("confirme une seule fois, même sur double clic", async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.mocked(starterDeckService.claim).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );
    const { invalidate } = setup();
    await userEvent.click(screen.getByRole("tab", { name: "Drakon" }));
    await userEvent.click(chooseName("Drakon"));
    const confirm = await screen.findByRole("button", {
      name: t("starter.confirm"),
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(starterDeckService.claim).toHaveBeenCalledWith("dragon"),
    );
    expect(starterDeckService.claim).toHaveBeenCalledTimes(1);
    resolve({ archetype: "dragon", deckId: 1, gold: 5000 });
    expect(
      await screen.findByText(
        t("starter.deck.dragon.how_to_play").split("\n")[0],
      ),
    ).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalled();
  });

  it("affiche l'erreur du serveur et revient à la sélection", async () => {
    vi.mocked(starterDeckService.claim).mockRejectedValue(
      new AppError("Starter indisponible", { category: "API" }),
    );
    setup();
    await userEvent.click(chooseName("Pipou"));
    await userEvent.click(
      await screen.findByRole("button", { name: t("starter.confirm") }),
    );
    expect(await screen.findByText("Starter indisponible")).toBeInTheDocument();
    await waitFor(() => expect(chooseName("Pipou")).toBeInTheDocument());
  });
});
