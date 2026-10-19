import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type TFunction } from "i18next";
import {
  ActionType,
  Archetype,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
  type CardEffect,
} from "@pipou/shared";
import fr from "../../i18n/locales/fr.json";
import en from "../../i18n/locales/en.json";
import ko from "../../i18n/locales/ko.json";
import {
  KEYWORD_IDS,
  describeCardEffects,
  effectPlainText,
  type EffectSourceCard,
} from "../../features/fight/effectText";

const LOCALES = { fr, en, ko } as const;
type Lng = keyof typeof LOCALES;

/** Instance sans langue de repli : une clé manquante ressort telle quelle. */
async function makeT(lng: Lng): Promise<TFunction> {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    resources: { [lng]: { translation: LOCALES[lng] } },
    fallbackLng: false,
    interpolation: { escapeValue: false },
  });
  return instance.t;
}

const monster = (effects: CardEffect[], archetype = "pipou") =>
  ({ type: "monster", supportType: null, archetype, effects }) as const;
const support = (
  supportType: "EQUIPMENT" | "TERRAIN" | "EPHEMERAL",
  effects: CardEffect[],
) => ({ type: "support", supportType, archetype: null, effects }) as const;

describe("describeCardEffects (fr)", () => {
  it("valueIf : la quantité conditionnelle est rédigée", () => {
    const text = describeCardEffects(
      support("EPHEMERAL", [
        {
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
        },
      ]),
      t,
    );
    expect(text.rules[0].lines[0].text).toBe(
      "Tu récupères jusqu'à 2 cartes de ton cimetière (3 si une carte dont le nom contient « Capitaine » est sur ton terrain).",
    );
  });

  it("équipement : les trois nouvelles protections sont rédigées avec leur mot-clé", () => {
    const text = describeCardEffects(
      support("EQUIPMENT", [
        {
          trigger: "ON_PLAY",
          condition: null,
          actions: [{ type: "SET_COMBAT_IMMUNITY", target: "SELF" }],
        },
        {
          trigger: "PASSIVE",
          condition: null,
          actions: [
            { type: "SET_SUPPORT_DESTROY_IMMUNITY", target: "SELF" },
            { type: "IGNORE_TAUNT", target: "SELF" },
          ],
        },
      ]),
      t,
    );
    expect(text.keywords).toEqual([
      "combatImmunity",
      "supportShield",
      "ignoreTaunt",
    ]);
  });

  let t: TFunction;
  beforeAll(async () => {
    t = await makeT("fr");
  });

  it("Maraudeur Friponouille : Perçant à l'invocation, avec sa définition", () => {
    const text = describeCardEffects(
      monster([
        {
          trigger: "ON_SUMMON",
          condition: null,
          actions: [{ type: "SET_PIERCING", value: 1, target: "SELF" }],
        },
      ]),
      t,
    );

    expect(text.rules).toEqual([
      {
        icon: "✨",
        trigger: "À l'invocation",
        condition: null,
        lines: [{ text: "Ce monstre gagne **Perçant**.", tone: "buff" }],
      },
    ]);
    expect(text.keywords).toEqual(["piercing"]);
  });

  it("équipement : SELF désigne le porteur, la condition est lisible", () => {
    const text = describeCardEffects(
      support("EQUIPMENT", [
        {
          trigger: "PASSIVE",
          condition: { type: "EQUIPPED_ON", value: "Noyau Alpha" },
          actions: [{ type: "SET_TAUNT", target: "SELF" }],
        },
      ]),
      t,
    );

    expect(text.rules[0]).toMatchObject({
      trigger: "Tant que cette carte est équipée",
      condition: "Si elle est équipée sur « Noyau Alpha »",
      lines: [{ text: "Le monstre équipé gagne **Provocation**." }],
    });
  });

  it("terrain : accord au pluriel sur tes monstres", () => {
    const text = describeCardEffects(
      support("TERRAIN", [
        {
          trigger: "PASSIVE",
          actions: [{ type: "BUFF_ATK", value: 200, target: "ALL_ALLIES" }],
        },
      ]),
      t,
    );

    expect(text.rules[0].trigger).toBe("Tant que ce terrain est en jeu");
    expect(text.rules[0].lines[0].text).toBe("Tes monstres gagnent +200 ATK.");
  });

  it("récupération : le filtre du back est retranscrit", () => {
    const text = describeCardEffects(
      monster([
        {
          trigger: "ON_SUMMON",
          actions: [
            {
              type: "RETURN_FROM_GRAVEYARD",
              value: 2,
              target: "PLAYER",
              filter: { archetype: "pipou", rarities: ["common", "uncommon"] },
            },
          ],
        },
      ]),
      t,
    );

    expect(text.rules[0].lines[0].text).toBe(
      "Tu récupères jusqu'à 2 cartes de ton cimetière (Pipou · Commune / Peu commune).",
    );
  });

  it("valeurs par défaut du moteur quand value est absent", () => {
    const text = describeCardEffects(
      monster([
        {
          trigger: "PASSIVE",
          actions: [{ type: "SET_DAMAGE_REDUCTION", target: "SELF" }],
        },
      ]),
      t,
    );

    expect(text.rules[0].lines[0].text).toBe(
      "Ce monstre gagne **Réduction de dégâts** (÷2).",
    );
  });

  it("archétype : passif d'un monstre = ses autres alliés", () => {
    const text = describeCardEffects(
      monster(
        [
          {
            trigger: "PASSIVE",
            actions: [
              { type: "BUFF_HP", value: 300, target: "ARCHETYPE_ALLIES" },
            ],
          },
        ],
        "pixelman",
      ),
      t,
    );

    expect(text.rules[0].lines[0].text).toBe(
      "Tes autres monstres Pixelman gagnent +300 PV max.",
    );
  });

  it("une action inconnue reste visible au lieu de disparaître", () => {
    const text = describeCardEffects(
      monster([
        {
          trigger: "ON_SUMMON",
          actions: [
            { type: "TELEPORT" as ActionType, target: "SELF" as EffectTarget },
          ],
        },
      ]),
      t,
    );

    expect(text.rules[0].lines[0].text).toContain("TELEPORT");
  });

  it("une carte sans effet ne produit aucune règle", () => {
    expect(describeCardEffects(monster([]), t)).toEqual({
      rules: [],
      keywords: [],
    });
  });

  it("Jeune / Adulte Drakon : règle « uniquement par évolution » en tête", () => {
    const text = describeCardEffects(
      { ...monster([], "dragon"), stage: "adult" },
      t,
    );
    expect(text.rules[0].trigger).toBe("Invocation");
    expect(text.rules[0].lines[0].text).toBe(
      "Arrive en jeu uniquement par évolution ou par l'effet d'un Œuf.",
    );
    expect(
      describeCardEffects({ ...monster([], "dragon"), stage: "baby" }, t).rules,
    ).toEqual([]);
  });

  describe("équilibrage Zeta / Pixelman", () => {
    const all = (card: EffectSourceCard) =>
      describeCardEffects(card, t).rules.flatMap((r) => [
        r.trigger,
        ...r.lines.map((l) => l.text),
      ]);

    it("Noyau Zeta : explosion et virus", () => {
      const { rules } = describeCardEffects(
        monster(
          [
            {
              trigger: "PASSIVE",
              actions: [
                { type: "VIRUS_ATK_DEBUFF", target: "SELF", value: 300 },
              ],
            },
            {
              trigger: "ON_SELF_DESTRUCT",
              actions: [
                { type: "DEAL_DAMAGE", target: "ALL_ENEMIES", value: 500 },
              ],
            },
          ],
          "pixelman",
        ),
        t,
      );
      expect(rules[0].lines[0]).toEqual({
        text: "Les monstres adverses perdent 300 ATK.",
        tone: "debuff",
      });
      expect(rules[1].trigger).toBe("À son autodestruction");
      expect(rules[1].lines[0].text).toBe(
        "Tous les monstres adverses subissent 500 dégâts.",
      );
    });

    it("DuplicateX : copie sans attaque pendant 2 tours", () => {
      const texts = all(
        support("EPHEMERAL", [
          {
            trigger: "ON_PLAY",
            actions: [
              { type: "DUPLICATE_MONSTER", target: "TARGET_ALLY", value: 2 },
            ],
          },
        ]),
      );
      expect(texts[1]).toBe(
        "Le monstre allié ciblé est copié sur ta première zone libre ; la copie ne peut pas attaquer pendant 2 tours.",
      );
    });

    it("Mise à jour .patch : remet le compteur du Zeta", () => {
      const texts = all(
        support("EPHEMERAL", [
          {
            trigger: "ON_PLAY",
            actions: [
              { type: "RESET_TURN_COUNTER", target: "PLAYER", value: 3 },
            ],
          },
        ]),
      );
      expect(texts[1]).toBe("Remet le compteur de ton Zeta à 3.");
    });

    it("Firewall de Surcharge sur Zeta : protection contre la désinfection", () => {
      const texts = all(
        support("EQUIPMENT", [
          {
            trigger: "ON_PLAY",
            condition: { type: "EQUIPPED_ON", value: "Noyau Zeta" },
            actions: [{ type: "SET_DISINFECT_IMMUNITY", target: "SELF" }],
          },
        ]),
      );
      expect(texts[1]).toBe(
        "Le monstre équipé ne peut pas être désinfecté jusqu'au prochain tour de son poseur.",
      );
    });

    it("Module Bluetooth .v2 sur Zeta : virus d'équipement", () => {
      const texts = all(
        support("EQUIPMENT", [
          {
            trigger: "PASSIVE",
            actions: [{ type: "VIRUS_ATK_DEBUFF", target: "SELF", value: 600 }],
          },
        ]),
      );
      expect(texts[1]).toBe("Les monstres adverses perdent 600 ATK.");
    });

    it("aucune ligne inconnue", () => {
      for (const type of [
        ActionType.DUPLICATE_MONSTER,
        ActionType.VIRUS_ATK_DEBUFF,
        ActionType.RESET_TURN_COUNTER,
        ActionType.SET_DISINFECT_IMMUNITY,
      ])
        expect(
          all(
            support("EPHEMERAL", [
              { trigger: "ON_PLAY", actions: [{ type, target: "SELF" }] },
            ]),
          ).join(),
        ).not.toContain("Effet spécial");
    });
  });

  it("effectPlainText retire les marqueurs de mots-clés", () => {
    expect(effectPlainText("Ce monstre gagne **Perçant**.")).toBe(
      "Ce monstre gagne Perçant.",
    );
  });
});

describe.each(Object.keys(LOCALES) as Lng[])(
  "couverture complète (%s)",
  (lng) => {
    let t: TFunction;
    beforeAll(async () => {
      t = await makeT(lng);
    });

    const conditions = [
      null,
      { type: EffectConditionType.ARCHETYPE_ON_BOARD, value: "pipou" },
      { type: EffectConditionType.HP_BELOW, value: 300 },
      { type: EffectConditionType.HAND_SIZE_MIN, value: 1 },
      { type: EffectConditionType.HAND_SIZE_MIN, value: 3 },
      { type: EffectConditionType.OPPONENT_HAS_NO_MONSTERS },
      { type: EffectConditionType.SPECIFIC_CARD_ON_BOARD, value: "Noyau" },
      {
        type: EffectConditionType.SPECIFIC_CARD_ON_BOARD,
        value: "Noyau",
        match: "contains" as const,
      },
      { type: EffectConditionType.EQUIPPED_ON, value: "Noyau Beta" },
      {
        type: EffectConditionType.EQUIPPED_ON,
        value: "Noyau",
        match: "contains" as const,
      },
      { type: EffectConditionType.DRAKON_ON_BOARD, stage: "adult" as const },
      { type: EffectConditionType.DRAKON_ON_BOARD, element: "fire" as const },
      { type: EffectConditionType.EQUIPPED_ON, stage: "egg" as const },
    ];
    const cards: EffectSourceCard[] = [
      monster([]),
      support("EQUIPMENT", []),
      support("TERRAIN", []),
      support("EPHEMERAL", []),
    ];

    /** Texte non rédigé : clé brute, interpolation ratée ou `**` orphelin. */
    const isBroken = (s: string) =>
      /effects\.|keywords\.|rarity\.|filter\.|\{\{|\}\}|undefined|NaN/.test(
        s,
      ) || (s.match(/\*\*/g) ?? []).length % 2 !== 0;
    const assertClean = (s: string) => expect(isBroken(s), s).toBe(false);

    // Toutes les actions × cibles × valeurs (absente, singulier, pluriel)
    const allActions = Object.values(ActionType).flatMap((type) =>
      Object.values(EffectTarget).flatMap((target) =>
        [undefined, 1, 4].map((value) => ({
          type,
          target,
          value,
          filter: {
            archetype: Archetype.PIPOU,
            rarities: ["rare" as const],
            type: "support" as const,
            name: "Noyau",
            stage: "baby" as const,
            element: "water" as const,
          },
        })),
      ),
    );

    it("chaque déclencheur × condition a un texte, pour chaque type de carte", () => {
      const broken: string[] = [];
      for (const card of cards)
        for (const trigger of Object.values(EffectTrigger))
          for (const condition of conditions) {
            const { rules } = describeCardEffects(
              {
                ...card,
                effects: [
                  {
                    trigger,
                    condition,
                    actions: [{ type: "DRAW", target: "PLAYER" }],
                  },
                ],
              },
              t,
            );
            for (const s of [rules[0].trigger, rules[0].condition ?? ""])
              if (isBroken(s)) broken.push(s);
          }
      expect(broken).toEqual([]);
    });

    it("chaque action × cible × valeur a un texte, dans chaque contexte", () => {
      const broken: string[] = [];
      for (const card of cards)
        for (const trigger of ["ON_SUMMON", "PASSIVE", "ON_DEFEND"] as const) {
          const { rules } = describeCardEffects(
            { ...card, effects: [{ trigger, actions: allActions }] },
            t,
          );
          for (const line of rules[0].lines)
            if (isBroken(line.text)) broken.push(line.text);
        }
      expect(broken).toEqual([]);
    });

    it("chaque mot-clé a un nom et une définition", () => {
      for (const id of KEYWORD_IDS) {
        assertClean(t(`keywords.${id}.name`));
        assertClean(t(`keywords.${id}.desc`));
      }
    });

    it("chaque archétype a un libellé", () => {
      for (const a of Object.values(Archetype))
        assertClean(t(`effects.archetype.${a}`));
    });
  },
);
