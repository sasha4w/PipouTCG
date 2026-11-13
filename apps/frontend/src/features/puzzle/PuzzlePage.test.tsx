import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DailyPuzzleInfo } from "@pipou/shared";
import i18n from "../../i18n";
import { puzzleService } from "../../services/puzzle.service";
import PuzzlePage from "./PuzzlePage";
import { puzzleInfo } from "./puzzleFixtures";

vi.mock("../../services/puzzle.service", () => ({
  puzzleService: { today: vi.fn() },
}));

function renderPage(info: DailyPuzzleInfo | Error) {
  if (info instanceof Error) vi.mocked(puzzleService.today).mockRejectedValue(info);
  else vi.mocked(puzzleService.today).mockResolvedValue(info);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/puzzle"]}>
        <Routes>
          <Route path="/puzzle" element={<PuzzlePage />} />
          <Route path="/puzzle/play" element={<p>écran de jeu</p>} />
          <Route path="/arena" element={<p>arène</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PuzzlePage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche objectif, récompense, série et compte à rebours", async () => {
    renderPage(puzzleInfo());
    expect(await screen.findByText("Le coup du berger")).toBeInTheDocument();
    expect(screen.getByText("Détruis Général Pipoulax ce tour")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("Série : 4 jours, booster dans 3 j")).toBeInTheDocument();
    expect(screen.getByText(/Essais illimités\. Prochain défi dans 0[67]:\d\d:\d\d/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jouer" })).toBeInTheDocument();
    expect(screen.queryByText(/rejouer ne rapporte rien/)).not.toBeInTheDocument();
  });

  it("« Jouer » ouvre l'écran de jeu", async () => {
    renderPage(puzzleInfo());
    fireEvent.click(await screen.findByRole("button", { name: "Jouer" }));
    expect(await screen.findByText("écran de jeu")).toBeInTheDocument();
  });

  it("défi résolu : « Rejouer » et mention sans récompense", async () => {
    renderPage(puzzleInfo({ solved: true }));
    expect(await screen.findByRole("button", { name: "Rejouer" })).toBeInTheDocument();
    expect(screen.getByText("Déjà résolu : rejouer ne rapporte rien")).toBeInTheDocument();
  });

  it("aucun défi : message dédié, pas de bouton Jouer", async () => {
    renderPage(puzzleInfo({ puzzle: null }));
    expect(await screen.findByText(/Pas de défi aujourd'hui/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jouer" })).not.toBeInTheDocument();
  });

  it("erreur de chargement : message de repli", async () => {
    renderPage(new Error("boom"));
    expect(await screen.findByText("Impossible de charger le défi du jour")).toBeInTheDocument();
  });

  it("retour vers l'arène", async () => {
    renderPage(puzzleInfo());
    fireEvent.click(await screen.findByRole("button", { name: "Retour à l'arène" }));
    expect(await screen.findByText("arène")).toBeInTheDocument();
  });
});
