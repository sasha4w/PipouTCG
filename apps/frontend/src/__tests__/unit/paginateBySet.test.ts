import { describe, it, expect } from "vitest";
import { paginateBySet } from "../../features/profile/paginateBySet";

const item = (id: number, setId: number) => ({ id, setId });

describe("paginateBySet", () => {
  it("ne mélange jamais deux sets sur une page", () => {
    const items = [
      item(1, 1),
      item(2, 1),
      item(3, 1),
      item(4, 2),
      item(5, 2),
      item(6, 2),
    ];

    const pages = paginateBySet(items, 6);

    expect(pages.map((p) => p.map((i) => i.id))).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it("découpe un set plus long que la page", () => {
    const items = Array.from({ length: 8 }, (_, i) => item(i + 1, 1));

    const pages = paginateBySet(items, 6);

    expect(pages.map((p) => p.length)).toEqual([6, 2]);
  });

  it("garde l'ordre reçu", () => {
    const items = [item(9, 3), item(2, 3), item(5, 1)];

    expect(paginateBySet(items, 6)).toEqual([
      [item(9, 3), item(2, 3)],
      [item(5, 1)],
    ]);
  });

  it("renvoie aucune page pour une liste vide", () => {
    expect(paginateBySet([], 6)).toEqual([]);
  });
});
