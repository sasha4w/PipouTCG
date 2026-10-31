import { describe, expectTypeOf, it } from "vitest";
import { DestroyCause } from "../index";
import type { CardInstance, ClientGameState, FightEvent } from "../index";

describe("fight events", () => {
  it("expose les causes de destruction", () => {
    expectTypeOf(DestroyCause.COMBAT).toEqualTypeOf<"combat">();
    expectTypeOf<DestroyCause>().toEqualTypeOf<
      "combat" | "effect" | "sacrifice" | "self_destruct" | "hp_depleted"
    >();
  });

  it("joint les événements à l'état client", () => {
    expectTypeOf<ClientGameState["events"]>().toEqualTypeOf<FightEvent[]>();
    expectTypeOf<FightEvent["kind"]>().toEqualTypeOf<
      | "monster_summoned"
      | "monster_destroyed"
      | "terrain_played"
      | "monster_healed"
    >();
  });

  it("numérote la pose des terrains", () => {
    expectTypeOf<CardInstance["placedSeq"]>().toEqualTypeOf<number | undefined>();
  });
});
