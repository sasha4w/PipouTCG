import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MonsterZoneContent from "../../features/fight/Zonerow/MonsterZoneContent";
import { monster } from "../fixtures/monster";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

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
    // La Provocation est un anneau sur la zone, pas un badge
    const badges = [...container.querySelectorAll(".zr-badge")];
    expect(badges.map((b) => b.classList[1])).toEqual(["zr-badge--guard"]);
  });

  it("affiche le compteur d'éclosion d'un œuf sur le plateau", () => {
    const { container } = render(
      <MonsterZoneContent
        zone={monster({ hatchCounter: 2 })}
        isOpponent={false}
        onInspect={vi.fn()}
        onInspectEnd={vi.fn()}
      />,
    );
    const badge = container.querySelector(".zr-badge--hatch");
    expect(badge).toHaveTextContent("2");
    expect(badge?.querySelector("svg")).not.toBeNull();
    expect(badge).not.toHaveClass("zr-badge--urgent");
  });

  it("montre 3 badges puis « +N »", () => {
    const { container } = render(
      <MonsterZoneContent
        zone={monster({
          mode: "guard",
          guardTurns: 1,
          reflectPercent: 50,
          hasPiercing: true,
          ignoresTaunt: true,
          hatchCounter: 1,
        })}
        isOpponent
        onInspect={vi.fn()}
        onInspectEnd={vi.fn()}
      />,
    );
    const badges = [...container.querySelectorAll(".zr-badge")];
    expect(badges.map((b) => b.classList[1])).toEqual([
      "zr-badge--guard",
      "zr-badge--reflect",
      "zr-badge--piercing",
      "zr-badge--more",
    ]);
    expect(badges[0]).toHaveTextContent("1/2");
    expect(badges[0]).toHaveClass("zr-badge--urgent");
    expect(badges[3]).toHaveTextContent("+2");
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

    fireEvent.click(screen.getByRole("button", { name: "Mode Garde" }));
    expect(onModeChange).toHaveBeenCalledWith("m1", "guard");

    const card = screen.getByRole("button", { name: /Gobelin/ });
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));
    expect(onInspect).toHaveBeenCalledTimes(1);
  });
});
