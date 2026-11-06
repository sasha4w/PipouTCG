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
  const onClose = vi.fn();
  const utils = render(
    <AnimationContext.Provider
      value={{ preference: "auto", setPreference: () => {}, reduced }}
    >
      <CardReveal steps={steps} onDone={onDone} onSkip={onSkip} onClose={onClose} />
    </AnimationContext.Provider>,
  );
  return { ...utils, onDone, onSkip, onClose };
}

const target = () => screen.getByTestId("reveal-card");

describe("CardReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("close and skip sit with the card, not during the blackout", () => {
    const s = [step("common"), step("epic", { ritual: "full", blackoutMs: 400 })];
    const { onClose, onSkip } = setup(s);
    expect(screen.queryByTestId("reveal-skip")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("reveal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(target());
    // noir : ni croix ni Passer, la carte n'est pas encore là
    expect(screen.getByTestId("reveal-blackout")).toBeInTheDocument();
    expect(screen.queryByTestId("reveal-close")).not.toBeInTheDocument();
    expect(screen.queryByTestId("reveal-skip")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.click(screen.getByTestId("reveal-skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("ignores clicks during blackout, then reveals with bass", () => {
    const s = [step("epic", { ritual: "full", blackoutMs: 400 }), step("common")];
    setup(s);
    expect(rumble).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("reveal-blackout")).toBeInTheDocument();
    expect(playRaritySound).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reveal-card")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("reveal-root"));
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(screen.queryByTestId("reveal-card")).not.toBeInTheDocument();
    expect(screen.queryByText(s[1].card.name)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("reveal-blackout")).not.toBeInTheDocument();
    expect(playRaritySound).toHaveBeenCalledWith("epic");
    expect(bass).toHaveBeenCalledTimes(1);
    fireEvent.click(target());
    expect(screen.getByText(s[1].card.name)).toBeInTheDocument();
  });

  it("onDone fires once: click then timer on last auto-advance step", () => {
    const { onDone } = setup([
      step("common", { holdForClick: false, autoAdvanceMs: 110 }),
    ]);
    fireEvent.click(target());
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("double click on last held step calls onDone once", () => {
    const { onDone } = setup([step("common")]);
    fireEvent.click(target());
    fireEvent.click(target());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("click on auto-advance step is ignored", () => {
    const s = [
      step("common", { holdForClick: false, autoAdvanceMs: 110 }),
      step("common"),
    ];
    setup(s);
    fireEvent.click(target());
    expect(screen.getByText(s[0].card.name)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(110);
    });
    expect(screen.getByText(s[1].card.name)).toBeInTheDocument();
  });

  it("rerender with equal new steps array does not replay sound", () => {
    const s = [step("rare")];
    const onDone = vi.fn();
    const onSkip = vi.fn();
    const ui = (steps: RevealStep[]) => (
      <CardReveal steps={steps} onDone={onDone} onSkip={onSkip} />
    );
    const { rerender } = render(ui(s));
    expect(playRaritySound).toHaveBeenCalledTimes(1);
    rerender(ui(s.map((x) => ({ ...x }))));
    expect(playRaritySound).toHaveBeenCalledTimes(1);
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
