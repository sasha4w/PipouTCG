import { describe, expectTypeOf, it } from "vitest";
import type {
  ClientGameState,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../index";

describe("fight socket events", () => {
  it("sends the client game state on fight:state", () => {
    expectTypeOf<
      Parameters<ServerToClientEvents["fight:state"]>[0]
    >().toEqualTypeOf<ClientGameState>();
  });

  it("requires a matchId on game actions", () => {
    expectTypeOf<
      Parameters<ClientToServerEvents["fight:surrender"]>[0]
    >().toEqualTypeOf<{ matchId: number }>();
  });

  it("recycles a support from the hand", () => {
    expectTypeOf<
      Parameters<ClientToServerEvents["fight:recycle_support"]>[0]
    >().toEqualTypeOf<{ matchId: number; handIndex: number }>();
  });
});
