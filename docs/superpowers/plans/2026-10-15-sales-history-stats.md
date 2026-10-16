# Historique des ventes : graphique, stats et filtres — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la liste « Historique des ventes » des onglets Vendre/Acheter par un bloc avec 10 stats, un graphique de l'or échangé sur 30 jours, un filtre par joueur et un panneau « Détails » dépliable.

**Architecture:** Un nouvel endpoint `GET /transactions/stats` calcule les agrégats en SQL (`TransactionStatsService`) ; les calculs purs (série de 30 jours, meilleur jour, tendance) vivent dans un module testable sans BDD. `GET /transactions/recent-sales` accepte le même filtre (`userId`, `role`) et sert la liste. Côté front, un composant `SalesHistory` orchestre quatre composants de présentation (`SalesFilterBar`, `StatTiles`, `GoldChart`, `SalesList`) via TanStack Query.

**Tech Stack:** NestJS 11 + TypeORM 0.3 (MySQL), Jest ; React 18 + TanStack Query 5 + framer-motion 12, Vitest + Testing Library ; `@pipou/shared`.

**Spec:** `docs/superpowers/specs/2026-10-15-sales-history-stats-design.md`

## Global Constraints

- Tout type échangé front/back vit dans `@pipou/shared` ; jamais redéfini dans une app. `@pipou/shared` n'a aucune dépendance runtime.
- Après modification de `packages/shared` : `pnpm build:shared`.
- Front : TanStack Query uniquement pour les données serveur ; clés dans `utils/querykeys.ts` ; pas de composant déclaré dans un composant ; pas de `any` ; erreurs via `apiErrorMessage(error)`.
- Ne jamais toucher Aiven : le `.env` local pointe sur la prod. Vérifications SQL uniquement via `pnpm dev:local` (MySQL Docker).
- Prix moyen **par unité, pondéré** : `totalGold / unitsTraded`, arrondi à l'entier.
- Graphique : exactement 30 jours (J-29 → aujourd'hui), dates UTC `YYYY-MM-DD`.
- Couleurs : bordeaux `#7a1c3b`, crème `#f5e6d0`, or `#e0b44c`.
- Libellés en fr, en, ko.
- Commits : messages conventionnels terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Écarts assumés par rapport à la spec

1. **`/transactions/history` reste inchangé.** La liste utilise `recent-sales` avec le filtre (« Moi » = `userId` de l'utilisateur connecté) : un seul endpoint pour la liste, un seul pour les stats. `HistoryQuery` ne change pas ; `RecentSalesQuery` étend `SalesFilter`. `transactionService.getHistory` et `getRecentSales` côté front sont remplacés par `getSales`.
2. **Série journalière bucketée en JS (UTC)** plutôt que `GROUP BY DATE(updated_at)` : aucun fuseau n'est configuré sur la connexion MySQL, `DATE()` dépendrait du fuseau serveur. On lit `(updated_at, total_price)` des 30 derniers jours (faible volume) et on regroupe par `toISOString().slice(0, 10)`.
3. **Barres du graphique en HTML/CSS** (boutons) plutôt qu'en SVG : chaque barre est un vrai bouton accessible au toucher et au clavier.
4. **Liste « Détails » non paginée côté serveur** : on charge les 100 dernières ventes du filtre (comme aujourd'hui avec 20) et on pagine par 6 côté client. Clé `salesList(filter, sort)` sans numéro de page.
5. **Deux traductions du filtre côté backend** dans le même fichier : `salesFilterWhere` (options `find`) et `applySalesFilter` (QueryBuilder), testées ensemble.

## Structure des fichiers

| Fichier | Statut | Responsabilité |
|---|---|---|
| `packages/shared/src/api/pagination.ts` | modif | `SaleRole`, `SalesFilter`, `RecentSalesQuery extends SalesFilter` |
| `packages/shared/src/api/sales-stats.ts` | créé | `SalesStats` |
| `packages/shared/src/api/index.ts` | modif | export de `sales-stats` |
| `apps/backend/src/transactions/stats/sales-stats.calc.ts` | créé | calculs purs (série 30 j, meilleur jour, tendance, conversions) |
| `apps/backend/src/transactions/stats/sales-filter.ts` | créé | filtre `COMPLETED` + joueur/rôle (find et QueryBuilder) |
| `apps/backend/src/transactions/stats/transaction-stats.service.ts` | créé | requêtes d'agrégat → `SalesStats` |
| `apps/backend/src/transactions/dto/sales-stats-query.dto.ts` | créé | validation `userId`, `role` |
| `apps/backend/src/transactions/dto/recent-sales-query.dto.ts` | modif | + `userId`, `role` |
| `apps/backend/src/transactions/transactions.service.ts` | modif | `getRecentSales`/`getUserHistory` utilisent `salesFilterWhere` |
| `apps/backend/src/transactions/transactions.controller.ts` | modif | route `GET stats`, filtre sur `recent-sales` |
| `apps/backend/src/transactions/transactions.module.ts` | modif | provider `TransactionStatsService` |
| `apps/frontend/src/services/transaction.service.ts` | modif | `getSales`, `getSalesStats` |
| `apps/frontend/src/utils/querykeys.ts` | modif | `salesAll`, `salesStats`, `salesList` |
| `apps/frontend/src/features/marketplace/sales-history/salesScope.ts` | créé | type `SalesScope`, `scopeToFilter`, `formatGold` |
| `.../sales-history/CountUp.tsx` | créé | compteur animé |
| `.../sales-history/StatTiles.tsx` + `.css` | créé | grille de tuiles |
| `.../sales-history/GoldChart.tsx` + `.css` | créé | barres 30 jours |
| `.../sales-history/SalesFilterBar.tsx` + `.css` | créé | puces de filtre |
| `.../sales-history/SalesList.tsx` + `.css` | créé | tri, liste paginée, mise en avant |
| `.../sales-history/salesTiles.ts` | créé | `SalesStats` → tuiles compactes / détaillées |
| `.../sales-history/SalesHistory.tsx` + `.css` | créé | orchestration |
| `apps/frontend/src/features/marketplace/TransactionHistory.tsx` / `.css` | supprimé | remplacé par `SalesList` |
| `apps/frontend/src/features/marketplace/SellTab.tsx`, `BuyTab.tsx`, `pages/Marketplace.tsx`, `App.tsx` | modif | branchement, invalidations |
| `apps/frontend/src/i18n/locales/{fr,en,ko}.json` | modif | clés `marketplace.sales.*` |

---

### Task 1: Contrat partagé

**Files:**
- Modify: `packages/shared/src/api/pagination.ts`
- Create: `packages/shared/src/api/sales-stats.ts`
- Modify: `packages/shared/src/api/index.ts`

**Interfaces:**
- Produces: `SaleRole`, `SalesFilter`, `RecentSalesQuery` (avec `userId?`, `role?`), `SalesStats` — exportés depuis `@pipou/shared`.

- [ ] **Step 1: Étendre `pagination.ts`**

Remplacer le bloc `RecentSalesQuery` final par :

```ts
/** Point de vue d'un joueur sur une vente. */
export type SaleRole = "seller" | "buyer" | "both";

/** Filtre commun aux listes et aux stats de ventes. */
export interface SalesFilter {
  /** Absent = tout le marché. */
  userId?: number;
  /** Ignoré sans userId. Défaut "both". */
  role?: SaleRole;
}

/** GET /transactions/recent-sales */
export interface RecentSalesQuery extends PaginationQuery, SalesFilter {
  sort?: SaleSort;
}
```

`HistoryQuery` reste tel quel.

- [ ] **Step 2: Créer `sales-stats.ts`**

```ts
/** GET /transactions/stats — stats des ventes conclues pour un SalesFilter. */
export interface SalesStats {
  /** Transactions COMPLETED. */
  count: number;
  /** Somme des prix totaux. */
  totalGold: number;
  /** Somme des quantités. */
  unitsTraded: number;
  /** totalGold / unitsTraded, arrondi ; null sans vente. */
  avgUnitPrice: number | null;
  minUnitPrice: number | null;
  maxUnitPrice: number | null;
  biggestSale: {
    id: number;
    itemName: string;
    totalPrice: number;
    quantity: number;
    /** ISO 8601. */
    date: string;
  } | null;
  topItem: { itemName: string; units: number } | null;
  /** Joueur avec qui le joueur filtré a le plus échangé. null sans userId. */
  topPartner: { userId: number; username: string; count: number } | null;
  /** Jour le plus riche des 30 derniers jours. null si aucun or échangé. */
  bestDay: { date: string; gold: number } | null;
  /** Or des 7 derniers jours vs les 7 précédents. percent null si previous7 = 0. */
  trend: { last7: number; previous7: number; percent: number | null };
  /** Exactement 30 entrées, de J-29 à aujourd'hui (UTC), jours vides à 0. date = "YYYY-MM-DD". */
  daily: { date: string; gold: number }[];
}
```

- [ ] **Step 3: Exporter**

Dans `packages/shared/src/api/index.ts`, ajouter :

```ts
export * from "./sales-stats";
```

- [ ] **Step 4: Construire et vérifier**

Run: `pnpm build:shared && pnpm typecheck`
Expected: succès (le contrat ne fait qu'ajouter des champs optionnels).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/api
git commit -m "feat(shared): sales filter and sales stats contract"
```

---

### Task 2: Calculs purs des stats (backend)

**Files:**
- Create: `apps/backend/src/transactions/stats/sales-stats.calc.ts`
- Test: `apps/backend/src/transactions/stats/sales-stats.calc.spec.ts`

**Interfaces:**
- Consumes: `SalesStats` (Task 1).
- Produces:
  - `CHART_DAYS = 30`
  - `chartStart(now: Date): Date` — minuit UTC de J-29
  - `bucketDaily(sales: { date: Date; gold: number }[], now: Date): SalesStats['daily']`
  - `bestDay(daily: SalesStats['daily']): SalesStats['bestDay']`
  - `trend(daily: SalesStats['daily']): SalesStats['trend']`
  - `toNumber(value: string | number | null | undefined): number`
  - `toNullableNumber(value: string | number | null | undefined): number | null`
  - `avgUnitPrice(totalGold: number, units: number): number | null`

- [ ] **Step 1: Écrire les tests**

```ts
import {
  CHART_DAYS,
  avgUnitPrice,
  bestDay,
  bucketDaily,
  chartStart,
  toNullableNumber,
  toNumber,
  trend,
} from './sales-stats.calc';

const NOW = new Date('2026-10-15T12:00:00.000Z');

/** Série de 30 jours dont les `golds` remplissent la fin (dernier = aujourd'hui). */
const dailyEndingWith = (golds: number[]) =>
  bucketDaily([], NOW).map((d, i) => ({
    ...d,
    gold: golds[i - (CHART_DAYS - golds.length)] ?? 0,
  }));

describe('sales-stats.calc', () => {
  describe('chartStart', () => {
    it('starts at UTC midnight 29 days ago', () => {
      expect(chartStart(NOW).toISOString()).toBe('2026-09-16T00:00:00.000Z');
    });
  });

  describe('bucketDaily', () => {
    it('returns 30 days from D-29 to today, filled with zeros', () => {
      const daily = bucketDaily([], NOW);
      expect(daily).toHaveLength(30);
      expect(daily[0]).toEqual({ date: '2026-09-16', gold: 0 });
      expect(daily[29]).toEqual({ date: '2026-10-15', gold: 0 });
    });

    it('sums sales of the same UTC day and ignores sales outside the window', () => {
      const daily = bucketDaily(
        [
          { date: new Date('2026-10-15T01:00:00.000Z'), gold: 100 },
          { date: new Date('2026-10-15T23:59:00.000Z'), gold: 50 },
          { date: new Date('2026-10-01T10:00:00.000Z'), gold: 30 },
          { date: new Date('2026-09-15T23:59:00.000Z'), gold: 999 },
        ],
        NOW,
      );
      expect(daily[29].gold).toBe(150);
      expect(daily.find((d) => d.date === '2026-10-01')?.gold).toBe(30);
      expect(daily.reduce((s, d) => s + d.gold, 0)).toBe(180);
    });
  });

  describe('bestDay', () => {
    it('returns the richest day', () => {
      const daily = dailyEndingWith([10, 80, 20]);
      expect(bestDay(daily)).toEqual({ date: '2026-10-14', gold: 80 });
    });

    it('returns null when nothing was traded', () => {
      expect(bestDay(bucketDaily([], NOW))).toBeNull();
    });
  });

  describe('trend', () => {
    it('compares the last 7 days with the 7 before', () => {
      const daily = dailyEndingWith([...Array(7).fill(10), ...Array(7).fill(20)]);
      expect(trend(daily)).toEqual({ last7: 140, previous7: 70, percent: 100 });
    });

    it('has no percent when the previous week is empty', () => {
      const daily = dailyEndingWith([5]);
      expect(trend(daily)).toEqual({ last7: 5, previous7: 0, percent: null });
    });

    it('rounds negative changes', () => {
      const daily = dailyEndingWith([...Array(7).fill(3), ...Array(7).fill(1)]);
      expect(trend(daily).percent).toBe(-67);
    });
  });

  describe('conversions', () => {
    it('reads MySQL BIGINT sums returned as strings', () => {
      expect(toNumber('1250')).toBe(1250);
      expect(toNumber(null)).toBe(0);
      expect(toNullableNumber(null)).toBeNull();
      expect(toNullableNumber('15')).toBe(15);
    });

    it('weights the average price by units', () => {
      // ×5 pour 750 G + ×1 pour 30 G → 780 / 6 = 130
      expect(avgUnitPrice(780, 6)).toBe(130);
      expect(avgUnitPrice(100, 3)).toBe(33);
      expect(avgUnitPrice(0, 0)).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `pnpm --filter @pipou/backend test -- sales-stats.calc`
Expected: FAIL — `Cannot find module './sales-stats.calc'`.

- [ ] **Step 3: Implémenter**

```ts
import type { SalesStats } from '@pipou/shared';

export const CHART_DAYS = 30;

type Daily = SalesStats['daily'];

const DAY_MS = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Minuit UTC du premier jour du graphique (J-29). */
export function chartStart(now: Date): Date {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(today - (CHART_DAYS - 1) * DAY_MS);
}

/** Or échangé par jour UTC, de J-29 à aujourd'hui, jours vides à 0. */
export function bucketDaily(
  sales: { date: Date; gold: number }[],
  now: Date,
): Daily {
  const start = chartStart(now).getTime();
  const days = Array.from({ length: CHART_DAYS }, (_, i) => ({
    date: isoDay(new Date(start + i * DAY_MS)),
    gold: 0,
  }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const sale of sales) {
    const day = byDate.get(isoDay(sale.date));
    if (day) day.gold += sale.gold;
  }
  return days;
}

export function bestDay(daily: Daily): SalesStats['bestDay'] {
  const best = daily.reduce<Daily[number] | null>(
    (top, d) => (d.gold > (top?.gold ?? 0) ? d : top),
    null,
  );
  return best ? { ...best } : null;
}

export function trend(daily: Daily): SalesStats['trend'] {
  const sum = (days: Daily) => days.reduce((s, d) => s + d.gold, 0);
  const last7 = sum(daily.slice(-7));
  const previous7 = sum(daily.slice(-14, -7));
  const percent =
    previous7 === 0
      ? null
      : Math.round(((last7 - previous7) / previous7) * 100);
  return { last7, previous7, percent };
}

/** MySQL renvoie les SUM/MIN/MAX de BIGINT en chaîne, et null sur un ensemble vide. */
export function toNumber(value: string | number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export function toNullableNumber(
  value: string | number | null | undefined,
): number | null {
  return value == null ? null : Number(value);
}

/** Prix moyen par unité, pondéré par les quantités. */
export function avgUnitPrice(totalGold: number, units: number): number | null {
  return units > 0 ? Math.round(totalGold / units) : null;
}
```

- [ ] **Step 4: Vérifier qu'ils passent**

Run: `pnpm --filter @pipou/backend test -- sales-stats.calc`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/transactions/stats
git commit -m "feat(transactions): pure helpers for the 30-day sales series and trend"
```

---

### Task 3: Filtre de ventes partagé + `recent-sales` filtrable

**Files:**
- Create: `apps/backend/src/transactions/stats/sales-filter.ts`
- Test: `apps/backend/src/transactions/stats/sales-filter.spec.ts`
- Modify: `apps/backend/src/transactions/dto/recent-sales-query.dto.ts`
- Create: `apps/backend/src/transactions/dto/sales-filter.dto.spec.ts`
- Modify: `apps/backend/src/transactions/transactions.service.ts` (`getUserHistory` l.97-128, `getRecentSales` l.130-143)
- Modify: `apps/backend/src/transactions/transactions.service.spec.ts` (`describe('getRecentSales')`)
- Modify: `apps/backend/src/transactions/transactions.controller.ts` (`getRecentSales`)

**Interfaces:**
- Consumes: `SalesFilter`, `SaleRole` (Task 1).
- Produces:
  - `salesFilterWhere(filter: SalesFilter): FindOptionsWhere<Transaction>[]`
  - `applySalesFilter(qb: SelectQueryBuilder<Transaction>, filter: SalesFilter): SelectQueryBuilder<Transaction>` — l'alias de la table doit être `t`.
  - `TransactionService.getRecentSales(pagination: PaginationDto, sort?: SaleSort, filter?: SalesFilter)`

- [ ] **Step 1: Tests du filtre**

`sales-filter.spec.ts` :

```ts
import { TransactionStatus } from '@pipou/shared';
import type { SelectQueryBuilder } from 'typeorm';
import type { Transaction } from '../transaction.entity';
import { applySalesFilter, salesFilterWhere } from './sales-filter';

const status = TransactionStatus.COMPLETED;

/** QueryBuilder factice qui enregistre les conditions. */
function recordingQb() {
  const calls: [string, string, object?][] = [];
  const qb = {
    where(sql: string, params?: object) {
      calls.push(['where', sql, params]);
      return qb;
    },
    andWhere(sql: string, params?: object) {
      calls.push(['andWhere', sql, params]);
      return qb;
    },
  };
  return { qb: qb as unknown as SelectQueryBuilder<Transaction>, calls };
}

describe('salesFilterWhere', () => {
  it('keeps every completed sale without a player', () => {
    expect(salesFilterWhere({})).toEqual([{ status }]);
    expect(salesFilterWhere({ role: 'seller' })).toEqual([{ status }]);
  });

  it('filters on the seller or the buyer', () => {
    expect(salesFilterWhere({ userId: 4, role: 'seller' })).toEqual([
      { status, seller: { id: 4 } },
    ]);
    expect(salesFilterWhere({ userId: 4, role: 'buyer' })).toEqual([
      { status, buyer: { id: 4 } },
    ]);
  });

  it('matches both sides by default', () => {
    expect(salesFilterWhere({ userId: 4 })).toEqual([
      { status, seller: { id: 4 } },
      { status, buyer: { id: 4 } },
    ]);
  });
});

describe('applySalesFilter', () => {
  it('keeps every completed sale without a player', () => {
    const { qb, calls } = recordingQb();
    applySalesFilter(qb, {});
    expect(calls).toEqual([['where', 't.status = :status', { status }]]);
  });

  it.each([
    ['seller', 't.seller_id = :userId'],
    ['buyer', 't.buyer_id = :userId'],
    ['both', '(t.seller_id = :userId OR t.buyer_id = :userId)'],
  ] as const)('filters the %s side', (role, sql) => {
    const { qb, calls } = recordingQb();
    applySalesFilter(qb, { userId: 4, role });
    expect(calls[1]).toEqual(['andWhere', sql, { userId: 4 }]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- sales-filter`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `sales-filter.ts`**

```ts
import { TransactionStatus } from '@pipou/shared';
import type { SalesFilter } from '@pipou/shared';
import type { FindOptionsWhere, SelectQueryBuilder } from 'typeorm';
import type { Transaction } from '../transaction.entity';

// Les deux fonctions traduisent le même filtre : ventes conclues, puis celles
// où le joueur est vendeur, acheteur ou l'un des deux. Sans joueur : tout le marché.

/** Pour les `find` du repository. */
export function salesFilterWhere({
  userId,
  role = 'both',
}: SalesFilter): FindOptionsWhere<Transaction>[] {
  const status = TransactionStatus.COMPLETED;
  if (!userId) return [{ status }];
  const asSeller = { status, seller: { id: userId } };
  const asBuyer = { status, buyer: { id: userId } };
  if (role === 'seller') return [asSeller];
  if (role === 'buyer') return [asBuyer];
  return [asSeller, asBuyer];
}

/** Pour les agrégats en QueryBuilder (alias de table `t`). */
export function applySalesFilter(
  qb: SelectQueryBuilder<Transaction>,
  { userId, role = 'both' }: SalesFilter,
): SelectQueryBuilder<Transaction> {
  qb.where('t.status = :status', { status: TransactionStatus.COMPLETED });
  if (!userId) return qb;
  if (role === 'seller') return qb.andWhere('t.seller_id = :userId', { userId });
  if (role === 'buyer') return qb.andWhere('t.buyer_id = :userId', { userId });
  return qb.andWhere('(t.seller_id = :userId OR t.buyer_id = :userId)', {
    userId,
  });
}
```

- [ ] **Step 4: Vérifier le succès**

Run: `pnpm --filter @pipou/backend test -- sales-filter`
Expected: PASS.

- [ ] **Step 5: Test DTO (échoue)**

`dto/sales-filter.dto.spec.ts` (couvre `RecentSalesQueryDto` ici, `SalesStatsQueryDto` est ajouté à la Task 4) :

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecentSalesQueryDto } from './recent-sales-query.dto';

const errorsFor = async (query: object) =>
  (
    await validate(plainToInstance(RecentSalesQueryDto, query), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

describe('RecentSalesQueryDto', () => {
  it('accepts a player and the both role from the query string', async () => {
    expect(await errorsFor({ userId: '7', role: 'both' })).toEqual([]);
  });

  it('rejects an invalid player id', async () => {
    expect(await errorsFor({ userId: '0' })).toEqual(['userId']);
    expect(await errorsFor({ userId: 'abc' })).toEqual(['userId']);
  });

  it('rejects an unknown role', async () => {
    expect(await errorsFor({ role: 'admin' })).toEqual(['role']);
  });
});
```

Run: `pnpm --filter @pipou/backend test -- sales-filter.dto`
Expected: FAIL — `userId` et `role` ne sont pas whitelistés.

- [ ] **Step 6: Étendre `RecentSalesQueryDto`**

```ts
import { IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { RecentSalesQuery, SaleRole, SaleSort } from '@pipou/shared';

export class RecentSalesQueryDto
  extends PaginationDto
  implements RecentSalesQuery
{
  @IsOptional()
  @IsIn(['date', 'price'])
  sort?: SaleSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsIn(['seller', 'buyer', 'both'])
  role?: SaleRole;
}
```

Run: `pnpm --filter @pipou/backend test -- sales-filter.dto`
Expected: PASS.

- [ ] **Step 7: Mettre à jour le test du service (échoue)**

Dans `transactions.service.spec.ts`, remplacer le contenu de `describe('getRecentSales')` par :

```ts
  describe('getRecentSales', () => {
    it('should sort by date by default and by price on request', async () => {
      mockTransactionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getRecentSales({});
      expect(mockTransactionRepo.findAndCount).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: [{ status: TransactionStatus.COMPLETED }],
          order: { updatedAt: 'DESC' },
        }),
      );

      await service.getRecentSales({}, 'price');
      expect(mockTransactionRepo.findAndCount).toHaveBeenLastCalledWith(
        expect.objectContaining({
          order: { totalPrice: 'DESC', updatedAt: 'DESC' },
        }),
      );
    });

    it("should keep only a player's sales when filtered", async () => {
      mockTransactionRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getRecentSales({}, 'date', { userId: 7, role: 'buyer' });
      expect(mockTransactionRepo.findAndCount).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: [{ status: TransactionStatus.COMPLETED, buyer: { id: 7 } }],
        }),
      );
    });
  });
```

Run: `pnpm --filter @pipou/backend test -- transactions.service`
Expected: FAIL sur les deux tests `getRecentSales`.

- [ ] **Step 8: Brancher le filtre dans le service**

Dans `transactions.service.ts`, ajouter les imports :

```ts
import type { SaleSort, SalesFilter } from '@pipou/shared';
import { salesFilterWhere } from './stats/sales-filter';
```

(remplace la ligne `import type { SaleSort } from '@pipou/shared';`). Remplacer le calcul de `where` dans `getUserHistory` :

```ts
    const where = salesFilterWhere({ userId, role: role ?? 'both' });
```

Et `getRecentSales` :

```ts
  async getRecentSales(
    pagination: PaginationDto,
    sort: SaleSort = 'date',
    filter: SalesFilter = {},
  ) {
    const { page = 1, limit = 20 } = pagination;
    const [data, total] = await this.transactionRepository.findAndCount({
      where: salesFilterWhere(filter),
      relations: ['seller', 'buyer'],
      order: saleOrder(sort),
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
```

Si `TransactionStatus` n'est plus utilisé ailleurs dans le fichier après ce changement, le laisser : il l'est (création, achat, annulation).

- [ ] **Step 9: Passer le filtre depuis le contrôleur**

Dans `transactions.controller.ts` :

```ts
  // GET /transactions/recent-sales — ventes conclues, tout le marché ou un joueur
  @UseGuards(JwtAuthGuard)
  @Get('recent-sales')
  getRecentSales(@Query() query: RecentSalesQueryDto) {
    return this.transactionService.getRecentSales(query, query.sort, {
      userId: query.userId,
      role: query.role,
    });
  }
```

- [ ] **Step 10: Lancer toute la suite backend**

Run: `pnpm --filter @pipou/backend test`
Expected: PASS (les tests `getUserHistory` existants restent verts : ils ne vérifient pas `where`).

- [ ] **Step 11: Commit**

```bash
git add apps/backend/src/transactions
git commit -m "feat(transactions): filter recent sales by player and role"
```

---

### Task 4: `TransactionStatsService` et `GET /transactions/stats`

**Files:**
- Create: `apps/backend/src/transactions/stats/transaction-stats.service.ts`
- Test: `apps/backend/src/transactions/stats/transaction-stats.service.spec.ts`
- Create: `apps/backend/src/transactions/dto/sales-stats-query.dto.ts`
- Modify: `apps/backend/src/transactions/dto/sales-filter.dto.spec.ts`
- Modify: `apps/backend/src/transactions/transactions.module.ts`
- Modify: `apps/backend/src/transactions/transactions.controller.ts`
- Modify: `apps/backend/src/transactions/transactions.controller.spec.ts`

**Interfaces:**
- Consumes: Task 2 (calc), Task 3 (`applySalesFilter`), `SalesStats`.
- Produces: `TransactionStatsService.getStats(filter: SalesFilter, now?: Date): Promise<SalesStats>` ; route `GET /transactions/stats?userId=&role=`.

- [ ] **Step 1: Tests du service (échouent)**

```ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from '../transaction.entity';
import { TransactionStatsService } from './transaction-stats.service';

const NOW = new Date('2026-10-15T12:00:00.000Z');

/** QueryBuilder factice : toute méthode chaînable renvoie le builder. */
function fakeQb(result: { raw?: unknown; many?: unknown[]; one?: unknown }) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'where',
    'andWhere',
    'select',
    'addSelect',
    'innerJoin',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'limit',
  ])
    qb[method] = jest.fn(() => qb);
  qb.getRawOne = jest.fn().mockResolvedValue(result.raw);
  qb.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  qb.getOne = jest.fn().mockResolvedValue(result.one ?? null);
  return qb;
}

const repo = { createQueryBuilder: jest.fn() };

/** Ordre de création des builders dans getStats : totaux, 30 jours, plus grosse vente, top objet, top partenaire. */
function stubQueries(results: Parameters<typeof fakeQb>[0][]) {
  const builders = results.map(fakeQb);
  builders.forEach((qb) => repo.createQueryBuilder.mockReturnValueOnce(qb));
  return builders;
}

const EMPTY_TOTALS = {
  count: '0',
  totalGold: null,
  units: null,
  minUnit: null,
  maxUnit: null,
};

describe('TransactionStatsService', () => {
  let service: TransactionStatsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TransactionStatsService,
        { provide: getRepositoryToken(Transaction), useValue: repo },
      ],
    }).compile();
    service = module.get(TransactionStatsService);
  });

  afterEach(() => jest.resetAllMocks());

  it('returns zeros and nulls for an empty history', async () => {
    stubQueries([{ raw: EMPTY_TOTALS }, {}, {}, { raw: undefined }]);

    const stats = await service.getStats({}, NOW);

    expect(stats).toEqual({
      count: 0,
      totalGold: 0,
      unitsTraded: 0,
      avgUnitPrice: null,
      minUnitPrice: null,
      maxUnitPrice: null,
      biggestSale: null,
      topItem: null,
      topPartner: null,
      bestDay: null,
      trend: { last7: 0, previous7: 0, percent: null },
      daily: expect.any(Array),
    });
    expect(stats.daily).toHaveLength(30);
    expect(stats.daily.every((d) => d.gold === 0)).toBe(true);
  });

  it('does not look for a partner on the whole market', async () => {
    stubQueries([{ raw: EMPTY_TOTALS }, {}, {}, {}]);
    await service.getStats({}, NOW);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(4);
  });

  it('assembles the stats of a player', async () => {
    const [, recent] = stubQueries([
      {
        raw: {
          count: '2',
          totalGold: '780',
          units: '6',
          minUnit: '30',
          maxUnit: '150',
        },
      },
      {
        many: [
          { totalPrice: 750, updatedAt: new Date('2026-10-14T09:00:00.000Z') },
          { totalPrice: 30, updatedAt: new Date('2026-10-15T09:00:00.000Z') },
        ],
      },
      {
        one: {
          id: 9,
          itemName: 'Brigade de Combat',
          productId: 3,
          totalPrice: 750,
          quantity: 5,
          updatedAt: new Date('2026-10-14T09:00:00.000Z'),
        },
      },
      { raw: { itemName: 'Brigade de Combat', units: '5' } },
      { raw: { userId: 2, username: 'phimocard', count: '2' } },
    ]);

    const stats = await service.getStats({ userId: 1, role: 'both' }, NOW);

    expect(stats).toMatchObject({
      count: 2,
      totalGold: 780,
      unitsTraded: 6,
      avgUnitPrice: 130,
      minUnitPrice: 30,
      maxUnitPrice: 150,
      biggestSale: {
        id: 9,
        itemName: 'Brigade de Combat',
        totalPrice: 750,
        quantity: 5,
        date: '2026-10-14T09:00:00.000Z',
      },
      topItem: { itemName: 'Brigade de Combat', units: 5 },
      topPartner: { userId: 2, username: 'phimocard', count: 2 },
      bestDay: { date: '2026-10-14', gold: 750 },
      trend: { last7: 780, previous7: 0, percent: null },
    });
    expect(recent.andWhere).toHaveBeenCalledWith('t.updatedAt >= :since', {
      since: new Date('2026-09-16T00:00:00.000Z'),
    });
  });
});
```

Run: `pnpm --filter @pipou/backend test -- transaction-stats`
Expected: FAIL — module introuvable.

- [ ] **Step 2: Implémenter le service**

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SalesFilter, SalesStats } from '@pipou/shared';
import { Transaction } from '../transaction.entity';
import { User } from '../../users/user.entity';
import { applySalesFilter } from './sales-filter';
import {
  avgUnitPrice,
  bestDay,
  bucketDaily,
  chartStart,
  toNullableNumber,
  toNumber,
  trend,
} from './sales-stats.calc';

type Raw = string | number | null;

interface RawTotals {
  count: Raw;
  totalGold: Raw;
  units: Raw;
  minUnit: Raw;
  maxUnit: Raw;
}

/** Stats des ventes conclues (tout le marché ou un joueur), pour GET /transactions/stats. */
@Injectable()
export class TransactionStatsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private sales(filter: SalesFilter) {
    return applySalesFilter(
      this.transactionRepository.createQueryBuilder('t'),
      filter,
    );
  }

  async getStats(filter: SalesFilter, now = new Date()): Promise<SalesStats> {
    const [totals, recent, biggest, topItem, topPartner] = await Promise.all([
      this.sales(filter)
        .select('COUNT(*)', 'count')
        .addSelect('SUM(t.totalPrice)', 'totalGold')
        .addSelect('SUM(t.quantity)', 'units')
        .addSelect('MIN(t.unitPrice)', 'minUnit')
        .addSelect('MAX(t.unitPrice)', 'maxUnit')
        .getRawOne<RawTotals>(),
      this.sales(filter)
        .andWhere('t.updatedAt >= :since', { since: chartStart(now) })
        .select(['t.id', 't.totalPrice', 't.updatedAt'])
        .getMany(),
      this.sales(filter)
        .orderBy('t.totalPrice', 'DESC')
        .addOrderBy('t.updatedAt', 'DESC')
        .getOne(),
      this.sales(filter)
        .select('t.itemName', 'itemName')
        .addSelect('SUM(t.quantity)', 'units')
        .groupBy('t.itemName')
        .orderBy('units', 'DESC')
        .limit(1)
        .getRawOne<{ itemName: string | null; units: Raw }>(),
      this.topPartner(filter),
    ]);

    const totalGold = toNumber(totals?.totalGold);
    const unitsTraded = toNumber(totals?.units);
    const daily = bucketDaily(
      recent.map((sale) => ({ date: sale.updatedAt, gold: sale.totalPrice })),
      now,
    );

    return {
      count: toNumber(totals?.count),
      totalGold,
      unitsTraded,
      avgUnitPrice: avgUnitPrice(totalGold, unitsTraded),
      minUnitPrice: toNullableNumber(totals?.minUnit),
      maxUnitPrice: toNullableNumber(totals?.maxUnit),
      biggestSale: biggest
        ? {
            id: biggest.id,
            itemName: biggest.itemName ?? `#${biggest.productId}`,
            totalPrice: biggest.totalPrice,
            quantity: biggest.quantity,
            date: biggest.updatedAt.toISOString(),
          }
        : null,
      topItem: topItem
        ? {
            itemName: topItem.itemName ?? '—',
            units: toNumber(topItem.units),
          }
        : null,
      topPartner,
      bestDay: bestDay(daily),
      trend: trend(daily),
      daily,
    };
  }

  /** Joueur avec qui `userId` a conclu le plus de ventes, dans le rôle filtré. */
  private async topPartner(
    filter: SalesFilter,
  ): Promise<SalesStats['topPartner']> {
    if (!filter.userId) return null;
    // Contrepartie : l'acheteur quand le joueur vend, le vendeur quand il achète
    const row = await this.sales(filter)
      .innerJoin(
        User,
        'p',
        'p.id = CASE WHEN t.seller_id = :userId THEN t.buyer_id ELSE t.seller_id END',
      )
      .select('p.id', 'userId')
      .addSelect('p.username', 'username')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.id')
      .addGroupBy('p.username')
      .orderBy('count', 'DESC')
      .limit(1)
      .getRawOne<{ userId: Raw; username: string; count: Raw }>();
    return row
      ? {
          userId: toNumber(row.userId),
          username: row.username,
          count: toNumber(row.count),
        }
      : null;
  }
}
```

Run: `pnpm --filter @pipou/backend test -- transaction-stats`
Expected: PASS (3 tests).

- [ ] **Step 3: DTO des stats — test (échoue)**

Ajouter à la fin de `dto/sales-filter.dto.spec.ts` :

```ts
import { SalesStatsQueryDto } from './sales-stats-query.dto';

describe('SalesStatsQueryDto', () => {
  const statsErrors = async (query: object) =>
    (
      await validate(plainToInstance(SalesStatsQueryDto, query), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).map((e) => e.property);

  it('accepts an empty query (whole market)', async () => {
    expect(await statsErrors({})).toEqual([]);
  });

  it('accepts a player with a role', async () => {
    expect(await statsErrors({ userId: '3', role: 'seller' })).toEqual([]);
  });

  it('rejects pagination params and unknown roles', async () => {
    expect(await statsErrors({ page: '2' })).toEqual(['page']);
    expect(await statsErrors({ role: 'both ' })).toEqual(['role']);
  });
});
```

(Placer l'`import` en tête de fichier avec les autres.)

Run: `pnpm --filter @pipou/backend test -- sales-filter.dto`
Expected: FAIL — module introuvable.

- [ ] **Step 4: Créer `sales-stats-query.dto.ts`**

```ts
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { SaleRole, SalesFilter } from '@pipou/shared';

/** GET /transactions/stats — sans userId : tout le marché. */
export class SalesStatsQueryDto implements SalesFilter {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsIn(['seller', 'buyer', 'both'])
  role?: SaleRole;
}
```

Run: `pnpm --filter @pipou/backend test -- sales-filter.dto`
Expected: PASS.

- [ ] **Step 5: Test du contrôleur (échoue)**

Dans `transactions.controller.spec.ts` :
- importer `TransactionStatsService` depuis `./stats/transaction-stats.service` ;
- ajouter `const mockStatsService = { getStats: jest.fn() };` après `mockTransactionService` ;
- ajouter `getRecentSales: jest.fn(),` dans `mockTransactionService` ;
- ajouter `{ provide: TransactionStatsService, useValue: mockStatsService },` dans `providers` ;
- ajouter avant la dernière accolade du `describe` principal :

```ts
  // ======= SALES =======
  describe('getRecentSales', () => {
    it('should pass the player filter to the service', async () => {
      mockTransactionService.getRecentSales.mockResolvedValue({ data: [] });
      const query = { ...pagination, sort: 'price' as const, userId: 3, role: 'buyer' as const };

      await controller.getRecentSales(query);
      expect(mockTransactionService.getRecentSales).toHaveBeenCalledWith(
        query,
        'price',
        { userId: 3, role: 'buyer' },
      );
    });
  });

  describe('getSalesStats', () => {
    it('should return the stats for the filter', async () => {
      const fake = { count: 1 };
      mockStatsService.getStats.mockResolvedValue(fake);

      const result = await controller.getSalesStats({ userId: 3, role: 'seller' });
      expect(mockStatsService.getStats).toHaveBeenCalledWith({
        userId: 3,
        role: 'seller',
      });
      expect(result).toBe(fake);
    });
  });
```

Run: `pnpm --filter @pipou/backend test -- transactions.controller`
Expected: FAIL — `TransactionStatsService` n'est pas injecté / `getSalesStats` n'existe pas.

- [ ] **Step 6: Route et module**

`transactions.controller.ts` — imports :

```ts
import { SalesStatsQueryDto } from './dto/sales-stats-query.dto';
import { TransactionStatsService } from './stats/transaction-stats.service';
```

Constructeur :

```ts
  constructor(
    private readonly transactionService: TransactionService,
    private readonly statsService: TransactionStatsService,
  ) {}
```

Route, juste après `getRecentSales` :

```ts
  // GET /transactions/stats — stats et série 30 jours des ventes conclues
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getSalesStats(@Query() query: SalesStatsQueryDto) {
    return this.statsService.getStats({
      userId: query.userId,
      role: query.role,
    });
  }
```

`transactions.module.ts` :

```ts
import { TransactionStatsService } from './stats/transaction-stats.service';
...
  providers: [TransactionService, TransactionStatsService],
```

- [ ] **Step 7: Suite backend + typecheck + lint**

Run: `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected: tout passe.

- [ ] **Step 8: Vérifier le SQL réel sur la base locale (jamais Aiven)**

Le QueryBuilder n'est pas couvert par les tests unitaires. Lancer `pnpm dev:local` (MySQL Docker, `.env.e2e`), se connecter dans le front local (le cookie d'auth est alors posé), puis ouvrir dans le même navigateur `http://localhost:<port API>/transactions/stats`, puis `?userId=<un id existant>&role=both`, puis `?userId=<id>&role=seller`. Vérifier :
- réponse 200, `daily` de 30 entrées ;
- `count`/`totalGold` cohérents avec `/transactions/recent-sales?limit=500&userId=<id>` ;
- `topPartner` non nul pour un joueur qui a vendu.

Si une requête lève une erreur SQL (ex. alias `units`/`count` dans `ORDER BY`), corriger dans le service et relancer les tests. Arrêter le stack ensuite.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/transactions
git commit -m "feat(transactions): sales stats endpoint with 30-day gold series"
```

---

### Task 5: Service front, clés de requête et invalidations

**Files:**
- Modify: `apps/frontend/src/services/transaction.service.ts`
- Modify: `apps/frontend/src/utils/querykeys.ts`
- Modify: `apps/frontend/src/App.tsx:51-52`
- Modify: `apps/frontend/src/pages/Marketplace.tsx:281`

**Interfaces:**
- Consumes: `SalesFilter`, `SalesStats`, `RecentSalesQuery` (Task 1).
- Produces:
  - `transactionService.getSales(filter: SalesFilter, sort?: SaleSort): Promise<PaginatedResponse<Transaction>>` (100 dernières ventes)
  - `transactionService.getSalesStats(filter: SalesFilter): Promise<SalesStats>`
  - `QUERY_KEYS.salesAll`, `QUERY_KEYS.salesStats(filter)`, `QUERY_KEYS.salesList(filter, sort)`

Cette tâche garde temporairement `getHistory`/`getRecentSales` et les anciennes clés (encore utilisés par `Marketplace.tsx`) ; la Task 10 les supprime.

- [ ] **Step 1: Ajouter les méthodes du service**

Imports : ajouter `SalesFilter` et `SalesStats` à l'`import type { … } from "@pipou/shared"`. Après `getRecentSales`, ajouter :

```ts
  // Ventes conclues : tout le marché ou un joueur (vendeur, acheteur, les deux)
  async getSales(
    filter: SalesFilter,
    sort: SaleSort = "date",
  ): Promise<PaginatedResponse<Transaction>> {
    const params: RecentSalesQuery = {
      page: 1,
      limit: SALES_LIST_LIMIT,
      sort,
      ...filter,
    };
    const res = await api.get("/transactions/recent-sales", { params });
    return res.data;
  },

  // Stats et série 30 jours pour le même filtre
  async getSalesStats(filter: SalesFilter): Promise<SalesStats> {
    const res = await api.get("/transactions/stats", { params: filter });
    return res.data;
  },
```

Et avant `export const transactionService` :

```ts
/** Ventes chargées dans « Détails », paginées ensuite côté client. */
export const SALES_LIST_LIMIT = 100;
```

- [ ] **Step 2: Clés de requête**

Dans `utils/querykeys.ts`, ajouter `import type { SalesFilter } from "@pipou/shared";` en tête, et dans la section Marketplace :

```ts
  // Préfixe commun : invalider salesAll couvre les stats et les listes de tous les filtres
  salesAll: ["transactions", "sales"] as const,
  salesStats: (filter: SalesFilter) =>
    [
      "transactions",
      "sales",
      "stats",
      filter.userId ?? "market",
      filter.role ?? "both",
    ] as const,
  salesList: (filter: SalesFilter, sort: string) =>
    [
      "transactions",
      "sales",
      "list",
      filter.userId ?? "market",
      filter.role ?? "both",
      sort,
    ] as const,
```

- [ ] **Step 3: Invalider après une vente ou un achat**

`App.tsx`, dans le callback `useSseNotifications`, après la ligne `recentSalesAll` :

```ts
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.salesAll });
```

`Marketplace.tsx`, dans `handleBuyListing` après `recentSalesAll` :

```ts
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.salesAll });
```

(L'annulation d'une annonce ne crée pas de vente conclue : pas d'invalidation.)

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/services/transaction.service.ts apps/frontend/src/utils/querykeys.ts apps/frontend/src/App.tsx apps/frontend/src/pages/Marketplace.tsx
git commit -m "feat(marketplace): sales and sales stats queries with a shared cache prefix"
```

---

### Task 6: Libellés i18n, `salesScope` et `StatTiles`

**Files:**
- Modify: `apps/frontend/src/i18n/locales/fr.json`, `en.json`, `ko.json` (bloc `marketplace`)
- Create: `apps/frontend/src/features/marketplace/sales-history/salesScope.ts`
- Create: `apps/frontend/src/features/marketplace/sales-history/CountUp.tsx`
- Create: `apps/frontend/src/features/marketplace/sales-history/StatTiles.tsx`
- Create: `apps/frontend/src/features/marketplace/sales-history/StatTiles.css`
- Test: `apps/frontend/src/__tests__/components/StatTiles.test.tsx`

**Interfaces:**
- Produces:
  - `SalesPlayer { id: number; username: string }`
  - `SalesScope = { kind: "market" } | { kind: "player"; player: SalesPlayer; role: SaleRole }`
  - `MARKET_SCOPE: SalesScope`, `scopeToFilter(scope: SalesScope): SalesFilter`, `formatGold(n: number): string` (`"750 G"`)
  - `StatTileData { key; label; value: number | null; text?; unit?; caption?; tone?: "up" | "down"; onClick? }`
  - `<StatTiles tiles={StatTileData[]} />`, `<CountUp value={number} />`
  - Clés i18n `marketplace.sales.*` (liste ci-dessous).

- [ ] **Step 1: Ajouter les libellés**

Dans chaque fichier, à l'intérieur de l'objet `"marketplace"`, après `"history": { … },`, ajouter un bloc `"sales"`.

`fr.json` :

```json
    "sales": {
      "filter_label": "Filtrer les ventes",
      "scope_market": "Tout le marché",
      "scope_me": "Moi",
      "clear_player": "Retirer le filtre {{name}}",
      "role_label": "Rôle du joueur",
      "role_seller": "Vendeur",
      "role_buyer": "Acheteur",
      "role_both": "Les deux",
      "details_open": "Détails",
      "details_close": "Masquer les détails",
      "chart_label": "Or échangé sur 30 jours",
      "chart_bar": "{{date}} : {{gold}} G",
      "chart_empty": "Aucune vente sur les 30 derniers jours.",
      "today": "Aujourd'hui",
      "tile_count": "Ventes",
      "tile_total": "Or total",
      "tile_avg": "Prix moyen / u",
      "tile_biggest": "Plus grosse vente",
      "tile_top_item": "Objet le plus vendu",
      "tile_partner": "Partenaire favori",
      "tile_best_day": "Meilleur jour",
      "tile_range": "Fourchette / u",
      "tile_units": "Unités échangées",
      "tile_trend": "Tendance 7 j",
      "partner_count": "{{count}} échanges",
      "units_suffix": "{{count}} u",
      "per_unit": "{{price}} G/u",
      "show_player": "Voir les ventes de {{name}}",
      "error": "Statistiques indisponibles : {{message}}",
      "error_default": "Statistiques indisponibles."
    },
```

`en.json` :

```json
    "sales": {
      "filter_label": "Filter sales",
      "scope_market": "Whole market",
      "scope_me": "Me",
      "clear_player": "Remove the {{name}} filter",
      "role_label": "Player role",
      "role_seller": "Seller",
      "role_buyer": "Buyer",
      "role_both": "Both",
      "details_open": "Details",
      "details_close": "Hide details",
      "chart_label": "Gold traded over 30 days",
      "chart_bar": "{{date}}: {{gold}} G",
      "chart_empty": "No sales in the last 30 days.",
      "today": "Today",
      "tile_count": "Sales",
      "tile_total": "Total gold",
      "tile_avg": "Avg price / u",
      "tile_biggest": "Biggest sale",
      "tile_top_item": "Best-selling item",
      "tile_partner": "Favourite partner",
      "tile_best_day": "Best day",
      "tile_range": "Price range / u",
      "tile_units": "Units traded",
      "tile_trend": "7-day trend",
      "partner_count": "{{count}} trades",
      "units_suffix": "{{count}} u",
      "per_unit": "{{price}} G/u",
      "show_player": "Show {{name}}'s sales",
      "error": "Stats unavailable: {{message}}",
      "error_default": "Stats unavailable."
    },
```

`ko.json` :

```json
    "sales": {
      "filter_label": "판매 필터",
      "scope_market": "전체 마켓",
      "scope_me": "나",
      "clear_player": "{{name}} 필터 해제",
      "role_label": "플레이어 역할",
      "role_seller": "판매자",
      "role_buyer": "구매자",
      "role_both": "모두",
      "details_open": "상세 보기",
      "details_close": "상세 닫기",
      "chart_label": "30일간 거래된 골드",
      "chart_bar": "{{date}}: {{gold}} G",
      "chart_empty": "최근 30일 동안 판매가 없습니다.",
      "today": "오늘",
      "tile_count": "판매 수",
      "tile_total": "총 골드",
      "tile_avg": "평균 단가",
      "tile_biggest": "최대 판매",
      "tile_top_item": "최다 판매 아이템",
      "tile_partner": "단골 거래 상대",
      "tile_best_day": "최고의 날",
      "tile_range": "단가 범위",
      "tile_units": "거래 수량",
      "tile_trend": "7일 추세",
      "partner_count": "{{count}}회 거래",
      "units_suffix": "{{count}}개",
      "per_unit": "{{price}} G/개",
      "show_player": "{{name}}의 판매 보기",
      "error": "통계를 불러올 수 없습니다: {{message}}",
      "error_default": "통계를 불러올 수 없습니다."
    },
```

- [ ] **Step 2: `salesScope.ts`**

```ts
import type { SaleRole, SalesFilter } from "@pipou/shared";

export interface SalesPlayer {
  id: number;
  username: string;
}

/** Ventes affichées : tout le marché, ou un joueur dans un rôle. */
export type SalesScope =
  | { kind: "market" }
  | { kind: "player"; player: SalesPlayer; role: SaleRole };

export const MARKET_SCOPE: SalesScope = { kind: "market" };

export function scopeToFilter(scope: SalesScope): SalesFilter {
  return scope.kind === "market"
    ? {}
    : { userId: scope.player.id, role: scope.role };
}

export const formatGold = (gold: number) => `${gold} G`;
```

- [ ] **Step 3: Test de `StatTiles` (échoue)**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StatTiles from "../../features/marketplace/sales-history/StatTiles";

// Sans animation : les compteurs affichent directement leur valeur finale
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

describe("StatTiles", () => {
  it("affiche les valeurs, le texte libre et un tiret quand la stat manque", () => {
    render(
      <StatTiles
        tiles={[
          { key: "total", label: "Or total", value: 780, unit: " G" },
          { key: "range", label: "Fourchette / u", value: null, text: "30–150 G" },
          { key: "avg", label: "Prix moyen / u", value: null },
        ]}
      />,
    );
    expect(screen.getByText("780 G")).toBeInTheDocument();
    expect(screen.getByText("30–150 G")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("affiche la légende et la tendance", () => {
    render(
      <StatTiles
        tiles={[
          {
            key: "trend",
            label: "Tendance 7 j",
            value: null,
            text: "+12 %",
            tone: "up",
            caption: "780 G",
          },
        ]}
      />,
    );
    expect(screen.getByText("+12 %").closest(".stat-tile")).toHaveClass(
      "stat-tile--up",
    );
    expect(screen.getByText("780 G")).toBeInTheDocument();
  });

  it("rend une tuile cliquable sous forme de bouton", async () => {
    const onClick = vi.fn();
    render(
      <StatTiles
        tiles={[
          { key: "big", label: "Plus grosse vente", value: 750, unit: " G", onClick },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Plus grosse vente/ }));
    expect(onClick).toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter @pipou/frontend test -- StatTiles`
Expected: FAIL — module introuvable.

- [ ] **Step 4: `CountUp.tsx`**

```tsx
import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface CountUpProps {
  value: number;
}

/** Nombre qui monte de 0 à `value` à l'affichage (fixe si mouvements réduits). */
const CountUp = ({ value }: CountUpProps) => {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduceMotion]);

  return <>{reduceMotion ? value : shown}</>;
};

export default CountUp;
```

- [ ] **Step 5: `StatTiles.tsx`**

```tsx
import CountUp from "./CountUp";
import "./StatTiles.css";

export interface StatTileData {
  key: string;
  label: string;
  /** Valeur animée ; null (sans `text`) → « — ». */
  value: number | null;
  /** Texte affiché à la place du compteur (fourchette, pourcentage, nom…). */
  text?: string;
  /** Suffixe du compteur, ex. " G". */
  unit?: string;
  /** Ligne secondaire sous la valeur. */
  caption?: string;
  tone?: "up" | "down";
  onClick?: () => void;
}

interface StatTilesProps {
  tiles: StatTileData[];
}

function renderValue(tile: StatTileData) {
  if (tile.text) return tile.text;
  if (tile.value === null) return "—";
  return (
    <>
      <CountUp value={tile.value} />
      {tile.unit}
    </>
  );
}

function renderTile(tile: StatTileData) {
  const className = `stat-tile${tile.tone ? ` stat-tile--${tile.tone}` : ""}${
    tile.onClick ? " stat-tile--clickable" : ""
  }`;
  const content = (
    <>
      <span className="stat-tile__label">{tile.label}</span>
      <span className="stat-tile__value">{renderValue(tile)}</span>
      {tile.caption && <span className="stat-tile__caption">{tile.caption}</span>}
    </>
  );
  return (
    <li key={tile.key}>
      {tile.onClick ? (
        <button type="button" className={className} onClick={tile.onClick}>
          {content}
        </button>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

const StatTiles = ({ tiles }: StatTilesProps) => (
  <ul className="stat-tiles">{tiles.map(renderTile)}</ul>
);

export default StatTiles;
```

- [ ] **Step 6: `StatTiles.css`**

```css
.stat-tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.stat-tile {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 0.85rem;
  border-radius: 14px;
  border: 1px solid rgba(224, 180, 76, 0.18);
  background: #7a1c3b;
  color: #f5e6d0;
  text-align: left;
  font: inherit;
}

.stat-tile--clickable {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.stat-tile--clickable:hover,
.stat-tile--clickable:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(122, 28, 59, 0.35);
}

.stat-tile__label {
  font-size: 0.7rem;
  opacity: 0.8;
}

.stat-tile__value {
  font-family: "JetBrains Mono", monospace;
  font-weight: 700;
  font-size: 1.15rem;
  color: #e0b44c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-tile__caption {
  font-size: 0.7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-tile--up .stat-tile__value {
  color: #9fe0a4;
}
.stat-tile--down .stat-tile__value {
  color: #ff9d9d;
}

@media (prefers-reduced-motion: reduce) {
  .stat-tile--clickable {
    transition: none;
  }
}
```

- [ ] **Step 7: Vérifier**

Run: `pnpm --filter @pipou/frontend test -- StatTiles`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/i18n apps/frontend/src/features/marketplace/sales-history apps/frontend/src/__tests__/components/StatTiles.test.tsx
git commit -m "feat(marketplace): sales stat tiles with animated counters"
```

---

### Task 7: `GoldChart`

**Files:**
- Create: `apps/frontend/src/features/marketplace/sales-history/GoldChart.tsx`
- Create: `apps/frontend/src/features/marketplace/sales-history/GoldChart.css`
- Test: `apps/frontend/src/__tests__/components/GoldChart.test.tsx`

**Interfaces:**
- Consumes: `SalesStats["daily"]`, `SalesStats["bestDay"]`, `formatGold` (Task 6), clés `marketplace.sales.chart_*`, `today`.
- Produces: `<GoldChart daily={SalesStats["daily"]} bestDay={SalesStats["bestDay"]} />`

- [ ] **Step 1: Test (échoue)**

```tsx
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../../i18n";
import GoldChart from "../../features/marketplace/sales-history/GoldChart";

// 30 jours se terminant le 15/10 : 200 G le 14/10, 100 G le 15/10
const DAILY = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 16 + i)).toISOString().slice(0, 10);
  return { date, gold: date === "2026-10-14" ? 200 : date === "2026-10-15" ? 100 : 0 };
});

describe("GoldChart", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("dimensionne les barres par rapport au meilleur jour", () => {
    render(<GoldChart daily={DAILY} bestDay={{ date: "2026-10-14", gold: 200 }} />);
    expect(screen.getByRole("button", { name: "14/10 : 200 G" })).toHaveStyle({
      height: "100%",
    });
    expect(screen.getByRole("button", { name: "15/10 : 100 G" })).toHaveStyle({
      height: "50%",
    });
  });

  it("couronne le meilleur jour", () => {
    render(<GoldChart daily={DAILY} bestDay={{ date: "2026-10-14", gold: 200 }} />);
    const best = screen.getByRole("button", { name: "14/10 : 200 G" });
    expect(best).toHaveClass("gold-chart__bar--best");
    expect(best.closest(".gold-chart__col")).toHaveTextContent("👑");
  });

  it("affiche la bulle de la barre touchée", async () => {
    render(<GoldChart daily={DAILY} bestDay={{ date: "2026-10-14", gold: 200 }} />);
    await userEvent.click(screen.getByRole("button", { name: "15/10 : 100 G" }));
    expect(screen.getByRole("status")).toHaveTextContent("15/10 : 100 G");
  });

  it("affiche le message vide sans vente", () => {
    render(
      <GoldChart daily={DAILY.map((d) => ({ ...d, gold: 0 }))} bestDay={null} />,
    );
    expect(
      screen.getByText("Aucune vente sur les 30 derniers jours."),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
```

Run: `pnpm --filter @pipou/frontend test -- GoldChart`
Expected: FAIL — module introuvable.

- [ ] **Step 2: `GoldChart.tsx`**

```tsx
import { useState } from "react";
import type { CSSProperties } from "react";
import type { SalesStats } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import "./GoldChart.css";

interface GoldChartProps {
  daily: SalesStats["daily"];
  bestDay: SalesStats["bestDay"];
}

/** Repères de l'axe : premier jour, milieu, aujourd'hui. */
const AXIS_INDEXES = [0, 14, 29];

const GoldChart = ({ daily, bestDay }: GoldChartProps) => {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);

  const max = Math.max(0, ...daily.map((d) => d.gold));
  if (max === 0) {
    return <p className="gold-chart__empty">{t("marketplace.sales.chart_empty")}</p>;
  }

  const shortDate = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    });
  const barLabel = (index: number) =>
    t("marketplace.sales.chart_bar", {
      date: shortDate(daily[index].date),
      gold: daily[index].gold,
    });

  return (
    <figure className="gold-chart" aria-label={t("marketplace.sales.chart_label")}>
      <div className="gold-chart__bars">
        {daily.map((day, index) => {
          const isBest = bestDay?.date === day.date;
          const style = {
            height: day.gold ? `${(day.gold / max) * 100}%` : undefined,
            "--bar-index": index,
          } as CSSProperties;
          return (
            <div key={day.date} className="gold-chart__col">
              {isBest && (
                <span className="gold-chart__crown" aria-hidden="true">
                  👑
                </span>
              )}
              {day.gold > 0 ? (
                <button
                  type="button"
                  className={`gold-chart__bar${isBest ? " gold-chart__bar--best" : ""}${
                    selected === index ? " gold-chart__bar--selected" : ""
                  }`}
                  style={style}
                  aria-label={barLabel(index)}
                  onClick={() => setSelected(selected === index ? null : index)}
                />
              ) : (
                <span className="gold-chart__bar gold-chart__bar--empty" />
              )}
            </div>
          );
        })}
      </div>
      <div className="gold-chart__axis" aria-hidden="true">
        {AXIS_INDEXES.map((index) => (
          <span key={index}>
            {index === daily.length - 1
              ? t("marketplace.sales.today")
              : shortDate(daily[index].date)}
          </span>
        ))}
      </div>
      {selected !== null && (
        <p className="gold-chart__tooltip" role="status">
          {barLabel(selected)}
        </p>
      )}
    </figure>
  );
};

export default GoldChart;
```

- [ ] **Step 3: `GoldChart.css`**

```css
.gold-chart {
  margin: 0;
  padding: 0.9rem 0.85rem 0.6rem;
  border-radius: 14px;
  background: #7a1c3b;
  color: #f5e6d0;
}

.gold-chart__bars {
  height: 110px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding-top: 1.1rem; /* place pour la couronne */
}

.gold-chart__col {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.gold-chart__bar {
  display: block;
  width: 100%;
  min-height: 4px;
  padding: 0;
  border: 0;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(180deg, #e0b44c, #b8862f);
  cursor: pointer;
  transform-origin: bottom;
  animation: goldBarGrow 0.5s ease-out both;
  animation-delay: calc(var(--bar-index) * 18ms);
}

.gold-chart__bar--empty {
  height: 2px;
  min-height: 2px;
  background: rgba(245, 230, 208, 0.18);
  cursor: default;
  animation: none;
}

.gold-chart__bar--best {
  background: linear-gradient(180deg, #ffe08a, #e0b44c);
  box-shadow: 0 0 10px rgba(224, 180, 76, 0.6);
}

.gold-chart__bar--selected {
  outline: 2px solid #f5e6d0;
  outline-offset: 1px;
}

.gold-chart__crown {
  position: absolute;
  top: -0.2rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  line-height: 1;
}

.gold-chart__axis {
  display: flex;
  justify-content: space-between;
  margin-top: 0.35rem;
  font-size: 0.65rem;
  opacity: 0.75;
}

.gold-chart__tooltip {
  margin: 0.4rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  font-family: "JetBrains Mono", monospace;
  color: #e0b44c;
}

.gold-chart__empty {
  margin: 0;
  padding: 1.2rem;
  border-radius: 14px;
  text-align: center;
  background: rgba(122, 28, 59, 0.08);
  color: #7a1c3b;
}

@keyframes goldBarGrow {
  from {
    transform: scaleY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gold-chart__bar {
    animation: none;
  }
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend test -- GoldChart`
Expected: PASS (4 tests). Si le format de date fr de jsdom diffère de `14/10`, ajuster l'attendu des tests au format réellement produit par `toLocaleDateString("fr", { day: "2-digit", month: "2-digit" })`, pas l'implémentation.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/marketplace/sales-history/GoldChart.* apps/frontend/src/__tests__/components/GoldChart.test.tsx
git commit -m "feat(marketplace): 30-day gold bar chart with best-day crown"
```

---

### Task 8: `SalesFilterBar`

**Files:**
- Create: `apps/frontend/src/features/marketplace/sales-history/SalesFilterBar.tsx`
- Create: `apps/frontend/src/features/marketplace/sales-history/SalesFilterBar.css`
- Test: `apps/frontend/src/__tests__/components/SalesFilterBar.test.tsx`

**Interfaces:**
- Consumes: `SalesScope`, `SalesPlayer`, `MARKET_SCOPE` (Task 6), `Button` (`variant="ghost-bordeaux"`, `size="sm"`, `active`).
- Produces: `<SalesFilterBar scope={SalesScope} me={SalesPlayer | undefined} onChange={(scope: SalesScope) => void} />`

- [ ] **Step 1: Test (échoue)**

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../../i18n";
import SalesFilterBar from "../../features/marketplace/sales-history/SalesFilterBar";
import { MARKET_SCOPE } from "../../features/marketplace/sales-history/salesScope";

const ME = { id: 1, username: "moi" };
const BOB = { id: 2, username: "bob" };

describe("SalesFilterBar", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("n'affiche pas les rôles sur tout le marché", () => {
    render(<SalesFilterBar scope={MARKET_SCOPE} me={ME} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tout le marché" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Vendeur" })).not.toBeInTheDocument();
  });

  it("passe à mes ventes et achats", async () => {
    const onChange = vi.fn();
    render(<SalesFilterBar scope={MARKET_SCOPE} me={ME} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Moi" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "player", player: ME, role: "both" });
  });

  it("montre le joueur choisi, ses rôles, et le retire", async () => {
    const onChange = vi.fn();
    const scope = { kind: "player" as const, player: BOB, role: "both" as const };
    render(<SalesFilterBar scope={scope} me={ME} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Acheteur" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...scope, role: "buyer" });

    await userEvent.click(screen.getByRole("button", { name: "Retirer le filtre bob" }));
    expect(onChange).toHaveBeenLastCalledWith(MARKET_SCOPE);
  });

  it("désactive « Moi » tant que le profil n'est pas chargé", () => {
    render(<SalesFilterBar scope={MARKET_SCOPE} me={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Moi" })).toBeDisabled();
  });
});
```

Run: `pnpm --filter @pipou/frontend test -- SalesFilterBar`
Expected: FAIL — module introuvable.

- [ ] **Step 2: `SalesFilterBar.tsx`**

```tsx
import type { SaleRole } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import Button from "../../../components/Button";
import { MARKET_SCOPE, type SalesPlayer, type SalesScope } from "./salesScope";
import "./SalesFilterBar.css";

interface SalesFilterBarProps {
  scope: SalesScope;
  me: SalesPlayer | undefined;
  onChange: (scope: SalesScope) => void;
}

const ROLES: SaleRole[] = ["seller", "buyer", "both"];

const SalesFilterBar = ({ scope, me, onChange }: SalesFilterBarProps) => {
  const { t } = useTranslation();
  const player = scope.kind === "player" ? scope : null;
  const isMe = player !== null && player.player.id === me?.id;

  return (
    <div className="sales-filter" role="group" aria-label={t("marketplace.sales.filter_label")}>
      <div className="sales-filter__row">
        <Button
          variant="ghost-bordeaux"
          size="sm"
          active={scope.kind === "market"}
          onClick={() => onChange(MARKET_SCOPE)}
        >
          {t("marketplace.sales.scope_market")}
        </Button>
        <Button
          variant="ghost-bordeaux"
          size="sm"
          active={isMe}
          disabled={!me}
          onClick={() => me && onChange({ kind: "player", player: me, role: "both" })}
        >
          {t("marketplace.sales.scope_me")}
        </Button>
        {player && !isMe && (
          <Button
            variant="ghost-bordeaux"
            size="sm"
            active
            aria-label={t("marketplace.sales.clear_player", {
              name: player.player.username,
            })}
            onClick={() => onChange(MARKET_SCOPE)}
          >
            ✕ {player.player.username}
          </Button>
        )}
      </div>
      {player && (
        <div
          className="sales-filter__row sales-filter__row--roles"
          role="group"
          aria-label={t("marketplace.sales.role_label")}
        >
          {ROLES.map((role) => (
            <Button
              key={role}
              variant="ghost-gold"
              size="sm"
              active={player.role === role}
              onClick={() => onChange({ ...player, role })}
            >
              {t(`marketplace.sales.role_${role}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesFilterBar;
```

Note : `Button` avec `active` rend `aria-pressed` (c'est ce que vérifie le test existant de `TransactionHistory`). Si l'`aria-label` de la puce joueur est ignoré par `Button`, vérifier que `Button` propage bien les props natives (`NativeProps`) — c'est le cas d'après `components/Button.tsx`.

- [ ] **Step 3: `SalesFilterBar.css`**

```css
.sales-filter {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.sales-filter__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.sales-filter__row--roles {
  padding-left: 0.2rem;
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend test -- SalesFilterBar`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/marketplace/sales-history/SalesFilterBar.* apps/frontend/src/__tests__/components/SalesFilterBar.test.tsx
git commit -m "feat(marketplace): sales filter chips for market, me or a player"
```

---

### Task 9: `SalesList` (remplace `TransactionHistory`)

**Files:**
- Create: `apps/frontend/src/features/marketplace/sales-history/SalesList.tsx`
- Create: `apps/frontend/src/features/marketplace/sales-history/SalesList.css`
- Create (migration) : `apps/frontend/src/__tests__/components/SalesList.test.tsx`
- Delete: `apps/frontend/src/__tests__/components/TransactionHistory.test.tsx` (à la Task 10, en même temps que le composant)

**Interfaces:**
- Consumes: `Transaction` (service), `SaleSort`, `SalesPlayer`, `Button`, `IconArrowLeft/Right`, clés `marketplace.history.*` existantes + `marketplace.sales.per_unit`, `show_player`.
- Produces:

```ts
interface SalesListProps {
  history: Transaction[] | undefined;
  emptyMessage: string;
  sort: SaleSort;
  onSortChange: (sort: SaleSort) => void;
  highlightId?: number | null;
  /** Joueur connecté : colore les lignes selon qu'il a vendu ou acheté. */
  viewerId?: number;
  onPlayerClick: (player: SalesPlayer) => void;
}
```

- [ ] **Step 1: Test (échoue)**

```tsx
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../../i18n";
import SalesList from "../../features/marketplace/sales-history/SalesList";
import type { Transaction } from "../../services/transaction.service";

// 8 ventes : 6 par page, la vente #8 est donc en page 2. moi (1) vend à bob (2),
// sauf la vente #2 où moi achète à bob.
const SALES = Array.from({ length: 8 }, (_, i) => {
  const mine = i !== 1;
  return {
    id: i + 1,
    productId: 10,
    productType: "CARD",
    itemName: `Carte ${i + 1}`,
    quantity: 2,
    unitPrice: 5 * (i + 1),
    totalPrice: 10 * (i + 1),
    status: "COMPLETED",
    seller: mine ? { id: 1, username: "moi" } : { id: 2, username: "bob" },
    buyer: mine ? { id: 2, username: "bob" } : { id: 1, username: "moi" },
    createdAt: "2026-10-10T10:00:00.000Z",
    updatedAt: "2026-10-10T10:00:00.000Z",
  };
}) as unknown as Transaction[];

const baseProps = {
  history: SALES,
  emptyMessage: "Rien",
  sort: "date" as const,
  onSortChange: vi.fn(),
  onPlayerClick: vi.fn(),
};

describe("SalesList", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
    // jsdom n'implémente pas scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("change le tri au clic sur Prix", async () => {
    const onSortChange = vi.fn();
    render(<SalesList {...baseProps} onSortChange={onSortChange} />);
    expect(screen.getByRole("button", { name: "Plus récentes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Plus chères" }));
    expect(onSortChange).toHaveBeenCalledWith("price");
  });

  it("ouvre la page de la vente mise en avant et la surligne", () => {
    render(<SalesList {...baseProps} highlightId={8} />);
    const item = screen.getByText("Carte 8").closest("li");
    expect(item).toHaveClass("sales-list__item--highlight");
    expect(screen.queryByText("Carte 1")).not.toBeInTheDocument();
    expect(item!.scrollIntoView).toHaveBeenCalled();
  });

  it("reste en page 1 sans vente mise en avant", () => {
    render(<SalesList {...baseProps} />);
    expect(screen.getByText("Carte 1")).toBeInTheDocument();
    expect(screen.queryByText("Carte 8")).not.toBeInTheDocument();
  });

  it("colore les lignes selon que j'ai vendu ou acheté", () => {
    render(<SalesList {...baseProps} viewerId={1} />);
    expect(screen.getByText("Carte 1").closest("li")).toHaveClass("sales-list__item--sold");
    expect(screen.getByText("Carte 2").closest("li")).toHaveClass("sales-list__item--bought");
  });

  it("affiche le prix unitaire et filtre au clic sur un pseudo", async () => {
    const onPlayerClick = vi.fn();
    render(<SalesList {...baseProps} onPlayerClick={onPlayerClick} />);
    expect(screen.getByText("5 G/u")).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Voir les ventes de bob" })[0],
    );
    expect(onPlayerClick).toHaveBeenCalledWith({ id: 2, username: "bob" });
  });

  it("affiche le message vide", () => {
    render(<SalesList {...baseProps} history={[]} />);
    expect(screen.getByText("Rien")).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @pipou/frontend test -- SalesList`
Expected: FAIL — module introuvable.

- [ ] **Step 2: `SalesList.tsx`**

Reprend la logique de pagination et de mise en avant de `TransactionHistory.tsx` à l'identique ; ajoute la bande de point de vue, le prix unitaire et les pseudos cliquables.

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { SaleSort } from "@pipou/shared";
import { useTranslation } from "react-i18next";
import type { Transaction } from "../../../services/transaction.service";
import Button from "../../../components/Button";
import { IconArrowLeft, IconArrowRight } from "../../../components/Icons";
import { formatGold, type SalesPlayer } from "./salesScope";
import "./SalesList.css";

interface SalesListProps {
  history: Transaction[] | undefined;
  emptyMessage: string;
  sort: SaleSort;
  onSortChange: (sort: SaleSort) => void;
  /** Vente à mettre en avant (lien depuis la boîte de réception, plus grosse vente). */
  highlightId?: number | null;
  /** Joueur connecté : colore les lignes selon qu'il a vendu ou acheté. */
  viewerId?: number;
  onPlayerClick: (player: SalesPlayer) => void;
}

const ITEMS_PER_PAGE = 6;
const SORTS: SaleSort[] = ["date", "price"];

function perspectiveClass(tx: Transaction, viewerId?: number) {
  if (viewerId === undefined) return "";
  if (tx.seller?.id === viewerId) return " sales-list__item--sold";
  if (tx.buyer?.id === viewerId) return " sales-list__item--bought";
  return "";
}

const SalesList = ({
  history,
  emptyMessage,
  sort,
  onSortChange,
  highlightId,
  viewerId,
  onPlayerClick,
}: SalesListProps) => {
  const { t } = useTranslation();
  // null = page automatique : celle de la vente mise en avant, sinon la 1re
  const [chosenPage, setChosenPage] = useState<number | null>(null);
  const highlightRef = useRef<HTMLLIElement>(null);

  const highlightIndex = highlightId
    ? (history?.findIndex((tx) => tx.id === highlightId) ?? -1)
    : -1;
  const page =
    chosenPage ??
    (highlightIndex >= 0 ? Math.floor(highlightIndex / ITEMS_PER_PAGE) + 1 : 1);
  const setPage = (update: (p: number) => number) => setChosenPage(update(page));

  const isHighlightVisible = highlightIndex >= 0 && chosenPage === null;
  useEffect(() => {
    if (isHighlightVisible)
      highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isHighlightVisible]);

  const paginatedHistory = useMemo(() => {
    if (!history) return [];
    const start = (page - 1) * ITEMS_PER_PAGE;
    return history.slice(start, start + ITEMS_PER_PAGE);
  }, [history, page]);

  const totalPages = history ? Math.ceil(history.length / ITEMS_PER_PAGE) : 1;

  if (!history || history.length === 0) {
    return <p className="sales-list__empty">{emptyMessage}</p>;
  }

  const renderPlayer = (player: SalesPlayer | null | undefined, className: string) =>
    player ? (
      <button
        type="button"
        className={`sales-list__player ${className}`}
        aria-label={t("marketplace.sales.show_player", { name: player.username })}
        onClick={() => onPlayerClick({ id: player.id, username: player.username })}
      >
        {player.username}
      </button>
    ) : (
      <span className={className}>—</span>
    );

  return (
    <div className="sales-list-wrapper">
      <div
        className="sales-list__sort"
        role="group"
        aria-label={t("marketplace.history.sort_label")}
      >
        {SORTS.map((key) => (
          <Button
            key={key}
            variant="ghost-bordeaux"
            size="sm"
            active={sort === key}
            onClick={() => {
              setChosenPage(1);
              onSortChange(key);
            }}
          >
            {t(`marketplace.history.sort_${key}`)}
          </Button>
        ))}
      </div>
      <ul className="sales-list">
        {paginatedHistory.map((tx) => (
          <li
            key={tx.id}
            ref={tx.id === highlightId ? highlightRef : undefined}
            className={`sales-list__item${perspectiveClass(tx, viewerId)}${
              tx.id === highlightId ? " sales-list__item--highlight" : ""
            }`}
          >
            <div className="sales-list__left">
              <span className="sales-list__name">
                {tx.itemName || `Objet #${tx.productId}`}
              </span>
              <span className="sales-list__users">
                {renderPlayer(tx.seller, "sales-list__seller")}
                <span className="sales-list__arrow">→</span>
                {renderPlayer(tx.buyer, "sales-list__buyer")}
              </span>
            </div>
            <div className="sales-list__right">
              <span className="sales-list__qty">×{tx.quantity}</span>
              <span className="sales-list__prices">
                <span className="sales-list__price">{formatGold(tx.totalPrice)}</span>
                <span className="sales-list__unit">
                  {t("marketplace.sales.per_unit", { price: tx.unitPrice })}
                </span>
              </span>
              <span className="sales-list__date">
                {new Date(tx.updatedAt || tx.createdAt).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="sales-list__pagination">
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("pagination.prev")}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <IconArrowLeft size={16} color="currentColor" />
          </Button>
          <span>{t("marketplace.history.pagination", { page, total: totalPages })}</span>
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("pagination.next")}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <IconArrowRight size={16} color="currentColor" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default SalesList;
```

`renderPlayer` est une fonction de rendu (pas un composant déclaré dans un composant), conforme à `apps/frontend/CLAUDE.md`.

- [ ] **Step 3: `SalesList.css`**

```css
.sales-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.sales-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.sales-list__item {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 0.9rem 0.85rem 1.1rem;
  border-radius: 14px;
  background: #7a1c3b;
  color: #f5e6d0;
  overflow: hidden;
}

/* Bande de point de vue : ce que le joueur connecté a vendu ou acheté */
.sales-list__item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgba(245, 230, 208, 0.18);
}
.sales-list__item--sold::before {
  background: #9fe0a4;
}
.sales-list__item--bought::before {
  background: #91b7ff;
}

.sales-list__left {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.sales-list__name {
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sales-list__users {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.74rem;
  min-width: 0;
}

.sales-list__player {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
  text-decoration: underline dotted transparent;
  text-underline-offset: 3px;
  transition: text-decoration-color 0.15s ease;
}
.sales-list__player:hover,
.sales-list__player:focus-visible {
  text-decoration-color: currentColor;
}

.sales-list__seller {
  color: #91b7ff;
}
.sales-list__buyer {
  color: #9fe0a4;
}
.sales-list__arrow {
  color: rgba(255, 255, 255, 0.35);
}

.sales-list__right {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-shrink: 0;
}

.sales-list__qty {
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  font-size: 0.72rem;
  font-weight: 600;
}

.sales-list__prices {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.sales-list__price {
  color: #e0b44c;
  font-weight: 700;
  font-size: 0.9rem;
  font-family: "JetBrains Mono", monospace;
}

.sales-list__unit {
  font-size: 0.64rem;
  opacity: 0.7;
}

.sales-list__date {
  font-size: 0.68rem;
  min-width: 64px;
  text-align: right;
}

.sales-list__sort {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

.sales-list__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
}

.sales-list__empty {
  text-align: center;
  padding: 1.2rem;
  color: #7a1c3b;
}

/* Vente mise en avant : la ligne reste bordeaux, une bordure dorée fait un tour
   puis reste allumée, avec un léger halo or */
@property --sales-highlight-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.sales-list__item--highlight {
  overflow: visible;
  box-shadow: 0 0 18px rgba(224, 180, 76, 0.45);
}
.sales-list__item--highlight::after {
  content: "";
  position: absolute;
  inset: -2px;
  padding: 2px;
  border-radius: 16px;
  background: conic-gradient(
    from var(--sales-highlight-angle),
    #e0b44c 0 70%,
    #fff6d6 85%,
    #e0b44c 100%
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: salesHighlightSpin 1.8s ease-out 1;
  pointer-events: none;
}
/* La bande de point de vue reste dans les coins arrondis malgré overflow: visible */
.sales-list__item--highlight::before {
  border-radius: 14px 0 0 14px;
}

@keyframes salesHighlightSpin {
  to {
    --sales-highlight-angle: 360deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sales-list__item--highlight::after {
    animation: none;
  }
  .sales-list__player {
    transition: none;
  }
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend test -- SalesList`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/marketplace/sales-history/SalesList.* apps/frontend/src/__tests__/components/SalesList.test.tsx
git commit -m "feat(marketplace): sales list with viewer stripe, unit price and gold highlight"
```

---

### Task 10: `SalesHistory` et branchement dans les onglets

**Files:**
- Create: `apps/frontend/src/features/marketplace/sales-history/salesTiles.ts`
- Create: `apps/frontend/src/features/marketplace/sales-history/SalesHistory.tsx`
- Create: `apps/frontend/src/features/marketplace/sales-history/SalesHistory.css`
- Test: `apps/frontend/src/__tests__/components/SalesHistory.test.tsx`
- Modify: `apps/frontend/src/features/marketplace/SellTab.tsx`, `BuyTab.tsx`
- Modify: `apps/frontend/src/pages/Marketplace.tsx`
- Modify: `apps/frontend/src/services/transaction.service.ts` (supprimer `getHistory`, `getRecentSales`)
- Modify: `apps/frontend/src/utils/querykeys.ts` (supprimer `recentSalesAll`, `recentSales`, `mySalesAll`, `mySales`), `apps/frontend/src/App.tsx`
- Delete: `apps/frontend/src/features/marketplace/TransactionHistory.tsx`, `TransactionHistory.css`, `apps/frontend/src/__tests__/components/TransactionHistory.test.tsx`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces:

```ts
interface SalesHistoryProps {
  emptyMessage: string;
  /** Joueur connecté (undefined tant que le profil charge). */
  me: SalesPlayer | undefined;
  /** Filtre au premier affichage : mes ventes (onglet Vendre) ou tout le marché. */
  initialScope: "my-sales" | "market";
  /** Vente à mettre en avant : ouvre « Détails » d'office. */
  highlightSaleId?: number | null;
}
```

- `compactTiles(stats, t, lng, onBiggestClick: (saleId: number) => void): StatTileData[]` et `detailTiles(stats, scope, t, lng, onPartnerClick: (player: SalesPlayer) => void): StatTileData[]` dans `salesTiles.ts`.

- [ ] **Step 1: Test (échoue)**

```tsx
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SalesStats } from "@pipou/shared";
import i18n from "../../i18n";
import SalesHistory from "../../features/marketplace/sales-history/SalesHistory";
import {
  transactionService,
  type Transaction,
} from "../../services/transaction.service";

vi.mock("../../services/transaction.service", () => ({
  transactionService: { getSales: vi.fn(), getSalesStats: vi.fn() },
}));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

const ME = { id: 1, username: "moi" };

const STATS: SalesStats = {
  count: 3,
  totalGold: 780,
  unitsTraded: 6,
  avgUnitPrice: 130,
  minUnitPrice: 30,
  maxUnitPrice: 150,
  biggestSale: {
    id: 9,
    itemName: "Brigade de Combat",
    totalPrice: 750,
    quantity: 5,
    date: "2026-10-14T09:00:00.000Z",
  },
  topItem: { itemName: "Brigade de Combat", units: 5 },
  topPartner: { userId: 2, username: "bob", count: 2 },
  bestDay: { date: "2026-10-14", gold: 750 },
  trend: { last7: 780, previous7: 390, percent: 100 },
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 16 + i)).toISOString().slice(0, 10),
    gold: i === 28 ? 750 : 0,
  })),
};

const SALE = {
  id: 9,
  productId: 3,
  productType: "CARD",
  itemName: "Brigade de Combat",
  quantity: 5,
  unitPrice: 150,
  totalPrice: 750,
  status: "COMPLETED",
  seller: { id: 1, username: "moi" },
  buyer: { id: 2, username: "bob" },
  createdAt: "2026-10-14T09:00:00.000Z",
  updatedAt: "2026-10-14T09:00:00.000Z",
} as unknown as Transaction;

function renderHistory(props: Partial<Parameters<typeof SalesHistory>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SalesHistory emptyMessage="Rien" me={ME} initialScope="market" {...props} />
    </QueryClientProvider>,
  );
}

describe("SalesHistory", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.mocked(transactionService.getSalesStats).mockReset().mockResolvedValue(STATS);
    vi.mocked(transactionService.getSales)
      .mockReset()
      .mockResolvedValue({ data: [SALE], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } });
  });

  it("affiche les 4 stats clés et ne charge la liste qu'à l'ouverture des détails", async () => {
    renderHistory();
    expect(await screen.findByText("780 G")).toBeInTheDocument();
    expect(screen.getByText("130 G")).toBeInTheDocument();
    expect(transactionService.getSalesStats).toHaveBeenCalledWith({});
    expect(transactionService.getSales).not.toHaveBeenCalled();
    expect(screen.queryByText("Objet le plus vendu")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Détails" }));
    expect(await screen.findByText("Objet le plus vendu")).toBeInTheDocument();
    expect(transactionService.getSales).toHaveBeenCalledWith({}, "date");
    expect(await screen.findByText("+100 %")).toBeInTheDocument();
  });

  it("démarre sur mes ventes dans l'onglet Vendre", async () => {
    renderHistory({ initialScope: "my-sales" });
    await waitFor(() =>
      expect(transactionService.getSalesStats).toHaveBeenCalledWith({
        userId: 1,
        role: "seller",
      }),
    );
  });

  it("ouvre les détails sur la vente venue de l'inbox", async () => {
    renderHistory({ initialScope: "my-sales", highlightSaleId: 9 });
    const item = (await screen.findByText("Brigade de Combat", { selector: ".sales-list__name" })).closest("li");
    expect(item).toHaveClass("sales-list__item--highlight");
  });

  it("filtre sur un joueur au clic sur son pseudo", async () => {
    renderHistory({ highlightSaleId: 9 });
    await userEvent.click(
      await screen.findByRole("button", { name: "Voir les ventes de bob" }),
    );
    await waitFor(() =>
      expect(transactionService.getSalesStats).toHaveBeenLastCalledWith({
        userId: 2,
        role: "both",
      }),
    );
    expect(screen.getByRole("button", { name: "Retirer le filtre bob" })).toBeInTheDocument();
  });

  it("met en avant la plus grosse vente au clic sur sa tuile", async () => {
    renderHistory();
    await userEvent.click(await screen.findByRole("button", { name: /Plus grosse vente/ }));
    const item = (await screen.findByText("Brigade de Combat", { selector: ".sales-list__name" })).closest("li");
    expect(item).toHaveClass("sales-list__item--highlight");
  });
});
```

Run: `pnpm --filter @pipou/frontend test -- SalesHistory`
Expected: FAIL — module introuvable.

- [ ] **Step 2: `salesTiles.ts`**

```ts
import type { SalesStats } from "@pipou/shared";
import type { TFunction } from "i18next";
import type { StatTileData } from "./StatTiles";
import { formatGold, type SalesPlayer, type SalesScope } from "./salesScope";

const shortDate = (iso: string, lng: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(lng, {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });

/** Vue compacte : ventes, or total, prix moyen par unité, plus grosse vente. */
export function compactTiles(
  stats: SalesStats,
  t: TFunction,
  lng: string,
  onBiggestClick: (saleId: number) => void,
): StatTileData[] {
  const big = stats.biggestSale;
  return [
    { key: "count", label: t("marketplace.sales.tile_count"), value: stats.count },
    { key: "total", label: t("marketplace.sales.tile_total"), value: stats.totalGold, unit: " G" },
    { key: "avg", label: t("marketplace.sales.tile_avg"), value: stats.avgUnitPrice, unit: " G" },
    {
      key: "biggest",
      label: t("marketplace.sales.tile_biggest"),
      value: big?.totalPrice ?? null,
      unit: " G",
      caption: big ? `${big.itemName} · ${shortDate(big.date, lng)}` : undefined,
      onClick: big ? () => onBiggestClick(big.id) : undefined,
    },
  ];
}

/** Panneau « Détails » : les 6 autres stats (partenaire seulement pour un joueur). */
export function detailTiles(
  stats: SalesStats,
  scope: SalesScope,
  t: TFunction,
  lng: string,
  onPartnerClick: (player: SalesPlayer) => void,
): StatTileData[] {
  const { topItem, topPartner, bestDay, trend } = stats;
  const tiles: StatTileData[] = [
    {
      key: "top-item",
      label: t("marketplace.sales.tile_top_item"),
      value: null,
      text: topItem?.itemName,
      caption: topItem ? t("marketplace.sales.units_suffix", { count: topItem.units }) : undefined,
    },
  ];
  if (scope.kind === "player") {
    tiles.push({
      key: "partner",
      label: t("marketplace.sales.tile_partner"),
      value: null,
      text: topPartner?.username,
      caption: topPartner
        ? t("marketplace.sales.partner_count", { count: topPartner.count })
        : undefined,
      onClick: topPartner
        ? () => onPartnerClick({ id: topPartner.userId, username: topPartner.username })
        : undefined,
    });
  }
  tiles.push(
    {
      key: "best-day",
      label: t("marketplace.sales.tile_best_day"),
      value: bestDay?.gold ?? null,
      unit: " G",
      caption: bestDay ? shortDate(bestDay.date, lng) : undefined,
    },
    {
      key: "range",
      label: t("marketplace.sales.tile_range"),
      value: null,
      text:
        stats.minUnitPrice !== null && stats.maxUnitPrice !== null
          ? `${stats.minUnitPrice}–${formatGold(stats.maxUnitPrice)}`
          : undefined,
    },
    { key: "units", label: t("marketplace.sales.tile_units"), value: stats.unitsTraded },
    {
      key: "trend",
      label: t("marketplace.sales.tile_trend"),
      value: null,
      text:
        trend.percent === null
          ? undefined
          : `${trend.percent > 0 ? "+" : ""}${trend.percent} %`,
      tone:
        trend.percent === null || trend.percent === 0
          ? undefined
          : trend.percent > 0
            ? "up"
            : "down",
      caption: formatGold(trend.last7),
    },
  );
  return tiles;
}
```

- [ ] **Step 3: `SalesHistory.tsx`**

```tsx
import { useState } from "react";
import type { SaleSort } from "@pipou/shared";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ContentLoader from "react-content-loader";
import { useTranslation } from "react-i18next";
import Button from "../../../components/Button";
import { transactionService } from "../../../services/transaction.service";
import { QUERY_KEYS } from "../../../utils/querykeys";
import { apiErrorMessage } from "../../../utils/errors";
import GoldChart from "./GoldChart";
import SalesFilterBar from "./SalesFilterBar";
import SalesList from "./SalesList";
import StatTiles from "./StatTiles";
import { compactTiles, detailTiles } from "./salesTiles";
import {
  MARKET_SCOPE,
  scopeToFilter,
  type SalesPlayer,
  type SalesScope,
} from "./salesScope";
import "./SalesHistory.css";

interface SalesHistoryProps {
  emptyMessage: string;
  /** Joueur connecté (undefined tant que le profil charge). */
  me: SalesPlayer | undefined;
  /** Filtre au premier affichage : mes ventes (onglet Vendre) ou tout le marché. */
  initialScope: "my-sales" | "market";
  /** Vente à mettre en avant : ouvre « Détails » d'office. */
  highlightSaleId?: number | null;
}

function defaultScope(
  initialScope: SalesHistoryProps["initialScope"],
  me: SalesPlayer | undefined,
): SalesScope | null {
  if (initialScope === "market") return MARKET_SCOPE;
  // Mes ventes : il faut attendre le profil
  return me ? { kind: "player", player: me, role: "seller" } : null;
}

const SalesHistory = ({
  emptyMessage,
  me,
  initialScope,
  highlightSaleId,
}: SalesHistoryProps) => {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  // null = valeurs par défaut, dérivées des props
  const [chosenScope, setChosenScope] = useState<SalesScope | null>(null);
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(null);
  const [pickedHighlight, setPickedHighlight] = useState<number | null>(null);
  const [sort, setSort] = useState<SaleSort>("date");

  const scope = chosenScope ?? defaultScope(initialScope, me);
  const filter = scope ? scopeToFilter(scope) : null;
  const highlight = pickedHighlight ?? highlightSaleId ?? null;
  const open = chosenOpen ?? highlight !== null;

  const stats = useQuery({
    queryKey: QUERY_KEYS.salesStats(filter ?? {}),
    queryFn: () => transactionService.getSalesStats(filter!),
    enabled: filter !== null,
  });
  const list = useQuery({
    queryKey: QUERY_KEYS.salesList(filter ?? {}, sort),
    queryFn: () => transactionService.getSales(filter!, sort),
    enabled: filter !== null && open,
  });

  const selectPlayer = (player: SalesPlayer) => {
    setChosenScope({ kind: "player", player, role: "both" });
    setPickedHighlight(null);
  };
  const changeScope = (next: SalesScope) => {
    setChosenScope(next);
    setPickedHighlight(null);
  };
  const showSale = (saleId: number) => {
    setPickedHighlight(saleId);
    setChosenOpen(true);
  };

  if (!scope || stats.isPending) {
    return (
      <ContentLoader
        className="sales-history__skeleton"
        viewBox="0 0 400 260"
        backgroundColor="#ead7c4"
        foregroundColor="#f5e6d0"
      >
        <rect x="0" y="0" rx="14" ry="14" width="196" height="64" />
        <rect x="204" y="0" rx="14" ry="14" width="196" height="64" />
        <rect x="0" y="72" rx="14" ry="14" width="196" height="64" />
        <rect x="204" y="72" rx="14" ry="14" width="196" height="64" />
        <rect x="0" y="146" rx="14" ry="14" width="400" height="114" />
      </ContentLoader>
    );
  }

  const errorMessage = stats.isError ? apiErrorMessage(stats.error) : null;

  return (
    <section className="sales-history">
      <SalesFilterBar scope={scope} me={me} onChange={changeScope} />

      {stats.isError ? (
        <p className="sales-history__error" role="alert">
          {errorMessage
            ? t("marketplace.sales.error", { message: errorMessage })
            : t("marketplace.sales.error_default")}
        </p>
      ) : (
        <>
          <StatTiles tiles={compactTiles(stats.data, t, i18n.language, showSale)} />
          <GoldChart daily={stats.data.daily} bestDay={stats.data.bestDay} />
        </>
      )}

      <Button
        variant="ghost-bordeaux"
        fullWidth
        aria-expanded={open}
        onClick={() => setChosenOpen(!open)}
      >
        {open ? t("marketplace.sales.details_close") : t("marketplace.sales.details_open")}
        <span className={`sales-history__chevron${open ? " sales-history__chevron--open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            className="sales-history__details"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {stats.data && (
              <StatTiles
                tiles={detailTiles(stats.data, scope, t, i18n.language, selectPlayer)}
              />
            )}
            <SalesList
              key={highlight ?? "none"}
              history={list.data?.data}
              emptyMessage={list.isPending ? "…" : emptyMessage}
              sort={sort}
              onSortChange={setSort}
              highlightId={highlight}
              viewerId={me?.id}
              onPlayerClick={selectPlayer}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default SalesHistory;
```

Si `Button` ne transmet pas `aria-expanded` (il transmet les props natives), rien à changer. Si `fullWidth` n'existe pas sous ce nom, vérifier `components/Button.tsx` (il existe : `fullWidth?: boolean`).

- [ ] **Step 4: `SalesHistory.css`**

```css
.sales-history {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.sales-history__details {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  overflow: hidden;
}

.sales-history__chevron {
  display: inline-block;
  margin-left: 0.4rem;
  transition: transform 0.2s ease;
}
.sales-history__chevron--open {
  transform: rotate(180deg);
}

.sales-history__error {
  margin: 0;
  padding: 1rem;
  border-radius: 14px;
  text-align: center;
  background: rgba(122, 28, 59, 0.08);
  color: #7a1c3b;
}

.sales-history__skeleton {
  width: 100%;
  height: auto;
}

@media (prefers-reduced-motion: reduce) {
  .sales-history__chevron {
    transition: none;
  }
}
```

- [ ] **Step 5: Vérifier le composant**

Run: `pnpm --filter @pipou/frontend test -- SalesHistory`
Expected: PASS (5 tests).

- [ ] **Step 6: Brancher `SellTab`**

- Supprimer les imports `SaleSort` (si plus utilisé) et `TransactionHistory` ; importer `SalesHistory` et `type SalesPlayer` :

```ts
import SalesHistory from "./sales-history/SalesHistory";
import type { SalesPlayer } from "./sales-history/salesScope";
```

- Dans `SellTabProps`, remplacer `userSellHistory`, `historySort`, `onHistorySortChange` par :

```ts
  me: SalesPlayer | undefined;
```

(garder `highlightSaleId`), et mettre à jour la destructuration.
- Remplacer le bloc `<TransactionHistory … />` par :

```tsx
      <SalesHistory
        emptyMessage={t("marketplace.sell.history_empty")}
        me={me}
        initialScope="my-sales"
        highlightSaleId={highlightSaleId}
      />
```

- [ ] **Step 7: Brancher `BuyTab`**

Même chose : remplacer `buyHistory`, `historySort`, `onHistorySortChange` par `me: SalesPlayer | undefined;` et le bloc `<TransactionHistory … />` par :

```tsx
      <SalesHistory
        emptyMessage={t("marketplace.buy.history_empty")}
        me={me}
        initialScope="market"
      />
```

- [ ] **Step 8: Nettoyer `Marketplace.tsx`**

- Supprimer les états `recentSalesSort` / `mySalesSort` et les deux `useQuery` `recentSalesData` / `mySalesData` ; supprimer l'import `SaleSort` s'il n'est plus utilisé.
- Ajouter la lecture du profil (même clé et même fonction que `App.tsx` ; vérifier `App.tsx:74-77` et reprendre exactement son `queryFn`) :

```ts
  const { data: profile } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
  });
  const me = profile ? { id: profile.id, username: profile.username } : undefined;
```

- `SellTab` : retirer `userSellHistory`, `historySort`, `onHistorySortChange` ; ajouter `me={me}`.
- `BuyTab` : retirer `buyHistory`, `historySort`, `onHistorySortChange` ; ajouter `me={me}`.
- Dans `handleBuyListing`, supprimer la ligne `recentSalesAll` (garder `salesAll`).

- [ ] **Step 9: Supprimer l'ancien code**

- `App.tsx` : supprimer les invalidations `mySalesAll` et `recentSalesAll` (garder `salesAll`).
- `utils/querykeys.ts` : supprimer `recentSalesAll`, `recentSales`, `mySalesAll`, `mySales` et leur commentaire.
- `services/transaction.service.ts` : supprimer `getHistory` et `getRecentSales` ; retirer `HistoryQuery` de l'import s'il n'est plus utilisé.
- Supprimer les fichiers :

```bash
git rm apps/frontend/src/features/marketplace/TransactionHistory.tsx apps/frontend/src/features/marketplace/TransactionHistory.css apps/frontend/src/__tests__/components/TransactionHistory.test.tsx
```

- Vérifier qu'il ne reste aucune référence :

Run: `git grep -n "TransactionHistory\|recentSalesAll\|mySalesAll\|getRecentSales\|getHistory" -- apps/frontend`
Expected: aucune ligne.

- [ ] **Step 10: Suite front complète**

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend lint`
Expected: tout passe.

- [ ] **Step 11: Commit**

```bash
git add -A apps/frontend
git commit -m "feat(marketplace): sales history with stats, 30-day chart and details panel"
```

---

### Task 11: Vérification finale et contrôle visuel

**Files:** aucun nouveau (corrections éventuelles seulement).

- [ ] **Step 1: Vérifications du monorepo**

Run: `pnpm build:shared && pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected: tout passe. Noter toute sortie en échec telle quelle.

- [ ] **Step 2: Lancer le stack local (jamais Aiven)**

Run (en arrière-plan) : `pnpm dev:local`
Se connecter avec un compte de la copie locale qui a des ventes conclues.

- [ ] **Step 3: Captures Playwright à 430 px (thème clair)**

Suivre la procédure de la mémoire « Front visual check » (shell 430 px clair, relais IPv6 pour l'API locale). Capturer :
1. `/marketplace?tab=buy` — vue compacte (4 tuiles + graphique + bouton Détails).
2. Même page après clic sur « Détails » — 6 tuiles, tri, liste avec bandes de couleur.
3. `/marketplace?tab=buy` après clic sur un pseudo — puce `✕ <pseudo>`, rôles, tuile Partenaire favori.
4. `/marketplace?tab=sell&sale=<id d'une de mes ventes>` — Détails ouvert, ligne bordeaux à bordure dorée.

Vérifier sur chaque capture : pas de débordement horizontal, valeurs lisibles, couronne sur la bonne barre, la mise en avant n'est plus beige.

- [ ] **Step 4: Corriger et committer si besoin**

Pour chaque défaut visuel : corriger le CSS concerné, relancer `pnpm --filter @pipou/frontend test`, recapturer, puis :

```bash
git add apps/frontend/src/features/marketplace/sales-history
git commit -m "style(marketplace): polish sales history at mobile width"
```

- [ ] **Step 5: Arrêter le stack et rendre la main**

Arrêter `pnpm dev:local`. Joindre les captures et le résultat des commandes du Step 1 au compte rendu.
