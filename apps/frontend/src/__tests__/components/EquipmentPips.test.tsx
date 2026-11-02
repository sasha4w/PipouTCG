import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EquipmentPips } from "../../features/fight/Zonerow/EquipmentPips";

const eq = (name: string, equipmentSlot: string) =>
  ({ instanceId: name, baseCard: { name, equipmentSlot } }) as never;

it("une pastille par équipement, dans l'ordre Offensif, Défensif, Accessoire", () => {
  render(<EquipmentPips equipments={[eq("Module", "ACCESSORY"), eq("Canon", "OFFENSIVE")]} />);
  const pips = screen.getAllByRole("img");
  expect(pips.map((p) => p.getAttribute("data-slot"))).toEqual(["OFFENSIVE", "ACCESSORY"]);
  expect(pips[0]).toHaveAccessibleName(/Canon/);
});

it("rien si aucun équipement", () => {
  const { container } = render(<EquipmentPips equipments={[]} />);
  expect(container).toBeEmptyDOMElement();
});
