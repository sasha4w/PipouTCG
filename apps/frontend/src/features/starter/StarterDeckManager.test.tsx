import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Archetype, type StarterDeckView } from "@pipou/shared";
import i18n from "../../i18n";
import { cardService, type Card } from "../../services/card.service";
import { starterDeckService } from "../../services/starterDeck.service";
import StarterDeckManager from "./StarterDeckManager";

vi.mock("../../services/card.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/card.service")>()),
  cardService: { findAll: vi.fn() },
}));
vi.mock("../../services/starterDeck.service", () => ({
  starterDeckService: { adminList: vi.fn(), saveDeck: vi.fn() },
}));

const cards = Array.from({ length: 16 }, (_, i) => ({
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

/** 15 cartes x2 = 30, 4 phares. */
const pipouCards = Array.from({ length: 15 }, (_, i) => ({
  cardId: i + 1,
  quantity: 2,
  isFeatured: i < 4,
}));

const decks: StarterDeckView[] = [
  { archetype: Archetype.PIPOU, isValid: true, cards: pipouCards },
  { archetype: Archetype.PIXELMAN, isValid: false, cards: [] },
  { archetype: Archetype.DRAGON, isValid: false, cards: [] },
];

const t = (key: string, opts?: Record<string, unknown>) =>
  i18n.t(key, opts) as string;

async function setup() {
  vi.mocked(cardService.findAll).mockResolvedValue({
    data: cards,
    meta: { total: 16, page: 1, limit: 500, totalPages: 1 },
  } as never);
  vi.mocked(starterDeckService.adminList).mockResolvedValue(decks);
  vi.mocked(starterDeckService.saveDeck).mockResolvedValue(decks[0]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <StarterDeckManager />
    </QueryClientProvider>,
  );
  const section = await screen.findByRole("region", {
    name: t("starter.deck.pipou.name"),
  });
  return { section, invalidate };
}

const saveButton = (section: HTMLElement) =>
  within(section).getByRole("button", { name: t("starter_admin.save") });
const remove = (section: HTMLElement, n: number) =>
  within(section).getByRole("button", {
    name: t("starter_admin.remove", { name: `Carte ${n}` }),
  });
const feature = (section: HTMLElement, n: number) =>
  within(section).getByRole("checkbox", {
    name: t("starter_admin.feature", { name: `Carte ${n}` }),
  });

describe("StarterDeckManager", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("à 30 cartes et 4 phares, enregistre la liste", async () => {
    const user = userEvent.setup();
    const { section, invalidate } = await setup();
    const button = saveButton(section);
    expect(button).toBeEnabled();
    await user.click(button);
    await waitFor(() =>
      expect(starterDeckService.saveDeck).toHaveBeenCalledWith(
        Archetype.PIPOU,
        { cards: pipouCards },
      ),
    );
    await waitFor(() => {
      const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]));
      expect(keys).toContain(
        JSON.stringify({ queryKey: ["admin", "starter-decks"] }),
      );
      expect(keys).toContain(
        JSON.stringify({ queryKey: ["starter-decks", "status"] }),
      );
    });
  });

  it("désactive Enregistrer à 29 cartes", async () => {
    const user = userEvent.setup();
    const { section } = await setup();
    await user.click(remove(section, 15));
    expect(saveButton(section)).toBeDisabled();
  });

  it("désactive Enregistrer à 3 phares", async () => {
    const user = userEvent.setup();
    const { section } = await setup();
    await user.click(feature(section, 1));
    expect(saveButton(section)).toBeDisabled();
  });

  it("retirer une carte à 0 retire aussi son statut phare", async () => {
    const user = userEvent.setup();
    const { section } = await setup();
    await user.click(remove(section, 1));
    await user.click(remove(section, 1));
    // 28 cartes : on en ajoute 2 autres pour revenir à 30
    const add = (n: number) =>
      within(section).getByRole("button", {
        name: t("starter_admin.add", { name: `Carte ${n}` }),
      });
    await user.click(add(16));
    await user.click(add(16));
    expect(saveButton(section)).toBeDisabled(); // 3 phares
    await user.click(feature(section, 16));
    expect(saveButton(section)).toBeEnabled();
    await user.click(saveButton(section));
    await waitFor(() => expect(starterDeckService.saveDeck).toHaveBeenCalled());
    const body = vi.mocked(starterDeckService.saveDeck).mock.calls[0][1];
    expect(body.cards.find((c) => c.cardId === 1)).toBeUndefined();
    expect(body.cards.filter((c) => c.isFeatured)).toHaveLength(4);
  });
});
