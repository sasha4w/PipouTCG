# Forge et poussière Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de forger 10 copies en une carte de rareté supérieure ou de détruire des copies en poussière, avec compteurs, succès, quêtes et stats de profil.

**Architecture:** Un module Nest `forge` (service, contrôleur, règles pures) agit sur `UserCard` en transaction, en protégeant les copies utilisées par les decks. Les constantes et types vivent dans `@pipou/shared`. Les compteurs sur `User` alimentent succès, stats du profil et quêtes (événements Nest) selon le même schéma que `cardsSold`. Le front ajoute un service TanStack Query et une UI « Forger / Détruire » dans la collection.

**Tech Stack:** NestJS 11, TypeORM (MySQL), Jest ; React 18, TanStack Query, Vitest, i18next ; `@pipou/shared` (vitest).

**Spec:** `docs/superpowers/specs/2026-10-25-forge-poussiere-design.md`

## Global Constraints

- Branche `dev` (jamais `main`). Commits en français, préfixe `feat(...)` / `test(...)`, terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Tout type ou enum échangé front/back vit dans `@pipou/shared` ; après modification : `pnpm build:shared`.
- Coûts de forge : commune 10, peu commune 10, rare 10, épique 15 ; légendaire et secrète non forgeables.
- Poussière par copie détruite : commune 1, peu commune 3, rare 10, épique 30, légendaire 100, secrète 300.
- Forge : 10/15 copies de **même rareté et même set** (cartes différentes autorisées) → n'importe quelle carte de la rareté au-dessus dans ce set, même non possédée. Jamais de cible `requiresAllElements(card.effects)` ni de carte sans set.
- Copies protégées d'une carte = max des quantités de cette carte dans **un seul** deck ; seul le surplus est utilisable.
- Poussière : colonne `user.dust`, non échangeable, gagnée uniquement par destruction.
- Compteurs `cardsForged` (cartes obtenues), `cardsDestroyed` (copies détruites), `dustEarned` (cumul).
- UI : icônes SVG de `components/Icons.tsx`, jamais d'emoji ; textes via i18n (fr, en, ko) ; données serveur via TanStack Query avec clés dans `QUERY_KEYS`.
- Le schéma de prod passe par des migrations TypeORM (`apps/backend/src/database/migrations`, `synchronize` seulement en local).

## Review Focus

- Même `cardId` répété dans l'entrée d'une forge : les quantités s'additionnent et le total utilisable est vérifié sur la somme.
- `quantity` nulle, négative ou non entière, ou liste d'entrée vide : 400, rien n'est modifié.
- Carte dont toutes les copies sont dans un deck (`owned == protected`) : utilisable = 0, forge et destruction refusées.
- Double envoi simultané de la même forge : le second échoue sans quantité négative (verrou sur les lignes `user_card`).
- Cible hors du set des entrées, mauvaise rareté, carte d'aventure (`requiresAllElements`) ou sans set : 400.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `packages/shared/src/game/forge.ts` (créer) | `FORGE_COST`, `DUST_VALUE`, `nextForgeRarity`, `isForgeable` |
| `packages/shared/src/api/forge.ts` (créer) | types des corps et réponses de l'API forge |
| `apps/backend/src/database/migrations/1791000000016-ForgeDust.ts` (créer) | colonnes `dust`, `cards_forged`, `cards_destroyed`, `dust_earned` |
| `apps/backend/src/forge/forge-rules.ts` (créer) | validation pure de la forge |
| `apps/backend/src/forge/forge.service.ts` (créer) | forge, destruction, quantités utilisables |
| `apps/backend/src/forge/forge.controller.ts`, `forge.module.ts`, `dto/*.ts` (créer) | routes et DTO |
| `apps/frontend/src/services/forge.service.ts` (créer) | appels API |
| `apps/frontend/src/features/forge/` (créer) | `ForgeDialog.tsx`, `DestroyDialog.tsx`, tests |

---

### Task 1: Constantes et types partagés

**Files:**
- Create: `packages/shared/src/game/forge.ts`, `packages/shared/src/game/forge.test.ts`, `packages/shared/src/api/forge.ts`
- Modify: `packages/shared/src/game/index.ts`, `packages/shared/src/api/index.ts`

**Interfaces:**
- Produces:
  - `FORGE_COST: Partial<Record<Rarity, number>>` (clés common, uncommon, rare, epic).
  - `DUST_VALUE: Record<Rarity, number>`.
  - `isForgeable(rarity: Rarity): boolean`.
  - `nextForgeRarity(rarity: Rarity): Rarity | null` (`null` si non forgeable).
  - `ForgeInput { cardId: number; quantity: number }`.
  - `ForgeRequest { inputs: ForgeInput[]; targetCardId: number }`.
  - `ForgeResponse { targetCardId: number; dust: number }`.
  - `DestroyRequest { cardId: number; quantity: number }`.
  - `DestroyResponse { dustGained: number; dust: number }`.
  - `UsableCard { cardId: number; owned: number; usable: number }`.

- [ ] **Step 1: Write the failing test** in `forge.test.ts` (vitest, même style que `rules.test.ts`) :
  - `FORGE_COST` vaut 10, 10, 10, 15 pour common, uncommon, rare, epic, et n'a pas de clé `legendary` ni `secret`.
  - `DUST_VALUE` vaut 1, 3, 10, 30, 100, 300 dans l'ordre des raretés.
  - `nextForgeRarity("epic")` vaut `"legendary"`, `nextForgeRarity("legendary")` et `nextForgeRarity("secret")` valent `null`, `nextForgeRarity("common")` vaut `"uncommon"`.
- [ ] **Step 2: Run** `pnpm --filter @pipou/shared test` ; attendu : FAIL (module absent).
- [ ] **Step 3: Implement** `forge.ts` (rangs via `RARITY_RANK`, pas de liste en dur des paliers suivants) et `api/forge.ts` avec les types ci-dessus ; les exporter dans les deux `index.ts`.
- [ ] **Step 4: Run** `pnpm --filter @pipou/shared test` puis `pnpm build:shared` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(shared): constantes et types de la forge`.

---

### Task 2: Colonnes, migration et règles de forge pures

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000016-ForgeDust.ts`, `apps/backend/src/forge/forge-rules.ts`, `apps/backend/src/forge/forge-rules.spec.ts`
- Modify: `apps/backend/src/users/user.entity.ts`

**Interfaces:**
- Consumes: `FORGE_COST`, `nextForgeRarity`, `Rarity` (Task 1) ; `requiresAllElements` de `@pipou/shared`.
- Produces:
  - `User.dust: number` (bigint, défaut 0), `User.cardsForged: number`, `User.cardsDestroyed: number`, `User.dustEarned: number` (bigint). Colonnes `dust`, `cards_forged`, `cards_destroyed`, `dust_earned`.
  - `interface ForgeCardInfo { id: number; rarity: Rarity; setId: number | null; effects: CardEffect[] | null }`.
  - `validateForge(inputs: { card: ForgeCardInfo; quantity: number; usable: number }[], target: ForgeCardInfo): string | null` : message d'erreur ou `null`.

- [ ] **Step 1: Write the failing tests** dans `forge-rules.spec.ts`. Chacun construit des entrées minimales ; `validateForge` doit renvoyer :
  - `null` pour 10 communes (5 + 5 de deux cartes) du set 1 et une cible peu commune du set 1.
  - une erreur si le total ≠ coût (9 et 11 communes).
  - une erreur si les entrées mélangent deux raretés ou deux sets.
  - une erreur si `usable < quantity` pour une entrée.
  - une erreur pour une `quantity` ≤ 0 ou non entière, ou une liste vide.
  - une erreur si la cible n'est pas exactement une rareté au-dessus, est d'un autre set, a `setId` nul, ou a des `effects` pour lesquels `requiresAllElements` est vrai.
  - une erreur pour des entrées légendaires (non forgeables).
  - deux entrées avec le même `card.id` sont additionnées pour le contrôle de `usable` (ex. deux lignes de 6 pour une carte avec `usable` 10 → erreur).
- [ ] **Step 2: Run** `pnpm --filter @pipou/backend test -- forge-rules` ; attendu : FAIL.
- [ ] **Step 3: Implement** `validateForge(...)` dans `forge-rules.ts`. Fonction pure, messages en français comme `deck-rules.ts`.
- [ ] **Step 4: Add** les quatre colonnes à `user.entity.ts` (même style que `cardsSold`, noms de colonnes snake_case explicites), et écrire la migration `ForgeDust1791000000016` : `ALTER TABLE user ADD` des quatre colonnes (`dust` et `dust_earned` en `bigint NOT NULL DEFAULT 0`, les deux autres en `int NOT NULL DEFAULT 0`), `down` les supprime. Copier la structure de `AncestralStage1791000000011`.
- [ ] **Step 5: Run** `pnpm --filter @pipou/backend test -- forge-rules` et `pnpm --filter @pipou/backend typecheck` ; attendu : PASS.
- [ ] **Step 6: Commit** `feat(forge): règles de forge et colonnes de poussière`.

---

### Task 3: Service, contrôleur et événements

**Files:**
- Create: `apps/backend/src/forge/forge.service.ts`, `forge.service.spec.ts`, `forge.controller.ts`, `forge.module.ts`, `dto/forge.dto.ts`, `dto/destroy.dto.ts`
- Modify: `apps/backend/src/app.module.ts` (importer `ForgeModule`)

**Interfaces:**
- Consumes: `validateForge`, `ForgeCardInfo` (Task 2) ; `DUST_VALUE`, `ForgeRequest`, `ForgeResponse`, `DestroyRequest`, `DestroyResponse`, `UsableCard` (Task 1) ; `User`, `UserCard`, `Card`, `DeckCard`.
- Produces:
  - `ForgeService.listUsable(userId: number): Promise<UsableCard[]>`.
  - `ForgeService.forge(userId: number, req: ForgeRequest): Promise<ForgeResponse>`.
  - `ForgeService.destroy(userId: number, req: DestroyRequest): Promise<DestroyResponse>`.
  - Routes (`JwtAuthGuard`, `req.user.userId`) : `GET /forge/usable`, `POST /forge`, `POST /forge/destroy`.
  - Événements émis après la transaction : `forge.done` `{ userId: number; amount: number }`, `destroy.done` `{ userId: number; amount: number }`, et `card.set.check` `{ userId: number; setId: number }` après une forge (une forge peut compléter un set).

- [ ] **Step 1: Write the failing tests** (`forge.service.spec.ts`, mocks du même style que `transactions.service.spec.ts`, avec `mockDataSource.transaction` qui exécute le callback) :
  - `listUsable` : une carte possédée 5 fois, présente 3 fois dans un deck A et 2 dans un deck B → `usable` 2 ; une carte possédée 3 fois et utilisée 3 fois dans un deck → `usable` 0.
  - `forge` réussie : les `UserCard` d'entrée sont décrémentés, la cible est créée si absente (`quantity` 1) ou incrémentée, `user.cardsForged` augmente de 1, les événements `forge.done` (amount 1) et `card.set.check` sont émis.
  - `forge` : si une entrée dépasse `usable`, `BadRequestException` et aucun `save`.
  - `destroy` de 4 communes → `dustGained` 4, `quantity` décrémentée, `user.dust` et `user.dustEarned` +4, `cardsDestroyed` +4, événement `destroy.done` (amount 4).
  - `destroy` d'une quantité supérieure à `usable` → `BadRequestException`.
- [ ] **Step 2: Run** `pnpm --filter @pipou/backend test -- forge.service` ; attendu : FAIL.
- [ ] **Step 3: Implement** `ForgeService`. Les quantités protégées viennent de `SELECT dc.user_card_id, MAX(dc.quantity) FROM deck_card dc JOIN deck d ON d.id = dc.deck_id WHERE d.user_id = ? GROUP BY dc.user_card_id` (index unique `deck_id, user_card_id` : une ligne par deck). Dans `forge` et `destroy` : transaction, `UserCard` verrouillés en `pessimistic_write` triés par `id`, `usable = quantity − protégé` recalculé sous verrou, `UserCard` à quantité 0 conservé (comme la place de marché). Mises à jour des compteurs via `manager.increment` sur `User`. Cibles : charger `Card` avec `cardSet` et appliquer `validateForge`.
- [ ] **Step 4: Implement** DTO (`class-validator` : tableau non vide d'entiers ≥ 1, `@Type`, mêmes conventions que `create-listing.dto.ts`), contrôleur et module, puis enregistrer le module dans `app.module.ts`.
- [ ] **Step 5: Run** `pnpm --filter @pipou/backend test` et `typecheck` ; attendu : PASS.
- [ ] **Step 6: Commit** `feat(forge): forge, destruction et routes API`.

---

### Task 4: Succès, quêtes, stats de profil et solde

Cette tâche modifie `@pipou/shared`, le back et le front d'un bloc parce que `Record<AchievementFamily, …>` rend le typecheck rouge tant que tous les endroits ne sont pas mis à jour.

**Files:**
- Modify: `packages/shared/src/enums/achievement.ts`, `packages/shared/src/game/achievements.ts`, `packages/shared/src/game/achievements.test.ts`, `packages/shared/src/enums/quest.ts`
- Modify: `apps/backend/src/achievements/achievement-values.ts`, `achievement-values.spec.ts`, `achievement-stats.service.ts`, `apps/backend/src/quests/quests.service.ts`, `quest-pool.ts`, `apps/backend/src/users/users.service.ts`
- Modify: `apps/frontend/src/features/achievements/achievementIcons.ts`, `apps/frontend/src/features/profile/StatsPanel.tsx`, `apps/frontend/src/services/user.service.ts`, `apps/frontend/src/components/Icons.tsx`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`

**Interfaces:**
- Consumes: colonnes `User.cardsForged/cardsDestroyed/dustEarned/dust` (Task 2), événements `forge.done` et `destroy.done` (Task 3).
- Produces:
  - `AchievementFamily.CARDS_FORGED`, `AchievementFamily.CARDS_DESTROYED` ; `QuestConditionType.FORGE_CARD`, `QuestConditionType.DESTROY_CARD`.
  - `AchievementSources.user` gagne `cardsForged: number` et `cardsDestroyed: number`.
  - `UserProfile.stats` (front et back) gagne `cardsForged`, `cardsDestroyed`, `dustEarned` (nombres) ; `UserMe` et `GET /users/me` gagnent `dust: number`.
  - `IconForge` et `IconDust` dans `Icons.tsx` (SVG, même signature `{ size?, color? }` que les autres).

- [ ] **Step 1: Write the failing tests** :
  - `achievements.test.ts` (shared) : `ACHIEVEMENTS` contient `CARDS_FORGED` (seuils 1 / 10 / 50) et `CARDS_DESTROYED` (seuils 10 / 100 / 500).
  - `achievement-values.spec.ts` : `toAchievementValues` renvoie `cardsForged` et `cardsDestroyed` de l'utilisateur pour les deux nouvelles familles.
  - `quests.service.spec.ts` : l'événement `forge.done` `{ userId, amount: 2 }` appelle `track` avec `FORGE_CARD` et `amount: 2` ; idem `destroy.done` avec `DESTROY_CARD` (même style que les tests existants de `market.card.sold`).
  - `quest-pool.seeder.spec.ts` doit rester vert : il compare à `QUEST_POOL.length`, donc rien à changer s'il est déjà dynamique.
- [ ] **Step 2: Run** les trois suites ; attendu : FAIL.
- [ ] **Step 3: Implement** : enums, entrées `ACHIEVEMENTS` (`tiers(1, 10, 50)` et `tiers(10, 100, 500)` : seuils choisis par le plan, à ajuster), `toAchievementValues`, sélection des colonnes dans `achievement-stats.service.ts`, deux `@OnEvent` dans `quests.service.ts` (`forge.done`, `destroy.done`), deux quêtes dans `QUEST_POOL` (`weekly('w_forge_card_3', { type: C.FORGE_CARD, amount: 3 }, gold(400))`, `daily('d_destroy_card_5', { type: C.DESTROY_CARD, amount: 5 }, gold(100))`).
- [ ] **Step 4: Implement** profil et solde : `users.service.ts` sélectionne les nouvelles colonnes dans `getProfile` (autour de la ligne 620) et expose `stats.cardsForged/cardsDestroyed/dustEarned` ; `GET /users/me` renvoie `dust` (là où `gold` est renvoyé aujourd'hui, convertir en `Number`).
- [ ] **Step 5: Implement** front : types de `user.service.ts`, trois entrées dans `STAT_ITEMS` de `StatsPanel.tsx`, `FAMILY_ICON` (utiliser `IconForge` pour `CARDS_FORGED` et `IconDust` pour `CARDS_DESTROYED`), clés i18n `stats.cards_forged`, `stats.cards_destroyed`, `stats.dust_earned`, `achievements.titles.CARDS_FORGED`, `achievements.titles.CARDS_DESTROYED` et les libellés des succès/quêtes existants dans les trois langues (reprendre le gabarit de `CARDS_SOLD` et `SELL_CARD`).
- [ ] **Step 6: Run** `pnpm build:shared`, puis `pnpm typecheck`, `pnpm test`, `pnpm lint` ; attendu : tout vert.
- [ ] **Step 7: Commit** `feat(forge): succès, quêtes et stats de profil`.

---

### Task 5: Interface Forger / Détruire

**Files:**
- Create: `apps/frontend/src/services/forge.service.ts`, `apps/frontend/src/features/forge/ForgeDialog.tsx`, `DestroyDialog.tsx`, `forgeSelection.ts`, `forgeSelection.test.ts`, `ForgeDialog.test.tsx`
- Modify: `apps/frontend/src/utils/querykeys.ts`, `apps/frontend/src/features/profile/OwnCardList.tsx`, `apps/frontend/src/features/profile/CollectionPanel.tsx`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`

**Interfaces:**
- Consumes: routes `GET /forge/usable`, `POST /forge`, `POST /forge/destroy` et types `UsableCard`, `ForgeRequest`, `ForgeResponse`, `DestroyRequest`, `DestroyResponse` (Tasks 1 et 3) ; `UserMe.dust` (Task 4) ; `IconForge`, `IconDust`.
- Produces:
  - `forgeService.usable(): Promise<UsableCard[]>`, `forgeService.forge(req: ForgeRequest): Promise<ForgeResponse>`, `forgeService.destroy(req: DestroyRequest): Promise<DestroyResponse>`.
  - `QUERY_KEYS.forgeUsable`.
  - `forgeSelection.ts` : `selectionTotal(selection: Record<number, number>): number` et `canSubmitForge(selection, cost: number): boolean` (somme égale au coût).

- [ ] **Step 1: Write the failing tests** :
  - `forgeSelection.test.ts` : `selectionTotal({ 1: 4, 2: 6 })` vaut 10 ; `canSubmitForge({ 1: 4, 2: 6 }, 10)` est vrai, `canSubmitForge({ 1: 4, 2: 5 }, 10)` est faux.
  - `ForgeDialog.test.tsx` (Testing Library, `forgeService` simulé comme dans les tests existants de `features/`) : le bouton de confirmation est désactivé tant que la sélection n'atteint pas le coût et qu'aucune cible n'est choisie ; une carte à `usable` 0 n'est pas sélectionnable ; une erreur de l'API s'affiche avec `apiErrorMessage`.
- [ ] **Step 2: Run** `pnpm --filter @pipou/frontend test -- forge` ; attendu : FAIL.
- [ ] **Step 3: Implement** le service, la clé de requête, `forgeSelection.ts`.
- [ ] **Step 4: Implement** `ForgeDialog` (ouverte depuis la collection) : choix du set puis de la rareté d'entrée (forgeable seulement), sélection des copies par carte bornée par `usable`, compteur « n / coût », choix de la cible parmi les cartes du set de rareté au-dessus (cartes d'aventure et sans set exclues, cartes non possédées incluses), confirmation. `DestroyDialog` : quantité bornée par `usable`, poussière gagnée affichée avant confirmation. Après succès : `invalidateQueries` sur `inventory`, `collection`, `forgeUsable`, `profile` et le solde de poussière. Textes via i18n dans les trois langues, icônes SVG, aucun emoji.
- [ ] **Step 5: Implement** l'entrée dans l'UI : boutons « Forger » et « Détruire » dans la collection (`OwnCardList` pour la carte, `CollectionPanel` pour le point d'entrée de la forge) et affichage du solde de poussière à côté.
- [ ] **Step 6: Run** `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` ; attendu : tout vert. Vérifier à la main avec `pnpm dev` : forger 10 communes d'un set, détruire une copie, voir les stats du profil bouger.
- [ ] **Step 7: Commit** `feat(forge): interface de forge et de destruction`.

---

## Self-review

- **Couverture du spec :** forge et règles (Tasks 1-3), destruction et poussière (2-3), protection des decks (3), compteurs, succès, quêtes, stats (4), UI (5). La place de marché n'est pas touchée.
- **Cohérence des noms :** `FORGE_COST`, `DUST_VALUE`, `validateForge`, `ForgeService.listUsable/forge/destroy`, `UsableCard`, événements `forge.done`/`destroy.done` identiques d'une tâche à l'autre.
- **Choix du plan à valider :** seuils de succès (1/10/50 et 10/100/500), quêtes `w_forge_card_3` (400 gold) et `d_destroy_card_5` (100 gold), cartes à quantité 0 conservées, `forge.done` émis avec `amount: 1` par forge.
