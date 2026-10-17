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
