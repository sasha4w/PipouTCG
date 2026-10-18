import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdventureOpponentView } from "@pipou/shared";
import i18n from "../../i18n";
import { QUERY_KEYS } from "../../utils/querykeys";
import OpponentSheet from "./OpponentSheet";

const opponent = (over: Partial<AdventureOpponentView> = {}): AdventureOpponentView => ({
  id: 5,
  position: 5,
  level: 5,
  name: "Général Pipoulax",
  quote: "Mes soldats ne reculent jamais.",
  portrait: { cardId: 1, imageUrl: null },
  state: "available",
  wins: 0,
  isBoss: true,
  firstWin: { gold: 500, xp: 300, boosterName: "Booster Brigade", legendary: true },
  farm: { gold: 60, xp: 40, boosterPct: 10, legendaryPct: 2 },
  ...over,
});

interface RenderOptions {
  wins?: number;
  today?: number;
  cap?: number;
  deckId?: number | null;
  onFight?: (deckId: number) => void;
}

function renderSheet({
  wins = 0,
  today = 3,
  cap = 20,
  deckId = null,
  onFight = () => {},
}: RenderOptions = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(QUERY_KEYS.decks, [
    { id: 8, name: "Rush Pipou", userId: 1, deckCards: [] },
  ]);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OpponentSheet
          opponent={opponent({ wins, state: wins > 0 ? "beaten" : "available" })}
          farmRewardsToday={today}
          dailyCap={cap}
          deckId={deckId}
          onSelectDeck={() => {}}
          onFight={onFight}
          onClose={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OpponentSheet", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("liste la première victoire quand l'IA n'a jamais été battue", () => {
    renderSheet({ wins: 0 });
    expect(screen.getByText("Première victoire")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("Booster Brigade")).toBeInTheDocument();
    expect(screen.queryByText("Chances de drop")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Combattre" })).toBeInTheDocument();
  });

  it("montre les gains de farm et les chances de drop une fois battue", () => {
    renderSheet({ wins: 4 });
    expect(screen.queryByText("Première victoire")).not.toBeInTheDocument();
    expect(screen.getByText("Gains à chaque victoire")).toBeInTheDocument();
    expect(screen.getByText("Chances de drop")).toBeInTheDocument();
    expect(screen.getByText("10 %")).toBeInTheDocument();
    expect(screen.getByText("2 %")).toBeInTheDocument();
    expect(screen.getByText("Récompenses du jour : 3 / 20")).toBeInTheDocument();
    expect(screen.getByText("Battue 4 fois")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejouer" })).toBeInTheDocument();
    expect(
      screen.queryByText("Plus de récompenses aujourd'hui"),
    ).not.toBeInTheDocument();
  });

  it("signale le plafond du jour atteint", () => {
    renderSheet({ wins: 2, today: 20, cap: 20 });
    expect(screen.getByText("Plus de récompenses aujourd'hui")).toBeInTheDocument();
  });

  it("désactive le combat sans deck", () => {
    renderSheet({ deckId: null });
    expect(screen.getByRole("button", { name: "Combattre" })).toBeDisabled();
  });

  it("lance le combat avec le deck choisi", () => {
    const onFight = vi.fn();
    renderSheet({ deckId: 8, onFight });
    expect(screen.getByText("Rush Pipou")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Combattre" }));
    expect(onFight).toHaveBeenCalledWith(8);
  });

  it("n'affiche aucun emoji", () => {
    for (const wins of [0, 3]) {
      const { unmount } = renderSheet({ wins, today: 20, cap: 20, deckId: 8 });
      expect(document.body.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
      unmount();
    }
  });
});
