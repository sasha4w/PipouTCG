import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActionType, CardType, EffectTrigger, Rarity } from "@pipou/shared";
import i18n from "../../i18n";
import type { Card } from "../../services/card.service";
import type { UserCollection } from "../../services/user.service";
import { cardService } from "../../services/card.service";
import { userService } from "../../services/user.service";
import { forgeService } from "../../services/forge.service";
import { AppError } from "../../utils/errors";
import ForgeTab from "./ForgeTab";

vi.mock("../../services/card.service", async (orig) => ({
  ...(await orig<typeof import("../../services/card.service")>()),
  cardService: { findAll: vi.fn() },
}));
vi.mock("../../services/user.service", () => ({
  userService: { getMyCollection: vi.fn(), getMe: vi.fn() },
}));
vi.mock("../../services/forge.service", () => ({
  forgeService: { usable: vi.fn(), forge: vi.fn() },
}));

function card(
  id: number,
  name: string,
  rarity: Rarity,
  setId = 1,
  extra: Partial<Card> = {},
): Card {
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
    ...extra,
  } as Card;
}

const gelee = card(1, "Gelée", Rarity.COMMON);
const pipou = card(2, "Pipou", Rarity.COMMON);
const bouclier = card(3, "Bouclier", Rarity.COMMON); // en deck
const ombre = card(4, "Ombre", Rarity.COMMON); // verrouillée
const autreSet = card(5, "Autreset", Rarity.COMMON, 2);
const rare = card(6, "Rarissime", Rarity.RARE);
const lame = card(10, "Lame", Rarity.UNCOMMON);
const griffe = card(11, "Griffe", Rarity.UNCOMMON);
const drakon = card(12, "Drakon", Rarity.UNCOMMON, 1, {
  effects: [
    {
      trigger: EffectTrigger.PASSIVE,
      actions: [{ type: ActionType.SUMMON_IF_ALL_ELEMENTS }],
    },
  ],
} as Partial<Card>);
const all = [
  gelee,
  pipou,
  bouclier,
  ombre,
  autreSet,
  rare,
  lame,
  griffe,
  drakon,
];

let stock: Record<number, number>;
const lockedOf: Record<number, number> = { 4: 3 };
const inDeck = new Set([3]);

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
        owned: (stock[c.id] ?? 0) > 0,
        quantity: stock[c.id] ?? 0,
        lockedQuantity: lockedOf[c.id] ?? 0,
      })),
    })),
  } as UserCollection;
}

function usable() {
  return all
    .filter((c) => (stock[c.id] ?? 0) > 0)
    .map((c) => ({
      cardId: c.id,
      usable: inDeck.has(c.id)
        ? 0
        : Math.max(0, stock[c.id] - (lockedOf[c.id] ?? 0)),
      lockedQuantity: lockedOf[c.id] ?? 0,
    }));
}

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ForgeTab onInspect={() => {}} />
    </QueryClientProvider>,
  );
}

const addBtn = (name: string) =>
  screen.queryByRole("button", { name: `Ajouter une copie de ${name}` });

async function add(name: string, times: number) {
  const btn = await screen.findByRole("button", {
    name: `Ajouter une copie de ${name}`,
  });
  for (let i = 0; i < times; i++) fireEvent.click(btn);
}

describe("ForgeTab", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    stock = { 1: 6, 2: 6, 3: 3, 4: 3, 5: 3, 6: 2, 10: 1 };
    vi.mocked(cardService.findAll).mockResolvedValue({
      data: all,
      total: all.length,
    } as never);
    vi.mocked(userService.getMyCollection).mockImplementation(async () =>
      collection(),
    );
    vi.mocked(forgeService.usable).mockImplementation(
      async () => usable() as never,
    );
    vi.mocked(forgeService.forge).mockReset();
    vi.mocked(forgeService.forge).mockImplementation(async (req) => {
      for (const i of req.inputs) stock[i.cardId] -= i.quantity;
      stock[req.targetCardId] = (stock[req.targetCardId] ?? 0) + 1;
      return { targetCardId: req.targetCardId, dust: 0 };
    });
  });

  it("affiche 0 / 10, restreint au set et à la rareté, Réinitialiser restaure", async () => {
    renderTab();
    expect(await screen.findByText("0 / 10")).toBeInTheDocument();
    expect(addBtn("Autreset")).toBeInTheDocument();
    expect(addBtn("Rarissime")).toBeInTheDocument();
    await add("Gelée", 1);
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(addBtn("Autreset")).not.toBeInTheDocument();
    expect(addBtn("Rarissime")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect(addBtn("Autreset")).toBeInTheDocument();
    expect(addBtn("Rarissime")).toBeInTheDocument();
  });

  it("grise une carte à usable 0 : « dans un deck », + désactivé", async () => {
    renderTab();
    expect(await screen.findByText(/dans un deck/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ajouter une copie de Bouclier" }),
    ).toBeDisabled();
  });

  it("grise une carte entièrement verrouillée : « verrouillée »", async () => {
    renderTab();
    expect(
      await screen.findByText(/Commune · verrouillée$/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ajouter une copie de Ombre" }),
    ).toBeDisabled();
  });

  it("Suivant n'est actif qu'à 10 / 10", async () => {
    renderTab();
    await add("Gelée", 6);
    expect(screen.getByRole("button", { name: "Suivant" })).toBeDisabled();
    await add("Pipou", 4);
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suivant" })).toBeEnabled();
  });

  async function toStep2() {
    renderTab();
    await add("Gelée", 6);
    await add("Pipou", 4);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
  }

  it("étape 2 : cible non possédée, pas de carte d'aventure ; Forger appelle le service ; retour garde 10 / 10", async () => {
    await toStep2();
    expect(await screen.findByText(/non possédée/)).toBeInTheDocument();
    expect(screen.queryByText("Drakon")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forger" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(screen.getByRole("radio", { name: "Choisir Griffe" }));
    fireEvent.click(screen.getByRole("button", { name: "Forger" }));
    await waitFor(() =>
      expect(forgeService.forge).toHaveBeenCalledWith({
        inputs: [
          { cardId: 1, quantity: 6 },
          { cardId: 2, quantity: 4 },
        ],
        targetCardId: 11,
      }),
    );
  });

  it("affiche l'erreur de l'API", async () => {
    vi.mocked(forgeService.forge).mockRejectedValue(
      new AppError("Copies insuffisantes", {
        category: "API",
        statusCode: 400,
      }),
    );
    await toStep2();
    fireEvent.click(
      await screen.findByRole("radio", { name: "Choisir Griffe" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Forger" }));
    expect(await screen.findByText("Copies insuffisantes")).toBeInTheDocument();
  });

  it("après succès : reste à l'étape 2, cible cochée, message ; Reforger complet active Forger", async () => {
    stock[1] = 12;
    stock[2] = 12;
    renderTab();
    await add("Gelée", 10);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(
      await screen.findByRole("radio", { name: "Choisir Griffe" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Forger" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Griffe");
    expect(screen.getByRole("radio", { name: "Choisir Griffe" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Reforger" }));
    const forger = await screen.findByRole("button", { name: "Forger" });
    expect(forger).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Choisir Griffe" })).toBeChecked();
  });

  it("Reforger incomplet : retour à l'étape 1 avec la sélection partielle, même set et rareté", async () => {
    renderTab();
    await add("Gelée", 6);
    await add("Pipou", 4);
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    fireEvent.click(
      await screen.findByRole("radio", { name: "Choisir Griffe" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Forger" }));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Reforger" }));
    expect(await screen.findByText("2 / 10")).toBeInTheDocument();
    expect(addBtn("Autreset")).not.toBeInTheDocument();
    expect(addBtn("Rarissime")).not.toBeInTheDocument();
  });
});
