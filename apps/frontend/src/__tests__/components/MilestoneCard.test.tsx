import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DailyRewardMilestone } from "@pipou/shared";
import MilestoneCard, {
  visibleChips,
} from "../../components/daily-reward/MilestoneCard";

const ms = (dayThreshold: number, label: string | null = null): DailyRewardMilestone => ({
  dayThreshold,
  type: "gold",
  value: 100,
  quantity: 1,
  label,
});
const ALL = [7, 14, 21, 30, 60, 77, 100].map((d) => ms(d));

describe("MilestoneCard", () => {
  it("affiche le prochain palier et la progression", () => {
    render(<MilestoneCard milestones={[ms(7), ms(21, "🎁 Coffre rare")]} streak={18} />);
    expect(screen.getByText("J21 · Coffre rare")).toBeInTheDocument();
    expect(screen.getByText("18 / 21 jours consécutifs")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "18");
  });

  it("utilise le texte de la récompense sans label", () => {
    render(<MilestoneCard milestones={[ms(7)]} streak={2} />);
    expect(screen.getByText("J7 · 100 gold")).toBeInTheDocument();
  });

  it("indique quand tous les paliers sont atteints", () => {
    render(<MilestoneCard milestones={[ms(7)]} streak={9} />);
    expect(screen.getByText("Tous les paliers atteints")).toBeInTheDocument();
  });

  it("ne rend rien sans palier", () => {
    const { container } = render(<MilestoneCard milestones={[]} streak={3} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("visibleChips : 2 atteints, le prochain et 3 suivants", () => {
    expect(visibleChips(ALL, 25).map((m) => m.dayThreshold)).toEqual([
      14, 21, 30, 60, 77, 100,
    ]);
    expect(visibleChips(ALL, 0).map((m) => m.dayThreshold)).toEqual([7, 14, 21, 30]);
  });
});
