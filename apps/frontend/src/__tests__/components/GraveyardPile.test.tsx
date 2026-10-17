import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CardInstance } from "@pipou/shared";
import GraveyardPile from "../../features/fight/GraveyardPile";

const dead: CardInstance = {
  instanceId: "d1",
  ownerId: 1,
  baseCard: {
    id: 4,
    name: "Squelette",
    rarity: "uncommon",
    type: "monster",
    atk: 80,
    hp: 200,
    cost: 1,
    supportType: null,
    archetype: null,
    element: null,
    lineage: null,
    stage: null,
    effects: null,
    description: "Revient parfois",
    image: null,
  },
};

describe("GraveyardPile", () => {
  it("ouvre le cimetière avec les cartes illustrées", () => {
    render(<GraveyardPile graveyard={[dead]} label="Moi" />);

    fireEvent.click(screen.getByTitle("Cimetière (1)"));

    expect(
      screen.getByRole("button", { name: "Squelette, 80 ATK, 200 PV" }),
    ).toBeInTheDocument();
  });

  it("le clic droit inspecte la carte", () => {
    render(<GraveyardPile graveyard={[dead]} label="Moi" />);
    fireEvent.click(screen.getByTitle("Cimetière (1)"));

    fireEvent.contextMenu(screen.getByRole("button", { name: /Squelette/ }));

    expect(
      screen.getByRole("dialog", { name: "Squelette" }),
    ).toBeInTheDocument();
  });
});
