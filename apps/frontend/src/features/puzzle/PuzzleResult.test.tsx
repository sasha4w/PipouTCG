import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PuzzleReward } from "@pipou/shared";
import i18n from "../../i18n";
import PuzzleResult from "./PuzzleResult";

const reward = (over: Partial<PuzzleReward> = {}): PuzzleReward => ({
  firstSolve: true,
  gold: 120,
  xp: 80,
  booster: false,
  streak: { current: 4, longest: 6, nextBoosterIn: 3 },
  ...over,
});

describe("PuzzleResult", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("première résolution : récompenses, série et boutons", () => {
    const onBack = vi.fn();
    const onRestart = vi.fn();
    render(
      <PuzzleResult
        outcome="solved"
        reward={reward()}
        test={false}
        onRestart={onRestart}
        onBack={onBack}
      />,
    );
    expect(screen.getByText("Défi résolu !")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.queryByText(/booster offert/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    fireEvent.click(screen.getByRole("button", { name: "Rejouer" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("série de sept jours : ligne du booster offert", () => {
    render(
      <PuzzleResult
        outcome="solved"
        reward={reward({
          booster: true,
          streak: { current: 7, longest: 7, nextBoosterIn: 7 },
        })}
        test={false}
        onRestart={() => {}}
        onBack={() => {}}
      />,
    );
    expect(
      screen.getByText("Série de 7 jours : booster offert"),
    ).toBeInTheDocument();
  });

  it("déjà résolu : aucune récompense", () => {
    render(
      <PuzzleResult
        outcome="solved"
        reward={reward({ firstSolve: false, gold: 0, xp: 0 })}
        test={false}
        onRestart={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Résolu !")).toBeInTheDocument();
    expect(
      screen.getByText("Aucune récompense (déjà résolu aujourd'hui)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("XP")).toBeNull();
  });

  it("partie de test : pas de récompense", () => {
    render(
      <PuzzleResult
        outcome="solved"
        test
        onRestart={() => {}}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Partie de test")).toBeInTheDocument();
  });

  it("raté : recommencer et retour", () => {
    const onRestart = vi.fn();
    render(
      <PuzzleResult
        outcome="failed"
        test={false}
        onRestart={onRestart}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Raté…")).toBeInTheDocument();
    expect(
      screen.getByText("L'objectif n'est pas atteint."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recommencer" }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
