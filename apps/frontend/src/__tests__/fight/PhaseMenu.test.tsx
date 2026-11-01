import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PhaseMenu from "../../features/fight/PhaseMenu";
import type { PhaseOption } from "../../features/fight/phaseOptions";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const options: PhaseOption[] = [
  { target: "battle", steps: 1 },
  { target: "end", steps: 2 },
  { target: "endTurn", steps: 3, disabledReason: "discard" },
];

describe("PhaseMenu", () => {
  it("une option grisée affiche la défausse et ne déclenche pas onPick", () => {
    const onPick = vi.fn();
    render(
      <PhaseMenu
        phase="main"
        options={options}
        discardCount={2}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Défausse 2 cartes")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Finir le tour/ }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it("un clic sur Combat appelle onPick", () => {
    const onPick = vi.fn();
    render(
      <PhaseMenu
        phase="main"
        options={options}
        discardCount={0}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Combat" }));
    expect(onPick).toHaveBeenCalledWith({ target: "battle", steps: 1 });
  });

  it("Échap ferme le menu", () => {
    const onClose = vi.fn();
    render(
      <PhaseMenu
        phase="main"
        options={options}
        discardCount={0}
        onPick={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("les phases déjà passées restent visibles mais grisées", () => {
    render(
      <PhaseMenu
        phase="battle"
        options={[
          { target: "end", steps: 1 },
          { target: "endTurn", steps: 2 },
        ]}
        discardCount={0}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Principale" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Combat" })).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Phase de contrôle" }),
    ).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Finir le tour" })).toBeEnabled();
  });

  it("la phase en cours est repérée", () => {
    render(
      <PhaseMenu
        phase="battle"
        options={[
          { target: "end", steps: 1 },
          { target: "endTurn", steps: 2 },
        ]}
        discardCount={0}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("menuitem", { name: "Combat" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("menuitem", { name: "Principale" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("en phase de contrôle, seul Finir le tour reste actif", () => {
    const onPick = vi.fn();
    render(
      <PhaseMenu
        phase="end"
        options={[{ target: "endTurn", steps: 1 }]}
        discardCount={0}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );
    for (const name of ["Principale", "Combat", "Phase de contrôle"])
      expect(screen.getByRole("menuitem", { name })).toBeDisabled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Finir le tour" }));
    expect(onPick).toHaveBeenCalledWith({ target: "endTurn", steps: 1 });
  });
});
