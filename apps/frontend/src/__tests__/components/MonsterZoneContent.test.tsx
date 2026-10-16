import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MonsterZoneContent from "../../features/fight/Zonerow/MonsterZoneContent";
import { monster } from "../fixtures/monster";

describe("MonsterZoneContent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("montre la carte avec stats courantes, garde et badges", () => {
    const { container } = render(
      <MonsterZoneContent
        zone={monster({
          mode: "guard",
          currentHp: 300,
          atkBuff: 50,
          hasTaunt: true,
        })}
        isOpponent
        onInspect={vi.fn()}
        onInspectEnd={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Gobelin, 150 ATK, 300 PV" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".card-face")).toHaveClass(
      "card-face--guard",
    );
    expect(screen.getByTitle("Provocation")).toBeInTheDocument();
  });

  it("grise un monstre qui a fini d'attaquer", () => {
    render(
      <MonsterZoneContent
        zone={monster({ hasAttackedThisTurn: true, attacksUsedThisTurn: 1 })}
        isOpponent={false}
        onInspect={vi.fn()}
        onInspectEnd={vi.fn()}
      />,
    );

    expect(screen.getByText("a attaqué")).toBeInTheDocument();
  });

  it("change de mode et s'inspecte par appui long", () => {
    vi.useFakeTimers();
    const onModeChange = vi.fn();
    const onInspect = vi.fn();
    render(
      <MonsterZoneContent
        zone={monster()}
        isOpponent={false}
        onModeChange={onModeChange}
        onInspect={onInspect}
        onInspectEnd={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "🛡️" }));
    expect(onModeChange).toHaveBeenCalledWith("m1", "guard");

    const card = screen.getByRole("button", { name: /Gobelin/ });
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));
    expect(onInspect).toHaveBeenCalledTimes(1);
  });
});
