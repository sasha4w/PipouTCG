import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import FightHand from "../../features/fight/FightHand";
import type { HandCard } from "../../features/fight/handCard";

const handCard = (name: string): HandCard => ({
  instanceId: `${name}#1`,
  id: 1,
  name,
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 1,
  rarity: "common",
  effects: null,
  description: `Description de ${name}`,
  image: null,
});

function renderHand(overrides: Partial<Parameters<typeof FightHand>[0]> = {}) {
  const onCardClick = vi.fn();
  const hand = [handCard("Gobelin"), handCard("Ogre")];
  render(
    <FightHand
      hand={hand}
      phase="main"
      isMyTurn
      selectedCard={null}
      payIndices={[]}
      freeSummonInstanceIds={[]}
      onCardClick={onCardClick}
      {...overrides}
    />,
  );
  return { hand, onCardClick };
}

describe("FightHand", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("affiche chaque carte avec son visuel", () => {
    renderHand();

    expect(screen.getByRole("button", { name: /Gobelin/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ogre/ })).toBeInTheDocument();
  });

  it("un tap joue la carte pendant mon tour", () => {
    const { hand, onCardClick } = renderHand();

    fireEvent.click(screen.getByRole("button", { name: /Ogre/ }));

    expect(onCardClick).toHaveBeenCalledWith(1, hand[1]);
  });

  it("hors de mon tour, un tap ne fait rien", () => {
    const { onCardClick } = renderHand({ isMyTurn: false });

    fireEvent.click(screen.getByRole("button", { name: /Gobelin/ }));

    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("un appui long ouvre la grande carte sans la jouer, le relâchement la ferme", () => {
    vi.useFakeTimers();
    const { onCardClick } = renderHand();
    const card = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));

    const dialog = screen.getByRole("dialog", { name: "Gobelin" });
    expect(dialog).toBeInTheDocument();
    // La description figure aussi sur la face de la grande carte : on cible la ligne d'effet.
    expect(
      within(dialog).getByText("Description de Gobelin", {
        selector: ".bdl-label",
      }),
    ).toBeInTheDocument();

    fireEvent.pointerUp(card);
    fireEvent.click(card);

    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marque la carte sélectionnée", () => {
    renderHand({ selectedCard: 0 });

    expect(screen.getByRole("button", { name: /Gobelin/ })).toHaveClass(
      "fhand-card--selected",
    );
  });
});
