import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DailyPuzzleInfo } from "@pipou/shared";
import i18n from "../../i18n";
import { puzzleService } from "../../services/puzzle.service";
import PuzzleCard from "./PuzzleCard";
import { puzzleInfo } from "./puzzleFixtures";

vi.mock("../../services/puzzle.service", () => ({
  puzzleService: { today: vi.fn() },
}));

function renderCard(info: DailyPuzzleInfo) {
  vi.mocked(puzzleService.today).mockResolvedValue(info);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/arena"]}>
        <Routes>
          <Route path="/arena" element={<PuzzleCard />} />
          <Route path="/puzzle" element={<p>fiche du défi</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PuzzleCard", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne montre aucun badge pendant le chargement", () => {
    vi.mocked(puzzleService.today).mockReturnValue(new Promise(() => {}));
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PuzzleCard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Défi du jour")).toBeInTheDocument();
    expect(screen.queryByText("À faire")).not.toBeInTheDocument();
    expect(screen.queryByText("Pas de défi aujourd'hui")).not.toBeInTheDocument();
  });

  it("défi à faire : badge « À faire », série, ouvre la fiche", async () => {
    renderCard(puzzleInfo());
    expect(await screen.findByText("À faire")).toBeInTheDocument();
    expect(screen.getByText(/Série : 4 jours/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("fiche du défi")).toBeInTheDocument();
  });

  it("défi résolu : badge « Résolu »", async () => {
    renderCard(puzzleInfo({ solved: true }));
    expect(await screen.findByText("Résolu")).toBeInTheDocument();
    expect(screen.queryByText("À faire")).not.toBeInTheDocument();
  });

  it("aucun défi : badge dédié et carte désactivée", async () => {
    renderCard(puzzleInfo({ puzzle: null }));
    expect(await screen.findByText("Pas de défi aujourd'hui")).toBeInTheDocument();
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByText("fiche du défi")).not.toBeInTheDocument();
  });
});
