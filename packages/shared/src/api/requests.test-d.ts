import { describe, expectTypeOf, it } from "vitest";
import type {
  CreateCardRequest,
  HistoryQuery,
  PaginatedResponse,
  PaginationQuery,
  UpdateCardRequest,
} from "../index";

describe("request contracts", () => {
  it("makes every card field optional on update", () => {
    expectTypeOf<UpdateCardRequest>().toEqualTypeOf<Partial<CreateCardRequest>>();
  });

  it("wraps list endpoints in data + meta", () => {
    expectTypeOf<PaginatedResponse<number>["meta"]>().toEqualTypeOf<{
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>();
  });

  it("filters history by role on top of pagination", () => {
    expectTypeOf<HistoryQuery>().toMatchTypeOf<PaginationQuery>();
    expectTypeOf<HistoryQuery["role"]>().toEqualTypeOf<"seller" | "buyer" | undefined>();
  });
});
