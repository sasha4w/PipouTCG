import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import CardInspect, {
  type InspectCard,
} from "../../features/fight/CardInspect";

const card: InspectCard = {
  id: 3,
  name: "Ogre",
  rarity: "rare",
  type: "monster",
  atk: 200,
  hp: 800,
  cost: 4,
  description: "Écrase tout",
  image: null,
  archetype: null,
  effects: [
    {
      trigger: "ON_SUMMON",
      condition: null,
      actions: [{ type: "SET_TAUNT", target: "SELF" }],
    },
  ],
};

describe("CardInspect", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("montre la grande carte, sa description et son effet rédigé", () => {
    render(
      <CardInspect
        card={card}
        stats={{ atk: 250, hp: 600, atkState: "up", hpState: "down" }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Ogre" })).toBeInTheDocument();
    expect(screen.getAllByText("Écrase tout")).toHaveLength(1);
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(
      screen.getByText("Provocation", { selector: "strong" }),
    ).toBeInTheDocument();
  });

  it("ajoute l'état en direct et les équipements d'un monstre en jeu", () => {
    render(
      <CardInspect
        card={card}
        status={[{ icon: "🗡", label: "Perçant", type: "buff" }]}
        equipments={[
          {
            ...card,
            id: 9,
            name: "Épée",
            type: "support",
            supportType: "EQUIPMENT",
            effects: [
              {
                trigger: "PASSIVE",
                actions: [{ type: "BUFF_ATK", value: 100, target: "SELF" }],
              },
            ],
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Perçant")).toBeInTheDocument();
    expect(screen.getByText(/Épée/)).toBeInTheDocument();
    expect(
      screen.getByText("Le monstre équipé gagne +100 ATK."),
    ).toBeInTheDocument();
  });

  it("n'affiche ni récap de stats ni « Aucun effet » : seulement les statuts actifs", () => {
    render(
      <CardInspect
        card={{ ...card, effects: null }}
        status={[
          { icon: "⚔️", label: "100 base", type: "neutral", variant: "recap" },
          { icon: "🧊", label: "Gelé encore 2 tours", type: "debuff" },
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText("100 base")).not.toBeInTheDocument();
    expect(screen.queryByText("Aucun effet")).not.toBeInTheDocument();
    expect(screen.getByText("Gelé encore 2 tours")).toBeInTheDocument();
  });

  it("sans statut ni effet : aucune fiche sous la carte", () => {
    const { container } = render(
      <CardInspect card={{ ...card, effects: null }} onClose={vi.fn()} />,
    );
    expect(container.ownerDocument.querySelector(".ces")).toBeNull();
    expect(screen.queryByText("Aucun effet")).not.toBeInTheDocument();
  });

  it("se ferme sur Échap et sur un tap hors de la carte", () => {
    const onClose = vi.fn();
    render(<CardInspect card={card} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ne se ferme pas sur un tap dans le panneau", () => {
    const onClose = vi.fn();
    render(<CardInspect card={card} onClose={onClose} />);

    fireEvent.click(screen.getByText("Écrase tout"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
