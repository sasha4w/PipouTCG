import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import FightActionBar from "../../features/fight/FightActionBar";
import { mainSlot } from "../../features/fight/mainSlot";
import type { HandCard } from "../../features/fight/handCard";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const monster = (over: Partial<HandCard> = {}): HandCard => ({
  instanceId: "m1",
  id: 1,
  name: "Jeune Feros",
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 2,
  rarity: "common",
  stage: "young",
  lineage: "feros",
  image: null,
  ...over,
});

const support = (supportType: HandCard["supportType"]): HandCard => ({
  ...monster(),
  type: "support",
  supportType,
  stage: null,
  lineage: null,
});

function renderBar(over: Partial<ComponentProps<typeof FightActionBar>> = {}) {
  const props: ComponentProps<typeof FightActionBar> = {
    phase: "main",
    isMyTurn: true,
    selectedCard: monster(),
    attackerSelected: false,
    transformUsed: false,
    overHandLimit: false,
    canEvolve: false,
    onRecycle: vi.fn(),
    onMain: vi.fn(),
    ...over,
  };
  render(<FightActionBar {...props} />);
  return props;
}

describe("FightActionBar", () => {
  it("tour adverse : les deux boutons restent là, grisés", () => {
    renderBar({ isMyTurn: false });
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b).toBeDisabled());
  });

  it("l'ordre est toujours Recycler puis action principale", () => {
    for (const selectedCard of [null, monster(), support("EPHEMERAL")]) {
      const { unmount } = render(
        <FightActionBar
          phase="main"
          isMyTurn
          selectedCard={selectedCard}
          attackerSelected={false}
          transformUsed={false}
          overHandLimit={false}
          onRecycle={vi.fn()}
          onMain={vi.fn()}
        />,
      );
      const names = screen.getAllByRole("button").map((b) => b.textContent);
      expect(names[0]).toMatch(/Recycler/);
      expect(names).toHaveLength(2);
      unmount();
    }
  });

  it("monstre transformable en phase principale : Transformer actif", () => {
    const props = renderBar();
    const btn = screen.getByRole("button", { name: /Transformer/ });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(props.onMain).toHaveBeenCalledTimes(1);
  });

  it("transformation déjà utilisée : Transformer grisé", () => {
    renderBar({ transformUsed: true });
    expect(screen.getByRole("button", { name: /Transformer/ })).toBeDisabled();
  });

  it("monstre non transformable : Action grisé avec l'indication d'invocation", () => {
    renderBar({ selectedCard: monster({ stage: "baby", lineage: null }) });
    expect(screen.getByRole("button", { name: "Action" })).toBeDisabled();
    expect(screen.getByText("Touche une zone pour invoquer")).toBeTruthy();
  });

  it("carte pouvant évoluer : l'indication d'évolution s'affiche", () => {
    renderBar({ canEvolve: true });
    expect(screen.getByText("Touche un de tes monstres pour évoluer")).toBeTruthy();
  });

  it("Recycler actif avec une carte sélectionnée et appelle onRecycle", () => {
    const props = renderBar();
    const btn = screen.getByRole("button", { name: /Recycler/ });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(props.onRecycle).toHaveBeenCalledTimes(1);
  });

  it("Recycler grisé sans carte sélectionnée", () => {
    renderBar({ selectedCard: null });
    expect(screen.getByRole("button", { name: /Recycler/ })).toBeDisabled();
  });

  it("phase de contrôle avec main pleine : Défausser actif", () => {
    const props = renderBar({
      phase: "end",
      overHandLimit: true,
      selectedCard: monster(),
    });
    const btn = screen.getByRole("button", { name: "Défausser" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(props.onRecycle).toHaveBeenCalledTimes(1);
  });

  it("phase de combat avec attaquant : Attaque directe actif", () => {
    renderBar({ phase: "battle", selectedCard: null, attackerSelected: true });
    expect(
      screen.getByRole("button", { name: "Attaque directe" }),
    ).toBeEnabled();
  });

  it("Éphémère : Jouer actif, grisé si aucune cible valide", () => {
    const { unmount } = render(
      <FightActionBar
        phase="main"
        isMyTurn
        selectedCard={support("EPHEMERAL")}
        attackerSelected={false}
        transformUsed={false}
        overHandLimit={false}
        onRecycle={vi.fn()}
        onMain={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Jouer" })).toBeEnabled();
    unmount();

    renderBar({
      selectedCard: support("EPHEMERAL"),
      playBlockedReason: "Aucune cible valide",
    });
    expect(screen.getByRole("button", { name: "Jouer" })).toBeDisabled();
  });

  it("aucun libellé de bouton ne contient d'emoji", () => {
    for (const over of [
      {},
      { selectedCard: support("TERRAIN") },
      { phase: "end" as const, overHandLimit: true },
      { phase: "battle" as const, attackerSelected: true },
    ]) {
      const { unmount } = render(
        <FightActionBar
          phase="main"
          isMyTurn
          selectedCard={monster()}
          attackerSelected={false}
          transformUsed={false}
          overHandLimit={false}
          onRecycle={vi.fn()}
          onMain={vi.fn()}
          {...over}
        />,
      );
      screen
        .getAllByRole("button")
        .forEach((b) =>
          expect(b.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u),
        );
      unmount();
    }
  });
});

describe("mainSlot", () => {
  it("Terrain : Jouer grisé avec l'indication de zone", () => {
    expect(
      mainSlot({
        phase: "main",
        isMyTurn: true,
        card: support("TERRAIN"),
        attackerSelected: false,
        transformUsed: false,
      }),
    ).toEqual({
      labelKey: "fight.bar.play",
      enabled: false,
      hintKey: "fight.bar.terrainHint",
    });
  });
});
