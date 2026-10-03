import { describe, expectTypeOf, it } from "vitest";
import type {
  GameAction,
  SandboxClientEvents,
  SandboxSetupCommand,
  SandboxState,
  SandboxServerEvents,
} from "../index";

describe("sandbox socket events", () => {
  it("joue une action de jeu pour un siège", () => {
    expectTypeOf<
      Parameters<SandboxClientEvents["sandbox:action"]>[0]
    >().toEqualTypeOf<{ seat: "p1" | "p2"; action: GameAction }>();
  });

  it("renvoie l'état complet du sandbox", () => {
    expectTypeOf<
      Parameters<SandboxServerEvents["sandbox:state"]>[0]
    >().toEqualTypeOf<SandboxState>();
  });

  it("distingue les commandes de mise en place par leur type", () => {
    expectTypeOf<SandboxSetupCommand["type"]>().toEqualTypeOf<
      "move_card" | "edit_monster" | "edit_player" | "edit_game"
    >();
  });
});
