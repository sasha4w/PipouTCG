import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "../../i18n";
import SalesList from "../../features/marketplace/sales-history/SalesList";
import type { Transaction } from "../../services/transaction.service";

// 8 ventes : 6 par page, la vente #8 est donc en page 2. moi (1) vend à bob (2),
// sauf la vente #2 où moi achète à bob.
const SALES = Array.from({ length: 8 }, (_, i) => {
  const mine = i !== 1;
  return {
    id: i + 1,
    productId: 10,
    productType: "CARD",
    itemName: `Carte ${i + 1}`,
    quantity: 2,
    unitPrice: 5 * (i + 1),
    totalPrice: 10 * (i + 1),
    status: "COMPLETED",
    seller: mine ? { id: 1, username: "moi" } : { id: 2, username: "bob" },
    buyer: mine ? { id: 2, username: "bob" } : { id: 1, username: "moi" },
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
  };
}) as unknown as Transaction[];

const baseProps = {
  history: SALES,
  emptyMessage: "Rien",
  sort: "date" as const,
  onSortChange: vi.fn(),
  onPlayerClick: vi.fn(),
};

describe("SalesList", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
    // jsdom n'implémente pas scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("change le tri au clic sur Prix", () => {
    const onSortChange = vi.fn();
    render(<SalesList {...baseProps} onSortChange={onSortChange} />);
    expect(screen.getByRole("button", { name: "Plus récentes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Plus chères" }));
    expect(onSortChange).toHaveBeenCalledWith("price");
  });

  it("ouvre la page de la vente mise en avant et la surligne", () => {
    render(<SalesList {...baseProps} highlightId={8} />);
    const item = screen.getByText("Carte 8").closest("li");
    expect(item).toHaveClass("sales-list__item--highlight");
    expect(screen.queryByText("Carte 1")).not.toBeInTheDocument();
    expect(item!.scrollIntoView).toHaveBeenCalled();
  });

  it("reste en page 1 sans vente mise en avant", () => {
    render(<SalesList {...baseProps} />);
    expect(screen.getByText("Carte 1")).toBeInTheDocument();
    expect(screen.queryByText("Carte 8")).not.toBeInTheDocument();
  });

  it("colore les lignes selon que j'ai vendu ou acheté", () => {
    render(<SalesList {...baseProps} viewerId={1} />);
    expect(screen.getByText("Carte 1").closest("li")).toHaveClass("sales-list__item--sold");
    expect(screen.getByText("Carte 2").closest("li")).toHaveClass("sales-list__item--bought");
  });

  it("affiche le prix unitaire et filtre au clic sur un pseudo", () => {
    const onPlayerClick = vi.fn();
    render(<SalesList {...baseProps} onPlayerClick={onPlayerClick} />);
    expect(screen.getByText("5 G/u")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Voir les ventes de bob" })[0]);
    expect(onPlayerClick).toHaveBeenCalledWith({ id: 2, username: "bob" });
  });

  it("affiche le message vide", () => {
    render(<SalesList {...baseProps} history={[]} />);
    expect(screen.getByText("Rien")).toBeInTheDocument();
  });
});
