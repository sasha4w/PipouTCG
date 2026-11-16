import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PuzzleObjectiveType, PuzzleScheduleOrigin, PuzzleStatus } from "@pipou/shared";
import type { AdminPuzzle, PuzzleScheduleEntry } from "@pipou/shared";
import i18n from "../../../i18n";
import { AppError } from "../../../utils/errors";
import { puzzleService } from "../../../services/puzzle.service";
import PuzzleManager from "./PuzzleManager";

vi.mock("../../../services/puzzle.service", () => ({
  puzzleService: {
    adminList: vi.fn(),
    schedule: vi.fn(),
    verify: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    setSchedule: vi.fn(),
    toScenario: vi.fn(),
  },
}));

function puzzle(over: Partial<AdminPuzzle> = {}): AdminPuzzle {
  return {
    id: 1,
    title: "Le coup du berger",
    description: null,
    objective: { type: PuzzleObjectiveType.WIN_GAME },
    rewardGold: 100,
    rewardXp: 50,
    status: PuzzleStatus.DRAFT,
    seed: 1,
    verifiedAt: null,
    createdBy: "admin",
    updatedAt: "2026-11-10T10:00:00.000Z",
    lastPlayed: null,
    enemyMonsters: [],
    ...over,
  };
}

function days(): PuzzleScheduleEntry[] {
  return Array.from({ length: 14 }, (_, i) => ({
    date: `2026-11-${String(13 + i).padStart(2, "0")}`,
    puzzleId: i === 0 ? 2 : null,
    title: i === 0 ? "Publié" : null,
    origin: i === 0 ? PuzzleScheduleOrigin.MANUAL : null,
  }));
}

function renderManager(list: AdminPuzzle[]) {
  vi.mocked(puzzleService.adminList).mockResolvedValue(list);
  vi.mocked(puzzleService.schedule).mockResolvedValue(days());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PuzzleManager />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const PUBLISHED = puzzle({
  id: 2,
  title: "Publié",
  status: PuzzleStatus.PUBLISHED,
  verifiedAt: "2026-11-11T10:00:00.000Z",
});

describe("PuzzleManager", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("liste les défis avec statut et vérification", async () => {
    renderManager([puzzle(), PUBLISHED]);
    expect(await screen.findByText("Le coup du berger")).toBeInTheDocument();
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    expect(screen.getByText(/Non vérifié/)).toBeInTheDocument();
    expect(screen.getByText(/Vérifié le/)).toBeInTheDocument();
  });

  it("affiche la solution trouvée et ses coups", async () => {
    vi.mocked(puzzleService.verify).mockResolvedValue({
      status: "solved",
      solution: ["Invoque A", "Attaque B"],
      nodes: 42,
      ms: 120,
    });
    renderManager([puzzle()]);
    await userEvent.click(await screen.findByRole("button", { name: "Vérifier" }));
    expect(
      await screen.findByText("Solution trouvée en 120 ms (42 positions)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Invoque A")).toBeInTheDocument();
    // la liste est rechargée après la vérification
    await waitFor(() => expect(puzzleService.adminList).toHaveBeenCalledTimes(2));
  });

  it("affiche l'avertissement quand aucune solution n'est trouvée", async () => {
    vi.mocked(puzzleService.verify).mockResolvedValue({
      status: "not_found",
      solution: [],
      nodes: 10,
      ms: 5,
    });
    renderManager([puzzle()]);
    await userEvent.click(await screen.findByRole("button", { name: "Vérifier" }));
    expect(await screen.findByText(/ce n'est pas une preuve/)).toBeInTheDocument();
  });

  it("explique un conflit quand une vérification est déjà en cours", async () => {
    vi.mocked(puzzleService.verify).mockRejectedValue(
      new AppError("busy", { statusCode: 409 }),
    );
    renderManager([puzzle()]);
    await userEvent.click(await screen.findByRole("button", { name: "Vérifier" }));
    expect(
      await screen.findByText(/vérification est déjà en cours/),
    ).toBeInTheDocument();
  });

  it("publie un défi vérifié sans dérogation", async () => {
    vi.mocked(puzzleService.publish).mockResolvedValue();
    renderManager([puzzle({ verifiedAt: "2026-11-11T10:00:00.000Z" })]);
    await userEvent.click(await screen.findByRole("button", { name: "Publier" }));
    await waitFor(() => expect(puzzleService.publish).toHaveBeenCalledWith(1, {}));
  });

  it("exige la case « résolu moi-même » pour publier un défi non vérifié", async () => {
    vi.mocked(puzzleService.publish).mockResolvedValue();
    renderManager([puzzle()]);
    const publish = await screen.findByRole("button", { name: "Publier" });
    expect(publish).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Je l'ai résolu moi-même"));
    await userEvent.click(publish);
    await waitFor(() =>
      expect(puzzleService.publish).toHaveBeenCalledWith(1, { manualOverride: true }),
    );
  });

  it("programme un défi publié sur une date du calendrier", async () => {
    vi.mocked(puzzleService.setSchedule).mockResolvedValue();
    renderManager([PUBLISHED]);
    const select = await screen.findByLabelText("Défi du 2026-11-14");
    await userEvent.selectOptions(select, "2");
    await waitFor(() =>
      expect(puzzleService.setSchedule).toHaveBeenCalledWith({
        date: "2026-11-14",
        puzzleId: 2,
      }),
    );
    expect(screen.getByText("1 défi publié")).toBeInTheDocument();
    expect(screen.getByText(/Moins de 7 défis publiés/)).toBeInTheDocument();
  });

  it("modifie un défi via le formulaire en ligne", async () => {
    vi.mocked(puzzleService.update).mockResolvedValue();
    renderManager([puzzle()]);
    await userEvent.click(await screen.findByRole("button", { name: "Modifier" }));
    expect(screen.getByText(/efface sa vérification/)).toBeInTheDocument();
    const title = screen.getByLabelText("Titre");
    await userEvent.clear(title);
    await userEvent.type(title, "Nouveau titre");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(puzzleService.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: "Nouveau titre" }),
      ),
    );
  });

  it("supprime après confirmation", async () => {
    vi.mocked(puzzleService.remove).mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderManager([puzzle()]);
    const row = (await screen.findByText("Le coup du berger")).closest("li") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(puzzleService.remove).toHaveBeenCalledWith(1));
  });
});
