import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
        onInfo={vi.fn()}
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
        onInfo={vi.fn()}
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
        onInfo={vi.fn()}
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
        onInfo={vi.fn()}
      />,
    );

    expect(screen.getByText("a attaqué")).toBeInTheDocument();
  });

  it("change de mode et s'informe via le bouton i de la carte sélectionnée", () => {
    const onModeChange = vi.fn();
    const onInfo = vi.fn();
    render(
      <MonsterZoneContent
        zone={monster()}
        isOpponent={false}
        onModeChange={onModeChange}
        selected
        onInfo={onInfo}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mode Garde" }));
    expect(onModeChange).toHaveBeenCalledWith("m1", "guard");

    fireEvent.click(screen.getByRole("button", { name: "Informations" }));
    expect(onInfo).toHaveBeenCalledTimes(1);
  });
});
