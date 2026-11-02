import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import CardManager from "../../features/cards/CardManager";
import { cardService, type Card } from "../../services/card.service";
import { cardSetService } from "../../services/card-set.service";
import { imageService } from "../../services/image.service";

vi.mock("../../services/card.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../services/card.service")>()),
  cardService: {
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../../services/card-set.service", () => ({
  cardSetService: { findAll: vi.fn() },
}));
vi.mock("../../services/image.service", () => ({
  imageService: { findAll: vi.fn(), upload: vi.fn() },
}));

const set = { id: 1, name: "PipouSquad" };
const meta = { totalPages: 1 };

function existing(patch: Partial<Card>): Card {
  return {
    id: 7,
    name: "Epee",
    rarity: "common",
    type: "support",
    atk: 0,
    hp: 0,
    cost: 0,
    image: null,
    cardSet: set,
    ...patch,
  };
}

function renderManager() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CardManager />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const user = () => userEvent.setup();

const next = (u: ReturnType<typeof user>) =>
  u.click(screen.getByRole("button", { name: /suivant/i }));

/** Crée un Support du sous-type voulu et laisse l'utilisateur sur l'étape suivante (identité). */
async function startSupport(u: ReturnType<typeof user>, subtype: string) {
  await u.click(await screen.findByRole("button", { name: /nouvelle/i }));
  await u.selectOptions(screen.getByLabelText("Type de carte"), "support");
  await u.selectOptions(screen.getByLabelText("Type de support"), subtype);
  await next(u);
}

/** Remplit l'identité (nom + set) puis passe à l'étape suivante. */
async function fillBase(u: ReturnType<typeof user>) {
  await u.type(screen.getByLabelText("Nom *"), "Ma carte");
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "PipouSquad" })).toBeInTheDocument(),
  );
  await u.selectOptions(screen.getByLabelText("Card Set *"), "1");
  await next(u);
}

/** Depuis les réglages : effets, image, puis création. */
async function submit(u: ReturnType<typeof user>) {
  await next(u);
  await next(u);
  await u.click(screen.getByRole("button", { name: /créer la carte/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cardService.findAll).mockResolvedValue({ data: [], meta } as never);
  vi.mocked(cardService.create).mockResolvedValue({} as never);
  vi.mocked(cardSetService.findAll).mockResolvedValue({
    data: [set],
    meta,
  } as never);
  vi.mocked(imageService.findAll).mockResolvedValue([]);
});

describe("CardManager — champs selon le type de support", () => {
  it("Équipement : le choix de l'emplacement apparaît et est envoyé", async () => {
    const u = user();
    renderManager();
    await startSupport(u, "EQUIPMENT");
    await fillBase(u);
    await u.selectOptions(screen.getByLabelText("Emplacement"), "ACCESSORY");
    await submit(u);

    await waitFor(() =>
      expect(cardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supportType: "EQUIPMENT",
          equipmentSlot: "ACCESSORY",
        }),
      ),
    );
  });

  it("Équipement sans emplacement : bloque l'étape", async () => {
    const u = user();
    renderManager();
    await startSupport(u, "EQUIPMENT");
    await fillBase(u);
    await next(u);

    expect(screen.getByText("Choisis un emplacement.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /créer la carte/i })).toBeNull();
  });

  it("Persistant : case Terrain", async () => {
    const u = user();
    renderManager();
    await startSupport(u, "PERSISTENT");
    await fillBase(u);
    await u.click(screen.getByRole("checkbox", { name: /terrain/i }));
    await submit(u);

    await waitFor(() =>
      expect(cardService.create).toHaveBeenCalledWith(
        expect.objectContaining({ supportType: "PERSISTENT", isTerrain: true }),
      ),
    );
  });

  it("Charge : charge max, cyclique désactivé", async () => {
    const u = user();
    renderManager();
    await startSupport(u, "CHARGE");
    await fillBase(u);

    expect(screen.getByRole("option", { name: /cyclique/i })).toBeDisabled();
    expect(screen.getByLabelText("Charge max")).toHaveValue(3);
    await submit(u);

    await waitFor(() =>
      expect(cardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supportType: "CHARGE",
          chargeMax: 3,
          chargeMode: "ONE_SHOT",
        }),
      ),
    );
  });

  it("changer de sous-type retire les champs de l'ancien", async () => {
    const u = user();
    renderManager();
    await startSupport(u, "EQUIPMENT");
    await fillBase(u);
    await u.selectOptions(screen.getByLabelText("Emplacement"), "ACCESSORY");
    await u.click(screen.getByRole("button", { name: /précédent/i }));
    await u.click(screen.getByRole("button", { name: /précédent/i }));
    await u.selectOptions(screen.getByLabelText("Type de support"), "EPHEMERAL");
    await next(u); // identité, déjà remplie
    await next(u); // éphémère : pas d'étape de réglages, on arrive aux effets
    await next(u); // image
    await u.click(screen.getByRole("button", { name: /créer la carte/i }));

    await waitFor(() => expect(cardService.create).toHaveBeenCalled());
    const payload = vi.mocked(cardService.create).mock.calls[0][0];
    expect(payload.supportType).toBe("EPHEMERAL");
    expect(payload).not.toHaveProperty("equipmentSlot");
  });

  it("édition : recharge les champs support", async () => {
    vi.mocked(cardService.findAll).mockResolvedValue({
      data: [existing({ supportType: "EQUIPMENT", equipmentSlot: "DEFENSIVE" })],
      meta,
    } as never);
    const u = user();
    renderManager();
    await u.click(await screen.findByRole("button", { name: "Modifier" }));
    await next(u);
    await next(u);

    expect(screen.getByLabelText("Emplacement")).toHaveValue("DEFENSIVE");
  });
});
