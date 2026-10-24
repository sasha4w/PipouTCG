# Patch Garde / Relève / Origines — plan 2 : données des cartes existantes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** appliquer aux 15 cartes existantes les valeurs du design (Tactique Gang Gang, Force Plasma, Mise à jour .patch, Canon à Particules, Surcharge Overclock, Œuf Céleste, lignée Teros, murs à Provocation, Relève), ajouter le stade `ancestral` à la base, et mesurer l'effet au tournoi.

**Architecture:** un module de patchs `apps/backend/src/database/garde-2026-10-patches.ts` au format `BalancePatch` (avant / après, avec le garde `planBalancePatch` existant), appliqué par une migration. `fights/testing/real-cards.ts` applique ces patchs, pour que les tests et le tournoi jouent les nouvelles cartes. Une seconde migration élargit l'enum `card.stage`.

**Tech Stack:** NestJS 11, TypeORM (MySQL), Jest.

**Spec:** `docs/superpowers/specs/2026-10-23-patch-garde-drakon-origines-design.md` (sections 2, 3, 4 ; « Premier point du plan 2 »).

## Global Constraints

- Branche `patch-garde-origines`. Le plan 1 est fait : `REFLECT_DAMAGE`, `RELEVE`, la condition `SPECIFIC_CARD_ON_BOARD` avec `match: 'contains'` et la Garde limitée existent.
- Valeurs du design :

  | Carte | Changement |
  |---|---|
  | Tactique Gang Gang | `BUFF_ATK` 300 vers `ARCHETYPE_ALLIES` au lieu de `ALL_ALLIES` |
  | Force Delta → **Force Plasma** | condition `SPECIFIC_CARD_ON_BOARD`, `value: 'Noyau'`, `match: 'contains'` |
  | Mise à jour .patch | + `RETURN_FROM_GRAVEYARD` → `PLAYER`, `value: 2`, filtre `{ type: 'monster', archetype: 'pixelman' }` |
  | Canon à Particules .vxd | `BUFF_ATK` 400 → **250**, et le champ `atk` 400 → 250 |
  | Surcharge Overclock | + `DEAL_DAMAGE` → `ALL_ALLIES` 200 |
  | Œuf Céleste | `SET_HATCH_COUNTER` 4 → **3** ; + `ON_TURN_START` : `HEAL` → `ARCHETYPE_ALLIES` 100 |
  | Bébé / Jeune / Adulte Teros | + `PASSIVE REFLECT_DAMAGE` **30 / 40 / 50** ; + `ON_DEATH DRAW` → `PLAYER` 1 |
  | Sentinelle Gargouille, Capitaine Gribouille, Mastodonte Grossebouille, Noyau Alpha | + `ON_DEATH DRAW` → `PLAYER` 1 |
  | Général Chatouille, Champion Ouille-Ouille, Mastodonte Grossebouille | + `PASSIVE RELEVE`, `value: 2` |

- Descriptions de 255 caractères au plus (colonne `varchar`), qui reprennent le texte actuel et ajoutent la règle nouvelle.
- Une migration ne modifie jamais une carte qui diffère de l'attendu (`skip-diverged`, avec un avertissement).
- Pas de nouvelle carte ici (Ancestraux et Origines : plan 3).

## Review Focus

1. **Surcharge Overclock qui tue un allié** à 200 PV ou moins : il va au cimetière, et l'adversaire ne gagne pas de Prime. Testé en Task 3.
2. **Tactique Gang Gang dans un deck mixte** : un allié non Pipou ne reçoit pas le bonus. Testé en Task 3.
3. **Œuf Céleste** : il soigne, sans dépasser les PV max, et éclot bien au bout de 3 tours. Testé en Task 3.
4. **Migration rejouée** sur une base déjà à jour (`already-done`), ou sur une carte modifiée à la main (`skip-diverged`). Testé en Task 2.
5. **Rename Force Delta → Force Plasma** : la migration retrouve la carte par son ancien nom, et le `down` par le nouveau. Testé en Task 2.

---

### Task 1 : Migration du stade `ancestral`

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000011-AncestralStage.ts`
- Test: `apps/backend/src/database/migrations/ancestral-stage.spec.ts` (créé)

`up` : ``ALTER TABLE `card` MODIFY `stage` enum ('egg', 'baby', 'young', 'adult', 'ancestral') NULL DEFAULT NULL``.

`down` : d'abord ``UPDATE `card` SET `stage` = 'adult' WHERE `stage` = 'ancestral'``, puis l'enum sans `ancestral`.

- [ ] **Step 1 : test** : un `QueryRunner` factice qui enregistre les requêtes. `up` émet une seule requête qui contient `'ancestral'`. `down` émet l'`UPDATE`, puis un `MODIFY` sans `ancestral`.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** jest → PASS.
- [ ] **Step 5 : commit** `feat(back): stade ancestral en base`.

### Task 2 : Module de patchs

**Files:**
- Create: `apps/backend/src/database/garde-2026-10-patches.ts` (`export const GARDE_PATCHES: BalancePatch[]`, qui réutilise `BalancePatch`, `tweak` et `planBalancePatch` de `balance-2026-10-patches.ts` ; `tweak` est exporté s'il ne l'est pas)
- Create: `apps/backend/src/database/garde-2026-10-patches.spec.ts`
- Modify: `apps/backend/src/fights/testing/real-cards.ts` : l'actuel `allRealCards` devient `allRealCardsBeforeGarde()`, et `allRealCards()` lui applique `GARDE_PATCHES`.

- [ ] **Step 1 : tests** (modèle `balance-2026-10-patches.spec.ts`) :
  - chaque `before` correspond à `allRealCardsBeforeGarde()` ;
  - up puis down (`apply` / `already-done` / `skip-diverged`) ;
  - chaque patch change quelque chose ;
  - descriptions de 255 caractères au plus ;
  - 15 patchs, avec les noms du tableau ;
  - Force Plasma : `before.name === 'Force Delta'` et `after.name === 'Force Plasma'`.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter les 15 patchs et `allRealCards`.
- [ ] **Step 4 :** jest `src/database` et `src/fights` → PASS. Si un test de vraies cartes existant suppose les anciennes valeurs (Œuf en 4 tours, Canon à +400…), on adapte l'assertion à la nouvelle valeur et on le consigne.
- [ ] **Step 5 : commit** `feat(back): données du patch Garde, Relève et Teros`.

### Task 3 : Comportement des vraies cartes

**Files:**
- Test: `apps/backend/src/fights/engine/garde-real-cards.spec.ts` (créé, avec `realCard(name)`)

- [ ] **Step 1 : tests** sur les vraies cartes après patch :
  - Tactique Gang Gang : un allié Pipou gagne +300 ATK, un allié Drakon rien ;
  - Force Plasma : jouable avec Noyau Alpha en jeu, refusée sans Noyau ;
  - Mise à jour .patch : propose jusqu'à 2 monstres Pixelman du cimetière ;
  - Canon à Particules .vxd : +250 ATK ;
  - Surcharge Overclock : les alliés ont +500 ATK et −200 PV ; un allié à 200 PV ou moins va au cimetière sans Prime pour l'adversaire ;
  - Œuf Céleste : éclot au 3ᵉ début de tour de son propriétaire ; soigne un Drakon blessé de 100, sans dépasser ses PV max ;
  - Jeune Teros : renvoie 40 % (après sa réduction) et fait piocher 1 carte à sa destruction ;
  - Sentinelle Gargouille détruite : son propriétaire pioche 1 carte ;
  - Général Chatouille : invocable par Relève (2) sur un terrain plein de Pipou.
- [ ] **Step 2 :** jest. Ces tests portent sur les données de la Task 2 : ils doivent être verts. S'il y en a un rouge, c'est un défaut de données ou de moteur, à corriger avec une décision consignée.
- [ ] **Step 3 : commit** `test(back): vraies cartes du patch Garde`.

### Task 4 : Migration des données

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000012-GardeRelevePatch.ts` (même structure que `1791000000009-BalanceDrakonPixelman.ts`, sans création de cartes)
- Test: `apps/backend/src/database/migrations/garde-patch.spec.ts`

- [ ] **Step 1 : test** avec un `QueryRunner` factice qui sert, par nom, les lignes de `before` :
  - `up` émet 15 `UPDATE`, avec le nouveau nom pour Force Delta ;
  - rejoué sur des lignes déjà `after`, `up` n'émet aucun `UPDATE` ;
  - une ligne modifiée à la main n'est pas touchée.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** jest → PASS.
- [ ] **Step 5 : commit** `feat(back): migration du patch Garde, Relève et Teros`.

### Task 5 : Mesure

- [ ] **Step 1 :** `pnpm --filter @pipou/backend test`, `lint` et `pnpm typecheck` → verts.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend tournament:generated --scale rapide`. On compare au Rapide du plan 1 : taux par archétype, tours par partie, parties sans vainqueur, phases Pipou sans coup utile, alertes sur les cartes patchées.
- [ ] **Step 3 :** une section « Patch Garde — plan 2 (Rapide) » est ajoutée à `docs/superpowers/plans/2026-10-19-balance-results.md`. **Commit** `docs: mesure du plan 2 du patch`. Le Standard complet viendra après le plan 3, avec les Ancestraux et le Drakon des Origines.
