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
  return { zones: row.querySelectorAll(".zr-zone"), onEvolve, select, props };
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

  it("un Jeune sélectionné ne peut pas se poser sur une zone vide", () => {
    const { zones, props } = renderBoard(state(5));
    expect(zones[2]).not.toHaveClass("zr-zone--pulse-target");
    fireEvent.click(zones[2]);
    expect(props.onSetSelectedZone).not.toHaveBeenCalled();
    expect(props.onSummon).not.toHaveBeenCalled();
  });

  it("clic sur un monstre non éligible : pas d'évolution", () => {
    const { zones, onEvolve } = renderBoard(state(5));
    fireEvent.click(zones[1]);
    expect(onEvolve).not.toHaveBeenCalled();
  });
});

// ─── Noyau Zeta : implantation, désinfection, équipement ─────────────────────

const zetaCard = (): CardInstance["baseCard"] => ({
  ...monster().card.baseCard,
  id: 99,
  name: "Noyau Zeta",
  cost: 0,
  effects: [
    {
      trigger: "PASSIVE",
      actions: [{ type: "SUMMONABLE_ON_ENEMY_SIDE" }],
    },
  ] as unknown as CardInstance["baseCard"]["effects"],
});

const equipmentCard = (): CardInstance["baseCard"] => ({
  ...monster().card.baseCard,
  id: 50,
  name: "Épée",
  type: "support",
  supportType: "EQUIPMENT",
  atk: 0,
  hp: 0,
});

const PROTECTED = "Protégé jusqu'au prochain tour adverse";

/** Mon terrain héberge un Zeta posé par l'adversaire (userId 2). */
function zetaState(opts: {
  phase?: GameState["phase"];
  immune?: boolean;
  hand?: CardInstance["baseCard"][];
  mineOnOpp?: boolean;
}): GameState {
  const gs = state(0);
  gs.phase = opts.phase ?? "battle";
  gs.me.hand = (opts.hand ?? []).map((b, i) => ({
    instanceId: `h${i}`,
    ownerId: 1,
    baseCard: b,
  }));
  gs.me.monsterZones = [
    monster({ instanceId: "atk" }),
    monster({
      instanceId: "zeta",
      ownerUserId: 2,
      disinfectImmune: opts.immune ?? false,
    }),
    null,
  ];
  if (opts.mineOnOpp) {
    gs.opponent.monsterZones = [
      monster({ instanceId: "monZeta", ownerUserId: 1 }),
      null,
      null,
    ];
  }
  return gs;
}

function renderZeta(
  gs: GameState,
  over: Partial<ComponentProps<typeof FightBoard>> = {},
) {
  const props: ComponentProps<typeof FightBoard> = {
    gs,
    selectedCard: null,
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
    onEvolve: vi.fn(),
    onPlaySupport: vi.fn(),
    onChangeMode: vi.fn(),
    onRecycleSupport: vi.fn(),
    onDiscardCard: vi.fn(),
    onEndPhase: vi.fn(),
    ...over,
  };
  render(<FightBoard {...props} />);
  const mine = screen
    .getByText("Mes Monstres")
    .closest(".zr-wrap")!
    .querySelectorAll(".zr-zone");
  const theirs = screen
    .getByText("Adversaire — Monstres")
    .closest(".zr-wrap")!
    .querySelectorAll(".zr-zone");
  return { props, mine, theirs };
}

describe("FightBoard — Noyau Zeta", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("désinfecter : le Zeta implanté chez moi est une cible d'attaque", () => {
    const { props, mine } = renderZeta(zetaState({}), { selectedZone: 0 });
    expect(mine[1]).toHaveClass("zr-zone--attack-target");
    fireEvent.click(mine[1]);
    expect(props.onAttackMonster).toHaveBeenCalledWith("zeta");
  });

  it("désinfection refusée tant que le Zeta est protégé", () => {
    const { props, mine } = renderZeta(zetaState({ immune: true }), {
      selectedZone: 0,
    });
    expect(mine[1]).not.toHaveClass("zr-zone--attack-target");
    expect(mine[1]).toHaveAttribute("aria-disabled", "true");
    expect(mine[1]).toHaveAttribute("title", PROTECTED);
    expect(screen.getByText(PROTECTED)).toBeInTheDocument();
    fireEvent.click(mine[1]);
    expect(props.onAttackMonster).not.toHaveBeenCalled();
  });

  it("sans attaquant sélectionné, le Zeta n'est pas une cible", () => {
    const { mine } = renderZeta(zetaState({}));
    expect(mine[1]).not.toHaveClass("zr-zone--attack-target");
  });

  it("le Zeta implanté chez moi ne peut pas être choisi comme attaquant", () => {
    const { props, mine } = renderZeta(zetaState({}));
    fireEvent.click(mine[1]);
    expect(props.onSetSelectedZone).not.toHaveBeenCalled();
    fireEvent.click(mine[0]);
    expect(props.onSetSelectedZone).toHaveBeenCalledWith(0);
  });

  it("le Zeta implanté chez moi n'a pas de changement de mode", () => {
    const { mine } = renderZeta(zetaState({ phase: "main" }));
    expect(mine[0].querySelector(".zr-mode-btns")).not.toBeNull();
    expect(mine[1].querySelector(".zr-mode-btns")).toBeNull();
  });

  it("avec un équipement, mon Zeta chez l'adversaire est une cible", () => {
    const { props, mine, theirs } = renderZeta(
      zetaState({ phase: "main", hand: [equipmentCard()], mineOnOpp: true }),
      { selectedCard: 0 },
    );
    expect(theirs[0]).toHaveClass("zr-zone--pulse-equipment");
    expect(theirs[1]).not.toHaveClass("zr-zone--pulse-equipment");
    fireEvent.click(theirs[0]);
    expect(props.onPlaySupport).toHaveBeenCalledWith(0, undefined, "monZeta");
    // le Zeta implanté chez moi ne s'équipe pas
    expect(mine[1]).not.toHaveClass("zr-zone--pulse-equipment");
    fireEvent.click(mine[1]);
    expect(props.onPlaySupport).toHaveBeenCalledTimes(1);
  });

  it("je n'attaque pas mon propre Zeta chez l'adversaire", () => {
    const { props, theirs } = renderZeta(zetaState({ mineOnOpp: true }), {
      selectedZone: 0,
    });
    fireEvent.click(theirs[0]);
    expect(props.onAttackMonster).not.toHaveBeenCalled();
  });

  it("poser Zeta : zones adverses vides ciblables", () => {
    const { props, theirs } = renderZeta(
      zetaState({ phase: "main", hand: [zetaCard()] }),
      { selectedCard: 0 },
    );
    expect(theirs[0]).toHaveClass("zr-zone--zeta-target");
    fireEvent.click(theirs[0]);
    expect(props.onSummonZeta).toHaveBeenCalledWith(0);
  });

  it("poser Zeta désactivé s'il y en a déjà un chez l'adversaire", () => {
    const { props, theirs } = renderZeta(
      zetaState({ phase: "main", hand: [zetaCard()], mineOnOpp: true }),
      { selectedCard: 0 },
    );
    expect(theirs[1]).not.toHaveClass("zr-zone--zeta-target");
    fireEvent.click(theirs[1]);
    expect(props.onSummonZeta).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Un Zeta est déjà implanté chez l'adversaire/),
    ).toBeInTheDocument();
  });
});
