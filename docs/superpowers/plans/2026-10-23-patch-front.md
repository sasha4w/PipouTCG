# Patch Garde / Relève / Origines — plan 4 : front (et passerelle)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rendre le patch jouable et lisible par un joueur humain :
- la Relève passe par le socket ;
- les nouveaux effets ont leur texte ;
- la Garde montre son compteur et sa contre-offensive ;
- la Relève se choisit à l'invocation ;
- la carte précise se règle dans l'admin et s'affiche dans l'aventure.

**Architecture:** React 18 + TanStack Query (`apps/frontend`, règles dans `apps/frontend/CLAUDE.md`). Le texte d'effet vient de `features/fight/effectText.ts` (tables `ACTIONS`, mots-clés `KEYWORD_ICON`, traductions fr / en / ko). Pas de nouvelle requête serveur : les données arrivent déjà par l'état de partie, et par les vues d'aventure et d'admin.

**Tech Stack:** React 18, TypeScript strict, Vitest + Testing Library, i18next ; NestJS (passerelle Socket.io).

**Spec:** `docs/superpowers/specs/2026-10-23-patch-garde-drakon-origines-design.md` (sections 1, 3, 5, « Visuels » et les reports du plan 3).

## Global Constraints

- Branche `patch-garde-origines`.
- **Pas d'emoji pour les nouveaux mots-clés et les nouveaux écrans : des icônes SVG** (`KeywordIcon`, `components/Icons.tsx`). C'est la préférence du joueur.
- Toute chaîne visible passe par i18n, en **fr, en et ko**.
- Données serveur : TanStack Query, clés de `QUERY_KEYS`, et pas de `useEffect` qui recopie une valeur (règles du `CLAUDE.md` front).
- Types et contrat d'API depuis `@pipou/shared`.
- Les nouvelles cartes n'ont pas d'image : l'affichage existant sans image est conservé.
- `pnpm --filter @pipou/frontend test`, `typecheck`, `lint` et `build` restent verts ; côté back, `pnpm --filter @pipou/backend test`.

## Review Focus

1. **Relève quand le terrain est plein** : cliquer la zone d'un allié Pipou doit ouvrir le choix de la Relève, avec cet allié déjà coché et impossible à décocher, puisque le monstre arrive dans sa zone. Testé en Task 4.
2. **Relève alors qu'on n'a pas assez d'alliés Pipou** : l'option n'est pas proposée. Le paiement normal reste disponible s'il est possible. Testé en Task 4.
3. **Carte Ancestrale ou Drakon des Origines dans le glossaire ou la fiche d'effet** : chacune a sa règle de pose lisible (« par évolution d'un Adulte », « avec un Adulte ou un Ancestral de chaque élément au cimetière »), jamais « Effet spécial ». Testé en Task 2.
4. **Monstre adverse en Garde** : le compteur s'affiche aussi chez l'adversaire. La contre-offensive n'est annoncée que pour un monstre en Garde. Testé en Task 3.
5. **Admin, carte précise remise à « aucune »** : le taux est envoyé à 0 avec la carte `null`. Testé en Task 5.

---

### Task 1 : La Relève passe par le socket

**Files:**
- Modify: `packages/shared/src/socket/fight.ts` (`SummonPayload.releveInstanceIds?: string[]`), `apps/backend/src/fights/fights.gateway.ts` (transmettre au moteur), `apps/frontend/src/features/fight/emitGameAction.ts` (émettre le champ s'il est présent)
- Test: `apps/frontend/src/__tests__/unit/emitGameAction.test.ts`, et un test de passerelle côté back (spec de la passerelle s'il existe, sinon un test de `play` avec un faux socket)

- [ ] **Step 1 : tests** :
  - front : une action `summon` avec `releveInstanceIds: ['a', 'b']` émet `fight:summon` avec ce champ ; sans le champ, le message ne le contient pas ;
  - back : `fight:summon` reçu avec `releveInstanceIds` arrive au moteur avec ce champ.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter, puis `pnpm build:shared`. **Step 4 :** PASS.
- [ ] **Step 5 : commit** `feat: la Relève passe par le socket`.

### Task 2 : Texte des nouveaux effets

**Files:**
- Modify: `apps/frontend/src/features/fight/effectText.ts` :
  - `ACTIONS` gagne `REFLECT_DAMAGE` (buff, monstre, valeur en %, mot-clé `reflect`), `RELEVE` (carte, valeur N, mot-clé `releve`), `SUMMON_IF_ALL_ELEMENTS` (carte) et `COPY_GRAVEYARD_EFFECTS` (joueur) ;
  - `KEYWORD_ICON` gagne `reflect` et `releve`, en SVG via `KeywordIcon` ;
  - la règle de pose « par évolution » couvre aussi `ancestral` ;
  - une règle de pose pour une carte `SUMMON_IF_ALL_ELEMENTS`.
- Modify: `apps/frontend/src/features/fight/KeywordIcon.tsx` (2 icônes SVG), `apps/frontend/src/i18n/locales/{fr,en,ko}.json` (actions, mots-clés, glossaire, `effects.stage.ancestral`)
- Test: `apps/frontend/src/__tests__/unit/effectText.test.ts`

- [ ] **Step 1 : tests** (avec les effets des vraies cartes recopiés en données de test) :
  - Jeune Teros : une ligne de renvoi « 40 % » et le mot-clé `reflect` ;
  - Général Chatouille : une ligne de Relève « 2 » et le mot-clé `releve` ;
  - Ancestral Feros : la règle de pose par évolution ;
  - Drakon des Origines : la règle de pose des 4 éléments et une ligne de copie ;
  - aucune ligne ne contient « Effet spécial » pour ces 4 cartes.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS, et le test d'i18n existant reste vert.
- [ ] **Step 5 : commit** `feat(front): texte du renvoi, de la Relève et du Drakon des Origines`.

### Task 3 : La Garde visible sur le terrain

**Files:**
- Modify: `apps/frontend/src/features/fight/Zonerow/MonsterZoneContent.tsx` (pastille), `zoneRow.effects.tsx` (lignes d'état), i18n
- Test: `apps/frontend/src/__tests__/unit/zoneRow.effects.test.ts`

Règle d'affichage : un monstre en Garde (`mode === 'guard'`) affiche `guardTurns` / `GUARD_MAX_TURNS` et la contre-offensive à venir, soit `COUNTER_OFFENSIVE_PER_TURN × min(guardTurns, GUARD_MAX_TURNS)`, si elle est positive. Un monstre qui vient de sortir de Garde (`guardCooldown`) affiche « retour en Garde au prochain tour ». Un monstre qui a un renvoi (`reflectPercent`) l'affiche dans ses lignes d'état.

- [ ] **Step 1 : tests** :
  - Garde avec `guardTurns: 1` → ligne « 1/2 », plus contre-offensive +100 ;
  - `guardTurns: 0` → pas de contre-offensive ;
  - en Attaque → rien sur la Garde ;
  - `guardCooldown` → ligne de délai ;
  - `reflectPercent: 50` → ligne de renvoi 50 %.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (pastille SVG sur la carte, comme l'œuf). **Step 4 :** PASS.
- [ ] **Step 5 : commit** `feat(front): compteur de Garde, contre-offensive et renvoi affichés`.

### Task 4 : Choisir la Relève à l'invocation

**Files:**
- Modify: `apps/frontend/src/features/fight/SummonCostModal.tsx` (un mode Relève : liste des alliés Pipou à cocher, N exactement), `useBoardControls.ts` (`summonAt` reçoit `releveInstanceIds`), `FightBoard.tsx` (une carte Relève sélectionnée rend cliquables les zones d'alliés Pipou)
- Test: `apps/frontend/src/__tests__/unit/useBoardControls.test.ts`, et un test de composant `SummonCostModal`

Règles :
- **Quand le mode Relève est proposé** : la carte a la Relève (`releveCount`) et j'ai au moins N alliés Pipou non implantés. Il est choisi d'office si la zone cliquée est occupée.
- **La zone cliquée** : si elle est occupée par un allié, cet allié est coché et verrouillé.
- **Validation** : possible quand exactement N alliés sont cochés. On envoie `summon` avec `paymentHandIndices: []` et `releveInstanceIds`.
- **Le paiement normal reste disponible** sur une zone libre.

- [ ] **Step 1 : tests** :
  - la fenêtre propose le mode Relève avec 3 alliés Pipou ; ne le propose pas avec 1 seul ;
  - la validation est désactivée tant que moins de N alliés sont cochés ;
  - un clic sur une zone occupée coche et verrouille son allié ;
  - `summonAt` envoie `releveInstanceIds` et `paymentHandIndices: []`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter (textes i18n, icônes SVG). **Step 4 :** PASS.
- [ ] **Step 5 : commit** `feat(front): invoquer par la Relève`.

### Task 5 : Carte précise dans l'admin et dans l'aventure

**Files:**
- Modify: `apps/frontend/src/features/adventure/admin/OpponentForm.tsx` (liste « carte précise » parmi les cartes du set, avec « Aucune »), `apps/frontend/src/features/adventure/OpponentSheet.tsx` (une ligne de drop : nom de la carte et taux), i18n
- Test: `OpponentSheet.test.tsx`, et un test de `OpponentForm` (créé s'il n'existe pas)

- [ ] **Step 1 : tests** :
  - la fiche avec `farm.card = { name: 'Ancestral Feros', pct: 5 }` affiche le nom et « 5 % » ; avec `null`, rien ;
  - le formulaire envoie `farmCardId` choisi et son taux ; « Aucune » envoie `farmCardId: null` et `farmCardPct: 0`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS.
- [ ] **Step 5 : commit** `feat(front): carte précise dans l'admin et la fiche d'adversaire`.

### Task 6 : Vérification

- [ ] **Step 1 :** `pnpm --filter @pipou/frontend test`, `typecheck`, `lint` et `build` ; `pnpm --filter @pipou/backend test` → verts.
- [ ] **Step 2 :** lancer l'application (skill `run`) pour vérifier à l'écran :
  - une partie avec un monstre en Garde : le compteur s'affiche ;
  - la fiche d'effet d'un Teros : le texte du renvoi ;
  - la fiche du boss Drakon : la carte précise.

  Si l'application ne démarre pas en local (base de données), le noter et s'en tenir aux tests.
