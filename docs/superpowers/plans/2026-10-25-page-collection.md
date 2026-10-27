# Page Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page `/collection` avec les onglets Collection, Forge (en deux étapes) et Destruction (rapide + carte par carte), où chaque carte ouvre sa fiche du glossaire.

**Architecture:** Le front croise trois sources déjà disponibles : le catalogue complet (`useCardCatalog`, cartes avec effets et set), la collection du joueur (quantités possédées) et `GET /forge/usable` (copies hors decks). Un module pur `features/collection/ownedCards.ts` fait ces calculs (jointure, filtre de forge, plan de destruction rapide) ; les onglets ne font que de l'affichage. Le backend gagne une seule route : la destruction groupée atomique.

**Tech Stack:** React 18, TanStack Query, react-router (`useSearchParams`), Vitest + Testing Library, i18next ; NestJS 11 + TypeORM, Jest ; `@pipou/shared`.

**Spec:** `docs/superpowers/specs/2026-10-25-page-collection-design.md` (s'appuie sur `2026-10-25-forge-poussiere-design.md`)

## Global Constraints

- Branche `dev`. Commits en français, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Types échangés front/back dans `@pipou/shared` ; `pnpm build:shared` après modification.
- Conventions `apps/frontend/CLAUDE.md` : TanStack Query, clés dans `QUERY_KEYS`, pas de composant déclaré dans un composant, pas de `any`, erreurs via `apiErrorMessage`, état dérivé calculé au rendu.
- Icônes SVG de `components/Icons.tsx`, jamais d'emoji ; textes i18n fr, en, ko ; utilisable en largeur téléphone.
- Fiche de carte = `features/fight/CardInspect` (comme le glossaire), ouverte par une icône œil, alimentée par la carte du catalogue (qui porte les effets).
- Destruction rapide : garder 1, 2 ou 3 (défaut **3**), « garder N » compte les exemplaires possédés ; `à détruire = min(usable, owned − N)` si > 0. Raretés cochées par défaut : commune, peu commune, rare. Set : un seul ou « Tous » (défaut).
- Avertissement + case « Je comprends » obligatoire dès qu'une destruction (rapide ou unitaire) inclut une carte épique, légendaire ou secrète.
- Destruction groupée tout ou rien ; au plus une ligne par carte ; `@ArrayMaxSize(200)` ; compte le total des copies (`cardsDestroyed`, `dustEarned`, `destroy.done` avec `amount` = total).
- Forge étape 1 : seules les raretés forgeables ; dès la première copie la liste se restreint à ce set et cette rareté ; « Réinitialiser » vide la sélection ; cartes à 0 copie utilisable grisées (« dans un deck »). Étape 2 : cartes du même set, rareté au-dessus, non possédées incluses, sans les cartes d'aventure (`requiresAllElements(effects)`) ni les cartes sans set.
- Après forge ou destruction : `useInvalidateAfterForge()` (existant).

## Review Focus

- Destruction rapide avec des cartes dont toutes les copies sont dans un deck : elles n'apparaissent pas dans le plan et ne sont jamais envoyées.
- Destruction groupée où une carte a changé entre l'aperçu et la confirmation : 400, rien n'est détruit, l'aperçu se rafraîchit et la confirmation reste ouverte avec le message.
- Destruction groupée avec deux lignes pour la même carte, quantité ≤ 0 ou liste vide : 400.
- Catalogue ou collection encore en chargement : aucun calcul de plan ni bouton actif sur des données partielles.
- Retour de l'étape 2 à l'étape 1 de la forge : la sélection est conservée.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `packages/shared/src/api/forge.ts` (modifier) | `DestroyBatchRequest`, `DestroyBatchResponse` |
| `apps/backend/src/forge/forge.service.ts`, `forge.controller.ts`, `dto/destroy-batch.dto.ts` | route `POST /forge/destroy/batch` |
| `apps/frontend/src/features/collection/ownedCards.ts` (créer) | jointure catalogue + collection + usable, filtres forge, plan de destruction rapide |
| `apps/frontend/src/features/collection/useOwnedCards.ts` (créer) | hook qui assemble les trois requêtes |
| `apps/frontend/src/pages/Collection.tsx` (créer) | page à onglets (`?tab=collection|forge|destroy`) |
| `apps/frontend/src/features/collection/CollectionTab.tsx`, `ForgeTab.tsx`, `DestroyTab.tsx`, `DestroyConfirm.tsx`, `CardRow.tsx` (créer) | onglets et composants partagés |
| `apps/frontend/src/features/forge/ForgeDialog.tsx`, `DestroyDialog.tsx` (supprimer à la tâche 5) | remplacés par les onglets |

---

### Task 1: Destruction groupée (backend + shared)

**Files:**
- Modify: `packages/shared/src/api/forge.ts`, `apps/backend/src/forge/forge.service.ts`, `forge.service.spec.ts`, `forge.controller.ts`
- Create: `apps/backend/src/forge/dto/destroy-batch.dto.ts`

**Interfaces:**
- Produces:
  - `DestroyBatchRequest { items: DestroyRequest[] }`, `DestroyBatchResponse { dustGained: number; dust: number; destroyed: number }` dans `@pipou/shared`.
  - `ForgeService.destroyBatch(userId: number, req: DestroyBatchRequest): Promise<DestroyBatchResponse>`.
  - Route `POST /forge/destroy/batch` (`JwtAuthGuard`).

- [ ] **Step 1: Write the failing tests** dans `forge.service.spec.ts` (mêmes mocks que les tests `destroy` existants) :
  - 4 communes de la carte A + 2 rares de la carte B → `dustGained` 4 + 20 = 24, `destroyed` 6, les deux `UserCard` décrémentés, `dust` et `dustEarned` +24, `cardsDestroyed` +6, **un seul** événement `destroy.done` `{ userId, amount: 6 }`.
  - une ligne dépasse `usable` → `BadRequestException`, aucun `save`, aucun `increment`, aucun événement.
  - deux lignes pour le même `cardId` → `BadRequestException`.
- [ ] **Step 2: Run** `pnpm --filter @pipou/backend test -- forge.service` ; attendu : FAIL.
- [ ] **Step 3: Implement** les types shared (`pnpm build:shared`), puis `destroyBatch` : une transaction, `lockUserCards` sur tous les `cardId` (ordre d'id), `protectedQuantities` une fois, vérification de chaque ligne avant toute écriture, puis décréments et trois `increment` avec les totaux. Réutiliser la logique de `destroy` en factorisant ce qui est commun plutôt que de la dupliquer. DTO : `@ArrayNotEmpty`, `@ArrayMaxSize(200)`, `@ValidateNested({ each: true })`, `@Type`, entiers ≥ 1 (même style que `forge.dto.ts`). Route dans le contrôleur.
- [ ] **Step 4: Run** `pnpm --filter @pipou/backend test`, `pnpm --filter @pipou/backend typecheck` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(forge): destruction groupée atomique`.

---

### Task 2: Calculs purs de la collection

**Files:**
- Create: `apps/frontend/src/features/collection/ownedCards.ts`, `ownedCards.test.ts`, `useOwnedCards.ts`
- Modify: `apps/frontend/src/services/forge.service.ts`

**Interfaces:**
- Consumes: `Card` (`services/card.service.ts`), `UserCollection` (`services/user.service.ts`), `UsableCard`, `DestroyBatchRequest/Response`, `DUST_VALUE`, `FORGE_COST`, `isForgeable`, `nextForgeRarity`, `requiresAllElements`, `Rarity` (`@pipou/shared`).
- Produces:
  - `interface OwnedCard { card: Card; owned: number; usable: number }`.
  - `joinOwnedCards(catalog: Card[], collection: UserCollection, usable: UsableCard[]): OwnedCard[]` : une entrée par carte du catalogue, `owned` depuis la collection (0 si absente), `usable` depuis `usable` (0 si absente).
  - `isForgeTarget(card: Card): boolean` : faux si set absent ou `requiresAllElements(card.effects)`.
  - `forgeInputs(cards: OwnedCard[], lock: { setId: number; rarity: Rarity } | null): OwnedCard[]` : possédées, rareté forgeable, restreintes au verrou s'il existe.
  - `forgeTargets(cards: OwnedCard[], setId: number, rarity: Rarity): OwnedCard[]` : même set, `nextForgeRarity(rarity)`, `isForgeTarget`, possédées ou non.
  - `interface QuickDestroyOptions { keep: 1 | 2 | 3; rarities: Rarity[]; setId: number | null }` et `DEFAULT_QUICK_DESTROY: QuickDestroyOptions` (`keep: 3`, raretés common/uncommon/rare, `setId: null`).
  - `interface DestroyLine { card: Card; quantity: number; dust: number }`.
  - `quickDestroyPlan(cards: OwnedCard[], opts: QuickDestroyOptions): DestroyLine[]`.
  - `HIGH_RARITIES: Rarity[]` (epic, legendary, secret) et `hasHighRarity(lines: DestroyLine[]): boolean`.
  - `forgeService.destroyBatch(req: DestroyBatchRequest): Promise<DestroyBatchResponse>`.
  - `useOwnedCards(): { cards: OwnedCard[]; isPending: boolean; isError: boolean }` (catalogue via `useCardCatalog`, collection via la requête `QUERY_KEYS.collection` existante, usable via `QUERY_KEYS.forgeUsable`) ; `isPending` vrai tant qu'une des trois n'est pas chargée.

- [ ] **Step 1: Write the failing tests** (`ownedCards.test.ts`) :
  - `joinOwnedCards` : une carte absente de la collection a `owned` 0 et `usable` 0 ; une carte possédée 5 fois avec usable 2 a `owned` 5, `usable` 2.
  - `quickDestroyPlan` avec `keep: 3` : 5 possédées dont usable 2 → 2 ; 5 possédées usable 5 → 2 ; 2 possédées → absente ; usable 0 → absente ; rareté non cochée → absente ; autre set que `setId` → absente ; `dust` = quantité × `DUST_VALUE[rarity]`. Avec `keep: 1` : 5 possédées usable 5 → 4.
  - `forgeTargets(cards, 1, "common")` : contient une peu commune du set 1 non possédée, exclut une peu commune du set 2, une rare du set 1 et une carte dont les effets vérifient `requiresAllElements`.
  - `forgeInputs(cards, null)` exclut légendaires, secrètes et non possédées ; `forgeInputs(cards, { setId: 1, rarity: "common" })` ne garde que les communes possédées du set 1, y compris celles à usable 0.
  - `hasHighRarity` vrai dès qu'une ligne est épique, légendaire ou secrète.
- [ ] **Step 2: Run** `pnpm --filter @pipou/frontend test -- ownedCards` ; attendu : FAIL.
- [ ] **Step 3: Implement** `ownedCards.ts`, `useOwnedCards.ts`, `forgeService.destroyBatch`.
- [ ] **Step 4: Run** le test puis `pnpm --filter @pipou/frontend typecheck` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(collection): calculs de collection, forge et destruction`.

---

### Task 3: Page `/collection` et onglet Collection

**Files:**
- Create: `apps/frontend/src/pages/Collection.tsx`, `Collection.css`, `apps/frontend/src/features/collection/CardRow.tsx`, `CollectionTab.tsx`, `Collection.test.tsx`
- Modify: `apps/frontend/src/App.tsx` (route protégée `/collection`), `components/Header.tsx` (lien), `features/profile/CollectionPanel.tsx` (la ligne « Cartes » navigue vers `/collection` au lieu de dérouler ; retirer la barre de forge et `ForgeDialog`), `features/profile/OwnCardList.tsx` (déplacé ou réutilisé par `CollectionTab` ; retirer le bouton Détruire et `DestroyDialog`), locales fr/en/ko.

**Interfaces:**
- Consumes: `useOwnedCards`, `OwnedCard` (Task 2) ; `CardInspect` ; `DustBalance` (actuellement exporté par `ForgeDialog.tsx` : le déplacer dans `features/collection/DustBalance.tsx`).
- Produces:
  - `CollectionTabKey = "collection" | "forge" | "destroy"`, lu et écrit dans `?tab=` (défaut `collection`).
  - `CardRow` : `{ item: OwnedCard; meta?: ReactNode; disabled?: boolean; selected?: boolean; onInspect: () => void; children?: ReactNode }` — vignette, nom, `meta`, emplacement `children` (sélecteur), bouton œil (`aria-label` traduit, icône SVG `IconEye` à ajouter dans `Icons.tsx` si absente).
  - Les onglets Forge et Destruction affichent un emplacement vide à cette tâche.

- [ ] **Step 1: Write the failing test** (`Collection.test.tsx`, services simulés comme dans les tests de `features/`) : la page affiche les trois onglets ; `?tab=forge` active l'onglet Forge ; cliquer sur l'icône œil d'une carte de l'onglet Collection ouvre `CardInspect` avec le nom de la carte ; le solde de poussière s'affiche.
- [ ] **Step 2: Run** ; attendu : FAIL.
- [ ] **Step 3: Implement** la page, les onglets, `CardRow`, `CollectionTab` (liste actuelle de l'inventaire : filtres, cartes manquantes, pagination par set, avec l'œil), la route, le lien d'en-tête, le lien depuis le profil, le retrait des boutons Forger/Détruire de la collection.
- [ ] **Step 4: Run** `pnpm --filter @pipou/frontend test`, `typecheck`, `lint` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(collection): page collection à onglets`.

---

### Task 4: Onglet Forge en deux étapes

**Files:**
- Create: `apps/frontend/src/features/collection/ForgeTab.tsx`, `ForgeTab.test.tsx`
- Modify: `apps/frontend/src/pages/Collection.tsx`, locales fr/en/ko

**Interfaces:**
- Consumes: `useOwnedCards`, `forgeInputs`, `forgeTargets` (Task 2) ; `CardRow`, `CardInspect` (Task 3) ; `selectionTotal`, `canSubmitForge` (`features/forge/forgeSelection.ts`) ; `forgeService.forge`, `useInvalidateAfterForge`, `FORGE_COST`, `CardFilterBar` + `matchesFilters` + `sortCards` + `NO_FILTERS` du glossaire.

- [ ] **Step 1: Write the failing tests** (`ForgeTab.test.tsx`) :
  - étape 1 : le bandeau affiche « 0 / 10 » ; après + sur une commune du set 1, une carte d'un autre set ou d'une autre rareté disparaît de la liste ; « Réinitialiser » la fait revenir ;
  - une carte à usable 0 est affichée grisée avec « dans un deck » et son + est désactivé ;
  - Suivant est désactivé tant que le total n'atteint pas le coût, actif à 10 / 10 ;
  - étape 2 : la liste contient une carte non possédée (« non possédée ») et pas la carte d'aventure ; Forger appelle `forgeService.forge` avec `{ inputs, targetCardId }` ; retour à l'étape 1 conserve « 10 / 10 » ;
  - une erreur de l'API s'affiche via `apiErrorMessage`.
- [ ] **Step 2: Run** ; attendu : FAIL.
- [ ] **Step 3: Implement** `ForgeTab` (barre de filtres sur l'étape 1, bandeau fixe en bas, icône œil sur chaque ligne des deux étapes, mutation avec `isPending` contre le double clic, invalidation, retour à l'étape 1 vide après succès avec un message de réussite).
- [ ] **Step 4: Run** tests, `typecheck`, `lint` ; attendu : PASS.
- [ ] **Step 5: Commit** `feat(collection): forge en deux étapes`.

---

### Task 5: Onglet Destruction et nettoyage

**Files:**
- Create: `apps/frontend/src/features/collection/DestroyTab.tsx`, `DestroyConfirm.tsx`, `DestroyTab.test.tsx`
- Modify: `apps/frontend/src/pages/Collection.tsx`, locales fr/en/ko
- Delete: `apps/frontend/src/features/forge/ForgeDialog.tsx`, `ForgeDialog.test.tsx`, `DestroyDialog.tsx` (et leur CSS devenu inutile) une fois plus rien ne les importe.

**Interfaces:**
- Consumes: `useOwnedCards`, `quickDestroyPlan`, `DEFAULT_QUICK_DESTROY`, `hasHighRarity`, `DestroyLine` (Task 2) ; `CardRow`, `CardInspect` (Task 3) ; `forgeService.destroyBatch`, `forgeService.destroy`, `useInvalidateAfterForge`.
- Produces: `DestroyConfirm` : `{ lines: DestroyLine[]; pending: boolean; error: string | null; onConfirm: () => void; onCancel: () => void }` — liste, total de poussière, et si `hasHighRarity(lines)` : avertissement nommant ces cartes + case « Je comprends » qui conditionne le bouton.

- [ ] **Step 1: Write the failing tests** (`DestroyTab.test.tsx`) :
  - valeurs par défaut : « garder 3 » sélectionné, commune/peu commune/rare cochées, set « Tous » ; le résumé affiche le bon nombre de copies et de poussière pour un jeu de données connu ;
  - passer à « garder 1 » met à jour le résumé ;
  - « Voir et confirmer » ouvre la confirmation ; Détruire appelle `destroyBatch` avec exactement les lignes du plan ; rien n'est appelé avant ;
  - cocher « épique » avec une épique en trop : avertissement visible, Détruire désactivé jusqu'à la case « Je comprends » ;
  - réponse 400 de `destroyBatch` : message affiché, confirmation encore ouverte, `forgeUsable` invalidé ;
  - liste carte par carte : détruire 2 copies d'une rare appelle `forgeService.destroy` après confirmation ; une épique déclenche l'avertissement.
- [ ] **Step 2: Run** ; attendu : FAIL.
- [ ] **Step 3: Implement** `DestroyTab` (panneau rapide, liste manuelle avec sélecteur borné par `usable` et œil) et `DestroyConfirm` ; brancher l'onglet ; supprimer les anciens dialogues et ce qui n'est plus utilisé.
- [ ] **Step 4: Run** `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build` ; attendu : tout vert (le test `InboxWidget` est connu pour échouer parfois sous charge : le relancer seul si besoin et le signaler).
- [ ] **Step 5: Commit** `feat(collection): destruction rapide et carte par carte`.

---

## Self-review

- Couverture du spec : page et onglets (T3), fiche œil partout (T3-T5), forge deux étapes avec verrou, réinitialisation, grisés, cibles sans aventure (T2, T4), destruction rapide avec défauts, confirmation, avertissement, atomicité, comptage total (T1, T2, T5), accès profil et en-tête (T3), retrait des anciens boutons (T3, T5).
- Écart assumé vis-à-vis du spec : pas de champ `forgeable` ajouté au payload collection ; le front calcule la même règle (`isForgeTarget`) sur le catalogue, qui porte déjà effets et set. Le backend continue de refuser.
- Noms cohérents : `OwnedCard`, `joinOwnedCards`, `forgeInputs`, `forgeTargets`, `quickDestroyPlan`, `DestroyLine`, `hasHighRarity`, `destroyBatch`, `CardRow`, `DestroyConfirm`.
