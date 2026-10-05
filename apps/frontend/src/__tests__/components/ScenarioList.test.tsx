import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ScenarioList from "../../features/sandbox/ScenarioList";
import {
  sandboxService,
  type SandboxScenarioSummary,
} from "../../services/sandbox.service";
import { QUERY_KEYS } from "../../utils/querykeys";

const SCENARIOS: SandboxScenarioSummary[] = [
  {
    id: 3,
    name: "Combo Noyaux",
    description: "Alpha + Module .v2",
    createdBy: "Admin",
    updatedAt: "2026-10-03T10:00:00.000Z",
  },
];

vi.mock("../../services/sandbox.service", () => ({
  sandboxService: {
    listScenarios: vi.fn(),
    deleteScenario: vi.fn(),
  },
}));

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Liste déjà en cache : le rendu ne dépend pas du délai du premier fetch
  client.setQueryData(QUERY_KEYS.sandbox.scenarios, SCENARIOS);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<ScenarioList />} />
          <Route path="/admin/sandbox" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ScenarioList", () => {
  beforeEach(() => {
    vi.mocked(sandboxService.listScenarios).mockResolvedValue(SCENARIOS);
    vi.mocked(sandboxService.deleteScenario).mockResolvedValue();
  });

  it("ouvre un scénario dans le sandbox", async () => {
    renderList();

    await userEvent.click(
      await screen.findByRole("button", { name: "Charger" }),
    );

    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/admin/sandbox?scenario=3",
    );
  });

  it("supprime un scénario après confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderList();

    await userEvent.click(
      await screen.findByRole("button", { name: "Supprimer" }),
    );

    expect(sandboxService.deleteScenario).toHaveBeenCalledWith(3);
  });

  it("lance un sandbox vierge", async () => {
    renderList();

    await userEvent.click(
      screen.getByRole("button", { name: /Nouveau sandbox/ }),
    );

    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/admin/sandbox",
    );
  });
});
