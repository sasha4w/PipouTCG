import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DailyRewardStatus } from "@pipou/shared";
import DailyStreakWidget from "../../components/DailyStreakWidget";
import { dailyRewardService } from "../../services/dailyReward.service";

vi.mock("../../services/dailyReward.service");
vi.mock("../../contexts/DailyRewardContext", () => ({
  useDailyReward: () => ({ openModal: vi.fn() }),
}));

// 2026-10-16 is a Friday: the strip covers Mon 12 → Sun 18.
const status: DailyRewardStatus = {
  streak: { current: 2, longest: 5, totalDays: 9, lastClaimDate: "2026-10-15" },
  nextDay: { cycleDay: 3, weekNumber: 1 },
  alreadyClaimed: false,
  rescueAvailable: false,
  rescueCost: null,
  streakAtRisk: false,
  nextReward: { type: "gold", value: 50, quantity: 1, label: null },
  milestones: [{ dayThreshold: 3, type: "gold", value: 500, quantity: 1, label: null }],
  claimedDates: ["2026-10-15"],
  rescuedDates: ["2026-10-14"],
};

describe("DailyStreakWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-16T10:00:00Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("affiche un jour racheté comme réclamé dans la semaine", async () => {
    vi.mocked(dailyRewardService.getStatus).mockResolvedValue(status);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <DailyStreakWidget />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".dsw__week-day.claimed")).toHaveLength(2),
    );
    // 14 (rescued) and 15 (claimed) show a check, 12 and 13 stay missed.
    expect(screen.queryByText("14")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".dsw__week-day.missed")).toHaveLength(2);
    await waitFor(() => expect(client.isFetching()).toBe(0));
  });
});
