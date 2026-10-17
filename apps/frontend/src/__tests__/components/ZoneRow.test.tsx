import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("ZoneRow animations", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const zoneEl = (container: HTMLElement) =>
    container.querySelector(".zr-zone") as HTMLElement;

  it("invocation : palier tiré de l'événement", () => {
    const { container, rerender } = render(
      <ZoneRow label="M" zones={[null]} />,
    );
    rerender(
      <ZoneRow
        label="M"
        zones={[monster()]}
        fx={new Map([[0, { summonTier: 3 }]])}
      />,
    );
    expect(zoneEl(container)).toHaveClass("zr-zone--summon-in", "zr-zone--summon-t3");
  });

  it("invocation sans événement : palier de la rareté de la carte", () => {
    const secret = monster();
    secret.card.baseCard.rarity = "secret";
    const { container, rerender } = render(<ZoneRow label="M" zones={[null]} />);
    rerender(<ZoneRow label="M" zones={[secret]} />);
    expect(zoneEl(container)).toHaveClass("zr-zone--summon-t4");
  });

  it("le palier disparaît après sa durée", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ZoneRow label="M" zones={[null]} />);
    rerender(
      <ZoneRow label="M" zones={[monster()]} fx={new Map([[0, { summonTier: 2 }]])} />,
    );
    act(() => vi.advanceTimersByTime(799));
    expect(zoneEl(container)).toHaveClass("zr-zone--summon-t2");
    act(() => vi.advanceTimersByTime(1));
    expect(zoneEl(container)).not.toHaveClass("zr-zone--summon-t2");
  });

  it("destruction : classe de la cause, combat par défaut", () => {
    const { container, rerender } = render(
      <ZoneRow label="M" zones={[monster(), monster({ instanceId: "m2" })]} />,
    );
    rerender(
      <ZoneRow
        label="M"
        zones={[null, null]}
        fx={new Map([[0, { destroyCause: "self_destruct" }]])}
      />,
    );
    const [first, second] = container.querySelectorAll(".zr-zone");
    expect(first).toHaveClass("zr-zone--shattering", "zr-zone--destroy-self-destruct");
    expect(second).toHaveClass("zr-zone--shattering", "zr-zone--destroy-combat");
  });

  it("zone vidée pendant l'invocation : seule la destruction s'affiche", () => {
    const { container, rerender } = render(<ZoneRow label="M" zones={[null]} />);
    rerender(
      <ZoneRow label="M" zones={[monster()]} fx={new Map([[0, { summonTier: 3 }]])} />,
    );
    rerender(
      <ZoneRow
        label="M"
        zones={[null]}
        fx={new Map([[0, { destroyCause: "effect" }]])}
      />,
    );
    expect(zoneEl(container)).toHaveClass("zr-zone--destroy-effect");
    expect(zoneEl(container)).not.toHaveClass("zr-zone--summon-in");
    expect(container.querySelector(".zr-summon-beam")).toBeNull();
  });

  it("évolution (autre monstre dans la même zone) : animation d'invocation", () => {
    const { container, rerender } = render(<ZoneRow label="M" zones={[monster()]} />);
    rerender(
      <ZoneRow label="M" zones={[monster({ instanceId: "m2" })]} fx={new Map([[0, { summonTier: 2 }]])} />,
    );
    expect(container.querySelector(".zr-zone")).toHaveClass("zr-zone--summon-t2");
    expect(container.querySelector(".zr-zone")).not.toHaveClass("zr-zone--shattering");
  });
});

describe("ZoneRow surbrillance", () => {
  it("ne surligne que les monstres listés", () => {
    const { container } = render(
      <ZoneRow
        label="M"
        zones={[monster(), monster({ instanceId: "m2" }), null]}
        highlightInstanceIds={new Set(["m2"])}
      />,
    );
    const [first, second, third] = container.querySelectorAll(".zr-zone");
    expect(first).not.toHaveClass("zr-zone--pulse-equipment");
    expect(second).toHaveClass("zr-zone--pulse-equipment");
    expect(third).not.toHaveClass("zr-zone--pulse-equipment");
  });
});
