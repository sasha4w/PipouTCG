import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import HeroCard from "../../features/profile/HeroCard";
import type { UserProfile } from "../../services/user.service";

const profile = (equippedTitle: UserProfile["equippedTitle"]): UserProfile => ({
  id: 1,
  username: "Pipou",
  isPrivate: false,
  equippedTitle,
  level: 3,
  experience: 40,
  currentXp: 10,
  xpForNextLevel: 30,
  progressPercent: 33,
  gold: 500,
  stats: {
    boostersOpened: 0, cardsBought: 0, cardsSold: 0, moneyEarned: 0, moneySpent: 0,
    setsCompleted: 0, boostersBought: 0, bundlesBought: 0, boostersSold: 0, bundlesSold: 0,
  },
});

describe("HeroCard", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche le titre équipé sous le pseudo", () => {
    render(<HeroCard profile={profile("DUELS_WON")} />);
    expect(screen.getByText("Champion")).toBeInTheDocument();
  });

  it("n'affiche rien sans titre", () => {
    render(<HeroCard profile={profile(null)} />);
    expect(screen.queryByText("Champion")).not.toBeInTheDocument();
  });
});
