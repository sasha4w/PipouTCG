import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type TFunction } from "i18next";
import fr from "../../i18n/locales/fr.json";
import { getMonsterStatusEntries } from "../../features/fight/Zonerow/zoneRow.effects";
import { monster } from "../fixtures/monster";

describe("getMonsterStatusEntries — nouvelles protections", () => {
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

  it("affiche les trois drapeaux", () => {
    const labels = getMonsterStatusEntries(
      monster({
        combatImmune: true,
        supportDestroyImmune: true,
        ignoresTaunt: true,
      }),
      t,
    ).map((e) => e.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        fr.keywords.combatImmunity.name,
        fr.keywords.supportShield.name,
        fr.keywords.ignoreTaunt.name,
      ]),
    );
  });

  it("statuts Drakon", () => {
    const labels = getMonsterStatusEntries(
      monster({
        hatchCounter: 2,
        canEvolveThisTurn: true,
        evolutionJoker: true,
        instantEvolution: true,
      }),
      t,
    ).map((e) => e.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        fr.keywords.evolutionJoker.name,
        fr.keywords.instantEvolution.name,
        "Éclot dans 2 tours",
        "Peut évoluer ce tour",
      ]),
    );
  });
});

describe("getMonsterStatusEntries — Garde et renvoi", () => {
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
  const labels = (patch: Parameters<typeof monster>[0]) =>
    getMonsterStatusEntries(monster(patch), t).map((e) => String(e.label));

  it("en Garde depuis 1 tour : compteur 1/2 et contre-offensive +100", () => {
    const l = labels({ mode: "guard", guardTurns: 1 });
    expect(l.some((s) => s.includes("1/2"))).toBe(true);
    expect(l.some((s) => s.includes("+100"))).toBe(true);
  });

  it("en Garde depuis ce tour : pas encore de contre-offensive", () => {
    const l = labels({ mode: "guard", guardTurns: 0 });
    expect(l.some((s) => s.includes("0/2"))).toBe(true);
    expect(l.some((s) => s.includes("+"))).toBe(false);
  });

  it("en Attaque : rien sur la Garde", () => {
    expect(
      labels({ mode: "attack", guardTurns: 1 }).some((s) => s.includes("/2")),
    ).toBe(false);
  });

  it("vient de sortir de Garde : délai de retour", () => {
    expect(labels({ mode: "attack", guardCooldown: true })).toContain(
      fr.effects.status.guardCooldown,
    );
  });

  it("renvoi de 50 %", () => {
    expect(labels({ reflectPercent: 50 }).some((s) => s.includes("50 %"))).toBe(
      true,
    );
  });
});
