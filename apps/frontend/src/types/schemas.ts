/**
 * Zod schemas for runtime validation of API responses
 * Used in API interceptor and service layer for type safety
 */

import { z, ZodError } from "zod";

// Common field schemas
const timestampSchema = z.string();
const imageSchema = z.object({ url: z.string() }).nullable().optional();

// ─── Card schemas ────────────────────────────────────────────────────────

export const cardSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  atk: z.number(),
  hp: z.number(),
  cost: z.number(),
  rarity: z.string(),
  supportType: z.string().nullable().optional(),
  archetype: z.string().nullable().optional(),
  image: imageSchema,
  description: z.string().nullable().optional(),
  effects: z.any().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── User schemas ────────────────────────────────────────────────────────

export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
  avatar: z.string().nullable().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── Deck schemas ────────────────────────────────────────────────────────

export const deckSchema = z.object({
  id: z.number(),
  userId: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  cards: z.array(
    z.object({
      cardId: z.number(),
      quantity: z.number(),
    })
  ),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── Listing schemas ─────────────────────────────────────────────────────

export const listingSchema = z.object({
  id: z.number(),
  sellerId: z.number(),
  productType: z.string(),
  productId: z.number(),
  price: z.number(),
  quantity: z.number(),
  status: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── Transaction schemas ─────────────────────────────────────────────────

export const transactionSchema = z.object({
  id: z.number(),
  buyerId: z.number(),
  sellerId: z.number(),
  listingId: z.number(),
  amount: z.number(),
  quantity: z.number(),
  status: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── Match schemas ───────────────────────────────────────────────────────

export const matchPlayerSchema = z.object({
  userId: z.number(),
  username: z.string(),
  deckId: z.number(),
});

export const matchSchema = z.object({
  id: z.number(),
  player1: matchPlayerSchema,
  player2: matchPlayerSchema,
  winner: z.number().optional(),
  endReason: z.string().optional(),
  status: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ─── Player Stats schemas ─────────────────────────────────────────────────

export const playerStatsSchema = z.object({
  userId: z.number(),
  username: z.string(),
  wins: z.number(),
  losses: z.number(),
  totalMatches: z.number(),
  winRate: z.number(),
  rank: z.number(),
  points: z.number(),
});

// ─── Fight/Game State schemas ────────────────────────────────────────────

export const cardInstanceSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    instanceId: z.string(),
    baseCard: z.object({
      id: z.number(),
      name: z.string(),
      type: z.string(),
      atk: z.number(),
      hp: z.number(),
      cost: z.number(),
      rarity: z.string(),
      supportType: z.string().nullable().optional(),
      archetype: z.string().nullable().optional(),
      image: imageSchema,
      effects: z.any().optional(),
      description: z.string().nullable().optional(),
    }),
    ownerId: z.number(),
  })
);

export const monsterOnBoardSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    instanceId: z.string(),
    card: cardInstanceSchema,
    currentHp: z.number(),
    mode: z.enum(["attack", "guard"]),
    equipments: z.array(cardInstanceSchema),
    atkBuff: z.number(),
    hpBuff: z.number(),
    tempAtkBuff: z.number(),
    hasAttackedThisTurn: z.boolean(),
    attacksPerTurn: z.number(),
    attacksUsedThisTurn: z.number(),
    hasTaunt: z.boolean(),
    hasPiercing: z.boolean(),
    isImmuneToDebuffs: z.boolean(),
    forcedAttackMode: z.boolean(),
    summonedThisTurn: z.boolean(),
    doubleAtkNextTurn: z.boolean(),
    damageReduction: z.number().optional(),
    turnCounter: z.number().optional(),
    blockAttackTurns: z.number().optional(),
    guardLocked: z.boolean().optional(),
  })
);

export const myStateSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    userId: z.number(),
    username: z.string(),
    primes: z.number(),
    hand: z.array(cardInstanceSchema),
    deckCount: z.number(),
    monsterZones: z.array(monsterOnBoardSchema.nullable()),
    supportZones: z.array(cardInstanceSchema.nullable()),
    recycleEnergy: z.number(),
    graveyard: z.array(cardInstanceSchema),
    banished: z.array(cardInstanceSchema),
    freeSummonAvailable: z.boolean().optional(),
  })
);

export const oppStateSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    userId: z.number(),
    username: z.string(),
    primes: z.number(),
    handCount: z.number(),
    deckCount: z.number(),
    monsterZones: z.array(monsterOnBoardSchema.nullable()),
    supportZones: z.array(cardInstanceSchema.nullable()),
    graveyard: z.array(cardInstanceSchema),
    banished: z.array(cardInstanceSchema),
  })
);

export const pendingChoiceSchema = z.object({
  candidates: z.array(
    z.object({
      instanceId: z.string(),
      baseCard: z.object({
        id: z.number(),
        name: z.string(),
        type: z.string(),
        atk: z.number(),
        hp: z.number(),
        rarity: z.string(),
        supportType: z.string().nullable().optional(),
      }),
      source: z.enum(["graveyard", "deck", "board"]),
    })
  ),
  count: z.number(),
  prompt: z.string(),
  resolution: z
    .enum([
      "pick_to_hand",
      "destroy_ally",
      "return_to_hand",
      "force_attack_enemy",
      "block_attack_enemy",
      "force_guard_enemy",
    ])
    .optional(),
});

export const gameStateSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    matchId: z.number(),
    phase: z.enum(["waiting", "draw", "main", "battle", "end", "finished"]),
    turnNumber: z.number(),
    isMyTurn: z.boolean(),
    me: myStateSchema,
    opponent: oppStateSchema,
    log: z.array(z.string()),
    winner: z.number().optional(),
    endReason: z.string().optional(),
    pendingChoice: pendingChoiceSchema.optional(),
  })
);

// ─── Pagination schemas ──────────────────────────────────────────────────

export const paginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export function createPaginatedSchema<T extends z.ZodType<any, any>>(
  itemSchema: T
) {
  return z.object({
    data: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

// ─── Helper functions for validation ──────────────────────────────────────

/**
 * Safely validate API response against a schema
 * Returns original data if validation fails (for backward compatibility)
 */
export function safeValidate<T>(data: unknown, schema: z.ZodType<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      console.warn("Validation error:", error);
    }
    // Return data as-is if validation fails (graceful degradation)
    return data as T;
  }
}

/**
 * Strictly validate API response and throw on error
 */
export function validateStrict<T>(data: unknown, schema: z.ZodType<T>): T {
  return schema.parse(data);
}
