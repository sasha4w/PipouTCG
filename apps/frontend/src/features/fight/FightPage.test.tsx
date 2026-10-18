import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Handler = (payload?: unknown) => void;
const fake = vi.hoisted(() => ({
  handlers: new Map<string, (payload?: unknown) => void>(),
  emit: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: (event: string, h: Handler) => fake.handlers.set(event, h),
    emit: fake.emit,
    disconnect: vi.fn(),
  }),
}));

vi.mock("../../services/fight.service", () => ({
  fightService: {
    getMyHistory: vi.fn(() => new Promise(() => {})),
    getMyStats: vi.fn(() => new Promise(() => {})),
    getLeaderboard: vi.fn(() => new Promise(() => {})),
  },
}));

vi.mock("../deck/DeckWidget", () => ({ default: () => null }));

import FightPage from "./FightPage";

const serverSends = (event: string, payload?: unknown) =>
  act(() => fake.handlers.get(event)?.(payload));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/fight"]}>
        <Routes>
          <Route path="/fight" element={<FightPage userId={1} username="Moi" />} />
          <Route
            path="/adventure/fight/:opponentId"
            element={<p>écran aventure</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FightPage — reprise", () => {
  beforeEach(() => {
    fake.handlers.clear();
    fake.emit.mockClear();
  });

  it("renvoie vers l'écran d'aventure si la partie reprise est contre une IA", () => {
    renderPage();
    serverSends("fight:resumed", { matchId: -3, opponentName: "Gobelin", adventureOpponentId: 9 });
    expect(screen.getByText("écran aventure")).toBeInTheDocument();
  });

  it("reste sur le duel pour une partie JcJ reprise", () => {
    renderPage();
    serverSends("fight:resumed", { matchId: 3, opponentName: "Bob" });
    expect(screen.queryByText("écran aventure")).not.toBeInTheDocument();
  });
});
