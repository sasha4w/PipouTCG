import { describe, expect, it } from "vitest";
import {
  chargeRequirements,
  unmetChargeRequirements,
} from "../../features/fight/chargeRequirements";
import type { MonsterOnBoard } from "../../features/fight/fight.types";

const charge = (effects: unknown[]) =>
  ({ type: "support", supportType: "CHARGE", effects }) as never;

const extraction = charge([
  {
    trigger: "ON_CHARGED",
    condition: null,
    actions: [
      {
        type: "TRANSFER_HALF_ATK",
        target: "PLAYER",
        filter: { name: "Noyau", archetype: "pixelman" },
      },
    ],
  },
]);
const meditation = charge([
  {
    trigger: "ON_CHARGED",
    condition: null,
    actions: [
      { type: "FORCE_EVOLVE", target: "PLAYER", filter: { archetype: "dragon" } },
    ],
  },
]);
const alerte = charge([
  {
    trigger: "PASSIVE",
    condition: null,
    actions: [
      {
        type: "REQUIRES_CARD_ON_BOARD",
        target: "SELF",
        filter: { name: "Général Chatouille" },
      },
    ],
  },
  {
    trigger: "ON_CHARGED",
    condition: null,
    actions: [{ type: "GRANT_EXTRA_ATTACK", target: "ALL_ALLIES", value: 1 }],
  },
]);

const monster = (
  name: string,
  archetype: string,
  stage: string | null = null,
  ownerUserId?: number,
) =>
  ({
    instanceId: name,
    ownerUserId,
    card: { baseCard: { name, archetype, stage } },
  }) as unknown as MonsterOnBoard;

describe("conditions d'activation des Charges", () => {
  it("liste les conditions de chaque carte", () => {
    expect(chargeRequirements(extraction).map((r) => r.kind)).toEqual([
      "receiver",
    ]);
    expect(chargeRequirements(alerte).map((r) => r.kind)).toEqual([
      "card",
      "ally",
    ]);
  });

  it("Extraction sans Noyau : non remplie", () => {
    const board = [monster("Capitaine Gribouille", "pipou"), null];
    expect(unmetChargeRequirements(extraction, board, 1)).toHaveLength(1);
    board[1] = monster("Noyau Alpha", "pixelman");
    expect(unmetChargeRequirements(extraction, board, 1)).toHaveLength(0);
  });

  it("Méditation : un Œuf ou un Adulte ne suffit pas, un Bébé oui", () => {
    const board = [monster("Œuf Céleste", "dragon"), monster("Teros", "dragon", "adult")];
    expect(unmetChargeRequirements(meditation, board, 1)).toHaveLength(1);
    board.push(monster("Bébé Teros", "dragon", "baby"));
    expect(unmetChargeRequirements(meditation, board, 1)).toHaveLength(0);
  });

  it("un monstre implanté par l'adversaire ne compte pas", () => {
    const board = [monster("Noyau Zeta", "pixelman", null, 2)];
    expect(unmetChargeRequirements(extraction, board, 1)).toHaveLength(1);
  });

  it("une carte hors Charge n'a pas de condition", () => {
    expect(
      chargeRequirements({ type: "support", supportType: "PERSISTENT" }),
    ).toEqual([]);
  });
});
