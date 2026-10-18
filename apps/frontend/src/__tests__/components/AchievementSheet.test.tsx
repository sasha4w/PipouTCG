import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AchievementProgress } from "@pipou/shared";
import i18n from "../../i18n";
import AchievementSheet from "../../features/achievements/AchievementSheet";

const progress = (claimed: boolean[], reached: boolean[]): AchievementProgress => ({
  family: "DUELS_WON",
  value: 30,
  claimedTier: null,
  tiers: (["BRONZE", "SILVER", "GOLD"] as const).map((tier, i) => ({
    tier,
    threshold: [1, 25, 100][i],
    reward: { type: "GOLD", amount: 100 },
    claimed: claimed[i],
    reached: reached[i],
  })),
});

describe("AchievementSheet", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("liste les 3 paliers et le titre débloqué", () => {
    render(<AchievementSheet progress={progress([true, false, false], [true, true, false])} claiming={false} onClaim={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Gagne 1 duels")).toBeInTheDocument();
    expect(screen.getByText("Gagne 25 duels")).toBeInTheDocument();
    expect(screen.getByText("Gagne 100 duels")).toBeInTheDocument();
    expect(screen.getByText("Débloque le titre « Champion »")).toBeInTheDocument();
  });

  it("réclame le prochain palier atteint", () => {
    const onClaim = vi.fn();
    render(<AchievementSheet progress={progress([true, false, false], [true, true, false])} claiming={false} onClaim={onClaim} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Réclamer" }));
    expect(onClaim).toHaveBeenCalled();
  });

  it("désactive Réclamer si le prochain palier n'est pas atteint", () => {
    render(<AchievementSheet progress={progress([true, false, false], [true, false, false])} claiming={false} onClaim={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Réclamer" })).toBeDisabled();
  });

  it("indique quand tout est réclamé", () => {
    render(<AchievementSheet progress={progress([true, true, true], [true, true, true])} claiming={false} onClaim={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Tous les paliers sont réclamés")).toBeInTheDocument();
  });
});
