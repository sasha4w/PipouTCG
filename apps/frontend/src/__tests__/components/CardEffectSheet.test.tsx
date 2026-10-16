import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import CardEffectSheet from "../../features/fight/CardEffectSheet";

const maraudeur = {
  type: "monster",
  supportType: null,
  archetype: "pipou",
  effects: [
    {
      trigger: "ON_SUMMON" as const,
      condition: null,
      actions: [
        { type: "SET_PIERCING" as const, value: 1, target: "SELF" as const },
      ],
    },
  ],
};

const canon = {
  type: "support",
  supportType: "EQUIPMENT",
  archetype: null,
  effects: [
    {
      trigger: "PASSIVE" as const,
      condition: { type: "EQUIPPED_ON" as const, value: "Noyau Delta" },
      actions: [{ type: "SET_PIERCING" as const, target: "SELF" as const }],
    },
  ],
};

describe("CardEffectSheet", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("rédige l'effet en toutes lettres, mot-clé en gras, avec sa définition", () => {
    render(<CardEffectSheet sources={[{ card: maraudeur }]} />);

    expect(screen.getByText("À l'invocation")).toBeInTheDocument();
    expect(
      screen.getByText("Perçant", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mots-clés")).toBeInTheDocument();
    expect(
      screen.getByText(/Ignore la réduction de dégâts/),
    ).toBeInTheDocument();
  });

  it("n'explique un mot-clé qu'une fois pour la carte et ses équipements", () => {
    render(
      <CardEffectSheet
        sources={[
          { card: maraudeur },
          { card: canon, title: "Canon à Particules" },
        ]}
      />,
    );

    expect(screen.getByText(/Canon à Particules/)).toBeInTheDocument();
    expect(
      screen.getByText("Si elle est équipée sur « Noyau Delta »"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Ignore la réduction de dégâts/)).toHaveLength(
      1,
    );
  });

  it("ne rend rien pour une carte sans effet", () => {
    const { container } = render(
      <CardEffectSheet sources={[{ card: { ...maraudeur, effects: null } }]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
