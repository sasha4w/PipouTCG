import { describe, it, expect, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import { COUNTER_OFFENSIVE_PER_TURN, GUARD_MAX_TURNS } from "@pipou/shared";
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

describe("FightRules — référence corrigée", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("la phase 4 est la phase de contrôle, plus « Ending Phase »", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.turn"));
    expect(
      screen.getByText(tt("fight.rules.phaseControl")),
    ).toBeInTheDocument();
    expect(tt("fight.rules.phaseControl")).toMatch(/contrôle/i);
    expect(screen.queryByText(/Ending Phase/)).toBeNull();
    // interdits et autorisés sont tous deux dits
    expect(screen.getByText(/invocation normale/i)).toBeInTheDocument();
    expect(screen.getByText(/Relève/)).toBeInTheDocument();
  });

  it("la Garde affiche les valeurs du moteur (tours max, contre-offensive)", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.combat"));
    const guard = screen.getByTestId("guard-rules");
    expect(guard).toHaveTextContent(String(GUARD_MAX_TURNS));
    expect(guard).toHaveTextContent(String(COUNTER_OFFENSIVE_PER_TURN));
  });

  it("les Primes disent qu'une destruction par effet n'en rapporte pas", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.primes"));
    expect(screen.getByText(/par un effet.*aucune Prime/i)).toBeInTheDocument();
    expect(screen.getByText(/Renvoi/)).toBeInTheDocument();
  });

  it("l'étape invocations spéciales couvre évolution, Transformer, Relève, Zeta, Origines", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.special"));
    for (const k of ["evolution", "transform", "releve", "zeta", "origins"]) {
      expect(screen.getByTestId(`special-${k}`)).toBeInTheDocument();
    }
  });

  it("l'étape supports dit : un Terrain, pas de doublon de Persistant", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.cards"));
    expect(screen.getByTestId("support-limits")).toHaveTextContent(/Terrain/);
  });

  it("les statuts sont classés en groupes", () => {
    render(<FightRules />);
    goTo(tt("fight.rules.step.status"));
    for (const g of ["restraint", "combat", "immunity", "summon"]) {
      expect(screen.getByTestId(`status-group-${g}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("status-group-immunity")).toHaveTextContent(
      tt("keywords.combatEndure.name"),
    );
    expect(screen.getByTestId("status-group-restraint")).toHaveTextContent(
      tt("keywords.freeze.name"),
    );
  });

  it("l'éclosion parle du deck ou du cimetière", () => {
    expect(tt("keywords.hatch.desc")).toMatch(/cimeti/i);
  });

  it("aucun emoji dans les étapes", () => {
    const { container } = render(<FightRules />);
    const steps = container.querySelectorAll(".fr-bc-step").length;
    for (let i = 0; i < steps; i++) {
      fireEvent.click(container.querySelectorAll(".fr-bc-step")[i]);
      expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
