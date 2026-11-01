import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { CardInstance } from "@pipou/shared";
import GraveyardPile from "../../features/fight/GraveyardPile";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

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
  it("affiche les cartes illustrées dans une feuille titrée", () => {
    render(<GraveyardPile graveyard={[dead]} label="Moi" onClose={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "Moi — Cimetière (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Squelette, 80 ATK, 200 PV" }),
    ).toBeInTheDocument();
  });

  it("un tap sélectionne la carte et i ouvre le tiroir", () => {
    render(<GraveyardPile graveyard={[dead]} label="Moi" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Squelette/ }));
    fireEvent.click(screen.getByRole("button", { name: "Informations" }));

    expect(
      screen.getByRole("dialog", { name: "Squelette" }),
    ).toBeInTheDocument();
  });

  it("la croix ferme la feuille", () => {
    const onClose = vi.fn();
    render(<GraveyardPile graveyard={[dead]} label="Moi" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));

    expect(onClose).toHaveBeenCalled();
  });
});
