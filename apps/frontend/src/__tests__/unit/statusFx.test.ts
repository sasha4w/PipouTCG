import { EFFECT_IMMUNITIES, Immunity } from "@pipou/shared";
import { describe, expect, it } from "vitest";
import { monster } from "../fixtures/monster";
import {
  overlayFx,
  statusFlags,
  statusRisingEdges,
} from "../../features/fight/statusFx";

describe("statusFlags", () => {
  it("vide sur un monstre sans état", () => {
    expect([...statusFlags(monster())]).toEqual([]);
  });

  it("freeze sans stun même si le sommeil d'invocation est vrai", () => {
    const flags = statusFlags(
      monster({
        blockAttackTurns: 2,
        summonedThisTurn: true,
        cannotAttackOnSummonTurn: true,
      }),
    );
    expect(flags.has("freeze")).toBe(true);
    expect(flags.has("stun")).toBe(false);
  });

  it("stun quand bloqué sans freeze", () => {
    const flags = statusFlags(
      monster({ summonedThisTurn: true, cannotAttackOnSummonTurn: true }),
    );
    expect(flags.has("stun")).toBe(true);
    expect(flags.has("freeze")).toBe(false);
  });

  it("regroupe les immunités et la charge", () => {
    const flags = statusFlags(
      monster({
        immunities: [Immunity.MONSTER_DEBUFF, Immunity.COMBAT_DAMAGE],
        reflectPercent: 50,
        doubleAtkNextTurn: true,
        attacksPerTurn: 2,
        damageReduction: 2,
      }),
    );
    expect(flags.has("monsterDebuffImmune")).toBe(true);
    expect(flags.has("immuneAll")).toBe(false);
    expect(flags.has("combatShield")).toBe(true);
    expect(flags.has("reflect")).toBe(true);
    expect(flags.has("charge")).toBe(true);
    expect(flags.has("reduce")).toBe(true);
  });

  it("distingue immunité monstre, support et totale", () => {
    const f = (o: object) => statusFlags(monster(o));
    expect(
      f({ immunities: [Immunity.SUPPORT_DEBUFF] }).has("supportDebuffImmune"),
    ).toBe(true);
    expect(
      f({ immunities: [Immunity.COMBAT_DESTRUCTION] }).has("combatEndure"),
    ).toBe(true);
    const all = f({ immunities: [...EFFECT_IMMUNITIES] });
    expect(all.has("immuneAll")).toBe(true);
    expect(all.has("monsterDebuffImmune")).toBe(false);
  });
});

describe("statusRisingEdges", () => {
  it("tous les flags d'un monstre invoqué", () => {
    expect(
      statusRisingEdges(null, monster({ hasTaunt: true, guardLocked: true })),
    ).toEqual(["guardLock", "taunt"]);
  });

  it("freeze 0 → N, pas 2 → 1", () => {
    const idle = monster();
    const frozen2 = monster({ blockAttackTurns: 2 });
    const frozen1 = monster({ blockAttackTurns: 1 });
    expect(statusRisingEdges(idle, frozen2)).toEqual(["freeze"]);
    expect(statusRisingEdges(frozen2, frozen1)).toEqual([]);
  });

  it("évolution (nouvel instanceId) rejoue les flags", () => {
    const before = monster({ instanceId: "a", hasTaunt: true });
    const after = monster({ instanceId: "b", hasTaunt: true });
    expect(statusRisingEdges(before, after)).toEqual(["taunt"]);
  });

  it("zone vide : rien", () => {
    expect(statusRisingEdges(monster({ hasTaunt: true }), null)).toEqual([]);
  });
});

describe("overlayFx", () => {
  it("garde Provocation, Bouclier et un seul état bloquant, par priorité", () => {
    expect(
      overlayFx(
        new Set([
          "guardLock",
          "stun",
          "freeze",
          "taunt",
          "combatShield",
          "piercing",
          "reflect",
        ]),
      ),
    ).toEqual(["taunt", "combatShield", "freeze"]);
    expect(overlayFx(new Set(["guardLock", "forcedAttack"]))).toEqual([
      "guardLock",
    ]);
  });

  it("rien à dessiner pour les effets passés en badges", () => {
    expect(overlayFx(new Set(["hatch", "evolve", "countdown"]))).toEqual([]);
  });
});
