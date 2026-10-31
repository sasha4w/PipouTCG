import { Immunity } from "@pipou/shared";
import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type TFunction } from "i18next";
import fr from "../../i18n/locales/fr.json";
import { monster } from "../fixtures/monster";
import {
  immunityQuarters,
  immunityText,
  monsterBadges,
  splitBadges,
} from "../../features/fight/statusBadges";

const ids = (patch: Parameters<typeof monster>[0]) =>
  monsterBadges(monster(patch)).map((b) => b.id);

describe("monsterBadges", () => {
  it("aucun badge sur un monstre sans état", () => {
    expect(ids({})).toEqual([]);
  });

  it("respecte l'ordre d'affichage", () => {
    expect(
      ids({
        mode: "guard",
        evolutionJoker: true,
        turnCounter: 3,
        hatchCounter: 2,
        immunities: [Immunity.MONSTER_DEBUFF, Immunity.COMBAT_DESTRUCTION],
        ignoresTaunt: true,
        hasPiercing: true,
        doubleAtkNextTurn: true,
        damageReduction: 2,
        reflectPercent: 30,
      }),
    ).toEqual([
      "guard",
      "endure",
      "reflect",
      "reduce",
      "attacks",
      "piercing",
      "ignoreTaunt",
      "immunity",
      "hatch",
      "countdown",
      "evolve",
    ]);
  });

  it("compte les attaques restantes, ou 2 pour la double attaque", () => {
    const [left] = monsterBadges(
      monster({ attacksPerTurn: 3, attacksUsedThisTurn: 1 }),
    );
    expect(left).toEqual({ id: "attacks", count: 2 });
    expect(ids({ attacksPerTurn: 2, attacksUsedThisTurn: 2 })).toEqual([]);
    expect(monsterBadges(monster({ doubleAtkNextTurn: true }))[0].count).toBe(2);
  });

  it("met en avant un compteur au bord de l'échéance", () => {
    const [hatch, countdown] = monsterBadges(
      monster({ hatchCounter: 1, turnCounter: 2 }),
    );
    expect(hatch.urgent).toBe(true);
    expect(countdown.urgent).toBe(false);
  });
});

describe("splitBadges", () => {
  it("3 badges visibles, le reste compté", () => {
    const badges = monsterBadges(
      monster({
        hasPiercing: true,
        ignoresTaunt: true,
        reflectPercent: 10,
        hatchCounter: 2,
        evolutionJoker: true,
      }),
    );
    const { shown, hidden } = splitBadges(badges);
    expect(shown.map((b) => b.id)).toEqual(["reflect", "piercing", "ignoreTaunt"]);
    expect(hidden).toBe(2);
  });
});

describe("immunités aux effets", () => {
  let t: TFunction;
  beforeAll(async () => {
    const i = i18next.createInstance();
    await i.init({
      lng: "fr",
      resources: { fr: { translation: fr } },
      fallbackLng: false,
    });
    t = i.t;
  });

  it("un quart par immunité, dans l'ordre du bouclier", () => {
    expect(
      immunityQuarters(
        monster({
          immunities: [Immunity.MONSTER_STATUS, Immunity.SUPPORT_DESTRUCTION],
        }),
      ),
    ).toEqual([true, false, false, true]);
  });

  it("liste les immunités partielles", () => {
    expect(immunityText([false, true, true, false], t, "fr")).toBe(
      "Insensible à : les malus de Support et les malus de Monstre",
    );
  });

  it("toutes : immunité totale", () => {
    expect(immunityText([true, true, true, true], t, "fr")).toBe(
      fr.keywords.debuffImmunity.name,
    );
  });
});
