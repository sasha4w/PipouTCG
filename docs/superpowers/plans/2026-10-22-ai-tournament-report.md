# Tournoi fiable et rapport par carte — plan d'implémentation (étape 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un tournoi IA contre IA sans triche, parallèle, à trois échelles, qui produit un rapport par carte et par deck, puis une mesure de référence Standard avec le cerveau actuel.

**Architecture:** l'IA décide sur une copie déterminisée de l'état (cartes cachées redistribuées). Le tournoi est découpé en parties planifiées à graine fixe, jouées par des processus enfants puis fusionnées. Un enregistreur observe chaque décision et chaque coup dans `playGame`, sans toucher au moteur. Un module de rapport transforme les compteurs en résumé et en alertes.

**Tech Stack:** NestJS 11 backend, TypeScript, Jest, ts-node, `node:child_process`.

**Spec:** `docs/superpowers/specs/2026-10-22-ai-better-brain-design.md` (étape 1 seulement).

## Global Constraints

- Code dans `apps/backend/src/fights/ai/`. Aucun changement du moteur (`engine/`, `services/`), ni de `@pipou/shared`.
- Reproductible : mêmes graines + même code = même résultat, quel que soit le nombre de processus.
- Échelles : rapide = graines de decks 1 à 3, 4 parties par paire ; standard = 1 à 10, 10 parties ; complet = 1 à 30, 20 parties.
- Processus par défaut : nombre de cœurs − 2 (au moins 1), option `--workers`.
- Seuils d'alerte : données insuffisantes < 30 parties jouées ou < 30 parties gardée en main ; « trop forte » > +15 points contre chacun des deux autres archétypes ; « morte » jouable < 20 % ou choisie < 10 % du jouable ; « manque du deck » > 25 % de phases principales sans coup utile.
- Intervalle de confiance : Wilson à 95 %.
- Coup utile = toute action valide sauf `end_phase`, `recycle` et `change_mode`.
- Sorties dans `apps/backend/.e2e/` (déjà ignoré par git). Console = résumé seulement.
- Pas d'appel à un modèle de langage.
- Commits sur `ai-better-brain`, messages en français au format `feat(back): …`.

## Review Focus

1. Un choix en attente de l'adversaire qui cite une carte de sa main ou de son deck : la déterminisation ne doit pas la déplacer, sinon le moteur refuse le choix dans la copie. Testé en Task 1.
2. Un choix en attente pour l'IA qui puise dans son propre deck : les candidats doivent rester valides après le mélange. Testé en Task 1.
3. Une partie sans vainqueur (plafond `MAX_ACTIONS`) : comptée dans `played` et dans les stats de cartes, jamais en victoire. Testé en Task 3.
4. Une carte présente en deux exemplaires dans la même main : une seule ligne de stats, un seul « en main » par phase. Testé en Task 2.
5. Fusion des résultats de processus dans un ordre quelconque : résultat identique. Testé en Task 5.

---

### Task 1 : L'IA ne voit que ce qu'un joueur voit

**Files:**
- Create: `apps/backend/src/fights/ai/determinize.ts`
- Create: `apps/backend/src/fights/ai/determinize.spec.ts`
- Modify: `apps/backend/src/fights/ai/ai-player.ts` (`decide`)

**Interfaces:**
- Produces: `determinize(game: GameState, seat: Seat, random: () => number): GameState`. Renvoie une nouvelle copie (le journal et les événements sont vidés, comme `cloneForSimulation`) et ne modifie pas `game`.

Règle : pour chaque joueur, les cartes cachées à `seat` forment un pool. Pour l'adversaire, ce sont `hand`, `deck` et `primeDeck` ; pour moi, `deck` et `primeDeck`, ma main est connue. Les cartes citées par un `pendingChoices[].candidates` d'un joueur restent à leur place. Le reste du pool est mélangé (Fisher-Yates avec `random`), puis redistribué dans les mêmes zones avec les mêmes tailles.

- [ ] **Step 1 : tests** (`describe('determinize')`, états construits avec `scenario` et des decks d'au moins 6 cartes nommées) :
  - `ne modifie pas l'état d'origine` : `structuredClone` avant, puis `toEqual` après l'appel.
  - `garde ma main, les terrains et les cimetières` : `hand` du siège, `monsterZones`, `supportZones`, `graveyard` des deux joueurs égaux à l'origine.
  - `conserve les tailles et le contenu du pool adverse` : `hand.length`, `deck.length` et `primeDeck.length` adverses inchangés ; l'ensemble trié des `instanceId` de `hand + deck + primeDeck` adverses est égal à l'origine.
  - `redistribue la main adverse` : avec `random` fixé (`seeded(3)` de `tournament.ts`), au moins une carte de la main adverse change. Une seconde copie avec `seeded(3)` est égale à la première.
  - `mélange mon deck sans toucher à son contenu` : l'ensemble des `instanceId` de mon `deck + primeDeck` est inchangé.
  - `laisse en place une carte adverse citée par un choix en attente` : l'adversaire a un `pendingChoices` qui cite la 2e carte de sa main ; dans la copie, cette carte est toujours à l'index 1 de sa main.
  - `un choix de l'IA dans son deck reste valide` : l'IA a un choix `source: 'deck'` ; `freshCandidates(copie, choix)` a la même longueur qu'à l'origine.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend exec jest src/fights/ai/determinize.spec.ts` → FAIL (module absent).
- [ ] **Step 3 :** implémenter `determinize`. Dans `AiPlayer.decide`, simuler à partir de `determinize(game, seat, this.random)` : une seule copie par décision, puis `cloneForSimulation` de cette copie pour chaque candidat. `evaluate(game, …)` (le score « actuel » comparé à la fin de phase) utilise la même copie déterminisée.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend exec jest src/fights/ai` → PASS. Si un test existant de `ai-player.spec.ts` dépendait de la pioche réelle, adapter son scénario (deck d'une seule carte) plutôt que l'assertion.
- [ ] **Step 5 : commit** `feat(back): l'IA ne voit plus les cartes cachées`.

### Task 2 : Enregistreur de partie

**Files:**
- Create: `apps/backend/src/fights/ai/telemetry.ts`
- Create: `apps/backend/src/fights/ai/telemetry.spec.ts`
- Modify: `apps/backend/src/fights/ai/ai-player.ts` (ajout de `chooseDetailed`)

**Interfaces:**
- Produces, dans `ai-player.ts` : `chooseDetailed(game, seat, profile): { action: GameAction; valid: GameAction[] }`. `valid` contient les candidats acceptés par le moteur. `chooseAction` renvoie `chooseDetailed(...).action`. En repli ou en cas d'échec, `valid` vaut `[]`.
- Produces, dans `telemetry.ts` :

```ts
export type BlockReason = 'paiement' | 'zone' | 'cible' | 'condition';
export interface CardStats {
  card: string; archetype: AdventureArchetype; vs: AdventureArchetype;
  playedGames: number; playedWins: number;   // parties où elle a été jouée
  heldGames: number; heldWins: number;       // parties en main, jamais jouée
  phasesInHand: number; phasesPlayable: number; phasesChosen: number;
  blocked: Record<BlockReason, number>;
  oppDestroyed: number; primesTaken: number; oppDiscarded: number; oppBlocked: number;
}
export interface DeckStats {
  name: string; archetype: AdventureArchetype; level: AiLevel;
  mainPhases: number; idlePhases: number;
  idleReasons: Record<'main_vide' | BlockReason, number>;
  endReasons: Record<string, number>;        // défaites, par game.endReason
  turns: number; games: number;
}
export interface Telemetry { cards: CardStats[]; decks: DeckStats[] }
export function emptyTelemetry(): Telemetry;
export function mergeTelemetry(a: Telemetry, b: Telemetry): Telemetry;
export function blockReason(card: Card, me: PlayerGameState, opp: PlayerGameState): BlockReason;
export class GameRecorder {
  constructor(entries: Record<Seat, { name: string; archetype: AdventureArchetype; level: AiLevel }>);
  beforeAction(game: GameState, seat: Seat, valid: GameAction[], chosen: GameAction): void;
  afterAction(game: GameState): void;
  finish(game: GameState, winner: Seat | null): Telemetry;
}
```

Règles (dans les commentaires du code) :
- **Carte utilisée par un coup** : `hand[handIndex]` pour `summon`, `evolve`, `play_support` et `transform`. Ni le paiement, ni `recycle`, ni `discard`.
- **Phase** : un couple (tour, siège) pendant `phase === 'main'`. Par phase, chaque carte de base en main compte une fois dans `phasesInHand`, même avec deux exemplaires. Elle compte aussi une fois dans `phasesPlayable` si un coup de `valid` l'utilise, et une fois dans `phasesChosen` si le coup choisi l'utilise.
- **Blocage** : en main toute la phase sans jamais être jouable, on compte `blockReason` une fois. Cet ordre :
  1. `cible` : une évolution sans base valide, un équipement sans porteur, ou un éphémère ciblé sans cible ;
  2. `zone` : un monstre sans zone libre ;
  3. `paiement` : coût > énergie + autres cartes en main ;
  4. `condition` : tout le reste.
- **Phase sans coup utile** : aucun coup utile dans `valid`, à aucune décision de la phase. La raison est `main_vide` si la main est vide, sinon la raison de blocage la plus fréquente parmi les cartes en main.
- **Impact** : quand une carte est jouée au tour T, une fenêtre s'ouvre jusqu'à la fin du tour T + 2 (`game.turnNumber`). On compte :
  - `oppDestroyed` : les `pendingEvents` `monster_destroyed` dont `ownerId` est l'adversaire ;
  - `primesTaken` : la baisse de `me.primes` ;
  - `oppDiscarded` : les cartes de la main adverse passées au cimetière adverse ;
  - `oppBlocked` : les monstres adverses dont `blockAttackTurns > 0` ou `guardLocked` passe de faux à vrai.

  Les fenêtres qui se chevauchent comptent chacune. Les `pendingEvents` s'accumulent pendant un tournoi : l'enregistreur lit seulement les nouveaux, par index.
- **Fin** : sur une partie sans vainqueur, `playedWins` et `heldWins` n'augmentent pas, mais `playedGames` et `heldGames` oui.

- [ ] **Step 1 : tests** (`describe('GameRecorder')`, petits scénarios pilotés avec `createEngine` et `chooseDetailed`) :
  - `compte une carte jouée et sa victoire` : p1 invoque « Lame » puis gagne ; `cards` contient une ligne `{ card: 'Lame', archetype: 'pipou', vs: 'dragon', playedGames: 1, playedWins: 1, heldGames: 0 }`.
  - `une carte gardée en main compte dans heldGames` : une carte jamais jouée et la partie perdue donnent `heldGames: 1, heldWins: 0`.
  - `deux exemplaires en main = une seule phase` : deux « Lame » en main pendant une phase → `phasesInHand: 1`.
  - `bloquée faute de cible` : un équipement en main sans monstre allié → `phasesPlayable: 0, blocked.cible: 1`.
  - `phase sans coup utile, main vide` : `idlePhases: 1, idleReasons.main_vide: 1`.
  - `impact : un monstre adverse détruit dans la fenêtre` : un éphémère de destruction joué → `oppDestroyed: 1`.
  - `partie sans vainqueur` : `finish(game, null)` → `playedGames: 1, playedWins: 0`.
  - `mergeTelemetry additionne ligne à ligne` : deux télémétries d'une même carte s'additionnent, une carte absente d'un côté est reprise telle quelle.
- [ ] **Step 2 :** jest sur ce fichier → FAIL.
- [ ] **Step 3 :** implémenter `chooseDetailed` puis `telemetry.ts`.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend exec jest src/fights/ai` → PASS.
- [ ] **Step 5 : commit** `feat(back): enregistrement des décisions et de l'impact des cartes`.

### Task 3 : Le tournoi produit la télémétrie

**Files:**
- Modify: `apps/backend/src/fights/ai/tournament.ts`
- Modify: `apps/backend/src/fights/ai/tournament.spec.ts`

**Interfaces:**
- Consumes : `GameRecorder`, `Telemetry`, `emptyTelemetry` et `mergeTelemetry` (Task 2) ; `chooseDetailed` (Task 2).
- Produces :
  - `interface PlannedGame { i: number; j: number; p1: number; p2: number; seed: number }` (indices dans `entries`) ;
  - `planGames(entries: TournamentEntry[], gamesPerPair: number, seed: number): PlannedGame[]` : même ordre et mêmes graines qu'aujourd'hui (`seed + index * 7919`, places alternées) ;
  - `playPlanned(entries: TournamentEntry[], games: PlannedGame[]): TournamentResult`, sans `onGame` ;
  - `TournamentResult` gagne `telemetry: Telemetry` ;
  - `mergeResults(a: TournamentResult, b: TournamentResult): TournamentResult` additionne `games`, `byEntry` (par `name`), `byArchetype` et `telemetry`.

  `runTournament` garde sa signature et devient `playPlanned(entries, planGames(...))`, plus l'appel `onGame`.
- [ ] **Step 1 : tests** ajoutés à `tournament.spec.ts` :
  - `planGames reproduit l'ordre et les graines` : pour 2 entrées et 4 parties, `seed` vaut 1, 7920, 15839, 23758, et `p1` alterne.
  - `la télémétrie couvre les deux decks` : `runTournament(entries, 2, 1).telemetry.decks` a 2 lignes et `games: 2` chacune ; la somme des `playedGames + heldGames` est > 0.
  - `déterministe` : deux appels `runTournament(entries, 2, 1)` donnent des `telemetry` égales.
  - `une partie sans vainqueur n'est pas une victoire` : avec `MAX_ACTIONS` exporté et surchargeable pour le test, ou un deck qui ne peut pas gagner, la somme des `wins` < `games` et la télémétrie n'a pas de `playedWins` pour cette partie.
- [ ] **Step 2 :** jest `tournament.spec.ts` → FAIL.
- [ ] **Step 3 :** implémenter. `playGame` crée un `GameRecorder`. Avant chaque `dispatch`, il appelle `ai.chooseDetailed`, puis `recorder.beforeAction`. Après, il appelle `recorder.afterAction`. À la fin, `recorder.finish`.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend exec jest src/fights/ai` → PASS.
- [ ] **Step 5 : commit** `feat(back): le tournoi collecte la télémétrie des cartes`.

### Task 4 : Rapport et alertes

**Files:**
- Create: `apps/backend/src/fights/ai/report.ts`
- Create: `apps/backend/src/fights/ai/report.spec.ts`

**Interfaces:**
- Consumes : `TournamentResult` et `Telemetry` (Tasks 2-3).
- Produces :
  - `wilson(wins: number, n: number): { low: number; high: number }` (proportions entre 0 et 1, z = 1,96) ;
  - `type AlertKind = 'trop_forte' | 'morte' | 'manque_deck'` ;
  - `interface Alert { kind: AlertKind; subject: string; archetype: AdventureArchetype; detail: string; strength: number }` ;
  - `alerts(t: Telemetry): Alert[]`, triées par `strength` décroissante ;
  - `formatSummary(r: TournamentResult, label: string): string` ;
  - `formatDetail(r: TournamentResult): string`.

  Les seuils sont les constantes `MIN_SAMPLE = 30`, `TOO_STRONG_POINTS = 15`, `DEAD_PLAYABLE = 0.2`, `DEAD_CHOSEN = 0.1` et `IDLE_SHARE = 0.25`.

Règles :
- **Valeur ajoutée** d'une carte contre un archétype : `playedWins / playedGames − heldWins / heldGames`, en points. Elle n'est calculée que si `playedGames ≥ 30` et `heldGames ≥ 30`, sinon « pas assez de données ».
- **`trop_forte`** : valeur ajoutée > 15 contre chacun des deux autres archétypes. `strength` = la plus petite des deux.
- **`morte`** : on cumule les adversaires. Si `phasesInHand ≥ 30`, alors `phasesPlayable / phasesInHand < 0,2` ou `phasesChosen / phasesPlayable < 0,1`. `strength` = 100 × (seuil − valeur).
- **`manque_deck`** : on cumule les decks par archétype. Si `idlePhases / mainPhases > 0,25`, le détail donne la raison dominante. `strength` = points au-delà de 25.
- **Résumé** :
  - tableau archétype contre archétype : `xx.x % [bas–haut]` ;
  - taux par deck ;
  - les 10 premières alertes, une ligne chacune, en français, du type « Mur de Pixels (pixelman) — morte : jouable 12 % du temps en main ».
- **Détail** : un tableau par archétype, une ligne par carte et par adversaire, avec toutes les colonnes de `CardStats`, la valeur ajoutée (ou « données insuffisantes »), les taux de jouabilité, et l'impact moyen par partie jouée.

- [ ] **Step 1 : tests** :
  - `wilson(50, 100)` ≈ `{ low: 0.404, high: 0.596 }` à 0,001 près ; `wilson(0, 0)` = `{ low: 0, high: 1 }`.
  - `trop forte contre les deux autres` : télémétrie à la main où « X » pipou a, contre pixelman et contre dragon, `playedGames: 40, playedWins: 30, heldGames: 40, heldWins: 12` → une alerte `trop_forte`, avec `strength` = 45.
  - `pas d'alerte sous 30 parties` : la même carte avec `heldGames: 20` → aucune alerte pour elle.
  - `morte : jamais jouable` : `phasesInHand: 50, phasesPlayable: 5` → alerte `morte`.
  - `manque du deck` : decks dragon `mainPhases: 100, idlePhases: 40, idleReasons.cible: 30` → alerte `manque_deck`, dont le détail contient « cible ».
  - `le résumé tient en peu de lignes` : `formatSummary` d'une télémétrie à 50 alertes contient au plus 10 lignes d'alerte et contient « [ » (intervalles).
- [ ] **Step 2 :** jest `report.spec.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** jest → PASS.
- [ ] **Step 5 : commit** `feat(back): rapport de tournoi avec alertes par carte et par deck`.

### Task 5 : Tournoi parallèle et échelles

**Files:**
- Create: `apps/backend/src/fights/ai/tournament-jobs.ts`
- Create: `apps/backend/src/fights/ai/tournament-jobs.spec.ts`
- Create: `apps/backend/src/fights/ai/tournament-worker.ts`
- Modify: `apps/backend/src/fights/ai/tournament-generated.cli.ts`

**Interfaces:**
- Consumes : `buildGeneratedEntries`, `planGames`, `playPlanned`, `mergeResults` (Task 3) ; `formatSummary`, `formatDetail` (Task 4) ; `allRealCards`.
- Produces :
  - `SCALES: Record<'rapide' | 'standard' | 'complet', { deckSeeds: number; games: number }>` = `{ rapide: {3, 4}, standard: {10, 10}, complet: {30, 20} }` ;
  - `interface Job { deckSeed: number; games: PlannedGame[] }` ;
  - `planJobs(deckSeeds: number[], gamesPerPair: number, seed: number): Job[]` : pour chaque graine de decks, on appelle `planGames` sur les 15 entrées avec la même `seed` (comme le tournoi actuel), puis on regroupe les parties par paire. On obtient un job par graine de decks et par paire ;
  - `runJob(job: Job): TournamentResult`, qui reconstruit les entrées avec `buildGeneratedEntries(allRealCards(), job.deckSeed)` ;
  - `runJobs(jobs: Job[], workers: number, exec?: (job: Job) => Promise<TournamentResult>): Promise<TournamentResult>`, qui fusionne avec `mergeResults` dans l'ordre des jobs.

  `exec` par défaut : un pool de `workers` processus `fork` de `tournament-worker.ts`, lancés avec `execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']`. Le parent envoie un `Job` par message, le worker répond `runJob(job)`.

  Le CLI accepte `--scale` et `--workers`. Les options `--deck-seed`, `--games` et `--seed` restent ; utilisées seules, elles donnent une seule graine. Il écrit :
  - `tournament-<échelle>-<horodatage>-resume.md` ;
  - `…-detail.md` ;
  - `…-detail.json` (le `TournamentResult`).

  En console : le résumé, plus une ligne de progression par tranche de 10 % des jobs.
- [ ] **Step 1 : tests** :
  - `planJobs([1, 2], 1, 42)` donne 210 jobs, chacun d'une partie. Pour une même graine de decks, les 105 graines de parties sont toutes différentes, et égales à celles de `planGames(entries15, 1, 42)`.
  - `fusion indépendante de l'ordre` : avec `exec` en mémoire (`async (j) => runJob(j)`) sur 4 jobs, `runJobs(jobs, 1, exec)` est égal à `runJobs(jobs, 3, exec)`, et à la fusion des résultats calculés dans l'ordre inverse, puis remis dans l'ordre des jobs.
- [ ] **Step 2 :** jest `tournament-jobs.spec.ts` → FAIL.
- [ ] **Step 3 :** implémenter le module, le worker et le CLI.
- [ ] **Step 4 :** jest → PASS. Puis `pnpm --filter @pipou/backend tournament:generated --scale rapide`. Les trois fichiers sont créés, le résumé s'affiche, et le nombre de parties vaut 3 × 105 × 4 = 1 260. Noter la durée.
- [ ] **Step 5 : commit** `feat(back): tournoi parallèle à trois échelles`.

### Task 6 : Mesure de référence

**Files:**
- Modify: `docs/superpowers/plans/2026-10-19-balance-results.md`

- [ ] **Step 1 :** `pnpm --filter @pipou/backend tournament:generated --scale standard`. Le run fait 10 500 parties et prend en principe moins d'une heure ; noter la durée réelle.
- [ ] **Step 2 :** ajouter la section « Référence IA actuelle (Standard) » : méthode (IA déterminisée, graines de decks 1 à 10, 10 parties par paire, graine 42), durée, le résumé copié tel quel, et 3 à 5 lignes de lecture (critère 40-60 % atteint ou non par archétype, alertes marquantes). Ne pas recopier le détail.
- [ ] **Step 3 : commit** `docs: mesure de référence du tournoi avec l'IA actuelle`.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend test` et `pnpm --filter @pipou/backend lint` → verts.
