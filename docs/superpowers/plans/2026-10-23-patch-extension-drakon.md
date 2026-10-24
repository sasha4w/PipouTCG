# Patch Garde / Relève / Origines — plan 3 : extension Drakon et aventure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** créer les 4 Drakons Ancestraux et le Drakon des Origines. Faire du Drakon des Origines le boss du monde Drakon, faire tomber l'Ancestral de son élément à chaque niveau d'élément, puis mesurer le patch complet en tournoi Standard.

**Architecture:**
- Les nouvelles cartes sont des données (`apps/backend/src/database/drakon-origines-cards.ts`), créées par une migration et ajoutées à `allRealCards`.
- L'aventure gagne une récompense « carte précise » par adversaire : colonnes `farm_card_id` et `farm_card_pct`, un tirage dans `rollLoot`, l'attribution dans `adventure.service`.
- Une migration règle le monde Drakon : boss, récompenses, et decks régénérés avec le générateur adapté.

**Tech Stack:** NestJS 11, TypeORM (MySQL), Jest, `@pipou/shared`.

**Spec:** `docs/superpowers/specs/2026-10-23-patch-garde-drakon-origines-design.md` (section 5 et section 7, mesure).

## Global Constraints

- Branche `patch-garde-origines`. Les plans 1 et 2 sont faits : le stade `ancestral` est en base (migration 011), et les mécaniques `REFLECT_DAMAGE`, `SUMMON_IF_ALL_ELEMENTS` et `COPY_GRAVEYARD_EFFECTS` existent.
- **Aucune image** pour les nouvelles cartes (`image` à null), décision du joueur.
- Nouvelles cartes, toutes `archetype: 'dragon'`, dans le set du Drakon (celui de Bébé Teros) :

  | Carte | Rareté | Stade / élément / lignée | Coût | ATK / PV | Effets |
  |---|---|---|---|---|---|
  | Ancestral Teros | legendary | ancestral / earth / teros | 4 | 800 / 3900 | Provocation et immunité aux affaiblissements à l'arrivée ; réduction 2 ; renvoi 60 % ; pioche 1 à la destruction |
  | Ancestral Feros | legendary | ancestral / fire / feros | 4 | 2100 / 1800 | Perforation et 600 dégâts à tous les ennemis à l'arrivée |
  | Ancestral Ackos | legendary | ancestral / water / ackos | 4 | 1000 / 2900 | Soin 500 aux autres alliés au début du tour ; récupère 2 cartes du cimetière à l'arrivée |
  | Ancestral Tempestu | legendary | ancestral / wind / tempestu | 4 | 1300 / 2100 | 2 attaques par tour ; renvoie en main l'ennemi le plus fort à l'arrivée |
  | Drakon des Origines | secret | aucun (null) | 4 | 1500 / 4000 | `PASSIVE SUMMON_IF_ALL_ELEMENTS` ; `ON_SUMMON SET_DEBUFF_IMMUNITY` (comme Maître Magouille) ; `ON_SUMMON COPY_GRAVEYARD_EFFECTS → PLAYER` |

  *(Valeurs : choix de Claude, environ +30 % sur l'Adulte, à régler au tournoi.)*
- Aventure, monde Drakon :
  - le boss (position 5) a pour signature et portrait le **Drakon des Origines** ;
  - les positions 1 à 4 font tomber en farm l'Ancestral de leur élément (Teros, Feros, Ackos, Tempestu) à **5 %** ;
  - le boss fait tomber le Drakon des Origines à **1 %** ;
  - le tirage légendaire du boss reste celui des légendaires du set, Ancestraux compris *(choix de Claude)*.
- Générateur Drakon :
  - un Ancestral (1 exemplaire) de l'élément de la signature **à partir du niveau 3** ;
  - quand la signature exige les 4 éléments (`requiresAllElements`), les 4 éléments, avec par élément 2 Bébés, 1 Jeune, 2 Adultes et 1 Ancestral.
- Tests de migration hors du dossier `migrations/`.

## Review Focus

1. **Le boss doit réellement pouvoir invoquer le Drakon des Origines** : son deck contient un Adulte de chacun des 4 éléments, et l'IA joue le coup quand la condition est remplie. Testé en Task 3.
2. **Récompense « carte précise » vers une carte supprimée ou introuvable** : un avertissement, rien n'est attribué, et la partie ne plante pas. Testé en Task 4.
3. **Le plafond journalier de farm s'applique aussi à la carte précise.** Testé en Task 4.
4. **Migration du monde Drakon sur une base sans ce monde**, ou déjà migrée : rien ne casse, et rien n'est fait deux fois. Testé en Task 5.
5. **Un Ancestral dans un deck de niveau 1 ou 2** : il n'y en a pas, la montée en puissance est respectée. Testé en Task 3.

---

### Task 1 : Les 5 nouvelles cartes (données)

**Files:**
- Create: `apps/backend/src/database/drakon-origines-cards.ts`. Il exporte `DrakonNewCard` (comme `BalanceNewCard`, avec en plus `stage`, `element` et `lineage`) et `DRAKON_ORIGINES_CARDS: DrakonNewCard[]`, les 5 cartes du tableau, avec descriptions.
- Create: `apps/backend/src/database/drakon-origines-cards.spec.ts`
- Modify: `apps/backend/src/fights/testing/real-cards.ts` : `allRealCards()` ajoute ces cartes, avec les identifiants `92_001…`, dans le set de Bébé Teros.
- Test: `apps/backend/src/fights/engine/origins-real-cards.spec.ts` (créé)

- [ ] **Step 1 : tests** :
  - 5 cartes, aux noms, raretés, stades, éléments et stats du tableau ; descriptions de 255 caractères au plus ; `realCard('Ancestral Feros')` existe.
  - Vraies cartes :
    - Ancestral Feros évolue sur Adulte Feros (en jeu depuis un tour précédent, 1 énergie) et inflige 600 à tous les ennemis ;
    - le Drakon des Origines est refusé avec 3 Adultes au cimetière ;
    - avec les 4 Adultes réels au cimetière (Teros, Feros, Ackos, Tempestu), il est invoqué, puis il copie Adulte Tempestu (2 attaques par tour) ;
    - il est immunisé aux affaiblissements (`isImmuneToDebuffs`).
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** jest `src/database` et `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): Drakons Ancestraux et Drakon des Origines`.

### Task 2 : Migration de création des cartes

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000013-DrakonOriginesCards.ts`
  - `up` : insère chaque carte absente (par nom) dans le set de `setOf`, avec `stage`, `element`, `lineage` et `image` à null.
  - `down` : supprime les cartes non référencées, avec les mêmes contrôles que la migration 009.
- Test: `apps/backend/src/database/drakon-origines-migration.spec.ts`

- [ ] **Step 1 : test** avec un `QueryRunner` factice :
  - `up` fait 5 `INSERT` avec `stage` / `element` / `lineage` ;
  - rejoué alors que les cartes existent, il ne fait aucun `INSERT` ;
  - sans la carte de référence du set, il avertit et n'insère rien ;
  - `down` ne supprime pas une carte référencée.
- [ ] **Step 2 :** jest → FAIL. **Step 3 :** implémenter. **Step 4 :** jest → PASS.
- [ ] **Step 5 : commit** `feat(back): migration des cartes de l'extension Drakon`.

### Task 3 : Générateur et signatures

**Files:**
- Modify: `apps/backend/src/adventure/signatures.ts` (le Drakon niveau 5 a pour signature `dragon('Drakon des Origines')`), `apps/backend/src/adventure/deck-generator.ts` (`dragonPlan`)
- Test: `apps/backend/src/adventure/deck-generator.spec.ts` (tests ajoutés)

- [ ] **Step 1 : tests** (avec `allRealCards()`) :
  - `niveaux 1 et 2 : aucun Ancestral` ;
  - `niveau 3 : 1 Ancestral de l'élément de la signature` ;
  - `boss Origines : un Adulte de chacun des 4 éléments, le Drakon des Origines, deck entre 30 et 40 cartes` ;
  - `IA : sur une partie du boss jouée jusqu'au bout avec la graine 1, la partie se termine` (pas de blocage) ;
  - `IA : quand les 4 Adultes sont au cimetière et l'Origines en main, l'invocation fait partie des candidats acceptés`.
- [ ] **Step 2 :** jest → FAIL. **Step 3 :** implémenter. **Step 4 :** jest `src/adventure` et `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): le Drakon des Origines, boss du monde Drakon`.

### Task 4 : Récompense « carte précise »

**Files:**
- Modify: `packages/shared/src/game/adventure.ts` :
  - `AdventureRewardConfig` gagne `farmCardId: number | null` et `farmCardPct: number` ;
  - les valeurs par défaut de `ADVENTURE_LEVEL_DEFAULTS` sont `null` / `0`.
- Modify: `packages/shared/src/api/adventure.ts` : la partie `farm` de l'adversaire côté joueur gagne `card: { name: string; pct: number } | null`.
- Modify: `apps/backend/src/adventure/entities/adventure-opponent.entity.ts` (colonnes `farm_card_id` en FK nullable vers `card` avec `ON DELETE SET NULL`, et `farm_card_pct`), `adventure-rules.ts` (`rollLoot` renvoie `card: boolean`), `adventure.service.ts` (attribution et affichage), `adventure-admin.service.ts` et `dto/admin-opponent.dto.ts` (lecture et écriture).
- Create: `apps/backend/src/database/migrations/1791000000014-AdventureFarmCard.ts` (colonnes et FK, avec un `down`)
- Front : les champs s'ajoutent au formulaire admin `OpponentForm`, au plus simple, pour que le front compile. L'affichage côté joueur vient au plan 4.

Règles de `rollLoot` :
- en farm sous le plafond : `card = farmCardId !== null && random() * 100 < farmCardPct` ;
- en première victoire et au plafond : `card = false`.

- [ ] **Step 1 : tests** :
  - `rollLoot` : tirage sous le taux → `card: true` ; au plafond → `false` ; en première victoire → `false` ;
  - service : une victoire de farm avec `card` attribue la carte `farmCardId` et l'ajoute au butin ;
  - si la carte est introuvable : un avertissement, pas d'attribution, pas d'exception ;
  - admin : lit et écrit `farmCardId` et `farmCardPct`.
- [ ] **Step 2 :** jest → FAIL. **Step 3 :** implémenter, puis `pnpm build:shared`. **Step 4 :** jest et `pnpm typecheck` → PASS.
- [ ] **Step 5 : commit** `feat(back): récompense « carte précise » en aventure`.

### Task 5 : Migration du monde Drakon

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000015-DrakonOriginesWorld.ts`
  - On trouve les adversaires `dragon` (signature JSON) ;
  - le boss prend la signature et le portrait du Drakon des Origines ;
  - les positions 1 à 4 reçoivent `farm_card_id` = l'Ancestral de leur élément et `farm_card_pct` = 5 ; le boss, le Drakon des Origines à 1 ;
  - les decks des 5 adversaires sont régénérés, comme la migration 010.
  - `down` : remettre la signature et le portrait du boss (Œuf Céleste) et vider `farm_card_*`. Les decks ne sont pas restaurés, comme en 010, et un journal le dit.
- Test: `apps/backend/src/database/drakon-origines-world.spec.ts`

- [ ] **Step 1 : tests** (gestionnaire TypeORM factice, ou un `QueryRunner` factice selon ce que la migration utilise) :
  - avec un monde Drakon : le boss a la nouvelle signature, et les positions 1 à 4 ont leur Ancestral à 5 % ;
  - sans monde Drakon : aucune écriture, pas d'exception ;
  - rejouée : même état, et les cartes ne sont pas recréées.
- [ ] **Step 2 :** jest → FAIL. **Step 3 :** implémenter. **Step 4 :** jest → PASS.
- [ ] **Step 5 : commit** `feat(back): monde Drakon, boss des Origines et récompenses`.

### Task 6 : Mesure du patch complet

- [ ] **Step 1 :** `pnpm --filter @pipou/backend test`, `pnpm --filter @pipou/shared test`, `lint` et `pnpm typecheck` → verts.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend tournament:generated --scale standard` (environ 1 h).
- [ ] **Step 3 :** une section « Patch Garde, Relève et Origines (Standard) » est ajoutée à `docs/superpowers/plans/2026-10-19-balance-results.md`. Elle compare au « Nouveau cerveau (Standard) » sur chaque critère de réussite du design : duels 40-60 %, Dragon à 40 % au moins contre chacun, Pipou sous 12 % de phases sans coup utile, aucune carte modifiée en « trop forte », Force Plasma et .patch hors « morte », tours par partie (+2 au plus), parties sans vainqueur. On y ajoute la valeur ajoutée des Ancestraux et du Drakon des Origines. **Commit** `docs: mesure du patch complet`.
