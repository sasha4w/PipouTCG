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
    render(<InspectableCard card={card} size="xs" stats={{ atk: 150, hp: 300 }} />);

    expect(
      screen.getByRole("button", { name: "Gobelin, 150 ATK, 300 PV" }),
    ).toBeInTheDocument();
  });

  it("clic et Entrée jouent la carte", () => {
    const onClick = vi.fn();
    render(<InspectableCard card={card} size="xs" onClick={onClick} />);
    const el = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.click(el);
    fireEvent.keyDown(el, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("le bouton i est absent tant que la carte n'est pas sélectionnée", () => {
    render(<InspectableCard card={card} size="xs" onInfo={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Informations" })).toBeNull();
  });

  it("le bouton i apparaît sur la carte sélectionnée", () => {
    render(<InspectableCard card={card} size="xs" selected onInfo={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Informations" }),
    ).toBeInTheDocument();
  });

  it("cliquer sur i appelle onInfo mais pas onClick", () => {
    const onClick = vi.fn();
    const onInfo = vi.fn();
    render(
      <InspectableCard
        card={card}
        size="xs"
        selected
        onClick={onClick}
        onInfo={onInfo}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Informations" }));
    expect(onInfo).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("un appui maintenu n'ouvre rien", () => {
    vi.useFakeTimers();
    const onInfo = vi.fn();
    render(<InspectableCard card={card} size="xs" onInfo={onInfo} />);
    const el = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.pointerDown(el, { clientX: 0, clientY: 0, button: 0 });
    act(() => vi.advanceTimersByTime(800));
    fireEvent.pointerUp(el);

    expect(onInfo).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Informations" })).toBeNull();
  });
});
