import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import FightHUD from "../../features/fight/FightHUD";
import type { MyState, OppState } from "../../features/fight/fight.types";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const me = {
  userId: 1,
  username: "moi",
  primes: 3,
  deckCount: 10,
  graveyard: [{ instanceId: "g1" }],
} as MyState;
const opponent = {
  userId: 2,
  username: "lui",
  primes: 3,
  handCount: 3,
  deckCount: 10,
  graveyard: [{ instanceId: "g2" }],
} as OppState;

function renderHud(over: Partial<ComponentProps<typeof FightHUD>> = {}) {
  const props: ComponentProps<typeof FightHUD> = {
    me,
    opponent,
    phase: "main",
    turnNumber: 3,
    isMyTurn: true,
    timeLeft: null,
    handSize: 5,
    onPickPhase: vi.fn(),
    onOpenLog: vi.fn(),
    onOpenGraveyard: vi.fn(),
    onSurrender: vi.fn(),
    ...over,
  };
  render(<FightHUD {...props} />);
  return props;
}

describe("FightHUD", () => {
  it("à mon tour, la pastille est verte", () => {
    renderHud();
    expect(screen.getByText("Principale").closest(".hud-phase-chip")).toHaveClass(
      "hud-phase-chip--mine",
    );
  });

  it("tour adverse : pastille grise et appui sans effet", () => {
    renderHud({ isMyTurn: false });
    const chip = screen.getByText("Principale").closest(".hud-phase-chip")!;
    expect(chip).toHaveClass("hud-phase-chip--theirs");
    fireEvent.click(chip);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("à mon tour, un appui sur la pastille ouvre le menu des phases", () => {
    renderHud();
    fireEvent.click(screen.getByText("Principale"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Combat" })).toBeInTheDocument();
  });

  it("choisir Finir le tour depuis la phase principale", () => {
    const props = renderHud();
    fireEvent.click(screen.getByText("Principale"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Finir le tour" }));
    expect(props.onPickPhase).toHaveBeenCalledWith({
      target: "endTurn",
      steps: 3,
    });
  });

  it("les boutons journal, cimetières et abandon appellent leurs callbacks", () => {
    const props = renderHud();
    fireEvent.click(screen.getByRole("button", { name: "Journal" }));
    expect(props.onOpenLog).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Mon cimetière (1)" }),
    );
    expect(props.onOpenGraveyard).toHaveBeenCalledWith("me");

    fireEvent.click(
      screen.getByRole("button", { name: "Cimetière adverse (1)" }),
    );
    expect(props.onOpenGraveyard).toHaveBeenCalledWith("opponent");

    fireEvent.click(screen.getByRole("button", { name: "Abandonner" }));
    expect(props.onSurrender).toHaveBeenCalled();
  });

  it("cimetière vide : le bouton est grisé", () => {
    renderHud({ me: { ...me, graveyard: [] } as MyState });
    expect(
      screen.getByRole("button", { name: "Mon cimetière (0)" }),
    ).toBeDisabled();
  });

  it("sans onSurrender, pas de bouton d'abandon", () => {
    renderHud({ onSurrender: undefined });
    expect(screen.queryByRole("button", { name: "Abandonner" })).toBeNull();
  });
});
