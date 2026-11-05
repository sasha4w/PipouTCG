import { describe, it, expect, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import FightRules from "./FightRules";

const tt = (key: string, opts?: Record<string, unknown>) =>
  i18n.t(key, opts) as string;

const goTo = (label: string) =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label) }));

describe("FightRules", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("l'étape cartes affiche la Charge et les emplacements d'équipement", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.cards"));
    expect(screen.getByText(tt("glossary.kind.CHARGE"))).toBeInTheDocument();
    expect(screen.getByText(tt("fight.rules.charge"))).toBeInTheDocument();
    const slots = screen.getByTestId("equip-slots");
    expect(slots).toHaveTextContent(
      `${tt("glossary.equipmentSlot.OFFENSIVE")} : 1`,
    );
    expect(slots).toHaveTextContent(
      `${tt("glossary.equipmentSlot.DEFENSIVE")} : 1`,
    );
    expect(slots).toHaveTextContent(
      `${tt("glossary.equipmentSlot.ACCESSORY")} : 2`,
    );
  });

  it("l'étape decks de départ liste les 3 decks", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.starters"));
    for (const a of ["pipou", "pixelman", "dragon"]) {
      expect(
        screen.getByText(tt(`starter.deck.${a}.name`)),
      ).toBeInTheDocument();
      expect(
        screen.getByText(tt(`starter.deck.${a}.gameplay`)),
      ).toBeInTheDocument();
    }
  });
});
