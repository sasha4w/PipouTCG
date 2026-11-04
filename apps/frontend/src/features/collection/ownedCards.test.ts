import { describe, expect, it } from "vitest";
import {
  ActionType,
  EffectTrigger,
  Rarity,
  type UsableCard,
} from "@pipou/shared";
import type { Card } from "../../services/card.service";
import type { UserCollection } from "../../services/user.service";
import {
  DEFAULT_QUICK_DESTROY,
  forgeInputs,
  forgeTargets,
  hasHighRarity,
  joinOwnedCards,
  quickDestroyPlan,
  refillForgeSelection,
  type OwnedCard,
} from "./ownedCards";

const card = (
  id: number,
  rarity: Rarity,
  setId = 1,
  extra: Partial<Card> = {},
) =>
  ({
    id,
    name: `c${id}`,
    rarity,
    cardSet: { id: setId, name: `s${setId}` },
    ...extra,
  }) as Card;

const owned = (c: Card, o: number, usable = o, locked = 0): OwnedCard => ({
  card: c,
  owned: o,
  usable,
  locked,
});

const collection = (entries: [number, number, number?][]): UserCollection =>
  ({
    sets: [
      {
        id: 1,
        name: "s1",
        owned: 0,
        total: 0,
        cards: entries.map(([id, quantity, lockedQuantity]) => ({
          id,
          quantity,
          lockedQuantity: lockedQuantity ?? 0,
        })),
      },
    ],
  }) as unknown as UserCollection;

describe("joinOwnedCards", () => {
  const catalog = [card(1, Rarity.COMMON), card(2, Rarity.COMMON)];
  it("met 0 pour une carte absente", () => {
    const [a] = joinOwnedCards(catalog, collection([]), []);
    expect(a).toMatchObject({ owned: 0, usable: 0, locked: 0 });
  });
  it("reprend owned et usable", () => {
    const usable: UsableCard[] = [
      { cardId: 1, owned: 5, usable: 2, lockedQuantity: 0 },
    ];
    const [a, b] = joinOwnedCards(catalog, collection([[1, 5]]), usable);
    expect(a).toMatchObject({ owned: 5, usable: 2 });
    expect(b.owned).toBe(0);
  });
  it("porte locked", () => {
    const usable: UsableCard[] = [
      { cardId: 1, owned: 5, usable: 3, lockedQuantity: 2 },
    ];
    const [a] = joinOwnedCards(catalog, collection([[1, 5, 2]]), usable);
    expect(a.locked).toBe(2);
  });
});

describe("quickDestroyPlan", () => {
  const c = card(1, Rarity.COMMON);
  const plan = (cards: OwnedCard[], opts = DEFAULT_QUICK_DESTROY) =>
    quickDestroyPlan(cards, opts);
  it("garde 3 : usable 2 sur 5 possédées -> 2", () => {
    expect(plan([owned(c, 5, 2)])[0].quantity).toBe(2);
  });
  it("garde 3 : 5 possédées usable 5 -> 2", () => {
    expect(plan([owned(c, 5, 5)])[0].quantity).toBe(2);
  });
  it("2 possédées -> absente", () => {
    expect(plan([owned(c, 2)])).toEqual([]);
  });
  it("usable 0 -> absente", () => {
    expect(plan([owned(c, 5, 0)])).toEqual([]);
  });
  it("rareté non cochée -> absente", () => {
    expect(plan([owned(card(2, Rarity.EPIC), 5)])).toEqual([]);
  });
  it("autre set -> absente", () => {
    expect(
      plan([owned(card(3, Rarity.COMMON, 2), 5)], {
        ...DEFAULT_QUICK_DESTROY,
        setId: 1,
      }),
    ).toEqual([]);
  });
  it("dust = quantité x valeur", () => {
    const l = plan([owned(card(4, Rarity.RARE), 5)])[0];
    expect(l.dust).toBe(2 * 10);
  });
  it("garde 1 : 5 usable 5 -> 4", () => {
    expect(
      plan([owned(c, 5)], { ...DEFAULT_QUICK_DESTROY, keep: 1 })[0].quantity,
    ).toBe(4);
  });
});

describe("forgeTargets / forgeInputs", () => {
  const all = [
    owned(card(1, Rarity.COMMON, 1), 3),
    owned(card(2, Rarity.UNCOMMON, 1), 0),
    owned(card(3, Rarity.UNCOMMON, 2), 0),
    owned(card(4, Rarity.RARE, 1), 0),
    owned(
      card(5, Rarity.UNCOMMON, 1, {
        effects: [
          {
            trigger: EffectTrigger.PASSIVE,
            actions: [{ type: ActionType.SUMMON_IF_ALL_ELEMENTS }],
          },
        ] as Card["effects"],
      }),
      0,
    ),
    owned(card(6, Rarity.LEGENDARY, 1), 1),
    owned(card(7, Rarity.SECRET, 1), 1),
    owned(card(8, Rarity.COMMON, 1), 2, 0),
    owned(card(9, Rarity.COMMON, 2), 1),
  ];
  it("forgeTargets", () => {
    const ids = forgeTargets(all, 1, Rarity.COMMON).map((o) => o.card.id);
    expect(ids).toEqual([2]);
  });
  it("forgeInputs sans verrou", () => {
    const ids = forgeInputs(all, null).map((o) => o.card.id);
    expect(ids).not.toContain(6);
    expect(ids).not.toContain(7);
    expect(ids).not.toContain(2);
    expect(ids).toContain(1);
  });
  it("forgeInputs avec verrou", () => {
    const ids = forgeInputs(all, { setId: 1, rarity: Rarity.COMMON }).map(
      (o) => o.card.id,
    );
    expect(ids).toEqual([1, 8]);
  });
});

describe("hasHighRarity", () => {
  const line = (r: Rarity) => ({ card: card(1, r), quantity: 1, dust: 1 });
  it("détecte épique+", () => {
    expect(hasHighRarity([line(Rarity.COMMON)])).toBe(false);
    expect(hasHighRarity([line(Rarity.COMMON), line(Rarity.EPIC)])).toBe(true);
    expect(hasHighRarity([line(Rarity.SECRET)])).toBe(true);
  });
});

describe("refillForgeSelection", () => {
  const c = (
    id: number,
    usable: number,
    rarity: Rarity = Rarity.COMMON,
    setId = 1,
  ) => owned(card(id, rarity, setId), usable + 1, usable);

  it("reprend d'abord les mêmes cartes, bornées par usable", () => {
    const cards = [c(1, 3), c(2, 1), c(3, 9), c(50, 0, Rarity.UNCOMMON)];
    const r = refillForgeSelection({ 1: 5, 2: 5 }, cards, 10, 50);
    expect(r.selection[1]).toBe(3);
    expect(r.selection[2]).toBe(1);
    expect(r.selection[3]).toBe(6);
    expect(r.complete).toBe(true);
  });

  it("complète par surplus décroissant", () => {
    const cards = [
      c(1, 2),
      c(2, 1),
      c(3, 4),
      c(4, 3),
      c(50, 0, Rarity.UNCOMMON),
    ];
    const r = refillForgeSelection({ 1: 2 }, cards, 6, 50);
    expect(r.selection).toEqual({ 1: 2, 3: 4 });
    const r2 = refillForgeSelection({ 1: 2 }, cards, 8, 50);
    expect(r2.selection).toEqual({ 1: 2, 3: 4, 4: 2 });
  });

  it("n'utilise jamais une autre rareté ou un autre set", () => {
    const cards = [
      c(1, 1),
      owned(card(2, Rarity.UNCOMMON), 9, 9),
      owned(card(3, Rarity.COMMON, 2), 9, 9),
    ];
    const r = refillForgeSelection({ 1: 1 }, cards, 3, 2);
    expect(r.selection).toEqual({ 1: 1 });
    expect(r.complete).toBe(false);
  });

  it("n'utilise pas la cible", () => {
    const cards = [c(1, 1), c(9, 9)];
    const r = refillForgeSelection({ 1: 1 }, cards, 3, 9);
    expect(r.selection).toEqual({ 1: 1 });
    expect(r.complete).toBe(false);
  });

  it("renvoie un résultat incomplet", () => {
    const r = refillForgeSelection({ 1: 4 }, [c(1, 2), c(2, 1)], 10, 99);
    expect(r.selection).toEqual({ 1: 2, 2: 1 });
    expect(r.complete).toBe(false);
  });
});
