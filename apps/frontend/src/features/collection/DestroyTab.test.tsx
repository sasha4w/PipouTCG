import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CardType, Rarity } from "@pipou/shared";
import i18n from "../../i18n";
import type { Card } from "../../services/card.service";
import type { UserCollection } from "../../services/user.service";
import { cardService } from "../../services/card.service";
import { userService } from "../../services/user.service";
import { forgeService } from "../../services/forge.service";
import { AppError } from "../../utils/errors";
import DestroyTab from "./DestroyTab";

vi.mock("../../services/card.service", async (orig) => ({
  ...(await orig<typeof import("../../services/card.service")>()),
  cardService: { findAll: vi.fn() },
}));
vi.mock("../../services/user.service", () => ({
  userService: { getMyCollection: vi.fn(), getMe: vi.fn() },
}));
vi.mock("../../services/forge.service", () => ({
  forgeService: { usable: vi.fn(), destroy: vi.fn(), destroyBatch: vi.fn() },
}));

function card(id: number, name: string, rarity: Rarity, setId = 1): Card {
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
    cardSet: { id: setId, name: `Set ${setId}` },
  } as Card;
}

const gelee = card(1, "Gelée", Rarity.COMMON);
const lame = card(10, "Lame", Rarity.UNCOMMON);
const rare = card(6, "Rarissime", Rarity.RARE);
const titan = card(20, "Titan", Rarity.EPIC);
const autreSet = card(5, "Autreset", Rarity.COMMON, 2);
const verrou = card(7, "Verrou", Rarity.COMMON); // entièrement verrouillée
const all = [gelee, lame, rare, titan, autreSet, verrou];

const stock: Record<number, number> = {
  1: 5,
  10: 4,
  6: 3,
  20: 4,
  5: 4,
  7: 3,
};
const lockedOf: Record<number, number> = { 7: 3 };

function collection(): UserCollection {
  const sets = new Map<number, Card[]>();
  for (const c of all)
    sets.set(c.cardSet.id, [...(sets.get(c.cardSet.id) ?? []), c]);
  return {
    sets: [...sets.entries()].map(([id, cs]) => ({
      id,
      name: `Set ${id}`,
      owned: 1,
      total: cs.length,
      cards: cs.map((c) => ({
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
        owned: true,
        quantity: stock[c.id],
        lockedQuantity: lockedOf[c.id] ?? 0,
      })),
    })),
  } as UserCollection;
}

const usable = () =>
  all.map((c) => ({
    cardId: c.id,
    owned: stock[c.id],
    usable: Math.max(0, stock[c.id] - (lockedOf[c.id] ?? 0)),
    lockedQuantity: lockedOf[c.id] ?? 0,
  }));

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DestroyTab onInspect={() => {}} />
    </QueryClientProvider>,
  );
}

const review = () => screen.findByRole("button", { name: "Voir et confirmer" });

describe("DestroyTab", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.mocked(cardService.findAll).mockResolvedValue({
      data: all,
      total: all.length,
    } as never);
    vi.mocked(userService.getMyCollection).mockImplementation(async () =>
      collection(),
    );
    vi.mocked(forgeService.usable).mockReset();
    vi.mocked(forgeService.usable).mockImplementation(
      async () => usable() as never,
    );
    vi.mocked(forgeService.destroyBatch).mockReset();
    vi.mocked(forgeService.destroyBatch).mockResolvedValue({
      dustGained: 6,
      dust: 6,
      destroyed: 4,
    });
    vi.mocked(forgeService.destroy).mockReset();
    vi.mocked(forgeService.destroy).mockResolvedValue({
      dustGained: 20,
      dust: 20,
    });
  });

  it("valeurs par défaut : garder 3, commune à rare cochées, set Tous, résumé juste", async () => {
    renderTab();
    await review();
    expect(screen.getByRole("radio", { name: "Garder 3" })).toBeChecked();
    for (const name of ["Commune", "Peu commune", "Rare"])
      expect(screen.getByRole("checkbox", { name })).toBeChecked();
    for (const name of ["Épique", "Légendaire", "Secrète"])
      expect(screen.getByRole("checkbox", { name })).not.toBeChecked();
    expect(screen.getByLabelText("Tous les sets")).toHaveValue("all");
    expect(
      screen.getByText("4 copies à détruire pour 6 de poussière"),
    ).toBeInTheDocument();
  });

  it("passer à garder 1 met à jour le résumé", async () => {
    renderTab();
    await review();
    fireEvent.click(screen.getByRole("radio", { name: "Garder 1" }));
    expect(
      screen.getByText("12 copies à détruire pour 36 de poussière"),
    ).toBeInTheDocument();
  });

  it("Voir et confirmer n'appelle rien ; Détruire envoie les lignes du plan", async () => {
    renderTab();
    fireEvent.click(await review());
    const dialog = await screen.findByRole("dialog");
    expect(forgeService.destroyBatch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Détruire" }));
    await waitFor(() =>
      expect(forgeService.destroyBatch).toHaveBeenCalledWith({
        items: [
          { cardId: 1, quantity: 2 },
          { cardId: 10, quantity: 1 },
          { cardId: 5, quantity: 1 },
        ],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(forgeService.destroy).not.toHaveBeenCalled();
  });

  it("épique en trop : avertissement, Détruire grisé jusqu'à Je comprends", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Épique" }));
    fireEvent.click(screen.getByRole("button", { name: "Voir et confirmer" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/haute rareté : Titan/)).toBeVisible();
    const destroy = within(dialog).getByRole("button", { name: "Détruire" });
    expect(destroy).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole("checkbox", { name: "Je comprends" }),
    );
    expect(destroy).toBeEnabled();
  });

  it("sans haute rareté : pas d'avertissement ni de case", async () => {
    renderTab();
    fireEvent.click(await review());
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("checkbox", { name: "Je comprends" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Détruire" }),
    ).toBeEnabled();
  });

  it("400 : message affiché, confirmation ouverte, usable rafraîchi", async () => {
    vi.mocked(forgeService.destroyBatch).mockRejectedValue(
      new AppError("Copies insuffisantes", {
        category: "API",
        statusCode: 400,
      }),
    );
    renderTab();
    fireEvent.click(await review());
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(forgeService.usable).toHaveBeenCalled());
    const before = vi.mocked(forgeService.usable).mock.calls.length;
    fireEvent.click(within(dialog).getByRole("button", { name: "Détruire" }));
    expect(await screen.findByText("Copies insuffisantes")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(forgeService.usable).mock.calls.length).toBeGreaterThan(
        before,
      ),
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Détruire",
      }),
    ).toBeEnabled();
  });

  it("annuler ferme la confirmation sans rien détruire", async () => {
    renderTab();
    fireEvent.click(await review());
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Annuler",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(forgeService.destroyBatch).not.toHaveBeenCalled();
  });

  it("liste : détruire 2 copies d'une rare appelle destroy après confirmation", async () => {
    renderTab();
    const add = await screen.findByRole("button", {
      name: "Ajouter une copie à détruire de Rarissime",
    });
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(screen.getByRole("button", { name: "Détruire Rarissime" }));
    expect(forgeService.destroy).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Détruire" }));
    await waitFor(() =>
      expect(forgeService.destroy).toHaveBeenCalledWith({
        cardId: 6,
        quantity: 2,
      }),
    );
  });

  it("liste : le sélecteur est borné par usable, carte verrouillée grisée", async () => {
    renderTab();
    const add = await screen.findByRole("button", {
      name: "Ajouter une copie à détruire de Rarissime",
    });
    for (let i = 0; i < 5; i++) fireEvent.click(add);
    expect(add).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Ajouter une copie à détruire de Verrou",
      }),
    ).toBeDisabled();
    expect(screen.getByText(/Commune · verrouillée$/)).toBeInTheDocument();
  });

  it("liste : une épique déclenche l'avertissement", async () => {
    renderTab();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Ajouter une copie à détruire de Titan",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Détruire Titan" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/haute rareté : Titan/)).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Détruire" }),
    ).toBeDisabled();
  });
});
