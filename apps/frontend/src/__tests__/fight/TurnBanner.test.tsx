import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import TurnBanner from "../../features/fight/TurnBanner";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TurnBanner", () => {
  it("apparaît quand le tour passe à moi", () => {
    const { rerender } = render(<TurnBanner isMyTurn={false} turnNumber={2} />);
    expect(screen.queryByText("À toi de jouer !")).toBeNull();
    rerender(<TurnBanner isMyTurn turnNumber={3} />);
    expect(screen.getByText("À toi de jouer !")).toBeInTheDocument();
  });

  it("n'apparaît pas quand le tour passe à l'adversaire", () => {
    const { rerender } = render(<TurnBanner isMyTurn turnNumber={3} />);
    rerender(<TurnBanner isMyTurn={false} turnNumber={4} />);
    expect(screen.queryByText("À toi de jouer !")).toBeNull();
  });

  it("apparaît dès le premier rendu si c'est mon tour", () => {
    render(<TurnBanner isMyTurn turnNumber={1} />);
    expect(screen.getByText("À toi de jouer !")).toBeInTheDocument();
  });

  it("disparaît après 1,2 s", () => {
    vi.useFakeTimers();
    render(<TurnBanner isMyTurn turnNumber={1} />);
    expect(screen.getByText("À toi de jouer !")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1199));
    expect(screen.getByText("À toi de jouer !")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("À toi de jouer !")).toBeNull();
  });

  it("est annoncée aux lecteurs d'écran", () => {
    render(<TurnBanner isMyTurn turnNumber={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("À toi de jouer !");
  });
});
