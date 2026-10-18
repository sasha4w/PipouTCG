# Refonte quêtes & succès — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 36 succès à paliers calculés depuis les stats existantes (avec titres), des quêtes daily/hebdo tirées dans un pool (3 + 1 relance/jour), et le panneau Missions refait (onglets Daily · Hebdo · Succès en grille de badges).

**Architecture:** Le catalogue des succès est une constante de `@pipou/shared`. Côté back, un module `achievements/` lit les compteurs existants et ne stocke que les paliers réclamés (`user_achievement`). Les quêtes gardent `quest`/`user_quest`, avec un pool seedé au démarrage (`pool_key`), un tirage par joueur dans `syncUserQuests` et de nouvelles conditions alimentées par des événements. Côté front, `QuestsPanel` est refondu et un dossier `features/achievements/` est ajouté.

**Tech Stack:** NestJS 11 + TypeORM (MySQL) + EventEmitter2, Jest ; React 18 + TanStack Query + react-i18next, Vitest + Testing Library ; `@pipou/shared` (tsup, vitest).

**Spec:** `docs/superpowers/specs/2026-10-18-quests-achievements-rework-design.md`

## Global Constraints

- Tout type/enum échangé front↔back vit dans `@pipou/shared` ; `@pipou/shared` n'a aucune dépendance runtime. Après modification : `pnpm build:shared`.
- **Ne jamais toucher Aiven** : `apps/backend/.env` pointe sur la prod. Pas de `migration:run`, `migration:revert` ni d'e2e avec `.env`. On utilise uniquement `migration:run:local` et `.env.e2e` (docker local).
- Les entités doivent rester alignées sur le schéma de la migration (noms d'index et de FK identiques) : `synchronize` local ne doit produire aucun diff.
- UI : icônes SVG de `apps/frontend/src/components/Icons.tsx` uniquement, jamais d'emoji.
- Front : données serveur via TanStack Query uniquement, clés dans `utils/querykeys.ts`, pas de `any`, pas de composant déclaré dans un composant.
- Toute nouvelle chaîne UI est ajoutée en fr, en et ko (`apps/frontend/src/i18n/locales/*.json`).
- Récompense booster des succès et du pool = booster id **1** (« Brigade de Combat ») ; bundle = id **1** (« Tripack Escouade de combat »), lus dans le dump local.
- Reset daily à 4h ; reset hebdo le lundi (jour 1) à 4h, en heure serveur.
- Commits sur `dev`, message terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Écarts assumés par rapport à la spec

- La route du titre devient `PUT /achievements/title`, pour éviter une dépendance circulaire `UsersModule` ↔ `AchievementsModule`.
- Le claim d'un succès **ne crée pas** de message inbox : le joueur vient de cliquer, le message n'apporterait rien (YAGNI).
- Claim : on insère d'abord `user_achievement` (l'index unique protège contre le double claim), puis on distribue. Si la distribution échoue, la ligne est supprimée et l'erreur remonte. `UsersService` n'accepte pas de `EntityManager`, d'où ce mécanisme plutôt qu'une transaction.
- La migration désactive **toutes** les quêtes existantes `NONE`/`DAILY`/`WEEKLY` sans `pool_key` (ids 1 à 4 en prod, remplacées par le pool). L'admin peut les réactiver.
- `EARN_GOLD` écoute l'événement existant `listing.sold` (qui porte déjà `sellerId` et `totalPrice`) au lieu d'enrichir trois événements.
- La migration a été vérifiée sur la base locale `cardcollect_local`.
- Le titre équipé du duel est un frère de `.hud-name` (non imbriqué), pour éviter le clipping.
- `achievements.tab` a été ajouté lors de la tâche 9.

## Structure des fichiers

**Shared (`packages/shared/src`)**
- `enums/card.ts` — modifié : `RARITY_RANK`, `rarityAtLeast`.
- `enums/notification.ts` — modifié : réutilise `rarityAtLeast`.
- `enums/achievement.ts` — nouveau : `AchievementFamily`, `AchievementTier`.
- `enums/quest.ts` — modifié : 6 nouvelles `QuestConditionType`.
- `enums/index.ts` — export.
- `game/achievements.ts` (+ `.test.ts`) — nouveau : catalogue `ACHIEVEMENTS`, helpers de paliers.
- `game/index.ts` — export.
- `game/state.ts` — modifié : `title?` sur `MyClientState`/`OpponentClientState`.
- `api/achievements.ts`, `api/quests.ts` — nouveaux ; `api/index.ts` export ; `api/requests.ts` : `minRarity` sur `QuestCondition`.

**Backend (`apps/backend/src`)**
- `database/migrations/1791000000007-QuestsAchievements.ts` — nouveau.
- `achievements/` — nouveau module : `user-achievement.entity.ts`, `achievement-values.ts` (+spec), `achievement-stats.service.ts`, `achievements.service.ts` (+spec), `achievements.controller.ts`, `dto/set-title.dto.ts`, `achievements.module.ts`.
- `users/user.entity.ts`, `users/users.service.ts` — 3 colonnes, `equippedTitle` dans le profil.
- `users/user-quest.entity.ts` — types de progression repris de shared.
- `quests/quest.entity.ts` — `poolKey`, `minRarity`.
- `quests/quest-schedule.ts` (+spec) — calcul des resets, tirage.
- `quests/quest-pool.ts`, `quests/quest-pool.seeder.ts` (+spec).
- `quests/quests.service.ts` (+spec), `quests/quests.controller.ts`, `quests/quests.module.ts`, `quests/dto/create-quest.dto.ts`.
- `fights/services/game-end.service.ts` (+spec), `fights/services/matchmaking.service.ts`, `fights/helpers/game-factory.ts`, `fights/helpers/client-state.builder.ts`, `fights/interfaces/game-state.interface.ts`.
- `boosters/boosters.service.ts`, `transactions/transactions.service.ts`, `daily-reward/daily-reward.service.ts` (+spec).
- `app.module.ts`.
- `test/e2e/features/quests.feature`, `test/e2e/features/achievements.feature`.

**Frontend (`apps/frontend/src`)**
- `services/quest.service.ts`, `services/achievement.service.ts` (nouveau), `services/user.service.ts`.
- `hooks/useGameData.ts`, `utils/querykeys.ts`.
- `features/quests/RewardLabel.tsx`, `features/quests/useCountdown.ts`, `features/quests/questTitle.ts` — nouveaux (extraits de `QuestsPanel`).
- `features/profile/QuestsPanel.tsx` + `.css` — refonte.
- `features/achievements/` — `achievementIcons.ts`, `AchievementsTab.tsx`, `AchievementTile.tsx`, `AchievementSheet.tsx`, `Achievements.css`.
- `components/BottomSheet.tsx` + `.css` — nouveau ; `components/Icons.tsx` — `IconSwords`, `IconGem`.
- `features/profile/HeroCard.tsx`, `features/fight/FightHUD.tsx`, `features/inbox/InboxItem.tsx`.
- `i18n/locales/{fr,en,ko}.json`.
- Tests : `__tests__/components/QuestsPanel.test.tsx`, `AchievementTile.test.tsx`, `AchievementSheet.test.tsx`, `__tests__/unit/achievementsI18n.test.ts`.

---

### Task 1 : Shared — rareté, enums, catalogue et contrats d'API

**Files:**
- Modify: `packages/shared/src/enums/card.ts`, `packages/shared/src/enums/notification.ts`, `packages/shared/src/enums/quest.ts`, `packages/shared/src/enums/index.ts`, `packages/shared/src/game/index.ts`, `packages/shared/src/game/state.ts`, `packages/shared/src/api/index.ts`, `packages/shared/src/api/requests.ts`
- Create: `packages/shared/src/enums/achievement.ts`, `packages/shared/src/game/achievements.ts`, `packages/shared/src/game/achievements.test.ts`, `packages/shared/src/api/achievements.ts`, `packages/shared/src/api/quests.ts`

**Interfaces:**
- Produces:
  - `RARITY_RANK: Record<Rarity, number>` et `rarityAtLeast(r: Rarity, min: Rarity): boolean`.
  - `AchievementFamily` (12 valeurs) et `AchievementTier` (`BRONZE|SILVER|GOLD`).
  - `ALL_SETS`, `AchievementReward`, `AchievementTierDefinition`, `AchievementDefinition`, `ACHIEVEMENTS`, `ACHIEVEMENT_TOTAL`, `ACHIEVEMENT_REWARD_BOOSTER_ID`, `ACHIEVEMENT_REWARD_BUNDLE_ID`.
  - `findAchievement(family)` et `nextAchievementTier(progress)`, `isAchievementClaimable(progress)`.
  - `AchievementTierProgress`, `AchievementProgress`, `AchievementsResponse`, `ClaimAchievementResponse`, `SetTitleRequest`.
  - `ConditionProgress`, `QuestProgress`, `UserQuest`, `UserQuestsResponse`, `QUEST_LIST_KEYS`.
  - `QuestConditionType` + `PLAY_FIGHT`, `OBTAIN_CARD`, `CLAIM_DAILY_REWARD`, `LIST_CARD`, `EARN_GOLD`, `COMPLETE_QUEST`.

- [ ] **Step 1 : Écrire le test du catalogue (échoue)**

`packages/shared/src/game/achievements.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_TOTAL,
  ALL_SETS,
  isAchievementClaimable,
  nextAchievementTier,
} from "./achievements";
import { AchievementFamily, AchievementTier } from "../enums/achievement";
import type { AchievementProgress } from "../api/achievements";
import { Rarity, rarityAtLeast } from "../enums/card";

describe("catalogue des succès", () => {
  it("couvre les 12 familles, 3 paliers chacune", () => {
    expect(ACHIEVEMENTS.map((a) => a.family).sort()).toEqual(
      Object.values(AchievementFamily).sort(),
    );
    for (const a of ACHIEVEMENTS) {
      expect(a.tiers.map((t) => t.tier)).toEqual([
        AchievementTier.BRONZE,
        AchievementTier.SILVER,
        AchievementTier.GOLD,
      ]);
    }
    expect(ACHIEVEMENT_TOTAL).toBe(36);
  });

  it("a des seuils numériques strictement croissants", () => {
    for (const a of ACHIEVEMENTS) {
      const nums = a.tiers
        .map((t) => t.threshold)
        .filter((t): t is number => typeof t === "number");
      for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeGreaterThan(nums[i - 1]);
    }
  });

  it("n'utilise ALL_SETS que pour l'or de SETS_COMPLETED", () => {
    const uses = ACHIEVEMENTS.flatMap((a) =>
      a.tiers.filter((t) => t.threshold === ALL_SETS).map((t) => [a.family, t.tier]),
    );
    expect(uses).toEqual([[AchievementFamily.SETS_COMPLETED, AchievementTier.GOLD]]);
  });
});

const progress = (claimed: boolean[], reached: boolean[]): AchievementProgress => ({
  family: AchievementFamily.LEVEL,
  value: 0,
  claimedTier: null,
  tiers: [AchievementTier.BRONZE, AchievementTier.SILVER, AchievementTier.GOLD].map(
    (tier, i) => ({
      tier,
      threshold: (i + 1) * 10,
      reward: { type: "GOLD", amount: 100 },
      claimed: claimed[i],
      reached: reached[i],
    }),
  ),
});

describe("helpers de paliers", () => {
  it("le prochain palier est le premier non réclamé", () => {
    expect(nextAchievementTier(progress([true, false, false], [true, true, false]))?.tier).toBe(
      AchievementTier.SILVER,
    );
    expect(nextAchievementTier(progress([true, true, true], [true, true, true]))).toBeNull();
  });

  it("réclamable seulement si le prochain palier est atteint", () => {
    expect(isAchievementClaimable(progress([true, false, false], [true, true, false]))).toBe(true);
    expect(isAchievementClaimable(progress([true, false, false], [true, false, false]))).toBe(false);
  });
});

describe("rarityAtLeast", () => {
  it("compare selon l'ordre common < … < secret", () => {
    expect(rarityAtLeast(Rarity.EPIC, Rarity.RARE)).toBe(true);
    expect(rarityAtLeast(Rarity.RARE, Rarity.RARE)).toBe(true);
    expect(rarityAtLeast(Rarity.UNCOMMON, Rarity.RARE)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test**

Run: `pnpm --filter @pipou/shared test`
Expected: FAIL, `Cannot find module './achievements'`.

- [ ] **Step 3 : Rareté**

À la fin de `packages/shared/src/enums/card.ts`, ajouter :

```ts
/** Rang de rareté : common = 0 … secret = 5. */
export const RARITY_RANK: Record<Rarity, number> = {
  [Rarity.COMMON]: 0,
  [Rarity.UNCOMMON]: 1,
  [Rarity.RARE]: 2,
  [Rarity.EPIC]: 3,
  [Rarity.LEGENDARY]: 4,
  [Rarity.SECRET]: 5,
};

export function rarityAtLeast(rarity: Rarity, min: Rarity): boolean {
  return RARITY_RANK[rarity] >= RARITY_RANK[min];
}
```

Dans `packages/shared/src/enums/notification.ts` :
- remplacer `import { Rarity } from "./card";` par `import { Rarity, rarityAtLeast } from "./card";` ;
- supprimer la constante locale `RARITY_RANK` ;
- remplacer le corps de `isNotableDrop` par :

```ts
  return card.isNew || rarityAtLeast(card.rarity, DROP_NOTIFICATION_MIN_RARITY);
```

- [ ] **Step 4 : Enums**

`packages/shared/src/enums/achievement.ts` :

```ts
// Valeurs stockées en base (user_achievement.family / .tier, user.equipped_title).
export const AchievementFamily = {
  BOOSTERS_OPENED: "BOOSTERS_OPENED",
  CARDS_BOUGHT: "CARDS_BOUGHT",
  CARDS_SOLD: "CARDS_SOLD",
  SETS_COMPLETED: "SETS_COMPLETED",
  DUELS_WON: "DUELS_WON",
  DUELS_PLAYED: "DUELS_PLAYED",
  LEVEL: "LEVEL",
  UNIQUE_CARDS: "UNIQUE_CARDS",
  HIGH_RARITY: "HIGH_RARITY",
  LOGIN_STREAK: "LOGIN_STREAK",
  GOLD_EARNED: "GOLD_EARNED",
  QUESTS_DONE: "QUESTS_DONE",
} as const;
export type AchievementFamily =
  (typeof AchievementFamily)[keyof typeof AchievementFamily];

export const AchievementTier = {
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
} as const;
export type AchievementTier =
  (typeof AchievementTier)[keyof typeof AchievementTier];
```

Dans `packages/shared/src/enums/quest.ts`, compléter `QuestConditionType` après `WIN_FIGHT` :

```ts
  WIN_FIGHT: "WIN_FIGHT",
  PLAY_FIGHT: "PLAY_FIGHT",
  OBTAIN_CARD: "OBTAIN_CARD",
  CLAIM_DAILY_REWARD: "CLAIM_DAILY_REWARD",
  LIST_CARD: "LIST_CARD",
  EARN_GOLD: "EARN_GOLD",
  COMPLETE_QUEST: "COMPLETE_QUEST",
} as const;
```

Dans `packages/shared/src/enums/index.ts`, ajouter `export * from "./achievement";`.

- [ ] **Step 5 : Contrats d'API**

`packages/shared/src/api/achievements.ts` :

```ts
import type { AchievementFamily, AchievementTier } from "../enums/achievement";
import type { AchievementReward } from "../game/achievements";

export interface AchievementTierProgress {
  tier: AchievementTier;
  /** Seuil résolu (ALL_SETS remplacé par le nombre de sets). */
  threshold: number;
  reward: AchievementReward;
  reached: boolean;
  claimed: boolean;
}

export interface AchievementProgress {
  family: AchievementFamily;
  value: number;
  /** Plus haut palier réclamé. */
  claimedTier: AchievementTier | null;
  tiers: AchievementTierProgress[];
}

/** GET /achievements */
export interface AchievementsResponse {
  families: AchievementProgress[];
  unlocked: number;
  total: number;
  equippedTitle: AchievementFamily | null;
}

/** POST /achievements/:family/claim */
export interface ClaimAchievementResponse {
  family: AchievementFamily;
  tier: AchievementTier;
  reward: AchievementReward;
}

/** PUT /achievements/title */
export interface SetTitleRequest {
  family: AchievementFamily | null;
}
```

`packages/shared/src/api/quests.ts` :

```ts
import type { Rarity } from "../enums/card";
import type {
  ConditionOperator,
  QuestConditionType,
  QuestResetType,
  QuestRewardType,
} from "../enums/quest";

export interface ConditionProgress {
  type: QuestConditionType;
  current: number;
  target: number;
  completed: boolean;
  rarity?: string;
  minRarity?: Rarity;
  setId?: number;
  boosterId?: number;
}

export interface QuestProgress {
  operator: ConditionOperator;
  conditions: ConditionProgress[];
  globalCompleted: boolean;
}

export interface UserQuest {
  id: number;
  questId: number;
  /** Clé i18n pour les quêtes du pool, texte libre pour les quêtes admin. */
  title: string;
  description: string | null;
  resetType: QuestResetType;
  rewardType: QuestRewardType;
  rewardAmount: number;
  rewardItemId: number | null;
  progress: QuestProgress;
  isCompleted: boolean;
  rewardClaimed: boolean;
  resetAt: string | null;
}

export const QUEST_LIST_KEYS = ["DAILY", "WEEKLY", "MONTHLY", "EVENT"] as const;
export type QuestListKey = (typeof QUEST_LIST_KEYS)[number];

/** GET /quests/me */
export type UserQuestsResponse = Record<QuestListKey, UserQuest[]> & {
  rerollAvailable: boolean;
  dailyResetAt: string;
  weeklyResetAt: string;
};
```

Dans `packages/shared/src/api/index.ts`, ajouter `export * from "./achievements";` et `export * from "./quests";`.

Dans `packages/shared/src/api/requests.ts` :
- ajouter `import type { Rarity } from "../enums/card";` en tête (s'il n'est pas déjà importé) ;
- dans `QuestCondition`, après `rarity?: string;`, ajouter `minRarity?: Rarity;`.

- [ ] **Step 6 : Catalogue**

`packages/shared/src/game/achievements.ts` :

```ts
import { AchievementFamily, AchievementTier } from "../enums/achievement";
import { QuestRewardType } from "../enums/quest";
import type { AchievementProgress, AchievementTierProgress } from "../api/achievements";

/** Seuil égal au nombre de sets existants, résolu par le back. */
export const ALL_SETS = "ALL_SETS" as const;
export type AchievementThreshold = number | typeof ALL_SETS;

export interface AchievementReward {
  type: QuestRewardType;
  amount: number;
  itemId?: number;
}

export interface AchievementTierDefinition {
  tier: AchievementTier;
  threshold: AchievementThreshold;
  reward: AchievementReward;
}

export interface AchievementDefinition {
  family: AchievementFamily;
  tiers: readonly [AchievementTierDefinition, AchievementTierDefinition, AchievementTierDefinition];
}

/** Booster « Brigade de Combat » et bundle « Tripack Escouade de combat ». */
export const ACHIEVEMENT_REWARD_BOOSTER_ID = 1;
export const ACHIEVEMENT_REWARD_BUNDLE_ID = 1;

const tiers = (
  bronze: AchievementThreshold,
  silver: AchievementThreshold,
  gold: AchievementThreshold,
): AchievementDefinition["tiers"] => [
  { tier: AchievementTier.BRONZE, threshold: bronze, reward: { type: QuestRewardType.GOLD, amount: 100 } },
  {
    tier: AchievementTier.SILVER,
    threshold: silver,
    reward: { type: QuestRewardType.BOOSTER, amount: 1, itemId: ACHIEVEMENT_REWARD_BOOSTER_ID },
  },
  {
    tier: AchievementTier.GOLD,
    threshold: gold,
    reward: { type: QuestRewardType.BUNDLE, amount: 1, itemId: ACHIEVEMENT_REWARD_BUNDLE_ID },
  },
];

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { family: AchievementFamily.BOOSTERS_OPENED, tiers: tiers(10, 100, 500) },
  { family: AchievementFamily.CARDS_BOUGHT, tiers: tiers(5, 50, 250) },
  { family: AchievementFamily.CARDS_SOLD, tiers: tiers(5, 50, 250) },
  { family: AchievementFamily.SETS_COMPLETED, tiers: tiers(1, 3, ALL_SETS) },
  { family: AchievementFamily.DUELS_WON, tiers: tiers(1, 25, 100) },
  { family: AchievementFamily.DUELS_PLAYED, tiers: tiers(10, 50, 200) },
  { family: AchievementFamily.LEVEL, tiers: tiers(5, 15, 30) },
  { family: AchievementFamily.UNIQUE_CARDS, tiers: tiers(25, 100, 250) },
  { family: AchievementFamily.HIGH_RARITY, tiers: tiers(1, 10, 50) },
  { family: AchievementFamily.LOGIN_STREAK, tiers: tiers(7, 30, 100) },
  { family: AchievementFamily.GOLD_EARNED, tiers: tiers(1_000, 10_000, 100_000) },
  { family: AchievementFamily.QUESTS_DONE, tiers: tiers(10, 50, 200) },
];

export const ACHIEVEMENT_TOTAL = ACHIEVEMENTS.length * 3;

export function findAchievement(family: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.family === family);
}

/** Premier palier non réclamé (les paliers se réclament dans l'ordre). */
export function nextAchievementTier(progress: AchievementProgress): AchievementTierProgress | null {
  return progress.tiers.find((t) => !t.claimed) ?? null;
}

export function isAchievementClaimable(progress: AchievementProgress): boolean {
  return nextAchievementTier(progress)?.reached ?? false;
}
```

Dans `packages/shared/src/game/index.ts`, ajouter `export * from "./achievements";`.

- [ ] **Step 7 : Titre dans l'état de partie**

Dans `packages/shared/src/game/state.ts` :
- ajouter `import type { AchievementFamily } from "../enums/achievement";` en tête ;
- dans `MyClientState` **et** `OpponentClientState`, juste après `username: string;`, ajouter :

```ts
  /** Titre équipé (famille de succès), absent en sandbox. */
  title?: AchievementFamily | null;
```

- [ ] **Step 8 : Lancer tests, typecheck et build**

Run: `pnpm --filter @pipou/shared test && pnpm --filter @pipou/shared typecheck && pnpm build:shared`
Expected: tout PASS, build OK.

- [ ] **Step 9 : Commit**

```bash
git add packages/shared
git commit -m "feat(shared): achievement catalog, quest pool conditions and API contracts"
```

---

### Task 2 : Backend — migration et entités

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000007-QuestsAchievements.ts`, `apps/backend/src/achievements/user-achievement.entity.ts`
- Modify: `apps/backend/src/users/user.entity.ts`, `apps/backend/src/quests/quest.entity.ts`, `apps/backend/src/users/user-quest.entity.ts`

**Interfaces:**
- Produces:
  - `UserAchievement { id; user; userId: number; family: AchievementFamily; tier: AchievementTier; claimedAt: Date }`.
  - Sur `User` : `equippedTitle: AchievementFamily | null`, `questsCompleted: number`, `lastQuestRerollAt: Date | null`.
  - Sur `Quest` : `poolKey: string | null`.
  - `QuestCondition.minRarity?: Rarity`.
  - `user-quest.entity.ts` ré-exporte `ConditionProgress`/`QuestProgress` de shared.

- [ ] **Step 1 : Migration**

`apps/backend/src/database/migrations/1791000000007-QuestsAchievements.ts` :

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Succès à paliers, pool de quêtes, titre équipé (spec 2026-10-18-quests-achievements-rework). */
export class QuestsAchievements1791000000007 implements MigrationInterface {
  name = 'QuestsAchievements1791000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `user_achievement` (`id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `family` varchar(32) NOT NULL, `tier` enum ('BRONZE', 'SILVER', 'GOLD') NOT NULL, `claimed_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX `UQ_user_achievement_tier` (`user_id`, `family`, `tier`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'ALTER TABLE `user_achievement` ADD CONSTRAINT `FK_user_achievement_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `user` ADD `equipped_title` varchar(32) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `user` ADD `quests_completed` int NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `user` ADD `last_quest_reroll_at` datetime NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `quest` ADD `pool_key` varchar(64) NULL DEFAULT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `quest` ADD UNIQUE INDEX `UQ_quest_pool_key` (`pool_key`)',
    );
    // Remplacées par les succès et le pool seedé ; l'admin peut les réactiver.
    await queryRunner.query(
      "UPDATE `quest` SET `is_active` = 0 WHERE `pool_key` IS NULL AND `reset_type` IN ('NONE', 'DAILY', 'WEEKLY')",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `quest` DROP INDEX `UQ_quest_pool_key`');
    await queryRunner.query('ALTER TABLE `quest` DROP COLUMN `pool_key`');
    await queryRunner.query('ALTER TABLE `user` DROP COLUMN `last_quest_reroll_at`');
    await queryRunner.query('ALTER TABLE `user` DROP COLUMN `quests_completed`');
    await queryRunner.query('ALTER TABLE `user` DROP COLUMN `equipped_title`');
    await queryRunner.query(
      'ALTER TABLE `user_achievement` DROP FOREIGN KEY `FK_user_achievement_user`',
    );
    await queryRunner.query('DROP TABLE `user_achievement`');
  }
}
```

- [ ] **Step 2 : Entité `UserAchievement`**

`apps/backend/src/achievements/user-achievement.entity.ts` :

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AchievementTier, type AchievementFamily } from '@pipou/shared';
import { User } from '../users/user.entity';

/** Palier de succès réclamé (la progression, elle, est calculée). */
@Entity('user_achievement')
@Index('UQ_user_achievement_tier', ['userId', 'family', 'tier'], {
  unique: true,
})
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_achievement_user',
  })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 32 })
  family!: AchievementFamily;

  @Column({ type: 'enum', enum: AchievementTier })
  tier!: AchievementTier;

  @CreateDateColumn({ name: 'claimed_at' })
  claimedAt!: Date;
}
```

- [ ] **Step 3 : Colonnes `user` et `quest`**

Dans `apps/backend/src/users/user.entity.ts` :
- ajouter `import type { AchievementFamily } from '@pipou/shared';` ;
- après la colonne `setsCompleted`, ajouter :

```ts
  @Column({ name: 'equipped_title', type: 'varchar', length: 32, nullable: true, default: null })
  equippedTitle!: AchievementFamily | null;

  @Column({ name: 'quests_completed', default: 0 })
  questsCompleted!: number;

  @Column({ name: 'last_quest_reroll_at', type: 'datetime', nullable: true, default: null })
  lastQuestRerollAt!: Date | null;
```

Dans `apps/backend/src/quests/quest.entity.ts` :
- importer `Index` depuis `typeorm` et `type Rarity` depuis `@pipou/shared` ;
- ajouter `minRarity?: Rarity;` dans l'interface `QuestCondition` ;
- après la colonne `id`, ajouter :

```ts
  /** Identifiant stable des quêtes seedées depuis quest-pool.ts ; null pour les quêtes admin. */
  @Index('UQ_quest_pool_key', { unique: true })
  @Column({ name: 'pool_key', type: 'varchar', length: 64, nullable: true, default: null })
  poolKey!: string | null;
```

- [ ] **Step 4 : Types de progression depuis shared**

Dans `apps/backend/src/users/user-quest.entity.ts` :
- supprimer les interfaces locales `ConditionProgress` et `QuestProgress`, ainsi que l'import de `ConditionOperator`/`ConditionType` devenu inutile ;
- ajouter :

```ts
import type { QuestProgress } from '@pipou/shared';
export type { ConditionProgress, QuestProgress } from '@pipou/shared';
```

- [ ] **Step 5 : Enregistrer l'entité dans TypeORM**

Vérifier comment les entités sont chargées : `grep -n "entities\|autoLoadEntities" apps/backend/src/app.module.ts apps/backend/src/database/data-source.ts`.
- S'il s'agit d'un glob (`**/*.entity{.ts,.js}`), il n'y a rien à faire.
- S'il s'agit d'une liste explicite, ajouter `UserAchievement` aux deux endroits.

- [ ] **Step 6 : Vérifier la migration sur la base docker locale (jamais Aiven)**

Run :
```bash
pnpm --filter @pipou/backend e2e:db
pnpm --filter @pipou/backend migration:run:local
```
Expected : `QuestsAchievements1791000000007 has been executed successfully`.

Vérifier ensuite l'absence de drift : `pnpm --filter @pipou/backend migration:generate` (le script génère contre `.env.e2e` ; si ce n'est pas le cas, le lancer avec `ENV_FILE=.env.e2e`). Il doit indiquer « No changes in database schema were found ». S'il génère un fichier, aligner l'entité sur la migration puis supprimer le fichier généré.

- [ ] **Step 7 : Typecheck et tests**

Run: `pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend test`
Expected: PASS.

- [ ] **Step 8 : Commit**

```bash
git add apps/backend/src
git commit -m "feat(back): user_achievement table, quest pool key and title columns"
```

---

### Task 3 : Backend — valeurs des succès

**Files:**
- Create: `apps/backend/src/achievements/achievement-values.ts`, `apps/backend/src/achievements/achievement-values.spec.ts`, `apps/backend/src/achievements/achievement-stats.service.ts`

**Interfaces:**
- Consumes: `AchievementFamily` (shared), `UsersService.calculateLevelData(exp).level`.
- Produces:
  - `AchievementSources` ;
  - `HIGH_RARITIES` ;
  - `toAchievementValues(src: AchievementSources): Record<AchievementFamily, number>` ;
  - `AchievementStatsService.getValues(userId): Promise<{ values: Record<AchievementFamily, number>; totalSets: number }>`.

- [ ] **Step 1 : Test (échoue)**

`apps/backend/src/achievements/achievement-values.spec.ts` :

```ts
import { AchievementFamily } from '@pipou/shared';
import { toAchievementValues, type AchievementSources } from './achievement-values';

const base: AchievementSources = {
  user: {
    boostersOpened: 12,
    cardsBought: 3,
    cardsSold: 4,
    moneyEarned: '2500',
    questsCompleted: 7,
  },
  level: 6,
  fights: { wins: 2, losses: 3, draws: 1 },
  longestStreak: 9,
  uniqueCards: 40,
  highRarity: 2,
  sets: [
    { total: 10, owned: 10 },
    { total: 8, owned: 7 },
    { total: 0, owned: 0 },
  ],
};

describe('toAchievementValues', () => {
  it('mappe chaque famille sur sa source', () => {
    expect(toAchievementValues(base)).toEqual({
      [AchievementFamily.BOOSTERS_OPENED]: 12,
      [AchievementFamily.CARDS_BOUGHT]: 3,
      [AchievementFamily.CARDS_SOLD]: 4,
      [AchievementFamily.SETS_COMPLETED]: 1,
      [AchievementFamily.DUELS_WON]: 2,
      [AchievementFamily.DUELS_PLAYED]: 6,
      [AchievementFamily.LEVEL]: 6,
      [AchievementFamily.UNIQUE_CARDS]: 40,
      [AchievementFamily.HIGH_RARITY]: 2,
      [AchievementFamily.LOGIN_STREAK]: 9,
      [AchievementFamily.GOLD_EARNED]: 2500,
      [AchievementFamily.QUESTS_DONE]: 7,
    });
  });

  it('compte 0 sans stats de duel ni série', () => {
    const v = toAchievementValues({ ...base, fights: null, longestStreak: null });
    expect(v[AchievementFamily.DUELS_WON]).toBe(0);
    expect(v[AchievementFamily.DUELS_PLAYED]).toBe(0);
    expect(v[AchievementFamily.LOGIN_STREAK]).toBe(0);
  });

  it("ne compte pas un set vide comme complété", () => {
    const v = toAchievementValues({ ...base, sets: [{ total: 0, owned: 0 }] });
    expect(v[AchievementFamily.SETS_COMPLETED]).toBe(0);
  });
});
```

- [ ] **Step 2 : Lancer**

Run: `pnpm --filter @pipou/backend test -- achievement-values`
Expected: FAIL, module introuvable.

- [ ] **Step 3 : Implémentation pure**

`apps/backend/src/achievements/achievement-values.ts` :

```ts
import { AchievementFamily, Rarity } from '@pipou/shared';

/** Raretés comptées par HIGH_RARITY. */
export const HIGH_RARITIES = [Rarity.EPIC, Rarity.LEGENDARY, Rarity.SECRET] as const;

/** Données brutes lues en base (les agrégats SQL arrivent parfois en chaîne). */
export interface AchievementSources {
  user: {
    boostersOpened: number;
    cardsBought: number;
    cardsSold: number;
    moneyEarned: number | string;
    questsCompleted: number;
  };
  level: number;
  fights: { wins: number; losses: number; draws: number } | null;
  longestStreak: number | null;
  uniqueCards: number;
  highRarity: number;
  sets: { total: number; owned: number }[];
}

export function toAchievementValues(
  src: AchievementSources,
): Record<AchievementFamily, number> {
  const f = src.fights ?? { wins: 0, losses: 0, draws: 0 };
  return {
    [AchievementFamily.BOOSTERS_OPENED]: src.user.boostersOpened,
    [AchievementFamily.CARDS_BOUGHT]: src.user.cardsBought,
    [AchievementFamily.CARDS_SOLD]: src.user.cardsSold,
    [AchievementFamily.SETS_COMPLETED]: src.sets.filter(
      (s) => s.total > 0 && s.owned >= s.total,
    ).length,
    [AchievementFamily.DUELS_WON]: f.wins,
    [AchievementFamily.DUELS_PLAYED]: f.wins + f.losses + f.draws,
    [AchievementFamily.LEVEL]: src.level,
    [AchievementFamily.UNIQUE_CARDS]: src.uniqueCards,
    [AchievementFamily.HIGH_RARITY]: src.highRarity,
    [AchievementFamily.LOGIN_STREAK]: src.longestStreak ?? 0,
    [AchievementFamily.GOLD_EARNED]: Number(src.user.moneyEarned),
    [AchievementFamily.QUESTS_DONE]: src.user.questsCompleted,
  };
}
```

- [ ] **Step 4 : Lancer**

Run: `pnpm --filter @pipou/backend test -- achievement-values`
Expected: PASS.

- [ ] **Step 5 : Service de lecture**

`apps/backend/src/achievements/achievement-stats.service.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AchievementFamily } from '@pipou/shared';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { PlayerStats } from '../fights/entities/player-stats.entity';
import { LoginStreak } from '../daily-reward/login-streak.entity';
import { HIGH_RARITIES, toAchievementValues } from './achievement-values';

const HIGH_RARITY_SQL = HIGH_RARITIES.map((r) => `'${r}'`).join(', ');

@Injectable()
export class AchievementStatsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  /** Valeur de chaque famille, lue depuis les compteurs existants (rétroactif par construction). */
  async getValues(
    userId: number,
  ): Promise<{ values: Record<AchievementFamily, number>; totalSets: number }> {
    const [user, fights, streak, cards, sets] = await Promise.all([
      this.dataSource.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'boostersOpened', 'cardsBought', 'cardsSold', 'moneyEarned', 'experience', 'questsCompleted'],
      }),
      this.dataSource.getRepository(PlayerStats).findOne({ where: { userId } }),
      this.dataSource.getRepository(LoginStreak).findOne({ where: { userId } }),
      this.dataSource.query(
        `SELECT COUNT(DISTINCT uc.card_id) AS uniqueCards,
                COALESCE(SUM(CASE WHEN c.rarity IN (${HIGH_RARITY_SQL}) THEN uc.quantity ELSE 0 END), 0) AS highRarity
           FROM user_card uc JOIN card c ON c.id = uc.card_id
          WHERE uc.user_id = ?`,
        [userId],
      ) as Promise<{ uniqueCards: string | number; highRarity: string | number }[]>,
      this.dataSource.query(
        `SELECT COUNT(c.id) AS total, COUNT(owned.card_id) AS owned
           FROM card_set s
           JOIN card c ON c.card_set_id = s.id
           LEFT JOIN (SELECT DISTINCT card_id FROM user_card WHERE user_id = ?) owned
             ON owned.card_id = c.id
          GROUP BY s.id`,
        [userId],
      ) as Promise<{ total: string | number; owned: string | number }[]>,
    ]);

    const setRows = sets.map((s) => ({ total: Number(s.total), owned: Number(s.owned) }));
    const values = toAchievementValues({
      user: user ?? { boostersOpened: 0, cardsBought: 0, cardsSold: 0, moneyEarned: 0, questsCompleted: 0 },
      level: this.usersService.calculateLevelData(user?.experience ?? 0).level,
      fights,
      longestStreak: streak?.longestStreak ?? null,
      uniqueCards: Number(cards[0]?.uniqueCards ?? 0),
      highRarity: Number(cards[0]?.highRarity ?? 0),
      sets: setRows,
    });
    return { values, totalSets: setRows.length };
  }
}
```

Vérifier les noms de colonnes avec `grep -n "CREATE TABLE \`user_card\`" -A8 apps/backend/.e2e/aiven-dump.sql` (lecture du dump local uniquement) : `user_id`, `card_id`, `quantity` ; `card.card_set_id`, `card.rarity`.

- [ ] **Step 6 : Typecheck et commit**

Run: `pnpm --filter @pipou/backend typecheck`
Expected: PASS.

```bash
git add apps/backend/src/achievements
git commit -m "feat(back): compute achievement values from existing counters"
```

---

### Task 4 : Backend — service, contrôleur et module des succès

**Files:**
- Create: `apps/backend/src/achievements/achievement-progress.ts`, `apps/backend/src/achievements/achievements.service.ts`, `apps/backend/src/achievements/achievements.service.spec.ts`, `apps/backend/src/achievements/achievements.controller.ts`, `apps/backend/src/achievements/dto/set-title.dto.ts`, `apps/backend/src/achievements/achievements.module.ts`
- Modify: `apps/backend/src/app.module.ts`, `apps/backend/src/users/users.service.ts` (`getProfile`)

**Interfaces:**
- Consumes: `AchievementStatsService.getValues`, `ACHIEVEMENTS`, `nextAchievementTier`, `findAchievement`, `UserAchievement`, `UsersService.addGold/addBoosterToUser/addBundleToUser`.
- Produces:
  - `buildAchievementsResponse(values, totalSets, claimed, equippedTitle): AchievementsResponse` ;
  - `AchievementsService.getAchievements(userId)`, `.claim(userId, family)`, `.setTitle(userId, family|null)` ;
  - routes `GET /achievements`, `POST /achievements/:family/claim`, `PUT /achievements/title` ;
  - `getProfile` renvoie `equippedTitle`.

- [ ] **Step 1 : Tests (échouent)**

`apps/backend/src/achievements/achievements.service.spec.ts` :

```ts
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ACHIEVEMENT_REWARD_BOOSTER_ID,
  AchievementFamily,
  AchievementTier,
} from '@pipou/shared';
import { AchievementsService } from './achievements.service';
import { buildAchievementsResponse } from './achievement-progress';

const zeroValues = () =>
  Object.fromEntries(Object.values(AchievementFamily).map((f) => [f, 0])) as Record<
    AchievementFamily,
    number
  >;

describe('buildAchievementsResponse', () => {
  it('résout ALL_SETS, marque atteint/réclamé et compte les paliers réclamés', () => {
    const values = { ...zeroValues(), [AchievementFamily.SETS_COMPLETED]: 4, [AchievementFamily.LEVEL]: 16 };
    const res = buildAchievementsResponse(values, 4, [
      { family: AchievementFamily.LEVEL, tier: AchievementTier.BRONZE },
    ], AchievementFamily.LEVEL);

    const sets = res.families.find((f) => f.family === AchievementFamily.SETS_COMPLETED)!;
    expect(sets.tiers.map((t) => t.threshold)).toEqual([1, 3, 4]);
    expect(sets.tiers.every((t) => t.reached)).toBe(true);

    const level = res.families.find((f) => f.family === AchievementFamily.LEVEL)!;
    expect(level.claimedTier).toBe(AchievementTier.BRONZE);
    expect(level.tiers.map((t) => [t.reached, t.claimed])).toEqual([
      [true, true],
      [true, false],
      [false, false],
    ]);
    expect(res).toMatchObject({ unlocked: 1, total: 36, equippedTitle: AchievementFamily.LEVEL });
  });
});

describe('AchievementsService', () => {
  const stats = { getValues: jest.fn() };
  const repo = { find: jest.fn(), insert: jest.fn(), delete: jest.fn(), exists: jest.fn() };
  const userRepo = { findOne: jest.fn(), update: jest.fn() };
  const usersService = { addGold: jest.fn(), addBoosterToUser: jest.fn(), addBundleToUser: jest.fn() };
  const service = new AchievementsService(
    repo as never,
    userRepo as never,
    stats as never,
    usersService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.findOne.mockResolvedValue({ id: 1, equippedTitle: null });
    repo.find.mockResolvedValue([]);
  });

  const withValue = (family: AchievementFamily, value: number) =>
    stats.getValues.mockResolvedValue({ values: { ...zeroValues(), [family]: value }, totalSets: 3 });

  it('réclame le bronze atteint et distribue l’or', async () => {
    withValue(AchievementFamily.DUELS_WON, 1);
    const res = await service.claim(1, AchievementFamily.DUELS_WON);
    expect(res.tier).toBe(AchievementTier.BRONZE);
    expect(repo.insert).toHaveBeenCalledWith({ userId: 1, family: AchievementFamily.DUELS_WON, tier: AchievementTier.BRONZE });
    expect(usersService.addGold).toHaveBeenCalledWith(1, 100);
  });

  it("réclame l'argent après le bronze et distribue le booster", async () => {
    withValue(AchievementFamily.DUELS_WON, 30);
    repo.find.mockResolvedValue([{ family: AchievementFamily.DUELS_WON, tier: AchievementTier.BRONZE }]);
    await service.claim(1, AchievementFamily.DUELS_WON);
    expect(usersService.addBoosterToUser).toHaveBeenCalledWith(1, ACHIEVEMENT_REWARD_BOOSTER_ID, 1);
  });

  it('refuse un palier non atteint', async () => {
    withValue(AchievementFamily.DUELS_WON, 0);
    await expect(service.claim(1, AchievementFamily.DUELS_WON)).rejects.toThrow(BadRequestException);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('juge un palier non réclamé sur la valeur actuelle', async () => {
    withValue(AchievementFamily.HIGH_RARITY, 0);
    repo.find.mockResolvedValue([{ family: AchievementFamily.HIGH_RARITY, tier: AchievementTier.BRONZE }]);
    await expect(service.claim(1, AchievementFamily.HIGH_RARITY)).rejects.toThrow(BadRequestException);
  });

  it('refuse quand tout est réclamé', async () => {
    withValue(AchievementFamily.LEVEL, 99);
    repo.find.mockResolvedValue(
      [AchievementTier.BRONZE, AchievementTier.SILVER, AchievementTier.GOLD].map((tier) => ({ family: AchievementFamily.LEVEL, tier })),
    );
    await expect(service.claim(1, AchievementFamily.LEVEL)).rejects.toThrow(BadRequestException);
  });

  it('transforme un doublon SQL en 409 sans distribuer', async () => {
    withValue(AchievementFamily.LEVEL, 5);
    repo.insert.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
    await expect(service.claim(1, AchievementFamily.LEVEL)).rejects.toThrow(ConflictException);
    expect(usersService.addGold).not.toHaveBeenCalled();
  });

  it('annule le palier si la distribution échoue', async () => {
    withValue(AchievementFamily.LEVEL, 5);
    usersService.addGold.mockRejectedValueOnce(new Error('boom'));
    await expect(service.claim(1, AchievementFamily.LEVEL)).rejects.toThrow('boom');
    expect(repo.delete).toHaveBeenCalledWith({ userId: 1, family: AchievementFamily.LEVEL, tier: AchievementTier.BRONZE });
  });

  it('refuse un titre dont l’or n’est pas réclamé', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(service.setTitle(1, AchievementFamily.LEVEL)).rejects.toThrow(BadRequestException);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('équipe un titre débloqué et permet de le retirer', async () => {
    repo.exists.mockResolvedValue(true);
    await service.setTitle(1, AchievementFamily.LEVEL);
    expect(userRepo.update).toHaveBeenCalledWith(1, { equippedTitle: AchievementFamily.LEVEL });
    await service.setTitle(1, null);
    expect(userRepo.update).toHaveBeenLastCalledWith(1, { equippedTitle: null });
  });
});
```

Le 4ᵉ test fixe la règle de la spec : un palier **réclamé** reste acquis, mais un palier jamais réclamé se juge sur la valeur actuelle.

- [ ] **Step 2 : Lancer**

Run: `pnpm --filter @pipou/backend test -- achievements.service`
Expected: FAIL, modules introuvables.

- [ ] **Step 3 : Construction de la réponse**

`apps/backend/src/achievements/achievement-progress.ts` :

```ts
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_TOTAL,
  ALL_SETS,
  type AchievementFamily,
  type AchievementTier,
  type AchievementsResponse,
} from '@pipou/shared';

export interface ClaimedTier {
  family: AchievementFamily;
  tier: AchievementTier;
}

export function buildAchievementsResponse(
  values: Record<AchievementFamily, number>,
  totalSets: number,
  claimed: ClaimedTier[],
  equippedTitle: AchievementFamily | null,
): AchievementsResponse {
  const isClaimed = (family: AchievementFamily, tier: AchievementTier) =>
    claimed.some((c) => c.family === family && c.tier === tier);

  const families = ACHIEVEMENTS.map((def) => {
    const value = values[def.family];
    const tiers = def.tiers.map((t) => {
      const threshold = t.threshold === ALL_SETS ? totalSets : t.threshold;
      return {
        tier: t.tier,
        threshold,
        reward: t.reward,
        reached: value >= threshold,
        claimed: isClaimed(def.family, t.tier),
      };
    });
    const claimedTiers = tiers.filter((t) => t.claimed);
    return {
      family: def.family,
      value,
      claimedTier: claimedTiers.at(-1)?.tier ?? null,
      tiers,
    };
  });

  return {
    families,
    unlocked: families.reduce((n, f) => n + f.tiers.filter((t) => t.claimed).length, 0),
    total: ACHIEVEMENT_TOTAL,
    equippedTitle,
  };
}
```

- [ ] **Step 4 : Service**

`apps/backend/src/achievements/achievements.service.ts` :

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AchievementTier,
  QuestRewardType,
  nextAchievementTier,
  type AchievementFamily,
  type AchievementReward,
  type AchievementsResponse,
  type ClaimAchievementResponse,
} from '@pipou/shared';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { UserAchievement } from './user-achievement.entity';
import { AchievementStatsService } from './achievement-stats.service';
import { buildAchievementsResponse } from './achievement-progress';

function isDuplicateEntry(err: unknown): boolean {
  const e = err as { code?: string; driverError?: { code?: string } };
  return e?.code === 'ER_DUP_ENTRY' || e?.driverError?.code === 'ER_DUP_ENTRY';
}

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly repo: Repository<UserAchievement>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly stats: AchievementStatsService,
    private readonly usersService: UsersService,
  ) {}

  async getAchievements(userId: number): Promise<AchievementsResponse> {
    const [{ values, totalSets }, claimed, user] = await Promise.all([
      this.stats.getValues(userId),
      this.repo.find({ where: { userId }, select: ['family', 'tier'] }),
      this.userRepo.findOne({ where: { id: userId }, select: ['id', 'equippedTitle'] }),
    ]);
    return buildAchievementsResponse(values, totalSets, claimed, user?.equippedTitle ?? null);
  }

  /** Réclame le prochain palier de la famille, s'il est atteint. */
  async claim(userId: number, family: AchievementFamily): Promise<ClaimAchievementResponse> {
    const { families } = await this.getAchievements(userId);
    const progress = families.find((f) => f.family === family);
    if (!progress) throw new BadRequestException('Succès inconnu.');
    const next = nextAchievementTier(progress);
    if (!next) throw new BadRequestException('Tous les paliers sont déjà réclamés.');
    if (!next.reached) throw new BadRequestException('Palier pas encore atteint.');

    const row = { userId, family, tier: next.tier };
    try {
      await this.repo.insert(row);
    } catch (err) {
      if (isDuplicateEntry(err)) throw new ConflictException('Palier déjà réclamé.');
      throw err;
    }
    try {
      await this.distribute(userId, next.reward);
    } catch (err) {
      await this.repo.delete(row);
      throw err;
    }
    return { family, tier: next.tier, reward: next.reward };
  }

  async setTitle(userId: number, family: AchievementFamily | null) {
    if (family !== null) {
      const unlocked = await this.repo.exists({
        where: { userId, family, tier: AchievementTier.GOLD },
      });
      if (!unlocked) throw new BadRequestException('Titre non débloqué.');
    }
    await this.userRepo.update(userId, { equippedTitle: family });
    return { equippedTitle: family };
  }

  private async distribute(userId: number, reward: AchievementReward) {
    switch (reward.type) {
      case QuestRewardType.GOLD:
        return this.usersService.addGold(userId, reward.amount);
      case QuestRewardType.BOOSTER:
        return this.usersService.addBoosterToUser(userId, reward.itemId!, reward.amount);
      case QuestRewardType.BUNDLE:
        return this.usersService.addBundleToUser(userId, reward.itemId!, reward.amount);
    }
  }
}
```

- [ ] **Step 5 : Lancer les tests**

Run: `pnpm --filter @pipou/backend test -- achievements.service`
Expected: PASS.

- [ ] **Step 6 : DTO, contrôleur, module**

`apps/backend/src/achievements/dto/set-title.dto.ts` :

```ts
import { IsEnum, IsOptional } from 'class-validator';
import { AchievementFamily, type SetTitleRequest } from '@pipou/shared';

export class SetTitleDto implements SetTitleRequest {
  /** null retire le titre. */
  @IsOptional()
  @IsEnum(AchievementFamily)
  family!: AchievementFamily | null;
}
```

`apps/backend/src/achievements/achievements.controller.ts` :

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AchievementFamily } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AchievementsService } from './achievements.service';
import { SetTitleDto } from './dto/set-title.dto';

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  getMine(@Request() req: AuthenticatedRequest) {
    return this.achievements.getAchievements(req.user.userId);
  }

  @Post(':family/claim')
  claim(
    @Param('family', new ParseEnumPipe(AchievementFamily)) family: AchievementFamily,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.achievements.claim(req.user.userId, family);
  }

  @Put('title')
  setTitle(@Body() dto: SetTitleDto, @Request() req: AuthenticatedRequest) {
    return this.achievements.setTitle(req.user.userId, dto.family ?? null);
  }
}
```

`apps/backend/src/achievements/achievements.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { UserAchievement } from './user-achievement.entity';
import { AchievementStatsService } from './achievement-stats.service';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserAchievement, User]), UsersModule],
  controllers: [AchievementsController],
  providers: [AchievementStatsService, AchievementsService],
})
export class AchievementsModule {}
```

Dans `apps/backend/src/app.module.ts`, importer `AchievementsModule` et l'ajouter au tableau `imports`, à côté de `QuestModule`.

- [ ] **Step 7 : Titre dans le profil**

Dans `apps/backend/src/users/users.service.ts`, `getProfile` :
- ajouter `'equippedTitle'` au tableau `select` ;
- dans l'objet retourné, après `isPrivate: user.isPrivate,`, ajouter `equippedTitle: user.equippedTitle,`.

- [ ] **Step 8 : Typecheck, tests, commit**

Run: `pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend test`
Expected: PASS.

```bash
git add apps/backend/src
git commit -m "feat(back): achievements endpoints (list, claim, equip title)"
```

---

### Task 5 : Backend — calendrier des resets, tirage et seed du pool

**Files:**
- Create: `apps/backend/src/quests/quest-schedule.ts`, `apps/backend/src/quests/quest-schedule.spec.ts`, `apps/backend/src/quests/quest-pool.ts`, `apps/backend/src/quests/quest-pool.seeder.ts`, `apps/backend/src/quests/quest-pool.seeder.spec.ts`
- Modify: `apps/backend/src/quests/quests.module.ts`, `apps/backend/src/quests/dto/create-quest.dto.ts`

**Interfaces:**
- Produces:
  - `RESET_HOUR = 4`, `WEEKLY_RESET_DAY = 1`, `POOL_DRAW_SIZE = 3` ;
  - `lastDailyReset(now)`, `nextDailyReset(now)`, `nextWeeklyReset(now)` ;
  - `isRerollAvailable(lastRerollAt: Date | null, now: Date): boolean` ;
  - `drawDistinct<T>(items: T[], n: number, rng?: () => number): T[]` ;
  - `QUEST_POOL: readonly PoolQuest[]`, `poolQuestFields(p): Partial<Quest>` ;
  - `QuestPoolSeeder.seed()`.

- [ ] **Step 1 : Tests du calendrier (échouent)**

`apps/backend/src/quests/quest-schedule.spec.ts` :

```ts
import {
  drawDistinct,
  isRerollAvailable,
  lastDailyReset,
  nextDailyReset,
  nextWeeklyReset,
} from './quest-schedule';

// Dates locales (le serveur raisonne en heure locale, comme computeNextReset).
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('resets', () => {
  it('reset daily : 4h du jour si passé, sinon 4h de la veille', () => {
    expect(lastDailyReset(at(2026, 10, 18, 10))).toEqual(at(2026, 10, 18, 4));
    expect(lastDailyReset(at(2026, 10, 18, 2))).toEqual(at(2026, 10, 17, 4));
    expect(nextDailyReset(at(2026, 10, 18, 2))).toEqual(at(2026, 10, 18, 4));
    expect(nextDailyReset(at(2026, 10, 18, 10))).toEqual(at(2026, 10, 19, 4));
  });

  it('reset hebdo : prochain lundi 4h', () => {
    // 18/10/2026 est un dimanche
    expect(nextWeeklyReset(at(2026, 10, 18, 10))).toEqual(at(2026, 10, 19, 4));
    expect(nextWeeklyReset(at(2026, 10, 19, 3))).toEqual(at(2026, 10, 19, 4));
    expect(nextWeeklyReset(at(2026, 10, 19, 5))).toEqual(at(2026, 10, 26, 4));
  });

  it('relance disponible une fois par journée de jeu', () => {
    const now = at(2026, 10, 18, 10);
    expect(isRerollAvailable(null, now)).toBe(true);
    expect(isRerollAvailable(at(2026, 10, 18, 5), now)).toBe(false);
    expect(isRerollAvailable(at(2026, 10, 18, 3), now)).toBe(true);
  });
});

describe('drawDistinct', () => {
  it('tire n éléments distincts', () => {
    const drawn = drawDistinct([1, 2, 3, 4, 5, 6], 3);
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
  });

  it('rend tout le pool s’il est plus petit que n', () => {
    expect(drawDistinct([1, 2], 3).sort()).toEqual([1, 2]);
  });

  it('est déterministe avec un rng injecté', () => {
    expect(drawDistinct(['a', 'b', 'c'], 1, () => 0)).toEqual(['a']);
  });
});
```

- [ ] **Step 2 : Lancer**

Run: `pnpm --filter @pipou/backend test -- quest-schedule`
Expected: FAIL.

- [ ] **Step 3 : Implémentation**

`apps/backend/src/quests/quest-schedule.ts` :

```ts
export const RESET_HOUR = 4;
/** 0 = dimanche, 1 = lundi. */
export const WEEKLY_RESET_DAY = 1;
/** Quêtes tirées par joueur et par période. */
export const POOL_DRAW_SIZE = 3;

export function lastDailyReset(now: Date): Date {
  const d = new Date(now);
  d.setHours(RESET_HOUR, 0, 0, 0);
  if (d > now) d.setDate(d.getDate() - 1);
  return d;
}

export function nextDailyReset(now: Date): Date {
  const d = lastDailyReset(now);
  d.setDate(d.getDate() + 1);
  return d;
}

export function nextWeeklyReset(now: Date): Date {
  const d = new Date(now);
  d.setHours(RESET_HOUR, 0, 0, 0);
  let days = (WEEKLY_RESET_DAY - d.getDay() + 7) % 7;
  if (days === 0 && d <= now) days = 7;
  d.setDate(d.getDate() + days);
  return d;
}

/** Une relance par journée de jeu (entre deux resets daily). */
export function isRerollAvailable(lastRerollAt: Date | null, now: Date): boolean {
  return !lastRerollAt || lastRerollAt < lastDailyReset(now);
}

/** n éléments distincts tirés uniformément (Fisher-Yates partiel). */
export function drawDistinct<T>(items: T[], n: number, rng: () => number = Math.random): T[] {
  const pool = [...items];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
```

- [ ] **Step 4 : Lancer**

Run: `pnpm --filter @pipou/backend test -- quest-schedule`
Expected: PASS.

- [ ] **Step 5 : Définition du pool**

`apps/backend/src/quests/quest-pool.ts` :

```ts
import {
  ACHIEVEMENT_REWARD_BOOSTER_ID,
  ACHIEVEMENT_REWARD_BUNDLE_ID,
  ConditionOperator,
  QuestConditionType as C,
  QuestResetType,
  QuestRewardType,
  Rarity,
} from '@pipou/shared';
import type { Quest, QuestCondition } from './quest.entity';
import { RESET_HOUR, WEEKLY_RESET_DAY } from './quest-schedule';

type PoolResetType = typeof QuestResetType.DAILY | typeof QuestResetType.WEEKLY;

export interface PoolQuest {
  poolKey: string;
  resetType: PoolResetType;
  condition: QuestCondition;
  rewardType: QuestRewardType;
  rewardAmount: number;
  rewardItemId?: number;
}

const gold = (amount: number) => ({ rewardType: QuestRewardType.GOLD, rewardAmount: amount });
const booster = { rewardType: QuestRewardType.BOOSTER, rewardAmount: 1, rewardItemId: ACHIEVEMENT_REWARD_BOOSTER_ID };
const bundle = { rewardType: QuestRewardType.BUNDLE, rewardAmount: 1, rewardItemId: ACHIEVEMENT_REWARD_BUNDLE_ID };

const daily = (poolKey: string, condition: QuestCondition, reward: Pick<PoolQuest, 'rewardType' | 'rewardAmount' | 'rewardItemId'>): PoolQuest => ({
  poolKey,
  resetType: QuestResetType.DAILY,
  condition,
  ...reward,
});
const weekly = (poolKey: string, condition: QuestCondition, reward: Pick<PoolQuest, 'rewardType' | 'rewardAmount' | 'rewardItemId'>): PoolQuest => ({
  poolKey,
  resetType: QuestResetType.WEEKLY,
  condition,
  ...reward,
});

export const QUEST_POOL: readonly PoolQuest[] = [
  daily('d_open_1', { type: C.OPEN_BOOSTER, amount: 1 }, gold(100)),
  daily('d_open_2', { type: C.OPEN_BOOSTER, amount: 2 }, gold(150)),
  daily('d_open_3', { type: C.OPEN_BOOSTER, amount: 3 }, gold(200)),
  daily('d_play_1', { type: C.PLAY_FIGHT, amount: 1 }, gold(100)),
  daily('d_play_2', { type: C.PLAY_FIGHT, amount: 2 }, gold(150)),
  daily('d_play_3', { type: C.PLAY_FIGHT, amount: 3 }, gold(200)),
  daily('d_win_1', { type: C.WIN_FIGHT, amount: 1 }, gold(150)),
  daily('d_win_2', { type: C.WIN_FIGHT, amount: 2 }, gold(250)),
  daily('d_buy_card_1', { type: C.BUY_CARD, amount: 1 }, gold(100)),
  daily('d_sell_card_1', { type: C.SELL_CARD, amount: 1 }, gold(100)),
  daily('d_list_card_1', { type: C.LIST_CARD, amount: 1 }, gold(100)),
  daily('d_buy_booster_1', { type: C.BUY_BOOSTER, amount: 1 }, gold(100)),
  daily('d_obtain_10', { type: C.OBTAIN_CARD, amount: 10 }, gold(100)),
  daily('d_obtain_rare', { type: C.OBTAIN_CARD, amount: 1, minRarity: Rarity.RARE }, gold(150)),
  daily('d_daily_reward', { type: C.CLAIM_DAILY_REWARD, amount: 1 }, gold(100)),

  weekly('w_open_15', { type: C.OPEN_BOOSTER, amount: 15 }, booster),
  weekly('w_play_15', { type: C.PLAY_FIGHT, amount: 15 }, gold(500)),
  weekly('w_win_10', { type: C.WIN_FIGHT, amount: 10 }, booster),
  weekly('w_buy_card_10', { type: C.BUY_CARD, amount: 10 }, gold(500)),
  weekly('w_sell_card_10', { type: C.SELL_CARD, amount: 10 }, gold(500)),
  weekly('w_earn_1000', { type: C.EARN_GOLD, amount: 1000 }, gold(500)),
  weekly('w_obtain_100', { type: C.OBTAIN_CARD, amount: 100 }, gold(500)),
  weekly('w_obtain_epic_3', { type: C.OBTAIN_CARD, amount: 3, minRarity: Rarity.EPIC }, booster),
  weekly('w_daily_reward_5', { type: C.CLAIM_DAILY_REWARD, amount: 5 }, gold(500)),
  weekly('w_quests_10', { type: C.COMPLETE_QUEST, amount: 10 }, bundle),
];

/** Champs écrits en base pour une quête du pool (isActive n'en fait jamais partie). */
export function poolQuestFields(p: PoolQuest): Partial<Quest> {
  return {
    poolKey: p.poolKey,
    title: `quests.pool.${p.poolKey}`,
    resetType: p.resetType,
    resetHour: RESET_HOUR,
    resetDayOfWeek: p.resetType === QuestResetType.WEEKLY ? WEEKLY_RESET_DAY : undefined,
    conditionGroup: { operator: ConditionOperator.AND, conditions: [p.condition] },
    rewardType: p.rewardType,
    rewardAmount: p.rewardAmount,
    ...(p.rewardItemId !== undefined ? { rewardItemId: p.rewardItemId } : {}),
  };
}
```

- [ ] **Step 6 : Test du seeder (échoue)**

`apps/backend/src/quests/quest-pool.seeder.spec.ts` :

```ts
import { QuestPoolSeeder } from './quest-pool.seeder';
import { QUEST_POOL } from './quest-pool';

describe('QuestPoolSeeder', () => {
  const repo = {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((q: object) => ({ ...q })),
  };
  const seeder = new QuestPoolSeeder(repo as never);

  beforeEach(() => jest.clearAllMocks());

  it('crée les quêtes manquantes, actives', async () => {
    repo.find.mockResolvedValue([]);
    await seeder.seed();
    const saved = repo.save.mock.calls[0][0] as { poolKey: string; isActive: boolean }[];
    expect(saved).toHaveLength(QUEST_POOL.length);
    expect(saved.every((q) => q.isActive)).toBe(true);
  });

  it("met à jour une quête existante sans toucher isActive", async () => {
    const existing = { id: 7, poolKey: 'd_open_1', title: 'ancien', rewardAmount: 1, isActive: false };
    repo.find.mockResolvedValue([existing]);
    await seeder.seed();
    const saved = repo.save.mock.calls[0][0] as { id?: number; poolKey: string; title: string; rewardAmount: number; isActive: boolean }[];
    const updated = saved.find((q) => q.poolKey === 'd_open_1')!;
    expect(updated).toMatchObject({ id: 7, title: 'quests.pool.d_open_1', rewardAmount: 100, isActive: false });
  });
});
```

- [ ] **Step 7 : Seeder**

`apps/backend/src/quests/quest-pool.seeder.ts` :

```ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Quest } from './quest.entity';
import { QUEST_POOL, poolQuestFields } from './quest-pool';

/** Synchronise le pool de quêtes défini en code (par pool_key) à chaque démarrage. */
@Injectable()
export class QuestPoolSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(QuestPoolSeeder.name);

  constructor(@InjectRepository(Quest) private readonly questRepo: Repository<Quest>) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seed();
    } catch (err) {
      this.logger.error(
        'Synchronisation du pool de quêtes en échec',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async seed(): Promise<void> {
    const existing = await this.questRepo.find({
      where: { poolKey: In(QUEST_POOL.map((p) => p.poolKey)) },
    });
    const byKey = new Map(existing.map((q) => [q.poolKey, q]));
    const quests = QUEST_POOL.map((p) => {
      const fields = poolQuestFields(p);
      const current = byKey.get(p.poolKey);
      return current
        ? Object.assign(current, fields)
        : this.questRepo.create({ ...fields, isActive: true });
    });
    await this.questRepo.save(quests);
  }
}
```

Dans `apps/backend/src/quests/quests.module.ts` :
- ajouter `QuestPoolSeeder` aux `providers` ;
- ajouter `User` (import depuis `'../users/user.entity'`) dans `TypeOrmModule.forFeature([Quest, UserQuest, User])`, nécessaire en Task 6.

Dans `apps/backend/src/quests/dto/create-quest.dto.ts`, dans `QuestConditionDto`, sous `rarity` :

```ts
  @IsOptional()
  @IsEnum(Rarity)
  minRarity?: Rarity;
```

Importer `Rarity` depuis `@pipou/shared`, et `IsOptional` s'il n'est pas déjà importé.

- [ ] **Step 8 : Lancer, puis commit**

Run: `pnpm --filter @pipou/backend test -- quest-pool quest-schedule && pnpm --filter @pipou/backend typecheck`
Expected: PASS.

```bash
git add apps/backend/src/quests
git commit -m "feat(back): seeded quest pool and reset schedule helpers"
```

---

### Task 6 : Backend — tirage, relance et nouvelle réponse `GET /quests/me`

**Files:**
- Modify: `apps/backend/src/quests/quests.service.ts`, `apps/backend/src/quests/quests.service.spec.ts`, `apps/backend/src/quests/quests.controller.ts`

**Interfaces:**
- Consumes: `drawDistinct`, `POOL_DRAW_SIZE`, `isRerollAvailable`, `nextDailyReset`, `nextWeeklyReset` (Task 5) ; `User.lastQuestRerollAt` (Task 2).
- Produces:
  - `QuestService.syncUserQuests(userId)` : tirage DAILY/WEEKLY, verrou par joueur ;
  - `getUserQuests(userId)` → `{ DAILY, WEEKLY, MONTHLY, EVENT, rerollAvailable, dailyResetAt, weeklyResetAt }` ;
  - `rerollQuest(userId, userQuestId)` et route `POST /quests/:id/reroll`.

- [ ] **Step 1 : Adapter le module de test**

Dans `apps/backend/src/quests/quests.service.spec.ts` :
- ajouter `remove: jest.fn()` à `mockUserQuestRepo` ;
- ajouter le mock :

```ts
const mockUserRepo = { findOne: jest.fn(), update: jest.fn(), increment: jest.fn() };
```

- ajouter le provider `{ provide: getRepositoryToken(User), useValue: mockUserRepo },`, avec `import { User } from '../users/user.entity';`.

Dans `describe('getUserQuests')`, remplacer les deux tests existants par :

```ts
    it('groupe par type et expose relance + resets', async () => {
      mockUserQuestRepo.find.mockResolvedValue([
        { ...fakeUserQuest, id: 1, quest: { ...fakeQuest, resetType: QuestResetType.DAILY } },
        { ...fakeUserQuest, id: 2, quest: { ...fakeQuest, resetType: QuestResetType.WEEKLY } },
      ]);
      mockUserRepo.findOne.mockResolvedValue({ id: 1, lastQuestRerollAt: null });
      const res = await service.getUserQuests(1);
      expect(res.DAILY.map((q) => q.id)).toEqual([1]);
      expect(res.WEEKLY.map((q) => q.id)).toEqual([2]);
      expect(res.rerollAvailable).toBe(true);
      expect(res.dailyResetAt).toBeInstanceOf(Date);
      expect(res).not.toHaveProperty('ACHIEVEMENT');
    });
```

- [ ] **Step 2 : Tests du tirage et de la relance (échouent)**

Ajouter à la fin du `describe('QuestService')` :

```ts
  describe('tirage du pool', () => {
    const poolQuest = (id: number, resetType = QuestResetType.DAILY) => ({ ...fakeQuest, id, resetType });

    it('tire 3 quêtes distinctes quand le joueur n’en a aucune en cours', async () => {
      mockUserQuestRepo.find.mockResolvedValue([]);
      mockQuestRepo.find.mockImplementation(({ where }: { where: { resetType?: string } }) =>
        Promise.resolve(
          where?.resetType === QuestResetType.DAILY ? [1, 2, 3, 4, 5].map((id) => poolQuest(id)) : [],
        ),
      );
      mockUserQuestRepo.create.mockImplementation((x: object) => x);

      await service['redrawPool'](1, QuestResetType.DAILY);

      const saved = mockUserQuestRepo.save.mock.calls[0][0] as { quest: { id: number } }[];
      expect(saved).toHaveLength(3);
      expect(new Set(saved.map((s) => s.quest.id)).size).toBe(3);
    });

    it('ne retire pas tant qu’une quête du type est en cours', async () => {
      mockUserQuestRepo.find.mockResolvedValue([
        { ...fakeUserQuest, resetAt: new Date(Date.now() + 3_600_000), quest: poolQuest(1) },
      ]);
      await service['redrawPool'](1, QuestResetType.DAILY);
      expect(mockUserQuestRepo.save).not.toHaveBeenCalled();
      expect(mockUserQuestRepo.remove).not.toHaveBeenCalled();
    });

    it('auto-réclame une quête expirée terminée puis la remplace', async () => {
      const expired = {
        ...fakeUserQuest,
        id: 9,
        isCompleted: true,
        rewardClaimed: false,
        resetAt: new Date(Date.now() - 1000),
        quest: poolQuest(1),
      };
      mockUserQuestRepo.find.mockResolvedValue([expired]);
      mockQuestRepo.find.mockResolvedValue([poolQuest(2)]);
      mockUserQuestRepo.create.mockImplementation((x: object) => x);

      const claimed = await service['redrawPool'](1, QuestResetType.DAILY);

      expect(mockUsersService.addGold).toHaveBeenCalledWith(1, 100);
      expect(claimed).toHaveLength(1);
      expect(mockUserQuestRepo.remove).toHaveBeenCalledWith([expired]);
      expect(mockEmitter.emit).toHaveBeenCalledWith('quest.claimed', { userId: 1, userQuestIds: [9] });
    });
  });

  describe('rerollQuest', () => {
    const held = (id: number, questId: number, extra = {}) => ({
      ...fakeUserQuest,
      id,
      resetAt: new Date(Date.now() + 3_600_000),
      quest: { ...fakeQuest, id: questId, resetType: QuestResetType.DAILY },
      ...extra,
    });

    it('remplace par une quête du pool non détenue et consomme la relance', async () => {
      const target = held(1, 10);
      mockUserQuestRepo.findOne.mockResolvedValue(target);
      mockUserRepo.findOne.mockResolvedValue({ id: 1, lastQuestRerollAt: null });
      mockUserQuestRepo.find.mockResolvedValue([target, held(2, 11)]);
      mockQuestRepo.find.mockResolvedValue([10, 11, 12].map((id) => ({ ...fakeQuest, id })));
      mockUserQuestRepo.save.mockImplementation((x: unknown) => Promise.resolve(x));

      const res = await service.rerollQuest(1, 1);

      expect(res.quest.id).toBe(12);
      expect(res.resetAt).toEqual(target.resetAt);
      expect(mockUserRepo.update).toHaveBeenCalledWith(1, { lastQuestRerollAt: expect.any(Date) });
    });

    it('refuse une quête terminée', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue(held(1, 10, { isCompleted: true }));
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('refuse si la relance du jour est utilisée', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue(held(1, 10));
      mockUserRepo.findOne.mockResolvedValue({ id: 1, lastQuestRerollAt: new Date() });
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('refuse si le pool est épuisé', async () => {
      const target = held(1, 10);
      mockUserQuestRepo.findOne.mockResolvedValue(target);
      mockUserRepo.findOne.mockResolvedValue({ id: 1, lastQuestRerollAt: null });
      mockUserQuestRepo.find.mockResolvedValue([target]);
      mockQuestRepo.find.mockResolvedValue([{ ...fakeQuest, id: 10 }]);
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('404 si la quête n’appartient pas au joueur', async () => {
      mockUserQuestRepo.findOne.mockResolvedValue(null);
      await expect(service.rerollQuest(1, 1)).rejects.toThrow(NotFoundException);
    });
  });
```

Dans `describe('computeNextReset (via resetType)')`, remplacer le test DAILY par :

```ts
    it('should return the next 4am for DAILY reset type', () => {
      const result = service['computeNextReset']({ ...fakeQuest, resetType: QuestResetType.DAILY } as Quest);
      expect(result!.getHours()).toBe(4);
      expect(result!.getTime()).toBeGreaterThan(Date.now());
      expect(result!.getTime() - Date.now()).toBeLessThanOrEqual(24 * 3_600_000);
    });
```

- [ ] **Step 3 : Lancer**

Run: `pnpm --filter @pipou/backend test -- quests.service`
Expected: FAIL (`redrawPool`, `rerollQuest` absents ; `getUserQuests` a encore l'ancienne forme).

- [ ] **Step 4 : Implémenter dans `QuestService`**

Dans `apps/backend/src/quests/quests.service.ts` :

1. Imports à ajouter :

```ts
import { User } from '../users/user.entity';
import {
  POOL_DRAW_SIZE,
  drawDistinct,
  isRerollAvailable,
  nextDailyReset,
  nextWeeklyReset,
} from './quest-schedule';
```

Ajouter aussi `MoreThan` à l'import `typeorm` (déjà présent : `LessThan, In`).

2. Au-dessus de la classe :

```ts
/** Types tirés dans un pool ; les autres sont assignés à tous. */
const POOL_TYPES: QuestResetType[] = [QuestResetType.DAILY, QuestResetType.WEEKLY];
```

3. Constructeur : ajouter après `userQuestRepository` :

```ts
    @InjectRepository(User)
    private userRepository: Repository<User>,
```

Ajouter aussi le champ privé `private syncing = new Map<number, Promise<AutoClaimedReward[]>>();`.

4. Remplacer `syncUserQuests` par :

```ts
  /** Un seul sync à la fois par joueur : deux GET simultanés ne doivent pas tirer deux fois. */
  syncUserQuests(userId: number): Promise<AutoClaimedReward[]> {
    const running = this.syncing.get(userId);
    if (running) return running;
    const job = this.doSync(userId).finally(() => this.syncing.delete(userId));
    this.syncing.set(userId, job);
    return job;
  }

  private async doSync(userId: number): Promise<AutoClaimedReward[]> {
    const claimed: AutoClaimedReward[] = [];
    for (const type of POOL_TYPES) claimed.push(...(await this.redrawPool(userId, type)));
    claimed.push(...(await this.resetExpiredQuests(userId)));
    await this.removeInactiveUserQuests(userId);
    await this.assignMissingQuests(userId);
    return claimed;
  }

  /** Nouveau tirage du pool `type` quand plus aucune quête de ce type n'est en cours. */
  private async redrawPool(userId: number, type: QuestResetType): Promise<AutoClaimedReward[]> {
    const now = new Date();
    const held = await this.userQuestRepository.find({
      where: { user: { id: userId }, quest: { resetType: type } },
      relations: { quest: true },
    });
    if (held.some((uq) => uq.resetAt && uq.resetAt > now)) return [];

    const claimed = await this.autoClaim(userId, held);
    if (held.length > 0) await this.userQuestRepository.remove(held);

    const pool = await this.questRepository.find({ where: { resetType: type, isActive: true } });
    const drawn = drawDistinct(pool, POOL_DRAW_SIZE);
    if (drawn.length > 0) {
      await this.userQuestRepository.save(
        drawn.map((quest) =>
          this.userQuestRepository.create({
            user: { id: userId },
            quest,
            progress: this.initProgress(quest),
            isCompleted: false,
            rewardClaimed: false,
            resetAt: this.computeNextReset(quest),
          }),
        ),
      );
    }
    return claimed;
  }

  /** Distribue les récompenses terminées mais non réclamées (avant reset ou suppression). */
  private async autoClaim(userId: number, userQuests: UserQuest[]): Promise<AutoClaimedReward[]> {
    const claimed: AutoClaimedReward[] = [];
    for (const uq of userQuests) {
      if (!uq.isCompleted || uq.rewardClaimed) continue;
      await this.distributeReward(userId, uq.quest);
      claimed.push({
        title: uq.quest.title,
        rewardType: uq.quest.rewardType,
        rewardAmount: Number(uq.quest.rewardAmount),
      });
      this.eventEmitter.emit('quest.claimed', { userId, userQuestIds: [uq.id] });
    }
    return claimed;
  }
```

5. Dans `resetExpiredQuests` :
- restreindre la requête aux types hors pool : `where: { user: { id: userId }, resetAt: LessThan(now), quest: { resetType: Not(In(POOL_TYPES)) } }` (ajouter `Not` à l'import `typeorm`) ;
- remplacer le bloc `if (uq.isCompleted && !uq.rewardClaimed) { … }` par `claimed.push(...(await this.autoClaim(userId, [uq])));`.

6. Dans `assignMissingQuests`, filtrer le pool : `where: { isActive: true, resetType: Not(In(POOL_TYPES)) }`.

7. Remplacer `getUserQuests` par :

```ts
  async getUserQuests(userId: number) {
    const now = new Date();
    const [userQuests, user] = await Promise.all([
      this.userQuestRepository.find({
        where: { user: { id: userId } },
        relations: { quest: true },
        order: { assignedAt: 'DESC' },
      }),
      this.userRepository.findOne({ where: { id: userId }, select: ['id', 'lastQuestRerollAt'] }),
    ]);

    const mapped = userQuests.map((uq) => ({
      id: uq.id,
      questId: uq.quest.id,
      title: uq.quest.title,
      description: uq.quest.description ?? null,
      resetType: uq.quest.resetType,
      rewardType: uq.quest.rewardType,
      rewardAmount: Number(uq.quest.rewardAmount),
      rewardItemId: uq.quest.rewardItemId ?? null,
      progress: uq.progress,
      isCompleted: uq.isCompleted,
      rewardClaimed: uq.rewardClaimed,
      resetAt: uq.resetAt,
    }));
    const of = (type: QuestResetType) => mapped.filter((q) => q.resetType === type);

    return {
      DAILY: of(QuestResetType.DAILY),
      WEEKLY: of(QuestResetType.WEEKLY),
      MONTHLY: of(QuestResetType.MONTHLY),
      EVENT: of(QuestResetType.EVENT),
      rerollAvailable: isRerollAvailable(user?.lastQuestRerollAt ?? null, now),
      dailyResetAt: nextDailyReset(now),
      weeklyResetAt: nextWeeklyReset(now),
    };
  }
```

8. Ajouter après `claimAllRewards` :

```ts
  /** Remplace une quête daily/hebdo non terminée ; une relance par journée de jeu. */
  async rerollQuest(userId: number, userQuestId: number) {
    const uq = await this.userQuestRepository.findOne({
      where: { id: userQuestId, user: { id: userId } },
      relations: { quest: true },
    });
    if (!uq) throw new NotFoundException('Quest not found');
    if (uq.isCompleted) throw new BadRequestException('Quête déjà terminée.');
    if (!POOL_TYPES.includes(uq.quest.resetType))
      throw new BadRequestException('Cette quête ne peut pas être changée.');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'lastQuestRerollAt'],
    });
    if (!isRerollAvailable(user?.lastQuestRerollAt ?? null, new Date()))
      throw new BadRequestException('Relance du jour déjà utilisée.');

    const held = await this.userQuestRepository.find({
      where: { user: { id: userId } },
      relations: { quest: true },
    });
    const heldIds = new Set(held.map((h) => h.quest.id));
    const candidates = (
      await this.questRepository.find({ where: { resetType: uq.quest.resetType, isActive: true } })
    ).filter((q) => !heldIds.has(q.id));
    const [replacement] = drawDistinct(candidates, 1);
    if (!replacement) throw new BadRequestException('Aucune autre quête disponible.');

    uq.quest = replacement;
    uq.progress = this.initProgress(replacement);
    uq.rewardClaimed = false;
    uq.completedAt = null;
    const saved = await this.userQuestRepository.save(uq);
    await this.userRepository.update(userId, { lastQuestRerollAt: new Date() });
    return saved;
  }
```

9. Dans `computeNextReset`, remplacer les cas `DAILY` et `WEEKLY` par l'usage des helpers (on garde `MONTHLY` tel quel) :

```ts
      case QuestResetType.DAILY:
        return nextDailyReset(now);

      case QuestResetType.WEEKLY:
        return nextWeeklyReset(now);
```

Tous les résets du pool ont lieu à 4h le lundi. On ignore donc `resetHour`/`resetDayOfWeek` pour ces deux types : les quêtes d'un même tirage doivent partager le même `resetAt`.

- [ ] **Step 5 : Route de relance**

Dans `apps/backend/src/quests/quests.controller.ts`, après `claimReward` :

```ts
  @UseGuards(JwtAuthGuard)
  @Post(':id/reroll')
  reroll(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.questService.rerollQuest(req.user.userId, id);
  }
```

- [ ] **Step 6 : Lancer**

Run: `pnpm --filter @pipou/backend test -- quests && pnpm --filter @pipou/backend typecheck`
Expected: PASS.

Si un autre test existant (`resetExpiredQuests`, `assignMissingQuests`) vérifie les anciens filtres `where`, adapter ses attentes aux nouveaux filtres. Ne pas affaiblir la vérification.

- [ ] **Step 7 : Commit**

```bash
git add apps/backend/src/quests
git commit -m "feat(back): draw 3 daily/weekly quests from the pool with a daily reroll"
```

---

### Task 7 : Backend — nouvelles conditions et événements

**Files:**
- Modify: `apps/backend/src/quests/quests.service.ts` (+spec), `apps/backend/src/fights/services/game-end.service.ts` (+spec), `apps/backend/src/fights/fights.module.ts` (seulement si `EventEmitter2` n'est pas global : il l'est via `EventEmitterModule.forRoot()`, donc rien à faire), `apps/backend/src/boosters/boosters.service.ts`, `apps/backend/src/transactions/transactions.service.ts`, `apps/backend/src/daily-reward/daily-reward.service.ts` (+spec)

**Interfaces:**
- Produces, côté événements :
  - `fight.finished` `{ player1Id, player2Id, winnerId: number | null }` ;
  - `booster.opened` reçoit en plus `rarities: Rarity[]` (une entrée par carte tirée) ;
  - `listing.created` reçoit en plus `sellerId` ;
  - `daily-reward.claimed` `{ userId }`.
- Produces, côté `QuestEventMeta` : `rarity?: Rarity`. `updateProgress` gère `minRarity`.
- `track()` incrémente `user.questsCompleted` à chaque quête terminée, et émet `COMPLETE_QUEST` pour les DAILY terminées.

- [ ] **Step 1 : Tests du suivi (échouent)**

Dans `quests.service.spec.ts`, ajouter :

```ts
  describe('nouvelles conditions', () => {
    const uqWith = (condition: Record<string, unknown>, resetType = QuestResetType.DAILY) => ({
      ...fakeUserQuest,
      id: 5,
      quest: { ...fakeQuest, resetType },
      progress: {
        operator: ConditionOperator.AND,
        conditions: [{ current: 0, completed: false, ...condition }],
        globalCompleted: false,
      },
    });

    it('OBTAIN_CARD + minRarity ne compte que les cartes assez rares', async () => {
      const uq = uqWith({ type: ConditionType.OBTAIN_CARD, target: 2, minRarity: 'rare' });
      mockUserQuestRepo.find.mockResolvedValue([uq]);
      await service.handleBoosterOpened({
        userId: 1,
        boosterId: 1,
        setId: 1,
        amount: 1,
        rarities: ['common', 'common', 'epic'],
      });
      expect(uq.progress.conditions[0].current).toBe(1);
    });

    it('fight.finished : PLAY_FIGHT pour les deux, WIN_FIGHT pour le gagnant', async () => {
      const track = jest.spyOn(service, 'track').mockResolvedValue(undefined);
      await service.handleFightFinished({ player1Id: 1, player2Id: 2, winnerId: 2 });
      expect(track).toHaveBeenCalledWith(1, ConditionType.PLAY_FIGHT);
      expect(track).toHaveBeenCalledWith(2, ConditionType.PLAY_FIGHT);
      expect(track).toHaveBeenCalledWith(2, ConditionType.WIN_FIGHT);
      expect(track).not.toHaveBeenCalledWith(1, ConditionType.WIN_FIGHT);
    });

    it('listing.sold : EARN_GOLD du montant pour le vendeur', async () => {
      const track = jest.spyOn(service, 'track').mockResolvedValue(undefined);
      await service.handleListingSold({ sellerId: 3, totalPrice: 450 });
      expect(track).toHaveBeenCalledWith(3, ConditionType.EARN_GOLD, { amount: 450 });
    });

    it('listing.created : LIST_CARD seulement pour une carte', async () => {
      const track = jest.spyOn(service, 'track').mockResolvedValue(undefined);
      await service.handleListingCreated({ sellerId: 3, productType: 'BOOSTER' });
      expect(track).not.toHaveBeenCalled();
      await service.handleListingCreated({ sellerId: 3, productType: 'CARD' });
      expect(track).toHaveBeenCalledWith(3, ConditionType.LIST_CARD);
    });

    it('une daily terminée incrémente questsCompleted et alimente COMPLETE_QUEST', async () => {
      const daily = uqWith({ type: ConditionType.OPEN_BOOSTER, target: 1 });
      const weekly = uqWith({ type: ConditionType.COMPLETE_QUEST, target: 10 }, QuestResetType.WEEKLY);
      mockUserQuestRepo.find.mockResolvedValueOnce([daily]).mockResolvedValueOnce([weekly]);
      await service.track(1, ConditionType.OPEN_BOOSTER, { amount: 1 });
      expect(mockUserRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'questsCompleted', 1);
      expect(weekly.progress.conditions[0].current).toBe(1);
    });
  });
```

Le type de `productType` dans le test doit correspondre à `ProductType` de shared : vérifier ses valeurs (`grep -n "ProductType" -A5 packages/shared/src/enums/commerce.ts`) et utiliser `ProductType.CARD` / `ProductType.BOOSTER` à la place des littéraux si elles diffèrent.

- [ ] **Step 2 : Lancer**

Run: `pnpm --filter @pipou/backend test -- quests.service`
Expected: FAIL.

- [ ] **Step 3 : Implémenter le suivi dans `QuestService`**

1. Dans `QuestEventMeta`, remplacer `rarity?: string;` par `rarity?: Rarity;` et importer `Rarity`, `rarityAtLeast`, `ProductType` depuis `@pipou/shared`.

2. Dans `initProgress`, ajouter `minRarity: c.minRarity,` dans l'objet de condition.

3. Dans `updateProgress`, après la ligne du filtre `rarity` :

```ts
      if (condition.minRarity && (!meta.rarity || !rarityAtLeast(meta.rarity, condition.minRarity)))
        continue;
```

4. Remplacer `track` par :

```ts
  async track(
    userId: number,
    eventType: ConditionType,
    meta: QuestEventMeta = {},
  ) {
    const userQuests = await this.userQuestRepository.find({
      where: { user: { id: userId }, isCompleted: false },
      relations: { quest: true },
    });

    let completed = 0;
    let dailyCompleted = 0;
    for (const uq of userQuests) {
      const updated = this.updateProgress(uq, eventType, meta);
      if (!updated) continue;
      await this.userQuestRepository.save(uq);
      // track() ne charge que des quêtes non terminées : terminée ici = vient de l'être
      if (uq.isCompleted) {
        completed++;
        if (uq.quest.resetType === QuestResetType.DAILY) dailyCompleted++;
        this.eventEmitter.emit('quest.completed', {
          userId,
          userQuestId: uq.id,
          title: uq.quest.title,
          rewardType: uq.quest.rewardType,
          rewardAmount: Number(uq.quest.rewardAmount),
        });
      }
    }

    if (completed > 0)
      await this.userRepository.increment({ id: userId }, 'questsCompleted', completed);
    if (dailyCompleted > 0)
      await this.track(userId, ConditionType.COMPLETE_QUEST, { amount: dailyCompleted });
  }
```

La récursion s'arrête d'elle-même : `COMPLETE_QUEST` n'existe que dans des quêtes WEEKLY, donc `dailyCompleted` vaut 0 au second appel.

5. Remplacer `handleBoosterOpened` par :

```ts
  @OnEvent('booster.opened')
  async handleBoosterOpened(payload: {
    userId: number;
    boosterId: number;
    setId: number;
    amount: number;
    rarities?: Rarity[];
  }) {
    await this.track(payload.userId, ConditionType.OPEN_BOOSTER, {
      boosterId: payload.boosterId,
      setId: payload.setId,
      amount: payload.amount,
    });

    const byRarity = new Map<Rarity, number>();
    for (const r of payload.rarities ?? []) byRarity.set(r, (byRarity.get(r) ?? 0) + 1);
    for (const [rarity, amount] of byRarity) {
      await this.track(payload.userId, ConditionType.OBTAIN_CARD, {
        rarity,
        amount,
        setId: payload.setId,
      });
    }

    await this.checkSetCompletion(payload.userId, payload.setId);
  }
```

6. Ajouter les gestionnaires après `handleSetCheck` :

```ts
  @OnEvent('fight.finished')
  async handleFightFinished(payload: { player1Id: number; player2Id: number; winnerId: number | null }) {
    for (const id of [payload.player1Id, payload.player2Id]) {
      await this.track(id, ConditionType.PLAY_FIGHT);
    }
    if (payload.winnerId !== null) await this.track(payload.winnerId, ConditionType.WIN_FIGHT);
  }

  @OnEvent('listing.sold')
  async handleListingSold(payload: { sellerId: number; totalPrice: number }) {
    await this.track(payload.sellerId, ConditionType.EARN_GOLD, { amount: Number(payload.totalPrice) });
  }

  @OnEvent('listing.created')
  async handleListingCreated(payload: { sellerId: number; productType: string }) {
    if (payload.productType !== ProductType.CARD) return;
    await this.track(payload.sellerId, ConditionType.LIST_CARD);
  }

  @OnEvent('daily-reward.claimed')
  async handleDailyRewardClaimed(payload: { userId: number }) {
    await this.track(payload.userId, ConditionType.CLAIM_DAILY_REWARD);
  }
```

- [ ] **Step 4 : Émetteurs**

`apps/backend/src/boosters/boosters.service.ts`, dans l'`emit('booster.opened', …)`, ajouter `rarities: drawnCards.map((card) => card.rarity),`.

`apps/backend/src/transactions/transactions.service.ts`, dans l'`emit('listing.created', …)`, ajouter `sellerId: saved.seller.id,`.

`apps/backend/src/fights/services/game-end.service.ts` :
- importer `EventEmitter2` depuis `@nestjs/event-emitter` ;
- ajouter `private eventEmitter: EventEmitter2,` en 3ᵉ paramètre du constructeur ;
- à la fin de `persistResult`, après `statsRepo.save` :

```ts
    this.eventEmitter.emit('fight.finished', {
      player1Id: game.player1.userId,
      player2Id: game.player2.userId,
      winnerId,
    });
```

Dans `apps/backend/src/fights/services/game-end.service.spec.ts` :
- remplacer `new GameEndService(matchRepo as never, statsRepo as never)` par `new GameEndService(matchRepo as never, statsRepo as never, emitter as never)` ;
- déclarer `const emitter = { emit: jest.fn() };` à côté des repos ;
- ajouter dans le test où P1 gagne :

```ts
    expect(emitter.emit).toHaveBeenCalledWith('fight.finished', {
      player1Id: P1_ID,
      player2Id: P2_ID,
      winnerId: P1_ID,
    });
```

`apps/backend/src/daily-reward/daily-reward.service.ts` :
- importer `EventEmitter2` ;
- ajouter `private readonly eventEmitter: EventEmitter2,` en dernier paramètre du constructeur ;
- dans `claimDaily`, juste avant le `return { status: 'claimed', … }` final, ajouter `this.eventEmitter.emit('daily-reward.claimed', { userId });`.

Dans `apps/backend/src/daily-reward/daily-reward.service.spec.ts`, ajouter un 7ᵉ argument `{ emit: jest.fn() } as never` aux deux `new DailyRewardService(…)`. Dans le test qui réclame avec succès (vers la ligne 102), garder une référence à l'emitter et ajouter `expect(emitter.emit).toHaveBeenCalledWith('daily-reward.claimed', { userId: <id du test> });`.

- [ ] **Step 5 : Lancer toute la suite back**

Run: `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add apps/backend/src
git commit -m "feat(back): track duels, card drops, listings, gold earned, daily claims and completed quests"
```

---

### Task 8 : Backend — titre dans l'état de duel

**Files:**
- Modify: `apps/backend/src/fights/services/matchmaking.service.ts`, `apps/backend/src/fights/helpers/game-factory.ts`, `apps/backend/src/fights/interfaces/game-state.interface.ts`, `apps/backend/src/fights/helpers/client-state.builder.ts`
- Test: `apps/backend/src/fights/helpers/client-state.builder.spec.ts` (s'il existe ; sinon le créer)

**Interfaces:**
- Consumes: `User.equippedTitle`.
- Produces:
  - `QueueEntry.title?: AchievementFamily | null`, `SeatEntry.title?` ;
  - `PlayerGameState.title?: AchievementFamily | null` ;
  - `me.title` / `opponent.title` dans l'état client.

- [ ] **Step 1 : Test (échoue)**

Repérer la fonction de construction exportée par `client-state.builder.ts` (`grep -n "export function" apps/backend/src/fights/helpers/client-state.builder.ts`), puis ajouter un test qui :
- part d'un `GameState` de fixture (voir `apps/backend/src/fights/testing/` : `scenario()` est utilisé dans `fights.service.spec.ts`) ;
- fixe `game.player2.title = 'LEVEL'` ;
- construit la vue de `player1` ;
- vérifie `view.opponent.title === 'LEVEL'` et `view.me.title === null`.

```ts
import { AchievementFamily } from '@pipou/shared';
import { scenario } from '../testing/<fichier qui exporte scenario>';
import { buildClientState } from './client-state.builder'; // nom réel relevé au grep

it('expose le titre équipé des deux joueurs', () => {
  const game = scenario();
  game.player2.title = AchievementFamily.LEVEL;
  const view = buildClientState(game, game.player1.userId);
  expect(view.opponent.title).toBe(AchievementFamily.LEVEL);
  expect(view.me.title).toBeNull();
});
```

Run: `pnpm --filter @pipou/backend test -- client-state`
Expected: FAIL (`title` undefined).

- [ ] **Step 2 : Implémenter**

`interfaces/game-state.interface.ts`, dans `PlayerGameState`, après `username` : `title?: AchievementFamily | null;` (importer le type depuis `@pipou/shared`).

`helpers/game-factory.ts` :
- `SeatEntry` reçoit `title?: AchievementFamily | null;` ;
- `createPlayerState` ajoute `title: entry.title ?? null,` après `username`.

`helpers/client-state.builder.ts` : ajouter `title: me.title ?? null,` après `username: me.username,` (ligne ~52), et `title: opp.title ?? null,` après `username: opp.username,` (ligne ~66).

`services/matchmaking.service.ts` :
- `QueueEntry` reçoit `title?: AchievementFamily | null;` ;
- importer `In` depuis `typeorm` et `User` depuis `'../../users/user.entity'` ;
- dans `joinQueue`, juste avant `return { matchId: match.id, p1, p2 };` :

```ts
    const titles = await this.matchRepo.manager.getRepository(User).find({
      where: { id: In([p1.userId, p2.userId]) },
      select: ['id', 'equippedTitle'],
    });
    const titleOf = (id: number) => titles.find((u) => u.id === id)?.equippedTitle ?? null;

    return {
      matchId: match.id,
      p1: { ...p1, title: titleOf(p1.userId) },
      p2: { ...p2, title: titleOf(p2.userId) },
    };
```

Si un test de `MatchmakingService` mocke `matchRepo` sans `manager`, ajouter `manager: { getRepository: () => ({ find: jest.fn().mockResolvedValue([]) }) }` au mock.

- [ ] **Step 3 : Lancer**

Run: `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add apps/backend/src/fights
git commit -m "feat(back): send equipped titles in duel state"
```

---

### Task 9 : Front — services, hooks et onglets Daily/Hebdo

**Files:**
- Create: `apps/frontend/src/services/achievement.service.ts`, `apps/frontend/src/features/quests/RewardLabel.tsx`, `apps/frontend/src/features/quests/useCountdown.ts`, `apps/frontend/src/features/quests/questTitle.ts`, `apps/frontend/src/__tests__/components/QuestsPanel.test.tsx`
- Modify: `apps/frontend/src/services/quest.service.ts`, `apps/frontend/src/services/user.service.ts`, `apps/frontend/src/hooks/useGameData.ts`, `apps/frontend/src/utils/querykeys.ts`, `apps/frontend/src/features/profile/QuestsPanel.tsx`, `apps/frontend/src/features/profile/QuestsPanel.css`, `apps/frontend/src/features/inbox/InboxItem.tsx`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`

**Interfaces:**
- Consumes: `UserQuestsResponse`, `UserQuest`, `QUEST_LIST_KEYS`, `AchievementsResponse`, `ClaimAchievementResponse`, `AchievementFamily` (shared).
- Produces:
  - `achievementService.getMine()`, `.claim(family)`, `.setTitle(family|null)` ;
  - `questService.reroll(id)` ;
  - hooks `useAchievements()`, `useClaimAchievement()`, `useSetTitle()`, `useRerollQuest()` ;
  - `QUERY_KEYS.achievements` ;
  - `<RewardLabel type amount />`, `useCountdown(resetAt, t)`, `formatTimeRemaining`, `questTitle(title)` ;
  - `UserProfile.equippedTitle`.

- [ ] **Step 1 : Services et clés**

`apps/frontend/src/services/achievement.service.ts` :

```ts
import { api } from "../api/api";
import type {
  AchievementFamily,
  AchievementsResponse,
  ClaimAchievementResponse,
  SetTitleRequest,
} from "@pipou/shared";

export const achievementService = {
  async getMine(): Promise<AchievementsResponse> {
    const res = await api.get("/achievements");
    return res.data;
  },

  async claim(family: AchievementFamily): Promise<ClaimAchievementResponse> {
    const res = await api.post(`/achievements/${family}/claim`);
    return res.data;
  },

  async setTitle(family: AchievementFamily | null) {
    const body: SetTitleRequest = { family };
    const res = await api.put("/achievements/title", body);
    return res.data as { equippedTitle: AchievementFamily | null };
  },
};
```

Dans `apps/frontend/src/services/quest.service.ts` :
- supprimer `ConditionProgress`, `QuestProgress`, `UserQuest` et `UserQuestsGrouped` ;
- ajouter `import type { UserQuestsResponse } from "@pipou/shared";` ;
- typer `getMyQuests(): Promise<UserQuestsResponse>` ;
- ajouter :

```ts
  async reroll(userQuestId: number) {
    const res = await api.post(`/quests/${userQuestId}/reroll`);
    return res.data;
  },
```

Lancer `grep -rn "UserQuestsGrouped\|from \"../../services/quest.service\"" apps/frontend/src` et remplacer chaque usage de `UserQuest`/`UserQuestsGrouped` par l'import shared (`UserQuest`, `UserQuestsResponse`).

Dans `apps/frontend/src/services/user.service.ts`, `UserProfile` reçoit `equippedTitle: AchievementFamily | null;` (`import type { AchievementFamily } from "@pipou/shared";`).

Dans `apps/frontend/src/utils/querykeys.ts`, sous `quests` : `achievements: ["user", "achievements"] as const,`.

- [ ] **Step 2 : Hooks**

Dans `apps/frontend/src/hooks/useGameData.ts` :
- importer `achievementService`, `QUEST_LIST_KEYS`, `type AchievementFamily`, `type UserQuestsResponse` ;
- dans `useClaimReward.onMutate`, remplacer le `setQueryData<UserQuestsGrouped>` et sa boucle `Object.keys(updated)` par :

```ts
      queryClient.setQueryData<UserQuestsResponse>(QUERY_KEYS.quests, (old) => {
        if (!old) return old;
        const updated = { ...old };
        for (const key of QUEST_LIST_KEYS) {
          updated[key] = old[key].map((q) =>
            q.id === userQuestId ? { ...q, rewardClaimed: true } : q,
          );
        }
        return updated;
      });
```

- ajouter en fin de fichier :

```ts
export const useRerollQuest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userQuestId: number) => questService.reroll(userQuestId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests }),
  });
};

export const useAchievements = () =>
  useQuery({
    queryKey: QUERY_KEYS.achievements,
    queryFn: () => achievementService.getMine(),
  });

export const useClaimAchievement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (family: AchievementFamily) => achievementService.claim(family),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
    },
  });
};

export const useSetTitle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (family: AchievementFamily | null) => achievementService.setTitle(family),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achievements });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
    },
  });
};
```

(Vérifier que `useMutation`, `useQuery` et `useQueryClient` sont déjà importés en tête ; sinon les ajouter.)

- [ ] **Step 3 : Petits modules extraits de `QuestsPanel`**

`apps/frontend/src/features/quests/RewardLabel.tsx` :

```tsx
import type { QuestRewardType } from "@pipou/shared";
import { IconBooster, IconBundle, IconGold } from "../../components/Icons";

const ICONS = { GOLD: IconGold, BOOSTER: IconBooster, BUNDLE: IconBundle } as const;

export default function RewardLabel({ type, amount }: { type: QuestRewardType; amount: number }) {
  const Icon = ICONS[type];
  return (
    <span className="quest-item__reward">
      <Icon size={13} color="#eebc77" /> +{amount}
    </span>
  );
}
```

`apps/frontend/src/features/quests/useCountdown.ts` : déplacer tel quel `Translate`, `formatTimeRemaining` et `useCountdown` depuis `QuestsPanel.tsx` (lignes 50-81), en les exportant :

```ts
import { useEffect, useState } from "react";

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export function formatTimeRemaining(resetAt: string | null, t: Translate, now: number): string {
  if (!resetAt) return t("quests.permanent");
  const diff = new Date(resetAt).getTime() - now;
  if (diff <= 0) return t("quests.expired");
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return t("quests.remaining_days", { d, h });
  if (h > 0) return t("quests.remaining_hours", { h, m });
  if (m > 0) return t("quests.remaining_mins", { m, s });
  return t("quests.remaining_secs", { s });
}

/** Libellé du temps restant, rafraîchi chaque seconde (l'horloge avance, le libellé est dérivé). */
export function useCountdown(resetAt: string | null, t: Translate): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!resetAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [resetAt]);
  return formatTimeRemaining(resetAt, t, now);
}
```

`apps/frontend/src/features/quests/questTitle.ts` :

```ts
import i18n from "../../i18n";

/** Les quêtes du pool stockent une clé i18n ; les quêtes admin, un texte libre. */
export function questTitle(title: string): string {
  return i18n.exists(title) ? i18n.t(title) : title;
}
```

Dans `apps/frontend/src/features/inbox/InboxItem.tsx`, pour `QUEST_COMPLETED` (ligne ~52), remplacer `{title}` par `{questTitle(title)}` et importer `questTitle`.

- [ ] **Step 4 : Traductions des onglets et des quêtes**

Dans `fr.json`, sous `"quests"` :
- ajouter `"reset": "Reset dans"`, `"reroll": "Changer cette quête"`, `"reroll_hint": "1 relance par jour"` ;
- ajouter le bloc `"pool"` :

```json
"pool": {
  "d_open_1": "Ouvre 1 booster",
  "d_open_2": "Ouvre 2 boosters",
  "d_open_3": "Ouvre 3 boosters",
  "d_play_1": "Joue 1 duel",
  "d_play_2": "Joue 2 duels",
  "d_play_3": "Joue 3 duels",
  "d_win_1": "Gagne 1 duel",
  "d_win_2": "Gagne 2 duels",
  "d_buy_card_1": "Achète 1 carte au marché",
  "d_sell_card_1": "Vends 1 carte au marché",
  "d_list_card_1": "Mets 1 carte en vente",
  "d_buy_booster_1": "Achète 1 booster",
  "d_obtain_10": "Obtiens 10 cartes",
  "d_obtain_rare": "Obtiens 1 carte rare ou mieux",
  "d_daily_reward": "Réclame ta récompense quotidienne",
  "w_open_15": "Ouvre 15 boosters",
  "w_play_15": "Joue 15 duels",
  "w_win_10": "Gagne 10 duels",
  "w_buy_card_10": "Achète 10 cartes au marché",
  "w_sell_card_10": "Vends 10 cartes au marché",
  "w_earn_1000": "Gagne 1 000 or au marché",
  "w_obtain_100": "Obtiens 100 cartes",
  "w_obtain_epic_3": "Obtiens 3 cartes épiques ou mieux",
  "w_daily_reward_5": "Réclame ta récompense quotidienne 5 fois",
  "w_quests_10": "Termine 10 quêtes quotidiennes"
}
```

Remplacer aussi `"weekly": "Weekly"` par `"weekly": "Hebdo"`.

`en.json`, sous `"quests"` : `"reset": "Resets in"`, `"reroll": "Swap this quest"`, `"reroll_hint": "1 swap per day"`, et `"pool"` :

```json
"pool": {
  "d_open_1": "Open 1 booster",
  "d_open_2": "Open 2 boosters",
  "d_open_3": "Open 3 boosters",
  "d_play_1": "Play 1 duel",
  "d_play_2": "Play 2 duels",
  "d_play_3": "Play 3 duels",
  "d_win_1": "Win 1 duel",
  "d_win_2": "Win 2 duels",
  "d_buy_card_1": "Buy 1 card on the market",
  "d_sell_card_1": "Sell 1 card on the market",
  "d_list_card_1": "List 1 card for sale",
  "d_buy_booster_1": "Buy 1 booster",
  "d_obtain_10": "Get 10 cards",
  "d_obtain_rare": "Get 1 rare card or better",
  "d_daily_reward": "Claim your daily reward",
  "w_open_15": "Open 15 boosters",
  "w_play_15": "Play 15 duels",
  "w_win_10": "Win 10 duels",
  "w_buy_card_10": "Buy 10 cards on the market",
  "w_sell_card_10": "Sell 10 cards on the market",
  "w_earn_1000": "Earn 1,000 gold on the market",
  "w_obtain_100": "Get 100 cards",
  "w_obtain_epic_3": "Get 3 epic cards or better",
  "w_daily_reward_5": "Claim your daily reward 5 times",
  "w_quests_10": "Complete 10 daily quests"
}
```

`ko.json`, sous `"quests"` : `"reset": "초기화까지"`, `"reroll": "퀘스트 교체"`, `"reroll_hint": "하루 1회 교체"`, et `"pool"` :

```json
"pool": {
  "d_open_1": "부스터 1개 개봉",
  "d_open_2": "부스터 2개 개봉",
  "d_open_3": "부스터 3개 개봉",
  "d_play_1": "대결 1회 진행",
  "d_play_2": "대결 2회 진행",
  "d_play_3": "대결 3회 진행",
  "d_win_1": "대결 1회 승리",
  "d_win_2": "대결 2회 승리",
  "d_buy_card_1": "마켓에서 카드 1장 구매",
  "d_sell_card_1": "마켓에서 카드 1장 판매",
  "d_list_card_1": "카드 1장 판매 등록",
  "d_buy_booster_1": "부스터 1개 구매",
  "d_obtain_10": "카드 10장 획득",
  "d_obtain_rare": "레어 이상 카드 1장 획득",
  "d_daily_reward": "일일 보상 받기",
  "w_open_15": "부스터 15개 개봉",
  "w_play_15": "대결 15회 진행",
  "w_win_10": "대결 10회 승리",
  "w_buy_card_10": "마켓에서 카드 10장 구매",
  "w_sell_card_10": "마켓에서 카드 10장 판매",
  "w_earn_1000": "마켓에서 골드 1,000 획득",
  "w_obtain_100": "카드 100장 획득",
  "w_obtain_epic_3": "에픽 이상 카드 3장 획득",
  "w_daily_reward_5": "일일 보상 5회 받기",
  "w_quests_10": "일일 퀘스트 10개 완료"
}
```

- [ ] **Step 5 : Test du panneau (échoue)**

`apps/frontend/src/__tests__/components/QuestsPanel.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UserQuest, UserQuestsResponse } from "@pipou/shared";
import i18n from "../../i18n";
import QuestsPanel from "../../features/profile/QuestsPanel";

const quest = (id: number, extra: Partial<UserQuest> = {}): UserQuest => ({
  id,
  questId: id,
  title: "quests.pool.d_open_1",
  description: null,
  resetType: "DAILY",
  rewardType: "GOLD",
  rewardAmount: 100,
  rewardItemId: null,
  progress: {
    operator: "AND",
    conditions: [{ type: "OPEN_BOOSTER", current: 0, target: 1, completed: false }],
    globalCompleted: false,
  },
  isCompleted: false,
  rewardClaimed: false,
  resetAt: new Date(Date.now() + 3_600_000).toISOString(),
  ...extra,
});

let quests: UserQuestsResponse;
vi.mock("../../hooks/useGameData", () => ({
  useQuests: () => ({ data: quests, isLoading: false }),
  useClaimReward: () => ({ mutate: vi.fn(), isPending: false }),
  useRerollQuest: () => ({ mutate: vi.fn(), isPending: false }),
  useAchievements: () => ({ data: { families: [], unlocked: 4, total: 36, equippedTitle: null }, isLoading: false }),
  useClaimAchievement: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTitle: () => ({ mutate: vi.fn(), isPending: false }),
}));

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuestsPanel />
    </QueryClientProvider>,
  );

const base = (): UserQuestsResponse => ({
  DAILY: [quest(1), quest(2, { isCompleted: true })],
  WEEKLY: [],
  MONTHLY: [],
  EVENT: [],
  rerollAvailable: true,
  dailyResetAt: new Date(Date.now() + 3_600_000).toISOString(),
  weeklyResetAt: new Date(Date.now() + 86_400_000).toISOString(),
});

describe("QuestsPanel", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche Daily, Hebdo et Succès avec le compteur, mais pas Mensuel vide", () => {
    quests = base();
    renderPanel();
    expect(screen.getByRole("button", { name: /Daily/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hebdo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Succès 4\/36/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Monthly/ })).not.toBeInTheDocument();
  });

  it("traduit le titre des quêtes du pool", () => {
    quests = base();
    renderPanel();
    expect(screen.getAllByText("Ouvre 1 booster")).toHaveLength(2);
  });

  it("propose la relance seulement sur les quêtes non terminées", () => {
    quests = base();
    renderPanel();
    expect(screen.getAllByRole("button", { name: "Changer cette quête" })).toHaveLength(1);
  });

  it("masque la relance quand elle est utilisée", () => {
    quests = { ...base(), rerollAvailable: false };
    renderPanel();
    expect(screen.queryByRole("button", { name: "Changer cette quête" })).not.toBeInTheDocument();
  });
});
```

La clé de l'onglet Succès (`achievements.tab`) est ajoutée en Task 10. En attendant, le 1ᵉʳ test échoue sur « Succès ». Ce test ne passe donc qu'à la fin de la Task 10, et c'est voulu.

Run: `pnpm --filter @pipou/frontend test -- QuestsPanel`
Expected: FAIL.

- [ ] **Step 6 : Réécrire `QuestsPanel.tsx`**

`AchievementsTab` est créé en Task 10. Pour que cette tâche compile seule, créer d'abord le stub `apps/frontend/src/features/achievements/AchievementsTab.tsx`, que la Task 10 remplace :

```tsx
export default function AchievementsTab() {
  return null;
}
```

Remplacer tout `apps/frontend/src/features/profile/QuestsPanel.tsx` par :

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { QuestListKey, UserQuest } from "@pipou/shared";
import {
  useAchievements,
  useClaimReward,
  useQuests,
  useRerollQuest,
} from "../../hooks/useGameData";
import { QUERY_KEYS } from "../../utils/querykeys";
import { questService } from "../../services/quest.service";
import { IconBell, IconCheck, IconUndo } from "../../components/Icons";
import Button from "../../components/Button";
import RewardLabel from "../quests/RewardLabel";
import { useCountdown } from "../quests/useCountdown";
import { questTitle } from "../quests/questTitle";
import AchievementsTab from "../achievements/AchievementsTab";
import "./QuestsPanel.css";

type TabKey = QuestListKey | "ACHIEVEMENTS";

const QUEST_TABS: { key: QuestListKey; labelKey: string; always: boolean }[] = [
  { key: "DAILY", labelKey: "quests.daily", always: true },
  { key: "WEEKLY", labelKey: "quests.weekly", always: true },
  { key: "MONTHLY", labelKey: "quests.monthly", always: false },
  { key: "EVENT", labelKey: "quests.event", always: false },
];

function parseProgress(quest: UserQuest): { current: number; target: number } {
  const conds = quest.progress?.conditions ?? [];
  if (conds.length === 0) return { current: 0, target: 1 };
  return {
    current: conds.reduce((s, c) => s + (c.current ?? 0), 0),
    target: conds.reduce((s, c) => s + (c.target ?? 1), 0),
  };
}

interface QuestItemProps {
  quest: UserQuest;
  busy: boolean;
  claiming: boolean;
  canReroll: boolean;
  onClaim: () => void;
  onReroll: () => void;
}

function QuestItem({ quest, busy, claiming, canReroll, onClaim, onReroll }: QuestItemProps) {
  const { t } = useTranslation();
  const { current, target } = parseProgress(quest);
  const pct = Math.min(100, Math.round((current / target) * 100));
  const done = quest.isCompleted;

  return (
    <div className={`quest-item${done ? " quest-item--completed" : ""}`}>
      <div className="quest-item__top">
        <span className="quest-item__title">{questTitle(quest.title)}</span>
        <RewardLabel type={quest.rewardType} amount={quest.rewardAmount} />
      </div>
      <div className="quest-item__progress">
        <div className="quest-item__bar">
          <div
            className={`quest-item__bar-fill${done ? " quest-item__bar-fill--done" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="quest-item__progress-text">
          {current}/{target}
        </span>
        {canReroll && !done && (
          <button
            type="button"
            className="quest-item__reroll"
            onClick={onReroll}
            disabled={busy}
            aria-label={t("quests.reroll")}
            title={t("quests.reroll_hint")}
          >
            <IconUndo size={14} color="currentColor" />
          </button>
        )}
      </div>
      {done && !quest.rewardClaimed && (
        <Button
          variant="primary-inverse"
          size="sm"
          className="quest-item__claim-btn"
          onClick={onClaim}
          disabled={busy}
        >
          {claiming ? "..." : t("quests.claim")}
        </Button>
      )}
      {done && quest.rewardClaimed && (
        <span className="quest-item__claimed">
          <IconCheck size={12} color="rgba(255,255,255,0.35)" /> {t("quests.claimed")}
        </span>
      )}
    </div>
  );
}

export default function QuestsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: quests, isLoading } = useQuests();
  const { data: achievements } = useAchievements();
  const claimMutation = useClaimReward();
  const rerollMutation = useRerollQuest();
  const [activeTab, setActiveTab] = useState<TabKey>("DAILY");
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  const resetAt =
    activeTab === "DAILY"
      ? (quests?.dailyResetAt ?? null)
      : activeTab === "WEEKLY"
        ? (quests?.weeklyResetAt ?? null)
        : null;
  const countdown = useCountdown(resetAt, t);

  if (isLoading || !quests)
    return <div className="quests-panel__loading">{t("quests.loading")}</div>;

  const visibleTabs = QUEST_TABS.filter((tab) => tab.always || quests[tab.key].length > 0);
  const currentList = activeTab === "ACHIEVEMENTS" ? [] : quests[activeTab];
  const claimable = currentList.filter((q) => q.isCompleted && !q.rewardClaimed);
  const busy = claimMutation.isPending || rerollMutation.isPending || isClaimingAll;

  const handleClaimAll = async () => {
    setIsClaimingAll(true);
    try {
      await questService.claimAllRewards();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    } finally {
      setIsClaimingAll(false);
    }
  };

  return (
    <div className="quests-panel">
      <div className="quests-panel__header">
        <h2 className="quests-panel__title">{t("quests.title")}</h2>
        {resetAt && (
          <span className="quests-panel__reset">
            {t("quests.reset")} {countdown}
          </span>
        )}
      </div>

      <div className="quests-panel__tabs">
        {visibleTabs.map((tab) => (
          <Button
            key={tab.key}
            variant="ghost-gold"
            size="sm"
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {t(tab.labelKey)}
            {quests[tab.key].some((q) => q.isCompleted && !q.rewardClaimed) && (
              <IconBell size={11} color="#eebc77" style={{ marginLeft: 5 }} />
            )}
          </Button>
        ))}
        <Button
          variant="ghost-gold"
          size="sm"
          active={activeTab === "ACHIEVEMENTS"}
          onClick={() => setActiveTab("ACHIEVEMENTS")}
        >
          {t("achievements.tab")}
          {achievements && ` ${achievements.unlocked}/${achievements.total}`}
        </Button>
      </div>

      {activeTab === "ACHIEVEMENTS" ? (
        <AchievementsTab />
      ) : (
        <>
          {claimable.length > 1 && (
            <div className="quests-panel__list-actions">
              <Button variant="primary-inverse" size="sm" onClick={handleClaimAll} disabled={busy}>
                {isClaimingAll ? "..." : `${t("quests.claim_all")} (${claimable.length})`}
              </Button>
            </div>
          )}
          <div className="quests-panel__list">
            {currentList.length === 0 ? (
              <p className="quests-panel__empty">{t("quests.empty")}</p>
            ) : (
              currentList.map((quest) => (
                <QuestItem
                  key={quest.id}
                  quest={quest}
                  busy={busy}
                  claiming={claimMutation.isPending && claimMutation.variables === quest.id}
                  canReroll={quests.rerollAvailable && (activeTab === "DAILY" || activeTab === "WEEKLY")}
                  onClaim={() => claimMutation.mutate(quest.id)}
                  onReroll={() => rerollMutation.mutate(quest.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

Ajouter `"loading": "Chargement…"` (fr), `"loading": "Loading…"` (en) et `"loading": "불러오는 중…"` (ko) sous `quests`, pour remplacer le « Chargement... » en dur.

Ajouter dans `QuestsPanel.css` :

```css
.quests-panel__reset {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
}

.quest-item__reroll {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px dashed rgba(238, 188, 119, 0.45);
  background: transparent;
  color: #eebc77;
  cursor: pointer;
}
.quest-item__reroll:disabled {
  opacity: 0.4;
  cursor: default;
}
```

Supprimer `.quest-item__timer` de `QuestsPanel.css` : le timer par quête n'existe plus.

- [ ] **Step 7 : Lancer**

Run: `pnpm --filter @pipou/frontend test -- QuestsPanel && pnpm --filter @pipou/frontend typecheck`
Expected: typecheck PASS ; 3 tests sur 4 PASS (l'onglet « Succès » attend la Task 10).

- [ ] **Step 8 : Commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): quest tabs with reset countdown, daily reroll and translated pool titles"
```

---

### Task 10 : Front — onglet Succès (grille, bottom-sheet, titre)

**Files:**
- Create: `apps/frontend/src/components/BottomSheet.tsx`, `apps/frontend/src/components/BottomSheet.css`, `apps/frontend/src/features/achievements/achievementIcons.ts`, `apps/frontend/src/features/achievements/AchievementTile.tsx`, `apps/frontend/src/features/achievements/AchievementSheet.tsx`, `apps/frontend/src/features/achievements/Achievements.css`, `apps/frontend/src/__tests__/components/AchievementTile.test.tsx`, `apps/frontend/src/__tests__/components/AchievementSheet.test.tsx`, `apps/frontend/src/__tests__/unit/achievementsI18n.test.ts`
- Modify: `apps/frontend/src/features/achievements/AchievementsTab.tsx` (remplace le stub), `apps/frontend/src/components/Icons.tsx`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`

**Interfaces:**
- Consumes: `useAchievements`, `useClaimAchievement`, `useSetTitle` (Task 9) ; `AchievementProgress`, `isAchievementClaimable`, `nextAchievementTier`, `AchievementFamily`, `AchievementTier` (shared) ; `RewardLabel` (Task 9).
- Produces:
  - `<BottomSheet title closeLabel onClose>` ;
  - `FAMILY_ICON` ;
  - `<AchievementTile progress onOpen>`, `<AchievementSheet progress claiming onClaim onClose>`, `<AchievementsTab>` ;
  - `IconSwords`, `IconGem`.

- [ ] **Step 1 : Traductions des succès**

Ajouter au niveau racine de `fr.json` :

```json
"achievements": {
  "tab": "Succès",
  "loading": "Chargement des succès…",
  "unlocked": "{{count}} / {{total}} paliers",
  "title_label": "Titre",
  "no_title": "Aucun titre",
  "claim": "Réclamer",
  "claimed": "Réclamé",
  "locked": "À atteindre",
  "all_done": "Tous les paliers sont réclamés",
  "unlocks_title": "Débloque le titre « {{title}} »",
  "close": "Fermer",
  "tiers": { "BRONZE": "Bronze", "SILVER": "Argent", "GOLD": "Or" },
  "families": {
    "BOOSTERS_OPENED": "Ouvreur",
    "CARDS_BOUGHT": "Acheteur",
    "CARDS_SOLD": "Vendeur",
    "SETS_COMPLETED": "Sets complets",
    "DUELS_WON": "Victoires",
    "DUELS_PLAYED": "Duels joués",
    "LEVEL": "Niveau",
    "UNIQUE_CARDS": "Collection",
    "HIGH_RARITY": "Raretés",
    "LOGIN_STREAK": "Assiduité",
    "GOLD_EARNED": "Fortune",
    "QUESTS_DONE": "Quêtes"
  },
  "goals": {
    "BOOSTERS_OPENED": "Ouvre {{n}} boosters",
    "CARDS_BOUGHT": "Achète {{n}} cartes au marché",
    "CARDS_SOLD": "Vends {{n}} cartes au marché",
    "SETS_COMPLETED": "Complète {{n}} sets",
    "DUELS_WON": "Gagne {{n}} duels",
    "DUELS_PLAYED": "Joue {{n}} duels",
    "LEVEL": "Atteins le niveau {{n}}",
    "UNIQUE_CARDS": "Possède {{n}} cartes différentes",
    "HIGH_RARITY": "Possède {{n}} cartes épiques ou mieux",
    "LOGIN_STREAK": "Connecte-toi {{n}} jours d'affilée",
    "GOLD_EARNED": "Gagne {{n}} or au marché",
    "QUESTS_DONE": "Termine {{n}} quêtes"
  },
  "titles": {
    "BOOSTERS_OPENED": "Maître Ouvreur",
    "CARDS_BOUGHT": "Chineur",
    "CARDS_SOLD": "Marchand",
    "SETS_COMPLETED": "Archiviste",
    "DUELS_WON": "Champion",
    "DUELS_PLAYED": "Vétéran",
    "LEVEL": "Légende",
    "UNIQUE_CARDS": "Collectionneur",
    "HIGH_RARITY": "Chasseur de Reliques",
    "LOGIN_STREAK": "Fidèle",
    "GOLD_EARNED": "Magnat",
    "QUESTS_DONE": "Aventurier"
  }
}
```

On utilise la variable `{{n}}` et non `{{count}}` : avec `count`, i18next chercherait des clés de pluriel (`_one`/`_other`).

`en.json` :

```json
"achievements": {
  "tab": "Achievements",
  "loading": "Loading achievements…",
  "unlocked": "{{count}} / {{total}} tiers",
  "title_label": "Title",
  "no_title": "No title",
  "claim": "Claim",
  "claimed": "Claimed",
  "locked": "To reach",
  "all_done": "All tiers claimed",
  "unlocks_title": "Unlocks the title “{{title}}”",
  "close": "Close",
  "tiers": { "BRONZE": "Bronze", "SILVER": "Silver", "GOLD": "Gold" },
  "families": {
    "BOOSTERS_OPENED": "Opener",
    "CARDS_BOUGHT": "Buyer",
    "CARDS_SOLD": "Seller",
    "SETS_COMPLETED": "Full Sets",
    "DUELS_WON": "Victories",
    "DUELS_PLAYED": "Duels Played",
    "LEVEL": "Level",
    "UNIQUE_CARDS": "Collection",
    "HIGH_RARITY": "Rarities",
    "LOGIN_STREAK": "Dedication",
    "GOLD_EARNED": "Fortune",
    "QUESTS_DONE": "Quests"
  },
  "goals": {
    "BOOSTERS_OPENED": "Open {{n}} boosters",
    "CARDS_BOUGHT": "Buy {{n}} cards on the market",
    "CARDS_SOLD": "Sell {{n}} cards on the market",
    "SETS_COMPLETED": "Complete {{n}} sets",
    "DUELS_WON": "Win {{n}} duels",
    "DUELS_PLAYED": "Play {{n}} duels",
    "LEVEL": "Reach level {{n}}",
    "UNIQUE_CARDS": "Own {{n}} different cards",
    "HIGH_RARITY": "Own {{n}} epic cards or better",
    "LOGIN_STREAK": "Log in {{n}} days in a row",
    "GOLD_EARNED": "Earn {{n}} gold on the market",
    "QUESTS_DONE": "Complete {{n}} quests"
  },
  "titles": {
    "BOOSTERS_OPENED": "Master Opener",
    "CARDS_BOUGHT": "Bargain Hunter",
    "CARDS_SOLD": "Merchant",
    "SETS_COMPLETED": "Archivist",
    "DUELS_WON": "Champion",
    "DUELS_PLAYED": "Veteran",
    "LEVEL": "Legend",
    "UNIQUE_CARDS": "Collector",
    "HIGH_RARITY": "Relic Hunter",
    "LOGIN_STREAK": "Faithful",
    "GOLD_EARNED": "Tycoon",
    "QUESTS_DONE": "Adventurer"
  }
}
```

`ko.json` :

```json
"achievements": {
  "tab": "업적",
  "loading": "업적 불러오는 중…",
  "unlocked": "{{count}} / {{total}} 단계",
  "title_label": "칭호",
  "no_title": "칭호 없음",
  "claim": "받기",
  "claimed": "받음",
  "locked": "달성 필요",
  "all_done": "모든 단계를 받았습니다",
  "unlocks_title": "칭호 「{{title}}」 해금",
  "close": "닫기",
  "tiers": { "BRONZE": "브론즈", "SILVER": "실버", "GOLD": "골드" },
  "families": {
    "BOOSTERS_OPENED": "개봉가",
    "CARDS_BOUGHT": "구매자",
    "CARDS_SOLD": "판매자",
    "SETS_COMPLETED": "세트 완성",
    "DUELS_WON": "승리",
    "DUELS_PLAYED": "대결 횟수",
    "LEVEL": "레벨",
    "UNIQUE_CARDS": "컬렉션",
    "HIGH_RARITY": "희귀 카드",
    "LOGIN_STREAK": "출석",
    "GOLD_EARNED": "재산",
    "QUESTS_DONE": "퀘스트"
  },
  "goals": {
    "BOOSTERS_OPENED": "부스터 {{n}}개 개봉",
    "CARDS_BOUGHT": "마켓에서 카드 {{n}}장 구매",
    "CARDS_SOLD": "마켓에서 카드 {{n}}장 판매",
    "SETS_COMPLETED": "세트 {{n}}개 완성",
    "DUELS_WON": "대결 {{n}}회 승리",
    "DUELS_PLAYED": "대결 {{n}}회 진행",
    "LEVEL": "레벨 {{n}} 달성",
    "UNIQUE_CARDS": "서로 다른 카드 {{n}}장 보유",
    "HIGH_RARITY": "에픽 이상 카드 {{n}}장 보유",
    "LOGIN_STREAK": "{{n}}일 연속 접속",
    "GOLD_EARNED": "마켓에서 골드 {{n}} 획득",
    "QUESTS_DONE": "퀘스트 {{n}}개 완료"
  },
  "titles": {
    "BOOSTERS_OPENED": "개봉의 달인",
    "CARDS_BOUGHT": "흥정꾼",
    "CARDS_SOLD": "상인",
    "SETS_COMPLETED": "기록관",
    "DUELS_WON": "챔피언",
    "DUELS_PLAYED": "베테랑",
    "LEVEL": "전설",
    "UNIQUE_CARDS": "수집가",
    "HIGH_RARITY": "유물 사냥꾼",
    "LOGIN_STREAK": "충실한 자",
    "GOLD_EARNED": "거물",
    "QUESTS_DONE": "모험가"
  }
}
```

- [ ] **Step 2 : Test de cohérence i18n (échoue tant que les clés manquent, passe ensuite)**

`apps/frontend/src/__tests__/unit/achievementsI18n.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { AchievementFamily } from "@pipou/shared";
import fr from "../../i18n/locales/fr.json";
import en from "../../i18n/locales/en.json";
import ko from "../../i18n/locales/ko.json";

const POOL_KEYS = [
  "d_open_1", "d_open_2", "d_open_3", "d_play_1", "d_play_2", "d_play_3", "d_win_1", "d_win_2",
  "d_buy_card_1", "d_sell_card_1", "d_list_card_1", "d_buy_booster_1", "d_obtain_10",
  "d_obtain_rare", "d_daily_reward", "w_open_15", "w_play_15", "w_win_10", "w_buy_card_10",
  "w_sell_card_10", "w_earn_1000", "w_obtain_100", "w_obtain_epic_3", "w_daily_reward_5", "w_quests_10",
];

describe.each([
  ["fr", fr],
  ["en", en],
  ["ko", ko],
])("traductions %s", (_lang, locale) => {
  it("nomme chaque famille, son objectif et son titre", () => {
    for (const f of Object.values(AchievementFamily)) {
      expect(locale.achievements.families[f]).toBeTruthy();
      expect(locale.achievements.goals[f]).toContain("{{n}}");
      expect(locale.achievements.titles[f]).toBeTruthy();
    }
  });

  it("traduit chaque quête du pool", () => {
    for (const k of POOL_KEYS) {
      expect((locale.quests.pool as Record<string, string>)[k]).toBeTruthy();
    }
  });
});
```

`POOL_KEYS` doit rester identique à `QUEST_POOL` du back (`apps/backend/src/quests/quest-pool.ts`). Un commentaire en tête du test le rappelle.

- [ ] **Step 3 : Icônes**

Dans `apps/frontend/src/components/Icons.tsx`, ajouter à la fin :

```tsx
export function IconSwords({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 19l6-6M16 16l4 4M19 21l2-2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconGem({ size = 24, color = "currentColor", className, style }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
      <path d="M6 3h12l4 6-10 12L2 9l4-6z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 9h20M12 21L8 9l4-6 4 6-4 12" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
```

Si `__tests__/components/Icons.test.tsx` liste les icônes exportées, y ajouter `IconSwords` et `IconGem`.

`apps/frontend/src/features/achievements/achievementIcons.ts` :

```ts
import type { ComponentType } from "react";
import { AchievementFamily } from "@pipou/shared";
import {
  IconBooster,
  IconCards,
  IconCart,
  IconCollection,
  IconCrown,
  IconFire,
  IconGem,
  IconGold,
  IconQuest,
  IconSwords,
  IconTag,
  IconTrophy,
} from "../../components/Icons";

type FamilyIcon = ComponentType<{ size?: number; color?: string }>;

export const FAMILY_ICON: Record<AchievementFamily, FamilyIcon> = {
  [AchievementFamily.BOOSTERS_OPENED]: IconBooster,
  [AchievementFamily.CARDS_BOUGHT]: IconCart,
  [AchievementFamily.CARDS_SOLD]: IconTag,
  [AchievementFamily.SETS_COMPLETED]: IconCollection,
  [AchievementFamily.DUELS_WON]: IconTrophy,
  [AchievementFamily.DUELS_PLAYED]: IconSwords,
  [AchievementFamily.LEVEL]: IconCrown,
  [AchievementFamily.UNIQUE_CARDS]: IconCards,
  [AchievementFamily.HIGH_RARITY]: IconGem,
  [AchievementFamily.LOGIN_STREAK]: IconFire,
  [AchievementFamily.GOLD_EARNED]: IconGold,
  [AchievementFamily.QUESTS_DONE]: IconQuest,
};
```

- [ ] **Step 4 : Tests des composants (échouent)**

`apps/frontend/src/__tests__/components/AchievementTile.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AchievementProgress } from "@pipou/shared";
import i18n from "../../i18n";
import AchievementTile from "../../features/achievements/AchievementTile";

const progress = (claimed: boolean[], reached: boolean[]): AchievementProgress => ({
  family: "DUELS_WON",
  value: 30,
  claimedTier: null,
  tiers: (["BRONZE", "SILVER", "GOLD"] as const).map((tier, i) => ({
    tier,
    threshold: [1, 25, 100][i],
    reward: { type: "GOLD", amount: 100 },
    claimed: claimed[i],
    reached: reached[i],
  })),
});

describe("AchievementTile", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche le nom et une pastille allumée par palier réclamé", () => {
    render(<AchievementTile progress={progress([true, false, false], [true, true, false])} onOpen={() => {}} />);
    expect(screen.getByText("Victoires")).toBeInTheDocument();
    expect(document.querySelectorAll(".ach-pip--on")).toHaveLength(1);
  });

  it("se met en avant quand un palier est réclamable", () => {
    render(<AchievementTile progress={progress([true, false, false], [true, true, false])} onOpen={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("ach-tile--claimable");
  });

  it("n'est pas mis en avant sans palier réclamable", () => {
    render(<AchievementTile progress={progress([true, false, false], [true, false, false])} onOpen={() => {}} />);
    expect(screen.getByRole("button")).not.toHaveClass("ach-tile--claimable");
  });

  it("ouvre le détail au clic", () => {
    const onOpen = vi.fn();
    render(<AchievementTile progress={progress([false, false, false], [false, false, false])} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

`apps/frontend/src/__tests__/components/AchievementSheet.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AchievementProgress } from "@pipou/shared";
import i18n from "../../i18n";
import AchievementSheet from "../../features/achievements/AchievementSheet";

const progress = (claimed: boolean[], reached: boolean[]): AchievementProgress => ({
  family: "DUELS_WON",
  value: 30,
  claimedTier: null,
  tiers: (["BRONZE", "SILVER", "GOLD"] as const).map((tier, i) => ({
    tier,
    threshold: [1, 25, 100][i],
    reward: { type: "GOLD", amount: 100 },
    claimed: claimed[i],
    reached: reached[i],
  })),
});

describe("AchievementSheet", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("liste les 3 paliers et le titre débloqué", () => {
    render(<AchievementSheet progress={progress([true, false, false], [true, true, false])} claiming={false} onClaim={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Gagne 1 duels")).toBeInTheDocument();
    expect(screen.getByText("Gagne 25 duels")).toBeInTheDocument();
    expect(screen.getByText("Gagne 100 duels")).toBeInTheDocument();
    expect(screen.getByText("Débloque le titre « Champion »")).toBeInTheDocument();
  });

  it("réclame le prochain palier atteint", () => {
    const onClaim = vi.fn();
    render(<AchievementSheet progress={progress([true, false, false], [true, true, false])} claiming={false} onClaim={onClaim} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Réclamer" }));
    expect(onClaim).toHaveBeenCalled();
  });

  it("désactive Réclamer si le prochain palier n'est pas atteint", () => {
    render(<AchievementSheet progress={progress([true, false, false], [true, false, false])} claiming={false} onClaim={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Réclamer" })).toBeDisabled();
  });

  it("indique quand tout est réclamé", () => {
    render(<AchievementSheet progress={progress([true, true, true], [true, true, true])} claiming={false} onClaim={() => {}} onClose={() => {}} />);
    expect(screen.getByText("Tous les paliers sont réclamés")).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @pipou/frontend test -- Achievement`
Expected: FAIL (composants absents).

- [ ] **Step 5 : `BottomSheet`**

`apps/frontend/src/components/BottomSheet.tsx` :

```tsx
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "./Icons";
import "./BottomSheet.css";

interface Props {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Panneau ancré en bas de l'écran, fermé par le fond, la croix ou Échap. */
export default function BottomSheet({ title, closeLabel, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="bsheet" onClick={onClose}>
      <div
        className="bsheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bsheet__head">
          <h3 className="bsheet__title">{title}</h3>
          <button type="button" className="bsheet__close" onClick={onClose} aria-label={closeLabel}>
            <IconClose size={18} color="currentColor" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
```

`apps/frontend/src/components/BottomSheet.css` :

```css
.bsheet {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(20, 5, 10, 0.55);
}

.bsheet__panel {
  width: 100%;
  max-width: 430px;
  max-height: 80vh;
  overflow-y: auto;
  background: #3d1020;
  color: #fff;
  border-radius: 18px 18px 0 0;
  padding: 1rem 1.1rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: bsheetUp 0.22s ease-out;
}

@keyframes bsheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .bsheet__panel { animation: none; }
}

.bsheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bsheet__title {
  margin: 0;
  font-family: "Lilita One", cursive;
  font-size: 1.05rem;
  color: #eebc77;
}

.bsheet__close {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 4px;
}
```

- [ ] **Step 6 : Tuile, détail, onglet**

`apps/frontend/src/features/achievements/AchievementTile.tsx` :

```tsx
import { useTranslation } from "react-i18next";
import { isAchievementClaimable, type AchievementProgress } from "@pipou/shared";
import { FAMILY_ICON } from "./achievementIcons";
import "./Achievements.css";

interface Props {
  progress: AchievementProgress;
  onOpen: () => void;
}

export default function AchievementTile({ progress, onOpen }: Props) {
  const { t } = useTranslation();
  const Icon = FAMILY_ICON[progress.family];
  const claimable = isAchievementClaimable(progress);

  return (
    <button
      type="button"
      className={`ach-tile${claimable ? " ach-tile--claimable" : ""}`}
      onClick={onOpen}
    >
      <span className="ach-tile__icon">
        <Icon size={22} color="#eebc77" />
      </span>
      <span className="ach-tile__name">{t(`achievements.families.${progress.family}`)}</span>
      <span className="ach-tile__pips" aria-hidden="true">
        {progress.tiers.map((tier) => (
          <span
            key={tier.tier}
            className={`ach-pip ach-pip--${tier.tier.toLowerCase()}${tier.claimed ? " ach-pip--on" : ""}`}
          />
        ))}
      </span>
    </button>
  );
}
```

`apps/frontend/src/features/achievements/AchievementSheet.tsx` :

```tsx
import { useTranslation } from "react-i18next";
import { nextAchievementTier, type AchievementProgress } from "@pipou/shared";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import { IconCheck } from "../../components/Icons";
import RewardLabel from "../quests/RewardLabel";
import "./Achievements.css";

interface Props {
  progress: AchievementProgress;
  claiming: boolean;
  onClaim: () => void;
  onClose: () => void;
}

export default function AchievementSheet({ progress, claiming, onClaim, onClose }: Props) {
  const { t } = useTranslation();
  const { family, value, tiers } = progress;
  const next = nextAchievementTier(progress);
  const pct = next ? Math.min(100, Math.round((value / Math.max(1, next.threshold)) * 100)) : 100;

  return (
    <BottomSheet
      title={t(`achievements.families.${family}`)}
      closeLabel={t("achievements.close")}
      onClose={onClose}
    >
      {next && (
        <div className="ach-sheet__progress">
          <div className="quest-item__bar">
            <div className="quest-item__bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="quest-item__progress-text">
            {value.toLocaleString()} / {next.threshold.toLocaleString()}
          </span>
        </div>
      )}

      <ol className="ach-sheet__tiers">
        {tiers.map((tier) => (
          <li
            key={tier.tier}
            className={`ach-sheet__tier${tier.claimed ? " ach-sheet__tier--claimed" : ""}${tier.reached && !tier.claimed ? " ach-sheet__tier--ready" : ""}`}
          >
            <span className={`ach-pip ach-pip--${tier.tier.toLowerCase()} ach-pip--on`} aria-hidden="true" />
            <span className="ach-sheet__goal">
              <span className="ach-sheet__tier-name">{t(`achievements.tiers.${tier.tier}`)}</span>
              <span>{t(`achievements.goals.${family}`, { n: tier.threshold.toLocaleString() })}</span>
            </span>
            <RewardLabel type={tier.reward.type} amount={tier.reward.amount} />
            <span className="ach-sheet__state">
              {tier.claimed ? (
                <IconCheck size={14} color="#eebc77" />
              ) : tier.reached ? null : (
                t("achievements.locked")
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="ach-sheet__title-reward">
        {t("achievements.unlocks_title", { title: t(`achievements.titles.${family}`) })}
      </p>

      {next ? (
        <Button variant="primary-inverse" onClick={onClaim} disabled={!next.reached || claiming}>
          {claiming ? "..." : t("achievements.claim")}
        </Button>
      ) : (
        <p className="ach-sheet__done">{t("achievements.all_done")}</p>
      )}
    </BottomSheet>
  );
}
```

`toLocaleString()` produit « 1 » et « 25 » pour les petites valeurs. Le test attend « Gagne 1 duels » ; si la locale de jsdom formate autrement les grands nombres, les tests n'en utilisent pas.

`apps/frontend/src/features/achievements/AchievementsTab.tsx` (remplace le stub) :

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AchievementTier, type AchievementFamily } from "@pipou/shared";
import { useAchievements, useClaimAchievement, useSetTitle } from "../../hooks/useGameData";
import AchievementTile from "./AchievementTile";
import AchievementSheet from "./AchievementSheet";
import "./Achievements.css";

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : value / total;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="ach-ring" aria-hidden="true">
      <circle cx="28" cy="28" r={r} className="ach-ring__track" />
      <circle
        cx="28"
        cy="28"
        r={r}
        className="ach-ring__fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" className="ach-ring__label">
        {value}/{total}
      </text>
    </svg>
  );
}

export default function AchievementsTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useAchievements();
  const claim = useClaimAchievement();
  const setTitle = useSetTitle();
  const [openFamily, setOpenFamily] = useState<AchievementFamily | null>(null);

  if (isLoading || !data) return <p className="quests-panel__empty">{t("achievements.loading")}</p>;

  const open = data.families.find((f) => f.family === openFamily) ?? null;
  const titles = data.families
    .filter((f) => f.claimedTier === AchievementTier.GOLD)
    .map((f) => f.family);

  return (
    <div className="ach">
      <div className="ach-header">
        <ProgressRing value={data.unlocked} total={data.total} />
        <div className="ach-header__info">
          <span className="ach-header__count">
            {t("achievements.unlocked", { count: data.unlocked, total: data.total })}
          </span>
          <label className="ach-header__title">
            <span>{t("achievements.title_label")}</span>
            <select
              value={data.equippedTitle ?? ""}
              disabled={setTitle.isPending}
              onChange={(e) => setTitle.mutate((e.target.value || null) as AchievementFamily | null)}
            >
              <option value="">{t("achievements.no_title")}</option>
              {titles.map((f) => (
                <option key={f} value={f}>
                  {t(`achievements.titles.${f}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="ach-grid">
        {data.families.map((p) => (
          <AchievementTile key={p.family} progress={p} onOpen={() => setOpenFamily(p.family)} />
        ))}
      </div>

      {open && (
        <AchievementSheet
          progress={open}
          claiming={claim.isPending}
          onClaim={() => claim.mutate(open.family)}
          onClose={() => setOpenFamily(null)}
        />
      )}
    </div>
  );
}
```

`achievements.unlocked` utilise `count`, ce qui déclenche la recherche de `unlocked_one`/`unlocked_other`. Faute de ces clés, i18next retombe sur `unlocked` : c'est le comportement voulu.

`apps/frontend/src/features/achievements/Achievements.css` :

```css
.ach {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ach-header {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  background: linear-gradient(135deg, #5a1830, #3d1020);
  border-radius: 12px;
  padding: 0.6rem 0.75rem;
}
.ach-header__info { display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; flex: 1; }
.ach-header__count { font-size: 0.78rem; font-weight: 700; color: rgba(255, 255, 255, 0.6); }
.ach-header__title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; font-weight: 700; color: #eebc77; }
.ach-header__title select {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  border: 1px solid rgba(238, 188, 119, 0.3);
  border-radius: 8px;
  padding: 0.25rem 0.4rem;
  font: inherit;
}

.ach-ring__track { fill: none; stroke: rgba(255, 255, 255, 0.12); stroke-width: 5; }
.ach-ring__fill { fill: none; stroke: #eebc77; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 0.4s; }
.ach-ring__label { fill: #eebc77; font-size: 11px; font-weight: 800; }

.ach-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.ach-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.6rem 0.25rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  color: #fff;
  cursor: pointer;
  font: inherit;
}
.ach-tile--claimable {
  border-color: #eebc77;
  animation: achPulse 1.6s ease-in-out infinite;
}
@keyframes achPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(238, 188, 119, 0.45); }
  50% { box-shadow: 0 0 0 5px rgba(238, 188, 119, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .ach-tile--claimable { animation: none; }
}
.ach-tile__icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(238, 188, 119, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ach-tile__name { font-size: 0.7rem; font-weight: 700; text-align: center; line-height: 1.15; }
.ach-tile__pips { display: flex; gap: 4px; }

.ach-pip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  display: inline-block;
  flex-shrink: 0;
}
.ach-pip--bronze.ach-pip--on { background: #b9764a; border-color: #b9764a; }
.ach-pip--silver.ach-pip--on { background: #c9ccd6; border-color: #c9ccd6; }
.ach-pip--gold.ach-pip--on { background: #eebc77; border-color: #eebc77; }

.ach-sheet__progress { display: flex; align-items: center; gap: 0.5rem; }
.ach-sheet__tiers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
.ach-sheet__tier {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.6rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.8rem;
}
.ach-sheet__tier--claimed { opacity: 0.6; }
.ach-sheet__tier--ready { border: 1px solid rgba(238, 188, 119, 0.5); }
.ach-sheet__goal { display: flex; flex-direction: column; min-width: 0; }
.ach-sheet__tier-name { font-size: 0.68rem; font-weight: 800; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; }
.ach-sheet__state { font-size: 0.68rem; color: rgba(255, 255, 255, 0.45); }
.ach-sheet__title-reward { margin: 0; font-size: 0.78rem; font-weight: 700; color: #eebc77; }
.ach-sheet__done { margin: 0; text-align: center; font-size: 0.8rem; color: rgba(255, 255, 255, 0.5); }
```

- [ ] **Step 7 : Lancer toute la suite front**

Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: PASS, y compris les 4 tests de `QuestsPanel`.

- [ ] **Step 8 : Commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): achievements grid with tier sheet and title picker"
```

---

### Task 11 : Front — titre affiché (profil et duel)

**Files:**
- Modify: `apps/frontend/src/features/profile/HeroCard.tsx`, `apps/frontend/src/features/profile/HeroCard.css`, `apps/frontend/src/features/fight/FightHUD.tsx`, le CSS du HUD (`grep -rn "hud-name" apps/frontend/src --include=*.css` pour le trouver)
- Test: `apps/frontend/src/__tests__/components/HeroCard.test.tsx` (nouveau)

**Interfaces:**
- Consumes: `UserProfile.equippedTitle` (Task 9) ; `me.title`/`opponent.title` (Task 1/8).

- [ ] **Step 1 : Test (échoue)**

`apps/frontend/src/__tests__/components/HeroCard.test.tsx` :

```tsx
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import HeroCard from "../../features/profile/HeroCard";
import type { UserProfile } from "../../services/user.service";

const profile = (equippedTitle: UserProfile["equippedTitle"]): UserProfile => ({
  id: 1,
  username: "Pipou",
  isPrivate: false,
  equippedTitle,
  level: 3,
  experience: 40,
  currentXp: 10,
  xpForNextLevel: 30,
  progressPercent: 33,
  gold: 500,
  stats: {
    boostersOpened: 0, cardsBought: 0, cardsSold: 0, moneyEarned: 0, moneySpent: 0,
    setsCompleted: 0, boostersBought: 0, bundlesBought: 0, boostersSold: 0, bundlesSold: 0,
  },
});

describe("HeroCard", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("affiche le titre équipé sous le pseudo", () => {
    render(<HeroCard profile={profile("DUELS_WON")} />);
    expect(screen.getByText("Champion")).toBeInTheDocument();
  });

  it("n'affiche rien sans titre", () => {
    render(<HeroCard profile={profile(null)} />);
    expect(screen.queryByText("Champion")).not.toBeInTheDocument();
  });
});
```

Avant d'écrire le test, vérifier la signature réelle de `HeroCard` (`grep -n "export default function HeroCard" -A6 apps/frontend/src/features/profile/HeroCard.tsx`) et ajouter les props obligatoires éventuelles au rendu du test.

Run: `pnpm --filter @pipou/frontend test -- HeroCard`
Expected: FAIL.

- [ ] **Step 2 : Implémenter**

Dans `HeroCard.tsx`, juste après `<h1 className="hero-card__username">{profile.username}</h1>` :

```tsx
        {profile.equippedTitle && (
          <span className="hero-card__title">
            {t(`achievements.titles.${profile.equippedTitle}`)}
          </span>
        )}
```

Dans `HeroCard.css` :

```css
.hero-card__title {
  display: block;
  font-size: 0.78rem;
  font-weight: 800;
  color: #eebc77;
  letter-spacing: 0.02em;
}
```

Dans `FightHUD.tsx` :
- importer `useTranslation` ;
- appeler `const { t } = useTranslation();` en tête de composant ;
- remplacer les deux `<span className="hud-name …">{x.username}</span>` par :

```tsx
        <span className="hud-name hud-name--opp">
          {opponent.username}
          {opponent.title && (
            <span className="hud-title">{t(`achievements.titles.${opponent.title}`)}</span>
          )}
        </span>
```

Faire de même pour `me` avec `hud-name--me`.

Dans le CSS du HUD :

```css
.hud-title {
  margin-left: 0.35rem;
  font-size: 0.68em;
  font-weight: 700;
  color: #eebc77;
  opacity: 0.85;
}
```

- [ ] **Step 3 : Lancer et commit**

Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck`
Expected: PASS (les tests `FightBoard` existants passent toujours, `title` étant optionnel).

```bash
git add apps/frontend/src
git commit -m "feat(front): show equipped title on profile and in duel HUD"
```

---

### Task 12 : e2e, vérification visuelle et passe finale

**Files:**
- Modify: `apps/backend/test/e2e/features/quests.feature`
- Create: `apps/backend/test/e2e/features/achievements.feature`
- Modify: `docs/superpowers/specs/2026-10-18-quests-achievements-rework-design.md` (section « Écarts »)

- [ ] **Step 1 : Features e2e**

Dans `quests.feature`, remplacer le scénario « Consulter mes quêtes en cours » par :

```gherkin
  Scenario: Consulter mes quêtes en cours
    When j'envoie une requête GET authentifiée sur "/quests/me"
    Then le statut de réponse est 200
    And la réponse contient un champ "DAILY"
    And la réponse contient un champ "WEEKLY"
    And la réponse contient un champ "rerollAvailable"
    And la réponse contient un champ "dailyResetAt"
    And la réponse contient un champ "weeklyResetAt"

  Scenario: Relancer une quête inexistante renvoie 404
    When j'envoie une requête POST authentifiée sur "/quests/99999/reroll"
    Then le statut de réponse est 404
```

Renommer `Feature: Système de quêtes et achievements` en `Feature: Système de quêtes`.

`apps/backend/test/e2e/features/achievements.feature` :

```gherkin
Feature: Succès à paliers
  En tant que joueur
  Je veux suivre et réclamer mes succès
  Pour débloquer des récompenses et des titres

  Background:
    Given je suis connecté en tant que joueur test

  Scenario: Consulter mes succès
    When j'envoie une requête GET authentifiée sur "/achievements"
    Then le statut de réponse est 200
    And la réponse contient un champ "families"
    And la réponse contient un champ "unlocked"
    And la réponse contient un champ "total"
    And la réponse contient un champ "equippedTitle"

  Scenario: Réclamer une famille inconnue renvoie 400
    When j'envoie une requête POST authentifiée sur "/achievements/NOPE/claim"
    Then le statut de réponse est 400

  Scenario: Équiper un titre non débloqué renvoie 400
    When j'envoie une requête PUT authentifiée sur "/achievements/title" avec le body:
      """
      { "family": "LEVEL" }
      """
    Then le statut de réponse est 400

  Scenario: Retirer son titre
    When j'envoie une requête PUT authentifiée sur "/achievements/title" avec le body:
      """
      { "family": null }
      """
    Then le statut de réponse est 200
```

- [ ] **Step 2 : Lancer les e2e en local (docker, `.env.e2e`, jamais Aiven)**

Run, dans trois terminaux ou en arrière-plan :
```bash
pnpm --filter @pipou/backend e2e:db
pnpm --filter @pipou/backend e2e:api
pnpm --filter @pipou/backend test:e2e:cucumber
```
Expected: tous les scénarios PASS.

- [ ] **Step 3 : Vérification visuelle**

Démarrer l'environnement local décrit dans la mémoire « Local test env » (base docker `cardcollect_dev`, `ENV_FILE=.env.dev.local`, compte admin local) et le front. Puis, avec Playwright en 430px :
- capturer l'onglet Daily (timer dans l'en-tête, bouton relance), l'onglet Hebdo, l'onglet Succès (anneau, sélecteur, grille 3×4) et le bottom-sheet ouvert sur une famille ;
- vérifier l'absence d'emoji, le texte lisible, l'absence de débordement horizontal, et que la pulsation n'apparaît que sur une tuile réclamable ;
- corriger les défauts visibles, puis committer.

- [ ] **Step 4 : Mettre la spec à jour**

Ajouter à la fin de la spec une section `## Écarts lors de l'implémentation`, qui reprend la liste « Écarts assumés » de ce plan.

- [ ] **Step 5 : Passe finale**

Run: `pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected: tout PASS.

- [ ] **Step 6 : Commit**

```bash
git add apps/backend/test docs/superpowers/specs
git commit -m "test(e2e): quests pool and achievements scenarios"
```
