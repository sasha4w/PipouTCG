import { describe, expect, it, vi, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { TutorialStepView } from "@pipou/shared";
import i18n from "../../i18n";
import TutorialCoach from "./TutorialCoach";
import TutorialResult from "./TutorialResult";

const step = (over: Partial<TutorialStepView>): TutorialStepView => ({
  lessonId: "first-turn",
  index: 0,
  total: 5,
  kind: "info",
  textKey: "tutorial.first-turn.goal",
  ...over,
});

describe("TutorialCoach", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche le texte de l'étape, la progression et « Suivant » pour une explication", () => {
    const onNext = vi.fn();
    render(<TutorialCoach step={step({})} onNext={onNext} onQuit={vi.fn()} />);
    expect(screen.getByText(/6 Primes/)).toBeInTheDocument();
    expect(screen.getByText("Étape 1 / 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Suivant/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("n'offre pas « Suivant » quand une action est attendue", () => {
    render(
      <TutorialCoach
        step={step({ kind: "player", textKey: "tutorial.first-turn.recycle" })}
        onNext={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Suivant/ })).toBeNull();
  });

  it("dit que l'adversaire joue pendant ses coups scriptés", () => {
    render(
      <TutorialCoach
        step={step({
          kind: "opponent",
          textKey: "tutorial.common.opponentMain",
        })}
        onNext={vi.fn()}
        onQuit={vi.fn()}
      />,
    );
    expect(screen.getByText(/L'adversaire joue/)).toBeInTheDocument();
  });

  it("permet de quitter la leçon", () => {
    const onQuit = vi.fn();
    render(<TutorialCoach step={step({})} onNext={vi.fn()} onQuit={onQuit} />);
    fireEvent.click(screen.getByRole("button", { name: "Quitter la leçon" }));
    expect(onQuit).toHaveBeenCalled();
  });
});

describe("TutorialResult", () => {
  const base = {
    lessonId: "combat",
    completed: true,
    firstCompletion: true,
    gold: 100,
    xp: 50,
  } as const;
  const noop = vi.fn();

  it("montre la récompense à la première réussite", () => {
    render(
      <TutorialResult
        result={base}
        hasNext
        onNext={noop}
        onReplay={noop}
        onBack={noop}
      />,
    );
    expect(screen.getByText(/\+100/)).toBeInTheDocument();
    expect(screen.getByText(/\+50 XP/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Leçon suivante" }),
    ).toBeInTheDocument();
  });

  it("ne promet rien à une leçon déjà réussie", () => {
    render(
      <TutorialResult
        result={{ ...base, firstCompletion: false, gold: 0, xp: 0 }}
        hasNext={false}
        onNext={noop}
        onReplay={noop}
        onBack={noop}
      />,
    );
    expect(screen.getByText(/Déjà réussie/)).toBeInTheDocument();
    expect(screen.queryByText(/\+100/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Leçon suivante" })).toBeNull();
  });

  it("une leçon abandonnée ne rapporte rien et n'ouvre pas la suivante", () => {
    render(
      <TutorialResult
        result={{
          ...base,
          completed: false,
          firstCompletion: false,
          gold: 0,
          xp: 0,
        }}
        hasNext
        onNext={noop}
        onReplay={noop}
        onBack={noop}
      />,
    );
    expect(screen.getByText(/rien n'est gagné/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leçon suivante" })).toBeNull();
  });
});
