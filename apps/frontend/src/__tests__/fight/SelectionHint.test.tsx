import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import SelectionHint from "../../features/fight/SelectionHint";

afterEach(() => {
  vi.useRealTimers();
});

describe("SelectionHint", () => {
  it("affiche l'indication au centre, annoncée aux lecteurs d'écran", () => {
    render(<SelectionHint text="Touche une zone" resetKey={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("Touche une zone");
  });

  it("disparaît après 3 secondes", () => {
    vi.useFakeTimers();
    render(<SelectionHint text="Touche une zone" resetKey={0} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ne montre rien sans texte", () => {
    render(<SelectionHint text="" resetKey={0} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("réapparaît quand la sélection change", () => {
    vi.useFakeTimers();
    const { rerender } = render(<SelectionHint text="Touche" resetKey={0} />);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<SelectionHint text="Touche" resetKey={1} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("réapparaît quand on resélectionne la même carte après l'avoir lâchée", () => {
    vi.useFakeTimers();
    const { rerender } = render(<SelectionHint text="Touche" resetKey={2} />);
    act(() => vi.advanceTimersByTime(3000));
    rerender(<SelectionHint text="" resetKey={null} />);
    rerender(<SelectionHint text="Touche" resetKey={2} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
