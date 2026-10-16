import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CardInspect from "../../features/fight/CardInspect";
import type { CardFaceCard } from "../../features/cards/CardFace";

const card: CardFaceCard = {
  id: 3,
  name: "Ogre",
  rarity: "rare",
  type: "monster",
  atk: 200,
  hp: 800,
  cost: 4,
  description: "Écrase tout",
  image: null,
};

describe("CardInspect", () => {
  it("montre la grande carte, sa description et ses effets ouverts", () => {
    render(
      <CardInspect
        card={card}
        stats={{ atk: 250, hp: 600, atkState: "up", hpState: "down" }}
        entries={[
          { icon: "⚔", label: "Effets", type: "neutral", variant: "separator" },
          { icon: "🔥", label: "+50 ATK", type: "buff" },
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Ogre" })).toBeInTheDocument();
    expect(screen.getByText("Écrase tout")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
    expect(screen.getByText("+50 ATK")).toBeInTheDocument();
  });

  it("se ferme sur Échap et sur un tap hors de la carte", () => {
    const onClose = vi.fn();
    render(<CardInspect card={card} entries={[]} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ne se ferme pas sur un tap dans le panneau", () => {
    const onClose = vi.fn();
    render(<CardInspect card={card} entries={[]} onClose={onClose} />);

    fireEvent.click(screen.getByText("Écrase tout"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
