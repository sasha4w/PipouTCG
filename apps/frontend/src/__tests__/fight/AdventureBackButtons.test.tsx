import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdventureOverview } from "@pipou/shared";
import AdventureWorlds from "../../features/adventure/AdventureWorlds";
import AdventurePath from "../../features/adventure/AdventurePath";
import { QUERY_KEYS } from "../../utils/querykeys";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const overview: AdventureOverview = {
  worlds: [
    {
      id: 1,
      name: "PipouSquad",
      cardSetId: 1,
      cardSetName: "Set",
      order: 1,
      unlocked: true,
      requires: [],
      beaten: 1,
      completed: false,
      opponents: [],
    },
  ],
  farmRewardsToday: 0,
  dailyCap: 10,
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path: string) {
  const qc = new QueryClient();
  qc.setQueryData(QUERY_KEYS.adventure, overview);
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/adventure" element={<AdventureWorlds />} />
          <Route path="/adventure/:worldId" element={<AdventurePath />} />
          <Route path="/arena" element={<Where />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("boutons de retour de l'aventure", () => {
  it("le choix des mondes permet de changer de mode (retour à l'arène)", () => {
    renderAt("/adventure");
    fireEvent.click(screen.getByRole("button", { name: "Changer de mode" }));
    expect(screen.getAllByTestId("where").at(-1)).toHaveTextContent("/arena");
  });

  it("le chemin d'un monde permet de changer de monde", () => {
    renderAt("/adventure/1");
    fireEvent.click(screen.getByRole("button", { name: "Changer de monde" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/adventure");
  });
});
