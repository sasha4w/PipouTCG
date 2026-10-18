import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AchievementProgress } from "@pipou/shared";
import i18n from "../../i18n";
import AchievementTile from "../../features/achievements/AchievementTile";

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

describe("AchievementTile", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche le nom et une pastille allumée par palier réclamé", () => {
    render(<AchievementTile progress={progress([true, false, false], [true, true, false])} onOpen={() => {}} />);
    expect(screen.getByText("Victoires JcJ")).toBeInTheDocument();
    expect(document.querySelectorAll(".ach-pip--on")).toHaveLength(1);
  });

  it("se met en avant quand un palier est réclamable", () => {
    render(<AchievementTile progress={progress([true, false, false], [true, true, false])} onOpen={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("ach-tile--claimable");
  });

  it("n'est pas mis en avant sans palier réclamable", () => {
    render(<AchievementTile progress={progress([true, false, false], [true, false, false])} onOpen={() => {}} />);
    expect(screen.getByRole("button")).not.toHaveClass("ach-tile--claimable");
  });

  it("ouvre le détail au clic", () => {
    const onOpen = vi.fn();
    render(<AchievementTile progress={progress([false, false, false], [false, false, false])} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });
});
