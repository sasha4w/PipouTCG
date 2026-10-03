import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardType, Rarity } from "@pipou/shared";
import SandboxSetup from "../../features/sandbox/SandboxSetup";
import type { Card } from "../../services/card.service";

const catalog: Card[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Carte ${i + 1}`,
  rarity: Rarity.COMMON,
  type: CardType.MONSTER,
  atk: 100,
  hp: 500,
  cost: 1,
  cardSet: { id: 1, name: "Base" },
}));

describe("SandboxSetup", () => {
  it("lance le sandbox quand les deux decks sont valides", async () => {
    const onStart = vi.fn();
    render(<SandboxSetup catalog={catalog} onStart={onStart} />);
    const start = screen.getByRole("button", { name: /Lancer/ });
    expect(start).toBeDisabled();

    for (const deck of ["Deck J1", "Deck J2"]) {
      const panel = screen.getByRole("region", { name: deck });
      await userEvent.click(
        within(panel).getByRole("button", { name: /Compléter/ }),
      );
    }
    await userEvent.click(screen.getByLabelText("J2 commence"));
    await userEvent.click(start);

    const payload = onStart.mock.calls[0][0];
    expect(payload.firstSeat).toBe("p2");
    expect(payload.timer).toBe(false);
    for (const seat of ["p1", "p2"] as const) {
      expect(
        payload.decks[seat].reduce(
          (n: number, e: { quantity: number }) => n + e.quantity,
          0,
        ),
      ).toBe(30);
    }
  });

  it("ajoute une carte du catalogue au deck édité", async () => {
    render(<SandboxSetup catalog={catalog} onStart={vi.fn()} />);
    const panel = screen.getByRole("region", { name: "Deck J1" });

    await userEvent.click(
      screen.getByRole("button", { name: "Ajouter Carte 3 au deck J1" }),
    );

    expect(within(panel).getByText("Carte 3")).toBeInTheDocument();
    expect(within(panel).getByText(/1 \/ 30/)).toBeInTheDocument();
  });
});
