# Historique des ventes : graphique, stats et filtres — design

Date : 2026-10-15 · Branche : `buy-sell-order-metric`

## Objectif

Remplacer la liste brute « Historique des ventes » (onglets Vendre et Acheter du marketplace) par un bloc plus vivant :
stats clés, graphique de l'or échangé sur 30 jours, filtre par joueur, et un bouton « Détails » qui déplie la liste
complète. Refaire au passage le visuel des lignes et l'effet de mise en avant d'une vente ouverte depuis l'inbox
(le fond beige actuel détonne avec les lignes bordeaux).

## Hors périmètre

- Recherche de joueur par pseudo (pas d'endpoint public de recherche ; le joueur se choisit par clic).
- Table de stats pré-calculées.
- Sélecteur de période du graphique (fixé à 30 jours).

## Contrat partagé (`@pipou/shared`)

Dans `packages/shared/src/api/pagination.ts` :

```ts
export type SaleRole = "seller" | "buyer" | "both";

export interface SalesFilter {
  /** Absent = tout le marché. */
  userId?: number;
  /** Ignoré sans userId. Défaut "both". */
  role?: SaleRole;
}

export interface HistoryQuery extends PaginationQuery, SalesFilter { sort?: SaleSort }
export interface RecentSalesQuery extends PaginationQuery, SalesFilter { sort?: SaleSort }
```

`HistoryQuery.role` accepte désormais aussi `"both"` ; `"seller"` et `"buyer"` gardent leur sens actuel.

Nouveau fichier `packages/shared/src/api/sales-stats.ts` (exporté depuis l'index) :

```ts
export interface SalesStats {
  count: number;              // transactions COMPLETED
  totalGold: number;          // SUM(total_price)
  unitsTraded: number;        // SUM(quantity)
  avgUnitPrice: number | null; // totalGold / unitsTraded, arrondi à l'entier
  minUnitPrice: number | null; // MIN(unit_price)
  maxUnitPrice: number | null; // MAX(unit_price)
  biggestSale: { id: number; itemName: string; totalPrice: number; quantity: number; date: string } | null;
  topItem: { itemName: string; units: number } | null;
  /** Joueur avec qui le joueur filtré a le plus échangé. null sans userId. */
  topPartner: { userId: number; username: string; count: number } | null;
  /** Jour le plus riche sur les 30 derniers jours. null si aucun or échangé. */
  bestDay: { date: string; gold: number } | null;
  /** Or des 7 derniers jours vs les 7 précédents. percent null si previous7 = 0. */
  trend: { last7: number; previous7: number; percent: number | null };
  /** Exactement 30 entrées, de J-29 à aujourd'hui, jours vides à 0. date = "YYYY-MM-DD". */
  daily: { date: string; gold: number }[];
}
```

Le prix moyen est **par unité** et pondéré : une vente ×5 pour 750 G pèse 5 unités à 150 G.

## Backend (`apps/backend/src/transactions`)

### Endpoint

`GET /transactions/stats` — `JwtAuthGuard`, query validée par `SalesStatsQueryDto implements SalesFilter`
(`userId` : `@IsOptional @Type(() => Number) @IsInt @Min(1)` ; `role` : `@IsOptional @IsIn(['seller','buyer','both'])`).
Renvoie `SalesStats`.

`HistoryQueryDto` et `RecentSalesQueryDto` gagnent `userId` et acceptent `role: 'both'`.
`GET /transactions/history` conserve son comportement (utilisateur connecté) quand `userId` est absent.

### `TransactionStatsService` (nouveau fichier `transaction-stats.service.ts`)

Service séparé pour ne pas alourdir `transactions.service.ts`.

- `salesFilterWhere(filter)` — fonction exportée, source unique du filtre, retournant les conditions TypeORM
  (`status = COMPLETED` + seller/buyer selon `role`, ou tout le marché sans `userId`).
  Réutilisée par `getUserHistory` et `getRecentSales`.
- `getStats(filter): Promise<SalesStats>` — requêtes QueryBuilder :
  1. agrégat global : `COUNT(*)`, `SUM(total_price)`, `SUM(quantity)`, `MIN/MAX(unit_price)` ;
  2. or par jour : `DATE(updated_at)`, `SUM(total_price)` sur les 30 derniers jours → remplissage des jours vides
     en JS, puis `bestDay` et `trend` dérivés de cette série ;
  3. plus grosse vente : `ORDER BY total_price DESC, updated_at DESC LIMIT 1` ;
  4. top objet : `GROUP BY item_name ORDER BY SUM(quantity) DESC LIMIT 1` ;
  5. top partenaire (si `userId`) : contrepartie (`buyer` quand le joueur vend, `seller` quand il achète),
     `GROUP BY` contrepartie `ORDER BY COUNT(*) DESC LIMIT 1`.
- Les sommes BIGINT reviennent en chaîne de MySQL : conversion explicite en `number`.
- Les dates sont celles de `updated_at` (moment de la vente), en UTC.

Aucune migration.

### Tests

- `transaction-stats.service.spec.ts` : filtre tout le marché / moi vendeur / joueur acheteur / both ;
  `daily` toujours de 30 entrées avec zéros ; `bestDay` ; `trend.percent` null quand `previous7 = 0` ;
  historique vide → compteurs à 0 et champs objet à `null` ; `topPartner` null sans `userId` ;
  moyenne pondérée par unité.
- Specs DTO : `userId` invalide rejeté, `role: 'both'` accepté, rôle inconnu rejeté.

## Frontend (`apps/frontend/src/features/marketplace/sales-history/`)

### Composants (un par fichier, aucun composant déclaré dans un autre)

| Fichier | Rôle |
|---|---|
| `SalesHistory.tsx` | Bloc complet : filtre, tuiles, graphique, « Détails ». Remplace `TransactionHistory` dans `SellTab` et `BuyTab`. |
| `SalesFilterBar.tsx` | Puces `Tout le marché` · `Moi` · `✕ <pseudo>`, puis `Vendeur / Acheteur / Les deux` quand un joueur (ou Moi) est choisi. |
| `StatTiles.tsx` | Grille de tuiles ; reçoit la liste des tuiles à afficher. |
| `GoldChart.tsx` | Barres SVG maison sur `daily`. |
| `SalesList.tsx` | Tri date/prix + liste paginée + mise en avant (reprise de `TransactionHistory.tsx`). |

`TransactionHistory.tsx`, son CSS et son test sont supprimés ; le test est migré vers `SalesList`.

### Données

- TanStack Query uniquement ; nouvelles clés dans `utils/querykeys.ts` :
  `QUERY_KEYS.salesStats(filter)` et `QUERY_KEYS.salesHistory(filter, sort, page)`.
- `transaction.service.ts` : `getSalesStats(filter)` ; `getHistory` / `getRecentSales` acceptent le filtre.
- Achat, vente, annulation : invalident aussi `salesStats`.
- La liste « Détails » n'est chargée qu'une fois le panneau ouvert.

### Comportement

- Filtre par défaut : onglet Vendre → `{ userId: moi, role: "seller" }` ; onglet Acheter → tout le marché.
- Toucher un pseudo (liste, tuile « Partenaire favori ») sélectionne ce joueur, rôle `both`.
- Vue compacte : 4 tuiles (Ventes, Or total, Prix moyen/u, Plus grosse vente) → graphique → bouton « Détails ▾ ».
- « Détails » se déplie sur place (`framer-motion`, hauteur) : 6 tuiles (Objet le plus vendu, Partenaire favori —
  masquée sans joueur, Meilleur jour, Fourchette min–max/u, Unités échangées, Tendance ↑↓) → tri → liste paginée.
- Tuile « Plus grosse vente » cliquable : ouvre Détails et met la vente en avant.
- Lien inbox `?tab=sell&sale=123` : filtre par défaut de l'onglet Vendre, Détails ouvert d'office sur la page de la vente.

### Visuel

- Tuiles : fond bordeaux `#7a1c3b`, libellé crème, valeur or `#e0b44c` avec compteur animé de 0 à la valeur.
- Graphique : barres or à coins arrondis, apparition en cascade depuis le bas ; barre du meilleur jour plus vive
  avec 👑 ; toucher une barre → bulle date + montant ; jour vide = trait fin ; axe réduit à trois repères (J-29, J-15, aujourd'hui).
  Lisible à 430 px.
- Lignes : bordeaux, bande gauche colorée selon le point de vue (vert = j'ai vendu, bleu = j'ai acheté, neutre sinon),
  prix unitaire en petit sous le total (`150 G/u`), pseudos cliquables.
- Mise en avant : la ligne reste bordeaux, bordure dorée en dégradé conique qui tourne une fois + léger halo or
  (remplace le fond beige + reflet du commit `e97258b`).
- `prefers-reduced-motion` : pas de compteur, de cascade ni de rotation de bordure.

### États et i18n

- Chargement : squelette `react-content-loader`.
- Zéro vente : tuiles à « — », graphique remplacé par le message vide actuel.
- Erreur : `apiErrorMessage(error)`.
- Tous les libellés en fr, en, ko.

### Tests

- `GoldChart` : hauteurs proportionnelles, couronne sur le meilleur jour, bulle au toucher.
- `StatTiles` : valeurs formatées, « — » quand null.
- `SalesFilterBar` : clic sur un pseudo → filtre joueur ; puces de rôle visibles seulement avec un joueur.
- `SalesHistory` : `?sale=` ouvre Détails ; Détails ne charge la liste qu'à l'ouverture.
- Vérification visuelle Playwright à 430 px (thème clair) avant livraison.

## Vérification finale

`pnpm build:shared`, puis `pnpm typecheck`, `pnpm test`, `pnpm lint`. Tests backend sur la copie MySQL locale
(`pnpm dev:local`), jamais sur Aiven.
