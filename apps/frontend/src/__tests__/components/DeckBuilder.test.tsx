import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../i18n";
import DeckBuilder from "../../features/deck/DeckBuilder";
import { cardService, type Card } from "../../services/card.service";
import { deckService } from "../../services/deck.service";
import {
  userService,
  type UserInventory,
} from "../../services/user.service";

vi.mock("../../services/card.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/card.service")>()),
  cardService: { findAll: vi.fn() },
}));
vi.mock("../../services/deck.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/deck.service")>()),
  deckService: { getMyDecks: vi.fn() },
}));
vi.mock("../../services/user.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/user.service")>()),
  userService: { getMyInventory: vi.fn() },
}));
vi.mock("../../services/sound.service");

const pipou = { id: 1, name: "PipouSquad" };
const drakon = { id: 3, name: "Drakon - Les légendes primaires" };

const catalog: Card[] = [
  {
    id: 1,
    name: "Ogre",
    rarity: "common",
    type: "monster",
    atk: 100,
    hp: 500,
    cost: 2,
    effects: [
      {
        trigger: "ON_SUMMON",
        condition: null,
        actions: [{ type: "SET_TAUNT", target: "SELF" }],
      },
    ],
    image: null,
    cardSet: pipou,
  },
  {
    id: 2,
    name: "Œuf de Drakon",
    rarity: "common",
    type: "monster",
    atk: 0,
    hp: 300,
    cost: 1,
    effects: null,
    image: null,
    cardSet: drakon,
  },
] as Card[];

function owned(card: Card, userCardId: number, quantity: number) {
  return {
    userCardId,
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    atk: card.atk,
    hp: card.hp,
    cost: card.cost,
    type: card.type,
    set: card.cardSet.name,
    setId: card.cardSet.id,
    image: null,
    quantity,
  };
}

async function openEditor() {
  vi.mocked(cardService.findAll).mockResolvedValue({
    data: catalog,
    meta: { total: 2, page: 1, limit: 500, totalPages: 1 },
  } as never);
  vi.mocked(deckService.getMyDecks).mockResolvedValue([]);
  vi.mocked(userService.getMyInventory).mockResolvedValue({
    cards: {
      data: [owned(catalog[0], 10, 2), owned(catalog[1], 11, 5)],
      meta: { total: 2, page: 1, limit: 200, totalPages: 1 },
    },
  } as unknown as UserInventory);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <DeckBuilder />
    </QueryClientProvider>,
  );
  await screen.findByText("Aucun deck créé");
  await userEvent.click(screen.getByRole("button", { name: "+ Nouveau" }));
  await screen.findByRole("button", { name: "Voir Ogre" });
}

const rows = () => screen.getAllByRole("button", { name: /^Voir [^(]+$/ });

describe("DeckBuilder — éditeur", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("montre les effets des cartes possédées, pris dans le catalogue", async () => {
    await openEditor();
    expect(rows()).toHaveLength(2);
    expect(
      screen.getByText("Provocation", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("filtre la collection par set, par type et par nom", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Drakon" }));
    expect(rows()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Tous" }));

    await userEvent.click(screen.getByRole("button", { name: "Équipement" }));
    expect(screen.getByText("Aucune carte ne correspond.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Équipement" }));

    await userEvent.type(screen.getByRole("searchbox"), "oeuf");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAccessibleName("Voir Œuf de Drakon");
  });

  it("ajoute au bandeau jusqu'au nombre d'exemplaires possédés", async () => {
    await openEditor();
    const add = screen.getByRole("button", { name: "Ajouter Ogre" });
    await userEvent.click(add);
    await userEvent.click(add);
    expect(add).toBeDisabled();

    const strip = screen.getByRole("region", { name: "Mon deck" });
    expect(
      within(strip).getByRole("button", { name: "Voir Ogre (x2)" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retirer Ogre" }));
    expect(
      within(strip).getByRole("button", { name: "Voir Ogre (x1)" }),
    ).toBeInTheDocument();
  });

  it("ouvre la fiche de la carte au toucher d'une ligne", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Voir Ogre" }));
    expect(screen.getByRole("dialog", { name: "Ogre" })).toBeInTheDocument();
  });
});
