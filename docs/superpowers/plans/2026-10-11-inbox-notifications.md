# Boîte de réception (notifications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le dropdown « Quêtes à réclamer » par une boîte de réception persistée (vente, drop rare/nouveau, quête terminée, patchnote) avec onglets Tout / Information / Récompense.

**Architecture:** Une table `notification` (messages par joueur) et une table `patchnote` (diffusée à tous, état « lu » dans `patchnote_read`). Un `NotificationsService` écoute les événements déjà émis par le backend (`listing.sold`, `booster.opened`) et deux nouveaux (`quest.completed`, `quest.claimed`) ; il fusionne messages et patchnotes à la lecture. Le front lit via TanStack Query et se rafraîchit par un flux SSE `notification.created`.

**Tech Stack:** NestJS 11 + TypeORM (MySQL) + EventEmitter2 + SSE, Jest ; React 18 + TanStack Query + react-i18next, Vitest + Testing Library ; types dans `@pipou/shared`.

**Spec:** `docs/superpowers/specs/2026-10-11-inbox-notifications-design.md`

## Global Constraints

- Tout type ou enum échangé front/back vit dans `@pipou/shared` ; jamais redéfini dans une app. `@pipou/shared` n'a aucune dépendance runtime. Après modification : `pnpm build:shared`.
- Front : données serveur uniquement via TanStack Query, clés dans `utils/querykeys.ts` ; pas de `any` ; erreurs d'API via `apiErrorMessage`. Pas de composant déclaré dans un composant.
- Cible mobile 430 px, thème clair, dropdown bordeaux (`#3d1020`) conservé.
- Textes en i18n fr / en / ko.
- Seuil de drop : rareté `epic` ou plus, ou première copie ; un seul message groupé par ouverture de booster.
- Messages lus purgés après 30 jours ; patchnotes visibles 30 jours.
- **Ne jamais lancer de migration sur la base Aiven** (le `.env` local pointe sur la prod). Migration uniquement via `pnpm --filter @pipou/backend migration:run:local` (`.env.e2e`).
- Commits sur `feat/inbox-notifications` uniquement. Aucun push sans demande de l'utilisateur.

## Écarts avec le spec (décidés pendant la planification)

1. Une colonne `ref_id` (id de `user_quest`) sur `notification` permet de marquer « lu » le message d'une quête quand elle est réclamée.
2. Pas d'endpoint `POST /notifications/:id/read` ni de bouton « Tout marquer comme lu » (YAGNI) : la boîte appelle `POST /notifications/read-all` **à sa fermeture**. Cet appel marque lu tout sauf les `QUEST_COMPLETED` (lus à la réclamation).
3. Création de patchnote : `POST /patchnotes` (admin), cohérent avec `sandbox/scenarios`.
4. Purge des messages lus > 30 j faite dans `read-all` (pas de cron).
5. Rafraîchissement en direct : un flux SSE `GET /notifications/events` (événement `notification.created`).

## Structure des fichiers

**Créés**
- `packages/shared/src/enums/notification.ts` — `NotificationType`, `NotificationCategory`, mapping, seuil de drop, constantes.
- `packages/shared/src/enums/notification.test.ts`
- `packages/shared/src/api/notifications.ts` — payloads, `NotificationItem`, `NotificationsResponse`.
- `apps/backend/src/notifications/notification.entity.ts`, `patchnote.entity.ts`, `patchnote-read.entity.ts`
- `apps/backend/src/notifications/notifications.service.ts` + `.spec.ts`
- `apps/backend/src/notifications/notifications.controller.ts` + `.spec.ts`
- `apps/backend/src/notifications/dto/list-notifications-query.dto.ts`, `dto/create-patchnote.dto.ts`
- `apps/backend/src/notifications/notifications.module.ts`
- `apps/backend/src/database/migrations/1791000000003-Notifications.ts`
- `apps/frontend/src/services/notification.service.ts`
- `apps/frontend/src/hooks/useNotifications.ts`
- `apps/frontend/src/features/inbox/InboxWidget.tsx`, `InboxItem.tsx`, `relativeTime.ts`, `InboxWidget.css`, `PatchnoteManager.tsx`
- `apps/frontend/src/__tests__/components/InboxWidget.test.tsx`

**Modifiés**
- `packages/shared/src/enums/index.ts`, `api/index.ts`, `api/requests.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/quests/quests.service.ts` (+ `.spec.ts`) — événements `quest.completed` / `quest.claimed`
- `apps/backend/src/boosters/boosters.service.ts`, `apps/backend/src/users/users.service.ts` — payload enrichi de `booster.opened`
- `apps/frontend/src/utils/querykeys.ts`, `components/Icons.tsx`, `components/Header.tsx`, `App.tsx`, `pages/Admin.tsx`, `i18n/locales/{fr,en,ko}.json`

**Supprimés**
- `apps/frontend/src/features/quests/QuestInboxWidget.tsx` et `.css`

---

### Task 1: Types partagés

**Files:**
- Create: `packages/shared/src/enums/notification.ts`, `packages/shared/src/enums/notification.test.ts`, `packages/shared/src/api/notifications.ts`
- Modify: `packages/shared/src/enums/index.ts`, `packages/shared/src/api/index.ts`, `packages/shared/src/api/requests.ts`

**Interfaces:**
- Produces:
  - `NotificationType` (`QUEST_COMPLETED | CARD_DROP | LISTING_SOLD | PATCHNOTE`), `NotificationCategory` (`reward | information`)
  - `NOTIFICATION_CATEGORY_OF: Record<NotificationType, NotificationCategory>`
  - `isNotableDrop(card: { rarity: Rarity; isNew: boolean }): boolean`
  - constantes `INBOX_PAGE_SIZE = 15`, `PATCHNOTE_VISIBLE_DAYS = 30`, `READ_RETENTION_DAYS = 30`
  - types `NotificationPayloadMap`, `NotificationItem`, `UnreadCounts`, `NotificationsResponse`, `CardDropEntry`, `CreatePatchnoteRequest`

- [ ] **Step 1: Write the failing test**

`packages/shared/src/enums/notification.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_CATEGORY_OF,
  NotificationCategory,
  NotificationType,
  Rarity,
  isNotableDrop,
} from "../index";

describe("notifications", () => {
  it("classe chaque type dans une catégorie", () => {
    expect(NOTIFICATION_CATEGORY_OF).toEqual({
      QUEST_COMPLETED: NotificationCategory.REWARD,
      CARD_DROP: NotificationCategory.REWARD,
      LISTING_SOLD: NotificationCategory.INFORMATION,
      PATCHNOTE: NotificationCategory.INFORMATION,
    });
    expect(Object.keys(NOTIFICATION_CATEGORY_OF).sort()).toEqual(
      Object.values(NotificationType).sort(),
    );
  });

  it("notifie les cartes epic et plus, quelle que soit la nouveauté", () => {
    expect(isNotableDrop({ rarity: Rarity.EPIC, isNew: false })).toBe(true);
    expect(isNotableDrop({ rarity: Rarity.LEGENDARY, isNew: false })).toBe(true);
    expect(isNotableDrop({ rarity: Rarity.SECRET, isNew: false })).toBe(true);
  });

  it("notifie une première copie, même commune", () => {
    expect(isNotableDrop({ rarity: Rarity.COMMON, isNew: true })).toBe(true);
  });

  it("ignore une carte rare déjà possédée", () => {
    expect(isNotableDrop({ rarity: Rarity.RARE, isNew: false })).toBe(false);
    expect(isNotableDrop({ rarity: Rarity.COMMON, isNew: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pipou/shared test`
Expected: FAIL (`NOTIFICATION_CATEGORY_OF` / `isNotableDrop` non exportés).

- [ ] **Step 3: Write the implementation**

`packages/shared/src/enums/notification.ts` :

```ts
import { Rarity } from "./card";

// Ces valeurs sont stockées en base (colonne notification.type).
export const NotificationType = {
  QUEST_COMPLETED: "QUEST_COMPLETED",
  CARD_DROP: "CARD_DROP",
  LISTING_SOLD: "LISTING_SOLD",
  PATCHNOTE: "PATCHNOTE",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationCategory = {
  REWARD: "reward",
  INFORMATION: "information",
} as const;
export type NotificationCategory =
  (typeof NotificationCategory)[keyof typeof NotificationCategory];

export const NOTIFICATION_CATEGORY_OF: Record<
  NotificationType,
  NotificationCategory
> = {
  [NotificationType.QUEST_COMPLETED]: NotificationCategory.REWARD,
  [NotificationType.CARD_DROP]: NotificationCategory.REWARD,
  [NotificationType.LISTING_SOLD]: NotificationCategory.INFORMATION,
  [NotificationType.PATCHNOTE]: NotificationCategory.INFORMATION,
};

/** Messages affichés par page de la boîte. */
export const INBOX_PAGE_SIZE = 15;
/** Un patchnote reste visible (et comptabilisé non lu) pendant ce délai. */
export const PATCHNOTE_VISIBLE_DAYS = 30;
/** Un message lu est supprimé après ce délai. */
export const READ_RETENTION_DAYS = 30;

/** Rareté à partir de laquelle un drop déclenche un message. */
export const DROP_NOTIFICATION_MIN_RARITY: Rarity = Rarity.EPIC;

const RARITY_RANK: Record<Rarity, number> = {
  [Rarity.COMMON]: 0,
  [Rarity.UNCOMMON]: 1,
  [Rarity.RARE]: 2,
  [Rarity.EPIC]: 3,
  [Rarity.LEGENDARY]: 4,
  [Rarity.SECRET]: 5,
};

/** Un drop est notable s'il atteint le seuil de rareté ou si c'est une première copie. */
export function isNotableDrop(card: { rarity: Rarity; isNew: boolean }): boolean {
  return (
    card.isNew ||
    RARITY_RANK[card.rarity] >= RARITY_RANK[DROP_NOTIFICATION_MIN_RARITY]
  );
}
```

`packages/shared/src/enums/index.ts` : ajouter `export * from "./notification";`

`packages/shared/src/api/notifications.ts` :

```ts
import type { Rarity } from "../enums/card";
import type {
  NotificationCategory,
  NotificationType,
} from "../enums/notification";
import type { QuestRewardType } from "../enums/quest";

export interface QuestCompletedNotificationPayload {
  userQuestId: number;
  title: string;
  rewardType: QuestRewardType;
  rewardAmount: number;
}

export interface CardDropEntry {
  cardId: number;
  name: string;
  rarity: Rarity;
  isNew: boolean;
}

/** Cartes notables d'une ouverture de booster (déjà filtrées par isNotableDrop). */
export interface CardDropNotificationPayload {
  boosterName: string;
  cards: CardDropEntry[];
}

export interface ListingSoldNotificationPayload {
  buyerUsername: string;
  itemName: string;
  totalPrice: number;
  transactionId: number;
}

export interface PatchnoteNotificationPayload {
  title: string;
  body: string;
}

export interface NotificationPayloadMap {
  QUEST_COMPLETED: QuestCompletedNotificationPayload;
  CARD_DROP: CardDropNotificationPayload;
  LISTING_SOLD: ListingSoldNotificationPayload;
  PATCHNOTE: PatchnoteNotificationPayload;
}

/**
 * Message de la boîte. `id` est "n:<id>" (notification) ou "p:<id>" (patchnote) :
 * les deux tables sont fusionnées. `read` vaut false pour une quête à réclamer.
 */
export type NotificationItem = {
  [T in NotificationType]: {
    id: string;
    type: T;
    category: NotificationCategory;
    createdAt: string;
    read: boolean;
    payload: NotificationPayloadMap[T];
  };
}[NotificationType];

export interface UnreadCounts {
  all: number;
  reward: number;
  information: number;
}

/** GET /notifications */
export interface NotificationsResponse {
  items: NotificationItem[];
  unread: UnreadCounts;
}

/** GET /notifications?category=&limit= */
export interface NotificationsQuery {
  category?: NotificationCategory;
  limit?: number;
}
```

`packages/shared/src/api/index.ts` : ajouter `export * from "./notifications";`

`packages/shared/src/api/requests.ts` : ajouter à la fin

```ts
// ─── Patchnotes ───────────────────────────────────────────────────────────────

/** POST /patchnotes (admin) */
export interface CreatePatchnoteRequest {
  title: string;
  body: string;
}
```

- [ ] **Step 4: Run test and build to verify they pass**

Run: `pnpm --filter @pipou/shared test && pnpm build:shared`
Expected: PASS ; build OK.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): notification types, categories and drop threshold"
```

---

### Task 2: Entités et migration

**Files:**
- Create: `apps/backend/src/notifications/notification.entity.ts`, `patchnote.entity.ts`, `patchnote-read.entity.ts`, `apps/backend/src/database/migrations/1791000000003-Notifications.ts`

**Interfaces:**
- Consumes: `NotificationType` de `@pipou/shared`, `User` entity.
- Produces: entités `Notification` (`id, userId, type, payload, refId, readAt, createdAt`), `Patchnote` (`id, title, body, createdAt`), `PatchnoteRead` (`userId, patchnoteId, readAt`).

- [ ] **Step 1: Write the entities**

`notification.entity.ts` :

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
import type { NotificationType } from '@pipou/shared';
import { User } from '../users/user.entity';

/** Message de la boîte de réception d'un joueur. */
@Entity('notification')
@Index('idx_notification_user_created', ['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_notification_user',
  })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 32 })
  type!: NotificationType;

  /** Données propres au type, voir NotificationPayloadMap dans @pipou/shared. */
  @Column({ type: 'json' })
  payload!: Record<string, unknown>;

  /** Id de la ressource liée (user_quest pour QUEST_COMPLETED), pour marquer lu à la réclamation. */
  @Column({ name: 'ref_id', type: 'int', nullable: true, default: null })
  refId!: number | null;

  @Column({
    name: 'read_at',
    type: 'datetime',
    precision: 0,
    nullable: true,
    default: null,
  })
  readAt!: Date | null;

  @CreateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
```

`patchnote.entity.ts` :

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Patchnote publié par un admin, visible par tous les joueurs. */
@Entity('patchnote')
export class Patchnote {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
```

`patchnote-read.entity.ts` :

```ts
import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Un patchnote lu par un joueur (évite d'écrire une ligne par joueur à chaque patch). */
@Entity('patchnote_read')
export class PatchnoteRead {
  @PrimaryColumn({ name: 'user_id' })
  userId!: number;

  @PrimaryColumn({ name: 'patchnote_id' })
  patchnoteId!: number;

  @CreateDateColumn({
    name: 'read_at',
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  readAt!: Date;
}
```

- [ ] **Step 2: Write the migration**

`1791000000003-Notifications.ts` :

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Boîte de réception : messages par joueur, patchnotes et leur état « lu ». */
export class Notifications1791000000003 implements MigrationInterface {
  name = 'Notifications1791000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `notification` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`user_id` int NOT NULL, ' +
        '`type` varchar(32) NOT NULL, ' +
        '`payload` json NOT NULL, ' +
        '`ref_id` int NULL DEFAULT NULL, ' +
        '`read_at` datetime NULL DEFAULT NULL, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'INDEX `idx_notification_user_created` (`user_id`, `created_at`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `notification` ADD CONSTRAINT `fk_notification_user` ' +
        'FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'CREATE TABLE `patchnote` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`title` varchar(120) NOT NULL, ' +
        '`body` text NOT NULL, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `patchnote_read` (' +
        '`user_id` int NOT NULL, ' +
        '`patchnote_id` int NOT NULL, ' +
        '`read_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        'PRIMARY KEY (`user_id`, `patchnote_id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `patchnote_read` ADD CONSTRAINT `fk_patchnote_read_user` ' +
        'FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE `patchnote_read` ADD CONSTRAINT `fk_patchnote_read_patchnote` ' +
        'FOREIGN KEY (`patchnote_id`) REFERENCES `patchnote`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `patchnote_read`');
    await queryRunner.query('DROP TABLE `patchnote`');
    await queryRunner.query('DROP TABLE `notification`');
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @pipou/backend exec tsc --noEmit -p tsconfig.json`
Expected: pas d'erreur. (Les entités sont chargées par le glob `*.entity{.ts,.js}` de `app.module.ts` ; aucun enregistrement manuel.)

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/notifications apps/backend/src/database/migrations/1791000000003-Notifications.ts
git commit -m "feat(notifications): notification, patchnote and patchnote_read tables"
```

---

### Task 3: NotificationsService

**Files:**
- Create: `apps/backend/src/notifications/notifications.service.ts`, `apps/backend/src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Consumes: entités de la Task 2, types de la Task 1.
- Produces (utilisé par les Tasks 4 et 5) :
  - `notify<T extends NotificationType>(userId: number, type: T, payload: NotificationPayloadMap[T], refId?: number | null): Promise<void>` — sauvegarde puis émet `notification.created` `{ userId }`
  - `list(userId: number, category?: NotificationCategory, limit?: number): Promise<NotificationsResponse>`
  - `markAllRead(userId: number): Promise<void>`
  - `markQuestsClaimed(userId: number, userQuestIds: number[]): Promise<void>`
  - `createPatchnote(dto: CreatePatchnoteRequest): Promise<Patchnote>` — émet `notification.created` `{ userId: null }` (diffusion)
  - handlers `@OnEvent` : `quest.completed`, `quest.claimed`, `listing.sold`, `booster.opened`

- [ ] **Step 1: Write the failing test**

`notifications.service.spec.ts` :

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { Notification } from './notification.entity';
import { Patchnote } from './patchnote.entity';
import { PatchnoteRead } from './patchnote-read.entity';
import {
  NotificationCategory,
  NotificationType,
  QuestRewardType,
  Rarity,
} from '@pipou/shared';

const notificationRepo = {
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn((v: unknown) => v),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const patchnoteRepo = {
  find: jest.fn(),
  create: jest.fn((v: unknown) => v),
  save: jest.fn(),
};
const patchnoteReadRepo = { find: jest.fn(), insert: jest.fn() };
const emitter = { emit: jest.fn() };

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    notificationRepo.find.mockResolvedValue([]);
    notificationRepo.count.mockResolvedValue(0);
    patchnoteRepo.find.mockResolvedValue([]);
    patchnoteReadRepo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: getRepositoryToken(Patchnote), useValue: patchnoteRepo },
        { provide: getRepositoryToken(PatchnoteRead), useValue: patchnoteReadRepo },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('notify', () => {
    it('sauvegarde le message et prévient le flux temps réel', async () => {
      await service.notify(7, NotificationType.LISTING_SOLD, {
        buyerUsername: 'bob',
        itemName: 'Alpha',
        totalPrice: 120,
        transactionId: 3,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith({
        userId: 7,
        type: NotificationType.LISTING_SOLD,
        payload: {
          buyerUsername: 'bob',
          itemName: 'Alpha',
          totalPrice: 120,
          transactionId: 3,
        },
        refId: null,
      });
      expect(emitter.emit).toHaveBeenCalledWith('notification.created', {
        userId: 7,
      });
    });
  });

  describe('handlers', () => {
    it('quest.completed crée un message lié à la quête', async () => {
      await service.onQuestCompleted({
        userId: 7,
        userQuestId: 42,
        title: 'Ouvre 3 boosters',
        rewardType: QuestRewardType.GOLD,
        rewardAmount: 100,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 7,
          type: NotificationType.QUEST_COMPLETED,
          refId: 42,
          payload: {
            userQuestId: 42,
            title: 'Ouvre 3 boosters',
            rewardType: QuestRewardType.GOLD,
            rewardAmount: 100,
          },
        }),
      );
    });

    it('quest.claimed marque lu le message des quêtes réclamées', async () => {
      await service.onQuestClaimed({ userId: 7, userQuestIds: [42, 43] });
      expect(notificationRepo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = notificationRepo.update.mock.calls[0] as [
        Record<string, unknown>,
        { readAt: Date },
      ];
      expect(where.userId).toBe(7);
      expect(where.type).toBe(NotificationType.QUEST_COMPLETED);
      expect(patch.readAt).toBeInstanceOf(Date);
    });

    it('quest.claimed sans quête ne fait rien', async () => {
      await service.onQuestClaimed({ userId: 7, userQuestIds: [] });
      expect(notificationRepo.update).not.toHaveBeenCalled();
    });

    it('listing.sold prévient le vendeur', async () => {
      await service.onListingSold({
        sellerId: 9,
        buyerUsername: 'bob',
        itemName: 'Alpha',
        totalPrice: 50,
        transactionId: 1,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 9,
          type: NotificationType.LISTING_SOLD,
        }),
      );
    });

    it('booster.opened ne garde que les cartes notables, en un seul message', async () => {
      await service.onBoosterOpened({
        userId: 7,
        boosterName: 'Alpha',
        cards: [
          { cardId: 1, name: 'A', rarity: Rarity.COMMON, isNew: false },
          { cardId: 2, name: 'B', rarity: Rarity.LEGENDARY, isNew: false },
          { cardId: 3, name: 'C', rarity: Rarity.COMMON, isNew: true },
        ],
      });
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.CARD_DROP,
          payload: {
            boosterName: 'Alpha',
            cards: [
              { cardId: 2, name: 'B', rarity: Rarity.LEGENDARY, isNew: false },
              { cardId: 3, name: 'C', rarity: Rarity.COMMON, isNew: true },
            ],
          },
        }),
      );
    });

    it('booster.opened sans carte notable ne crée rien', async () => {
      await service.onBoosterOpened({
        userId: 7,
        boosterName: 'Alpha',
        cards: [{ cardId: 1, name: 'A', rarity: Rarity.RARE, isNew: false }],
      });
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    const created = new Date('2026-10-10T10:00:00.000Z');

    it('fusionne messages et patchnotes, du plus récent au plus ancien', async () => {
      notificationRepo.find.mockResolvedValue([
        {
          id: 1,
          type: NotificationType.LISTING_SOLD,
          payload: { itemName: 'Alpha' },
          readAt: null,
          createdAt: created,
        },
      ]);
      patchnoteRepo.find.mockResolvedValue([
        {
          id: 5,
          title: 'v1.2',
          body: 'Équilibrage',
          createdAt: new Date('2026-10-11T08:00:00.000Z'),
        },
      ]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);

      const res = await service.list(7);

      expect(res.items.map((i) => i.id)).toEqual(['p:5', 'n:1']);
      expect(res.items[0]).toMatchObject({
        type: NotificationType.PATCHNOTE,
        category: NotificationCategory.INFORMATION,
        read: true,
        payload: { title: 'v1.2', body: 'Équilibrage' },
      });
      expect(res.items[1]).toMatchObject({ read: false });
    });

    it("n'inclut pas les patchnotes dans l'onglet récompense", async () => {
      await service.list(7, NotificationCategory.REWARD);
      expect(patchnoteRepo.find).not.toHaveBeenCalledWith(
        expect.objectContaining({ take: expect.anything() }),
      );
      const where = notificationRepo.find.mock.calls[0][0].where as {
        type: { _value: string[] };
      };
      expect(where.type._value.sort()).toEqual(
        [NotificationType.CARD_DROP, NotificationType.QUEST_COMPLETED].sort(),
      );
    });

    it('compte les non lus par catégorie, patchnotes inclus', async () => {
      // 1er count = récompense, 2e = information (hors patchnote)
      notificationRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      patchnoteRepo.find.mockResolvedValue([
        { id: 5, title: 't', body: 'b', createdAt: created },
        { id: 6, title: 't', body: 'b', createdAt: created },
      ]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);

      const res = await service.list(7);

      expect(res.unread).toEqual({ all: 4, reward: 2, information: 2 });
    });

    it('coupe à la limite demandée', async () => {
      notificationRepo.find.mockResolvedValue(
        [1, 2, 3].map((id) => ({
          id,
          type: NotificationType.LISTING_SOLD,
          payload: {},
          readAt: null,
          createdAt: new Date(2026, 9, id),
        })),
      );
      const res = await service.list(7, undefined, 2);
      expect(res.items).toHaveLength(2);
    });
  });

  describe('markAllRead', () => {
    it('marque lu tout sauf les quêtes, marque les patchnotes, et purge les anciens lus', async () => {
      patchnoteRepo.find.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);

      await service.markAllRead(7);

      expect(notificationRepo.update).toHaveBeenCalledTimes(1);
      expect(patchnoteReadRepo.insert).toHaveBeenCalledWith([
        { userId: 7, patchnoteId: 6 },
      ]);
      expect(notificationRepo.delete).toHaveBeenCalledTimes(1);
    });

    it("n'insère rien quand tous les patchnotes sont déjà lus", async () => {
      patchnoteRepo.find.mockResolvedValue([{ id: 5 }]);
      patchnoteReadRepo.find.mockResolvedValue([{ patchnoteId: 5 }]);
      await service.markAllRead(7);
      expect(patchnoteReadRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('createPatchnote', () => {
    it('sauvegarde et diffuse à tous les joueurs', async () => {
      patchnoteRepo.save.mockResolvedValue({ id: 8, title: 'v1.3', body: 'x' });
      const res = await service.createPatchnote({ title: 'v1.3', body: 'x' });
      expect(res.id).toBe(8);
      expect(emitter.emit).toHaveBeenCalledWith('notification.created', {
        userId: null,
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pipou/backend test -- notifications.service`
Expected: FAIL (module `./notifications.service` introuvable).

- [ ] **Step 3: Write the implementation**

`notifications.service.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  INBOX_PAGE_SIZE,
  NOTIFICATION_CATEGORY_OF,
  NotificationCategory,
  NotificationType,
  PATCHNOTE_VISIBLE_DAYS,
  READ_RETENTION_DAYS,
  isNotableDrop,
} from '@pipou/shared';
import type {
  CardDropEntry,
  CreatePatchnoteRequest,
  NotificationItem,
  NotificationPayloadMap,
  NotificationsResponse,
  QuestRewardType,
  UnreadCounts,
} from '@pipou/shared';
import { Notification } from './notification.entity';
import { Patchnote } from './patchnote.entity';
import { PatchnoteRead } from './patchnote-read.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/** Types stockés dans `notification` (les patchnotes ont leur propre table). */
const STORED_TYPES = Object.values(NotificationType).filter(
  (t) => t !== NotificationType.PATCHNOTE,
);
const typesOf = (category?: NotificationCategory): NotificationType[] =>
  STORED_TYPES.filter(
    (t) => !category || NOTIFICATION_CATEGORY_OF[t] === category,
  );

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notifications: Repository<Notification>,
    @InjectRepository(Patchnote)
    private patchnotes: Repository<Patchnote>,
    @InjectRepository(PatchnoteRead)
    private patchnoteReads: Repository<PatchnoteRead>,
    private eventEmitter: EventEmitter2,
  ) {}

  /* ===================== ÉCRITURE ===================== */

  async notify<T extends NotificationType>(
    userId: number,
    type: T,
    payload: NotificationPayloadMap[T],
    refId: number | null = null,
  ): Promise<void> {
    await this.notifications.save(
      this.notifications.create({
        userId,
        type,
        payload: payload as unknown as Record<string, unknown>,
        refId,
      }),
    );
    this.eventEmitter.emit('notification.created', { userId });
  }

  async createPatchnote(dto: CreatePatchnoteRequest): Promise<Patchnote> {
    const patchnote = await this.patchnotes.save(this.patchnotes.create(dto));
    // userId null : diffusion à tous les joueurs connectés
    this.eventEmitter.emit('notification.created', { userId: null });
    return patchnote;
  }

  /**
   * Marque lu tout ce que le joueur a vu, sauf les quêtes à réclamer (lues à la
   * réclamation), puis supprime ses vieux messages lus.
   */
  async markAllRead(userId: number): Promise<void> {
    await this.notifications.update(
      {
        userId,
        readAt: IsNull(),
        type: Not(NotificationType.QUEST_COMPLETED),
      },
      { readAt: new Date() },
    );

    const unread = await this.unreadPatchnoteIds(userId);
    if (unread.length > 0) {
      await this.patchnoteReads.insert(
        unread.map((patchnoteId) => ({ userId, patchnoteId })),
      );
    }

    await this.notifications.delete({
      userId,
      readAt: LessThan(daysAgo(READ_RETENTION_DAYS)),
    });
  }

  async markQuestsClaimed(
    userId: number,
    userQuestIds: number[],
  ): Promise<void> {
    if (userQuestIds.length === 0) return;
    await this.notifications.update(
      {
        userId,
        type: NotificationType.QUEST_COMPLETED,
        refId: In(userQuestIds),
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );
  }

  /* ===================== LECTURE ===================== */

  async list(
    userId: number,
    category?: NotificationCategory,
    limit: number = INBOX_PAGE_SIZE,
  ): Promise<NotificationsResponse> {
    const rows = await this.notifications.find({
      where: { userId, type: In(typesOf(category)) },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });

    const patchnotes =
      category === NotificationCategory.REWARD
        ? []
        : await this.patchnotes.find({
            where: { createdAt: MoreThanOrEqual(daysAgo(PATCHNOTE_VISIBLE_DAYS)) },
            order: { createdAt: 'DESC', id: 'DESC' },
            take: limit,
          });
    const readIds = await this.readPatchnoteIds(
      userId,
      patchnotes.map((p) => p.id),
    );

    const items: NotificationItem[] = [
      ...rows.map(
        (n) =>
          ({
            id: `n:${n.id}`,
            type: n.type,
            category: NOTIFICATION_CATEGORY_OF[n.type],
            createdAt: n.createdAt.toISOString(),
            read: n.readAt !== null,
            payload: n.payload,
          }) as NotificationItem,
      ),
      ...patchnotes.map(
        (p): NotificationItem => ({
          id: `p:${p.id}`,
          type: NotificationType.PATCHNOTE,
          category: NotificationCategory.INFORMATION,
          createdAt: p.createdAt.toISOString(),
          read: readIds.has(p.id),
          payload: { title: p.title, body: p.body },
        }),
      ),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    return { items, unread: await this.unreadCounts(userId) };
  }

  private async unreadCounts(userId: number): Promise<UnreadCounts> {
    const unreadWhere = (category: NotificationCategory) => ({
      userId,
      readAt: IsNull(),
      type: In(typesOf(category)),
    });
    const [reward, infoMessages, unreadPatchnotes] = await Promise.all([
      this.notifications.count({ where: unreadWhere(NotificationCategory.REWARD) }),
      this.notifications.count({
        where: unreadWhere(NotificationCategory.INFORMATION),
      }),
      this.unreadPatchnoteIds(userId),
    ]);
    const information = infoMessages + unreadPatchnotes.length;
    return { all: reward + information, reward, information };
  }

  /** Patchnotes visibles (30 j) que le joueur n'a pas encore lus. */
  private async unreadPatchnoteIds(userId: number): Promise<number[]> {
    const recent = await this.patchnotes.find({
      where: { createdAt: MoreThanOrEqual(daysAgo(PATCHNOTE_VISIBLE_DAYS)) },
      select: { id: true },
    });
    const ids = recent.map((p) => p.id);
    const read = await this.readPatchnoteIds(userId, ids);
    return ids.filter((id) => !read.has(id));
  }

  private async readPatchnoteIds(
    userId: number,
    patchnoteIds: number[],
  ): Promise<Set<number>> {
    if (patchnoteIds.length === 0) return new Set();
    const reads = await this.patchnoteReads.find({
      where: { userId, patchnoteId: In(patchnoteIds) },
    });
    return new Set(reads.map((r) => r.patchnoteId));
  }

  /* ===================== ÉVÉNEMENTS ===================== */

  @OnEvent('quest.completed')
  async onQuestCompleted(payload: {
    userId: number;
    userQuestId: number;
    title: string;
    rewardType: QuestRewardType;
    rewardAmount: number;
  }): Promise<void> {
    const { userId, ...data } = payload;
    await this.notify(userId, NotificationType.QUEST_COMPLETED, data, data.userQuestId);
  }

  @OnEvent('quest.claimed')
  async onQuestClaimed(payload: {
    userId: number;
    userQuestIds: number[];
  }): Promise<void> {
    await this.markQuestsClaimed(payload.userId, payload.userQuestIds);
  }

  @OnEvent('listing.sold')
  async onListingSold(payload: {
    sellerId: number;
    buyerUsername: string;
    itemName: string;
    totalPrice: number;
    transactionId: number;
  }): Promise<void> {
    const { sellerId, ...data } = payload;
    await this.notify(sellerId, NotificationType.LISTING_SOLD, data);
  }

  @OnEvent('booster.opened')
  async onBoosterOpened(payload: {
    userId: number;
    boosterName?: string;
    cards?: CardDropEntry[];
  }): Promise<void> {
    const notable = (payload.cards ?? []).filter(isNotableDrop);
    if (notable.length === 0) return;
    await this.notify(payload.userId, NotificationType.CARD_DROP, {
      boosterName: payload.boosterName ?? '',
      cards: notable,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pipou/backend test -- notifications.service`
Expected: PASS. Si le test « onglet récompense » échoue à cause de `_value` (détail interne de `In()`), remplacer l'assertion par `expect(notificationRepo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 15 }))` et vérifier le filtre par un test de `typesOf` exporté — ne pas laisser un test dépendant d'un champ privé qui casse.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/notifications
git commit -m "feat(notifications): service with list, read state and event handlers"
```

---

### Task 4: Contrôleurs, DTO et module

**Files:**
- Create: `apps/backend/src/notifications/dto/list-notifications-query.dto.ts`, `dto/create-patchnote.dto.ts`, `notifications.controller.ts`, `notifications.controller.spec.ts`, `notifications.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `NotificationsService` (Task 3), `JwtAuthGuard`, `AdminGuard`, `AuthenticatedRequest`.
- Produces: `GET /notifications`, `POST /notifications/read-all` (204), `GET /notifications/events` (SSE `notification.created`), `POST /patchnotes` (admin).

- [ ] **Step 1: Write the failing test**

`notifications.controller.spec.ts` :

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { NotificationsController, PatchnotesController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationCategory } from '@pipou/shared';
import type { AuthenticatedRequest } from '../auth/auth-user';

const service = {
  list: jest.fn(),
  markAllRead: jest.fn(),
  createPatchnote: jest.fn(),
};
const req = (userId: number): AuthenticatedRequest => ({
  user: { userId, isAdmin: false },
});

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let patchnotes: PatchnotesController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController, PatchnotesController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();
    controller = module.get(NotificationsController);
    patchnotes = module.get(PatchnotesController);
  });

  it('list délègue au service avec le joueur connecté', async () => {
    service.list.mockResolvedValue({ items: [], unread: { all: 0, reward: 0, information: 0 } });
    await controller.list(req(7), { category: NotificationCategory.REWARD, limit: 10 });
    expect(service.list).toHaveBeenCalledWith(7, NotificationCategory.REWARD, 10);
  });

  it('readAll délègue au service', async () => {
    await controller.readAll(req(7));
    expect(service.markAllRead).toHaveBeenCalledWith(7);
  });

  it('le flux SSE ne transmet que les messages du joueur et les diffusions', async () => {
    const stream = controller.events(req(7));
    const received = firstValueFrom(stream);
    controller.onCreated({ userId: 9 }); // autre joueur : ignoré
    controller.onCreated({ userId: 7 });
    await expect(received).resolves.toEqual({
      type: 'notification.created',
      data: '{}',
    });
  });

  it('une diffusion (userId null) atteint tout le monde', async () => {
    const received = firstValueFrom(controller.events(req(7)));
    controller.onCreated({ userId: null });
    await expect(received).resolves.toMatchObject({ type: 'notification.created' });
  });

  it('crée un patchnote', async () => {
    service.createPatchnote.mockResolvedValue({ id: 1 });
    await patchnotes.create({ title: 'v1', body: 'x' });
    expect(service.createPatchnote).toHaveBeenCalledWith({ title: 'v1', body: 'x' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pipou/backend test -- notifications.controller`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write the implementation**

`dto/list-notifications-query.dto.ts` :

```ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NotificationCategory } from '@pipou/shared';
import type { NotificationsQuery } from '@pipou/shared';

export class ListNotificationsQueryDto implements NotificationsQuery {
  @IsOptional()
  @IsIn(Object.values(NotificationCategory))
  category?: NotificationCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
```

`dto/create-patchnote.dto.ts` :

```ts
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CreatePatchnoteRequest } from '@pipou/shared';

export class CreatePatchnoteDto implements CreatePatchnoteRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
```

`notifications.controller.ts` :

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  MessageEvent,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { NotificationsResponse } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { NotificationsService } from './notifications.service';
import { Patchnote } from './patchnote.entity';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { CreatePatchnoteDto } from './dto/create-patchnote.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  /** userId null = diffusion (nouveau patchnote). */
  private readonly created = new Subject<{ userId: number | null }>();

  constructor(private readonly service: NotificationsService) {}

  @OnEvent('notification.created')
  onCreated(payload: { userId: number | null }): void {
    this.created.next(payload);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationsResponse> {
    return this.service.list(req.user.userId, query.category, query.limit);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.service.markAllRead(req.user.userId);
  }

  // 📡 SSE privé : prévient le front d'un nouveau message (il refetch ensuite)
  @Sse('events')
  events(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    const userId = req.user.userId;
    return this.created.asObservable().pipe(
      filter((e) => e.userId === null || e.userId === userId),
      map((): MessageEvent => ({ type: 'notification.created', data: '{}' })),
    );
  }
}

@Controller('patchnotes')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PatchnotesController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  create(@Body() dto: CreatePatchnoteDto): Promise<Patchnote> {
    return this.service.createPatchnote(dto);
  }
}
```

`notifications.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { Patchnote } from './patchnote.entity';
import { PatchnoteRead } from './patchnote-read.entity';
import { NotificationsService } from './notifications.service';
import {
  NotificationsController,
  PatchnotesController,
} from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Patchnote, PatchnoteRead])],
  controllers: [NotificationsController, PatchnotesController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
```

`app.module.ts` : ajouter `import { NotificationsModule } from './notifications/notifications.module';` et `NotificationsModule,` à la fin de la liste `imports`, après `SandboxModule,`.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @pipou/backend test -- notifications && pnpm --filter @pipou/backend exec tsc --noEmit`
Expected: PASS, aucune erreur de type. (Les guards sont fournis par les autres modules ; si `JwtAuthGuard` demande un provider dans le module de test, suivre `transactions.controller.spec.ts` qui fait déjà ce montage.)

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/notifications apps/backend/src/app.module.ts
git commit -m "feat(notifications): REST, SSE and admin patchnote endpoints"
```

---

### Task 5: Émetteurs (quêtes et drops de booster)

**Files:**
- Modify: `apps/backend/src/quests/quests.service.ts`, `apps/backend/src/quests/quests.service.spec.ts`, `apps/backend/src/boosters/boosters.service.ts`, `apps/backend/src/boosters/boosters.service.spec.ts`, `apps/backend/src/users/users.service.ts`

**Interfaces:**
- Consumes: noms d'événements attendus par `NotificationsService` (Task 3).
- Produces :
  - `quest.completed` `{ userId, userQuestId, title, rewardType, rewardAmount }`, émis quand une quête passe à terminée ;
  - `quest.claimed` `{ userId, userQuestIds: number[] }`, émis aux 3 chemins de réclamation (`claimReward`, `claimAllRewards`, auto-réclamation dans `resetExpiredQuests`) ;
  - `booster.opened` enrichi de `boosterName: string` et `cards: CardDropEntry[]` ;
  - `UsersService.findOwnedCardIds(userId: number, cardIds: number[]): Promise<Set<number>>`.

- [ ] **Step 1: Write the failing tests**

Dans `quests.service.spec.ts`, ajouter le mock de l'émetteur et l'importer :

```ts
import { EventEmitter2 } from '@nestjs/event-emitter';
const mockEmitter = { emit: jest.fn() };
```

et, dans le `providers` du module de test (à côté de `UsersService`) : `{ provide: EventEmitter2, useValue: mockEmitter },`. Puis ajouter ces tests (adapter le nom du `describe` racine et les helpers existants : `fakeUserQuest`, `fakeQuest`, `mockUserQuestRepo`) :

```ts
describe('événements de boîte de réception', () => {
  it('émet quest.completed quand une quête vient d\'être terminée', async () => {
    const uq = {
      ...fakeUserQuest,
      id: 42,
      quest: { ...fakeQuest, title: 'Ouvre 3 boosters', rewardType: RewardType.GOLD, rewardAmount: 100 },
      progress: {
        operator: ConditionOperator.AND,
        conditions: [
          { type: ConditionType.OPEN_BOOSTER, current: 2, target: 3, completed: false },
        ],
        globalCompleted: false,
      },
    };
    mockUserQuestRepo.find.mockResolvedValue([uq]);

    await service.track(7, ConditionType.OPEN_BOOSTER, { amount: 1 });

    expect(mockEmitter.emit).toHaveBeenCalledWith('quest.completed', {
      userId: 7,
      userQuestId: 42,
      title: 'Ouvre 3 boosters',
      rewardType: RewardType.GOLD,
      rewardAmount: 100,
    });
  });

  it('n\'émet rien tant que la quête n\'est pas terminée', async () => {
    mockUserQuestRepo.find.mockResolvedValue([structuredClone(fakeUserQuest)]);
    await service.track(7, ConditionType.OPEN_BOOSTER, { amount: 1 });
    expect(mockEmitter.emit).not.toHaveBeenCalledWith('quest.completed', expect.anything());
  });

  it('émet quest.claimed à la réclamation', async () => {
    mockUserQuestRepo.findOne.mockResolvedValue({
      ...fakeUserQuest,
      id: 42,
      isCompleted: true,
      rewardClaimed: false,
    });
    mockUserQuestRepo.save.mockResolvedValue({});
    await service.claimReward(7, 42);
    expect(mockEmitter.emit).toHaveBeenCalledWith('quest.claimed', {
      userId: 7,
      userQuestIds: [42],
    });
  });

  it('émet quest.claimed pour toutes les quêtes de claimAllRewards', async () => {
    mockUserQuestRepo.find.mockResolvedValue([
      { ...fakeUserQuest, id: 1, isCompleted: true, rewardClaimed: false },
      { ...fakeUserQuest, id: 2, isCompleted: true, rewardClaimed: false },
    ]);
    mockUserQuestRepo.save.mockResolvedValue({});
    await service.claimAllRewards(7);
    expect(mockEmitter.emit).toHaveBeenCalledWith('quest.claimed', {
      userId: 7,
      userQuestIds: [1, 2],
    });
  });
});
```

Dans `boosters.service.spec.ts`, ajouter un test sur l'ouverture (suivre le montage des mocks déjà présent pour `openBooster` ; ajouter au mock de `usersService` la méthode `findOwnedCardIds: jest.fn()`) :

```ts
it('émet booster.opened avec les cartes tirées et leur nouveauté', async () => {
  // montage identique aux tests openBooster existants (booster, cards, transaction)
  usersService.findOwnedCardIds.mockResolvedValue(new Set<number>([/* ids déjà possédés */]));

  await service.openBooster(boosterId, userId);

  expect(eventEmitter.emit).toHaveBeenCalledWith(
    'booster.opened',
    expect.objectContaining({
      userId,
      boosterName: expect.any(String),
      cards: expect.arrayContaining([
        expect.objectContaining({
          cardId: expect.any(Number),
          name: expect.any(String),
          rarity: expect.any(String),
          isNew: expect.any(Boolean),
        }),
      ]),
    }),
  );
});
```

(Lire d'abord les tests `openBooster` existants de ce fichier pour réutiliser leurs fixtures exactes ; si aucun n'existe, créer un jeu minimal : un booster `cardNumber: 1`, une carte `{ id: 5, name: 'X', rarity: Rarity.COMMON }`, `findOwnedCardIds` renvoyant `new Set()` → `isNew: true`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @pipou/backend test -- quests.service boosters.service`
Expected: FAIL (les événements ne sont pas émis ; `EventEmitter2` n'est pas encore injecté dans `QuestService`).

- [ ] **Step 3: Implement — quêtes**

Dans `quests.service.ts` :

1. Import : `import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';` (remplace l'import existant d'`OnEvent`).
2. Constructeur : ajouter `private eventEmitter: EventEmitter2,` après `private usersService: UsersService,`.
3. Dans `track`, remplacer la boucle par :

```ts
    for (const uq of userQuests) {
      const updated = this.updateProgress(uq, eventType, meta);
      if (updated) {
        await this.userQuestRepository.save(uq);
        if (uq.isCompleted) {
          this.eventEmitter.emit('quest.completed', {
            userId,
            userQuestId: uq.id,
            title: uq.quest.title,
            rewardType: uq.quest.rewardType,
            rewardAmount: Number(uq.quest.rewardAmount),
          });
        }
      }
    }
```

(`track` ne charge que des quêtes `isCompleted: false` ; si `uq.isCompleted` est vrai après `updateProgress`, elle vient donc d'être terminée.)

4. `claimReward` : après `uq.rewardClaimed = true;` et avant le `return`, remplacer par :

```ts
    uq.rewardClaimed = true;
    const saved = await this.userQuestRepository.save(uq);
    this.eventEmitter.emit('quest.claimed', { userId, userQuestIds: [uq.id] });
    return saved;
```

5. `claimAllRewards` : après la boucle `for`, avant `return { count: ... }` :

```ts
    this.eventEmitter.emit('quest.claimed', {
      userId,
      userQuestIds: claimableQuests.map((uq) => uq.id),
    });
```

6. `resetExpiredQuests` : dans le `if (uq.isCompleted && !uq.rewardClaimed)`, après `claimed.push({...})`, ajouter :

```ts
        this.eventEmitter.emit('quest.claimed', { userId, userQuestIds: [uq.id] });
```

- [ ] **Step 4: Implement — drops de booster**

Dans `users.service.ts`, ajouter à côté de `addCardToUser` :

```ts
  /** Parmi `cardIds`, ceux que le joueur possède déjà. */
  async findOwnedCardIds(
    userId: number,
    cardIds: number[],
  ): Promise<Set<number>> {
    if (cardIds.length === 0) return new Set();
    const owned = await this.userCardRepository.find({
      where: { user: { id: userId }, card: { id: In(cardIds) } },
      relations: { card: true },
    });
    return new Set(owned.map((uc) => uc.card.id));
  }
```

(Vérifier que `In` est importé de `typeorm` en tête de `users.service.ts` ; l'ajouter à l'import existant sinon.)

Dans `boosters.service.ts` :

1. Après `drawnCards.sort(...)` et le calcul de `cardGroups`, avant `let historyId: number;`, calculer la nouveauté **avant** la transaction (qui ajoute les cartes) :

```ts
    const ownedBefore = await this.usersService.findOwnedCardIds(
      userId,
      Object.keys(cardGroups).map(Number),
    );
```

2. Remplacer l'émission de `booster.opened` par :

```ts
    const seen = new Set<number>();
    const dropped = drawnCards
      .filter((card) => !seen.has(card.id) && seen.add(card.id))
      .map((card) => ({
        cardId: card.id,
        name: card.name,
        rarity: card.rarity,
        isNew: !ownedBefore.has(card.id),
      }));
    this.eventEmitter.emit('booster.opened', {
      userId,
      boosterId: booster.id,
      boosterName: booster.name,
      setId: booster.cardSet.id,
      amount: 1,
      cards: dropped,
    });
```

(Les cartes sont dédoublonnées : un doublon dans le même booster ne compte qu'une fois, `isNew` valant true si le joueur ne la possédait pas avant l'ouverture.)

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend exec tsc --noEmit`
Expected: PASS (toute la suite backend, pas seulement les nouveaux tests : `QuestService` a un nouveau paramètre de constructeur, tout autre spec qui l'instancie doit fournir `EventEmitter2`).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src
git commit -m "feat(notifications): emit quest and booster drop events for the inbox"
```

---

### Task 6: Service et hooks front

**Files:**
- Create: `apps/frontend/src/services/notification.service.ts`, `apps/frontend/src/hooks/useNotifications.ts`
- Modify: `apps/frontend/src/utils/querykeys.ts`, `apps/frontend/src/App.tsx`

**Interfaces:**
- Consumes: `NotificationsResponse`, `NotificationCategory`, `CreatePatchnoteRequest` (Task 1) ; endpoints de la Task 4.
- Produces :
  - `notificationService.list(category?)`, `.markAllRead()`, `.createPatchnote(data)`
  - `type InboxTab = "all" | NotificationCategory`
  - `useNotifications(tab: InboxTab)`, `useMarkNotificationsRead()`, `useNotificationEvents()`
  - `QUERY_KEYS.notifications.all` / `.list(tab)`

- [ ] **Step 1: Write the service**

`services/notification.service.ts` :

```ts
import { api } from "../api/api";
import type {
  CreatePatchnoteRequest,
  NotificationCategory,
  NotificationsResponse,
} from "@pipou/shared";

export const notificationService = {
  async list(category?: NotificationCategory): Promise<NotificationsResponse> {
    const res = await api.get("/notifications", {
      params: category ? { category } : {},
    });
    return res.data;
  },

  async markAllRead(): Promise<void> {
    await api.post("/notifications/read-all");
  },

  // Admin
  async createPatchnote(data: CreatePatchnoteRequest): Promise<void> {
    await api.post("/patchnotes", data);
  },
};
```

- [ ] **Step 2: Add the query keys**

Dans `utils/querykeys.ts`, après `dailyRewardStatus` :

```ts
  notifications: {
    all: ["notifications"] as const,
    list: (tab: string) => ["notifications", tab] as const,
  },
```

- [ ] **Step 3: Write the hooks**

`hooks/useNotifications.ts` :

```ts
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationCategory } from "@pipou/shared";
import { notificationService } from "../services/notification.service";
import { QUERY_KEYS } from "../utils/querykeys";

export type InboxTab = "all" | NotificationCategory;

export const useNotifications = (tab: InboxTab) =>
  useQuery({
    queryKey: QUERY_KEYS.notifications.list(tab),
    queryFn: () =>
      notificationService.list(tab === "all" ? undefined : tab),
  });

/** Appelé à la fermeture de la boîte : les messages vus passent en lu. */
export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all }),
  });
};

const API_URL = import.meta.env.VITE_API_URL;

/** SSE privé : un nouveau message arrive, on recharge la boîte. */
export function useNotificationEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const es = new EventSource(`${API_URL}/notifications/events`, {
      withCredentials: true,
    });
    es.addEventListener("notification.created", () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all });
    });
    es.onerror = (err) => console.error("SSE notifications disconnected", err);
    return () => es.close();
  }, [queryClient]);
}
```

- [ ] **Step 4: Mount the SSE globally**

Dans `App.tsx` : `import { useNotificationEvents } from "./hooks/useNotifications";` et, dans `AppLayout`, juste après l'appel `useSseNotifications(...)` :

```tsx
  useNotificationEvents();
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @pipou/frontend typecheck`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(inbox): notification service, query keys and SSE hook"
```

---

### Task 7: Boîte de réception (UI)

**Files:**
- Create: `apps/frontend/src/features/inbox/InboxWidget.tsx`, `InboxItem.tsx`, `relativeTime.ts`, `InboxWidget.css`, `apps/frontend/src/__tests__/components/InboxWidget.test.tsx`
- Modify: `apps/frontend/src/components/Icons.tsx`, `apps/frontend/src/components/Header.tsx`, `apps/frontend/src/i18n/locales/fr.json`, `en.json`, `ko.json`
- Delete: `apps/frontend/src/features/quests/QuestInboxWidget.tsx`, `QuestInboxWidget.css`

**Interfaces:**
- Consumes: `useNotifications`, `useMarkNotificationsRead`, `InboxTab` (Task 6) ; `useClaimReward` (`hooks/useGameData`) ; `questService.claimAllRewards`.
- Produces: `<InboxWidget onOpenQuests={() => void} />`, `IconMail`.

- [ ] **Step 1: Write the failing test**

`__tests__/components/InboxWidget.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { NotificationsResponse } from "@pipou/shared";
import i18n from "../../i18n";
import InboxWidget from "../../features/inbox/InboxWidget";
import { notificationService } from "../../services/notification.service";
import { questService } from "../../services/quest.service";

vi.mock("../../services/notification.service", () => ({
  notificationService: { list: vi.fn(), markAllRead: vi.fn() },
}));
vi.mock("../../services/quest.service", () => ({
  questService: { claimReward: vi.fn(), claimAllRewards: vi.fn(), getMyQuests: vi.fn() },
}));

const NOW = "2026-10-11T10:00:00.000Z";

const ALL: NotificationsResponse = {
  unread: { all: 3, reward: 1, information: 2 },
  items: [
    {
      id: "n:1",
      type: "QUEST_COMPLETED",
      category: "reward",
      createdAt: NOW,
      read: false,
      payload: { userQuestId: 42, title: "Ouvre 3 boosters", rewardType: "GOLD", rewardAmount: 100 },
    },
    {
      id: "n:2",
      type: "LISTING_SOLD",
      category: "information",
      createdAt: NOW,
      read: false,
      payload: { buyerUsername: "bob", itemName: "Alpha", totalPrice: 120, transactionId: 3 },
    },
    {
      id: "p:5",
      type: "PATCHNOTE",
      category: "information",
      createdAt: NOW,
      read: false,
      payload: { title: "Patch 1.2", body: "Équilibrage des légendaires" },
    },
  ],
};

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InboxWidget onOpenQuests={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InboxWidget", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationService.list).mockImplementation(async (category) => ({
      unread: ALL.unread,
      items: category ? ALL.items.filter((i) => i.category === category) : ALL.items,
    }));
    vi.mocked(notificationService.markAllRead).mockResolvedValue();
    vi.mocked(questService.claimReward).mockResolvedValue({});
  });

  it("affiche le nombre de messages non lus sur l'icône", async () => {
    renderWidget();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("liste les trois types de messages dans l'onglet Tout", async () => {
    renderWidget();
    await userEvent.click(await screen.findByRole("button", { name: /boîte/i }));
    expect(await screen.findByText("Ouvre 3 boosters")).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
    expect(screen.getByText("Patch 1.2")).toBeInTheDocument();
  });

  it("filtre par onglet Information", async () => {
    renderWidget();
    await userEvent.click(await screen.findByRole("button", { name: /boîte/i }));
    await userEvent.click(await screen.findByRole("tab", { name: /information/i }));
    await waitFor(() => expect(notificationService.list).toHaveBeenCalledWith("information"));
    expect(await screen.findByText("Patch 1.2")).toBeInTheDocument();
    expect(screen.queryByText("Ouvre 3 boosters")).not.toBeInTheDocument();
  });

  it("réclame une quête depuis son message", async () => {
    renderWidget();
    await userEvent.click(await screen.findByRole("button", { name: /boîte/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Réclamer" }));
    await waitFor(() => expect(questService.claimReward).toHaveBeenCalledWith(42));
  });

  it("déplie le texte d'un patchnote", async () => {
    renderWidget();
    await userEvent.click(await screen.findByRole("button", { name: /boîte/i }));
    expect(screen.queryByText("Équilibrage des légendaires")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByText("Patch 1.2"));
    expect(await screen.findByText("Équilibrage des légendaires")).toBeInTheDocument();
  });

  it("marque les messages lus à la fermeture", async () => {
    renderWidget();
    const trigger = await screen.findByRole("button", { name: /boîte/i });
    await userEvent.click(trigger);
    await screen.findByText("Patch 1.2");
    await userEvent.click(trigger);
    await waitFor(() => expect(notificationService.markAllRead).toHaveBeenCalledTimes(1));
  });

  it("propose de réessayer quand le chargement échoue", async () => {
    vi.mocked(notificationService.list).mockRejectedValue(new Error("boom"));
    renderWidget();
    await userEvent.click(await screen.findByRole("button", { name: /boîte/i }));
    expect(await screen.findByRole("button", { name: /réessayer/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pipou/frontend test -- InboxWidget`
Expected: FAIL (module `features/inbox/InboxWidget` introuvable).

- [ ] **Step 3: Add the icon**

Dans `components/Icons.tsx`, après `IconBell` :

```tsx
// ── Icône Enveloppe (boîte de réception) ─────────────────────────────────────
export function IconMail({
  size = 16,
  color = "currentColor",
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m3.5 7 8.5 6 8.5-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Add the translations**

`fr.json` : ajouter, au même niveau que `"quests"`, le bloc `"inbox"` (ajouter une virgule après le bloc précédent si nécessaire) :

```json
  "inbox": {
    "label": "Boîte de réception",
    "title": "Boîte de réception",
    "tabs": {
      "all": "Tout",
      "information": "Information",
      "reward": "Récompense"
    },
    "empty": "Rien de nouveau 🎉",
    "error": "Impossible de charger la boîte",
    "retry": "Réessayer",
    "quest_completed": "Quête terminée",
    "drop_title": "Booster ouvert : {{booster}}",
    "drop_new": "Nouvelle",
    "drop_more": "+{{count}} autres",
    "sold_title": "{{buyer}} a acheté {{item}}",
    "sold_amount": "+{{price}} or",
    "patchnote": "Patchnote",
    "see_collection": "Voir la collection",
    "see_market": "Voir le marché",
    "rarity": {
      "common": "Commune",
      "uncommon": "Peu commune",
      "rare": "Rare",
      "epic": "Épique",
      "legendary": "Légendaire",
      "secret": "Secrète"
    },
    "quest_type": {
      "DAILY": "Quotidienne",
      "WEEKLY": "Hebdomadaire",
      "MONTHLY": "Mensuelle",
      "EVENT": "Événement",
      "NONE": "Permanent"
    }
  },
```

`en.json` : même structure :

```json
  "inbox": {
    "label": "Inbox",
    "title": "Inbox",
    "tabs": { "all": "All", "information": "Information", "reward": "Rewards" },
    "empty": "Nothing new 🎉",
    "error": "Couldn't load the inbox",
    "retry": "Retry",
    "quest_completed": "Quest completed",
    "drop_title": "Booster opened: {{booster}}",
    "drop_new": "New",
    "drop_more": "+{{count}} more",
    "sold_title": "{{buyer}} bought {{item}}",
    "sold_amount": "+{{price}} gold",
    "patchnote": "Patch notes",
    "see_collection": "View collection",
    "see_market": "View marketplace",
    "rarity": {
      "common": "Common",
      "uncommon": "Uncommon",
      "rare": "Rare",
      "epic": "Epic",
      "legendary": "Legendary",
      "secret": "Secret"
    },
    "quest_type": {
      "DAILY": "Daily",
      "WEEKLY": "Weekly",
      "MONTHLY": "Monthly",
      "EVENT": "Event",
      "NONE": "Permanent"
    }
  },
```

`ko.json` :

```json
  "inbox": {
    "label": "받은 편지함",
    "title": "받은 편지함",
    "tabs": { "all": "전체", "information": "정보", "reward": "보상" },
    "empty": "새로운 소식이 없어요 🎉",
    "error": "받은 편지함을 불러올 수 없어요",
    "retry": "다시 시도",
    "quest_completed": "퀘스트 완료",
    "drop_title": "부스터 개봉: {{booster}}",
    "drop_new": "신규",
    "drop_more": "외 {{count}}장",
    "sold_title": "{{buyer}}님이 {{item}}을(를) 구매했어요",
    "sold_amount": "+{{price}} 골드",
    "patchnote": "패치노트",
    "see_collection": "컬렉션 보기",
    "see_market": "마켓 보기",
    "rarity": {
      "common": "커먼",
      "uncommon": "언커먼",
      "rare": "레어",
      "epic": "에픽",
      "legendary": "레전더리",
      "secret": "시크릿"
    },
    "quest_type": {
      "DAILY": "일일",
      "WEEKLY": "주간",
      "MONTHLY": "월간",
      "EVENT": "이벤트",
      "NONE": "상시"
    }
  },
```

Les clés `quests.claim`, `quests.claim_all`, `quests.see_all` existantes sont réutilisées. Dans chaque fichier, supprimer les clés devenues inutiles `quests.inbox_label`, `quests.inbox_title`, `quests.nothing_to_claim` (vérifier d'abord par `grep -rn "inbox_label\|inbox_title\|nothing_to_claim" apps/frontend/src` qu'aucun autre fichier ne les utilise).

- [ ] **Step 5: Write the helpers and the row component**

`features/inbox/relativeTime.ts` :

```ts
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** « il y a 3 h », dans la langue courante. */
export function formatRelative(iso: string, lang: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(0, "minute");
}
```

`features/inbox/InboxItem.tsx` :

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationItem } from "@pipou/shared";
import { NotificationType } from "@pipou/shared";
import Button from "../../components/Button";
import {
  IconBell,
  IconBooster,
  IconBundle,
  IconCards,
  IconGold,
  IconQuest,
} from "../../components/Icons";
import { formatRelative } from "./relativeTime";

const MAX_DROP_NAMES = 3;

function RewardIcon({ type }: { type: string }) {
  const p = { size: 12, color: "#eebc77" };
  if (type === "GOLD") return <IconGold {...p} />;
  if (type === "BOOSTER") return <IconBooster {...p} />;
  if (type === "BUNDLE") return <IconBundle {...p} />;
  return null;
}

interface Props {
  item: NotificationItem;
  claiming: boolean;
  onClaim: (userQuestId: number) => void;
  onNavigate: (path: string) => void;
}

/** Une ligne de la boîte ; le rendu dépend du type (switch exhaustif). */
export default function InboxItem({ item, claiming, onClaim, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const when = formatRelative(item.createdAt, i18n.language);
  const dot = !item.read && <span className="inbox__dot" aria-hidden="true" />;

  switch (item.type) {
    case NotificationType.QUEST_COMPLETED: {
      const { userQuestId, title, rewardType, rewardAmount } = item.payload;
      return (
        <div className="inbox__item inbox__item--reward">
          <div className="inbox__row">
            <IconQuest size={14} color="#eebc77" />
            <span className="inbox__title">{title}</span>
            <span className="inbox__chip">
              <RewardIcon type={rewardType} />+{rewardAmount}
            </span>
            {dot}
          </div>
          <div className="inbox__footer">
            <span className="inbox__meta">
              {t("inbox.quest_completed")} · {when}
            </span>
            {!item.read && (
              <Button
                variant="primary-inverse"
                size="sm"
                disabled={claiming}
                onClick={() => onClaim(userQuestId)}
              >
                {claiming ? "..." : t("quests.claim")}
              </Button>
            )}
          </div>
        </div>
      );
    }

    case NotificationType.CARD_DROP: {
      const { boosterName, cards } = item.payload;
      const shown = cards.slice(0, MAX_DROP_NAMES);
      const rest = cards.length - shown.length;
      return (
        <div className="inbox__item inbox__item--reward">
          <div className="inbox__row">
            <IconCards size={14} color="#eebc77" />
            <span className="inbox__title">
              {t("inbox.drop_title", { booster: boosterName })}
            </span>
            {dot}
          </div>
          <ul className="inbox__cards">
            {shown.map((card) => (
              <li key={card.cardId} className={`inbox__card inbox__card--${card.rarity}`}>
                {card.name} · {t(`inbox.rarity.${card.rarity}`)}
                {card.isNew && <span className="inbox__new">{t("inbox.drop_new")}</span>}
              </li>
            ))}
            {rest > 0 && <li className="inbox__meta">{t("inbox.drop_more", { count: rest })}</li>}
          </ul>
          <div className="inbox__footer">
            <span className="inbox__meta">{when}</span>
            <Button variant="ghost-gold" size="sm" onClick={() => onNavigate("/profile")}>
              {t("inbox.see_collection")}
            </Button>
          </div>
        </div>
      );
    }

    case NotificationType.LISTING_SOLD: {
      const { buyerUsername, itemName, totalPrice } = item.payload;
      return (
        <div className="inbox__item">
          <div className="inbox__row">
            <IconGold size={14} color="#eebc77" />
            <span className="inbox__title">
              {t("inbox.sold_title", { buyer: buyerUsername, item: itemName })}
            </span>
            <span className="inbox__chip">{t("inbox.sold_amount", { price: totalPrice })}</span>
            {dot}
          </div>
          <div className="inbox__footer">
            <span className="inbox__meta">{when}</span>
            <Button variant="ghost-gold" size="sm" onClick={() => onNavigate("/marketplace")}>
              {t("inbox.see_market")}
            </Button>
          </div>
        </div>
      );
    }

    case NotificationType.PATCHNOTE: {
      const { title, body } = item.payload;
      return (
        <div className="inbox__item">
          <button
            type="button"
            className="inbox__row inbox__row--toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <IconBell size={14} color="#eebc77" />
            <span className="inbox__title">{title}</span>
            {dot}
          </button>
          {expanded && <p className="inbox__body">{body}</p>}
          <span className="inbox__meta">
            {t("inbox.patchnote")} · {when}
          </span>
        </div>
      );
    }

    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
}
```

- [ ] **Step 6: Write the widget**

`features/inbox/InboxWidget.tsx` :

```tsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationType } from "@pipou/shared";
import { useClaimReward } from "../../hooks/useGameData";
import {
  useMarkNotificationsRead,
  useNotifications,
  type InboxTab,
} from "../../hooks/useNotifications";
import { questService } from "../../services/quest.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import Button from "../../components/Button";
import { IconArrowRight, IconMail } from "../../components/Icons";
import InboxItem from "./InboxItem";
import "./InboxWidget.css";

const TABS: InboxTab[] = ["all", "information", "reward"];

export default function InboxWidget({ onOpenQuests }: { onOpenQuests: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const claim = useClaimReward();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>("all");
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // "all" alimente le badge et les compteurs d'onglets ; l'onglet actif liste les messages
  const all = useNotifications("all");
  const current = useNotifications(tab);
  const unread = all.data?.unread;

  const close = () => {
    setOpen(false);
    const hasMarkable = all.data?.items.some(
      (i) => !i.read && i.type !== NotificationType.QUEST_COMPLETED,
    );
    if (hasMarkable) markRead.mutate();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });

  const items = current.data?.items ?? [];
  const claimable = items.filter(
    (i) => i.type === NotificationType.QUEST_COMPLETED && !i.read,
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
  };

  const handleClaim = (userQuestId: number) => {
    setClaimError(null);
    claim.mutate(userQuestId, {
      onSettled: refresh,
      onError: (e) => setClaimError(apiErrorMessage(e)),
    });
  };

  const handleClaimAll = async () => {
    setClaimingAll(true);
    setClaimError(null);
    try {
      await questService.claimAllRewards();
    } catch (e) {
      setClaimError(apiErrorMessage(e));
    } finally {
      refresh();
      setClaimingAll(false);
    }
  };

  return (
    <div className="inbox" ref={ref}>
      <Button
        variant="ghost-bordeaux"
        size="icon"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={t("inbox.label")}
        aria-expanded={open}
      >
        <IconMail size={17} color="#7a1c3b" />
        {!!unread?.all && <span className="inbox__badge">{unread.all}</span>}
      </Button>

      {open && (
        <div className="inbox__dropdown">
          <div className="inbox__dheader">
            <span className="inbox__dtitle">{t("inbox.title")}</span>
            {claimable.length > 1 && (
              <Button
                variant="primary-inverse"
                size="sm"
                onClick={handleClaimAll}
                disabled={claimingAll || claim.isPending}
              >
                {claimingAll ? "..." : `${t("quests.claim_all")} (${claimable.length})`}
              </Button>
            )}
          </div>

          <div className="inbox__tabs" role="tablist">
            {TABS.map((key) => {
              const count = unread?.[key] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={`inbox__tab${tab === key ? " inbox__tab--active" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {t(`inbox.tabs.${key}`)}
                  {count > 0 && <span className="inbox__tab-count">{count}</span>}
                </button>
              );
            })}
          </div>

          {claimError && <p className="inbox__error" role="alert">{claimError}</p>}

          <div className="inbox__list">
            {current.isError ? (
              <div className="inbox__state" role="alert">
                <p>{t("inbox.error")}</p>
                <Button variant="ghost-gold" size="sm" onClick={() => current.refetch()}>
                  {t("inbox.retry")}
                </Button>
              </div>
            ) : items.length === 0 ? (
              <p className="inbox__state">{current.isLoading ? "..." : t("inbox.empty")}</p>
            ) : (
              items.map((item) => (
                <InboxItem
                  key={item.id}
                  item={item}
                  claiming={claim.isPending}
                  onClaim={handleClaim}
                  onNavigate={(path) => {
                    close();
                    navigate(path);
                  }}
                />
              ))
            )}
          </div>

          <div className="inbox__footer-bar">
            <Button
              variant="ghost-gold"
              size="sm"
              onClick={() => {
                close();
                onOpenQuests();
              }}
            >
              {t("quests.see_all")} <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write the styles**

`features/inbox/InboxWidget.css` (reprend les valeurs de l'ancien `QuestInboxWidget.css` ; largeur adaptée au mobile) :

```css
.inbox {
  position: relative;
}

.inbox__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #e03060;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 17px;
  height: 17px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid #f5efe0;
}

.inbox__dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: min(340px, calc(100vw - 24px));
  background: #3d1020;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  z-index: 200;
}

.inbox__dheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.inbox__dtitle {
  font-size: 0.8rem;
  font-weight: 700;
  color: #eebc77;
}

.inbox__tabs {
  display: flex;
  gap: 4px;
  padding: 8px 8px 0;
}
.inbox__tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  color: rgba(255, 255, 255, 0.5);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 7px 4px;
  cursor: pointer;
}
.inbox__tab--active {
  color: #eebc77;
  border-bottom-color: #eebc77;
}
.inbox__tab-count {
  background: #e03060;
  color: #fff;
  font-size: 9px;
  border-radius: 8px;
  padding: 0 5px;
  min-width: 14px;
  text-align: center;
}

.inbox__error {
  margin: 8px 12px 0;
  font-size: 0.72rem;
  color: #ff9db3;
}

.inbox__list {
  max-height: min(380px, 60vh);
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inbox__state {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
  padding: 20px 0;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.inbox__item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.inbox__item--reward {
  background: rgba(238, 188, 119, 0.07);
  border-color: rgba(238, 188, 119, 0.22);
}
.inbox__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.inbox__row--toggle {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  width: 100%;
}
.inbox__title {
  flex: 1;
  font-size: 0.78rem;
  font-weight: 700;
  color: #eebc77;
  line-height: 1.3;
}
.inbox__chip {
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(238, 188, 119, 0.15);
  color: #eebc77;
  border-radius: 20px;
  padding: 2px 7px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.inbox__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e03060;
  flex: none;
}
.inbox__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.inbox__meta {
  font-size: 0.63rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.3px;
}
.inbox__cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.inbox__card {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.8);
}
.inbox__card--epic {
  color: #c9a0ff;
}
.inbox__card--legendary {
  color: #ffd166;
}
.inbox__card--secret {
  color: #ff9db3;
}
.inbox__new {
  margin-left: 6px;
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #3d1020;
  background: #eebc77;
  border-radius: 6px;
  padding: 1px 5px;
}
.inbox__body {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
}

.inbox__footer-bar {
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  text-align: center;
}
```

- [ ] **Step 8: Swap the widget in the header and delete the old one**

`components/Header.tsx` : remplacer l'import `import QuestInboxWidget from "../features/quests/QuestInboxWidget";` par `import InboxWidget from "../features/inbox/InboxWidget";` et la ligne `<QuestInboxWidget onOpenPanel={() => navigate("/profile")} />` par `<InboxWidget onOpenQuests={() => navigate("/profile")} />`.

Supprimer l'ancien widget :

```bash
git rm apps/frontend/src/features/quests/QuestInboxWidget.tsx apps/frontend/src/features/quests/QuestInboxWidget.css
```

- [ ] **Step 9: Run tests, typecheck, lint**

Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: PASS partout. Si `apiErrorMessage` n'est pas exporté de `utils/errors.ts` sous ce nom, lire ce fichier et utiliser l'export réel. Si l'onglet « Information » du test ne trouve pas `role="tab"`, vérifier que le bouton a bien `role="tab"`.

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(inbox): inbox dropdown with Tout/Information/Récompense tabs"
```

---

### Task 8: Formulaire de patchnote (admin)

**Files:**
- Create: `apps/frontend/src/features/inbox/PatchnoteManager.tsx`
- Modify: `apps/frontend/src/pages/Admin.tsx`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`

**Interfaces:**
- Consumes: `notificationService.createPatchnote` (Task 6), `QUERY_KEYS.notifications.all`.
- Produces: onglet admin `patchnotes`.

- [ ] **Step 1: Add the translations**

Dans chaque fichier de langue, bloc `admin.tabs` : ajouter `"patchnotes"` (fr `"Patchnotes"`, en `"Patch notes"`, ko `"패치노트"`). Puis ajouter au bloc `admin` (même niveau que `sandbox_back`) :

```json
    "patchnote": {
      "title_label": "Titre",
      "body_label": "Texte",
      "publish": "Publier",
      "published": "Patchnote publié",
      "hint": "Envoyé à tous les joueurs dans leur boîte de réception."
    }
```

(en : `"Title"`, `"Text"`, `"Publish"`, `"Patch note published"`, `"Sent to every player's inbox."` ; ko : `"제목"`, `"내용"`, `"게시"`, `"패치노트를 게시했어요"`, `"모든 플레이어의 받은 편지함으로 전송돼요."`)

- [ ] **Step 2: Write the component**

`features/inbox/PatchnoteManager.tsx` :

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../../services/notification.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import Button from "../../components/Button";
import "../../components/manager.css";

export default function PatchnoteManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const publish = useMutation({
    mutationFn: () =>
      notificationService.createPatchnote({ title: title.trim(), body: body.trim() }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all });
    },
  });

  const canPublish = title.trim().length > 0 && body.trim().length > 0;

  return (
    <form
      className="manager-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (canPublish) publish.mutate();
      }}
    >
      <p>{t("admin.patchnote.hint")}</p>
      <label>
        {t("admin.patchnote.title_label")}
        <input
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        {t("admin.patchnote.body_label")}
        <textarea
          rows={8}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      {publish.isError && <p role="alert">{apiErrorMessage(publish.error)}</p>}
      {publish.isSuccess && <p role="status">{t("admin.patchnote.published")}</p>}
      <Button type="submit" disabled={!canPublish || publish.isPending}>
        {publish.isPending ? "..." : t("admin.patchnote.publish")}
      </Button>
    </form>
  );
}
```

(Regarder `components/manager.css` et un manager existant, par exemple `BannerManager.tsx`, pour réutiliser les vraies classes de formulaire ; remplacer `manager-form` par la classe réellement utilisée.)

- [ ] **Step 3: Add the admin tab**

Dans `pages/Admin.tsx` :
- import `PatchnoteManager from "../features/inbox/PatchnoteManager"` et `IconBell` (ajouté à l'import de `../components/Icons`) ;
- type `AdminTab` : ajouter `| "patchnotes"` ;
- `TABS` : ajouter `{ key: "patchnotes", icon: <IconBell size={22} /> },` avant l'entrée `sandbox` ;
- rendu : ajouter `{tab === "patchnotes" && <PatchnoteManager />}` avant la ligne du sandbox.

- [ ] **Step 4: Typecheck, lint, test**

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(admin): patchnote form that broadcasts to every inbox"
```

---

### Task 9: Vérification finale

**Files:** aucun (vérification).

- [ ] **Step 1: Suite complète**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS partout. (Ne pas lancer `pnpm build` si la CI le fait déjà ; le lancer sinon.)

- [ ] **Step 2: Migration sur une base locale uniquement**

Vérifier d'abord que `apps/backend/.env.e2e` pointe sur une base locale (`DB_HOST` = `localhost`/`127.0.0.1`/`db`), jamais sur Aiven. Puis :

Run: `pnpm --filter @pipou/backend migration:run:local`
Expected: `Notifications1791000000003` exécutée. Puis `migration:revert:local` et à nouveau `migration:run:local` pour vérifier que `down` fonctionne. Si aucune base locale n'est disponible, **le dire** à l'utilisateur au lieu de l'ignorer.

- [ ] **Step 3: Contrôle visuel à 430 px**

Lancer l'app (`pnpm dev`, relais IPv6 pour l'API locale selon la mémoire du projet), puis capturer avec Playwright, viewport 430 px, thème clair : (a) badge sur l'enveloppe, (b) dropdown ouvert avec les trois onglets, (c) un patchnote déplié, (d) état vide, (e) onglet admin « Patchnotes ». Vérifier : pas de défilement horizontal, dropdown dans l'écran, texte lisible. Créer des données de test par le formulaire admin et en finissant une quête sur une base **locale**.

- [ ] **Step 4: Rapport**

Résumer à l'utilisateur ce qui est vérifié et ce qui ne l'est pas (migration, capture), sans pousser. La PR vers `main` (déploiement prod via la CI) n'est ouverte que sur demande explicite.
