import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateListingModal from "../../features/marketplace/CreateListingModal";
import { ProductType } from "../../services/transaction.service";
import type { InventoryCard } from "../../services/user.service";

const inventoryCard = (
  id: number,
  name: string,
  rarity: InventoryCard["rarity"],
  type: InventoryCard["type"] = "monster",
): InventoryCard => ({
  userCardId: id,
  id,
  name,
  rarity,
  type,
  atk: 1,
  hp: 1,
  cost: 1,
  set: "Base",
  setId: 1,
  image: null,
  quantity: 2,
});

const cards = [
  inventoryCard(1, "Capitaine Gribouille", "rare"),
  inventoryCard(2, "Général Chatouille", "legendary"),
  inventoryCard(3, "Soin d'urgence", "common", "support"),
];

const renderModal = () => {
  const onSubmit = vi.fn();
  const addToast = vi.fn();
  render(
    <CreateListingModal
      isCreating={false}
      formProductType={ProductType.CARD}
      selectedInventoryId=""
      availableItems={cards}
      selectedItem={undefined}
      onProductTypeChange={vi.fn()}
      onInventoryIdChange={vi.fn()}
      onSubmit={onSubmit}
      onClose={vi.fn()}
      addToast={addToast}
    />,
  );
  return { onSubmit, addToast };
};

const shownCards = () =>
  Array.from(document.querySelectorAll(".marketplace-card-pick")).map((el) =>
    el.getAttribute("title"),
  );

describe("CreateListingModal — filtres cartes", () => {
  it("filtre l'inventaire par rareté", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "rarity.legendary" }));

    expect(shownCards()).toEqual(["Général Chatouille — ×2"]);
  });

  // Régression : les boutons du filtre soumettaient le formulaire de vente
  it("ne soumet pas le formulaire au clic sur un filtre", async () => {
    const user = userEvent.setup();
    const { onSubmit, addToast } = renderModal();

    await user.click(screen.getByRole("button", { name: "rarity.rare" }));
    await user.click(screen.getByRole("button", { name: "filter.reset" }));

    expect(addToast).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("filtre par type et se réinitialise", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "filter.support" }));
    expect(shownCards()).toEqual(["Soin d'urgence — ×2"]);

    await user.click(screen.getByRole("button", { name: "filter.reset" }));
    expect(shownCards()).toHaveLength(3);
  });

  it("indique quand aucun résultat ne correspond aux filtres", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "rarity.epic" }));

    expect(
      screen.getByText("marketplace.modal.no_filter_results"),
    ).toBeInTheDocument();
  });
});
