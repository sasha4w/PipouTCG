import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import InspectableCard from "../../features/fight/InspectableCard";
import type { CardFaceCard } from "../../features/cards/CardFace";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const card: CardFaceCard = {
  id: 1,
  name: "Gobelin",
  rarity: "common",
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 1,
  image: null,
};

describe("InspectableCard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("expose nom et stats courantes comme nom accessible", () => {
    render(
      <InspectableCard
        card={card}
        size="xs"
        stats={{ atk: 150, hp: 300 }}
        onInspect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Gobelin, 150 ATK, 300 PV" }),
    ).toBeInTheDocument();
  });

  it("clic et Entrée jouent la carte, appui long l'inspecte", () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const onInspect = vi.fn();
    render(
      <InspectableCard
        card={card}
        size="xs"
        onClick={onClick}
        onInspect={onInspect}
      />,
    );
    const el = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.click(el);
    fireEvent.keyDown(el, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(2);

    fireEvent.pointerDown(el, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(400));
    fireEvent.pointerUp(el);
    fireEvent.click(el);

    expect(onInspect).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
