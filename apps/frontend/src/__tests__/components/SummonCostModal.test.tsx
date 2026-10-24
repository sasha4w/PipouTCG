import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "../../i18n";
import SummonCostModal from "../../features/fight/SummonCostModal";
import type { HandCard } from "../../features/fight/handCard";

const card = {
  id: 1,
  name: "Général",
  cost: 3,
  type: "monster",
  rarity: "legendary",
  atk: 800,
  hp: 1500,
} as unknown as HandCard;
const allies = ["A", "B", "C"].map((n) => ({
  instanceId: n,
  name: `Soldat ${n}`,
  atk: 100,
  hp: 500,
}));

function setup(lockedId?: string) {
  const onConfirmReleve = vi.fn();
  render(
    <SummonCostModal
      card={card}
      hand={[card]}
      selectedCardIdx={0}
      recycleEnergy={0}
      payIndices={[]}
      onTogglePay={() => undefined}
      onConfirm={() => undefined}
      onClose={() => undefined}
      releve={{ needed: 2, allies, lockedId, onConfirm: onConfirmReleve }}
    />,
  );
  return { onConfirmReleve };
}

describe("SummonCostModal : Relève", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("valide seulement avec 2 alliés cochés", () => {
    const { onConfirmReleve } = setup();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("fight.releve.mode") }),
    );
    const confirm = screen.getByRole("button", {
      name: i18n.t("fight.releve.confirm"),
    });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByText("Soldat A"));
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByText("Soldat C"));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirmReleve).toHaveBeenCalledWith(["A", "C"]);
  });

  it("zone occupée : son allié est coché et ne se décoche pas", () => {
    const { onConfirmReleve } = setup("B");
    fireEvent.click(screen.getByText("Soldat B"));
    fireEvent.click(screen.getByText("Soldat A"));
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("fight.releve.confirm") }),
    );
    expect(onConfirmReleve).toHaveBeenCalledWith(["B", "A"]);
  });
});
