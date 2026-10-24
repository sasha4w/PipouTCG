import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useLongPress } from "../../hooks/useLongPress";

interface ProbeProps {
  onLongPress: () => void;
  onLongPressEnd?: () => void;
  onClick: () => void;
}

function Probe({ onLongPress, onLongPressEnd, onClick }: ProbeProps) {
  const longPress = useLongPress({ onLongPress, onLongPressEnd });
  return (
    <button {...longPress} onClick={onClick}>
      carte
    </button>
  );
}

function setup() {
  const props = {
    onLongPress: vi.fn(),
    onLongPressEnd: vi.fn(),
    onClick: vi.fn(),
  };
  render(<Probe {...props} />);
  return { ...props, el: screen.getByText("carte") };
}

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("déclenche après 400 ms, prévient au relâchement et avale le clic", () => {
    const { el, onLongPress, onLongPressEnd, onClick } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    act(() => vi.advanceTimersByTime(399));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    fireEvent.pointerUp(el);
    fireEvent.click(el);

    expect(onLongPressEnd).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("au toucher, l'inspection reste ouverte au relâchement ou à l'annulation", () => {
    const { el, onLongPress, onLongPressEnd, onClick } = setup();

    fireEvent.pointerDown(el, {
      clientX: 10,
      clientY: 10,
      button: 0,
      pointerType: "touch",
    });
    act(() => vi.advanceTimersByTime(400));
    // Le navigateur reprend le geste (léger glissement du doigt)
    fireEvent.pointerCancel(el);
    fireEvent.pointerUp(el);
    fireEvent.click(el);

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPressEnd).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("un tap court reste un clic", () => {
    const { el, onLongPress, onLongPressEnd, onClick } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(el);
    fireEvent.click(el);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(onLongPressEnd).not.toHaveBeenCalled();
  });

  it("un déplacement de plus de 8px annule l'appui long", () => {
    const { el, onLongPress } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(el, { clientX: 25, clientY: 10 });
    act(() => vi.advanceTimersByTime(500));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("un petit déplacement ne l'annule pas", () => {
    const { el, onLongPress } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(el, { clientX: 14, clientY: 13 });
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("le menu contextuel (clic droit, touche menu) ouvre aussi", () => {
    const { el, onLongPress } = setup();

    fireEvent.contextMenu(el);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("un appui long annulé sans clic ne fait pas avaler le clic droit suivant", () => {
    const { el, onLongPress } = setup();

    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0 });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerCancel(el);
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 2 });
    fireEvent.contextMenu(el);

    expect(onLongPress).toHaveBeenCalledTimes(2);
  });
});
