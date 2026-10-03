import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CardInstance } from "@pipou/shared";
import MulliganPanel from "../../features/fight/MulliganPanel";

const card = (name: string): CardInstance => ({
  instanceId: name,
  ownerId: 1,
  baseCard: {
    id: 1,
    name,
    rarity: "common",
    type: "monster",
    atk: 100,
    hp: 500,
    cost: 1,
    supportType: null,
    archetype: null,
    effects: null,
    description: null,
    image: null,
  },
});

describe("MulliganPanel", () => {
  it("affiche la main et transmet la décision", async () => {
    const onDecide = vi.fn();
    render(
      <MulliganPanel
        hand={[card("Gobelin"), card("Ogre")]}
        decided={false}
        opponentDecided={false}
        opponentName="Bob"
        onDecide={onDecide}
      />,
    );

    expect(screen.getByText("Gobelin")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Mulligan/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Garder cette main" }),
    );

    expect(onDecide.mock.calls).toEqual([[true], [false]]);
  });

  it("attend l'adversaire une fois la décision prise", () => {
    render(
      <MulliganPanel
        hand={[]}
        decided
        opponentDecided={false}
        opponentName="Bob"
        onDecide={vi.fn()}
      />,
    );

    expect(screen.getByText("En attente de Bob…")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
