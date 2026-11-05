import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenedCard, OpeningResult } from "../../services/opening.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { AppError } from "../../utils/errors";

const openBooster = vi.fn();
const openBundle = vi.fn();
const playRaritySound = vi.fn();
const play = vi.fn();

vi.mock("../../services/opening.service", () => ({
  openingService: {
    openBooster: (...a: unknown[]) => openBooster(...a),
    openBundle: (...a: unknown[]) => openBundle(...a),
  },
}));
vi.mock("../../services/sound.service", () => ({
  soundService: { play: (n: string) => play(n) },
}));
vi.mock("./openingAudio", () => ({
  openingAudio: { rumble: vi.fn(), bass: vi.fn() },
  playRaritySound: (r: string) => playRaritySound(r),
}));
vi.mock("../cards/CardDisplay", () => ({
  default: ({ card }: { card: { name: string } }) => (
    <div data-testid="card">{card.name}</div>
  ),
}));
vi.mock("./PackTear", () => ({
  PackTear: (p: {
    quantity: number;
    bestRarity: string | null;
    onTorn: () => void;
    onWaitDone: () => void;
  }) => (
    <div data-testid="pack-tear" data-qty={p.quantity} data-best={p.bestRarity ?? ""}>
      <button onClick={p.onTorn}>tear</button>
      <button onClick={p.onWaitDone}>waitdone</button>
    </div>
  ),
}));

import OpeningModal, { type OpeningTarget } from "./OpeningModal";

let seq = 0;
const mk = (rarity: string, isNew = false): OpenedCard => ({
  id: ++seq,
  name: `card${seq}-${rarity}`,
  rarity,
  type: "monster",
  supportType: null,
  atk: 1,
  hp: 1,
  cost: 1,
  description: null,
  image: null,
  isNew,
});

function setup(target: OpeningTarget) {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const onClose = vi.fn();
  const onDone = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <OpeningModal target={target} onClose={onClose} onDone={onDone} />
    </QueryClientProvider>,
  );
  return { ...utils, invalidate, onClose, onDone };
}

const booster = (o: Partial<OpeningTarget> = {}): OpeningTarget => ({
  type: "booster",
  id: 7,
  name: "Booster A",
  ...o,
});

describe("OpeningModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("torn twice sends a single request with chosen quantity", async () => {
    let resolve!: (r: OpeningResult) => void;
    openBooster.mockReturnValue(new Promise<OpeningResult>((r) => (resolve = r)));
    setup(booster({ available: 10 }));
    fireEvent.click(screen.getByRole("button", { name: "×5" }));
    fireEvent.click(screen.getByText("tear"));
    fireEvent.click(screen.getByText("tear"));
    expect(openBooster).toHaveBeenCalledTimes(1);
    expect(openBooster).toHaveBeenCalledWith(7, 5);
    expect(screen.queryByRole("button", { name: "×5" })).not.toBeInTheDocument();
    await act(async () => resolve({ cards: [mk("rare")] }));
    expect(screen.getByTestId("pack-tear").dataset.best).toBe("rare");
  });

  it("sends no quantity for a single booster", async () => {
    openBooster.mockResolvedValue({ cards: [mk("common")] });
    setup(booster());
    fireEvent.click(screen.getByText("tear"));
    expect(openBooster).toHaveBeenCalledWith(7, undefined);
    await waitFor(() =>
      expect(screen.getByTestId("pack-tear").dataset.best).toBe("common"),
    );
  });

  it("API failure shows server message, back to tear, no reveal, retry possible", async () => {
    openBooster.mockRejectedValueOnce(new AppError("Pas assez de boosters", { category: "API", statusCode: 400 }));
    openBooster.mockResolvedValueOnce({ cards: [mk("common")] });
    const { invalidate } = setup(booster({ available: 10 }));
    fireEvent.click(screen.getByText("tear"));
    expect(await screen.findByText("Pas assez de boosters")).toBeInTheDocument();
    expect(screen.getByTestId("pack-tear")).toBeInTheDocument();
    expect(screen.queryByTestId("reveal-root")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "×5" })).toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("tear"));
    await waitFor(() => expect(openBooster).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Pas assez de boosters")).not.toBeInTheDocument();
  });

  it("network failure falls back to generic message", async () => {
    openBooster.mockRejectedValue(new Error("Network Error"));
    setup(booster());
    fireEvent.click(screen.getByText("tear"));
    expect(await screen.findByText("opening.error")).toBeInTheDocument();
  });

  it("success invalidates quests, profile and inventory", async () => {
    openBooster.mockResolvedValue({ cards: [mk("common")] });
    const { invalidate } = setup(booster());
    fireEvent.click(screen.getByText("tear"));
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(3));
    const keys = invalidate.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toContainEqual(QUERY_KEYS.quests);
    expect(keys).toContainEqual(QUERY_KEYS.profile);
    expect(keys).toContainEqual(QUERY_KEYS.inventory);
  });

  it("skip leads to summary with best cards first", async () => {
    const cards = [mk("common"), mk("legendary"), mk("rare"), mk("common", true)];
    openBooster.mockResolvedValue({ cards });
    const { onDone } = setup(booster());
    fireEvent.click(screen.getByText("tear"));
    await waitFor(() => expect(screen.getByTestId("pack-tear").dataset.best).toBe("legendary"));
    fireEvent.click(screen.getByText("waitdone"));
    fireEvent.click(screen.getByTestId("reveal-card"));
    fireEvent.click(screen.getByTestId("reveal-skip"));
    const names = screen.getAllByTestId("card").map((n) => n.textContent);
    expect(names).toEqual([
      cards[1].name,
      cards[2].name,
      cards[3].name,
      cards[0].name,
    ]);
    expect(screen.getAllByTestId("summary-new")).toHaveLength(1);
    expect(play).toHaveBeenCalledWith("confirm");
    fireEvent.click(screen.getByRole("button", { name: "opening.close" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("hides x5 below 5 and x10 below 10", () => {
    const { unmount } = setup(booster({ available: 4 }));
    expect(screen.queryByRole("button", { name: /^×\d+$/ })).not.toBeInTheDocument();
    unmount();
    const second = setup(booster({ available: 9 }));
    expect(screen.getByRole("button", { name: "×1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "×5" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "×10" })).not.toBeInTheDocument();
    second.unmount();
    setup(booster());
    expect(screen.queryByRole("button", { name: /^×\d+$/ })).not.toBeInTheDocument();
  });

  it("choosing quantity updates the pack", () => {
    setup(booster({ available: 10 }));
    expect(screen.getByTestId("pack-tear").dataset.qty).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "×10" }));
    expect(screen.getByTestId("pack-tear").dataset.qty).toBe("10");
  });

  it("bundle: no quantity choice, keeps contents screen", async () => {
    openBundle.mockResolvedValue({
      cards: [mk("rare")],
      boosters: [{ name: "Booster B", quantity: 2 }],
    });
    setup({ type: "bundle", id: 3, name: "Bundle", available: 20 });
    expect(screen.queryByRole("button", { name: /^×\d+$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("tear"));
    await waitFor(() => expect(screen.getByTestId("pack-tear").dataset.best).toBe("rare"));
    expect(openBundle).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByText("waitdone"));
    expect(screen.getByTestId("bundle-contents")).toBeInTheDocument();
    expect(screen.getByText("Booster B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /opening\.seeResults/ }));
    expect(screen.getByText("Booster B")).toBeInTheDocument();
    expect(screen.getByText("x2")).toBeInTheDocument();
  });

  it("closing during automatic parade leaves no timer nor sound", async () => {
    vi.useFakeTimers();
    const cards = [mk("common"), mk("common"), mk("common")];
    openBooster.mockResolvedValue({ cards });
    // mega: auto-advance
    const { onClose, unmount } = setup(booster({ available: 10, quantity: 5 }));
    fireEvent.click(screen.getByText("tear"));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText("waitdone"));
    expect(playRaritySound).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "opening.closeModal" }));
    expect(onClose).toHaveBeenCalled();
    unmount();
    playRaritySound.mockClear();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(playRaritySound).not.toHaveBeenCalled();
  });
});
