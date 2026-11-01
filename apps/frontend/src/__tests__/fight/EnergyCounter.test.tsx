import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import EnergyCounter from "../../features/fight/EnergyCounter";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

describe("EnergyCounter", () => {
  it("affiche la réserve avec un nom accessible", () => {
    render(<EnergyCounter value={3} />);
    const el = screen.getByRole("status", { name: "Énergie : 3" });
    expect(el).toHaveTextContent("3");
  });
});
