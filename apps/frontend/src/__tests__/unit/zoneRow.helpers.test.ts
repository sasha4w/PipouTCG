import { describe, expect, it } from "vitest";
import {
  hasSpentAttacks,
  monsterFaceStats,
} from "../../features/fight/Zonerow/zoneRow.helpers";
import { monster } from "../fixtures/monster";

describe("monsterFaceStats", () => {
  it("renvoie les stats de base sans état", () => {
    expect(monsterFaceStats(monster())).toEqual({
      atk: 100,
      hp: 500,
      atkState: undefined,
      hpState: undefined,
    });
  });

  it("additionne buffs permanents et temporaires d'ATK", () => {
    const stats = monsterFaceStats(monster({ atkBuff: 50, tempAtkBuff: 25 }));
    expect(stats.atk).toBe(175);
    expect(stats.atkState).toBe("up");
  });

  it("marque une ATK réduite en baisse", () => {
    expect(monsterFaceStats(monster({ atkBuff: -40 })).atkState).toBe("down");
  });

  it("marque des PV blessés en baisse, même buffés", () => {
    const stats = monsterFaceStats(monster({ hpBuff: 200, currentHp: 600 }));
    expect(stats.hp).toBe(600);
    expect(stats.hpState).toBe("down");
  });

  it("marque des PV buffés intacts en hausse", () => {
    expect(
      monsterFaceStats(monster({ hpBuff: 200, currentHp: 700 })).hpState,
    ).toBe("up");
  });
});

describe("hasSpentAttacks", () => {
  it("vrai quand toutes les attaques du tour sont utilisées", () => {
    expect(
      hasSpentAttacks(
        monster({ hasAttackedThisTurn: true, attacksUsedThisTurn: 1 }),
      ),
    ).toBe(true);
  });

  it("faux s'il reste une attaque", () => {
    expect(
      hasSpentAttacks(
        monster({
          hasAttackedThisTurn: true,
          attacksUsedThisTurn: 1,
          attacksPerTurn: 2,
        }),
      ),
    ).toBe(false);
  });
});
