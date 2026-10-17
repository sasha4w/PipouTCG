import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { CardInstance } from "@pipou/shared";
import FightBoard from "../../features/fight/FightBoard";
import type { GameState } from "../../features/fight/fight.types";
import { monster } from "../fixtures/monster";
import i18n from "../../i18n";

const drakon = (
  stage: "baby" | "young",
  cost: number,
): CardInstance["baseCard"] => ({
  ...monster().card.baseCard,
  name: stage === "baby" ? "Bébé Feros" : "Jeune Feros",
  lineage: "feros",
  stage,
  cost,
});

const base = monster({
  instanceId: "bebe",
  card: { instanceId: "bebe", ownerId: 1, baseCard: drakon("baby", 1) },
});

function state(recycleEnergy: number, youngCost = 2): GameState {
  return {
    matchId: 1,
    phase: "main",
    turnNumber: 3,
    isMyTurn: true,
    me: {
      userId: 1,
      username: "moi",
      primes: 3,
      hand: [
        {
          instanceId: "jeune",
          ownerId: 1,
          baseCard: drakon("young", youngCost),
        },
        { instanceId: "autre", ownerId: 1, baseCard: monster().card.baseCard },
      ],
      deckCount: 10,
      graveyard: [],
      banished: [],
      monsterZones: [base, monster({ instanceId: "gob" }), null],
      supportZones: [null, null, null],
      recycleEnergy,
      freeSummonInstanceIds: [],
      mulliganDone: true,
    },
    opponent: {
      userId: 2,
      username: "lui",
      primes: 3,
      handCount: 3,
      deckCount: 10,
      graveyard: [],
      banished: [],
      monsterZones: [null, null, null],
      supportZones: [null, null, null],
      mulliganDone: true,
    },
    log: [],
    events: [],
    opponentChoosing: false,
  } as GameState;
}

function renderBoard(gs: GameState, onEvolve = vi.fn()) {
  const props: ComponentProps<typeof FightBoard> = {
    gs,
    selectedCard: 0,
    selectedZone: null,
    payIndices: [],
    timeLeft: null,
    onSetSelectedCard: vi.fn(),
    onSetSelectedZone: vi.fn(),
    onSetPayIndices: vi.fn(),
    onAttackMonster: vi.fn(),
    onDirectAttack: vi.fn(),
    onSummon: vi.fn(),
    onSummonZeta: vi.fn(),
    onEvolve,
    onPlaySupport: vi.fn(),
    onChangeMode: vi.fn(),
    onRecycleSupport: vi.fn(),
    onDiscardCard: vi.fn(),
    onEndPhase: vi.fn(),
  };
  const { rerender } = render(<FightBoard {...props} />);
  const row = screen.getByText("Mes Monstres").closest(".zr-wrap")!;
  const select = (selectedCard: number | null) =>
    rerender(<FightBoard {...props} selectedCard={selectedCard} />);
  return { zones: row.querySelectorAll(".zr-zone"), onEvolve, select };
}

describe("FightBoard — évolution", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("ne surligne que les monstres sur lesquels la carte peut évoluer", () => {
    const { zones } = renderBoard(state(5));
    expect(zones[0]).toHaveClass("zr-zone--pulse-equipment");
    expect(zones[1]).not.toHaveClass("zr-zone--pulse-equipment");
    expect(
      screen.getByText("Touche un de tes monstres pour évoluer"),
    ).toBeInTheDocument();
  });

  it("évolution payée par l'énergie : envoi direct, sans fenêtre", () => {
    const { zones, onEvolve } = renderBoard(state(1));
    fireEvent.click(zones[0]);
    expect(onEvolve).toHaveBeenCalledWith("bebe", []);
    expect(screen.queryByText(/Évolution —/)).not.toBeInTheDocument();
  });

  it("coût restant : fenêtre de paiement d'évolution, puis envoi", () => {
    const { zones, onEvolve } = renderBoard(state(0, 3));
    fireEvent.click(zones[0]);
    expect(onEvolve).not.toHaveBeenCalled();
    expect(screen.getByText(/Évolution — Jeune Feros/)).toBeInTheDocument();
    // coût d'évolution 3 − 1 = 2
    expect(screen.getByText("0/2")).toBeInTheDocument();
  });

  it("changer de carte sélectionnée abandonne l'évolution en attente", () => {
    const { zones, onEvolve, select } = renderBoard(state(0, 3));
    fireEvent.click(zones[0]);
    expect(screen.getByText(/Évolution — Jeune Feros/)).toBeInTheDocument();
    select(null);
    select(0);
    expect(screen.queryByText(/Évolution —/)).not.toBeInTheDocument();
    expect(onEvolve).not.toHaveBeenCalled();
  });

  it("clic sur un monstre non éligible : pas d'évolution", () => {
    const { zones, onEvolve } = renderBoard(state(5));
    fireEvent.click(zones[1]);
    expect(onEvolve).not.toHaveBeenCalled();
  });
});
