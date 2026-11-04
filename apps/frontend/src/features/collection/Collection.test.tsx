import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CardType, Rarity } from "@pipou/shared";
import i18n from "../../i18n";
import type { Card } from "../../services/card.service";
import type { UserCollection } from "../../services/user.service";
import { cardService } from "../../services/card.service";
import { userService } from "../../services/user.service";
import { forgeService } from "../../services/forge.service";
import Collection from "../../pages/Collection";

vi.mock("../../services/card.service", async (orig) => ({
  ...(await orig<typeof import("../../services/card.service")>()),
  cardService: { findAll: vi.fn() },
}));
vi.mock("../../services/user.service", () => ({
  userService: {
    getMyCollection: vi.fn(),
    getMe: vi.fn(),
    setCardLock: vi.fn(),
  },
}));
vi.mock("../../services/forge.service", () => ({
  forgeService: { usable: vi.fn() },
}));

function card(id: number, name: string, rarity: Rarity): Card {
  return {
    id,
    name,
    rarity,
    type: CardType.MONSTER,
    supportType: null,
    atk: 1,
    hp: 1,
    cost: 1,
    image: null,
    cardSet: { id: 1, name: "Set A" },
  } as Card;
}

function collectionItem(c: Card, quantity: number, lockedQuantity: number) {
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    type: c.type,
    supportType: null,
    atk: 1,
    hp: 1,
    cost: 1,
    description: null,
    image: null,
    owned: quantity > 0,
    quantity,
    lockedQuantity,
  };
}

const gelee = card(1, "Gelée", Rarity.COMMON);
const pipou = card(2, "Pipou", Rarity.COMMON);
let lockedPipou = 0;

function collection(): UserCollection {
  return {
    sets: [
      {
        id: 1,
        name: "Set A",
        owned: 1,
        total: 2,
        cards: [
          collectionItem(gelee, 0, 0),
          collectionItem(pipou, 4, lockedPipou),
        ],
      },
    ],
  };
}

function renderPage(url = "/collection") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Collection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Collection", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    lockedPipou = 0;
    vi.mocked(cardService.findAll).mockResolvedValue({
      data: [gelee, pipou],
      total: 2,
    } as never);
    vi.mocked(userService.getMyCollection).mockImplementation(async () =>
      collection(),
    );
    vi.mocked(userService.getMe).mockResolvedValue({ dust: 500 } as never);
    vi.mocked(forgeService.usable).mockImplementation(
      async () =>
        [
          { cardId: 2, usable: 4 - lockedPipou, lockedQuantity: lockedPipou },
        ] as never,
    );
    vi.mocked(userService.setCardLock).mockImplementation(async (_id, n) => {
      lockedPipou = n;
      return {} as never;
    });
  });

  it("affiche les trois onglets, Collection actif par défaut", async () => {
    renderPage();
    expect(
      await screen.findByRole("tab", { name: "Collection" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Forge" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Destruction" }),
    ).toBeInTheDocument();
  });

  it("?tab=forge active l'onglet Forge", async () => {
    renderPage("/collection?tab=forge");
    expect(await screen.findByRole("tab", { name: "Forge" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("affiche le solde de poussière", async () => {
    renderPage();
    expect(await screen.findByText("500")).toBeInTheDocument();
  });

  it("l'icône œil ouvre CardInspect avec le nom de la carte", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Voir Pipou" }));
    expect(
      await screen.findByRole("dialog", { name: "Pipou" }),
    ).toBeInTheDocument();
  });

  it("verrouiller 2 copies appelle le service et affiche « 2 verrouillées »", async () => {
    renderPage();
    const select = await screen.findByLabelText(
      "Verrouiller des copies de Pipou",
    );
    fireEvent.change(select, { target: { value: "2" } });
    await waitFor(() =>
      expect(userService.setCardLock).toHaveBeenCalledWith(2, 2),
    );
    expect(await screen.findByText("2 verrouillées")).toBeInTheDocument();
  });
});
