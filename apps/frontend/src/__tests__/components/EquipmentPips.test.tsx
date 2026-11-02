import { beforeAll, expect, it } from "vitest";
import i18n from "../../i18n";
import { render, screen } from "@testing-library/react";
import { EquipmentPips } from "../../features/fight/Zonerow/EquipmentPips";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const eq = (name: string, equipmentSlot: string) =>
  ({ instanceId: name, baseCard: { name, equipmentSlot } }) as never;

it("une pastille par équipement, dans l'ordre Offensif, Défensif, Accessoire", () => {
  render(<EquipmentPips equipments={[eq("Module", "ACCESSORY"), eq("Canon", "OFFENSIVE")]} />);
  const pips = screen.getAllByRole("img");
  expect(pips.map((p) => p.getAttribute("data-slot"))).toEqual(["OFFENSIVE", "ACCESSORY"]);
  expect(pips[0]).toHaveAccessibleName("Offensif : Canon");
});

it("rien si aucun équipement", () => {
  const { container } = render(<EquipmentPips equipments={[]} />);
  expect(container).toBeEmptyDOMElement();
});
