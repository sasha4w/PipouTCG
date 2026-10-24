import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../i18n";
import DeckBuilder from "../../features/deck/DeckBuilder";
import { cardService, type Card } from "../../services/card.service";
import { deckService } from "../../services/deck.service";
import { userService, type UserInventory } from "../../services/user.service";

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

  it("montre la collection en grille, les effets dans la fiche de la carte", async () => {
    await openEditor();
    expect(rows()).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Voir Ogre" }));
    const sheet = screen.getByRole("dialog", { name: "Ogre" });
    // Effets pris dans le catalogue (l'inventaire n'en a pas)
    expect(within(sheet).getAllByText(/Provocation/).length).toBeGreaterThan(0);
    expect(within(sheet).getByText("2 possédés")).toBeInTheDocument();
  });

  it("filtre la collection par set, par type et par nom", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Filtres" }));
    await userEvent.click(screen.getByRole("button", { name: "Drakon" }));
    expect(rows()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Drakon" }));

    await userEvent.click(screen.getByRole("button", { name: "Équipement" }));
    expect(screen.getByText("Aucune carte ne correspond.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Équipement" }));

    await userEvent.type(screen.getByRole("searchbox"), "oeuf");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAccessibleName("Voir Œuf de Drakon");
  });

  it("règle le nombre d'exemplaires d'un tap, dans la limite possédée", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Voir Ogre" }));
    const sheet = screen.getByRole("dialog", { name: "Ogre" });
    const qty = (n: string) => within(sheet).getByRole("radio", { name: n });

    expect(qty("0")).toBeChecked();
    // Ogre possédé en 2 exemplaires : 3 est hors d'atteinte
    expect(qty("3")).toBeDisabled();
    await userEvent.click(qty("2"));
    expect(qty("2")).toBeChecked();

    const strip = screen.getByRole("region", { name: "Mon deck" });
    expect(
      within(strip).getByRole("button", { name: "Voir Ogre (x2)" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^2 \/ 40/)).toBeInTheDocument();

    await userEvent.click(qty("1"));
    expect(
      within(strip).getByRole("button", { name: "Voir Ogre (x1)" }),
    ).toBeInTheDocument();

    await userEvent.click(qty("0"));
    expect(
      within(strip).queryByRole("button", { name: /Ogre/ }),
    ).not.toBeInTheDocument();
  });

  it("passe à la carte suivante sans fermer la fiche", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Voir Ogre" }));
    let sheet = screen.getByRole("dialog", { name: "Ogre" });
    expect(within(sheet).getByText("1 / 2")).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Carte précédente" }),
    ).toBeDisabled();

    await userEvent.click(
      within(sheet).getByRole("button", { name: "Carte suivante" }),
    );
    sheet = screen.getByRole("dialog", { name: "Œuf de Drakon" });
    expect(within(sheet).getByText("2 / 2")).toBeInTheDocument();
    expect(
      within(sheet).getByRole("button", { name: "Carte suivante" }),
    ).toBeDisabled();

    // Glisser vers la droite revient à la carte précédente
    const swipeArea = within(sheet).getByRole("radiogroup").closest(".dcs")!;
    fireEvent.touchStart(swipeArea, {
      touches: [{ clientX: 100, clientY: 0 }],
    });
    fireEvent.touchEnd(swipeArea, {
      changedTouches: [{ clientX: 220, clientY: 10 }],
    });
    expect(screen.getByRole("dialog", { name: "Ogre" })).toBeInTheDocument();
  });

  it("depuis le bandeau, la fiche permet de retirer la carte du deck", async () => {
    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: "Voir Ogre" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Ogre" })).getByRole("radio", {
        name: "1",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));

    const strip = screen.getByRole("region", { name: "Mon deck" });
    await userEvent.click(
      within(strip).getByRole("button", { name: "Voir Ogre (x1)" }),
    );
    const sheet = screen.getByRole("dialog", { name: "Ogre" });
    await userEvent.click(within(sheet).getByRole("radio", { name: "0" }));

    // La carte a quitté le bandeau : la fiche reste ouverte, sans ‹ ›
    expect(
      screen.getByText("Ajoute des cartes depuis ta collection"),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: "0" })).toBeChecked();
    expect(
      within(sheet).getByRole("button", { name: "Carte suivante" }),
    ).toBeDisabled();
  });
});
