import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DailyRewardStatus } from "@pipou/shared";
import DailyRewardModal from "../../components/DailyRewardModal";
import { dailyRewardService } from "../../services/dailyReward.service";
import { userService } from "../../services/user.service";

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));
vi.mock("../../services/dailyReward.service");
vi.mock("../../services/user.service");

const status: DailyRewardStatus = {
  streak: { current: 20, longest: 28, totalDays: 38, lastClaimDate: "2026-10-14" },
  nextDay: { cycleDay: 7, weekNumber: 3 },
  alreadyClaimed: false,
  rescueAvailable: true,
  rescueCost: 300,
  streakAtRisk: false,
  nextReward: { type: "gold", value: 150, quantity: 1, label: "💎 Semaine 3" },
  milestones: [{ dayThreshold: 21, type: "gold", value: 500, quantity: 1, label: null }],
  claimedDates: ["2026-10-14"],
  rescuedDates: [],
};

function renderModal(gold: number) {
  vi.mocked(dailyRewardService.getStatus).mockResolvedValue(status);
  vi.mocked(userService.getMe).mockResolvedValue({ gold } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DailyRewardModal onClose={vi.fn()} addToast={vi.fn()} />
    </QueryClientProvider>,
  );
  return client;
}

// The click handlers continue asynchronously (service calls), so keep them inside act.
const click = (el: HTMLElement) =>
  act(async () => {
    await userEvent.click(el);
  });

// Let every query (initial load and post-claim refetch) finish so no update lands after the test.
const settled = (client: QueryClient) => waitFor(() => expect(client.isFetching()).toBe(0));

describe("DailyRewardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la récompense du jour sans emoji", async () => {
    const client = renderModal(1000);
    expect(await screen.findByText("150 gold")).toBeInTheDocument();
    expect(screen.getByText("Semaine 3")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    await settled(client);
  });

  it("propose le rachat et le bloque si le gold manque", async () => {
    vi.mocked(dailyRewardService.claimDaily).mockResolvedValue({
      status: "rescue_required",
      message: "",
      streak: status.streak,
      rescue: { cost: 300 },
    });
    const client = renderModal(120);
    await click(await screen.findByRole("button", { name: /réclamer/i }));
    expect(await screen.findByText("Série de 20 jours en danger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /il manque 180 gold/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /repartir à j1/i })).toBeEnabled();
    await settled(client);
  });

  it("annonce la série perdue après un reset automatique", async () => {
    vi.mocked(dailyRewardService.claimDaily).mockResolvedValue({
      status: "claimed",
      message: "",
      streak: { current: 1, longest: 28, totalDays: 39, lastClaimDate: "2026-10-16" },
      rewards: [{ type: "gold", value: 50, quantity: 1, label: null, isMilestone: false }],
      streakLost: 20,
    });
    const client = renderModal(1000);
    await click(await screen.findByRole("button", { name: /réclamer/i }));
    expect(await screen.findByText("Série de 20 jours perdue")).toBeInTheDocument();
    expect(screen.getByText("+50")).toBeInTheDocument();
    await settled(client);
  });

  it("annonce la série perdue après Repartir à J1", async () => {
    vi.mocked(dailyRewardService.claimDaily)
      .mockResolvedValueOnce({
        status: "rescue_required",
        message: "",
        streak: status.streak,
        rescue: { cost: 300 },
      })
      .mockResolvedValueOnce({
        status: "claimed",
        message: "",
        streak: { current: 1, longest: 28, totalDays: 39, lastClaimDate: "2026-10-16" },
        rewards: [{ type: "gold", value: 50, quantity: 1, label: null, isMilestone: false }],
      });
    vi.mocked(dailyRewardService.resetStreak).mockResolvedValue(undefined as never);
    const client = renderModal(1000);
    await click(await screen.findByRole("button", { name: /réclamer/i }));
    await click(await screen.findByRole("button", { name: /repartir à j1/i }));
    expect(await screen.findByText("Série de 20 jours perdue")).toBeInTheDocument();
    await settled(client);
  });

  it("revient à l'écran de claim si le claim échoue après un rachat réussi", async () => {
    vi.mocked(dailyRewardService.claimDaily)
      .mockResolvedValueOnce({
        status: "rescue_required",
        message: "",
        streak: status.streak,
        rescue: { cost: 300 },
      })
      .mockRejectedValueOnce(new Error("boom"));
    vi.mocked(dailyRewardService.rescueStreak).mockResolvedValue({ goldSpent: 300 } as never);
    const client = renderModal(1000);
    await click(await screen.findByRole("button", { name: /réclamer/i }));
    await click(await screen.findByRole("button", { name: /sauver pour 300 gold/i }));
    expect(await screen.findByText("Erreur lors du rachat.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /réclamer/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /repartir à j1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sauver pour/i })).not.toBeInTheDocument();
    expect(dailyRewardService.rescueStreak).toHaveBeenCalledTimes(1);
    await settled(client);
  });
});
