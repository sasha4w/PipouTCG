import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ZoneRow from "../../features/fight/Zonerow/ZoneRow";
import { monster } from "../fixtures/monster";

describe("ZoneRow inspection", () => {
  it("ne rouvre pas de grande carte quand la zone inspectée se vide puis se remplit", () => {
    const { rerender } = render(<ZoneRow label="Monstres" zones={[monster()]} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /Gobelin/ }));
    expect(screen.getByRole("dialog", { name: "Gobelin" })).toBeInTheDocument();

    rerender(<ZoneRow label="Monstres" zones={[null]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <ZoneRow
        label="Monstres"
        zones={[monster({ instanceId: "m2" })]}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
