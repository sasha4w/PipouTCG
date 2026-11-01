import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
      transformUsedThisTurn: false,
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

function renderBoard(
  gs: GameState,
  onEvolve = vi.fn(),
  extra: Partial<ComponentProps<typeof FightBoard>> = {},
) {
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
    onSummonReleve: vi.fn(),
    onEvolve,
    onPlaySupport: vi.fn(),
    onChangeMode: vi.fn(),
    onRecycleSupport: vi.fn(),
    onTransform: vi.fn(),
    onDiscardCard: vi.fn(),
    onEndPhase: vi.fn(),
    ...extra,
  };
  const { rerender } = render(<FightBoard {...props} />);
  const row = screen.getByText("Mes Monstres").closest(".zr-wrap")!;
  const select = (selectedCard: number | null) =>
    rerender(<FightBoard {...props} selectedCard={selectedCard} />);
  return {
    zones: row.querySelectorAll(".zr-zone"),
    onEvolve,
    select,
    props,
    rerender,
  };
}

describe("FightBoard — transformation", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("carte Jeune sélectionnée : « Transformer » demande confirmation puis envoie", () => {
    const { props } = renderBoard(state(0));
    fireEvent.click(screen.getByRole("button", { name: /^Transformer$/ }));
    expect(props.onTransform).not.toHaveBeenCalled();
    expect(screen.getByText("Transformer Jeune Feros ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(props.onTransform).toHaveBeenCalledWith(0);
  });

  it("grisé si la transformation est déjà utilisée ce tour", () => {
    const gs = state(0);
    gs.me.transformUsedThisTurn = true;
    const { props } = renderBoard(gs);
    const btn = screen.getByRole("button", { name: /Transformer/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(props.onTransform).not.toHaveBeenCalled();
  });

  it("absent pour une carte non transformable", () => {
    const { select } = renderBoard(state(0));
    select(1);
    expect(
      screen.queryByRole("button", { name: /Transformer/ }),
    ).not.toBeInTheDocument();
  });
});

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

  it("évolution payée par l'énergie : confirmation, puis envoi", () => {
    const { zones, onEvolve } = renderBoard(state(1));
    fireEvent.click(zones[0]);
    expect(onEvolve).not.toHaveBeenCalled();
    expect(
      screen.getByText("Faire évoluer Bébé Feros en Jeune Feros ?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(onEvolve).toHaveBeenCalledWith("bebe", []);
  });

  it("coût restant sans carte recyclée : message d'énergie manquante, rien d'envoyé", () => {
    const { zones, onEvolve } = renderBoard(state(0, 3));
    fireEvent.click(zones[0]);
    expect(onEvolve).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // coût d'évolution 3 − 1 = 2
    expect(screen.getByText("Il manque 2 énergie")).toBeInTheDocument();
  });

  it("changer de carte sélectionnée abandonne l'évolution en attente", () => {
    const { zones, onEvolve, select } = renderBoard(state(1));
    fireEvent.click(zones[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    select(null);
    select(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
    onSummonReleve: vi.fn(),
    onEvolve: vi.fn(),
    onPlaySupport: vi.fn(),
    onChangeMode: vi.fn(),
    onRecycleSupport: vi.fn(),
    onTransform: vi.fn(),
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
    expect(props.onPlaySupport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
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
    expect(props.onSummonZeta).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(props.onSummonZeta).toHaveBeenCalledWith(0, []);
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

describe("FightBoard : Relève", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("zone occupée par un allié Pipou : son allié est sacrifié d'office", () => {
    const soldat = (id: string) =>
      monster({
        instanceId: id,
        card: {
          instanceId: id,
          ownerId: 1,
          baseCard: {
            ...monster().card.baseCard,
            name: `Soldat ${id}`,
            archetype: "pipou",
          },
        },
      });
    const gs = state(0);
    gs.me.hand = [
      {
        instanceId: "chef",
        ownerId: 1,
        baseCard: {
          ...monster().card.baseCard,
          name: "Chef",
          cost: 3,
          archetype: "pipou",
          effects: [
            {
              trigger: "PASSIVE",
              condition: null,
              actions: [{ type: "RELEVE", target: "SELF", value: 2 }],
            },
          ],
        },
      },
    ];
    gs.me.monsterZones = [soldat("A"), soldat("B"), soldat("C")];
    const { zones, props } = renderBoard(gs, vi.fn(), { selectedZone: 1 });
    fireEvent.click(zones[1]);
    const modal = within(document.querySelector<HTMLElement>(".scm-modal")!);
    expect(
      modal.getByText(i18n.t("fight.releve.hint", { count: 2 })),
    ).toBeInTheDocument();
    // L'allié de la zone est déjà coché : un second suffit
    fireEvent.click(modal.getByText("Soldat A"));
    fireEvent.click(
      modal.getByRole("button", { name: i18n.t("fight.releve.confirm") }),
    );
    expect(props.onSummonReleve).toHaveBeenCalledWith(1, ["B", "A"]);
  });
});

// ─── Confirmation de toute action de carte, recyclage rapide ─────────────────

const named = (name: string, cost = 1): CardInstance["baseCard"] => ({
  ...monster().card.baseCard,
  name,
  cost,
  archetype: null,
  effects: null,
});

/** Main : Gobelin (à invoquer) puis Rat, Chat, Loup ; zone 2 libre. */
function recycleState(opts: { cost: number; energy?: number }): GameState {
  const gs = state(opts.energy ?? 0);
  gs.me.hand = [
    named("Gobelin", opts.cost),
    named("Rat"),
    named("Chat"),
    named("Loup"),
  ].map((b, i) => ({ instanceId: `h${i}`, ownerId: 1, baseCard: b }));
  return gs;
}

describe("FightBoard — cadre de l'app", () => {
  it("seul, il ne masque pas l'en-tête ni le pied de page (bac à sable)", () => {
    renderBoard(recycleState({ cost: 2 }));
    expect(document.body).not.toHaveClass("in-fight");
  });
});

describe("FightBoard — confirmations et recyclage rapide", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("deux cartes recyclées : confirmation détaillée, puis invocation", () => {
    const { zones, props } = renderBoard(recycleState({ cost: 2 }), vi.fn(), {
      payIndices: [1, 2],
    });
    fireEvent.click(zones[2]);
    expect(props.onSummon).not.toHaveBeenCalled();
    expect(
      screen.getByText("Invoquer Gobelin en recyclant Rat et Chat ?"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(props.onSummon).toHaveBeenCalledWith([1, 2], 2);
  });

  it("énergie en trop : l'avertissement l'indique", () => {
    const { zones } = renderBoard(recycleState({ cost: 2 }), vi.fn(), {
      payIndices: [1, 2, 3],
    });
    fireEvent.click(zones[2]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 énergie en trop, gardée en réserve",
    );
  });

  it("énergie insuffisante : pas de confirmation, message de manque", () => {
    const { zones, props } = renderBoard(recycleState({ cost: 3 }), vi.fn(), {
      payIndices: [1],
    });
    fireEvent.click(zones[2]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Il manque 2 énergie")).toBeInTheDocument();
    expect(props.onSummon).not.toHaveBeenCalled();
  });

  it("invocation gratuite : confirmation quand même, envoi après Confirmer", () => {
    const gs = recycleState({ cost: 4 });
    gs.me.freeSummonInstanceIds = ["h0"];
    const { zones, props } = renderBoard(gs);
    fireEvent.click(zones[2]);
    expect(props.onSummon).not.toHaveBeenCalled();
    expect(screen.getByText("Invoquer Gobelin ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(props.onSummon).toHaveBeenCalledWith([], 2);
  });

  it("un double appui sur Confirmer n'invoque qu'une fois", () => {
    const gs = recycleState({ cost: 4 });
    gs.me.freeSummonInstanceIds = ["h0"];
    const { zones, props } = renderBoard(gs);
    fireEvent.click(zones[2]);
    const confirm = screen.getByRole("button", { name: "Confirmer" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(props.onSummon).toHaveBeenCalledTimes(1);
  });

  it("Recycler demande confirmation ; Annuler n'envoie rien", () => {
    const { props } = renderBoard(recycleState({ cost: 2 }));
    fireEvent.click(screen.getByRole("button", { name: /^Recycler$/ }));
    expect(screen.getByText("Recycler Gobelin ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(props.onRecycleSupport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Recycler$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(props.onRecycleSupport).toHaveBeenCalledWith(0);
  });

  it("toucher la carte à invoquer annule toute la sélection", () => {
    const { props } = renderBoard(recycleState({ cost: 2 }), vi.fn(), {
      payIndices: [1],
    });
    const hand = within(document.querySelector<HTMLElement>(".fhand")!);
    fireEvent.click(hand.getByRole("button", { name: /Gobelin/ }));
    expect(props.onSetSelectedCard).toHaveBeenCalledWith(null);
    expect(props.onSetPayIndices).toHaveBeenCalledWith([]);
  });

  it("la confirmation disparaît sans rien envoyer quand le tour change", () => {
    const gs = recycleState({ cost: 4 });
    gs.me.freeSummonInstanceIds = ["h0"];
    const { zones, props, rerender } = renderBoard(gs);
    fireEvent.click(zones[2]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const next = recycleState({ cost: 4 });
    next.me.freeSummonInstanceIds = ["h0"];
    next.isMyTurn = false;
    rerender(<FightBoard {...props} gs={next} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onSummon).not.toHaveBeenCalled();
  });

  it("menu des phases : Finir le tour envoie trois changements de phase", () => {
    const { props } = renderBoard(recycleState({ cost: 2 }));
    fireEvent.click(screen.getByText("Principale"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Finir le tour" }));
    expect(props.onEndPhase).toHaveBeenCalledTimes(3);
  });

  it("main trop pleine : Finir le tour est grisé et n'envoie rien", () => {
    const gs = recycleState({ cost: 2 });
    gs.me.hand = [
      ...gs.me.hand,
      ...[1, 2, 3, 4].map((i) => ({
        instanceId: `x${i}`,
        ownerId: 1,
        baseCard: named(`Extra${i}`),
      })),
    ];
    const { props } = renderBoard(gs);
    fireEvent.click(screen.getByText("Principale"));
    const item = screen.getByRole("menuitem", { name: /Finir le tour/ });
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(props.onEndPhase).not.toHaveBeenCalled();
  });
});
