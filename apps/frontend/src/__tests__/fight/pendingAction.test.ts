import { describe, expect, it } from "vitest";
import {
  confirmText,
  type PendingAction,
} from "../../features/fight/pendingAction";

const ctx = {
  handNames: ["Goblin", "Rat", "Chat", "Loup"],
  cost: 2,
  reserve: 0,
  locale: "fr",
};

describe("confirmText", () => {
  it("invocation avec recyclage de deux cartes", () => {
    const a: PendingAction = {
      kind: "summon",
      handIndex: 0,
      zoneIndex: 1,
      payIndices: [1, 2],
    };
    expect(confirmText(a, ctx)).toEqual({
      key: "fight.confirm.summonRecycling",
      params: { card: "Goblin", recycled: "Rat et Chat" },
    });
  });

  it("invocation sans recyclage", () => {
    const a: PendingAction = {
      kind: "summon",
      handIndex: 0,
      zoneIndex: 1,
      payIndices: [],
    };
    expect(confirmText(a, { ...ctx, cost: 0 })).toEqual({
      key: "fight.confirm.summon",
      params: { card: "Goblin" },
    });
  });

  it("surplus : avertissement avec l'énergie en trop", () => {
    const a: PendingAction = {
      kind: "summon",
      handIndex: 0,
      zoneIndex: 1,
      payIndices: [1, 2, 3],
    };
    expect(confirmText(a, { ...ctx, cost: 2, reserve: 1 }).warning).toEqual({
      key: "fight.confirm.surplus",
      params: { count: 2 },
    });
  });

  it("pas d'avertissement quand le paiement est exact", () => {
    const a: PendingAction = {
      kind: "summon",
      handIndex: 0,
      zoneIndex: 1,
      payIndices: [1, 2],
    };
    expect(confirmText(a, ctx).warning).toBeUndefined();
  });

  it("recycler une carte", () => {
    expect(confirmText({ kind: "recycle", handIndex: 2 }, ctx)).toEqual({
      key: "fight.confirm.recycle",
      params: { card: "Chat" },
    });
  });

  it("évolution : carte et cible", () => {
    const a: PendingAction = {
      kind: "evolve",
      handIndex: 0,
      targetInstanceId: "bebe",
      payIndices: [],
    };
    expect(confirmText(a, { ...ctx, cost: 0, targetName: "Bébé Feros" })).toEqual(
      {
        key: "fight.confirm.evolve",
        params: { card: "Goblin", target: "Bébé Feros" },
      },
    );
  });

  it("transformer, jouer et défausser ont chacun leur clé", () => {
    expect(confirmText({ kind: "transform", handIndex: 3 }, ctx).key).toBe(
      "fight.confirm.transform",
    );
    expect(confirmText({ kind: "playSupport", handIndex: 3 }, ctx).key).toBe(
      "fight.confirm.play",
    );
    expect(confirmText({ kind: "discard", handIndex: 3 }, ctx).key).toBe(
      "fight.confirm.discard",
    );
  });
});
