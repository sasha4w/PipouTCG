import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import AchievementsTab from "../../features/achievements/AchievementsTab";

vi.mock("../../hooks/useGameData", () => ({
  useAchievements: () => ({ data: undefined, isLoading: false, isError: true }),
  useClaimAllAchievements: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTitle: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("AchievementsTab", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche une erreur quand le chargement échoue", () => {
    render(<AchievementsTab />);
    expect(screen.getByText("Impossible de charger les succès.")).toBeInTheDocument();
    expect(screen.queryByText("Chargement des succès…")).not.toBeInTheDocument();
  });
});
