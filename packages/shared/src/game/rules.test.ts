import { describe, expect, it } from "vitest";
import { Immunity } from "../enums/effect";
import { EFFECT_IMMUNITIES } from "./immunity";
import {
  canSummonFromHand,
  graveyardHasAllElements,
  canTransform,
  canEvolveNow,
  canEvolveOnto,
  evolutionCost,
  canImplantOn,
  canSummonOnEnemySide,
  isImplanted,
  ephemeralTargetSide,
  isTargetableByEphemeral,
} from "./rules";
import type { CardEffect } from "./effect";

describe("ephemeralTargetSide", () => {
  it("détecte une cible adverse", () => {
    expect(
      ephemeralTargetSide([
        {
          trigger: "ON_PLAY",
          actions: [{ type: "DESTROY_MONSTER", target: "ENEMY_MONSTER" }],
        },
      ]),
    ).toBe("enemy");
  });

  it("détecte une cible alliée", () => {
    expect(
      ephemeralTargetSide([
        {
          trigger: "ON_PLAY",
          actions: [{ type: "HEAL", target: "TARGET_ALLY", value: 600 }],
        },
      ]),
    ).toBe("ally");
  });

  it("ignore les effets hors ON_PLAY et les cibles collectives", () => {
    expect(
      ephemeralTargetSide([
        {
          trigger: "PASSIVE",
          actions: [{ type: "HEAL", target: "TARGET_ALLY" }],
        },
        {
          trigger: "ON_PLAY",
          actions: [{ type: "BUFF_ATK_TEMP", target: "ALL_ALLIES" }],
        },
      ]),
    ).toBeNull();
  });
});

describe("canSummonOnEnemySide", () => {
  it("vrai seulement avec le passif SUMMONABLE_ON_ENEMY_SIDE", () => {
    expect(
      canSummonOnEnemySide([
        {
          trigger: "PASSIVE",
          actions: [{ type: "SUMMONABLE_ON_ENEMY_SIDE", target: "SELF" }],
        },
      ]),
    ).toBe(true);
    expect(canSummonOnEnemySide(null)).toBe(false);
  });
});

describe("isImplanted", () => {
  it("vrai si le poseur n'est pas l'hôte", () => {
    expect(isImplanted({ ownerUserId: 1 }, 2)).toBe(true);
    expect(isImplanted({}, 2)).toBe(false);
    expect(isImplanted({ ownerUserId: 2 }, 2)).toBe(false);
  });
});

describe("canImplantOn", () => {
  it("un seul monstre implanté par poseur sur un terrain", () => {
    expect(canImplantOn([null, { ownerUserId: 1 }, null], 1)).toBe(false);
    expect(canImplantOn([null, null, null], 1)).toBe(true);
    expect(canImplantOn([null, { ownerUserId: 1 }, null], 2)).toBe(true);
    expect(canImplantOn([{}, null, null], 1)).toBe(true);
  });
});

describe("isTargetableByEphemeral", () => {
  const destroy = (target: "ENEMY_MONSTER" | "ALLY_MONSTER"): CardEffect[] => [
    {
      trigger: "ON_PLAY",
      actions: [{ type: "DESTROY_MONSTER", target }],
    },
  ];
  const damage: CardEffect[] = [
    {
      trigger: "ON_PLAY",
      actions: [{ type: "DEAL_DAMAGE", target: "ENEMY_MONSTER", value: 100 }],
    },
  ];
  const shielded = { immunities: [Immunity.SUPPORT_DESTRUCTION] };

  it("refuse un monstre protégé pour un Éphémère destructeur", () => {
    expect(
      isTargetableByEphemeral(shielded, "enemy", destroy("ENEMY_MONSTER")),
    ).toBe(false);
    expect(
      isTargetableByEphemeral(shielded, "ally", destroy("ALLY_MONSTER")),
    ).toBe(false);
  });

  it("accepte un monstre protégé pour un Éphémère non destructeur", () => {
    expect(isTargetableByEphemeral(shielded, "enemy", damage)).toBe(true);
  });

  it("refuse un monstre insensible aux effets adverses côté ennemi seulement", () => {
    const magouille = { immunities: [...EFFECT_IMMUNITIES] };
    expect(isTargetableByEphemeral(magouille, "enemy", damage)).toBe(false);
    expect(isTargetableByEphemeral(magouille, "ally", damage)).toBe(true);
  });
});

const drakon = (stage: "egg" | "baby" | "young" | "adult", lineage: string | null, cost: number) => ({
  stage,
  lineage,
  cost,
});
const onBoard = (
  card: ReturnType<typeof drakon>,
  flags: { evolutionJoker?: boolean; summonedThisTurn?: boolean; instantEvolution?: boolean; canEvolveThisTurn?: boolean } = {},
) => ({ card: { baseCard: card }, summonedThisTurn: false, ...flags });

describe("évolution des Drakons", () => {
  it("même lignée, stade suivant", () => {
    expect(canEvolveOnto(drakon("young", "feros", 2), onBoard(drakon("baby", "feros", 1)))).toBe(true);
    expect(canEvolveOnto(drakon("adult", "feros", 3), onBoard(drakon("young", "feros", 2)))).toBe(true);
  });

  it("refuse une autre lignée ou un saut de stade", () => {
    expect(canEvolveOnto(drakon("young", "teros", 2), onBoard(drakon("baby", "feros", 1)))).toBe(false);
    expect(canEvolveOnto(drakon("adult", "feros", 3), onBoard(drakon("baby", "feros", 1)))).toBe(false);
    expect(canEvolveOnto(drakon("baby", "feros", 1), onBoard(drakon("baby", "feros", 1)))).toBe(false);
  });

  it("le joker accepte un Jeune de toute lignée, pas un Adulte", () => {
    const egg = onBoard(drakon("egg", null, 1), { evolutionJoker: true });
    expect(canEvolveOnto(drakon("young", "ackos", 2), egg)).toBe(true);
    expect(canEvolveOnto(drakon("adult", "ackos", 3), egg)).toBe(false);
  });

  it("coût = différence, jamais négatif", () => {
    expect(evolutionCost(drakon("young", "feros", 2), onBoard(drakon("baby", "feros", 1)))).toBe(1);
    expect(evolutionCost(drakon("young", "feros", 1), onBoard(drakon("egg", null, 2)))).toBe(0);
  });

  it("délai : pas le tour de pose, sauf accélérateur", () => {
    expect(canEvolveNow({ summonedThisTurn: true })).toBe(false);
    expect(canEvolveNow({ summonedThisTurn: false })).toBe(true);
    expect(canEvolveNow({ summonedThisTurn: true, instantEvolution: true })).toBe(true);
    expect(canEvolveNow({ summonedThisTurn: true, canEvolveThisTurn: true })).toBe(true);
  });
});

describe("invocation depuis la main", () => {
  it("Jeunes et Adultes Drakon n'arrivent que par évolution", () => {
    expect(canSummonFromHand({ stage: "young" })).toBe(false);
    expect(canSummonFromHand({ stage: "adult" })).toBe(false);
  });

  it("Bébés, Œufs et monstres sans stade s'invoquent normalement", () => {
    expect(canSummonFromHand({ stage: "baby" })).toBe(true);
    expect(canSummonFromHand({ stage: "egg" })).toBe(true);
    expect(canSummonFromHand({ stage: null })).toBe(true);
  });
});

describe("canTransform", () => {
  it("vrai pour un Jeune ou un Adulte avec lignée", () => {
    expect(canTransform({ stage: "young", lineage: "feros" })).toBe(true);
    expect(canTransform({ stage: "adult", lineage: "feros" })).toBe(true);
  });

  it("faux pour Bébé, Œuf, monstre non-Drakon et Jeune sans lignée", () => {
    expect(canTransform({ stage: "baby", lineage: "feros" })).toBe(false);
    expect(canTransform({ stage: "egg", lineage: "feros" })).toBe(false);
    expect(canTransform({ stage: null, lineage: null })).toBe(false);
    expect(canTransform({ stage: null })).toBe(false);
    expect(canTransform({ stage: "young", lineage: null })).toBe(false);
  });
});

describe("isTargetableByEphemeral — cibles qui profitent de l'effet", () => {
  // Incubation Rapide : avance l'éclosion ou autorise l'évolution ce tour
  const incubation: CardEffect[] = [
    {
      trigger: "ON_PLAY",
      actions: [
        { type: "ADVANCE_HATCH", target: "TARGET_ALLY", value: 2 },
        { type: "ALLOW_EVOLUTION_THIS_TURN", target: "TARGET_ALLY" },
      ],
    },
  ];
  const drakon = (
    stage: "egg" | "baby" | "young" | null,
    flags: { summonedThisTurn?: boolean; hatchCounter?: number; instantEvolution?: boolean } = {},
  ) => ({
    summonedThisTurn: false,
    card: { baseCard: { stage } },
    ...flags,
  });

  it("un Œuf qui éclot est une cible", () => {
    expect(isTargetableByEphemeral(drakon("egg", { hatchCounter: 2 }), "ally", incubation)).toBe(true);
  });

  it("un Drakon posé ce tour est une cible (il ne pouvait pas évoluer)", () => {
    expect(isTargetableByEphemeral(drakon("baby", { summonedThisTurn: true }), "ally", incubation)).toBe(true);
  });

  it("un Drakon qui peut déjà évoluer n'est pas une cible", () => {
    expect(isTargetableByEphemeral(drakon("baby"), "ally", incubation)).toBe(false);
    expect(
      isTargetableByEphemeral(drakon("baby", { summonedThisTurn: true, instantEvolution: true }), "ally", incubation),
    ).toBe(false);
  });

  it("un monstre qui n'est pas un Drakon n'est pas une cible", () => {
    expect(isTargetableByEphemeral(drakon(null, { summonedThisTurn: true }), "ally", incubation)).toBe(false);
  });

  it("les autres Éphémères ciblés ne sont pas concernés", () => {
    const soin: CardEffect[] = [
      { trigger: "ON_PLAY", actions: [{ type: "HEAL", target: "TARGET_ALLY", value: 600 }] },
    ];
    expect(isTargetableByEphemeral(drakon(null), "ally", soin)).toBe(true);
  });
});

describe("stade ancestral", () => {
  const card = (stage: string, lineage: string, cost = 3) =>
    ({ stage, lineage, cost }) as never;
  const base = (stage: string, lineage: string) =>
    ({ card: { baseCard: { stage, lineage, cost: 3 } } }) as never;

  it("un Ancestral évolue sur l'Adulte de sa lignée seulement", () => {
    expect(canEvolveOnto(card("ancestral", "feros", 4), base("adult", "feros"))).toBe(true);
    expect(canEvolveOnto(card("ancestral", "feros", 4), base("adult", "teros"))).toBe(false);
    expect(canEvolveOnto(card("ancestral", "feros", 4), base("young", "feros"))).toBe(false);
  });

  it("ne se pose pas depuis la main, mais se transforme", () => {
    expect(canSummonFromHand({ stage: "ancestral" })).toBe(false);
    expect(canTransform({ stage: "ancestral", lineage: "feros" })).toBe(true);
  });
});

describe("graveyardHasAllElements", () => {
  const c = (stage: string, element: string) => ({ stage, element }) as never;

  it("vrai avec un Adulte ou un Ancestral de chaque élément", () => {
    expect(
      graveyardHasAllElements([
        c("adult", "earth"),
        c("ancestral", "fire"),
        c("adult", "water"),
        c("adult", "wind"),
      ]),
    ).toBe(true);
  });

  it("faux avec 3 éléments", () => {
    expect(
      graveyardHasAllElements([c("adult", "earth"), c("adult", "fire"), c("adult", "water")]),
    ).toBe(false);
  });

  it("faux si l'élément manquant n'a qu'un Bébé", () => {
    expect(
      graveyardHasAllElements([
        c("adult", "earth"),
        c("adult", "fire"),
        c("adult", "water"),
        c("baby", "wind"),
      ]),
    ).toBe(false);
  });
});

describe("immunités par source", () => {
  const freeze = [
    {
      trigger: "ON_PLAY",
      actions: [{ type: "BLOCK_ATTACK", target: "ENEMY_MONSTER", value: 1 }],
    },
  ] as never;
  const kill = [
    {
      trigger: "ON_PLAY",
      actions: [{ type: "DESTROY_MONSTER", target: "ENEMY_MONSTER" }],
    },
  ] as never;
  it("débuff support bloque le gel, pas la destruction", () => {
    const teros = {
      immunities: [Immunity.SUPPORT_DEBUFF, Immunity.MONSTER_DEBUFF],
    };
    expect(isTargetableByEphemeral(teros, "enemy", freeze)).toBe(false);
    expect(isTargetableByEphemeral(teros, "enemy", kill)).toBe(true);
    const ancestral = {
      immunities: [...teros.immunities, Immunity.SUPPORT_DESTRUCTION],
    };
    expect(isTargetableByEphemeral(ancestral, "enemy", kill)).toBe(false);
  });
});
