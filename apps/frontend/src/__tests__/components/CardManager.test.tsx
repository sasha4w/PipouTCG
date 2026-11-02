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

/** Ouvre le formulaire de création, remplit l'étape 1 et passe à l'étape 2 en Support. */
async function toSupportStep(u: ReturnType<typeof user>) {
  await u.click(await screen.findByRole("button", { name: /nouvelle/i }));
  await u.type(screen.getByPlaceholderText("Nom de la carte"), "Ma carte");
  const setSelect = screen
    .getAllByRole("combobox")
    .find((s) => s.querySelector('option[value="1"]'))!;
  await waitFor(() =>
    expect(setSelect.querySelector('option[value="1"]')).not.toBeNull(),
  );
  await u.selectOptions(setSelect, "1");
  await u.click(screen.getByRole("button", { name: /suivant/i }));
  const typeSelect = screen
    .getAllByRole("combobox")
    .find((s) => s.querySelector('option[value="support"]'))!;
  await u.selectOptions(typeSelect, "support");
}

const supportSelect = () =>
  screen.getByLabelText("Type de Support") as HTMLSelectElement;

async function submit(u: ReturnType<typeof user>) {
  await u.click(screen.getByRole("button", { name: /suivant/i }));
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
    await toSupportStep(u);
    await u.selectOptions(supportSelect(), "EQUIPMENT");
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
    await toSupportStep(u);
    await u.selectOptions(supportSelect(), "EQUIPMENT");
    await u.click(screen.getByRole("button", { name: /suivant/i }));

    expect(screen.getByText("Choisis un emplacement")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /créer la carte/i }),
    ).toBeNull();
  });

  it("Persistant : case Terrain", async () => {
    const u = user();
    renderManager();
    await toSupportStep(u);
    await u.selectOptions(supportSelect(), "PERSISTENT");
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
    await toSupportStep(u);
    await u.selectOptions(supportSelect(), "CHARGE");

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
    await toSupportStep(u);
    await u.selectOptions(supportSelect(), "EQUIPMENT");
    await u.selectOptions(screen.getByLabelText("Emplacement"), "ACCESSORY");
    await u.selectOptions(supportSelect(), "EPHEMERAL");
    expect(screen.queryByLabelText("Emplacement")).toBeNull();
    await submit(u);

    await waitFor(() => expect(cardService.create).toHaveBeenCalled());
    const payload = vi.mocked(cardService.create).mock.calls[0][0];
    expect(payload.supportType).toBe("EPHEMERAL");
    expect(payload).not.toHaveProperty("equipmentSlot");
  });

  it("édition : recharge les champs support", async () => {
    vi.mocked(cardService.findAll).mockResolvedValue({
      data: [
        existing({ supportType: "EQUIPMENT", equipmentSlot: "DEFENSIVE" }),
      ],
      meta,
    } as never);
    const u = user();
    renderManager();
    await u.click(await screen.findByRole("button", { name: "Modifier" }));
    await u.click(screen.getByRole("button", { name: /suivant/i }));

    expect(screen.getByLabelText("Emplacement")).toHaveValue("DEFENSIVE");
  });
});
