import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListingEditForm from "../../features/marketplace/ListingEditForm";
import {
  ProductType,
  TransactionStatus,
  type Transaction,
} from "../../services/transaction.service";

// Le serveur renvoyait le prix BIGINT en chaîne : on reproduit ce cas.
const listing = {
  id: 7,
  productType: ProductType.CARD,
  productId: 10,
  quantity: 1,
  unitPrice: "500" as unknown as number,
  totalPrice: 500,
  status: TransactionStatus.PENDING,
  createdAt: "2026-09-30",
  seller: { id: 1, username: "seller" },
} satisfies Transaction;

const renderForm = (maxQuantity = 5) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <ListingEditForm
      listing={listing}
      name="Capitaine Gribouille"
      maxQuantity={maxQuantity}
      busy={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel, user: userEvent.setup() };
};

const quantityInput = () =>
  screen.getByLabelText("marketplace.sell.edit_quantity");
const priceInput = () => screen.getByLabelText("marketplace.sell.edit_price");
const save = () =>
  screen.getByRole("button", { name: "marketplace.sell.btn_save" });

describe("ListingEditForm", () => {
  it("n'envoie que la quantité quand seule la quantité change", async () => {
    const { onSubmit, user } = renderForm();

    await user.clear(quantityInput());
    await user.type(quantityInput(), "4");
    await user.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ quantity: 4 });
  });

  it("n'envoie que le prix, en nombre, quand seul le prix change", async () => {
    const { onSubmit, user } = renderForm();

    await user.clear(priceInput());
    await user.type(priceInput(), "50");
    await user.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ unitPrice: 50 });
  });

  it("ferme sans requête si rien n'a changé", async () => {
    const { onSubmit, onCancel, user } = renderForm();

    await user.click(save());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("bloque une quantité au-delà du stock disponible", async () => {
    const { onSubmit, user } = renderForm(3);

    await user.clear(quantityInput());
    await user.type(quantityInput(), "9");

    expect(save()).toBeDisabled();
    await user.click(save());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("le bouton Max remplit le stock disponible", async () => {
    const { onSubmit, user } = renderForm(3);

    await user.click(
      screen.getByRole("button", { name: "marketplace.qty.max" }),
    );
    await user.click(save());

    expect(onSubmit).toHaveBeenCalledWith({ quantity: 3 });
  });
});
