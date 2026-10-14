import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../../i18n";
import TransactionHistory from "../../features/marketplace/TransactionHistory";
import type { Transaction } from "../../services/transaction.service";

// 8 ventes : 6 par page, la vente #8 est donc en page 2
const SALES = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  productId: 10,
  productType: "CARD",
  itemName: `Carte ${i + 1}`,
  quantity: 1,
  unitPrice: 10,
  totalPrice: 10 * (i + 1),
  status: "COMPLETED",
  seller: { id: 1, username: "moi" },
  buyer: { id: 2, username: "bob" },
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-10T10:00:00.000Z",
})) as unknown as Transaction[];

describe("TransactionHistory", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
    // jsdom n'implémente pas scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("change le tri au clic sur Prix", async () => {
    const onSortChange = vi.fn();
    render(
      <TransactionHistory
        history={SALES}
        sort="date"
        onSortChange={onSortChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Plus récentes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Plus chères" }));
    expect(onSortChange).toHaveBeenCalledWith("price");
  });

  it("ouvre la page de la vente mise en avant et la surligne", () => {
    render(
      <TransactionHistory
        history={SALES}
        sort="date"
        onSortChange={vi.fn()}
        highlightId={8}
      />,
    );
    const item = screen.getByText("Carte 8").closest("li");
    expect(item).toHaveClass("tx-history__item--highlight");
    expect(screen.queryByText("Carte 1")).not.toBeInTheDocument();
    expect(item!.scrollIntoView).toHaveBeenCalled();
  });

  it("reste en page 1 sans vente mise en avant", () => {
    render(
      <TransactionHistory history={SALES} sort="date" onSortChange={vi.fn()} />,
    );
    expect(screen.getByText("Carte 1")).toBeInTheDocument();
    expect(screen.queryByText("Carte 8")).not.toBeInTheDocument();
  });
});
