import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CardFace, { type CardFaceCard } from "../../features/cards/CardFace";

const gobelin: CardFaceCard = {
  id: 7,
  name: "Gobelin",
  rarity: "epic",
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 2,
  description: "Frappe fort",
  image: null,
};

describe("CardFace", () => {
  it("porte la rareté et les stats de base", () => {
    const { container } = render(<CardFace card={gobelin} size="xs" />);

    expect(container.querySelector(".card-face")).toHaveAttribute(
      "data-rarity",
      "epic",
    );
    expect(screen.getByText("Gobelin")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("colore les stats courantes en hausse et en baisse", () => {
    render(
      <CardFace
        card={gobelin}
        size="xs"
        stats={{ atk: 300, hp: 200, atkState: "up", hpState: "down" }}
      />,
    );

    expect(screen.getByText("300").closest(".card-face__stat-badge")).toHaveClass(
      "card-face__stat-badge--up",
    );
    expect(screen.getByText("200").closest(".card-face__stat-badge")).toHaveClass(
      "card-face__stat-badge--down",
    );
  });

  it("affiche la garde et l'état « a attaqué »", () => {
    const { container } = render(
      <CardFace card={gobelin} size="xs" guard spent />,
    );

    const root = container.querySelector(".card-face");
    expect(root).toHaveClass("card-face--guard");
    expect(root).toHaveClass("card-face--spent");
    expect(screen.getByText("a attaqué")).toBeInTheDocument();
  });

  it("montre l'illustration, ou le placeholder sans image", () => {
    const { rerender } = render(<CardFace card={gobelin} size="sm" />);
    expect(screen.getByText("✦")).toBeInTheDocument();

    rerender(
      <CardFace
        card={{ ...gobelin, image: { url: "https://cdn.test/g.png" } }}
        size="sm"
      />,
    );
    expect(screen.getByRole("img", { name: "Gobelin" })).toHaveAttribute(
      "src",
      "https://cdn.test/g.png",
    );
  });

  it("n'affiche la description qu'en md/lg avec showDescription", () => {
    const { rerender } = render(
      <CardFace card={gobelin} size="xs" showDescription />,
    );
    expect(screen.queryByText("Frappe fort")).not.toBeInTheDocument();

    rerender(<CardFace card={gobelin} size="md" />);
    expect(screen.queryByText("Frappe fort")).not.toBeInTheDocument();

    rerender(<CardFace card={gobelin} size="md" showDescription />);
    expect(screen.getByText("Frappe fort")).toBeInTheDocument();
  });

  it("affiche le type d'une carte support sans stats", () => {
    render(
      <CardFace
        card={{ ...gobelin, type: "support", supportType: "EQUIPMENT" }}
        size="xs"
      />,
    );

    expect(screen.getByText("Équipement")).toBeInTheDocument();
    expect(screen.queryByText("ATK")).not.toBeInTheDocument();
  });

  it("place les badges sur l'illustration", () => {
    render(<CardFace card={gobelin} size="xs" badges={<span>🛡</span>} />);

    expect(screen.getByText("🛡").closest(".card-face__badges")).not.toBeNull();
  });
});
