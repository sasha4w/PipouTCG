import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stepNote = vi.fn();
const tear = vi.fn();

vi.mock("./openingAudio", () => ({
  openingAudio: {
    tear: (s: number) => tear(s),
    stepNote: (s: number) => stepNote(s),
  },
}));

import { PackTear } from "./PackTear";

function setup(props: Partial<React.ComponentProps<typeof PackTear>> = {}) {
  const onTorn = vi.fn();
  const onWaitDone = vi.fn();
  const utils = render(
    <PackTear
      name="Booster Test"
      quantity={1}
      bestRarity={null}
      onTorn={onTorn}
      onWaitDone={onWaitDone}
      {...props}
    />,
  );
  const strip = screen.getByTestId("pack-tear-strip");
  strip.getBoundingClientRect = () =>
    ({ left: 0, right: 100, width: 100, top: 0, bottom: 10, height: 10 }) as DOMRect;
  strip.setPointerCapture = vi.fn();
  strip.releasePointerCapture = vi.fn();
  return { ...utils, strip, onTorn, onWaitDone };
}

function drag(strip: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(strip, { clientX: from, clientY: 5, pointerId: 1 });
  fireEvent.pointerMove(strip, { clientX: to, clientY: 5, pointerId: 1 });
  fireEvent.pointerUp(strip, { clientX: to, clientY: 5, pointerId: 1 });
}

describe("PackTear", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stepNote.mockClear();
    tear.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ne déchire pas à 50 %", () => {
    const { strip, onTorn } = setup();
    drag(strip, 2, 50);
    expect(onTorn).not.toHaveBeenCalled();
  });

  it("déchire à 96 % de gauche à droite", () => {
    const { strip, onTorn } = setup();
    drag(strip, 2, 97);
    expect(onTorn).toHaveBeenCalledTimes(1);
  });

  it("déchire à 96 % de droite à gauche", () => {
    const { strip, onTorn } = setup();
    drag(strip, 98, 3);
    expect(onTorn).toHaveBeenCalledTimes(1);
  });

  it("n'appelle onTorn qu'une fois malgré un second glissement", () => {
    const { strip, onTorn } = setup();
    drag(strip, 2, 97);
    drag(strip, 2, 97);
    fireEvent.pointerUp(strip, { clientX: 97, pointerId: 1 });
    expect(onTorn).toHaveBeenCalledTimes(1);
  });

  it("joue 4 notes pour epic puis onWaitDone", () => {
    const { strip, rerender, onTorn, onWaitDone } = setup();
    drag(strip, 2, 97);
    expect(stepNote).not.toHaveBeenCalled();
    rerender(
      <PackTear
        name="Booster Test"
        quantity={1}
        bestRarity="epic"
        onTorn={onTorn}
        onWaitDone={onWaitDone}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(stepNote.mock.calls.map((c) => c[0])).toEqual([0, 1, 2, 3]);
    expect(onWaitDone).toHaveBeenCalledTimes(1);
  });

  it("reste au palier 0 tant que bestRarity est inconnu", () => {
    const { strip, onWaitDone } = setup();
    drag(strip, 2, 97);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onWaitDone).not.toHaveBeenCalled();
  });

  it("nettoie les timers au démontage", () => {
    const { strip, rerender, unmount, onTorn, onWaitDone } = setup();
    drag(strip, 2, 97);
    rerender(
      <PackTear
        name="x"
        quantity={1}
        bestRarity="legendary"
        onTorn={onTorn}
        onWaitDone={onWaitDone}
      />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onWaitDone).not.toHaveBeenCalled();
  });

  it("affiche ×10 pour quantity 10", () => {
    setup({ quantity: 10 });
    expect(screen.getByText("×10")).toBeInTheDocument();
  });
});
