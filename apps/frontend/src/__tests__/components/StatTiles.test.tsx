import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatTiles from "../../features/marketplace/sales-history/StatTiles";

// Sans animation : les compteurs affichent directement leur valeur finale
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

describe("StatTiles", () => {
  it("affiche les valeurs, le texte libre et un tiret quand la stat manque", () => {
    render(
      <StatTiles
        tiles={[
          { key: "total", label: "Or total", value: 780, unit: " G" },
          { key: "range", label: "Fourchette / u", value: null, text: "30–150 G" },
          { key: "avg", label: "Prix moyen / u", value: null },
        ]}
      />,
    );
    expect(screen.getByText("780 G")).toBeInTheDocument();
    expect(screen.getByText("30–150 G")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("affiche la légende et la tendance", () => {
    render(
      <StatTiles
        tiles={[
          {
            key: "trend",
            label: "Tendance 7 j",
            value: null,
            text: "+12 %",
            tone: "up",
            caption: "780 G",
          },
        ]}
      />,
    );
    expect(screen.getByText("+12 %").closest(".stat-tile")).toHaveClass(
      "stat-tile--up",
    );
    expect(screen.getByText("780 G")).toBeInTheDocument();
  });

  it("rend une tuile cliquable sous forme de bouton", async () => {
    const onClick = vi.fn();
    render(
      <StatTiles
        tiles={[
          { key: "big", label: "Plus grosse vente", value: 750, unit: " G", onClick },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Plus grosse vente/ }));
    expect(onClick).toHaveBeenCalled();
  });
});
