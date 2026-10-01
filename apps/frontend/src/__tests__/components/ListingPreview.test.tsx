import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ListingPreview from "../../features/marketplace/ListingPreview";
import {
  ProductType,
  TransactionStatus,
  type Transaction,
} from "../../services/transaction.service";
import type { Card } from "../../services/card.service";

const card: Card = {
  id: 10,
  name: "Capitaine Gribouille",
  rarity: "rare",
  type: "monster",
  atk: 3,
  hp: 4,
  cost: 2,
  image: null,
  cardSet: { id: 1, name: "Base" },
};

const listing = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 1,
  productType: ProductType.CARD,
  productId: 10,
  quantity: 2,
  unitPrice: 100,
  totalPrice: 200,
  status: TransactionStatus.PENDING,
  createdAt: "2026-09-30",
  seller: { id: 1, username: "seller" },
  ...overrides,
});

describe("ListingPreview", () => {
  it("affiche la carte vendue à la place de l'icône", () => {
    const { container } = render(
      <ListingPreview listing={listing({ card })} name={card.name} />,
    );

    expect(container.querySelector(".pipou-card")).toBeInTheDocument();
    expect(container.querySelector("svg[aria-hidden]")).toBeNull();
    expect(screen.getByText("×2")).toBeInTheDocument();
  });

  it("garde l'icône et le nom pour un booster", () => {
    const { container } = render(
      <ListingPreview
        listing={listing({ productType: ProductType.BOOSTER, card: null })}
        name="Booster Base"
      />,
    );

    expect(container.querySelector(".pipou-card")).toBeNull();
    expect(screen.getByText("Booster Base")).toBeInTheDocument();
  });
});
