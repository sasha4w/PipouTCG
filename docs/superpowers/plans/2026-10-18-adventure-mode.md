# Mode Aventure (PvE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un mode Aventure : 1 monde par card_set, 5 IA par monde, récompenses de première victoire + farm plafonné, nouveaux succès et quêtes PvE, admin complet.

**Architecture:** Un module NestJS `adventure` possède les données (mondes, IA, decks, parties PvE), les règles pures (déblocage, récompenses, génération de decks) et l'admin. L'IA (`fights/ai/`) choisit ses actions en **simulant** chaque action candidate sur une copie de l'état avec le vrai `GameEngine`, puis en notant le résultat ; elle ne réimplémente aucune règle. `FightsService` héberge les parties PvE à côté des parties JcJ (même socket `fight`, mêmes actions), avec un pilote d'IA, un id de match négatif et une fin de partie routée vers `AdventureService` au lieu de `GameEndService`.

**Tech Stack:** NestJS 11, TypeORM (MySQL), Socket.io, Jest (back) ; React 18 + TanStack Query + Vitest (front) ; `@pipou/shared` (Vitest).

**Spec:** `docs/superpowers/specs/2026-10-18-adventure-mode-design.md` — à lire avant toute tâche.

## Global Constraints

- Branche `dev`. Commits conventionnels terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tout type/enum échangé front↔back vit dans `@pipou/shared` ; `@pipou/shared` n'a aucune dépendance runtime. Après modif : `pnpm build:shared`.
- **Icônes SVG uniquement, aucun emoji** dans l'UI ajoutée (icônes dans `apps/frontend/src/components/Icons.tsx`). Les logs de partie existants ne sont pas concernés.
- Front : données serveur via TanStack Query uniquement, clés dans `utils/querykeys.ts`, erreurs via `apiErrorMessage`, pas de `any`, i18n fr/en/ko pour tout texte.
- Schéma : une migration TypeORM (`apps/backend/src/database/migrations/1791000000008-Adventure.ts`), jamais de `synchronize` en prod.
- 5 IA par monde, niveau = position 1..5, niveau 5 = boss.
- Plafond farm par défaut **20**/jour, remise à zéro à `RESET_HOUR` ([quest-schedule.ts](../../../apps/backend/src/quests/quest-schedule.ts)) ; une 1re victoire ne consomme pas le plafond.
- Défaut de récompenses par niveau (or/XP 1re victoire ; or/XP farm ; % booster farm ; % légendaire farm) : 1 → 100/50, 15/10, 3, 0 · 2 → 150/80, 20/15, 4, 0 · 3 → 200/120, 30/20, 5, 0 · 4 → 300/180, 40/30, 7, 0 · 5 → 500/300, 60/40, 10, 2.
- 1re victoire : +1 booster du monde ; boss : +1 légendaire aléatoire du set.
- Parties PvE : aucune écriture dans `match` / `player_stats`, pas d'événement `fight.finished`.
- 3 timeouts consécutifs du joueur en PvE = défaite (`endReason` `surrender`).
- Decks IA : 30–40 cartes, ≤ 3 exemplaires, cartes du set du monde uniquement (`DECK_RULES` de `@pipou/shared`).
- Un monde n'est actif que si son set a un booster de récompense **et** ≥ 1 carte `legendary`.

## Review Focus

- **Deux onglets / deux parties** : un joueur déjà en partie (JcJ ou PvE) qui lance `adventure:start` reçoit une erreur, aucune 2e partie n'est créée (test Task 7).
- **Courses sur la fin de partie** : surrender pendant qu'une action d'IA est programmée → une seule persistance, pas de récompense en double, le timer d'IA est annulé (test Task 7).
- **IA dans un état sans action utile** (main vide, terrain plein, choix en attente côté IA, phase `end` avec main > limite) : elle finit toujours par `end_phase`/`discard`/`pick_cards` valide, jamais d'exception (tests Task 6).
- **Plafond à la frontière** : la 20e victoire farm du jour est payée, la 21e non ; une victoire juste après `RESET_HOUR` repart à 0 (test Task 4).
- **Admin qui casse un monde en cours** : deck IA édité sous 30 cartes ou monde désactivé → `adventure:start` refuse proprement, les parties déjà lancées se terminent normalement (tests Task 8 et Task 10).

---

### Task 1: Contrat partagé

**Files:**
- Modify: `packages/shared/src/enums/achievement.ts`, `packages/shared/src/enums/quest.ts`, `packages/shared/src/game/achievements.ts`, `packages/shared/src/socket/fight.ts`, `packages/shared/src/api/index.ts`
- Create: `packages/shared/src/api/adventure.ts`, `packages/shared/src/game/adventure.ts` (+ export dans `game/index.ts`)
- Test: `packages/shared/src/game/achievements.test.ts`, `packages/shared/src/game/adventure.test.ts`, `packages/shared/src/socket/*.test-d.ts` existant

**Interfaces — Produces:**
- `AchievementFamily.ADVENTURE_WORLDS | PVE_WON | PVE_PLAYED` (valeurs = clés).
- `ALL_WORLDS = "ALL_WORLDS"` ; `AchievementThreshold = number | typeof ALL_SETS | typeof ALL_WORLDS`.
- `QuestConditionType.WIN_PVP_FIGHT | WIN_PVE_FIGHT | PLAY_PVP_FIGHT | PLAY_PVE_FIGHT`.
- `game/adventure.ts` :
  - `ADVENTURE_OPPONENTS_PER_WORLD = 5`, `ADVENTURE_BOSS_LEVEL = 5`, `ADVENTURE_DAILY_CAP_DEFAULT = 20`
  - `interface AdventureRewardConfig { firstWinGold; firstWinXp; farmGold; farmXp; farmBoosterPct; farmLegendaryPct }` (nombres)
  - `ADVENTURE_LEVEL_DEFAULTS: Record<1|2|3|4|5, AdventureRewardConfig>` (valeurs des Global Constraints)
  - `AdventureArchetype = "pipou" | "pixelman" | "dragon"`
- `api/adventure.ts` :
  - `AdventureOpponentState = "beaten" | "available" | "locked"`
  - `AdventureLoot { gold; xp; boosters: { boosterId; name; quantity }[]; cards: { cardId; name; rarity; imageUrl: string | null }[]; capped: boolean }`
  - `AdventureOpponentView { id; position; level; name; quote; portrait: { cardId; imageUrl: string | null }; state; wins; isBoss: boolean; firstWin: { gold; xp; boosterName: string | null; legendary: boolean }; farm: { gold; xp; boosterPct; legendaryPct } }`
  - `AdventureWorldView { id; name; cardSetId; cardSetName; order; unlocked; requires: { id; name }[]; beaten: number; completed: boolean; opponents: AdventureOpponentView[] }`
  - `AdventureOverview { worlds: AdventureWorldView[]; farmRewardsToday: number; dailyCap: number }`
  - `AdventureResultPayload { opponentId; worldId; won: boolean; firstWin: boolean; loot: AdventureLoot | null; worldCompleted: boolean; unlockedWorldIds: number[] }`
  - Corps admin : `AdminAdventureWorldBody { name; cardSetId; boosterId; order; isActive; prerequisiteIds: number[] }`, `AdminAdventureOpponentBody { name; quote; portraitCardId } & AdventureRewardConfig`, `AdminAdventureDeckBody { cards: { cardId; quantity }[] }`, `AdminAdventureSettingsBody { dailyCap }`.
- `socket/fight.ts` : `AdventureStartPayload { opponentId: number; deckId: number }` ; client→serveur `"adventure:start"` ; `MatchFoundPayload.adventureOpponentId?: number` ; `GameOverPayload.adventure?: AdventureResultPayload`.

- [ ] **Step 1: Tests qui échouent** — dans `achievements.test.ts` : `ACHIEVEMENT_TOTAL` vaut `45` ; `ALL_WORLDS` n'est utilisé que pour `[ADVENTURE_WORLDS, GOLD]` ; seuils `PVE_WON` = 5/50/200, `PVE_PLAYED` = 10/100/300, `ADVENTURE_WORLDS` = 1/3/ALL_WORLDS. Dans `adventure.test.ts` : `ADVENTURE_LEVEL_DEFAULTS[5].farmLegendaryPct === 2`, `[1].firstWinGold === 100`, les or/XP sont croissants du niveau 1 au 5, `farmLegendaryPct === 0` pour 1..4. Mettre à jour le test existant « n'utilise ALL_SETS que pour SETS_COMPLETED » (inchangé) et ajouter le pendant ALL_WORLDS.
- [ ] **Step 2:** `pnpm --filter @pipou/shared test` → FAIL.
- [ ] **Step 3: Implémenter** les ajouts ci-dessus ; ajouter les 3 familles dans `ACHIEVEMENTS` avec `tiers(...)`.
- [ ] **Step 4:** `pnpm --filter @pipou/shared test && pnpm build:shared && pnpm typecheck` → PASS. Si `typecheck` signale des `Record<AchievementFamily, …>` incomplets (back `toAchievementValues`, front `achievementIcons.ts`, i18n), mettre **provisoirement** `0` côté back et `IconTrophy` côté front ; Task 9 les remplit.
- [ ] **Step 5: Commit** `feat(shared): adventure contract, PvE achievements and quest conditions`.

### Task 2: Entités, migration, module

**Files:**
- Create: `apps/backend/src/adventure/entities/adventure-world.entity.ts`, `adventure-opponent.entity.ts`, `adventure-opponent-card.entity.ts`, `adventure-match.entity.ts`, `adventure-settings.entity.ts`; `apps/backend/src/adventure/adventure.module.ts`; `apps/backend/src/database/migrations/1791000000008-Adventure.ts`
- Modify: `apps/backend/src/app.module.ts` (import du module)

**Interfaces — Produces (noms de tables/colonnes snake_case via la naming strategy existante) :**
- `AdventureWorld { id; name; cardSetId; cardSet: CardSet; boosterId: number | null; order; isActive; prerequisites: AdventureWorld[] (ManyToMany, table adventure_world_prerequisite(world_id, required_world_id)); opponents: AdventureOpponent[] }`
- `AdventureOpponent { id; worldId; position (1..5, unique par monde); name; quote; portraitCardId: number | null; signature: string; firstWinGold; firstWinXp; farmGold; farmXp; farmBoosterPct; farmLegendaryPct; cards: AdventureOpponentCard[] }`
- `AdventureOpponentCard { id; opponentId; cardId; card: Card; quantity }` (unique opponent+card)
- `AdventureMatch { id; userId; opponentId; won: boolean | null (null = en cours); firstWin: boolean; endReason: varchar(32) | null; turns; loot: json | null; rewarded: boolean; startedAt; endedAt: Date | null }` — index (user_id, opponent_id) et (user_id, ended_at).
- `AdventureSettings { id (toujours 1); dailyCap: number default 20 }`
- Pourcentages stockés en `decimal(5,2)` lus en `number` (transformer comme ailleurs dans `common/transformers`).

- [ ] **Step 1:** Écrire entités + migration `up`/`down` (FK ON DELETE CASCADE pour opponent→world, card→opponent, match→user ; `RESTRICT` pour match→opponent). Insérer la ligne `adventure_settings (id=1, daily_cap=20)` dans `up`.
- [ ] **Step 2:** `pnpm --filter @pipou/backend migration:run:local` puis `migration:revert:local` puis `migration:run:local` sur la base e2e → aucune erreur. (Base locale : voir `.env.e2e`.)
- [ ] **Step 3:** `pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend test` → PASS (aucun test cassé).
- [ ] **Step 4: Commit** `feat(back): adventure schema`.

### Task 3: Générateur de decks d'IA (pur)

**Files:**
- Create: `apps/backend/src/adventure/deck-generator.ts`, `apps/backend/src/adventure/signatures.ts`
- Test: `apps/backend/src/adventure/deck-generator.spec.ts`

**Interfaces:**
- Consumes: `Card` (entité), `DECK_RULES`, `allRealCards()` (tests, `fights/testing/real-cards.ts`).
- Produces:
  - `type Signature = { archetype: AdventureArchetype; cardName: string; element?: 'earth'|'fire'|'water'|'wind' }`
  - `LAUNCH_SIGNATURES: Record<'pipou'|'pixelman'|'dragon', [Signature×5]>` — tableau « Signature de chaque IA » de la spec (Pipou : Recrue Andouille, Caporal Gazouille, Capitaine Gribouille, Commandant Quenouille, Général Chatouille ; Pixelman : Noyau Alpha, Beta, Zeta, Delta, Omega ; Drakon : Teros/earth, Feros/fire, Ackos/water, Tempestu/wind, Œuf Céleste).
  - `generateDeck(setCards: Card[], level: 1|2|3|4|5, signature: Signature, random: () => number): { cardId: number; quantity: number }[]`

- [ ] **Step 1: Tests qui échouent** (cartes réelles filtrées par `archetype`, `random` déterministe) :
  - pour chaque archétype × niveau : total entre 30 et 40, chaque quantité 1..3, tous les `cardId` appartiennent au set ;
  - la carte signature est présente (Pixelman : 2–3 exemplaires du noyau) ;
  - la part de raretés `epic|legendary|secret` est non décroissante du niveau 1 au 5 (moyenne sur 20 graines) ;
  - Pixelman : ≥ 50 % de supports dont tous les `EQUIPMENT` disponibles ; Pipou : ≥ 60 % de monstres ; Drakon : contient ≥ 1 œuf et toutes les cartes `baby/young/adult` de l'élément signature (le boss : ≥ 2 éléments).
- [ ] **Step 2:** `pnpm --filter @pipou/backend test deck-generator` → FAIL.
- [ ] **Step 3: Implémenter.** Approche : poids par carte = base selon archétype (règles ci-dessus) × multiplicateur de rareté selon niveau (niveau 1 favorise `common/uncommon`, niveau 5 `epic+`), signature forcée en premier, puis tirage pondéré sans dépasser 3 exemplaires jusqu'à 35 cartes (descendre à 30 si le set est trop petit, monter à 40 seulement si nécessaire pour respecter les minimums).
- [ ] **Step 4:** tests → PASS.
- [ ] **Step 5: Commit** `feat(back): adventure AI deck generator`.

### Task 4: Règles pures — déblocage, récompenses, plafond

**Files:**
- Create: `apps/backend/src/adventure/adventure-rules.ts`
- Test: `apps/backend/src/adventure/adventure-rules.spec.ts`

**Interfaces — Produces:**
- `opponentStates(positionsBeaten: Set<number>): AdventureOpponentState[]` (index 0 = position 1 ; position *n* disponible si *n−1* battue).
- `isWorldUnlocked(world: { prerequisiteIds: number[] }, completedWorldIds: Set<number>): boolean`
- `canActivateWorld(input: { boosterId: number | null; legendaryCount: number }): { ok: true } | { ok: false; reason: string }` (raisons FR : « Aucun booster de récompense », « Aucune carte légendaire dans le set »).
- `farmWindowStart(now: Date): Date` — dernier passage à `RESET_HOUR` (réutiliser les helpers de `quest-schedule.ts`).
- `rollLoot(input: { firstWin: boolean; isBoss: boolean; config: AdventureRewardConfig; farmRewardsToday: number; dailyCap: number; random: () => number }): { gold; xp; booster: boolean; legendary: boolean; capped: boolean }`

- [ ] **Step 1: Tests qui échouent :**
  - `opponentStates(new Set())` → `['available','locked','locked','locked','locked']` ; `{1,2}` → `beaten,beaten,available,locked,locked`.
  - 1re victoire non-boss : `{gold:cfg.firstWinGold, xp:cfg.firstWinXp, booster:true, legendary:false, capped:false}` même si `farmRewardsToday === dailyCap`.
  - 1re victoire boss : `legendary:true`.
  - farm : `random` = 0.001 avec `farmBoosterPct 3` → booster ; `random` = 0.5 → pas de booster ; légendaire jamais pour non-boss.
  - plafond : `farmRewardsToday 19, cap 20` → payé ; `20` → `{gold:0,xp:0,booster:false,legendary:false,capped:true}`.
  - `farmWindowStart` : 03:59 → veille à `RESET_HOUR` ; à `RESET_HOUR` pile → le jour même.
  - `canActivateWorld({boosterId:null, legendaryCount:1}).ok === false`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(back): adventure unlock and reward rules`.

### Task 5: Seeder des mondes de lancement

**Files:**
- Create: `apps/backend/src/adventure/adventure.seeder.ts`
- Modify: `apps/backend/src/adventure/adventure.module.ts`
- Test: `apps/backend/src/adventure/adventure.seeder.spec.ts`

**Interfaces:**
- Consumes: `generateDeck`, `LAUNCH_SIGNATURES`, `canActivateWorld`, `ADVENTURE_LEVEL_DEFAULTS`.
- Produces: `AdventureSeeder implements OnApplicationBootstrap` avec `seed(): Promise<void>` ; constante `LAUNCH_WORLDS = [{ cardSetId: 1, archetype: 'pipou', order: 1 }, { cardSetId: 2, archetype: 'pixelman', order: 2 }, { cardSetId: 3, archetype: 'dragon', order: 3 }]`.

Comportement : **idempotent, ne crée que ce qui manque** (un monde existe déjà pour ce `cardSetId` → on n'y touche pas ; l'admin est maître ensuite). Nom du monde = nom du set. Booster = plus petit id de booster du set. 5 IA par monde : `position = level`, `portraitCardId` = id de la carte signature, `signature` = JSON de la `Signature`, récompenses = `ADVENTURE_LEVEL_DEFAULTS[level]`, deck = `generateDeck(...)`. Nom et réplique : le builder les écrit (thème du set, FR) dans `signatures.ts`. `isActive = canActivateWorld(...).ok`. Erreurs journalisées sans faire tomber le démarrage (comme `QuestPoolSeeder`).

- [ ] **Step 1: Tests qui échouent** (repos mockés comme dans `quest-pool.seeder.spec.ts`) : crée 3 mondes × 5 IA quand rien n'existe ; ne recrée rien au 2e appel ; set sans légendaire → monde créé inactif ; set absent → monde ignoré + log.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(back): seed launch adventure worlds`.

### Task 6: Joueur IA

**Files:**
- Create: `apps/backend/src/fights/ai/ai-player.ts`, `apps/backend/src/fights/ai/candidate-actions.ts`, `apps/backend/src/fights/ai/evaluate.ts`
- Test: `apps/backend/src/fights/ai/ai-player.spec.ts`, `apps/backend/src/fights/ai/ai-selfplay.spec.ts`

**Interfaces — Produces:**
- `interface AiProfile { archetype: AdventureArchetype; level: 1|2|3|4|5 }`
- `MISTAKE_RATE: Record<1|2|3|4|5, number> = { 1: 0.25, 2: 0.10, 3: 0, 4: 0, 5: 0 }`
- `aiMustAct(game: GameState, aiUserId: number): boolean` — vrai si : choix courant pour l'IA, ou mulligan non décidé par l'IA, ou (tour de l'IA, phase ∈ main/battle/end, aucun choix en attente pour l'humain).
- `class AiPlayer { constructor(engine: GameEngine, random: () => number); chooseAction(game: GameState, seat: Seat, profile: AiProfile): GameAction }` — ne modifie jamais `game`.
- `listCandidates(game, seat): GameAction[]` (dans `candidate-actions.ts`) : `pick_cards` (premiers *count* candidats et quelques combinaisons) si choix ; `mulligan` (`redraw` true/false) ; en `main` : chaque `summon` (main × zone libre × paiement minimal par cartes les moins utiles), `evolve`, `play_support` (zones libres × cibles), `recycle` ; en `battle` : chaque `attack` (cibles + direct) et `change_mode` ; en `end` : `discard` si main > `HAND_LIMIT` ; toujours `end_phase` sauf en mulligan/choix.
- `evaluate(game, seat, archetype): number` (dans `evaluate.ts`) : score = Primes (moi − adversaire, fort poids) + somme ATK/PV de mes monstres − adverses + bonus archétype (Pipou : nombre de monstres sur le terrain ; Pixelman : nombre d'équipements sur le monstre le plus équipé ; Drakon : stade d'évolution cumulé et PV des unités non-adultes) ; `finished` gagné = +∞, perdu = −∞.

Algorithme de `chooseAction` : pour chaque candidat, `structuredClone(game)`, `engine.dispatch(clone, seat, action)` ; écarter ceux qui renvoient `error` ; score = `evaluate(clone)`. Avec probabilité `MISTAKE_RATE[level]`, prendre un candidat valide au hasard. Sinon le meilleur ; `end_phase` ne gagne que si aucun candidat n'améliore le score de l'état courant. Aucun candidat valide → `{ type: 'end_phase' }` (ou `discard` index 0 en phase `end` si main trop pleine).

- [ ] **Step 1: Tests unitaires qui échouent** (`scenario()` + `createEngine()` de `fights/testing`) :
  - phase `battle`, attaque létale disponible → choisit l'attaque qui fait gagner ;
  - choix en attente pour l'IA → renvoie un `pick_cards` accepté par `engine.dispatch` ;
  - main vide + terrain plein en `main` → `end_phase` ;
  - phase `end` avec main > `HAND_LIMIT` → action valide (`discard`) ;
  - `chooseAction` ne modifie pas `game` (`expect(game).toEqual(snapshotAvant)`) ;
  - Pixelman, noyau sur le terrain + équipement en main → `play_support` ciblant le noyau.
- [ ] **Step 2: Test d'autoplay qui échoue** (`ai-selfplay.spec.ts`) : pour chaque paire d'archétypes, decks `generateDeck` niveau 3, l'IA joue les deux sièges via `dispatch` ; la partie atteint `finished` en < 2000 actions, et aucune action choisie n'est refusée par le moteur. Seed fixe (`fixedRng`) ; marquer `jest.setTimeout(60_000)`.
- [ ] **Step 3:** `pnpm --filter @pipou/backend test fights/ai` → FAIL.
- [ ] **Step 4: Implémenter** les trois fichiers.
- [ ] **Step 5:** tests → PASS.
- [ ] **Step 6: Commit** `feat(back): heuristic AI player`.

### Task 7: Parties PvE dans `FightsService`

**Files:**
- Modify: `apps/backend/src/fights/fights.service.ts`, `apps/backend/src/fights/fights.gateway.ts`, `apps/backend/src/fights/fights.module.ts`
- Create: `apps/backend/src/fights/pve.ts` (types + constantes)
- Test: `apps/backend/src/fights/fights-pve.spec.ts`

**Interfaces:**
- Consumes: `AiPlayer`, `aiMustAct`, `AiProfile` (Task 6) ; `AdventureService.prepareStart` / `recordResult` (Task 8 — ici injectés via le jeton `PVE_HOOKS` pour éviter la dépendance circulaire ; Task 8 fournit l'implémentation).
- Produces (`pve.ts`) :
  - `AI_ACTION_DELAY_MS = 700`, `PVE_MAX_TIMEOUTS = 3`, `AI_MAX_ACTIONS_PER_TURN = 60`
  - `interface PveInfo { adventureMatchId: number; opponentId: number; aiUserId: number; profile: AiProfile; timeouts: number; aiActionsThisTurn: number }`
  - `interface PveStart { adventureMatchId: number; opponentId: number; opponentName: string; profile: AiProfile; aiCards: CardInstance[] (ownerId à remplir) }`
  - `interface PveHooks { prepareStart(userId: number, opponentId: number): Promise<PveStart>; recordResult(game: GameState, pve: PveInfo): Promise<AdventureResultPayload> }` et `PVE_HOOKS = Symbol('PVE_HOOKS')`
- Produces (`FightsService`) : `startAdventure(userId, username, socketId, payload: AdventureStartPayload, server): Promise<{ error?: string }>`.

Comportement :
- Refus si l'utilisateur a déjà une partie (`userToMatch`) ou est en file.
- `matchId = -adventureMatchId`, IA : `userId = matchId`, `socketId = 'ai:' + matchId` (salle vide), `username = opponentName`. Deck humain via `DeckSubmissionService.submitDeck`, deck IA via `engine.setupDeck` → la partie passe en `mulligan`.
- Émet `fight:matched { matchId, opponentName, adventureOpponentId }` puis l'état.
- `afterChange` en PvE : si `aiMustAct` → annuler le timeout de tour, programmer `setTimeout(aiStep, AI_ACTION_DELAY_MS)` (handle stocké, annulé par `cleanupGame`) ; sinon programmer le timeout humain comme en JcJ.
- `aiStep` sous `withLock` : relit la partie, recalcule `aiMustAct`, `chooseAction`, `dispatch` ; si erreur ou `aiActionsThisTurn ≥ AI_MAX_ACTIONS_PER_TURN` → `dispatch(end_phase)` puis, en dernier recours, `engine.timeout(game)`. Remise à 0 de `aiActionsThisTurn` quand le tour change.
- Timeout humain en PvE : `timeouts += 1` ; à `PVE_MAX_TIMEOUTS` → `finishGame(game, aiUserId, 'surrender')`. Toute action humaine acceptée remet `timeouts` à 0.
- `finish` en PvE : **pas** de `gameEnd.persistResult` ; `const adventure = await hooks.recordResult(game, pve)` (erreur → log, `adventure` absent) ; `fight:game_over { winner, endReason, adventure }` envoyé au seul joueur humain.
- `reconnect` renvoie aussi `adventureOpponentId` (le gateway l'ajoute à `fight:resumed`).
- Le gateway ajoute `@SubscribeMessage('adventure:start')`.

- [ ] **Step 1: Tests qui échouent** (`fakeServer()`, `jest.useFakeTimers()`, `PveHooks` factice, `AiPlayer` réel avec `createEngine`) :
  - `startAdventure` → `fight:matched` avec `adventureOpponentId`, `matchId < 0`, partie en `mulligan` ;
  - 2e `startAdventure` du même joueur → `{ error }`, `prepareStart` appelé une seule fois ;
  - après le mulligan humain, l'IA agit seule (avancer les timers) jusqu'à rendre la main ;
  - 3 timeouts humains consécutifs → `recordResult` appelé une fois avec `game.winner === aiUserId`, `endReason 'surrender'` ;
  - une action humaine entre deux timeouts remet le compteur à 0 ;
  - `surrender` pendant qu'un `aiStep` est programmé → `recordResult` une seule fois, plus aucune action IA après ;
  - fin PvE → aucun appel à `GameEndService.persistResult`, `fight:game_over` contient `adventure`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** `pnpm --filter @pipou/backend test fights` → PASS (tests JcJ existants inclus).
- [ ] **Step 5: Commit** `feat(back): host PvE games with AI driver`.

### Task 8: `AdventureService` — lecture joueur, démarrage, résultat

**Files:**
- Create: `apps/backend/src/adventure/adventure.service.ts`, `apps/backend/src/adventure/adventure.controller.ts`
- Modify: `apps/backend/src/adventure/adventure.module.ts` (fournit `PVE_HOOKS` via `useExisting: AdventureService` ; `FightsModule` importe `forwardRef(() => AdventureModule)` ou l'inverse — choisir le sens qui évite le cycle)
- Test: `apps/backend/src/adventure/adventure.service.spec.ts`, `adventure.controller.spec.ts`

**Interfaces:**
- Consumes: Task 2 entités, Task 4 règles, `UsersService.addGold/addExperience/addBoosterToUser/addCardToUser`, `EventEmitter2`.
- Produces:
  - `getOverview(userId: number, now = new Date()): Promise<AdventureOverview>` — mondes **actifs** triés par `order`.
  - `prepareStart(userId, opponentId): Promise<PveStart>` — erreurs FR (`BadRequestException`) : IA introuvable/monde inactif, monde verrouillé, IA verrouillée, deck IA invalide (`checkDeckForMatch` avec `owned = quantity`, comme `SandboxService.create`) ; crée la ligne `adventure_match` (won null).
  - `recordResult(game, pve): Promise<AdventureResultPayload>`
  - `countFarmRewardsToday(userId, now): Promise<number>` (= `adventure_match` avec `won = 1, first_win = 0, rewarded = 1, ended_at ≥ farmWindowStart(now)`).
  - Event `adventure.finished { userId: number; won: boolean }`.
  - REST : `GET /adventure` → `AdventureOverview` (JwtAuthGuard).

`recordResult`, en **une transaction** : met à jour la ligne (`won`, `endReason`, `turns`, `endedAt`) ; si victoire : `firstWin` = aucune victoire antérieure contre cette IA ; `rollLoot(...)` ; booster = `world.boosterId` ; légendaire = carte `legendary` tirée au hasard dans le set ; crédits via `UsersService` (avec `manager`) ; `rewarded = !capped && gain > 0` ; `loot` JSON. Après commit : `adventure.finished`, et `card.set.check { userId, setId }` si une carte a été donnée. Calcule `worldCompleted` (boss battu pour la 1re fois) et `unlockedWorldIds` (mondes dont les prérequis viennent d'être tous remplis).

- [ ] **Step 1: Tests qui échouent** (base mockée ou e2e selon le pattern de `quests.service.spec.ts`) :
  - overview : nouveau joueur → IA 1 `available`, autres `locked` ; monde avec prérequis non terminé → `unlocked:false` ;
  - `prepareStart` sur IA 2 sans avoir battu l'IA 1 → erreur « IA verrouillée » ; monde inactif → erreur ; deck IA à 29 cartes → erreur ;
  - 1re victoire boss → `addGold(500)`, `addExperience(300)`, `addBoosterToUser(boosterId,1)`, `addCardToUser(legendaryId,1)`, `worldCompleted:true` ;
  - 2e victoire (farm) avec 20 farm payés aujourd'hui → `loot.capped === true`, aucun crédit ;
  - défaite → aucun crédit, `adventure.finished { won:false }`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + `pnpm --filter @pipou/backend test fights` toujours vert.
- [ ] **Step 5: Commit** `feat(back): adventure progression and rewards`.

### Task 9: Succès et quêtes PvE/JcJ

**Files:**
- Modify: `apps/backend/src/achievements/achievement-values.ts`, `achievement-stats.service.ts`, `achievement-progress.ts`, `achievements.service.ts` (passage de `totalWorlds`) ; `apps/backend/src/quests/quests.service.ts`, `quest-pool.ts` ; `apps/frontend/src/features/achievements/achievementIcons.ts`, `apps/frontend/src/features/quests/QuestManager.tsx`, `apps/frontend/src/i18n/locales/{fr,en,ko}.json`
- Test: `achievement-values.spec.ts`, `achievements.service.spec.ts`, `quests.service.spec.ts`, `quest-pool.seeder.spec.ts`

**Interfaces:**
- `AchievementSources.adventure: { worldsCompleted: number; won: number; played: number }` ; `getValues` renvoie aussi `totalWorlds` (mondes actifs) ; `buildAchievementsResponse(values, totalSets, totalWorlds, claimed, equippedTitle)`.
- SQL : `played` = `adventure_match` terminées (`won IS NOT NULL`) ; `won` = `won = 1` ; `worldsCompleted` = mondes actifs dont l'IA position 5 a ≥ 1 victoire du joueur.
- Quêtes : `fight.finished` → `PLAY_FIGHT` + `PLAY_PVP_FIGHT` (et `WIN_FIGHT` + `WIN_PVP_FIGHT`) ; `@OnEvent('adventure.finished')` → `PLAY_FIGHT` + `PLAY_PVE_FIGHT` (+ `WIN_FIGHT` + `WIN_PVE_FIGHT` si `won`).
- Pool (nouvelles `poolKey`) : `d_pve_win_2` (WIN_PVE_FIGHT 2, gold 150), `d_pvp_play_1` (PLAY_PVP_FIGHT 1, gold 150), `w_pve_win_15` (WIN_PVE_FIGHT 15, booster), `w_pvp_win_5` (WIN_PVP_FIGHT 5, booster). Titres i18n `quests.pool.<key>` fr/en/ko.
- Front : icônes des familles (ADVENTURE_WORLDS → nouvelle `IconMap`, PVE_WON → `IconSwords`, PVE_PLAYED → `IconRobot`, créées dans `Icons.tsx`), libellés/descriptions/titres i18n (Explorateur, Chasseur d'IA, Infatigable ; en/ko traduits), `DUELS_WON`/`DUELS_PLAYED` renommés « Victoires JcJ » / « Duels JcJ » (fr/en/ko), libellés des 4 conditions dans `QuestManager.tsx`.

- [ ] **Step 1: Tests qui échouent :** `toAchievementValues` mappe les 3 familles ; `ALL_WORLDS` résolu en `totalWorlds` (3 mondes actifs → seuil or 3) ; `adventure.finished {won:true}` appelle `track` avec `PLAY_FIGHT`, `PLAY_PVE_FIGHT`, `WIN_FIGHT`, `WIN_PVE_FIGHT` ; `fight.finished` ne déclenche aucune condition PvE ; le seeder du pool crée les 4 nouvelles quêtes.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter (retirer les valeurs provisoires de Task 1). **Step 4:** `pnpm test && pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: adventure achievements and PvP/PvE quest conditions`.

### Task 10: Admin back

**Files:**
- Create: `apps/backend/src/adventure/adventure-admin.controller.ts`, `apps/backend/src/adventure/adventure-admin.service.ts`, DTOs dans `apps/backend/src/adventure/dto/`
- Test: `apps/backend/src/adventure/adventure-admin.service.spec.ts`

**Interfaces — Produces** (toutes routes `JwtAuthGuard + AdminGuard`, préfixe `/admin/adventure`) :
- `GET /` → mondes (tous, actifs ou non) avec IA, decks (cartes + quantités), raison d'inactivité éventuelle, réglage `dailyCap`.
- `POST /worlds`, `PATCH /worlds/:id` (`AdminAdventureWorldBody`) — création d'un monde : génère ses 5 IA comme le seeder (signature par défaut = archétype majoritaire du set, carte signature = carte la plus rare de l'archétype par niveau) ; activation refusée (400, raison FR de `canActivateWorld`) ; prérequis : refuser soi-même et les cycles.
- `PATCH /opponents/:id` (`AdminAdventureOpponentBody`) — pourcentages 0..100, montants ≥ 0, portrait doit appartenir au set.
- `PUT /opponents/:id/deck` (`AdminAdventureDeckBody`) — `checkDeckForMatch` + cartes du set uniquement.
- `POST /opponents/:id/deck/regenerate` → nouveau deck via `generateDeck`.
- `PATCH /settings` (`AdminAdventureSettingsBody`, `dailyCap` entier 0..1000).

- [ ] **Step 1: Tests qui échouent :** activer un monde sans légendaire → 400 « Aucune carte légendaire dans le set » ; deck de 29 cartes → 400 ; carte d'un autre set → 400 ; prérequis cyclique A→B→A → 400 ; régénérer → deck valide différent persisté ; `dailyCap` 25 → `countFarmRewardsToday` comparé à 25 au prochain `rollLoot`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(back): adventure admin endpoints`.

### Task 11: Front — extraire la connexion de combat

Refactor sans changement de comportement, pour que le JcJ et l'Aventure partagent le plateau.

**Files:**
- Create: `apps/frontend/src/features/fight/useFightConnection.ts`, `apps/frontend/src/features/fight/FightArena.tsx`
- Modify: `apps/frontend/src/features/fight/FightPage.tsx`
- Test: `apps/frontend/src/features/fight/useFightConnection.test.ts`

**Interfaces — Produces:**
- `useFightConnection(opts: { userId: number; onMatched?(p: MatchFoundPayload): void; onGameOver?(p: GameOverPayload): void; onResumed?(p: MatchFoundPayload): void }): { status; gameState; matchId; opponentName; timeLeft; toast; emit; send(action: GameAction): void; reset(): void }` — reprend tel quel le `useEffect` socket, le compte à rebours et le toast de `FightPage`.
- `FightArena({ gameState, timeLeft, controls, onSurrender })` — rend `MulliganPanel` / `FightBoard` / `CardPickModal` / bandeau « fait un choix » exactement comme aujourd'hui.

- [ ] **Step 1:** Test du hook avec un faux socket (mock de `socket.io-client`) : `fight:matched` → `status 'selecting'` et `matchId` ; `fight:state` → `status 'playing'` ; `fight:game_over` → `status 'finished'` et `onGameOver` appelé avec le payload.
- [ ] **Step 2:** FAIL. **Step 3:** extraire ; `FightPage` n'utilise plus que le hook + `FightArena`. **Step 4:** `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint` → PASS.
- [ ] **Step 5: Commit** `refactor(front): extract fight connection and arena`.

### Task 12: Front — écrans Aventure

**Files:**
- Create: `apps/frontend/src/services/adventure.service.ts`, `apps/frontend/src/features/adventure/` : `AdventureWorlds.tsx`, `AdventurePath.tsx`, `OpponentSheet.tsx`, `AdventureFight.tsx`, `AdventureResult.tsx`, `Adventure.css`, `adventureView.ts`
- Modify: `apps/frontend/src/pages/FightHub.tsx` (+ `.css`), `apps/frontend/src/App.tsx` (routes `/adventure`, `/adventure/:worldId`, `/adventure/fight/:opponentId`), `apps/frontend/src/utils/querykeys.ts` (`adventure: ["adventure"] as const`), `apps/frontend/src/components/Icons.tsx` (`IconLock`, `IconUnlock`, `IconGift`, `IconSparkles`, `IconSwords`, `IconMap`, `IconRobot` si absents), `i18n/locales/{fr,en,ko}.json` (section `adventure.*`)
- Test: `apps/frontend/src/features/adventure/adventureView.test.ts`, `OpponentSheet.test.tsx`

**Interfaces:**
- Consumes: `GET /adventure` (`AdventureOverview`), `useFightConnection` + `FightArena` (Task 11), `"adventure:start"`, `GameOverPayload.adventure`.
- Produces: `adventureService.getOverview(): Promise<AdventureOverview>` ; `pathLayout(count: 5): { offset: -1|0|1 }[]` dans `adventureView.ts` (zigzag du bas vers le haut, boss en haut centré).

Contenu (maquettes validées, voir spec « Parcours joueur ») :
- `FightHub` : 3e carte « Aventure » (icône `IconMap`, même style `fh-card`) → `/adventure`.
- `AdventureWorlds` : cartes de mondes (dégradé par ordre, barre `beaten/5`, coche si terminé, cadenas + « Termine … » si verrouillé), compteur `IconGift farmRewardsToday/dailyCap` en en-tête.
- `AdventurePath` : 5 ronds en zigzag, boss plus grand avec `IconCrown`, états battu (`IconCheck`), disponible (anneau or), verrouillé (`IconLock`) ; toucher un rond non verrouillé ouvre `OpponentSheet` dans le `BottomSheet` existant.
- `OpponentSheet` : portrait (image de la carte), nom, badge niveau, « Boss », victoires, réplique ; section « Première victoire » si `wins === 0`, sinon « Gains à chaque victoire » + « Chances de drop » (%) + « Récompenses du jour : x/y » et message « Plus de récompenses aujourd'hui » si plafond atteint ; `DeckWidget` ; bouton Combattre/Rejouer (désactivé sans deck) → `/adventure/fight/:opponentId?deck=<id>`.
- `AdventureFight` : `useFightConnection` ; à la connexion émet `adventure:start { opponentId, deckId }` (sauf si `fight:resumed` arrive avec ce `adventureOpponentId`) ; rend `FightArena` ; à `fight:game_over` affiche `AdventureResult` puis `invalidateQueries(QUERY_KEYS.adventure)`, `profile`, `inventory`, `collection`, `achievements`, `quests`.
- `AdventureResult` : « VICTOIRE ! » ou « Défaite », badge « Monde X terminé », tuiles de butin (or, XP, booster, légendaire mise en avant ; mention « Plus de récompenses aujourd'hui » si `loot.capped`), tuile « Succès » avec lien vers l'onglet Succès quand `worldCompleted`, mondes débloqués ; boutons Rejouer / Retour au monde.
- Responsive mobile d'abord, palette Arène (`--color-bordeaux`, `--color-cream`, `--color-gold`), aucun emoji.

- [ ] **Step 1: Tests qui échouent :** `pathLayout(5)` → offsets `[0, -1, 1, -1, 0]` (bas→haut) ; `OpponentSheet` rend « Première victoire » quand `wins = 0`, les % de drop quand `wins > 0`, le message de plafond quand `farmRewardsToday >= dailyCap`, et aucun caractère emoji (`/\p{Extended_Pictographic}/u` absent du texte rendu).
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** `pnpm --filter @pipou/frontend test && typecheck && lint` → PASS.
- [ ] **Step 5: Vérification manuelle** (`pnpm dev`, skill `run` si disponible) : Arène → Aventure → Monde 1 → IA 1 → combat jusqu'à victoire (ou abandon) ; l'IA joue seule ; l'écran de résultat s'affiche ; l'IA 2 devient disponible. Noter tout écart.
- [ ] **Step 6: Commit** `feat(front): adventure screens`.

### Task 13: Front — admin Aventure

**Files:**
- Create: `apps/frontend/src/features/adventure/admin/AdventureManager.tsx`, `WorldForm.tsx`, `OpponentForm.tsx`, `OpponentDeckEditor.tsx`; service admin dans `services/adventure.service.ts`
- Modify: `apps/frontend/src/pages/Admin.tsx` (onglet `adventure`, icône `IconMap`), `utils/querykeys.ts` (`adminAdventure`), i18n `admin.tabs.adventure` + libellés
- Test: `apps/frontend/src/features/adventure/admin/OpponentDeckEditor.test.tsx`

**Interfaces:** consomme les routes de Task 10 ; suit le style de `QuestManager.tsx` / `manager.css`.

Contenu : liste des mondes (actif/inactif + raison), formulaire monde (nom, set, booster du set, ordre, prérequis multi-sélection, actif) ; pour chaque IA : nom, réplique, portrait (cartes du set), 6 champs de récompense ; éditeur de deck (cartes du set, +/−, total affiché, erreur si hors 30–40) + bouton « Régénérer » avec confirmation ; champ plafond journalier. Erreurs serveur via `apiErrorMessage` ; `invalidateQueries(adminAdventure)` et `adventure` après chaque mutation.

- [ ] **Step 1: Test qui échoue :** l'éditeur de deck affiche le total, bloque l'enregistrement à 29 et à 41 cartes et au-delà de 3 exemplaires.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** tests/typecheck/lint front → PASS.
- [ ] **Step 5: Commit** `feat(front): adventure admin`.

### Task 14: Vérification finale

- [ ] **Step 1:** `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test && pnpm build` → tout vert.
- [ ] **Step 2:** Sur la base locale e2e (dump `apps/backend/.e2e/aiven-dump.sql`) : démarrer le back, vérifier que le seeder crée 3 mondes actifs × 5 IA avec des decks valides ; jouer une partie PvE complète depuis le front.
- [ ] **Step 3:** Mettre à jour la spec (section « Écarts d'implémentation ») si quelque chose a dû différer ; commit `docs: record adventure implementation deviations`.
