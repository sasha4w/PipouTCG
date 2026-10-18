import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UserQuest, UserQuestsResponse } from "@pipou/shared";
import i18n from "../../i18n";
import QuestsPanel from "../../features/profile/QuestsPanel";

const quest = (id: number, extra: Partial<UserQuest> = {}): UserQuest => ({
  id,
  questId: id,
  title: "quests.pool.d_open_1",
  description: null,
  resetType: "DAILY",
  rewardType: "GOLD",
  rewardAmount: 100,
  rewardItemId: null,
  progress: {
    operator: "AND",
    conditions: [{ type: "OPEN_BOOSTER", current: 0, target: 1, completed: false }],
    globalCompleted: false,
  },
  isCompleted: false,
  rewardClaimed: false,
  resetAt: new Date(Date.now() + 3_600_000).toISOString(),
  ...extra,
});

let quests: UserQuestsResponse;
vi.mock("../../hooks/useGameData", () => ({
  useQuests: () => ({ data: quests, isLoading: false }),
  useClaimReward: () => ({ mutate: vi.fn(), isPending: false }),
  useRerollQuest: () => ({ mutate: vi.fn(), isPending: false }),
  useAchievements: () => ({ data: { families: [], unlocked: 4, total: 36, equippedTitle: null }, isLoading: false }),
  useClaimAchievement: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTitle: () => ({ mutate: vi.fn(), isPending: false }),
}));

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuestsPanel />
    </QueryClientProvider>,
  );

const base = (): UserQuestsResponse => ({
  DAILY: [quest(1), quest(2, { isCompleted: true })],
  WEEKLY: [],
  MONTHLY: [],
  EVENT: [],
  rerollAvailable: true,
  dailyResetAt: new Date(Date.now() + 3_600_000).toISOString(),
  weeklyResetAt: new Date(Date.now() + 86_400_000).toISOString(),
});

describe("QuestsPanel", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche Daily, Hebdo et Succès avec le compteur, mais pas Mensuel vide", () => {
    quests = base();
    renderPanel();
    expect(screen.getByRole("button", { name: /Daily/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hebdo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Succès 4\/36/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Monthly/ })).not.toBeInTheDocument();
  });

  it("traduit le titre des quêtes du pool", () => {
    quests = base();
    renderPanel();
    expect(screen.getAllByText("Ouvre 1 booster")).toHaveLength(2);
  });

  it("propose la relance seulement sur les quêtes non terminées", () => {
    quests = base();
    renderPanel();
    expect(screen.getAllByRole("button", { name: "Changer cette quête" })).toHaveLength(1);
  });

  it("masque la relance quand elle est utilisée", () => {
    quests = { ...base(), rerollAvailable: false };
    renderPanel();
    expect(screen.queryByRole("button", { name: "Changer cette quête" })).not.toBeInTheDocument();
  });
});
