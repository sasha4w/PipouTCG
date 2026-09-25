import { describe, expectTypeOf, it } from "vitest";
import type {
  CardInstance,
  ClientCard,
  ClientGameState,
  GameEndReason,
  MatchEndReason,
  MonsterOnBoard,
} from "../index";

describe("game types", () => {
  it("defaults the card type to ClientCard", () => {
    expectTypeOf<CardInstance["baseCard"]>().toEqualTypeOf<ClientCard>();
    expectTypeOf<MonsterOnBoard["card"]>().toEqualTypeOf<CardInstance<ClientCard>>();
  });

  it("lets the server plug its own card entity", () => {
    type ServerCard = ClientCard & { cardSet: { id: number } };
    expectTypeOf<CardInstance<ServerCard>>().toMatchTypeOf<CardInstance>();
  });

  it("uses MatchEndReason values as game end reasons", () => {
    expectTypeOf<GameEndReason>().toEqualTypeOf<MatchEndReason>();
    expectTypeOf<ClientGameState["endReason"]>().toEqualTypeOf<GameEndReason | undefined>();
  });
});
