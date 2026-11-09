# Phase de contrôle interactive — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** en phase de contrôle (`phase === 'end'`), autoriser supports, invocation par Relève, invocation du Drakon des Origines (`SUMMON_IF_ALL_ELEMENTS`) et évolution, en gardant l'invocation normale interdite.

**Architecture :** une règle partagée dans `@pipou/shared` dit quelles invocations sont « spéciales ». Le moteur (services) accepte `end` pour les actions autorisées. Le front et l'IA réutilisent la même règle.

**Tech Stack :** NestJS 11 / Jest (backend), React 18 / Vitest (frontend), `@pipou/shared`.

**Spec :** `docs/superpowers/specs/2026-11-09-phase-controle-design.md`

## Global Constraints

- Tout type ou helper commun front/back vit dans `@pipou/shared` ; `pnpm build:shared` après modification.
- Travail sur la branche `dev`, jamais `main`.
- UI : icônes SVG, jamais d'emoji. Textes en FR, EN et KO (`apps/frontend/src/i18n/locales/{fr,en,ko}.json`).
- Interdit en `end` : invocation normale (y compris gratuite via `freeSummonInstanceIds` et sur terrain adverse), `attack`, `change_mode`, `recycle`, `transform`.
- `end_phase` reste refusé tant que `hand.length > HAND_LIMIT`.

## Review Focus

1. Relève en `end` avec la main au-dessus de `HAND_LIMIT` : l'invocation doit passer (elle réduit la main), puis la défausse reste exigée seulement si la main dépasse encore.
2. Invocation normale tentée en `end` avec `releveInstanceIds: []` (tableau vide) : doit être refusée, pas acceptée comme Relève.
3. Front : en `end`, toucher des cartes de la main après en avoir sélectionné une pour évoluer doit les ajouter au paiement, pas changer la sélection — mais si la carte sélectionnée n'est jouable d'aucune façon, le comportement actuel (sélection pour « Défausser ») doit rester.
4. Timeout en `end` (`game-engine.ts` ~l.112) : défausse auto inchangée, même si un choix d'effet (`pick_cards`) a été ouvert par un support joué en `end`.
5. IA en `end` avec main trop pleine : doit pouvoir jouer support/Relève/évolution **ou** défausser, et ne jamais boucler sans `end_phase` possible.

Chaque point a son test dans la tâche qui possède le code (1, 2, 4 → Tâche 2 ; 3 → Tâche 4 ; 5 → Tâche 3).

---

### Task 1 : règle partagée `isSpecialSummon`

**Files :**
- Modify : `packages/shared/src/game/rules.ts` (près de `requiresAllElements`, ~l.267)
- Test : `packages/shared/src/game/rules.test.ts`

**Interfaces :**
- Produces : `export function isSpecialSummon(card: { effects: CardEffect[] | null | undefined }, releveInstanceIds?: string[]): boolean` — `true` si `releveInstanceIds?.length > 0` ou `requiresAllElements(card.effects)`. Exportée depuis l'index de `@pipou/shared` comme les autres règles.
- Produces : `export function isBoardPhase(phase: GamePhase): boolean` — `phase === 'main' || phase === 'end'`.

- [ ] **Step 1 : tests qui échouent** dans `rules.test.ts` :
  - `isSpecialSummon({ effects: [] })` → `false`
  - `isSpecialSummon({ effects: [] }, [])` → `false`
  - `isSpecialSummon({ effects: [] }, ['a'])` → `true`
  - carte avec effet PASSIVE `SUMMON_IF_ALL_ELEMENTS`, sans Relève → `true`
  - `isBoardPhase('main')`, `isBoardPhase('end')` → `true` ; `'battle'`, `'mulligan'` → `false`
- [ ] **Step 2 :** `pnpm --filter @pipou/shared test` → FAIL (fonctions absentes).
- [ ] **Step 3 :** implémenter les deux fonctions.
- [ ] **Step 4 :** `pnpm --filter @pipou/shared test` → PASS ; `pnpm build:shared`.
- [ ] **Step 5 :** commit `feat(shared): règles isSpecialSummon et isBoardPhase`.

### Task 2 : moteur — actions autorisées en phase de contrôle

**Files :**
- Modify : `apps/backend/src/fights/services/support.service.ts:53` (`playSupport`)
- Modify : `apps/backend/src/fights/services/evolution.service.ts:34`
- Modify : `apps/backend/src/fights/services/summon.service.ts:137` (`doSummon`)
- Test (nouveau) : `apps/backend/src/fights/engine/control-phase.spec.ts`

**Interfaces :**
- Consumes : `isSpecialSummon`, `isBoardPhase` (Tâche 1).
- Produces : messages d'erreur exacts, réutilisés par les tests :
  - phase hors main/end pour support/évolution : `'Phase principale ou de contrôle uniquement'`
  - invocation normale en `end` : `'Invocation normale interdite en phase de contrôle'`

- [ ] **Step 1 : tests qui échouent** dans `control-phase.spec.ts`, avec `scenario({ phase: 'end', ... })` et `createEngine().dispatch(game, 'p1', action)` (voir `garde-real-cards.spec.ts` pour le style) :
  - `play_support` d'un support simple en `end` → pas d'`error`, carte en zone support.
  - `evolve` d'un Bébé Drakon posé (pouvant évoluer) en `end` → pas d'`error`, monstre évolué.
  - `summon` avec `releveInstanceIds` valides (Général Chatouille, cf. `garde-real-cards.spec.ts:192`) en `end` → pas d'`error`.
  - `summon` du Drakon des Origines, cimetière avec Adulte de chaque élément, en `end` → pas d'`error`.
  - `summon` normal en `end` → `error === 'Invocation normale interdite en phase de contrôle'`.
  - `summon` normal en `end` avec `releveInstanceIds: []` → même erreur. *(Review Focus 2)*
  - `summon` d'une carte présente dans `freeSummonInstanceIds` en `end` → même erreur.
  - `recycle`, `transform`, `change_mode` en `end` → `error` défini, état inchangé.
  - main à `HAND_LIMIT + 1`, Relève en `end` → réussit ; puis `end_phase` réussit si la main est revenue à `HAND_LIMIT`. *(Review Focus 1)*
  - support qui ouvre un choix `pick_cards` joué en `end`, puis `engine.timeout(game)` (nom réel à vérifier dans `game-engine.ts` ~l.100) → choix résolu d'office, tour passé à l'adversaire. *(Review Focus 4)*
- [ ] **Step 2 :** `pnpm --filter @pipou/backend test -- control-phase` → FAIL.
- [ ] **Step 3 :** dans `playSupport` et `evolve`, remplacer `game.phase !== 'main'` par `!isBoardPhase(game.phase)` avec le nouveau message. Dans `doSummon` : `main` inchangé ; en `end`, accepter seulement si `isSpecialSummon(card.baseCard, releveInstanceIds)` (le test se place après la lecture de `card`, avant le paiement) ; autres phases : erreur actuelle. Ne pas toucher `recycleFromHand`, `transformFromHand`, `changeMode`.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend test` → PASS (suite complète : vérifier qu'aucun test existant n'attendait l'ancien message ; les mettre à jour sinon).
- [ ] **Step 5 :** commit `feat(fights): supports, Relève, Origines et évolution en phase de contrôle`.

### Task 3 : IA — candidats en phase de contrôle

**Files :**
- Modify : `apps/backend/src/fights/ai/candidate-actions.ts:106-112`
- Vérifier : `apps/backend/src/fights/ai/ai-player.ts:52,364`, `telemetry.ts:285`
- Test : `apps/backend/src/fights/ai/candidate-actions.spec.ts` (créer si absent, sinon ajouter au spec existant de l'IA)

**Interfaces :**
- Consumes : `isSpecialSummon` (Tâche 1), comportement moteur de la Tâche 2.
- Produces : `function controlCandidates(me: PlayerGameState, opp: PlayerGameState): GameAction[]` — `mainCandidates(me, opp)` filtré : garde `play_support`, `evolve`, et `summon` dont `isSpecialSummon(me.hand[a.handIndex].baseCard, a.releveInstanceIds)` ; retire tout le reste.

- [ ] **Step 1 : tests qui échouent** sur `listCandidates(game, 'p1')` en `end` :
  - contient un `play_support` quand un support est en main ;
  - contient un `summon` avec `releveInstanceIds` quand la Relève est possible ;
  - ne contient aucun `summon` sans Relève (hors Origines), aucun `recycle`, `transform`, `change_mode`, `attack` ;
  - main ≤ `HAND_LIMIT` : contient `end_phase` ;
  - main > `HAND_LIMIT` : contient les `discard` **et** les coups de `controlCandidates`, pas `end_phase`. *(Review Focus 5)*
- [ ] **Step 2 :** `pnpm --filter @pipou/backend test -- candidate-actions` → FAIL.
- [ ] **Step 3 :** case `'end'` = `[...controlCandidates(me, opp), ...(main trop pleine ? discards : [{ type: 'end_phase' }])]`. Ajuster `ai-player.ts:364` (`after.phase !== 'main'`) pour accepter `isBoardPhase(after.phase)` si ce test évalue un coup joué en `end`.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend test` → PASS, dont `ai-player.spec.ts` et `fights-pve.spec.ts` (une partie IA complète doit toujours finir).
- [ ] **Step 5 :** commit `feat(ai): l'IA réorganise son board en phase de contrôle`.

### Task 4 : front — interactions en phase de contrôle

**Files :**
- Modify : `apps/frontend/src/features/fight/FightBoard.tsx` (l.281, 352, 469-486, 514, 584, 611, 951-991)
- Modify : `apps/frontend/src/features/fight/FightHand.tsx:76`, `FightActionBar.tsx:36-38`, `mainSlot.ts:41`
- Modify : `apps/frontend/src/features/fight/phaseOptions.ts` / `PhaseMenu.tsx` (texte de phase)
- Modify : `apps/frontend/src/i18n/locales/{fr,en,ko}.json`
- Test : `apps/frontend/src/__tests__/components/FightBoard.test.tsx`, `apps/frontend/src/__tests__/fight/FightActionBar.test.tsx`

**Interfaces :**
- Consumes : `isBoardPhase`, `isSpecialSummon`, `requiresAllElements`, `graveyardHasAllElements`, `releveCount` (`@pipou/shared`).
- Produces : rien pour les autres tâches.

Comportement attendu en `end`, à ton tour :
- Toucher une carte de la main la sélectionne (même hors main trop pleine). Une deuxième carte touchée s'ajoute au paiement **seulement** si la carte sélectionnée a une évolution possible ou est le Drakon des Origines invocable ; sinon elle remplace la sélection.
- Carte sélectionnée : surbrillance des cibles comme en `main` pour support (zone/équipement/ciblage), évolution, Relève et Origines. Pas d'option d'invocation normale, ni sur terrain adverse.
- Barre d'action : bouton secondaire « Défausser » (existant, `kind: "discard"`) toujours présent pour la carte sélectionnée ; pas de « Recycler », pas de « Transformer ».
- Mode Garde/Attaque masqué (l.951 inchangée : reste `phase === "main"`).
- Texte de phase : clé `fight.phase.endHint` — FR « Réorganise ton board : supports, Relève, évolution. Défausse si ta main est pleine. » ; EN « Rearrange your board: supports, Relève, evolution. Discard if your hand is full. » ; KO « 보드를 재정비하세요: 지원, 릴레이, 진화. 손패가 가득 차면 버리세요. »

- [ ] **Step 1 : tests qui échouent** (`FightBoard.test.tsx`, état `phase: 'end'`, `isMyTurn: true`) :
  - sélectionner un support puis toucher une zone support → `emit` reçoit `{ type: 'play_support', ... }`.
  - sélectionner un Drakon évolutif, toucher une carte de paiement puis le Bébé ciblé → `emit` reçoit `{ type: 'evolve', paymentHandIndices: [i] }`. *(Review Focus 3)*
  - sélectionner un monstre normal puis toucher une zone libre → aucun `summon` émis.
  - sélectionner une carte non jouable puis une autre → la sélection change (pas d'ajout au paiement). *(Review Focus 3)*
  - le bouton « Transformer » et le menu de mode sont absents ; « Défausser » présent.
- [ ] **Step 2 :** `pnpm --filter @pipou/frontend test -- FightBoard FightActionBar` → FAIL.
- [ ] **Step 3 :** remplacer les gardes `phase === "main"` concernées par `isBoardPhase(phase)` (cibles d'évolution l.352, supports l.978-991, clic zone l.514 pour évolution/Relève/Origines) ; dans la branche d'invocation, en `end`, n'autoriser que si `isSpecialSummon`. Réécrire la branche `end` de l.482 selon la règle de sélection ci-dessus. Ajouter les traductions.
- [ ] **Step 4 :** `pnpm --filter @pipou/frontend test` et `pnpm typecheck` → PASS.
- [ ] **Step 5 :** commit `feat(fight): interactions de board en phase de contrôle`.

### Task 5 : vérification globale

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → tout vert.
- [ ] Partie manuelle (`pnpm dev`) contre l'IA : en phase de contrôle, jouer un support, une Relève, une évolution ; vérifier qu'une invocation normale est impossible et que la défausse reste exigée.
