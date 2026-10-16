import { describe, expect, it } from "vitest";
import { fanLayout } from "../../features/fight/fanLayout";

const totalWidth = (n: number, cardWidth: number, W: number) =>
  fanLayout(n, W, cardWidth).reduce((sum, s) => sum + cardWidth + s.marginLeft, 0);

describe("fanLayout", () => {
  it("renvoie un tableau vide sans carte", () => {
    expect(fanLayout(0, 400, 84)).toEqual([]);
  });

  it("pose une carte seule droite, sans décalage", () => {
    expect(fanLayout(1, 400, 84)).toEqual([
      { rotateDeg: 0, offsetY: 0, marginLeft: 0 },
    ]);
  });

  it("ouvre l'éventail de -15° à +15°, symétrique", () => {
    const slots = fanLayout(5, 400, 84);

    expect(slots[0].rotateDeg).toBeCloseTo(-15);
    expect(slots[4].rotateDeg).toBeCloseTo(15);
    expect(slots[2].rotateDeg).toBeCloseTo(0);
    slots.forEach((s, i) => {
      expect(s.rotateDeg).toBeCloseTo(-slots[4 - i].rotateDeg);
      expect(s.offsetY).toBeCloseTo(slots[4 - i].offsetY);
    });
    expect(slots[0].offsetY).toBeGreaterThan(slots[2].offsetY);
  });

  it("chevauche toujours un peu, même quand tout tient", () => {
    const slots = fanLayout(3, 400, 84);

    expect(slots[0].marginLeft).toBe(0);
    expect(slots[1].marginLeft).toBeLessThan(0);
  });

  it.each([5, 7, 10])("tient dans la largeur avec %i cartes", (n) => {
    expect(totalWidth(n, 84, 400)).toBeLessThanOrEqual(400 + 1e-6);
  });
});
