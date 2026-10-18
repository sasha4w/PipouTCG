import { describe, expectTypeOf, it } from "vitest";
import type {
  AdventureResultPayload,
  AdventureStartPayload,
  GameOverPayload,
  MatchFoundPayload,
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

  it("starts an adventure fight", () => {
    expectTypeOf<
      Parameters<ClientToServerEvents["adventure:start"]>[0]
    >().toEqualTypeOf<AdventureStartPayload>();
    expectTypeOf<AdventureStartPayload>().toEqualTypeOf<{
      opponentId: number;
      deckId: number;
    }>();
  });

  it("carries adventure data on match found and game over", () => {
    expectTypeOf<MatchFoundPayload["adventureOpponentId"]>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<GameOverPayload["adventure"]>().toEqualTypeOf<
      AdventureResultPayload | undefined
    >();
  });
});
