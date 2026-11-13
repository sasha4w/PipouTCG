import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PuzzleObjectiveType,
  type PuzzleReward,
  type PuzzleState,
} from "@pipou/shared";
import i18n from "../../i18n";
import { QUERY_KEYS } from "../../utils/querykeys";

const session = vi.hoisted(() => ({
  state: null as unknown,
  error: null as string | null,
  send: vi.fn(),
  restart: vi.fn(),
  close: vi.fn(),
  options: null as unknown,
}));

vi.mock("./usePuzzleSession", () => ({
  usePuzzleSession: (options: unknown) => {
    session.options = options;
    return {
      state: session.state,
      error: session.error,
      send: session.send,
      restart: session.restart,
      close: session.close,
    };
  },
}));

// Le plateau a ses propres tests : ici on vérifie ce que le défi lui passe
vi.mock("../fight/FightArena", () => ({
  default: (props: { highlightInstanceId?: string }) => (
    <div data-testid="arena" data-target={props.highlightInstanceId} />
  ),
}));

import PuzzlePlayRoute from "./PuzzlePlay";

const reward: PuzzleReward = {
  firstSolve: true,
  gold: 120,
  xp: 80,
  booster: false,
  streak: { current: 4, longest: 6, nextBoosterIn: 3 },
};

function puzzleState(over: Partial<PuzzleState> = {}): PuzzleState {
  return {
    puzzleId: 3,
    view: {
      phase: "main",
      isMyTurn: true,
      pendingChoice: null,
      me: { hand: [] },
    },
    objective: {
      type: PuzzleObjectiveType.DESTROY_MONSTER,
      targetInstanceId: "m-9",
      targetName: "Général Pipoulax",
    },
    outcome: "ongoing",
    test: false,
    ...over,
  } as unknown as PuzzleState;
}

function renderPlay(url = "/puzzle/play") {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/puzzle/play" element={<PuzzlePlayRoute />} />
          <Route path="/puzzle" element={<p>fiche du défi</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe("PuzzlePlay", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  beforeEach(() => {
    session.state = null;
    session.error = null;
    session.send.mockClear();
    session.restart.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("chargement : message de préparation", () => {
    renderPlay();
    expect(screen.getByText("Préparation du défi…")).toBeInTheDocument();
  });

  it("erreur de lancement : message et retour à la fiche", () => {
    session.error = "Aucun défi aujourd'hui.";
    renderPlay();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Aucun défi aujourd'hui.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Quitter/ }));
    expect(screen.getByText("fiche du défi")).toBeInTheDocument();
  });

  it("en jeu : objectif, cible du plateau, recommencer", () => {
    session.state = puzzleState();
    renderPlay();
    expect(
      screen.getByText("Détruis Général Pipoulax ce tour"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("arena")).toHaveAttribute("data-target", "m-9");
    fireEvent.click(screen.getByRole("button", { name: /Recommencer/ }));
    expect(session.restart).toHaveBeenCalledTimes(1);
  });

  it("fin du tour : confirmation puis un end_phase par étape", () => {
    session.state = puzzleState();
    renderPlay();
    fireEvent.click(screen.getByRole("button", { name: "Fin du tour" }));
    expect(session.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    // main -> battle -> end -> fin du tour
    expect(session.send).toHaveBeenCalledTimes(3);
    expect(session.send).toHaveBeenCalledWith({ type: "end_phase" });
  });

  it("fin du tour : annuler n'envoie rien", () => {
    session.state = puzzleState();
    renderPlay();
    fireEvent.click(screen.getByRole("button", { name: "Fin du tour" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(session.send).not.toHaveBeenCalled();
  });

  it("fin du tour désactivé hors de mon tour", () => {
    const base = puzzleState();
    session.state = { ...base, view: { ...base.view, isMyTurn: false } };
    renderPlay();
    expect(screen.getByRole("button", { name: "Fin du tour" })).toBeDisabled();
  });

  it("erreur serveur en cours de partie : toast", () => {
    session.state = puzzleState();
    session.error = "Action impossible.";
    renderPlay();
    expect(screen.getByText("Action impossible.")).toHaveClass("fp-toast--err");
  });

  it("résolu : écran de fin après 900 ms, requêtes invalidées", () => {
    vi.useFakeTimers();
    session.state = puzzleState({ outcome: "solved", reward });
    const { invalidate } = renderPlay();
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Défi résolu !")).toBeInTheDocument();
    // L'invalidation part de onState, appelé par le hook à la réception de l'état
    const { onState } = session.options as {
      onState: (s: PuzzleState) => void;
    };
    act(() => onState(session.state as PuzzleState));
    for (const key of [
      QUERY_KEYS.puzzleToday,
      QUERY_KEYS.profile,
      QUERY_KEYS.inventory,
      QUERY_KEYS.quests,
      QUERY_KEYS.achievements,
    ])
      expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it("déjà résolu : aucune invalidation", () => {
    vi.useFakeTimers();
    session.state = puzzleState({
      outcome: "solved",
      reward: { ...reward, firstSolve: false },
    });
    const { invalidate } = renderPlay();
    const { onState } = session.options as {
      onState: (s: PuzzleState) => void;
    };
    act(() => onState(session.state as PuzzleState));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("raté : écran de fin, recommencer relance la partie", () => {
    vi.useFakeTimers();
    session.state = puzzleState({ outcome: "failed" });
    renderPlay();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByText("Raté…")).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Recommencer" }).at(-1)!,
    );
    expect(session.restart).toHaveBeenCalled();
  });

  it("?test=<id> : session de test du défi demandé", () => {
    renderPlay("/puzzle/play?test=12");
    expect(session.options).toMatchObject({ puzzleId: 12 });
  });
});
