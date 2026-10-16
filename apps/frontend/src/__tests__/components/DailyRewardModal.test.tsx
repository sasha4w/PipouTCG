import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DailyRewardStatus } from "@pipou/shared";
import DailyRewardModal from "../../components/DailyRewardModal";
import { dailyRewardService } from "../../services/dailyReward.service";
import { userService } from "../../services/user.service";

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
  return render(
    <QueryClientProvider client={client}>
      <DailyRewardModal onClose={vi.fn()} addToast={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("DailyRewardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la récompense du jour sans emoji", async () => {
    renderModal(1000);
    expect(await screen.findByText("150 gold")).toBeInTheDocument();
    expect(screen.getByText("Semaine 3")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("propose le rachat et le bloque si le gold manque", async () => {
    vi.mocked(dailyRewardService.claimDaily).mockResolvedValue({
      status: "rescue_required",
      message: "",
      streak: status.streak,
      rescue: { cost: 300 },
    });
    renderModal(120);
    await userEvent.click(await screen.findByRole("button", { name: /réclamer/i }));
    expect(await screen.findByText("Série de 20 jours en danger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /il manque 180 gold/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /repartir à j1/i })).toBeEnabled();
  });

  it("annonce la série perdue après un reset automatique", async () => {
    vi.mocked(dailyRewardService.claimDaily).mockResolvedValue({
      status: "claimed",
      message: "",
      streak: { current: 1, longest: 28, totalDays: 39, lastClaimDate: "2026-10-16" },
      rewards: [{ type: "gold", value: 50, quantity: 1, label: null, isMilestone: false }],
      streakLost: 20,
    });
    renderModal(1000);
    await userEvent.click(await screen.findByRole("button", { name: /réclamer/i }));
    expect(await screen.findByText("Série de 20 jours perdue")).toBeInTheDocument();
    expect(screen.getByText("+50")).toBeInTheDocument();
  });
});
