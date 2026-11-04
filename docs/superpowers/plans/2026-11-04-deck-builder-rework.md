# Rework construction de deck et sélection en combat — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decks favoris + dernier deck mémorisé, decks injouables masqués au combat, éditeur de deck en onglets Deck / Collection avec des lignes façon galerie.

**Architecture:** Deux colonnes sur `deck` (`is_favorite`, `last_used_at`) ; le back marque le deck utilisé quand `DeckSubmissionService` l'accepte. `checkDeckForMatch` passe dans `@pipou/shared` pour que le front filtre les decks jouables. Côté front : helpers purs `deckPicker.ts`, `DeckWidget` réécrit (deck par défaut + « Changer »), composant `DeckCardRow` partagé par les deux onglets de l'éditeur.

**Tech Stack:** NestJS 11 + TypeORM (MySQL), jest ; React 18 + TanStack Query + react-i18next, vitest + Testing Library ; `@pipou/shared` (vitest).

**Spec:** `docs/superpowers/specs/2026-11-04-deck-builder-rework-design.md`

## Global Constraints

- Tout type échangé front/back vit dans `@pipou/shared` ; `@pipou/shared` n'a aucune dépendance runtime. Après modification : `pnpm build:shared`.
- Ne jamais se connecter à Aiven (le `.env` local = prod). Migration testée sur la BDD docker locale `cardcollect_dev` avec `ENV_FILE=.env.dev.local`.
- Icônes : SVG de `apps/frontend/src/components/Icons.tsx`, jamais d'emoji.
- Textes UI via i18n, dans `fr.json`, `en.json` et `ko.json`.
- Cibles tactiles ≥ 44 px. Capture Playwright à 430px avant livraison.
- Commits sur `dev`, messages en français, Conventional Commits.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/game/deck-check.ts` (créé) | `checkDeckForMatch`, `DeckEntry` (déplacés du back) |
| `packages/shared/src/game/deck-check.test.ts` (créé) | tests de la règle |
| `packages/shared/src/game/index.ts` | export |
| `packages/shared/src/api/requests.ts` | `SetDeckFavoriteRequest` |
| `apps/backend/src/decks/deck-rules.ts` | ré-export depuis shared |
| `apps/backend/src/database/migrations/1791000000024-DeckFavorites.ts` (créé) | colonnes |
| `apps/backend/src/decks/deck.entity.ts` | `isFavorite`, `lastUsedAt` |
| `apps/backend/src/decks/dto/set-deck-favorite.dto.ts` (créé) | DTO |
| `apps/backend/src/decks/decks.service.ts` | `setFavorite`, `markUsed` |
| `apps/backend/src/decks/decks.controller.ts` | `PATCH /decks/:id/favorite` |
| `apps/backend/src/decks/decks.service.spec.ts` (créé) | tests |
| `apps/backend/src/fights/services/deck-submission.service.ts` | appelle `markUsed` |
| `apps/backend/src/fights/services/deck-submission.service.spec.ts` (créé) | tests |
| `apps/frontend/src/services/deck.service.ts` | champs + `setFavorite` |
| `apps/frontend/src/features/deck/deckPicker.ts` (créé) | helpers purs |
| `apps/frontend/src/features/deck/deckPicker.test.ts` (créé) | tests |
| `apps/frontend/src/features/deck/useToggleFavorite.ts` (créé) | mutation optimiste |
| `apps/frontend/src/features/deck/DeckWidget.tsx` / `.css` | réécrit |
| `apps/frontend/src/features/deck/DeckWidget.test.tsx` (créé) | tests |
| `apps/frontend/src/features/deck/DeckCardRow.tsx` / `.css` (créés) | ligne galerie + quantités |
| `apps/frontend/src/features/deck/DeckCardRow.test.tsx` (créé) | tests |
| `apps/frontend/src/features/deck/DeckBuilder.tsx` / `.css` | étoile en liste, onglets |
| `apps/frontend/src/i18n/locales/{fr,en,ko}.json` | clés |

---

### Task 1: `checkDeckForMatch` dans `@pipou/shared` + requête favori

**Files:**
- Create: `packages/shared/src/game/deck-check.ts`
- Create: `packages/shared/src/game/deck-check.test.ts`
- Modify: `packages/shared/src/game/index.ts`
- Modify: `packages/shared/src/api/requests.ts:80-90`
- Modify: `apps/backend/src/decks/deck-rules.ts` (tout le fichier)

**Interfaces:**
- Produces: `checkDeckForMatch(entries: DeckEntry[]): string | null`, `interface DeckEntry { cardId: number; cardName: string; quantity: number; owned: number }`, `interface SetDeckFavoriteRequest { favorite: boolean }` — tous exportés par `@pipou/shared`.

- [ ] **Step 1: Test qui échoue**

`packages/shared/src/game/deck-check.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { checkDeckForMatch, type DeckEntry } from "./deck-check";

const entry = (over: Partial<DeckEntry> = {}): DeckEntry => ({
  cardId: 1,
  cardName: "Recrue",
  quantity: 3,
  owned: 3,
  ...over,
});

/** `n` cartes distinctes à 3 exemplaires, plus un reste. */
function deckOf(total: number): DeckEntry[] {
  const out: DeckEntry[] = [];
  for (let id = 1; total > 0; id++) {
    const q = Math.min(3, total);
    out.push(entry({ cardId: id, cardName: `C${id}`, quantity: q, owned: q }));
    total -= q;
  }
  return out;
}

describe("checkDeckForMatch", () => {
  it("accepte un deck de 30 à 40 cartes", () => {
    expect(checkDeckForMatch(deckOf(30))).toBeNull();
    expect(checkDeckForMatch(deckOf(40))).toBeNull();
  });

  it("refuse moins de 30 ou plus de 40 cartes", () => {
    expect(checkDeckForMatch(deckOf(29))).toMatch(/entre 30 et 40/);
    expect(checkDeckForMatch(deckOf(41))).toMatch(/entre 30 et 40/);
  });

  it("refuse plus de 3 exemplaires d'une même carte", () => {
    const deck = deckOf(27);
    deck.push(entry({ cardId: 99, cardName: "Gribouille", quantity: 2, owned: 2 }));
    deck.push(entry({ cardId: 99, cardName: "Gribouille", quantity: 2, owned: 2 }));
    expect(checkDeckForMatch(deck)).toMatch(/Gribouille/);
  });

  it("refuse une carte qui n'est plus possédée en quantité suffisante", () => {
    const deck = deckOf(30);
    deck[0] = { ...deck[0], owned: 1 };
    expect(checkDeckForMatch(deck)).toMatch(/ne possèdes plus/);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/shared test -- deck-check`
Expected: FAIL, `Failed to resolve import "./deck-check"`.

- [ ] **Step 3: Implémentation**

`packages/shared/src/game/deck-check.ts` (contenu repris tel quel de `apps/backend/src/decks/deck-rules.ts`) :

```ts
import { DECK_RULES } from "./rules";

export interface DeckEntry {
  cardId: number;
  cardName: string;
  quantity: number;
  /** Exemplaires possédés par le joueur au moment du lancement. */
  owned: number;
}

/** Message d'erreur si le deck ne peut pas être joué, sinon null. */
export function checkDeckForMatch(entries: DeckEntry[]): string | null {
  const total = entries.reduce((sum, e) => sum + e.quantity, 0);
  if (total < DECK_RULES.MIN_CARDS || total > DECK_RULES.MAX_CARDS)
    return `Un deck doit contenir entre ${DECK_RULES.MIN_CARDS} et ${DECK_RULES.MAX_CARDS} cartes (total actuel : ${total})`;

  const copies = new Map<number, { name: string; count: number }>();
  for (const e of entries) {
    const c = copies.get(e.cardId) ?? { name: e.cardName, count: 0 };
    c.count += e.quantity;
    copies.set(e.cardId, c);
  }
  for (const c of copies.values()) {
    if (c.count > DECK_RULES.MAX_COPIES)
      return `Maximum ${DECK_RULES.MAX_COPIES} exemplaires de « ${c.name} »`;
  }

  const missing = entries.find((e) => e.quantity > e.owned);
  if (missing)
    return `Tu ne possèdes plus assez d'exemplaires de « ${missing.cardName} »`;

  return null;
}
```

`packages/shared/src/game/index.ts` : ajouter après `export * from "./rules";` :

```ts
export * from "./deck-check";
```

`packages/shared/src/api/requests.ts`, sous `CreateDeckRequest` :

```ts
export interface SetDeckFavoriteRequest {
  favorite: boolean;
}
```

`apps/backend/src/decks/deck-rules.ts` remplacé par :

```ts
export { checkDeckForMatch } from '@pipou/shared';
export type { DeckEntry } from '@pipou/shared';
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/shared test -- deck-check`, puis `pnpm build:shared`, puis `pnpm --filter @pipou/backend test -- deck-rules`
Expected: tous PASS (le spec back existant passe toujours via le ré-export).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src apps/backend/src/decks/deck-rules.ts
git commit -m "refactor(shared): règle de deck jouable partagée et requête favori"
```

---

### Task 2: Backend — colonnes, favori, dernier deck utilisé

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000024-DeckFavorites.ts`
- Modify: `apps/backend/src/decks/deck.entity.ts`
- Create: `apps/backend/src/decks/dto/set-deck-favorite.dto.ts`
- Modify: `apps/backend/src/decks/decks.service.ts`
- Modify: `apps/backend/src/decks/decks.controller.ts`
- Modify: `apps/backend/src/fights/services/deck-submission.service.ts`
- Test: `apps/backend/src/decks/decks.service.spec.ts`, `apps/backend/src/fights/services/deck-submission.service.spec.ts`

**Interfaces:**
- Consumes: `SetDeckFavoriteRequest` (Task 1).
- Produces: JSON deck avec `isFavorite: boolean` et `lastUsedAt: string | null` ; `PATCH /decks/:id/favorite` body `{ favorite }` → deck mis à jour ; `DecksService.setFavorite(id: number, userId: number, favorite: boolean): Promise<Deck>` ; `DecksService.markUsed(id: number, userId: number): Promise<void>`.

- [ ] **Step 1: Tests qui échouent**

`apps/backend/src/decks/decks.service.spec.ts` :

```ts
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DecksService } from './decks.service';
import { Deck } from './deck.entity';
import { DeckCard } from './deck-card.entity';
import { UserCard } from '../users/user-card.entity';

const deckRepo = { findOne: jest.fn(), update: jest.fn() };

async function service() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DecksService,
      { provide: getRepositoryToken(Deck), useValue: deckRepo },
      { provide: getRepositoryToken(DeckCard), useValue: {} },
      { provide: getRepositoryToken(UserCard), useValue: {} },
      { provide: DataSource, useValue: {} },
    ],
  }).compile();
  return moduleRef.get(DecksService);
}

describe('DecksService — favoris et dernier deck', () => {
  beforeEach(() => jest.resetAllMocks());

  it('setFavorite met à jour le deck du joueur et le renvoie', async () => {
    const s = await service();
    deckRepo.findOne
      .mockResolvedValueOnce({ id: 4, userId: 7, isFavorite: false })
      .mockResolvedValueOnce({ id: 4, userId: 7, isFavorite: true });
    const deck = await s.setFavorite(4, 7, true);
    expect(deckRepo.update).toHaveBeenCalledWith({ id: 4 }, { isFavorite: true });
    expect(deck.isFavorite).toBe(true);
  });

  it("setFavorite refuse le deck d'un autre joueur", async () => {
    const s = await service();
    deckRepo.findOne.mockResolvedValue({ id: 4, userId: 8 });
    await expect(s.setFavorite(4, 7, true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(deckRepo.update).not.toHaveBeenCalled();
  });

  it('setFavorite : deck introuvable', async () => {
    const s = await service();
    deckRepo.findOne.mockResolvedValue(null);
    await expect(s.setFavorite(4, 7, true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('markUsed date le deck du joueur', async () => {
    const s = await service();
    await s.markUsed(4, 7);
    expect(deckRepo.update).toHaveBeenCalledWith(
      { id: 4, userId: 7 },
      { lastUsedAt: expect.any(Date) },
    );
  });
});
```

`apps/backend/src/fights/services/deck-submission.service.spec.ts` :

```ts
import { BadRequestException } from '@nestjs/common';
import { DeckSubmissionService } from './deck-submission.service';
import { createGameState } from '../helpers/game-factory';
import type { DecksService } from '../../decks/decks.service';
import type { GameEngine } from '../engine/game-engine';

function setup(setupError?: string) {
  const decks = {
    loadDeckForMatch: jest.fn().mockResolvedValue([]),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
  const engine = {
    setupDeck: jest.fn().mockReturnValue(setupError ? { error: setupError } : {}),
  };
  const svc = new DeckSubmissionService(
    decks as unknown as DecksService,
    engine as unknown as GameEngine,
  );
  const game = createGameState(
    1,
    { userId: 7, username: 'a', socketId: 's1' },
    { userId: 8, username: 'b', socketId: 's2' },
  );
  return { svc, decks, game };
}

describe('DeckSubmissionService — dernier deck utilisé', () => {
  it('marque le deck utilisé quand il est accepté', async () => {
    const { svc, decks, game } = setup();
    expect(await svc.submitDeck(game, 7, 4)).toEqual({});
    expect(decks.markUsed).toHaveBeenCalledWith(4, 7);
  });

  it('ne marque pas un deck refusé par les règles', async () => {
    const { svc, decks, game } = setup();
    decks.loadDeckForMatch.mockRejectedValue(new BadRequestException('non'));
    expect(await svc.submitDeck(game, 7, 4)).toEqual({ error: 'non' });
    expect(decks.markUsed).not.toHaveBeenCalled();
  });

  it("ne marque pas un deck refusé par l'installation", async () => {
    const { svc, decks, game } = setup('boom');
    expect(await svc.submitDeck(game, 7, 4)).toEqual({ error: 'boom' });
    expect(decks.markUsed).not.toHaveBeenCalled();
  });
});
```

Si `createGameState` attend d'autres arguments, lire `apps/backend/src/fights/helpers/game-factory.ts` et s'aligner sur l'appel de `fights.service.ts:167`.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- decks.service deck-submission`
Expected: FAIL, `s.setFavorite is not a function` / `markUsed` jamais appelé.

- [ ] **Step 3: Implémentation**

Migration `apps/backend/src/database/migrations/1791000000024-DeckFavorites.ts` :

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Decks favoris et dernier deck utilisé (spec 2026-11-04-deck-builder-rework). */
export class DeckFavorites1791000000024 implements MigrationInterface {
  name = 'DeckFavorites1791000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `deck` ADD `is_favorite` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `deck` ADD `last_used_at` timestamp NULL DEFAULT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `deck` DROP COLUMN `last_used_at`');
    await queryRunner.query('ALTER TABLE `deck` DROP COLUMN `is_favorite`');
  }
}
```

`deck.entity.ts`, après `deckCards` :

```ts
  @Column({ name: 'is_favorite', default: false })
  isFavorite!: boolean;

  @Column({
    name: 'last_used_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  lastUsedAt!: Date | null;
```

`dto/set-deck-favorite.dto.ts` :

```ts
import { IsBoolean } from 'class-validator';
import type { SetDeckFavoriteRequest } from '@pipou/shared';

export class SetDeckFavoriteDto implements SetDeckFavoriteRequest {
  @IsBoolean()
  favorite!: boolean;
}
```

`decks.service.ts`, après `findOne` :

```ts
  async setFavorite(
    id: number,
    userId: number,
    favorite: boolean,
  ): Promise<Deck> {
    await this.findOne(id, userId); // ownership check
    await this.deckRepo.update({ id }, { isFavorite: favorite });
    return this.findOne(id, userId);
  }

  /** Retient le deck comme dernier utilisé : il sera proposé par défaut. */
  async markUsed(id: number, userId: number): Promise<void> {
    await this.deckRepo.update({ id, userId }, { lastUsedAt: new Date() });
  }
```

`decks.controller.ts` : ajouter `Patch` à l'import `@nestjs/common`, `import { SetDeckFavoriteDto } from './dto/set-deck-favorite.dto';`, et après `update` :

```ts
  @Patch(':id/favorite')
  setFavorite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetDeckFavoriteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.decksService.setFavorite(id, req.user.userId, dto.favorite);
  }
```

`deck-submission.service.ts`, remplacer la dernière ligne `return this.engine.setupDeck(game, seat, cards);` par :

```ts
    const result = this.engine.setupDeck(game, seat, cards);
    if (!result.error) await this.decksService.markUsed(deckId, userId);
    return result;
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend test -- decks.service deck-submission deck-rules`
Expected: PASS.

Puis migration sur la BDD locale uniquement (jamais Aiven) : suivre la mémoire « Local test env » (`ENV_FILE=.env.dev.local`, base `cardcollect_dev`), lancer le backend en local et vérifier dans les logs que `DeckFavorites1791000000024` est appliquée, puis `DESCRIBE deck;` montre `is_favorite` et `last_used_at`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src
git commit -m "feat(decks): decks favoris et dernier deck utilisé"
```

---

### Task 3: Front — service et helpers de sélection

**Files:**
- Modify: `apps/frontend/src/services/deck.service.ts`
- Create: `apps/frontend/src/features/deck/deckPicker.ts`
- Create: `apps/frontend/src/features/deck/deckPicker.test.ts`
- Create: `apps/frontend/src/features/deck/useToggleFavorite.ts`

**Interfaces:**
- Consumes: `checkDeckForMatch`, `SetDeckFavoriteRequest` (Task 1) ; route `PATCH /decks/:id/favorite` (Task 2).
- Produces:
  - `Deck` gagne `isFavorite: boolean; lastUsedAt: string | null`.
  - `deckService.setFavorite(id: number, favorite: boolean): Promise<Deck>`.
  - `deckTotal(d: Deck): number`, `isPlayable(d: Deck): boolean`, `sortDecks(decks: readonly Deck[]): Deck[]`, `defaultDeck(playable: readonly Deck[]): Deck | null`, `lastUsedDeckId(decks: readonly Deck[]): number | null`, `coverCard(d: Deck): CardInDeck | null`, `cardFromDeck(c: CardInDeck): Card`.
  - `useToggleFavorite(): (deck: Deck) => void`.

- [ ] **Step 1: Test qui échoue**

`apps/frontend/src/features/deck/deckPicker.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { CardType } from "@pipou/shared";
import type { CardInDeck, Deck } from "../../services/deck.service";
import {
  coverCard,
  defaultDeck,
  deckTotal,
  isPlayable,
  lastUsedDeckId,
  sortDecks,
} from "./deckPicker";

let nextId = 1;
const card = (over: Partial<CardInDeck> = {}): CardInDeck =>
  ({
    id: nextId++,
    name: `Carte ${nextId}`,
    rarity: "common",
    type: CardType.MONSTER,
    atk: 100,
    hp: 100,
    cost: 1,
    ...over,
  }) as CardInDeck;

/** Deck de `total` cartes à 3 exemplaires possédés. */
function deck(over: Partial<Deck> = {}, total = 30): Deck {
  const deckCards: Deck["deckCards"] = [];
  for (let left = total; left > 0; left -= 3) {
    const c = card();
    const q = Math.min(3, left);
    deckCards.push({ quantity: q, userCard: { id: c.id, card: c, quantity: 3 } });
  }
  return {
    id: nextId++,
    name: "Deck",
    userId: 1,
    deckCards,
    createdAt: "",
    updatedAt: "",
    isFavorite: false,
    lastUsedAt: null,
    ...over,
  };
}

describe("deckPicker", () => {
  it("compte les cartes", () => {
    expect(deckTotal(deck({}, 35))).toBe(35);
  });

  it("jouable : 30 à 40 cartes toujours possédées", () => {
    expect(isPlayable(deck({}, 35))).toBe(true);
    expect(isPlayable(deck({}, 20))).toBe(false);
    const sold = deck({}, 30);
    sold.deckCards[0].userCard.quantity = 1;
    expect(isPlayable(sold)).toBe(false);
  });

  it("trie favoris d'abord, puis par nom", () => {
    const b = deck({ name: "B" });
    const a = deck({ name: "A" });
    const z = deck({ name: "Z", isFavorite: true });
    expect(sortDecks([b, a, z]).map((d) => d.name)).toEqual(["Z", "A", "B"]);
  });

  it("par défaut : le dernier utilisé", () => {
    const old = deck({ name: "A", isFavorite: true, lastUsedAt: "2026-11-01T10:00:00Z" });
    const last = deck({ name: "B", lastUsedAt: "2026-11-03T10:00:00Z" });
    expect(defaultDeck([old, last])).toBe(last);
    expect(lastUsedDeckId([old, last])).toBe(last.id);
  });

  it("par défaut sans historique : premier favori, sinon premier par nom", () => {
    const a = deck({ name: "A" });
    const fav = deck({ name: "Z", isFavorite: true });
    expect(defaultDeck([a, fav])).toBe(fav);
    expect(defaultDeck([deck({ name: "B" }), a])).toBe(a);
    expect(defaultDeck([])).toBeNull();
  });

  it("couverture : monstre le plus cher, puis la plus forte ATK", () => {
    const d = deck({}, 0);
    const spell = card({ type: CardType.SUPPORT, cost: 9 });
    const weak = card({ cost: 3, atk: 500 });
    const strong = card({ cost: 3, atk: 900 });
    const cheap = card({ cost: 1, atk: 2000 });
    for (const c of [spell, weak, strong, cheap])
      d.deckCards.push({ quantity: 1, userCard: { id: c.id, card: c, quantity: 1 } });
    expect(coverCard(d)).toBe(strong);
    expect(coverCard(deck({}, 0))).toBeNull();
  });
});
```

Vérifier le nom du membre « support » de `CardType` dans `packages/shared/src/enums` (valeur BDD `'support'`) et l'ajuster si besoin.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- deckPicker`
Expected: FAIL, `Failed to resolve import "./deckPicker"`.

- [ ] **Step 3: Implémentation**

`deck.service.ts` : import `SetDeckFavoriteRequest` depuis `@pipou/shared` ; dans `interface Deck`, après `deckCards` :

```ts
  isFavorite: boolean;
  /** Dernier lancement de combat avec ce deck (ISO), null si jamais joué. */
  lastUsedAt: string | null;
```

et dans `deckService`, après `updateDeck` :

```ts
  /** Mark or unmark a deck as favorite. */
  async setFavorite(id: number, favorite: boolean): Promise<Deck> {
    const body: SetDeckFavoriteRequest = { favorite };
    const res = await api.patch(`/decks/${id}/favorite`, body);
    return res.data;
  },
```

`features/deck/deckPicker.ts` :

```ts
import { CardType, checkDeckForMatch } from "@pipou/shared";
import type { CardInDeck, Deck } from "../../services/deck.service";
import type { Card } from "../../services/card.service";

export const deckTotal = (d: Deck) =>
  d.deckCards.reduce((sum, dc) => sum + dc.quantity, 0);

/** Le back accepterait ce deck au lancement d'un combat. */
export function isPlayable(d: Deck): boolean {
  return (
    checkDeckForMatch(
      d.deckCards.map((dc) => ({
        cardId: dc.userCard.card.id,
        cardName: dc.userCard.card.name,
        quantity: dc.quantity,
        owned: dc.userCard.quantity,
      })),
    ) === null
  );
}

/** Favoris d'abord, puis par nom. */
export function sortDecks(decks: readonly Deck[]): Deck[] {
  return [...decks].sort(
    (a, b) =>
      Number(b.isFavorite) - Number(a.isFavorite) ||
      a.name.localeCompare(b.name),
  );
}

const usedAt = (d: Deck) => (d.lastUsedAt ? Date.parse(d.lastUsedAt) : 0);

export function lastUsedDeckId(decks: readonly Deck[]): number | null {
  let best: Deck | null = null;
  for (const d of decks) if (usedAt(d) > (best ? usedAt(best) : 0)) best = d;
  return best?.id ?? null;
}

/** Le dernier deck utilisé, sinon le premier favori, sinon le premier par nom. */
export function defaultDeck(playable: readonly Deck[]): Deck | null {
  const lastId = lastUsedDeckId(playable);
  return (
    playable.find((d) => d.id === lastId) ?? sortDecks(playable)[0] ?? null
  );
}

/** Carte de couverture : le monstre le plus cher, puis la plus forte ATK. */
export function coverCard(d: Deck): CardInDeck | null {
  const monsters = d.deckCards
    .map((dc) => dc.userCard.card)
    .filter((c) => c.type === CardType.MONSTER)
    .sort((a, b) => b.cost - a.cost || b.atk - a.atk);
  return monsters[0] ?? null;
}

/** Carte affichable par CardFace (sans effets ni set). */
export function cardFromDeck(c: CardInDeck): Card {
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    type: c.type,
    supportType: c.supportType ?? null,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    description: c.description ?? undefined,
    image: c.image ?? null,
    cardSet: { id: 0, name: "" },
  };
}
```

`features/deck/useToggleFavorite.ts` :

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deckService, type Deck } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";

/** Bascule le favori d'un deck : affichage immédiat, resynchro ensuite. */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (deck: Deck) => deckService.setFavorite(deck.id, !deck.isFavorite),
    onMutate: (deck) => {
      queryClient.setQueryData<Deck[]>(QUERY_KEYS.decks, (decks) =>
        decks?.map((d) =>
          d.id === deck.id ? { ...d, isFavorite: !deck.isFavorite } : d,
        ),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.decks }),
  });
  return (deck: Deck) => mutation.mutate(deck);
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend test -- deckPicker` puis `pnpm --filter @pipou/frontend typecheck`
Expected: PASS ; typecheck propre (les fixtures `Deck` d'autres tests peuvent demander `isFavorite`/`lastUsedAt` : les ajouter).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(decks): helpers de sélection et favori côté front"
```

---

### Task 4: `DeckWidget` — deck par défaut + « Changer »

**Files:**
- Modify: `apps/frontend/src/features/deck/DeckWidget.tsx` (réécrit)
- Modify: `apps/frontend/src/features/deck/DeckWidget.css` (réécrit)
- Create: `apps/frontend/src/features/deck/DeckWidget.test.tsx`
- Modify: `apps/frontend/src/i18n/locales/{fr,en,ko}.json`

**Interfaces:**
- Consumes: Task 3 (`isPlayable`, `sortDecks`, `defaultDeck`, `lastUsedDeckId`, `coverCard`, `cardFromDeck`, `deckTotal`, `useToggleFavorite`).
- Produces: `<DeckWidget selectedDeckId?: number onSelectDeck?: (deckId: number) => void />` — même API qu'avant, donc `FightTabBar.tsx` et `OpponentSheet.tsx` ne changent pas. Nouveau comportement : charge les decks au montage ; si `selectedDeckId` est absent ou injouable, appelle `onSelectDeck(defaultDeck.id)`.

- [ ] **Step 1: Clés i18n**

`fr.json`, nouvel objet racine à côté de `"deck"` :

```json
"deckPicker": {
  "title": "Ton deck",
  "change": "Changer",
  "close": "Fermer",
  "lastUsed": "dernier utilisé",
  "cards_one": "{{count}} carte",
  "cards_other": "{{count}} cartes",
  "hidden_one": "{{count}} deck incomplet masqué",
  "hidden_other": "{{count}} decks incomplets masqués",
  "none": "Aucun deck jouable",
  "complete": "Compléter un deck",
  "favorite": "Ajouter {{name}} aux favoris",
  "unfavorite": "Retirer {{name}} des favoris",
  "loading": "Chargement…"
}
```

`en.json` :

```json
"deckPicker": {
  "title": "Your deck",
  "change": "Change",
  "close": "Close",
  "lastUsed": "last used",
  "cards_one": "{{count}} card",
  "cards_other": "{{count}} cards",
  "hidden_one": "{{count}} incomplete deck hidden",
  "hidden_other": "{{count}} incomplete decks hidden",
  "none": "No playable deck",
  "complete": "Complete a deck",
  "favorite": "Add {{name}} to favorites",
  "unfavorite": "Remove {{name}} from favorites",
  "loading": "Loading…"
}
```

`ko.json` :

```json
"deckPicker": {
  "title": "내 덱",
  "change": "변경",
  "close": "닫기",
  "lastUsed": "최근 사용",
  "cards_other": "카드 {{count}}장",
  "hidden_other": "미완성 덱 {{count}}개 숨김",
  "none": "사용 가능한 덱이 없습니다",
  "complete": "덱 완성하기",
  "favorite": "{{name}} 즐겨찾기 추가",
  "unfavorite": "{{name}} 즐겨찾기 해제",
  "loading": "불러오는 중…"
}
```

- [ ] **Step 2: Test qui échoue**

`DeckWidget.test.tsx` (le service est mocké ; les fixtures reprennent le constructeur de `deckPicker.test.ts`) :

```tsx
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CardType } from "@pipou/shared";
import i18n from "../../i18n";
import type { Deck } from "../../services/deck.service";
import { deckService } from "../../services/deck.service";
import DeckWidget from "./DeckWidget";

vi.mock("../../services/deck.service", () => ({
  deckService: { getMyDecks: vi.fn(), setFavorite: vi.fn() },
}));

let nextId = 1;
function deck(over: Partial<Deck> = {}, total = 30): Deck {
  const deckCards: Deck["deckCards"] = [];
  for (let left = total; left > 0; left -= 3) {
    const id = nextId++;
    deckCards.push({
      quantity: Math.min(3, left),
      userCard: {
        id,
        quantity: 3,
        card: { id, name: `C${id}`, rarity: "common", type: CardType.MONSTER, atk: 100, hp: 100, cost: 1 } as Deck["deckCards"][number]["userCard"]["card"],
      },
    });
  }
  return { id: nextId++, name: "Deck", userId: 1, deckCards, createdAt: "", updatedAt: "", isFavorite: false, lastUsedAt: null, ...over };
}

function renderWidget(decks: Deck[], selectedDeckId?: number) {
  vi.mocked(deckService.getMyDecks).mockResolvedValue(decks);
  const onSelectDeck = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DeckWidget selectedDeckId={selectedDeckId} onSelectDeck={onSelectDeck} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onSelectDeck };
}

beforeAll(() => i18n.changeLanguage("fr"));
beforeEach(() => vi.clearAllMocks());

describe("DeckWidget", () => {
  it("présélectionne le dernier deck utilisé", async () => {
    const fav = deck({ name: "Favori", isFavorite: true });
    const last = deck({ name: "Gang", lastUsedAt: "2026-11-03T10:00:00Z" });
    const { onSelectDeck } = renderWidget([fav, last]);
    await waitFor(() => expect(onSelectDeck).toHaveBeenCalledWith(last.id));
  });

  it("affiche le deck choisi en grand, avec « dernier utilisé »", async () => {
    const last = deck({ name: "Gang", lastUsedAt: "2026-11-03T10:00:00Z" });
    renderWidget([last], last.id);
    expect(await screen.findByText("Gang")).toBeTruthy();
    expect(screen.getByText(/dernier utilisé/)).toBeTruthy();
  });

  it("masque les decks injouables et les compte", async () => {
    const ok = deck({ name: "Complet" });
    const broken = deck({ name: "Cassé" }, 20);
    renderWidget([ok, broken], ok.id);
    fireEvent.click(await screen.findByRole("button", { name: "Changer" }));
    expect(screen.queryByText("Cassé")).toBeNull();
    expect(screen.getByText("1 deck incomplet masqué")).toBeTruthy();
  });

  it("« Changer » liste favoris d'abord et choisit au tap", async () => {
    const a = deck({ name: "A" });
    const z = deck({ name: "Z", isFavorite: true });
    const { onSelectDeck } = renderWidget([a, z], a.id);
    fireEvent.click(await screen.findByRole("button", { name: "Changer" }));
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Z"),
      expect.stringContaining("A"),
    ]);
    fireEvent.click(options[0]);
    expect(onSelectDeck).toHaveBeenCalledWith(z.id);
  });

  it("aucun deck jouable : lien pour compléter", async () => {
    renderWidget([deck({}, 20)]);
    expect(await screen.findByText("Aucun deck jouable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compléter un deck" })).toBeTruthy();
  });
});
```

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- DeckWidget`
Expected: FAIL (pas de bouton « Changer », pas de présélection).

- [ ] **Step 4: Implémentation**

`DeckWidget.tsx` :

```tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { deckService, type Deck } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import Button from "../../components/Button";
import { IconCards, IconStar } from "../../components/Icons";
import CardFace from "../cards/CardFace";
import {
  cardFromDeck,
  coverCard,
  deckTotal,
  defaultDeck,
  isPlayable,
  lastUsedDeckId,
  sortDecks,
} from "./deckPicker";
import { useToggleFavorite } from "./useToggleFavorite";
import "./DeckWidget.css";

interface DeckWidgetProps {
  onSelectDeck?: (deckId: number) => void;
  selectedDeckId?: number;
}

const NO_DECKS: Deck[] = [];

export default function DeckWidget({
  onSelectDeck,
  selectedDeckId,
}: DeckWidgetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const toggleFavorite = useToggleFavorite();

  const { data: decks = NO_DECKS, isPending } = useQuery({
    queryKey: QUERY_KEYS.decks,
    queryFn: () => deckService.getMyDecks(),
  });
  const playable = decks.filter(isPlayable);
  const hidden = decks.length - playable.length;
  const selected = playable.find((d) => d.id === selectedDeckId) ?? null;
  const fallback = defaultDeck(playable);
  const lastId = lastUsedDeckId(playable);

  // Pas de choix (ou deck devenu injouable) : on prend le deck par défaut
  useEffect(() => {
    if (!selected && fallback && onSelectDeck) onSelectDeck(fallback.id);
  }, [selected, fallback, onSelectDeck]);

  const manage = () => navigate("/decks");

  if (isPending) return <p className="dw-muted">{t("deckPicker.loading")}</p>;

  if (playable.length === 0)
    return (
      <div className="dw-empty">
        <p className="dw-muted">{t("deckPicker.none")}</p>
        <Button size="sm" onClick={manage}>
          {t("deckPicker.complete")}
        </Button>
      </div>
    );

  const shown = selected ?? fallback;
  const cover = shown ? coverCard(shown) : null;

  return (
    <div className="dw">
      {shown && (
        <div className="dw-current">
          <div className="dw-cover">
            {cover ? (
              <CardFace card={cardFromDeck(cover)} size="xs" />
            ) : (
              <IconCards size={28} />
            )}
          </div>
          <div className="dw-current__info">
            <span className="dw-current__name">
              {shown.isFavorite && (
                <IconStar size={14} className="dw-star dw-star--on" />
              )}
              {shown.name}
            </span>
            <span className="dw-muted">
              {t("deckPicker.cards", { count: deckTotal(shown) })}
              {shown.id === lastId && ` · ${t("deckPicker.lastUsed")}`}
            </span>
          </div>
          <Button
            variant="ghost-bordeaux"
            size="sm"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? t("deckPicker.close") : t("deckPicker.change")}
          </Button>
        </div>
      )}

      {open && (
        <div className="dw-panel">
          <ul className="dw-list" role="listbox">
            {sortDecks(playable).map((deck) => (
              <li key={deck.id} className="dw-item">
                <button
                  type="button"
                  className="dw-fav"
                  aria-label={t(
                    deck.isFavorite
                      ? "deckPicker.unfavorite"
                      : "deckPicker.favorite",
                    { name: deck.name },
                  )}
                  aria-pressed={deck.isFavorite}
                  onClick={() => toggleFavorite(deck)}
                >
                  <IconStar
                    size={18}
                    className={`dw-star${deck.isFavorite ? " dw-star--on" : ""}`}
                  />
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={deck.id === shown?.id}
                  className={`dw-pick${deck.id === shown?.id ? " dw-pick--selected" : ""}`}
                  onClick={() => {
                    onSelectDeck?.(deck.id);
                    setOpen(false);
                  }}
                >
                  <span className="dw-item-name">{deck.name}</span>
                  <span className="dw-muted">
                    {t("deckPicker.cards", { count: deckTotal(deck) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button type="button" className="dw-hidden" onClick={manage}>
              {t("deckPicker.hidden", { count: hidden })} ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Note : `onSelectDeck` d'`OpponentSheet` / `FightTabBar` peut être une fonction recréée à chaque rendu ; l'effet ne rappelle `onSelectDeck` que tant que `selected` est null, donc il s'arrête dès que le parent a pris le choix. Si un parent ne met pas à jour `selectedDeckId`, mémoriser le dernier id envoyé dans une `useRef` et ne pas renvoyer le même.

`DeckWidget.css` (remplace l'ancien contenu ; garder les couleurs du thème clair : bordeaux `#7a1c3b`, fond `#fffaf4`) :

```css
.dw { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.dw-muted { font-size: 0.75rem; color: #a08070; margin: 0; }
.dw-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }

.dw-current {
  display: flex; align-items: center; gap: 12px; padding: 10px;
  border: 2px solid #7a1c3b; border-radius: 14px; background: #fffaf4;
}
.dw-cover { flex: none; width: 56px; display: flex; justify-content: center; color: #7a1c3b; }
.dw-current__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dw-current__name {
  display: flex; align-items: center; gap: 4px;
  font-family: "Lilita One", cursive; color: #7a1c3b; font-size: 1rem;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.dw-panel { background: #fffaf4; border: 1.5px solid rgba(61, 16, 32, 0.1); border-radius: 14px; padding: 6px; }
.dw-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 50vh; overflow-y: auto; }
.dw-item { display: flex; align-items: center; gap: 4px; }
.dw-fav {
  flex: none; width: 44px; height: 44px; border: none; background: transparent;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.dw-star { color: #cbbfa6; }
.dw-star--on { color: #d4a017; fill: currentColor; }
.dw-pick {
  flex: 1; min-width: 0; min-height: 44px; display: flex; justify-content: space-between; align-items: center;
  padding: 0 10px; border: 1.5px solid transparent; border-radius: 10px; background: #fff;
  font-family: inherit; color: #3d1020; cursor: pointer; text-align: left;
}
.dw-pick--selected { border-color: #7a1c3b; }
.dw-item-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dw-hidden {
  width: 100%; min-height: 44px; border: none; background: transparent;
  color: #7a1c3b; font-size: 0.75rem; cursor: pointer;
}
```

Si `IconStar` ne transmet pas `className` à son `<svg>`, vérifier `StrokeIcon` dans `Icons.tsx` et passer la couleur par la prop `color` à la place.

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/frontend test -- DeckWidget OpponentSheet FightPage`
Expected: PASS. Les tests `OpponentSheet`/`FightPage` existants peuvent devoir mocker `getMyDecks` ou fournir des decks avec `isFavorite`/`lastUsedAt` : les adapter sans changer leur intention.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(fight): choix du deck par défaut, favoris et decks injouables masqués"
```

---

### Task 5: Étoile favori dans la liste des decks

**Files:**
- Modify: `apps/frontend/src/features/deck/DeckBuilder.tsx:276-310` (vue liste)
- Modify: `apps/frontend/src/features/deck/DeckBuilder.css`

**Interfaces:**
- Consumes: `useToggleFavorite`, `sortDecks` (Task 3), clés `deckPicker.favorite` / `deckPicker.unfavorite` (Task 4).

- [ ] **Step 1: Implémentation**

Dans `DeckBuilder` : `const toggleFavorite = useToggleFavorite();`, importer `IconStar`, `sortDecks`. Remplacer `decks.map((d) => {` de la vue liste par `sortDecks(decks).map((d) => {` et, en premier enfant de `.manager-item__actions` :

```tsx
                    <Button
                      variant="ghost-bordeaux"
                      size="icon"
                      aria-label={t(
                        d.isFavorite
                          ? "deckPicker.unfavorite"
                          : "deckPicker.favorite",
                        { name: d.name },
                      )}
                      aria-pressed={d.isFavorite}
                      onClick={() => toggleFavorite(d)}
                    >
                      <IconStar
                        size={16}
                        className={d.isFavorite ? "deck-star--on" : undefined}
                      />
                    </Button>
```

`DeckBuilder.css` :

```css
.deck-star--on { color: #d4a017; fill: currentColor; }
```

- [ ] **Step 2: Vérifier**

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/deck
git commit -m "feat(decks): étoile favori dans la liste des decks"
```

---

### Task 6: Composant `DeckCardRow`

**Files:**
- Create: `apps/frontend/src/features/deck/DeckCardRow.tsx`
- Create: `apps/frontend/src/features/deck/DeckCardRow.css`
- Create: `apps/frontend/src/features/deck/DeckCardRow.test.tsx`
- Modify: `apps/frontend/src/i18n/locales/{fr,en,ko}.json`

**Interfaces:**
- Produces:

```ts
interface DeckCardRowProps {
  card: Card;            // services/card.service
  inDeck: number;        // exemplaires dans le deck
  copies: number;        // plafond affiché « inDeck / copies » (min(MAX_COPIES, possédés))
  canAdd: boolean;       // false : « ✓ » désactivé (plafond ou deck plein)
  onAdd: () => void;
  onRemove?: () => void; // présent : affiche « − » (onglet Mon deck)
  onOpen: () => void;    // tap sur la ligne : fiche
}
```

- [ ] **Step 1: Clés i18n**

Dans l'objet `"deck"` racine (celui de `"title": "Mes Decks"`) de `fr.json` :

```json
"addOne": "Ajouter un exemplaire de {{name}}",
"removeOne": "Retirer un exemplaire de {{name}}",
"full": "{{name}} : maximum atteint",
"tabDeck": "Mon deck · {{count}}",
"tabCollection": "Collection"
```

`en.json` : `"addOne": "Add a copy of {{name}}"`, `"removeOne": "Remove a copy of {{name}}"`, `"full": "{{name}}: maximum reached"`, `"tabDeck": "My deck · {{count}}"`, `"tabCollection": "Collection"`.

`ko.json` : `"addOne": "{{name}} 1장 추가"`, `"removeOne": "{{name}} 1장 제거"`, `"full": "{{name}}: 최대 수량"`, `"tabDeck": "내 덱 · {{count}}"`, `"tabCollection": "컬렉션"`.

- [ ] **Step 2: Test qui échoue**

`DeckCardRow.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CardType } from "@pipou/shared";
import i18n from "../../i18n";
import type { Card } from "../../services/card.service";
import DeckCardRow from "./DeckCardRow";

const card = {
  id: 1,
  name: "Saint Sword",
  rarity: "common",
  type: CardType.MONSTER,
  supportType: null,
  atk: 800,
  hp: 1200,
  cost: 2,
  image: null,
  cardSet: { id: 1, name: "Set 1" },
} as Card;

beforeAll(() => i18n.changeLanguage("fr"));

describe("DeckCardRow", () => {
  it("affiche nom, quantité et ajoute au tap sur +", () => {
    const onAdd = vi.fn();
    const onOpen = vi.fn();
    render(
      <DeckCardRow card={card} inDeck={1} copies={3} canAdd onAdd={onAdd} onOpen={onOpen} />,
    );
    expect(screen.getByText("Saint Sword")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter un exemplaire de Saint Sword" }));
    expect(onAdd).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("désactive l'ajout au maximum", () => {
    render(
      <DeckCardRow card={card} inDeck={3} copies={3} canAdd={false} onAdd={vi.fn()} onOpen={vi.fn()} />,
    );
    const full = screen.getByRole("button", { name: "Saint Sword : maximum atteint" });
    expect((full as HTMLButtonElement).disabled).toBe(true);
  });

  it("retire avec − quand onRemove est fourni, et ouvre la fiche au tap", () => {
    const onRemove = vi.fn();
    const onOpen = vi.fn();
    render(
      <DeckCardRow card={card} inDeck={2} copies={3} canAdd onAdd={vi.fn()} onRemove={onRemove} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retirer un exemplaire de Saint Sword" }));
    expect(onRemove).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Saint Sword"));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- DeckCardRow`
Expected: FAIL, `Failed to resolve import "./DeckCardRow"`.

- [ ] **Step 4: Implémentation**

`DeckCardRow.tsx` :

```tsx
import { useTranslation } from "react-i18next";
import type { Card } from "../../services/card.service";
import CardFace from "../cards/CardFace";
import CardEffectsText from "../glossary/CardEffectsText";
import { cardKind, shortSetName } from "../glossary/cardCatalog";
import { IconCheck, IconMinus, IconPlus } from "../../components/Icons";
import "../glossary/CardGlossary.css";
import "./DeckCardRow.css";

interface DeckCardRowProps {
  card: Card;
  inDeck: number;
  copies: number;
  canAdd: boolean;
  onAdd: () => void;
  onRemove?: () => void;
  onOpen: () => void;
}

/** Ligne de la galerie, avec les quantités du deck à droite. */
export default function DeckCardRow({
  card,
  inDeck,
  copies,
  canAdd,
  onAdd,
  onRemove,
  onOpen,
}: DeckCardRowProps) {
  const { t } = useTranslation();
  return (
    <div className={`dcr${inDeck > 0 ? " dcr--in" : ""}`}>
      <button
        type="button"
        className="cg__row dcr__main"
        aria-label={t("glossary.view", { name: card.name })}
        onClick={onOpen}
      >
        <div className="cg__thumb">
          <CardFace card={card} size="xs" />
        </div>
        <div className="cg__body">
          <div className="cg__name">{card.name}</div>
          <div className="cg__meta">
            {t(`glossary.kind.${cardKind(card)}`)} ·{" "}
            {shortSetName(card.cardSet.name)}
          </div>
          <CardEffectsText card={card} />
        </div>
      </button>
      <div className="dcr__qty">
        {onRemove && (
          <button
            type="button"
            className="dcr__btn"
            aria-label={t("deck.removeOne", { name: card.name })}
            onClick={onRemove}
          >
            <IconMinus size={16} />
          </button>
        )}
        <span className="dcr__count">
          {onRemove ? inDeck : `${inDeck}/${copies}`}
        </span>
        <button
          type="button"
          className="dcr__btn dcr__btn--add"
          aria-label={
            canAdd
              ? t("deck.addOne", { name: card.name })
              : t("deck.full", { name: card.name })
          }
          disabled={!canAdd}
          onClick={onAdd}
        >
          {canAdd ? <IconPlus size={16} /> : <IconCheck size={16} />}
        </button>
      </div>
    </div>
  );
}
```

Le test « 1/3 » vise la variante Collection (sans `onRemove`) ; la variante Mon deck affiche seulement la quantité entre − et +.

`DeckCardRow.css` :

```css
.dcr { display: flex; align-items: center; gap: 6px; }
.dcr__main { flex: 1; min-width: 0; }
.dcr--in .dcr__main { border-color: rgba(122, 28, 59, 0.45); }
.dcr__qty { flex: none; display: flex; align-items: center; gap: 4px; }
.dcr__count { min-width: 28px; text-align: center; font-weight: 700; color: #7a1c3b; font-size: 0.8rem; }
.dcr__btn {
  width: 36px; height: 44px; border-radius: 10px;
  border: 1.5px solid rgba(61, 16, 32, 0.15); background: #fffaf4; color: #7a1c3b;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.dcr__btn--add { background: #7a1c3b; border-color: #7a1c3b; color: #fff; }
.dcr__btn:disabled { background: #e8dcc6; border-color: #e8dcc6; color: #fff; cursor: default; }
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/frontend test -- DeckCardRow`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(deck): ligne de carte façon galerie avec quantités"
```

---

### Task 7: Éditeur en onglets Mon deck / Collection

**Files:**
- Modify: `apps/frontend/src/features/deck/DeckBuilder.tsx:95-130` (état, nav) et `:346-418` (bandeau + grille)
- Modify: `apps/frontend/src/features/deck/DeckBuilder.css`

**Interfaces:**
- Consumes: `DeckCardRow` (Task 6), clés `deck.tabDeck` / `deck.tabCollection` (Task 6).

- [ ] **Step 1: État de l'onglet**

Dans `DeckBuilder`, après `const [sheet, setSheet] = ...` :

```tsx
  const [tab, setTab] = useState<"deck" | "collection">("collection");
```

Dans `openCreate`, ajouter `setTab("collection");`. Dans `openEdit`, ajouter `setTab(deck.deckCards.length > 0 ? "deck" : "collection");`.

- [ ] **Step 2: Remplacer bandeau + grille**

Remplacer tout le bloc de `{/* Bandeau du deck */}` jusqu'à la fermeture de `<div className="deck-tab-content">` (avant `{/* Barre sticky bottom */}`) par :

```tsx
      {/* Onglets */}
      <div className="deck-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "deck"}
          className={`deck-tabs__tab${tab === "deck" ? " deck-tabs__tab--on" : ""}`}
          onClick={() => setTab("deck")}
        >
          {t("deck.tabDeck", { count: totalCards })}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "collection"}
          className={`deck-tabs__tab${tab === "collection" ? " deck-tabs__tab--on" : ""}`}
          onClick={() => setTab("collection")}
        >
          {t("deck.tabCollection")}
        </button>
      </div>

      <div className="deck-tab-content" role="tabpanel">
        {tab === "deck" ? (
          deckCards.length === 0 ? (
            <p className="deck-strip__empty">{t("deck.stripEmpty")}</p>
          ) : (
            <ul className="cg__list">
              {deckCards.map(({ userCardId, quantity, info }) => (
                <li key={userCardId}>
                  <DeckCardRow
                    card={fullCard(info)}
                    inDeck={quantity}
                    copies={maxCopies(info)}
                    canAdd={maxQtyOf(info) > quantity}
                    onAdd={() => setQuantity(userCardId, quantity + 1)}
                    onRemove={() => setQuantity(userCardId, quantity - 1)}
                    onOpen={() => openSheet({ userCardId, from: "deck" })}
                  />
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <CardFilterBar
              filters={filters}
              cards={ownedCards}
              onChange={setFilters}
            />
            {visible.length === 0 && (
              <div className="cg__state">
                {owned.length === 0
                  ? t("deck.collectionEmpty")
                  : t("glossary.empty")}
              </div>
            )}
            <ul className="cg__list">
              {visible.map((c) => {
                const inDeck = qtyOf(c.userCardId);
                return (
                  <li key={c.userCardId}>
                    <DeckCardRow
                      card={fullCard(c)}
                      inDeck={inDeck}
                      copies={maxCopies(c)}
                      canAdd={maxQtyOf(c) > inDeck}
                      onAdd={() => {
                        soundService.play("select");
                        setQuantity(c.userCardId, inDeck + 1);
                      }}
                      onOpen={() =>
                        openSheet({ userCardId: c.userCardId, from: "grid" })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
```

Ajouter `import DeckCardRow from "./DeckCardRow";`. Retirer l'import `CardFace` s'il n'est plus utilisé (le typecheck/lint le signale).

- [ ] **Step 3: CSS**

Dans `DeckBuilder.css`, supprimer les règles `.deck-strip*` (sauf `.deck-strip__empty`) et `.deck-grid*`, puis ajouter :

```css
.deck-tabs { display: flex; gap: 6px; margin: 0 0 10px; }
.deck-tabs__tab {
  flex: 1; min-height: 44px; border-radius: 12px;
  border: 1.5px solid #7a1c3b; background: transparent; color: #7a1c3b;
  font-family: inherit; font-weight: 700; cursor: pointer;
}
.deck-tabs__tab--on { background: #7a1c3b; color: #fff; }
```

Vérifier avec `grep -n "deck-strip\|deck-grid" apps/frontend/src` qu'aucune autre référence ne reste (sauf `deck-strip__empty`).

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/deck
git commit -m "feat(deck): éditeur en onglets Mon deck / Collection"
```

---

### Task 8: Vérification d'ensemble et capture

**Files:** aucun nouveau.

- [ ] **Step 1: Suite complète**

Run: `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test`
Expected: tout PASS.

- [ ] **Step 2: Test en local (sans Aiven)**

Suivre les mémoires « Local test env » et « Front visual check » : backend sur `cardcollect_dev` (`ENV_FILE=.env.dev.local`), front en dev, compte admin local.
Parcours :
1. `/decks` : étoile sur un deck, il remonte en tête ; recharger, l'étoile reste.
2. Éditer un deck : onglet Mon deck par défaut, − et + ; onglet Collection : recherche, filtres, `+` jusqu'au `✓`. Sauvegarder.
3. Combat (onglet fight) : le deck par défaut s'affiche ; « Changer » liste favoris d'abord ; un deck de moins de 30 cartes ou à carte vendue n'apparaît pas et est compté en bas.
4. Lancer un combat d'aventure avec un deck B ; revenir : B est présélectionné.

- [ ] **Step 3: Captures Playwright à 430px**

Capturer : éditeur onglet Mon deck, éditeur onglet Collection, sélecteur en combat (fermé et ouvert). Les relire, corriger tout débordement horizontal ou cible < 44px, puis commit des corrections éventuelles :

```bash
git add apps/frontend/src
git commit -m "fix(deck): ajustements visuels après capture"
```
