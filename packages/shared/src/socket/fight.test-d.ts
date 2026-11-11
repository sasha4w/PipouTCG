import { describe, expectTypeOf, it } from "vitest";
import type {
  AdventureResultPayload,
  AdventureStartPayload,
  GameOverPayload,
  MatchFoundPayload,
  ClientGameState,
  ClientToServerEvents,
  ServerToClientEvents,
  TutorialLessonId,
  TutorialResultPayload,
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

  it("allows replacing an equipment or terrain when playing a support", () => {
    expectTypeOf<
      Parameters<ClientToServerEvents["fight:play_support"]>[0]
    >().toMatchTypeOf<{ replaceInstanceId?: string }>();
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

describe("tutorial socket events", () => {
  it("starts a lesson by id and acks an info step", () => {
    expectTypeOf<
      Parameters<ClientToServerEvents["tutorial:start"]>[0]
    >().toEqualTypeOf<{ lessonId: TutorialLessonId }>();
    expectTypeOf<
      Parameters<ClientToServerEvents["tutorial:ack"]>[0]
    >().toEqualTypeOf<{ matchId: number }>();
  });

  it("joins the lesson result to game over", () => {
    expectTypeOf<GameOverPayload["tutorial"]>().toEqualTypeOf<
      TutorialResultPayload | undefined
    >();
    expectTypeOf<MatchFoundPayload["tutorialLessonId"]>().toEqualTypeOf<
      TutorialLessonId | undefined
    >();
  });
});
