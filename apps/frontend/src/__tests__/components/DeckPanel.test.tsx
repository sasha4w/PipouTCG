import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CardInstance } from "@pipou/shared";
import DeckPanel from "../../features/sandbox/DeckPanel";

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

function renderPanel() {
  const onCommand = vi.fn();
  render(
    <DeckPanel
      seat="p2"
      deck={[card("A"), card("B"), card("C")]}
      hand={[card("Main1")]}
      onCommand={onCommand}
    />,
  );
  return onCommand;
}

describe("DeckPanel", () => {
  it("remonte une carte en prochaine pioche", async () => {
    const onCommand = renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "Mettre C en prochaine pioche" }),
    );

    expect(onCommand).toHaveBeenCalledWith({
      type: "move_card",
      seat: "p2",
      instanceId: "C",
      to: { zone: "deck", index: 0 },
    });
  });

  it("prend une carte du deck en main, et remet une carte de la main sur le deck", async () => {
    const onCommand = renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "Prendre B en main" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remettre Main1 sur le deck" }),
    );

    expect(onCommand).toHaveBeenNthCalledWith(1, {
      type: "move_card",
      seat: "p2",
      instanceId: "B",
      to: { zone: "hand" },
    });
    expect(onCommand).toHaveBeenNthCalledWith(2, {
      type: "move_card",
      seat: "p2",
      instanceId: "Main1",
      to: { zone: "deck", index: 0 },
    });
  });

  it("réordonne le deck par glisser-déposer", () => {
    const onCommand = renderPanel();
    const deck = screen.getByRole("list", {
      name: "Deck dans l'ordre de pioche",
    });
    const [a, , c] = within(deck).getAllByRole("listitem");

    fireEvent.dragStart(a);
    fireEvent.dragOver(c);
    fireEvent.drop(c);

    expect(onCommand).toHaveBeenCalledWith({
      type: "move_card",
      seat: "p2",
      instanceId: "A",
      to: { zone: "deck", index: 2 },
    });
  });
});
