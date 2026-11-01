import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type TFunction } from "i18next";
import type { CardEffect } from "@pipou/shared";
import fr from "../../i18n/locales/fr.json";
import { effectSummary } from "../../features/fight/effectText";

let t: TFunction;

beforeAll(async () => {
  const instance = i18next.createInstance();
  await instance.init({
    lng: "fr",
    resources: { fr: { translation: fr } },
    fallbackLng: false,
    interpolation: { escapeValue: false },
  });
  t = instance.t;
});

const ephemeral = (effects: CardEffect[]) =>
  ({
    type: "support",
    supportType: "EPHEMERAL",
    archetype: null,
    effects,
  }) as const;

const longEffect: CardEffect = {
  trigger: "ON_PLAY",
  condition: null,
  actions: [
    {
      type: "RETURN_FROM_GRAVEYARD",
      target: "PLAYER",
      value: 2,
      valueIf: {
        condition: {
          type: "SPECIFIC_CARD_ON_BOARD",
          value: "Capitaine",
          match: "contains",
        },
        value: 3,
      },
    },
  ],
};

describe("effectSummary", () => {
  it("un effet long tient sur 90 caractères au plus et finit par …", () => {
    const s = effectSummary(ephemeral([longEffect]), t);
    expect(s.length).toBeLessThanOrEqual(90);
    expect(s.endsWith("…")).toBe(true);
    expect(s.startsWith("Tu récupères jusqu'à 2 cartes")).toBe(true);
  });

  it("un effet court n'est pas tronqué et ne garde aucun marqueur de mot-clé", () => {
    const s = effectSummary(
      ephemeral([
        {
          trigger: "ON_PLAY",
          condition: null,
          actions: [{ type: "SET_COMBAT_IMMUNITY", target: "SELF" }],
        },
      ]),
      t,
    );
    expect(s).not.toContain("**");
    expect(s.endsWith("…")).toBe(false);
    expect(s.length).toBeGreaterThan(0);
  });

  it("sans effet, le résumé est vide", () => {
    expect(effectSummary(ephemeral([]), t)).toBe("");
    expect(
      effectSummary({ type: "monster", archetype: "pipou", effects: null }, t),
    ).toBe("");
  });

  it("la règle de pose d'un Jeune n'est pas un effet", () => {
    expect(
      effectSummary(
        { type: "monster", archetype: "drakon", stage: "young", effects: [] },
        t,
      ),
    ).toBe("");
  });
});
