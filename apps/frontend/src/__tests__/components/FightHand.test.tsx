import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import FightHand from "../../features/fight/FightHand";
import type { HandCard } from "../../features/fight/handCard";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

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
  const { rerender } = render(
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
  return { hand, onCardClick, rerender };
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

  it("la carte sélectionnée montre i, qui ouvre le tiroir sans jouer la carte", () => {
    const { onCardClick } = renderHand({ selectedCard: 0 });

    fireEvent.click(screen.getByRole("button", { name: "Informations" }));

    expect(screen.getByRole("dialog", { name: "Gobelin" })).toBeInTheDocument();
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("sans sélection, aucun bouton i", () => {
    renderHand();
    expect(screen.queryByRole("button", { name: "Informations" })).toBeNull();
  });

  it("un appui maintenu n'ouvre plus la grande carte", () => {
    vi.useFakeTimers();
    renderHand();
    const card = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(800));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
