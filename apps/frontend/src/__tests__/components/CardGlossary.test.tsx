import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../i18n";
import CardGlossary from "../../features/glossary/CardGlossary";
import { cardService, type Card } from "../../services/card.service";

vi.mock("../../services/card.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/card.service")>()),
  cardService: { findAll: vi.fn() },
}));

vi.mock("../../services/sound.service");

const pipou = { id: 1, name: "PipouSquad" };
const drakon = { id: 3, name: "Drakon - Les légendes primaires" };

function card(patch: Partial<Card>): Card {
  return {
    id: 1,
    name: "Carte",
    rarity: "common",
    type: "monster",
    atk: 100,
    hp: 500,
    cost: 1,
    effects: null,
    image: null,
    cardSet: pipou,
    ...patch,
  } as Card;
}

const cards: Card[] = [
  card({
    id: 1,
    name: "Ogre",
    effects: [
      {
        trigger: "ON_SUMMON",
        condition: null,
        actions: [{ type: "SET_TAUNT", target: "SELF" }],
      },
    ],
  }),
  card({
    id: 2,
    name: "Épée",
    type: "support",
    supportType: "EQUIPMENT",
  } as Partial<Card>),
  card({ id: 3, name: "Œuf de Drakon", cardSet: drakon }),
];

function renderGlossary() {
  vi.mocked(cardService.findAll).mockResolvedValue({
    data: cards,
    meta: { total: 3, page: 1, limit: 500, totalPages: 1 },
  } as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CardGlossary onBack={vi.fn()} />
    </QueryClientProvider>,
  );
}

const rows = () => screen.getAllByRole("button", { name: /^Voir / });

describe("CardGlossary", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("liste toutes les cartes avec l'aperçu de leurs effets", async () => {
    renderGlossary();
    expect(
      await screen.findByRole("button", { name: "Voir Ogre" }),
    ).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
    expect(
      screen.getByText("Provocation", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("filtre par set, par type et par nom (sans accents)", async () => {
    renderGlossary();
    await screen.findByRole("button", { name: "Voir Ogre" });

    await userEvent.click(screen.getByRole("button", { name: "Drakon" }));
    expect(rows()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Tous" }));

    await userEvent.click(screen.getByRole("button", { name: "Équipement" }));
    expect(rows()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Équipement" }));

    await userEvent.type(screen.getByRole("searchbox"), "oeuf");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveAccessibleName("Voir Œuf de Drakon");
  });

  it("ouvre la fiche du combat au toucher d'une carte", async () => {
    renderGlossary();
    await userEvent.click(
      await screen.findByRole("button", { name: "Voir Ogre" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Ogre" });
    expect(
      within(dialog).getByText("Provocation", { selector: "dt", exact: false }),
    ).toBeInTheDocument();
  });
});
