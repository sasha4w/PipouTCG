import { describe, expect, it } from "vitest";
import {
  ActionType,
  CardType,
  ChargeMode,
  EffectTarget,
  EffectTrigger,
  EquipmentSlot,
  Rarity,
  SupportType,
  type CardEffect,
} from "@pipou/shared";
import type { Card } from "../../services/card.service";
import {
  emptyForm,
  formProblems,
  fromCard,
  toCardPayload,
} from "../../features/cards/card-form/cardPayload";

const base = { ...emptyForm, name: "Test", cardSetId: 1 };

describe("toCardPayload", () => {
  it("monster sends no support field", () => {
    const out = toCardPayload({
      ...base,
      type: CardType.MONSTER,
      supportType: SupportType.CHARGE,
      chargeMax: 3,
      equipmentSlot: EquipmentSlot.OFFENSIVE,
      isTerrain: true,
    });
    expect(out.supportType).toBeUndefined();
    expect(out.chargeMax).toBeUndefined();
    expect(out.equipmentSlot).toBeUndefined();
    expect(out.isTerrain).toBeUndefined();
  });

  it.each<[SupportType, string[]]>([
    [SupportType.EQUIPMENT, ["equipmentSlot"]],
    [SupportType.PERSISTENT, ["isTerrain"]],
    [SupportType.CHARGE, ["chargeMax", "chargeMode"]],
    [SupportType.EPHEMERAL, []],
  ])("%s keeps only its own fields", (st, kept) => {
    const out = toCardPayload({
      ...base,
      type: CardType.SUPPORT,
      supportType: st,
      equipmentSlot: EquipmentSlot.OFFENSIVE,
      isTerrain: true,
      chargeMax: 3,
      chargeMode: ChargeMode.ONE_SHOT,
    });
    for (const f of ["equipmentSlot", "isTerrain", "chargeMax", "chargeMode"])
      expect(out[f as keyof typeof out] !== undefined).toBe(kept.includes(f));
  });
});

describe("fromCard", () => {
  const effects: CardEffect[] = [
    {
      trigger: EffectTrigger.ON_SUMMON,
      actions: [
        {
          type: ActionType.DEAL_DAMAGE,
          target: EffectTarget.ENEMY_MONSTER,
          value: 1,
          filter: { excludeName: "X" },
          valueIf: {
            condition: { type: "DRAKON_ON_BOARD" },
            value: 2,
          },
        },
      ],
    },
  ];
  const card = {
    id: 1,
    name: "Carte",
    description: "Lore",
    rarity: Rarity.RARE,
    type: CardType.MONSTER,
    atk: 1,
    hp: 2,
    cost: 1,
    cardSet: { id: 4, name: "S" },
    effects,
  } as Card;

  it("round-trips effects untouched", () => {
    expect(toCardPayload(fromCard(card)).effects).toEqual(effects);
  });

  it("edits keep lore", () => {
    expect(toCardPayload(fromCard(card)).description).toBe("Lore");
  });
});

describe("formProblems", () => {
  it("requires a name and a set", () => {
    expect(formProblems(emptyForm).length).toBe(2);
    expect(formProblems(base)).toEqual([]);
  });

  it("requires a support subtype and an equipment slot", () => {
    const support = { ...base, type: CardType.SUPPORT };
    expect(formProblems(support)).toHaveLength(1);
    expect(
      formProblems({ ...support, supportType: SupportType.EQUIPMENT }),
    ).toHaveLength(1);
    expect(
      formProblems({
        ...support,
        supportType: SupportType.EQUIPMENT,
        equipmentSlot: EquipmentSlot.ACCESSORY,
      }),
    ).toEqual([]);
  });

  it("flags effects whose trigger no longer fits", () => {
    const form = {
      ...base,
      type: CardType.SUPPORT,
      supportType: SupportType.PERSISTENT,
      effects: [
        {
          trigger: EffectTrigger.ON_ATTACK,
          actions: [
            { type: ActionType.DRAW, target: EffectTarget.PLAYER, value: 1 },
          ],
        },
      ],
    };
    expect(formProblems(form)).toHaveLength(1);
    expect(form.effects).toHaveLength(1);
  });
});
