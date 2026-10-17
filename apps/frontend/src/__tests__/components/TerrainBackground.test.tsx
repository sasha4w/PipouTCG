import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { CardInstance } from "@pipou/shared";
import TerrainBackground from "../../features/fight/TerrainBackground";

const terrain = (instanceId: string, url: string | null): CardInstance => ({
  instanceId,
  ownerId: 1,
  placedSeq: 1,
  baseCard: {
    id: 1,
    name: instanceId,
    rarity: "epic",
    type: "support",
    atk: 0,
    hp: 0,
    cost: 0,
    supportType: "TERRAIN",
    archetype: null,
    element: null,
    lineage: null,
    stage: null,
    effects: null,
    description: null,
    image: url ? { url } : null,
  },
});

describe("TerrainBackground", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("affiche l'image du terrain avec la vague depuis sa zone", () => {
    const { container } = render(
      <TerrainBackground
        terrain={terrain("a", "https://cdn.test/foret.png")}
        side="me"
        waveFromZone={2}
        reduced={false}
      />,
    );
    const layer = container.querySelector(".tbg__layer") as HTMLElement;
    expect(layer).toHaveClass("tbg__layer--wave");
    expect(layer.style.backgroundImage).toContain("https://cdn.test/foret.png");
  });

  it("garde l'ancien fond le temps de la transition", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <TerrainBackground terrain={terrain("a", null)} side="me" waveFromZone={null} reduced={false} />,
    );
    rerender(
      <TerrainBackground terrain={terrain("b", null)} side="me" waveFromZone={0} reduced={false} />,
    );
    expect(container.querySelectorAll(".tbg__layer")).toHaveLength(2);
    expect(container.querySelector(".tbg__layer--out")).not.toBeNull();

    act(() => vi.advanceTimersByTime(700));
    expect(container.querySelectorAll(".tbg__layer")).toHaveLength(1);
  });

  it("ne rejoue pas la vague quand l'état suivant arrive", () => {
    const t = terrain("a", null);
    const { container, rerender } = render(
      <TerrainBackground terrain={t} side="me" waveFromZone={1} reduced={false} />,
    );
    rerender(
      <TerrainBackground terrain={{ ...t }} side="me" waveFromZone={null} reduced={false} />,
    );
    expect(container.querySelector(".tbg__layer")).toHaveClass("tbg__layer--wave");
  });

  it("aucun terrain : aucun calque", () => {
    const { container } = render(
      <TerrainBackground terrain={null} side="opponent" waveFromZone={null} reduced={false} />,
    );
    expect(container.querySelector(".tbg__layer")).toBeNull();
  });
});
