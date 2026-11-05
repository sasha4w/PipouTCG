import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenedCard } from "../../services/opening.service";
import { AnimationContext } from "../../contexts/animation-context";
import type { RevealStep } from "./openingPlan";

const rumble = vi.fn();
const bass = vi.fn();
const playRaritySound = vi.fn();

vi.mock("./openingAudio", () => ({
  openingAudio: { rumble: () => rumble(), bass: () => bass() },
  playRaritySound: (r: string) => playRaritySound(r),
}));
vi.mock("../cards/CardDisplay", () => ({
  default: ({ card }: { card: { name: string } }) => <div>{card.name}</div>,
}));

import { CardReveal } from "./CardReveal";

let seq = 0;
const mk = (rarity: string, isNew = false): OpenedCard => ({
  id: ++seq,
  name: `card${seq}`,
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

const step = (rarity: string, o: Partial<RevealStep> = {}): RevealStep => ({
  card: mk(rarity),
  ritual: "none",
  blackoutMs: 0,
  holdForClick: true,
  autoAdvanceMs: null,
  ...o,
});

function setup(steps: RevealStep[], reduced = false) {
  const onDone = vi.fn();
  const onSkip = vi.fn();
  const utils = render(
    <AnimationContext.Provider
      value={{ preference: "auto", setPreference: () => {}, reduced }}
    >
      <CardReveal steps={steps} onDone={onDone} onSkip={onSkip} />
    </AnimationContext.Provider>,
  );
  return { ...utils, onDone, onSkip };
}

const target = () => screen.getByTestId("reveal-card");

describe("CardReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it("click advances when holdForClick, then onDone after last", () => {
    const s = [step("common"), step("rare")];
    const { onDone } = setup(s);
    expect(screen.getByText(s[0].card.name)).toBeInTheDocument();
    fireEvent.click(target());
    expect(screen.getByText(s[1].card.name)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(target());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("plays rarity sound at reveal", () => {
    setup([step("rare")]);
    expect(playRaritySound).toHaveBeenCalledWith("rare");
  });

  it("ignores clicks during blackout, then reveals with bass", () => {
    const s = [step("epic", { ritual: "full", blackoutMs: 400 }), step("common")];
    setup(s);
    expect(rumble).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("reveal-blackout")).toBeInTheDocument();
    expect(playRaritySound).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("reveal-root"));
    expect(screen.queryByText(s[1].card.name)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByTestId("reveal-blackout")).not.toBeInTheDocument();
    expect(playRaritySound).toHaveBeenCalledWith("epic");
    expect(bass).toHaveBeenCalledTimes(1);
    fireEvent.click(target());
    expect(screen.getByText(s[1].card.name)).toBeInTheDocument();
  });

  it("auto-advances after autoAdvanceMs", () => {
    const s = [
      step("common", { holdForClick: false, autoAdvanceMs: 110 }),
      step("common"),
    ];
    setup(s);
    act(() => {
      vi.advanceTimersByTime(110);
    });
    expect(screen.getByText(s[1].card.name)).toBeInTheDocument();
  });

  it("unmount cancels timers: no sound, no callback after", () => {
    const s = [
      step("common", { holdForClick: false, autoAdvanceMs: 110 }),
      step("rare"),
    ];
    const { unmount, onDone } = setup(s);
    playRaritySound.mockClear();
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(playRaritySound).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("unmount during blackout cancels the reveal", () => {
    const { unmount } = setup([
      step("legendary", { ritual: "full", blackoutMs: 600 }),
    ]);
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(playRaritySound).not.toHaveBeenCalled();
    expect(bass).not.toHaveBeenCalled();
  });

  it("reduced removes shake, flash, rays and motes", () => {
    const { container } = setup(
      [step("legendary", { ritual: "full", blackoutMs: 0 })],
      true,
    );
    expect(container.querySelector(".opening-fx--shake")).toBeNull();
    expect(container.querySelector(".opening-fx__flash")).toBeNull();
    expect(container.querySelector(".opening-fx__rays")).toBeNull();
    expect(container.querySelector(".opening-fx__mote")).toBeNull();
  });

  it("full motion legendary has shake, flash, rays, 56 motes", () => {
    const { container } = setup([
      step("legendary", { ritual: "full", blackoutMs: 0 }),
    ]);
    expect(container.querySelector(".opening-fx--shake")).not.toBeNull();
    expect(container.querySelector(".opening-fx__flash")).not.toBeNull();
    expect(container.querySelector(".opening-fx__rays")).not.toBeNull();
    expect(container.querySelectorAll(".opening-fx__mote")).toHaveLength(56);
  });

  it("short ritual: no blackout, no rumble, no motes, but bass", () => {
    const { container } = setup([step("epic", { ritual: "short" })]);
    expect(screen.queryByTestId("reveal-blackout")).not.toBeInTheDocument();
    expect(rumble).not.toHaveBeenCalled();
    expect(bass).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll(".opening-fx__mote")).toHaveLength(0);
    expect(container.querySelector(".opening-fx--shake")).not.toBeNull();
  });

  it("skip hidden on first card, visible after, calls onSkip", () => {
    const { onSkip } = setup([step("common"), step("common")]);
    expect(screen.queryByTestId("reveal-skip")).not.toBeInTheDocument();
    fireEvent.click(target());
    fireEvent.click(screen.getByTestId("reveal-skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("shows new badge only for new cards", () => {
    const n = step("common");
    n.card.isNew = true;
    setup([n]);
    expect(screen.getByTestId("reveal-new")).toBeInTheDocument();
  });
});
