# Starter decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque compte choisit une fois un starter deck (Pipou, Pixelman, Drakon) et reçoit 5000 gold, les cartes et un deck prêt à jouer ; l'admin édite les compositions ; le panneau des règles est corrigé.

**Architecture:** Nouveau module backend `starter-decks` (2 tables + colonne `user.starter_claimed_at`). Le droit au starter est le fait que cette colonne soit `NULL` : aucune migration ne verse de gold. Le front ajoute un modal monté dans `AppLayout`, un bouton sur Home, un onglet admin, et des textes i18n partagés avec le panneau des règles.

**Tech Stack:** NestJS 11, TypeORM (MySQL), React 18, TanStack Query, framer-motion, i18next, Jest (back), Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-05-starter-decks-design.md`

## Global Constraints

- Travail sur la branche `dev`, jamais sur `main`.
- Types échangés dans `@pipou/shared` ; `pnpm build:shared` après modification.
- `Archetype.DRAGON` vaut `dragon` et s'affiche « Drakon ».
- Dotation : `STARTER_GOLD = 5000`, exactement `STARTER_FEATURED_COUNT = 4` cartes phares.
- Deck valide : `DECK_RULES` (30 à 40 cartes, 3 exemplaires maximum).
- UI : icônes SVG, jamais d'emoji. Textes visibles via i18n en fr, en et ko.
- Frontend : TanStack Query, clés dans `QUERY_KEYS`, erreurs via `apiErrorMessage`.
- Les cartes reçues ne sont pas verrouillées (`lockedQuantity` inchangé).

## Review Focus

- Double clic ou deux onglets sur la validation : un seul versement, le second appel reçoit 409 (test Task 3).
- Liste devenue invalide entre l'affichage et la validation : rien n'est versé, le marqueur reste `NULL` (test Task 3).
- Joueur qui possède déjà les cartes : quantités additionnées, deck créé sur la ligne `user_card` existante (test Task 3).
- Modal fermé puis page rechargée : il ne se rouvre pas seul, le bouton Home reste (test Task 5).
- `localStorage` indisponible : l'app ne plante pas et le modal reste fermable (test Task 5).

---

### Task 1: Types partagés

**Files:**
- Create: `packages/shared/src/api/starter-decks.ts`
- Modify: `packages/shared/src/api/index.ts`

**Interfaces:**
- Produces :

```ts
export const STARTER_GOLD = 5000;
export const STARTER_FEATURED_COUNT = 4;
export interface StarterDeckCardView { cardId: number; quantity: number; isFeatured: boolean }
export interface StarterDeckView { archetype: Archetype; isValid: boolean; cards: StarterDeckCardView[] }
export interface StarterStatus { claimed: boolean; available: boolean; decks: StarterDeckView[] }
export interface StarterDeckBody { cards: StarterDeckCardView[] } // sans cardId dupliqué
export interface ClaimStarterBody { archetype: Archetype }
export interface ClaimStarterResult { archetype: Archetype; deckId: number; gold: number }
```

`available` = non réclamé et 3 decks valides. `decks` est vide quand `available` est faux, sauf côté admin. Les détails des cartes viennent de `useCardCatalog` côté front.

- [ ] **Step 1:** Écrire les types et les exporter depuis l'index.
- [ ] **Step 2:** Run `pnpm build:shared`. Expected : succès.
- [ ] **Step 3:** Commit `feat(shared): types des starter decks`.

### Task 2: Schéma et compositions initiales

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000026-StarterDecks.ts`
- Create: `apps/backend/src/starter-decks/starter-deck.entity.ts`, `starter-deck-card.entity.ts`
- Modify: `apps/backend/src/users/user.entity.ts`, `apps/backend/src/users/users.service.ts:100-118`
- Test: `apps/backend/src/database/starter-decks-migration.spec.ts`

**Interfaces:**
- Produces : entités `StarterDeck { id, archetype (unique), cards }` et `StarterDeckCard { id, starterDeckId, cardId, quantity, isFeatured }` ; `User.starterClaimedAt: Date | null`, colonne `starter_claimed_at`, ajoutée au `select` de `findOne`.
- Exporte `STARTER_SEED` depuis le fichier de migration : `{ archetype, cards: { name, quantity, featured? }[] }[]`, listes exactes de la section « Compositions initiales » de la spec.

SQL : `starter_deck_card.starter_deck_id` en `ON DELETE CASCADE`, `card_id` en `ON DELETE RESTRICT`, unique sur `(starter_deck_id, card_id)`. `down` supprime les tables et la colonne. La migration utilise uniquement du SQL brut (spec de `migrations-columns.spec.ts`) et retrouve chaque carte par `TRIM(name)`, en levant une erreur si un nom est absent ou ambigu.

- [ ] **Step 1: Test qui échoue**

```ts
it.each(STARTER_SEED)('$archetype : 30 cartes, 4 phares, 3 copies max', (deck) => {
  expect(deck.cards.reduce((n, c) => n + c.quantity, 0)).toBe(30);
  expect(deck.cards.filter((c) => c.featured)).toHaveLength(4);
  expect(Math.max(...deck.cards.map((c) => c.quantity))).toBeLessThanOrEqual(3);
});
it('échoue si une carte est introuvable', async () => {
  // queryRunner.query simulé renvoyant [] sur le SELECT de carte
  await expect(new StarterDecks1791000000026().up(runner)).rejects.toThrow(/Chevalier Touille/);
});
```

- [ ] **Step 2:** Run `pnpm --filter @pipou/backend test starter-decks-migration`. Expected : FAIL, module absent.
- [ ] **Step 3:** Écrire migration et entités, ajouter `starterClaimedAt` au `select`.
- [ ] **Step 4:** Relancer le test. Expected : PASS.
- [ ] **Step 5:** Commit `feat(starter): schéma et compositions initiales`.

### Task 3: API joueur et validation du choix

**Files:**
- Create: `apps/backend/src/starter-decks/starter-decks.service.ts`, `starter-decks.controller.ts`, `starter-decks.module.ts`, `dto/claim-starter.dto.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/src/starter-decks/starter-decks.service.spec.ts`

**Interfaces:**
- Consumes : Task 1, Task 2, `UsersService.addCardToUser(userId, cardId, quantity, manager)`, `UsersService.addGold(userId, amount, manager)`.
- Produces :
  - `isDeckValid(cards: StarterDeckCardView[]): boolean` (fonction exportée)
  - `StarterDecksService.getStatus(userId): Promise<StarterStatus>`
  - `StarterDecksService.claim(userId, archetype): Promise<ClaimStarterResult>`
  - `GET /starter-decks`, `POST /starter-decks/claim` (JWT)

`claim` s'exécute dans `dataSource.transaction`, dans cet ordre :
1. `UPDATE user SET starter_claimed_at = NOW() WHERE id = ? AND starter_claimed_at IS NULL`. Si 0 ligne affectée : `ConflictException`.
2. Charger les 3 decks. Si l'un est invalide : `BadRequestException`, ce qui annule le marqueur.
3. `addCardToUser` pour chaque carte, puis `addGold(STARTER_GOLD)`.
4. Retrouver les `UserCard`, créer un `Deck` nommé `Starter Pipou`, `Starter Pixelman` ou `Starter Drakon`, et ses `DeckCard` avec les quantités de la liste.

- [ ] **Step 1: Tests qui échouent**, sur le modèle de `decks.service.spec.ts` :
  - `isDeckValid` : faux à 29 cartes, à 41 cartes, avec 4 copies, avec 3 phares ou 5 phares ; vrai à 30 cartes et 4 phares.
  - `getStatus` : `available: false, decks: []` si réclamé ou si un deck est invalide.
  - `claim` : `addGold` appelé une fois avec `5000`, `addCardToUser` une fois par carte, deck créé avec le bon nom.
  - `claim` déjà réclamé : rejette `ConflictException`, `addGold` non appelé.
  - `claim` avec un deck invalide : rejette `BadRequestException`, `addGold` non appelé.
  - `claim` avec des cartes déjà possédées : le `DeckCard` utilise le `userCardId` existant.
- [ ] **Step 2:** Run `pnpm --filter @pipou/backend test starter-decks`. Expected : FAIL.
- [ ] **Step 3:** Implémenter service, DTO (`@IsIn` sur les valeurs d'`Archetype`), contrôleur et module.
- [ ] **Step 4:** Relancer. Expected : PASS.
- [ ] **Step 5:** Commit `feat(starter): statut et validation du choix`.

### Task 4: API admin et garde sur la suppression de carte

**Files:**
- Create: `apps/backend/src/starter-decks/starter-decks-admin.controller.ts`, `dto/starter-deck.dto.ts`
- Modify: `starter-decks.service.ts`, `starter-decks.module.ts`, `apps/backend/src/cards/cards.service.ts:94-98`
- Test: `starter-decks.service.spec.ts`, `apps/backend/src/cards/cards.service.spec.ts`

**Interfaces:**
- Produces :
  - `StarterDecksService.adminList(): Promise<StarterDeckView[]>`
  - `StarterDecksService.saveDeck(archetype, body: StarterDeckBody): Promise<StarterDeckView>`
  - `GET /admin/starter-decks`, `PUT /admin/starter-decks/:archetype` (`JwtAuthGuard, AdminGuard`)

`saveDeck` remplace les lignes dans une transaction et lève `BadRequestException` si `isDeckValid` est faux ou si une carte n'existe pas. `CardsService.remove` attrape `ER_ROW_IS_REFERENCED_2` et lève `ConflictException('Carte utilisée dans un starter deck')`. Si d'autres tables provoquent cette erreur, le message reste générique : vérifier d'abord `starter_deck_card` par un `count`.

- [ ] **Step 1: Tests qui échouent** : `saveDeck` refuse 29 cartes et ne touche pas aux lignes ; accepte une liste valide ; `remove` d'une carte référencée rejette `ConflictException`.
- [ ] **Step 2:** Run `pnpm --filter @pipou/backend test starter-decks cards.service`. Expected : FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Relancer. Expected : PASS.
- [ ] **Step 5:** Commit `feat(starter): édition admin des compositions`.

### Task 5: Modal joueur, bouton Home et textes

**Files:**
- Create: `apps/frontend/src/services/starterDeck.service.ts`
- Create: `apps/frontend/src/hooks/useStarterDeckModal.ts`
- Create: `apps/frontend/src/features/starter/StarterDeckModal.tsx`, `StarterDeckModal.css`, `StarterDeckCardList.tsx`, `StarterDeckButton.tsx`, `starterTexts.ts`
- Create: `apps/frontend/src/contexts/StarterDeckContext.ts`
- Modify: `apps/frontend/src/App.tsx:43-72`, `apps/frontend/src/hooks/Usedailyrewardmodal.ts`, `apps/frontend/src/pages/Home.tsx`, `apps/frontend/src/utils/querykeys.ts`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`
- Test: `apps/frontend/src/hooks/useStarterDeckModal.test.tsx`, `apps/frontend/src/features/starter/StarterDeckModal.test.tsx`

**Interfaces:**
- Consumes : Task 1 ; `GET /starter-decks`, `POST /starter-decks/claim`.
- Produces :
  - `starterDeckService.getStatus()`, `.claim(archetype)`, `QUERY_KEYS.starterStatus`
  - `useStarterDeckModal(userId?: number): { status, isOpen, isBlocking, open, close }`
  - `useDailyRewardModal(isAuthenticated, blocked = false)`
  - `STARTER_ORDER: Archetype[]` et `starterTextKey(archetype)` dans `starterTexts.ts` (clé `starter.deck.<pipou|pixelman|dragon>`), réutilisés par Task 7

Comportement :
- Ouverture automatique une seule fois par compte et par appareil : clé `localStorage` `starter-modal-seen:<userId>`, lecture et écriture dans `try/catch`.
- `isBlocking` vaut vrai tant que le statut charge ou que le modal est ouvert. La récompense quotidienne reste fermée pendant ce temps et s'ouvre après la fermeture : ajouter `blocked` aux dépendances de son effet.
- Phases : `browse` (onglets, gameplay, 4 cartes phares, bouton liste), `list`, `confirm`, `done` (explication « comment le jouer »).
- Fermeture depuis `browse` sans choix : toast `starter.closed_hint` indiquant le bouton sur Home.
- Liste : `CardFace size="xs"`, `CardEffectsText`, quantité ; un appui ouvre `CardInspect`.
- Après succès : invalider `profile`, `myStats`, `starterStatus`, `inventory`, `collection` et la clé des decks.
- Erreur de validation : `apiErrorMessage` affiché dans le modal, retour à `browse`.
- `StarterDeckButton` sur Home, en haut de page, libellé `starter.claim_button` = « Réclamer Starter Deck », visible si `status.available`.

Textes : pour chaque deck, `name`, `gameplay` et `how_to_play` sous `starter.deck.*`. Les rédiger en fr, en et ko après lecture des effets réels des cartes de la spec (base ou migrations). Ils peuvent citer les cartes de la liste initiale.

- [ ] **Step 1: Tests qui échouent**
  - Hook : `available` et clé absente, ouvert et clé écrite ; clé présente, fermé et `isBlocking` faux ; `localStorage` qui lève une erreur, pas de plantage ; `available` faux, jamais ouvert.
  - Modal : changer d'onglet affiche le texte du deck ; fermer sans choisir déclenche le toast ; confirmer appelle `claim('dragon')` une seule fois, y compris sur double clic ; succès affiche `how_to_play` ; erreur serveur affiche le message.
- [ ] **Step 2:** Run `pnpm --filter @pipou/frontend test starter`. Expected : FAIL.
- [ ] **Step 3:** Implémenter le service, le hook, puis le modal sur la base visuelle de `DailyRewardModal`.
- [ ] **Step 4:** Monter dans `AppLayout`, passer `blocked` au modal quotidien, exposer `open` via `StarterDeckContext`, ajouter le bouton sur Home, ajouter les textes.
- [ ] **Step 5:** Relancer les tests. Expected : PASS.
- [ ] **Step 6:** Commit `feat(starter): modal de choix et bouton Home`.

### Task 6: Onglet admin

**Files:**
- Create: `apps/frontend/src/features/starter/StarterDeckManager.tsx`
- Modify: `apps/frontend/src/services/starterDeck.service.ts`, `apps/frontend/src/pages/Admin.tsx:34-110`, `apps/frontend/src/utils/querykeys.ts`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`
- Test: `apps/frontend/src/features/starter/StarterDeckManager.test.tsx`

**Interfaces:**
- Consumes : `GET /admin/starter-decks`, `PUT /admin/starter-decks/:archetype`, `isValid` de `StarterDeckView`.
- Produces : `starterDeckService.adminList()`, `.saveDeck(archetype, body)`, `QUERY_KEYS.adminStarterDecks`, onglet `starterDecks`.

Suivre le modèle d'`OpponentDeckEditor` : compteur total, boutons plus et moins limités par `DECK_RULES`. Ajouter un interrupteur « carte phare » par carte du deck et un compteur `n/4`. Toutes les cartes sont proposées, avec `CardFilterBar`. Le bouton Enregistrer est désactivé hors règles.

- [ ] **Step 1: Tests qui échouent** : Enregistrer désactivé à 29 cartes ou à 3 phares ; à 30 cartes et 4 phares, `saveDeck` reçoit la liste ; un retrait de carte retire aussi son statut phare.
- [ ] **Step 2:** Run `pnpm --filter @pipou/frontend test StarterDeckManager`. Expected : FAIL.
- [ ] **Step 3:** Implémenter et ajouter l'onglet.
- [ ] **Step 4:** Relancer. Expected : PASS.
- [ ] **Step 5:** Commit `feat(starter): onglet admin des compositions`.

### Task 7: Panneau des règles

**Files:**
- Modify: `apps/frontend/src/features/fight/FightRules.tsx:71,126-160`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`
- Test: `apps/frontend/src/features/fight/FightRules.test.tsx` (créer s'il n'existe pas)

**Interfaces:**
- Consumes : `STARTER_ORDER`, `starterTextKey` (Task 5), `EQUIP_SLOT_CAPACITY`.

Ajouter la ligne Charge (`glossary.kind.CHARGE`, `fight.rules.charge`). Ajouter `fight.rules.equipmentSlots` avec les valeurs interpolées depuis `EQUIP_SLOT_CAPACITY`. Ajouter une étape « Decks de départ » listant nom, gameplay et comment le jouer. `Step.icon` passe à `ReactNode` pour que cette étape utilise `IconCards` ; les emoji existants ne changent pas.

- [ ] **Step 1: Test qui échoue** : la section cartes affiche le texte Charge et les emplacements (1, 1, 2) ; la nouvelle étape affiche les 3 decks.
- [ ] **Step 2:** Run `pnpm --filter @pipou/frontend test FightRules`. Expected : FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** Relancer. Expected : PASS.
- [ ] **Step 5:** Run `pnpm typecheck && pnpm lint && pnpm test`. Expected : tout passe.
- [ ] **Step 6:** Commit `feat(rules): charge, emplacements et decks de départ`.
