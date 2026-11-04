import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CardType } from "@pipou/shared";
import i18n from "../../i18n";
import type { Card } from "../../services/card.service";
import DeckCardRow from "./DeckCardRow";

const card = {
  id: 1,
  name: "Saint Sword",
  rarity: "common",
  type: CardType.MONSTER,
  supportType: null,
  atk: 800,
  hp: 1200,
  cost: 2,
  image: null,
  cardSet: { id: 1, name: "Set 1" },
} as Card;

beforeAll(() => i18n.changeLanguage("fr"));

describe("DeckCardRow", () => {
  it("affiche nom, quantité et ajoute au tap sur +", () => {
    const onAdd = vi.fn();
    const onOpen = vi.fn();
    render(
      <DeckCardRow card={card} inDeck={1} copies={3} canAdd onAdd={onAdd} onOpen={onOpen} />,
    );
    expect(screen.getByText("Saint Sword", { selector: ".cg__name" })).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un exemplaire de Saint Sword" }));
    expect(onAdd).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("désactive l'ajout au maximum", () => {
    render(
      <DeckCardRow card={card} inDeck={3} copies={3} canAdd={false} onAdd={vi.fn()} onOpen={vi.fn()} />,
    );
    const full = screen.getByRole("button", { name: "Saint Sword : maximum atteint" });
    expect((full as HTMLButtonElement).disabled).toBe(true);
  });

  it("retire avec − quand onRemove est fourni, et ouvre la fiche au tap", () => {
    const onRemove = vi.fn();
    const onOpen = vi.fn();
    render(
      <DeckCardRow card={card} inDeck={2} copies={3} canAdd onAdd={vi.fn()} onRemove={onRemove} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retirer un exemplaire de Saint Sword" }));
    expect(onRemove).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Saint Sword", { selector: ".cg__name" }));
    expect(onOpen).toHaveBeenCalled();
  });
});
