# Défi du jour — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un puzzle quotidien en un tour (main + plateau imposés, objectif variable) qui donne or, XP, série, succès et progression de quête.

**Architecture:** Module backend `puzzles/` autonome, calqué sur le sandbox : session en mémoire par joueur, namespace Socket.io dédié, état de départ sérialisé en JSON. La logique de jeu reste dans `GameEngine` ; le module n'ajoute que l'objectif, le solveur de vérification, le calendrier et la série, tous en fonctions pures testées. Le frontend réutilise `FightArena` et `useBoardControls`.

**Tech Stack:** NestJS 11, TypeORM (MySQL), Socket.io, Jest (back) ; React 18, TanStack Query, Vitest (front) ; `@pipou/shared`.

**Spec:** `docs/superpowers/specs/2026-11-12-defi-du-jour-design.md`

## Global Constraints

- Branche `feat/daily-puzzle`, créée depuis `main` à jour. Ne pas toucher aux fichiers non commités de `BETTER-AI` (`fights/ai/evaluate*.ts`, `selfplay-data.cli.ts`).
- Tout type ou enum échangé front/back vit dans `@pipou/shared` (aucune dépendance runtime). Après modification : `pnpm build:shared`.
- Aucune commande ne doit toucher Aiven : le `.env` local pointe sur la prod. Lancer l'API uniquement avec `ENV_FILE=.env.dev.local` (base docker `cardcollect_dev`). Les tests Jest n'ouvrent pas de connexion.
- Migrations écrites à la main en SQL, `CREATE TABLE IF NOT EXISTS`, fichier `1791000000029-DailyPuzzle.ts`.
- Front : données serveur via TanStack Query, clés dans `utils/querykeys.ts`, erreurs via `apiErrorMessage`, pas de `any`, pas de composant déclaré dans un composant, icônes SVG de `components/Icons.tsx` (jamais d'emoji), i18n fr/en/ko.
- Récompense par défaut : 100 or, 50 XP. Booster de série tous les 7 jours : `ACHIEVEMENT_REWARD_BOOSTER_ID`.
- Jour de défi = jour de quête : bascule à 4 h (`RESET_HOUR`, `lastDailyReset`).
- Essais illimités, récompense une seule fois par jour (`unique (user_id, date)`).
- Déploiement uniquement par la CI sur `main`. Pas de push sans demande.
- Messages de commit en français, style du dépôt : `feat(puzzle): …`, `test(puzzle): …`.

## Écarts assumés par rapport à la spec

1. **Namespace socket dédié `/puzzle`** au lieu de `/fight`. Raison : le gateway `/fight` porte file d'attente, reprise et timers ; le sandbox a déjà prouvé le modèle « namespace à part ». Aucun impact joueur.
2. **Déterminisme par `withRandom`**. L'aléa en cours de tour vient de `Math.random` (`helpers/game-state.helper.ts` `shuffle`), pas du `Rng` injecté. Chaque `dispatch` de défi est donc enveloppé dans `withRandom(seed, …)` (`fights/ai/rollout.ts`), dans la session comme dans le solveur : même état + même action = même résultat.
3. **`DESTROY_MONSTER` vise l'`instanceId` du monstre posé** (`MonsterOnBoard.instanceId`, figé dans l'état sérialisé), et la destruction est constatée par l'événement `monster_destroyed`, pas par l'absence du plateau (un renvoi en main ne compte pas).
4. **Solveur par tranches** (`setImmediate` tous les 200 nœuds) plutôt que worker : plus simple, ne bloque pas la boucle.
5. Le solveur ne répond jamais « insoluble » : `listCandidates` élague (paiements, `MAX_PICK_COMBOS`). Résultats possibles : `solved`, `not_found`, `timeout`.

## Carte des fichiers

**Shared (`packages/shared/src`)**
- `enums/puzzle.ts` (nouveau) : `PuzzleObjectiveType`, `PuzzleStatus`, `PuzzleScheduleOrigin`.
- `enums/quest.ts`, `enums/achievement.ts`, `enums/enums.test.ts`, `enums/index.ts` (modifiés).
- `game/achievements.ts` (modifié) : deux familles.
- `api/puzzles.ts` (nouveau) + `api/index.ts`.
- `socket/puzzle.ts` (nouveau) + `socket/index.ts`.

**Backend (`apps/backend/src/puzzles`)**
- `puzzle-objective.ts` : suivi et verdict d'objectif (pur).
- `puzzle-step.ts` : un coup de défi déterministe (pur, prend un `GameEngine`).
- `puzzle-solver.ts` : recherche d'une solution.
- `puzzle-schedule.ts` : jour de défi, choix du repli (pur).
- `puzzle-streak.ts` : série (pur).
- `daily-puzzle.entity.ts`, `daily-puzzle-schedule.entity.ts`, `user-puzzle-solve.entity.ts`.
- `puzzles.service.ts` : défi du jour, récompenses, admin.
- `puzzle-session.service.ts` : parties en mémoire.
- `puzzle.gateway.ts`, `puzzle-socket.types.ts`, `puzzles.controller.ts`, `puzzles-admin.controller.ts`, `dto/`, `puzzles.module.ts`.
- `database/migrations/1791000000029-DailyPuzzle.ts`.
- Modifiés : `app.module.ts`, `quests/quests.service.ts`, `quests/quest-pool.ts`, `achievements/achievement-values.ts`, `achievements/achievement-stats.service.ts`, `sandbox/sandbox.service.ts`, `sandbox/sandbox.gateway.ts`.

**Frontend (`apps/frontend/src`)**
- `services/puzzle.service.ts`, `utils/querykeys.ts`.
- `features/puzzle/` : `PuzzleCard.tsx`, `PuzzlePage.tsx`, `PuzzlePlay.tsx`, `usePuzzleSession.ts`, `PuzzleObjectiveBanner.tsx`, `PuzzleResult.tsx`, `puzzleView.ts`, `Puzzle.css`, `admin/PuzzleManager.tsx`, `admin/PuzzleCalendar.tsx`.
- Modifiés : `pages/FightHub.tsx`, `pages/Admin.tsx`, `App.tsx`, `features/sandbox/SandboxToolbar.tsx`, `features/sandbox/SandboxPage.tsx`, `features/achievements/achievementIcons.ts`, `features/quests/QuestManager.tsx`, `components/Icons.tsx`, `i18n/locales/{fr,en,ko}.json`.

---

### Task 0 : Branche

- [ ] **Step 1 :** vérifier que `BETTER-AI` est fusionnée ou que ses fichiers modifiés sont rangés (`git stash -u` seulement avec l'accord de Sasha). Puis :

```bash
git fetch origin && git switch -c feat/daily-puzzle origin/main
pnpm install && pnpm build:shared
```

- [ ] **Step 2 :** la spec et ce plan sont commités sur `BETTER-AI`. S'ils ne sont pas encore sur `main`, les reprendre : `git checkout BETTER-AI -- docs/superpowers/specs/2026-11-12-defi-du-jour-design.md docs/superpowers/plans/2026-11-12-defi-du-jour.md` puis `git commit -m "docs(puzzle): spec et plan du défi du jour"`.

---

### Task 1 : Contrat partagé

**Files:**
- Create: `packages/shared/src/enums/puzzle.ts`, `packages/shared/src/api/puzzles.ts`, `packages/shared/src/socket/puzzle.ts`
- Modify: `packages/shared/src/enums/{quest,achievement,index,enums.test}.ts`, `packages/shared/src/game/achievements.ts`, `packages/shared/src/api/index.ts`, `packages/shared/src/socket/index.ts`

**Interfaces — Produces :** tout ce qui suit, importé par les tâches suivantes depuis `@pipou/shared`.

- [ ] **Step 1 : test d'enums rouge.** Dans `enums/enums.test.ts`, ajouter `"SOLVE_DAILY_PUZZLE"` à la fin de la liste `QuestConditionType`, `"PUZZLES_SOLVED", "PUZZLE_STREAK"` à la fin de celle d'`AchievementFamily`, et trois lignes (avec les imports) :

```ts
["PuzzleObjectiveType", PuzzleObjectiveType, ["WIN_GAME", "DESTROY_MONSTER", "CLEAR_ENEMY_BOARD", "TAKE_PRIMES"]],
["PuzzleStatus", PuzzleStatus, ["draft", "published"]],
["PuzzleScheduleOrigin", PuzzleScheduleOrigin, ["manual", "auto"]],
```

Run : `pnpm --filter @pipou/shared test` — attendu : FAIL.

- [ ] **Step 2 : enums.** `enums/puzzle.ts` :

```ts
// Valeurs stockées en base (daily_puzzle.objective_type / .status, daily_puzzle_schedule.origin).
export const PuzzleObjectiveType = {
  WIN_GAME: "WIN_GAME",
  DESTROY_MONSTER: "DESTROY_MONSTER",
  CLEAR_ENEMY_BOARD: "CLEAR_ENEMY_BOARD",
  TAKE_PRIMES: "TAKE_PRIMES",
} as const;
export type PuzzleObjectiveType =
  (typeof PuzzleObjectiveType)[keyof typeof PuzzleObjectiveType];

export const PuzzleStatus = { DRAFT: "draft", PUBLISHED: "published" } as const;
export type PuzzleStatus = (typeof PuzzleStatus)[keyof typeof PuzzleStatus];

export const PuzzleScheduleOrigin = { MANUAL: "manual", AUTO: "auto" } as const;
export type PuzzleScheduleOrigin =
  (typeof PuzzleScheduleOrigin)[keyof typeof PuzzleScheduleOrigin];
```

Ajouter `export * from "./puzzle";` dans `enums/index.ts`. Ajouter `SOLVE_DAILY_PUZZLE: "SOLVE_DAILY_PUZZLE",` après `DESTROY_CARD` dans `QuestConditionType`, et `PUZZLES_SOLVED: "PUZZLES_SOLVED", PUZZLE_STREAK: "PUZZLE_STREAK",` après `PVE_PLAYED` dans `AchievementFamily`.

Dans `game/achievements.ts`, à la fin de `ACHIEVEMENTS` :

```ts
  { family: AchievementFamily.PUZZLES_SOLVED, tiers: tiers(5, 30, 100) },
  { family: AchievementFamily.PUZZLE_STREAK, tiers: tiers(3, 7, 30) },
```

- [ ] **Step 3 : API.** `api/puzzles.ts` :

```ts
import type { PuzzleObjectiveType, PuzzleScheduleOrigin, PuzzleStatus } from "../enums/puzzle";

/** Objectif d'un défi. `targetInstanceId` : monstre posé à détruire ; `primes` : primes à prendre. */
export interface PuzzleObjective {
  type: PuzzleObjectiveType;
  targetInstanceId?: string;
  primes?: number;
}

/** Objectif tel qu'affiché : le nom de la cible est résolu par le serveur. */
export interface PuzzleObjectiveView extends PuzzleObjective {
  targetName?: string;
}

export interface PuzzleStreak {
  current: number;
  longest: number;
  /** Jours restants avant le prochain booster de série (1 à 7). */
  nextBoosterIn: number;
}

export interface DailyPuzzleSummary {
  id: number;
  title: string;
  description: string | null;
  objective: PuzzleObjectiveView;
  rewardGold: number;
  rewardXp: number;
}

/** GET /puzzles/today. `puzzle` null : aucun défi publié. Jamais l'état du plateau. */
export interface DailyPuzzleInfo {
  date: string;
  puzzle: DailyPuzzleSummary | null;
  solved: boolean;
  streak: PuzzleStreak;
  nextResetAt: string;
}

/** Ce que rapporte une résolution. `firstSolve` false : déjà résolu aujourd'hui, rien de versé. */
export interface PuzzleReward {
  firstSolve: boolean;
  gold: number;
  xp: number;
  booster: boolean;
  streak: PuzzleStreak;
}

export type PuzzleSolveStatus = "solved" | "not_found" | "timeout";

export interface PuzzleVerifyResult {
  status: PuzzleSolveStatus;
  /** Suite de coups lisible, quand une solution est trouvée. */
  solution: string[];
  nodes: number;
  ms: number;
}

export interface AdminPuzzle extends DailyPuzzleSummary {
  status: PuzzleStatus;
  seed: number;
  verifiedAt: string | null;
  createdBy: string;
  updatedAt: string;
  lastPlayed: string | null;
  /** Monstres adverses de l'état de départ, pour choisir la cible. */
  enemyMonsters: { instanceId: string; name: string }[];
}

export interface PuzzleSaveBody {
  title: string;
  description?: string;
  objective: PuzzleObjective;
  rewardGold?: number;
  rewardXp?: number;
}

export interface PuzzlePublishBody {
  /** « Je l'ai résolu moi-même » : publie sans solution trouvée par le solveur. */
  manualOverride?: boolean;
}

export interface PuzzleScheduleEntry {
  date: string;
  puzzleId: number | null;
  title: string | null;
  origin: PuzzleScheduleOrigin | null;
}

export interface PuzzleScheduleBody {
  date: string;
  /** null : libère la date (le repli automatique reprend la main). */
  puzzleId: number | null;
}
```

`export * from "./puzzles";` dans `api/index.ts`.

- [ ] **Step 4 : socket.** `socket/puzzle.ts` :

```ts
import type { PuzzleObjectiveView, PuzzleReward } from "../api/puzzles";
import type { GameAction } from "../game/action";
import type { ClientGameState } from "../game/state";

/** Namespace Socket.io du défi du jour (PuzzleGateway). */
export const PUZZLE_NAMESPACE = "/puzzle";

export type PuzzleOutcome = "ongoing" | "solved" | "failed";

export interface PuzzleStartPayload {
  /** Admin seulement : teste ce défi (aucune récompense). Absent : défi du jour. */
  puzzleId?: number;
}

export interface PuzzleState {
  puzzleId: number;
  view: ClientGameState;
  objective: PuzzleObjectiveView;
  outcome: PuzzleOutcome;
  /** Présent une fois, sur l'état qui annonce la résolution du défi du jour. */
  reward?: PuzzleReward;
  /** Partie de test admin : rien n'est versé. */
  test: boolean;
}

export interface PuzzleClientEvents {
  "puzzle:start": (payload: PuzzleStartPayload) => void;
  "puzzle:action": (action: GameAction) => void;
  "puzzle:restart": () => void;
  "puzzle:close": () => void;
}

export interface PuzzleServerEvents {
  "puzzle:state": (state: PuzzleState) => void;
  "puzzle:closed": () => void;
  "puzzle:error": (payload: { message: string }) => void;
}
```

`export * from "./puzzle";` dans `socket/index.ts`.

- [ ] **Step 5 :** `pnpm --filter @pipou/shared test && pnpm build:shared && pnpm typecheck`. Attendu : shared PASS. Le typecheck back échoue sur `toAchievementValues` (clés manquantes dans le `Record<AchievementFamily, number>`) et le front sur `achievementIcons` : attendu, corrigé en Task 7 et Task 10. Pour garder chaque commit vert, appliquer tout de suite le correctif minimal : dans `achievement-values.ts`, `[AchievementFamily.PUZZLES_SOLVED]: 0, [AchievementFamily.PUZZLE_STREAK]: 0,` ; dans `achievementIcons.ts`, `[AchievementFamily.PUZZLES_SOLVED]: IconFlask, [AchievementFamily.PUZZLE_STREAK]: IconFire,` ; dans `QuestManager.tsx`, `SOLVE_DAILY_PUZZLE: "Résoudre le défi du jour",`. Relancer `pnpm typecheck` : PASS.

- [ ] **Step 6 : commit** `feat(puzzle): contrat partagé du défi du jour`.

---

### Task 2 : Objectif (pur)

**Files:** Create `apps/backend/src/puzzles/puzzle-objective.ts`, `puzzle-objective.spec.ts`

**Interfaces — Produces :**

```ts
export interface PuzzleTrack { startPrimes: number; destroyed: string[] }
export function startTrack(game: GameState): PuzzleTrack
/** À appeler après chaque dispatch, avant de vider game.pendingEvents. */
export function recordEvents(track: PuzzleTrack, game: GameState): void
export function objectiveMet(o: PuzzleObjective, game: GameState, track: PuzzleTrack): boolean
export function puzzleOutcome(o: PuzzleObjective, game: GameState, track: PuzzleTrack): PuzzleOutcome
export function validateObjective(o: PuzzleObjective, game: GameState): string | null
export function validateStart(game: GameState): string | null
```

Convention : le joueur est toujours `game.player1`. Dans ce jeu, `primes` = primes **restant à prendre** ; un joueur gagne quand ses `primes` tombent à 0 (`checkWinCondition`).

- [ ] **Step 1 : tests rouges.** `puzzle-objective.spec.ts` :

```ts
import { PuzzleObjectiveType as T } from '@pipou/shared';
import { scenario, P1_ID, P2_ID } from '../fights/testing/scenario';
import { monsterCard } from '../fights/testing/cards';
import {
  objectiveMet, puzzleOutcome, recordEvents, startTrack,
  validateObjective, validateStart,
} from './puzzle-objective';

const wall = monsterCard('Mur');
const game = () => scenario({ p1: { primes: 3 }, p2: { monsters: [wall] } });
const targetId = (g: ReturnType<typeof game>) => g.player2.monsterZones[0]!.instanceId;

describe('objectif de défi', () => {
  it('WIN_GAME : atteint quand le joueur 1 est déclaré vainqueur', () => {
    const g = game();
    const track = startTrack(g);
    expect(objectiveMet({ type: T.WIN_GAME }, g, track)).toBe(false);
    g.phase = 'finished';
    g.winner = P1_ID;
    expect(puzzleOutcome({ type: T.WIN_GAME }, g, track)).toBe('solved');
  });

  it('DESTROY_MONSTER : exige l’événement de destruction de la cible', () => {
    const g = game();
    const track = startTrack(g);
    const o = { type: T.DESTROY_MONSTER, targetInstanceId: targetId(g) };
    g.player2.monsterZones[0] = null; // renvoyé en main : ne compte pas
    expect(objectiveMet(o, g, track)).toBe(false);
    g.pendingEvents.push({
      kind: 'monster_destroyed', ownerId: P2_ID, zoneIndex: 0,
      instanceId: o.targetInstanceId, cause: 'battle',
    } as never);
    recordEvents(track, g);
    expect(objectiveMet(o, g, track)).toBe(true);
  });

  it('CLEAR_ENEMY_BOARD : plus aucun monstre adverse', () => {
    const g = game();
    const track = startTrack(g);
    expect(objectiveMet({ type: T.CLEAR_ENEMY_BOARD }, g, track)).toBe(false);
    g.player2.monsterZones = [null, null, null];
    expect(objectiveMet({ type: T.CLEAR_ENEMY_BOARD }, g, track)).toBe(true);
  });

  it('TAKE_PRIMES : compte les primes prises depuis le départ', () => {
    const g = game();
    const track = startTrack(g);
    const o = { type: T.TAKE_PRIMES, primes: 2 };
    g.player1.primes = 2;
    expect(objectiveMet(o, g, track)).toBe(false);
    g.player1.primes = 1;
    expect(objectiveMet(o, g, track)).toBe(true);
  });

  it('raté dès que le tour passe à l’adversaire ou que la partie finit sans objectif', () => {
    const g = game();
    const track = startTrack(g);
    const o = { type: T.CLEAR_ENEMY_BOARD };
    expect(puzzleOutcome(o, g, track)).toBe('ongoing');
    g.currentTurnUserId = P2_ID;
    expect(puzzleOutcome(o, g, track)).toBe('failed');
  });

  it('l’objectif atteint prime sur la fin de tour', () => {
    const g = game();
    const track = startTrack(g);
    g.player2.monsterZones = [null, null, null];
    g.currentTurnUserId = P2_ID;
    expect(puzzleOutcome({ type: T.CLEAR_ENEMY_BOARD }, g, track)).toBe('solved');
  });

  it('valide les paramètres', () => {
    const g = game();
    expect(validateObjective({ type: T.DESTROY_MONSTER, targetInstanceId: 'x' }, g)).toMatch(/cible/i);
    expect(validateObjective({ type: T.DESTROY_MONSTER, targetInstanceId: targetId(g) }, g)).toBeNull();
    expect(validateObjective({ type: T.TAKE_PRIMES, primes: 4 }, g)).toMatch(/primes/i);
    expect(validateObjective({ type: T.TAKE_PRIMES, primes: 3 }, g)).toBeNull();
    expect(validateObjective({ type: T.CLEAR_ENEMY_BOARD }, scenario())).toMatch(/monstre/i);
  });

  it('refuse un départ hors phase principale du joueur 1', () => {
    expect(validateStart(scenario())).toBeNull();
    expect(validateStart(scenario({ phase: 'battle' }))).toMatch(/phase/i);
    expect(validateStart(scenario({ turn: 'p2' }))).toMatch(/joueur 1/i);
  });
});
```

Si le littéral de `cause` ne compile pas, lire `DestroyCause` dans `packages/shared/src/game/events.ts` et utiliser une valeur réelle (retirer alors le `as never`).

Run : `pnpm --filter @pipou/backend test -- puzzle-objective` — FAIL (module absent).

- [ ] **Step 2 : implémentation.**

```ts
import { PuzzleObjectiveType as T } from '@pipou/shared';
import type { PuzzleObjective, PuzzleOutcome } from '@pipou/shared';
import type { GameState } from '../fights/interfaces/game-state.interface';

/** Ce que l'état final seul ne dit pas : primes de départ, monstres réellement détruits. */
export interface PuzzleTrack {
  startPrimes: number;
  destroyed: string[];
}

export function startTrack(game: GameState): PuzzleTrack {
  return { startPrimes: game.player1.primes, destroyed: [] };
}

/** À appeler après chaque dispatch, avant de vider `pendingEvents`. */
export function recordEvents(track: PuzzleTrack, game: GameState): void {
  for (const e of game.pendingEvents)
    if (e.kind === 'monster_destroyed') track.destroyed.push(e.instanceId);
}

export function objectiveMet(
  o: PuzzleObjective,
  game: GameState,
  track: PuzzleTrack,
): boolean {
  switch (o.type) {
    case T.WIN_GAME:
      return game.winner === game.player1.userId;
    case T.DESTROY_MONSTER:
      return !!o.targetInstanceId && track.destroyed.includes(o.targetInstanceId);
    case T.CLEAR_ENEMY_BOARD:
      return game.player2.monsterZones.every((m) => m === null);
    case T.TAKE_PRIMES:
      return track.startPrimes - game.player1.primes >= (o.primes ?? 1);
  }
}

export function puzzleOutcome(
  o: PuzzleObjective,
  game: GameState,
  track: PuzzleTrack,
): PuzzleOutcome {
  if (objectiveMet(o, game, track)) return 'solved';
  const turnOver =
    game.phase === 'finished' ||
    game.currentTurnUserId !== game.player1.userId;
  return turnOver ? 'failed' : 'ongoing';
}

export function validateStart(game: GameState): string | null {
  if (game.currentTurnUserId !== game.player1.userId)
    return 'Le défi doit commencer au tour du joueur 1.';
  if (game.phase !== 'main')
    return 'Le défi doit commencer en phase principale.';
  if (game.pendingChoices.length > 0)
    return 'Un choix est en attente : termine-le avant d’enregistrer.';
  return null;
}

export function validateObjective(
  o: PuzzleObjective,
  game: GameState,
): string | null {
  const enemies = game.player2.monsterZones.filter((m) => m !== null);
  switch (o.type) {
    case T.WIN_GAME:
      return null;
    case T.DESTROY_MONSTER:
      return enemies.some((m) => m.instanceId === o.targetInstanceId)
        ? null
        : 'La cible doit être un monstre adverse du plateau de départ.';
    case T.CLEAR_ENEMY_BOARD:
      return enemies.length > 0 ? null : 'Aucun monstre adverse à détruire.';
    case T.TAKE_PRIMES: {
      const n = o.primes ?? 0;
      return Number.isInteger(n) && n >= 1 && n <= game.player1.primes
        ? null
        : `Le nombre de primes doit être entre 1 et ${game.player1.primes}.`;
    }
    default:
      return 'Objectif inconnu.';
  }
}
```

- [ ] **Step 3 :** relancer le test — PASS. **Commit** `feat(puzzle): objectifs et verdict d'un défi`.

---

### Task 3 : Coup déterministe et solveur

**Files:** Create `puzzles/puzzle-step.ts`, `puzzle-step.spec.ts`, `puzzle-solver.ts`, `puzzle-solver.spec.ts`

**Interfaces**
- Consumes : `PuzzleTrack`, `recordEvents`, `puzzleOutcome` (Task 2) ; `GameEngine.dispatch(game, seat, action): { error?: string }` ; `listCandidates(game, seat)` et `activeChoice(game)` (`fights/ai/candidate-actions`) ; `stateSignature(game, seat)` (`fights/ai/planner`) ; `withRandom(seed, f)` (`fights/ai/rollout`) ; `describeAction(action, state)` (`fights/ai/ai-review`) ; `createEngine()` (`fights/testing/engine`).
- Produces :

```ts
// puzzle-step.ts
export function playPuzzleAction(engine: GameEngine, game: GameState, action: GameAction, seed: number, track: PuzzleTrack): { error?: string }
// puzzle-solver.ts
export interface SolveLimits { maxNodes: number; maxMs: number }
export const DEFAULT_LIMITS: SolveLimits  // { maxNodes: 200_000, maxMs: 20_000 }
export interface SolveResult { status: PuzzleSolveStatus; solution: GameAction[]; nodes: number; ms: number }
export function solvePuzzle(engine: GameEngine, start: GameState, objective: PuzzleObjective, seed: number, limits?: SolveLimits): Promise<SolveResult>
```

- [ ] **Step 1 : test du coup.** `puzzle-step.spec.ts` : construire un `scenario` où le joueur 1 a un monstre en mode attaque (ATK ≥ PV du mur) et l'adversaire un `monsterCard('Mur')`. Lire `fights/testing/cards.ts` pour les `overrides` d'ATK/PV et un test d'attaque existant (`rg "type: 'attack'" apps/backend/src/fights --glob "*.spec.ts" -l`) pour la forme exacte de l'action. Trois cas :

```ts
it('joue un coup du joueur 1 et consigne les destructions', () => {
  const g = attackScenario();            // phase 'battle'
  const track = startTrack(g);
  const target = g.player2.monsterZones[0]!.instanceId;
  expect(playPuzzleAction(engine, g, attack(g), 7, track).error).toBeUndefined();
  expect(track.destroyed).toContain(target);
  expect(g.pendingEvents.length).toBeGreaterThan(0); // la session publie puis vide
});

it('renvoie l’erreur du moteur sans consigner', () => {
  const g = attackScenario();
  const track = startTrack(g);
  const r = playPuzzleAction(engine, g, { type: 'summon', handIndex: 99 } as never, 7, track);
  expect(r.error).toBeDefined();
  expect(track.destroyed).toEqual([]);
});

it('est déterministe : même état, même action, même graine', () => {
  const a = attackScenario(); const b = structuredClone(a);
  playPuzzleAction(engine, a, attack(a), 7, startTrack(a));
  playPuzzleAction(engine, b, attack(b), 7, startTrack(b));
  expect(stateSignature(a, 'p1')).toBe(stateSignature(b, 'p1'));
});
```

Run — FAIL.

- [ ] **Step 2 : `puzzle-step.ts`.**

```ts
import type { GameAction } from '@pipou/shared';
import type { GameEngine } from '../fights/engine/game-engine';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { activeChoice, listCandidates } from '../fights/ai/candidate-actions';
import { withRandom } from '../fights/ai/rollout';
import { seatOf } from '../fights/helpers/game-state.helper';
import { recordEvents, type PuzzleTrack } from './puzzle-objective';

/** Garde-fou : un adversaire ne répond jamais plus de quelques fois dans un tour. */
const MAX_REPLIES = 8;

/**
 * Joue un coup du joueur 1. Tout l'aléa (mélange de deck…) est rejoué depuis
 * `seed` : même état + même action = même résultat, pour le joueur comme pour
 * le solveur. Si un effet demande un choix à l'adversaire, il prend le premier
 * coup possible (il n'y a personne en face).
 */
export function playPuzzleAction(
  engine: GameEngine,
  game: GameState,
  action: GameAction,
  seed: number,
  track: PuzzleTrack,
): { error?: string } {
  return withRandom(seed, () => {
    const result = engine.dispatch(game, 'p1', action);
    if (result.error) return { error: result.error };
    for (let i = 0; i < MAX_REPLIES; i++) {
      const choice = activeChoice(game);
      if (!choice || seatOf(game, choice.userId) !== 'p2') break;
      const [reply] = listCandidates(game, 'p2');
      if (!reply || engine.dispatch(game, 'p2', reply).error) break;
    }
    recordEvents(track, game);
    return {};
  });
}
```

Vérifier dans `game-state.interface.ts` le nom du champ joueur de `PendingChoice` (`userId` supposé) et la signature de `seatOf` ; adapter ces deux lignes si besoin. Run — PASS.

- [ ] **Step 3 : tests du solveur.** `puzzle-solver.spec.ts` :

```ts
const limits = { maxNodes: 20_000, maxMs: 5_000 };

it('trouve la solution en un coup', async () => {
  const g = attackScenario();
  const o = { type: T.DESTROY_MONSTER, targetInstanceId: g.player2.monsterZones[0]!.instanceId };
  const r = await solvePuzzle(engine, g, o, 7, limits);
  expect(r.status).toBe('solved');
  expect(r.solution.at(-1)).toMatchObject({ type: 'attack' });
});

it('enchaîne phase principale puis combat', async () => {
  const g = attackScenario({ phase: 'main' });
  const r = await solvePuzzle(engine, g, { type: T.CLEAR_ENEMY_BOARD }, 7, limits);
  expect(r.status).toBe('solved');
  expect(r.solution.length).toBeGreaterThanOrEqual(2);
});

it('la solution rejouée atteint bien l’objectif', async () => {
  const g = attackScenario({ phase: 'main' });
  const o = { type: T.CLEAR_ENEMY_BOARD };
  const r = await solvePuzzle(engine, g, o, 7, limits);
  const replay = structuredClone(g); const track = startTrack(replay);
  for (const a of r.solution) playPuzzleAction(engine, replay, a, 7, track);
  expect(puzzleOutcome(o, replay, track)).toBe('solved');
});

it('ne modifie pas l’état de départ', async () => {
  const g = attackScenario(); const before = JSON.stringify(g);
  await solvePuzzle(engine, g, { type: T.CLEAR_ENEMY_BOARD }, 7, limits);
  expect(JSON.stringify(g)).toBe(before);
});

it('répond not_found, jamais « insoluble », quand rien ne marche', async () => {
  const g = attackScenario({ wallHp: 999 });
  const r = await solvePuzzle(engine, g, { type: T.CLEAR_ENEMY_BOARD }, 7, limits);
  expect(r.status).toBe('not_found');
});

it('s’arrête au plafond de nœuds', async () => {
  const g = attackScenario({ phase: 'main' });
  const r = await solvePuzzle(engine, g, { type: T.TAKE_PRIMES, primes: 6 }, 7, { maxNodes: 1, maxMs: 5_000 });
  expect(r.status).toBe('timeout');
});
```

`attackScenario(opts)` est une fabrique locale au spec (partageable via `puzzles/testing/attack-scenario.ts`, utilisée aussi par Task 3 Step 1 et Task 6).

- [ ] **Step 4 : `puzzle-solver.ts`.**

```ts
import type { GameAction, PuzzleObjective, PuzzleSolveStatus } from '@pipou/shared';
import type { GameEngine } from '../fights/engine/game-engine';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { listCandidates } from '../fights/ai/candidate-actions';
import { stateSignature } from '../fights/ai/planner';
import { puzzleOutcome, startTrack, type PuzzleTrack } from './puzzle-objective';
import { playPuzzleAction } from './puzzle-step';

export interface SolveLimits { maxNodes: number; maxMs: number }
export const DEFAULT_LIMITS: SolveLimits = { maxNodes: 200_000, maxMs: 20_000 };
/** Rend la main à la boucle d'événements tous les N nœuds. */
const SLICE = 200;

export interface SolveResult {
  status: PuzzleSolveStatus;
  solution: GameAction[];
  nodes: number;
  ms: number;
}

interface Node { game: GameState; track: PuzzleTrack; path: GameAction[] }

const fork = (game: GameState): GameState =>
  structuredClone({ ...game, log: [], pendingEvents: [] });

/**
 * Cherche en profondeur une suite de coups qui atteint l'objectif dans le tour.
 * `listCandidates` élague (paiement le moins cher, combinaisons plafonnées) :
 * une recherche épuisée ne prouve donc pas qu'il n'y a pas de solution, d'où
 * `not_found` et jamais « insoluble ».
 */
export async function solvePuzzle(
  engine: GameEngine,
  start: GameState,
  objective: PuzzleObjective,
  seed: number,
  limits: SolveLimits = DEFAULT_LIMITS,
): Promise<SolveResult> {
  const t0 = Date.now();
  const done = (status: PuzzleSolveStatus, solution: GameAction[] = []) => ({
    status, solution, nodes, ms: Date.now() - t0,
  });
  let nodes = 0;
  const seen = new Set<string>();
  const key = (n: Node) =>
    `${stateSignature(n.game, 'p1')}|${n.track.destroyed.join(',')}`;
  const root: Node = { game: fork(start), track: startTrack(start), path: [] };
  if (puzzleOutcome(objective, root.game, root.track) === 'solved') return done('solved');
  const stack: Node[] = [root];
  seen.add(key(root));

  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const action of listCandidates(node.game, 'p1')) {
      if (nodes >= limits.maxNodes || Date.now() - t0 > limits.maxMs)
        return done('timeout');
      nodes++;
      if (nodes % SLICE === 0) await new Promise((r) => setImmediate(r));
      const next: Node = {
        game: fork(node.game),
        track: { ...node.track, destroyed: [...node.track.destroyed] },
        path: [...node.path, action],
      };
      let error: string | undefined;
      try {
        error = playPuzzleAction(engine, next.game, action, seed, next.track).error;
      } catch {
        continue; // coup que le moteur ne sait pas jouer : branche abandonnée
      }
      if (error) continue;
      const outcome = puzzleOutcome(objective, next.game, next.track);
      if (outcome === 'solved') return done('solved', next.path);
      if (outcome === 'failed') continue;
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push(next);
    }
  }
  return done('not_found');
}
```

- [ ] **Step 5 :** `pnpm --filter @pipou/backend test -- puzzle-step puzzle-solver` — PASS. **Commit** `feat(puzzle): coup déterministe et solveur de vérification`.

---

### Task 4 : Calendrier et série (purs)

**Files:** Create `puzzles/puzzle-schedule.ts` (+ spec), `puzzles/puzzle-streak.ts` (+ spec)

**Interfaces — Produces :**

```ts
export function puzzleDay(now: Date): string                      // 'YYYY-MM-DD', bascule à 4 h
export function addDays(day: string, n: number): string
export interface FallbackCandidate { id: number; lastPlayed: string | null }
export function pickFallback(candidates: FallbackCandidate[]): number | null
export const STREAK_BOOSTER_EVERY = 7;
export function computeStreak(days: string[], today: string): PuzzleStreak
export function earnsBooster(current: number): boolean
```

- [ ] **Step 1 : tests rouges.**

```ts
// puzzle-schedule.spec.ts
it('le jour de défi bascule à 4 h', () => {
  expect(puzzleDay(new Date(2026, 10, 12, 3, 59))).toBe('2026-11-11');
  expect(puzzleDay(new Date(2026, 10, 12, 4, 0))).toBe('2026-11-12');
});
it('addDays traverse les mois', () => {
  expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});
it('repli : jamais joué d’abord, puis le plus ancien, puis le plus petit id', () => {
  expect(pickFallback([])).toBeNull();
  expect(pickFallback([{ id: 1, lastPlayed: '2026-11-01' }, { id: 2, lastPlayed: null }])).toBe(2);
  expect(pickFallback([{ id: 3, lastPlayed: '2026-11-05' }, { id: 4, lastPlayed: '2026-11-02' }])).toBe(4);
  expect(pickFallback([{ id: 9, lastPlayed: null }, { id: 5, lastPlayed: null }])).toBe(5);
});

// puzzle-streak.spec.ts
const today = '2026-11-12';
it('aucune résolution', () =>
  expect(computeStreak([], today)).toEqual({ current: 0, longest: 0, nextBoosterIn: 7 }));
it('série en cours jusqu’à aujourd’hui', () =>
  expect(computeStreak(['2026-11-10', '2026-11-11', '2026-11-12'], today))
    .toEqual({ current: 3, longest: 3, nextBoosterIn: 4 }));
it('pas encore joué aujourd’hui : la série d’hier tient', () =>
  expect(computeStreak(['2026-11-10', '2026-11-11'], today).current).toBe(2));
it('un jour manqué remet à zéro mais garde le record', () =>
  expect(computeStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10'], today))
    .toEqual({ current: 0, longest: 3, nextBoosterIn: 7 }));
it('booster tous les 7 jours', () => {
  expect(earnsBooster(7)).toBe(true);
  expect(earnsBooster(14)).toBe(true);
  expect(earnsBooster(8)).toBe(false);
  expect(earnsBooster(0)).toBe(false);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  expect(computeStreak(week, today).nextBoosterIn).toBe(7);
});
```

- [ ] **Step 2 : implémentation.**

```ts
// puzzle-schedule.ts
import { lastDailyReset } from '../quests/quest-schedule';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Jour de défi courant : il change à l'heure de reset des quêtes, pas à minuit. */
export function puzzleDay(now: Date): string {
  return fmt(lastDailyReset(now));
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return fmt(new Date(y, m - 1, d + n));
}

export interface FallbackCandidate { id: number; lastPlayed: string | null }

/** Défi le moins récemment joué : rotation équitable quand rien n'est programmé. */
export function pickFallback(candidates: FallbackCandidate[]): number | null {
  const sorted = [...candidates].sort(
    (a, b) => (a.lastPlayed ?? '').localeCompare(b.lastPlayed ?? '') || a.id - b.id,
  );
  return sorted[0]?.id ?? null;
}
```

Vérifier que `lastDailyReset` est exporté de `quest-schedule.ts` (sinon l'exporter).

```ts
// puzzle-streak.ts
import type { PuzzleStreak } from '@pipou/shared';
import { addDays } from './puzzle-schedule';

export const STREAK_BOOSTER_EVERY = 7;

export function earnsBooster(current: number): boolean {
  return current > 0 && current % STREAK_BOOSTER_EVERY === 0;
}

/** `days` : jours de défi résolus ('YYYY-MM-DD'), sans ordre imposé. */
export function computeStreak(days: string[], today: string): PuzzleStreak {
  const solved = new Set(days);
  let longest = 0;
  for (const day of solved) {
    if (solved.has(addDays(day, -1))) continue; // pas un début de série
    let len = 1;
    while (solved.has(addDays(day, len))) len++;
    longest = Math.max(longest, len);
  }
  // Tant qu'aujourd'hui n'est pas joué, la série d'hier reste en cours.
  let cursor = solved.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (solved.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return {
    current,
    longest,
    nextBoosterIn: STREAK_BOOSTER_EVERY - (current % STREAK_BOOSTER_EVERY),
  };
}
```

- [ ] **Step 3 :** tests PASS. **Commit** `feat(puzzle): jour de défi, repli automatique et série`.

---

### Task 5 : Entités et migration

**Files:** Create `puzzles/daily-puzzle.entity.ts`, `daily-puzzle-schedule.entity.ts`, `user-puzzle-solve.entity.ts`, `database/migrations/1791000000029-DailyPuzzle.ts`

- [ ] **Step 1 : entités.** Suivre `sandbox/sandbox-scenario.entity.ts` pour les décorateurs de dates et de clé étrangère.

```ts
// daily-puzzle.entity.ts
@Entity('daily_puzzle')
export class DailyPuzzle {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 80 }) title: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) description: string | null;
  /** État de départ sérialisé (scenario-serializer). */
  @Column({ type: 'json' }) state: SerializedGame;
  @Column({ name: 'objective_type', type: 'varchar', length: 24 }) objectiveType: PuzzleObjectiveType;
  @Column({ name: 'objective_params', type: 'json' }) objectiveParams: { targetInstanceId?: string; primes?: number };
  @Column({ type: 'int' }) seed: number;
  @Column({ name: 'reward_gold', type: 'int', default: 100 }) rewardGold: number;
  @Column({ name: 'reward_xp', type: 'int', default: 50 }) rewardXp: number;
  @Column({ type: 'varchar', length: 12, default: PuzzleStatus.DRAFT }) status: PuzzleStatus;
  @Column({ name: 'verified_at', type: 'datetime', nullable: true }) verifiedAt: Date | null;
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id', foreignKeyConstraintName: 'fk_daily_puzzle_user' })
  createdBy: User;
  @CreateDateColumn({ type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;
  @UpdateDateColumn({ type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }) updatedAt: Date;
}

// daily-puzzle-schedule.entity.ts
@Entity('daily_puzzle_schedule')
@Unique('uq_puzzle_schedule_date', ['date'])
export class DailyPuzzleSchedule {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 10 }) date: string; // 'YYYY-MM-DD'
  @Column({ name: 'puzzle_id', type: 'int' }) puzzleId: number;
  @ManyToOne(() => DailyPuzzle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'puzzle_id', foreignKeyConstraintName: 'fk_puzzle_schedule_puzzle' })
  puzzle: DailyPuzzle;
  @Column({ type: 'varchar', length: 8 }) origin: PuzzleScheduleOrigin;
}

// user-puzzle-solve.entity.ts
@Entity('user_puzzle_solve')
@Unique('uq_user_puzzle_day', ['userId', 'date'])
export class UserPuzzleSolve {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'user_id', type: 'int' }) userId: number;
  @Column({ type: 'varchar', length: 10 }) date: string;
  @Column({ name: 'puzzle_id', type: 'int' }) puzzleId: number;
  @Column({ name: 'solved_at', type: 'datetime' }) solvedAt: Date;
}
```

`date` est stockée en `varchar(10)` : pas de conversion de fuseau par le driver, comparaison lexicographique valide. Lire `database/naming.strategy.ts` : si la stratégie renomme déjà en snake_case, retirer les `name:` redondants pour rester cohérent avec les autres entités.

- [ ] **Step 2 : migration** (même forme que `1791000000028-GameRecord.ts`) :

```ts
export class DailyPuzzle1791000000029 implements MigrationInterface {
  name = 'DailyPuzzle1791000000029';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      "CREATE TABLE IF NOT EXISTS `daily_puzzle` (`id` int NOT NULL AUTO_INCREMENT, `title` varchar(80) NOT NULL, `description` varchar(255) NULL, `state` json NOT NULL, `objective_type` varchar(24) NOT NULL, `objective_params` json NOT NULL, `seed` int NOT NULL, `reward_gold` int NOT NULL DEFAULT 100, `reward_xp` int NOT NULL DEFAULT 50, `status` varchar(12) NOT NULL DEFAULT 'draft', `verified_at` datetime NULL, `created_by_id` int NULL, `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX `idx_daily_puzzle_status` (`status`), PRIMARY KEY (`id`), CONSTRAINT `fk_daily_puzzle_user` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE CASCADE) ENGINE=InnoDB",
    );
    await q.query(
      'CREATE TABLE IF NOT EXISTS `daily_puzzle_schedule` (`id` int NOT NULL AUTO_INCREMENT, `date` varchar(10) NOT NULL, `puzzle_id` int NOT NULL, `origin` varchar(8) NOT NULL, UNIQUE INDEX `uq_puzzle_schedule_date` (`date`), PRIMARY KEY (`id`), CONSTRAINT `fk_puzzle_schedule_puzzle` FOREIGN KEY (`puzzle_id`) REFERENCES `daily_puzzle`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await q.query(
      'CREATE TABLE IF NOT EXISTS `user_puzzle_solve` (`id` int NOT NULL AUTO_INCREMENT, `user_id` int NOT NULL, `date` varchar(10) NOT NULL, `puzzle_id` int NOT NULL, `solved_at` datetime NOT NULL, UNIQUE INDEX `uq_user_puzzle_day` (`user_id`, `date`), PRIMARY KEY (`id`), CONSTRAINT `fk_puzzle_solve_user` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS `user_puzzle_solve`');
    await q.query('DROP TABLE IF EXISTS `daily_puzzle_schedule`');
    await q.query('DROP TABLE IF EXISTS `daily_puzzle`');
  }
}
```

Avant de valider : comparer les noms de colonnes à ceux que génère la stratégie de nommage (`created_by_id`, `created_at`), en regardant la migration de `sandbox_scenario` (`rg "sandbox_scenario" apps/backend/src/database/migrations`).

- [ ] **Step 3 : vérification locale uniquement.** Suivre la mémoire « Local test env » : base docker `cardcollect_dev`, `ENV_FILE=.env.dev.local`. Lancer la migration avec le script du dépôt (`rg "migration" apps/backend/package.json`), puis `SHOW CREATE TABLE daily_puzzle;` dans le conteneur. Ne jamais lancer ces commandes avec le `.env` par défaut (prod Aiven).

- [ ] **Step 4 :** `pnpm --filter @pipou/backend typecheck` PASS. **Commit** `feat(puzzle): tables des défis, du calendrier et des résolutions`.

---

### Task 6 : `PuzzlesService` — défi du jour et récompenses

**Files:** Create `puzzles/puzzles.service.ts`, `puzzles.service.spec.ts`, `puzzles.module.ts`, `puzzles.controller.ts` ; Modify `app.module.ts`

**Interfaces**
- Consumes : entités (Task 5), `puzzleDay`, `pickFallback`, `computeStreak`, `earnsBooster` (Task 4), `UsersService.addGold(userId, amount, manager?)`, `addExperience(userId, amount, manager?)`, `addBoosterToUser(userId, boosterId, quantity, manager?)`, `nextDailyReset(now)`, `deserializeGame` / `collectCardIds` (`sandbox/scenario-serializer`).
- Produces :

```ts
export interface LoadedPuzzle { puzzle: DailyPuzzle; objective: PuzzleObjective; game: GameState }
class PuzzlesService {
  today(): Promise<{ date: string; puzzle: DailyPuzzle | null }>
  getToday(userId: number): Promise<DailyPuzzleInfo>
  completeToday(userId: number, puzzleId: number): Promise<PuzzleReward>
  /** État de départ désérialisé pour ce joueur (sièges : userId et -userId). */
  load(puzzleId: number, user: { userId: number; username: string }): Promise<LoadedPuzzle>
  objectiveView(puzzle: DailyPuzzle, game?: GameState): PuzzleObjectiveView
  streakOf(userId: number, today: string): Promise<PuzzleStreak>
}
```

- [ ] **Step 1 : tests rouges** (dépôts simulés, comme `quests.service.spec.ts` ; pas de base). Cas à écrire, chacun avec ses assertions :

```ts
it('today : renvoie le défi programmé', …)            // schedule.findOne → row ; aucun insert
it('today : sans programmation, inscrit le repli le moins récemment joué (origin auto)', …)
   // candidats = publiés ET verifiedAt non nul ; insert … orIgnore puis relecture
it('today : aucun défi publié → puzzle null, rien d’écrit', …)
it('getToday : n’expose jamais state', …)              // expect(JSON.stringify(info)).not.toContain('"state"')
it('completeToday : première résolution verse or + XP et émet puzzle.solved', …)
   // addGold(7, 100, manager), addExperience(7, 50, manager), emit('puzzle.solved', { userId: 7, date })
it('completeToday : déjà résolu aujourd’hui → firstSolve false, rien de versé, rien d’émis', …)
it('completeToday : 7e jour de série → booster', …)   // addBoosterToUser(7, ACHIEVEMENT_REWARD_BOOSTER_ID, 1, manager)
it('completeToday : refuse un défi qui n’est pas celui du jour', …)   // BadRequestException
```

Run — FAIL.

- [ ] **Step 2 : service.**

```ts
@Injectable()
export class PuzzlesService {
  constructor(
    @InjectRepository(DailyPuzzle) private readonly puzzles: Repository<DailyPuzzle>,
    @InjectRepository(DailyPuzzleSchedule) private readonly schedule: Repository<DailyPuzzleSchedule>,
    @InjectRepository(UserPuzzleSolve) private readonly solves: Repository<UserPuzzleSolve>,
    @InjectRepository(Card) private readonly cards: Repository<Card>,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  /** Défi du jour ; sans programmation, le repli est inscrit pour que tous voient le même. */
  async today(now = new Date()): Promise<{ date: string; puzzle: DailyPuzzle | null }> {
    const date = puzzleDay(now);
    const planned = await this.schedule.findOne({ where: { date }, relations: { puzzle: true } });
    if (planned) return { date, puzzle: planned.puzzle };

    const rows = await this.dataSource.query<{ id: number; lastPlayed: string | null }[]>(
      `SELECT p.id AS id, MAX(s.date) AS lastPlayed
         FROM daily_puzzle p LEFT JOIN daily_puzzle_schedule s ON s.puzzle_id = p.id
        WHERE p.status = ? AND p.verified_at IS NOT NULL
        GROUP BY p.id`,
      [PuzzleStatus.PUBLISHED],
    );
    const id = pickFallback(rows.map((r) => ({ id: Number(r.id), lastPlayed: r.lastPlayed })));
    if (id === null) return { date, puzzle: null };
    // orIgnore : deux premiers accès simultanés n'inscrivent qu'une ligne
    await this.schedule.createQueryBuilder().insert()
      .values({ date, puzzleId: id, origin: PuzzleScheduleOrigin.AUTO }).orIgnore().execute();
    const row = await this.schedule.findOne({ where: { date }, relations: { puzzle: true } });
    return { date, puzzle: row?.puzzle ?? null };
  }

  async streakOf(userId: number, today: string): Promise<PuzzleStreak> {
    const rows = await this.solves.find({ where: { userId }, select: ['date'] });
    return computeStreak(rows.map((r) => r.date), today);
  }

  objectiveView(puzzle: DailyPuzzle): PuzzleObjectiveView {
    const objective: PuzzleObjectiveView = { type: puzzle.objectiveType, ...puzzle.objectiveParams };
    if (objective.targetInstanceId)
      objective.targetName = enemyMonsters(puzzle.state)
        .find((m) => m.instanceId === objective.targetInstanceId)?.name;
    return objective;
  }

  async getToday(userId: number): Promise<DailyPuzzleInfo> {
    const now = new Date();
    const { date, puzzle } = await this.today(now);
    const [solved, streak] = await Promise.all([
      this.solves.exists({ where: { userId, date } }),
      this.streakOf(userId, date),
    ]);
    return {
      date,
      puzzle: puzzle && {
        id: puzzle.id, title: puzzle.title, description: puzzle.description,
        objective: this.objectiveView(puzzle),
        rewardGold: puzzle.rewardGold, rewardXp: puzzle.rewardXp,
      },
      solved, streak, nextResetAt: nextDailyReset(now).toISOString(),
    };
  }

  async completeToday(userId: number, puzzleId: number): Promise<PuzzleReward> {
    const { date, puzzle } = await this.today();
    if (!puzzle || puzzle.id !== puzzleId)
      throw new BadRequestException('Ce défi n’est plus le défi du jour.');

    const reward = await this.dataSource.transaction(async (m) => {
      // La contrainte unique (user_id, date) arbitre deux résolutions simultanées.
      const inserted = await m.createQueryBuilder().insert().into(UserPuzzleSolve)
        .values({ userId, date, puzzleId, solvedAt: new Date() }).orIgnore().execute();
      const first = (inserted.raw as { affectedRows?: number }).affectedRows === 1;
      const days = await m.find(UserPuzzleSolve, { where: { userId }, select: ['date'] });
      const streak = computeStreak(days.map((d) => d.date), date);
      if (!first) return { firstSolve: false, gold: 0, xp: 0, booster: false, streak };
      await this.users.addGold(userId, puzzle.rewardGold, m);
      await this.users.addExperience(userId, puzzle.rewardXp, m);
      const booster = earnsBooster(streak.current);
      if (booster) await this.users.addBoosterToUser(userId, ACHIEVEMENT_REWARD_BOOSTER_ID, 1, m);
      return { firstSolve: true, gold: puzzle.rewardGold, xp: puzzle.rewardXp, booster, streak };
    });
    if (reward.firstSolve) this.events.emit('puzzle.solved', { userId, date });
    return reward;
  }

  async load(puzzleId: number, user: { userId: number; username: string }): Promise<LoadedPuzzle> {
    const puzzle = await this.puzzles.findOneBy({ id: puzzleId });
    if (!puzzle) throw new NotFoundException('Défi introuvable.');
    const ids = collectCardIds(puzzle.state);
    const found = ids.length ? await this.cards.findBy({ id: In(ids) }) : [];
    const game = deserializeGame(puzzle.state, new Map(found.map((c) => [c.id, c])), {
      matchId: -user.userId,
      p1: { userId: user.userId, username: user.username, socketId: '' },
      p2: { userId: -user.userId, username: 'Défi', socketId: '' },
    });
    return { puzzle, objective: { type: puzzle.objectiveType, ...puzzle.objectiveParams }, game };
  }
}
```

`enemyMonsters(state: SerializedGame): { instanceId: string; name: string }[]` : fonction de module dans le même fichier. Lire `scenario-serializer.ts` pour la forme exacte d'un monstre sérialisé (id de carte à la place de `baseCard`) ; si le nom n'y est pas, `objectiveView` devient asynchrone et passe par `load` (adapter alors `getToday`). Vérifier aussi la forme de `SeatEntry` (`fights/helpers/game-factory.ts`) et recopier l'appel `seats()` du sandbox si elle diffère. Vérifier que `earn gold` de `addGold` n'alimente pas `moneyEarned` (sinon rien à faire ; ne pas l'ajouter).

- [ ] **Step 3 : contrôleur et module.**

```ts
@Controller('puzzles')
@UseGuards(JwtAuthGuard)
export class PuzzlesController {
  constructor(private readonly puzzles: PuzzlesService) {}

  @Get('today')
  today(@Request() req: AuthenticatedRequest): Promise<DailyPuzzleInfo> {
    return this.puzzles.getToday(req.user.userId);
  }
}
```

`puzzles.module.ts` : `imports: [TypeOrmModule.forFeature([DailyPuzzle, DailyPuzzleSchedule, UserPuzzleSolve, Card]), FightsModule, UsersModule, JwtModule.registerAsync(…)]` (recopier le bloc `JwtModule` de `sandbox.module.ts`), `providers: [PuzzlesService]`, `controllers: [PuzzlesController]`, `exports: [PuzzlesService]`. Ajouter `PuzzlesModule` à `app.module.ts` après `SandboxModule`.

- [ ] **Step 4 :** tests PASS, `pnpm --filter @pipou/backend typecheck` PASS. **Commit** `feat(puzzle): défi du jour, récompenses et série`.

---

### Task 7 : Quêtes et succès

**Files:** Modify `quests/quests.service.ts`, `quests/quests.service.spec.ts`, `quests/quest-pool.ts`, `quests/quest-pool.seeder.spec.ts` (si le nombre de quêtes y est figé), `achievements/achievement-values.ts` (+ spec), `achievements/achievement-stats.service.ts` (+ spec)

**Interfaces — Consumes :** événement `'puzzle.solved'` `{ userId: number; date: string }` (Task 6) ; `puzzleDay` (Task 4) ; `computeStreak`.

`QuestService` lit les tables de défi en SQL brut (comme `checkSetCompletion`) : pas d'import de `PuzzlesModule`, donc pas de dépendance circulaire.

- [ ] **Step 1 : tests rouges** dans `quests.service.spec.ts` :

```ts
it('puzzle.solved fait avancer SOLVE_DAILY_PUZZLE', …)
it('tirage du jour : la quête de défi n’est pas tirée un jour sans défi', …)
   // puzzleState → { available: false } ; le pool passé à drawDistinct ne contient pas la quête
it('tirage du jour : défi déjà résolu → la quête de défi naît terminée', …)
   // isCompleted true, completedAt défini, questsCompleted incrémenté de 1, quest.completed émis
it('relance : tomber sur la quête de défi après l’avoir résolu la termine aussitôt', …)
it('relance : la quête de défi n’est pas proposée un jour sans défi', …)
```

- [ ] **Step 2 : implémentation** dans `quests.service.ts`.

```ts
const isPuzzleQuest = (q: Quest) =>
  q.conditionGroup.conditions.some((c) => c.type === ConditionType.SOLVE_DAILY_PUZZLE);

/** Le défi du jour existe-t-il, et ce joueur l'a-t-il déjà résolu ? */
private async puzzleState(userId: number): Promise<{ available: boolean; solved: boolean }> {
  const date = puzzleDay(new Date());
  const [row] = await this.questRepository.manager.query<
    { planned: string | number; fallback: string | number; solved: string | number }[]
  >(
    `SELECT
       (SELECT COUNT(*) FROM daily_puzzle_schedule WHERE date = ?) AS planned,
       (SELECT COUNT(*) FROM daily_puzzle WHERE status = 'published' AND verified_at IS NOT NULL) AS fallback,
       (SELECT COUNT(*) FROM user_puzzle_solve WHERE user_id = ? AND date = ?) AS solved`,
    [date, userId, date],
  );
  return {
    available: Number(row?.planned ?? 0) + Number(row?.fallback ?? 0) > 0,
    solved: Number(row?.solved ?? 0) > 0,
  };
}

/** Quête de défi attribuée après la résolution : elle compte tout de suite. */
private async creditSolvedPuzzle(userId: number, uq: UserQuest): Promise<void> {
  if (!this.updateProgress(uq, ConditionType.SOLVE_DAILY_PUZZLE, {})) return;
  await this.userQuestRepository.save(uq);
  if (!uq.isCompleted) return;
  await this.userRepository.increment({ id: userId }, 'questsCompleted', 1);
  this.eventEmitter.emit('quest.completed', {
    userId, userQuestId: uq.id, title: uq.quest.title,
    rewardType: uq.quest.rewardType, rewardAmount: Number(uq.quest.rewardAmount),
  });
}
```

Dans `redrawPool`, uniquement pour `type === QuestResetType.DAILY` : appeler `puzzleState(userId)` avant le tirage ; `const drawable = state.available ? pool : pool.filter((q) => !isPuzzleQuest(q));` ; tirer dans `drawable` ; garder le retour de `save(...)` et, si `state.solved`, appeler `creditSolvedPuzzle` sur chaque `UserQuest` créée dont `isPuzzleQuest(uq.quest)`.

Dans `rerollQuest` : filtrer `candidates` de la même façon (seulement si le type est DAILY) ; après `const saved = await this.userQuestRepository.save(uq);`, `if (isPuzzleQuest(replacement) && state.solved) await this.creditSolvedPuzzle(userId, saved);`. Le garde `if (uq.isCompleted) throw` en tête porte sur l'ancienne quête et reste inchangé.

Nouveau handler, à côté d'`adventure.finished` :

```ts
@OnEvent('puzzle.solved')
async handlePuzzleSolved(payload: { userId: number }) {
  // Comme pour la récompense quotidienne : les quêtes du jour n'existent peut-être pas encore.
  await this.syncUserQuests(payload.userId);
  await this.track(payload.userId, ConditionType.SOLVE_DAILY_PUZZLE);
}
```

Ordre des faits à vérifier dans le test : `completeToday` insère la résolution **avant** d'émettre ; si le sync déclenché ici tire la quête de défi, `creditSolvedPuzzle` la termine, et le `track` qui suit ne trouve plus rien à faire (`isCompleted: false` filtré). Pas de double comptage.

Dans `quest-pool.ts`, après `d_daily_reward` : `daily('d_puzzle', { type: C.SOLVE_DAILY_PUZZLE, amount: 1 }, gold(100)),`. Lire `quest-pool.seeder.ts` pour confirmer que le titre vient d'une table de libellés par `poolKey` ou par type, et y ajouter « Résous le défi du jour ».

- [ ] **Step 3 : succès.** `achievement-values.ts` : ajouter à `AchievementSources` `puzzles: { solved: number; longestStreak: number };` et remplacer les deux `0` provisoires de Task 1 par `src.puzzles.solved` et `src.puzzles.longestStreak`. Adapter `achievement-values.spec.ts` (une assertion par famille). `achievement-stats.service.ts` : ajouter au `Promise.all`

```ts
this.dataSource.query<{ date: string }[]>(
  'SELECT date FROM user_puzzle_solve WHERE user_id = ?', [userId]),
```

puis `puzzles: { solved: solvedDays.length, longestStreak: computeStreak(solvedDays.map((d) => d.date), puzzleDay(new Date())).longest }`. Mettre à jour le mock de `dataSource.query` dans `achievement-stats.service.spec.ts` (une réponse de plus, dans l'ordre du `Promise.all`).

- [ ] **Step 4 :** `pnpm --filter @pipou/backend test -- quests achievement` PASS. **Commit** `feat(puzzle): quête « résous le défi du jour » et succès de défi`.

---

### Task 8 : Session et gateway

**Files:** Create `puzzles/puzzle-session.service.ts` (+ spec), `puzzle.gateway.ts` (+ spec), `puzzle-socket.types.ts` ; Modify `puzzles.module.ts`

**Interfaces**
- Consumes : `PuzzlesService.today/load/completeToday/objectiveView`, `playPuzzleAction`, `startTrack`, `puzzleOutcome`, `buildClientState(game, userId)`, `readSocketUser`.
- Produces : `PuzzleSessionService.start(user, socketId, payload)`, `act(userId, action)`, `restart(userId)`, `close(userId)`, `disconnect(userId)`, `bind(server)`.

- [ ] **Step 1 : tests rouges** (`PuzzlesService` simulé, moteur réel via `createEngine()`, `attackScenario`) :

```ts
it('start : envoie l’état de départ, outcome ongoing', …)
it('start sans puzzleId, aucun défi du jour → erreur « Aucun défi aujourd’hui. »', …)
it('start avec puzzleId par un non-admin → refus', …)
it('action invalide : état inchangé, erreur renvoyée', …)
it('objectif atteint : completeToday appelé une fois, reward dans l’état, outcome solved', …)
it('partie de test admin : completeToday jamais appelé, test true', …)
it('fin de tour sans objectif : outcome failed, toute action suivante refusée', …)
it('restart : retour à l’état de départ, mêmes instanceId, outcome ongoing', …)
it('restart après résolution : rejouable, completeToday renvoie firstSolve false', …)
it('les événements sont publiés une fois puis vidés', …)
it('le défi a changé pendant la partie (4 h passées) : résolution sans récompense, message clair', …)
```

- [ ] **Step 2 : service.**

```ts
interface Session {
  socketId: string;
  puzzleId: number;
  objective: PuzzleObjective;
  objectiveView: PuzzleObjectiveView;
  seed: number;
  /** État de départ, jamais modifié : « Recommencer » en repart. */
  initial: GameState;
  game: GameState;
  track: PuzzleTrack;
  outcome: PuzzleOutcome;
  test: boolean;
  cleanup?: NodeJS.Timeout;
}

const CLEANUP_DELAY_MS = 10 * 60_000;

@Injectable()
export class PuzzleSessionService {
  private readonly sessions = new Map<number, Session>();
  private server: PuzzleServer;

  constructor(private readonly engine: GameEngine, private readonly puzzles: PuzzlesService) {}

  bind(server: PuzzleServer) { this.server = server; }

  async start(user: SocketUser, socketId: string, payload: PuzzleStartPayload): Promise<void> {
    const test = payload.puzzleId !== undefined;
    if (test && !user.isAdmin) throw new Error('Réservé aux administrateurs.');
    const puzzleId = payload.puzzleId ?? (await this.puzzles.today()).puzzle?.id;
    if (puzzleId === undefined) throw new Error('Aucun défi aujourd’hui.');
    const { puzzle, objective, game } = await this.puzzles.load(puzzleId, user);
    const problem = validateStart(game) ?? validateObjective(objective, game);
    if (problem) throw new Error(problem);
    this.drop(user.userId);
    const session: Session = {
      socketId, puzzleId, objective, objectiveView: this.puzzles.objectiveView(puzzle),
      seed: puzzle.seed, initial: game, game: structuredClone(game),
      track: startTrack(game), outcome: 'ongoing', test,
    };
    this.sessions.set(user.userId, session);
    this.publish(user.userId, session);
  }

  async act(userId: number, action: GameAction): Promise<void> {
    const s = this.require(userId);
    if (s.outcome !== 'ongoing') throw new Error('Le défi est terminé : recommence pour rejouer.');
    const before = structuredClone(s.game);
    const trackBefore = { ...s.track, destroyed: [...s.track.destroyed] };
    const { error } = playPuzzleAction(this.engine, s.game, action, s.seed, s.track);
    if (error) {
      s.game = before;
      s.track = trackBefore;
      throw new Error(error);
    }
    s.outcome = puzzleOutcome(s.objective, s.game, s.track);
    let reward: PuzzleReward | undefined;
    if (s.outcome === 'solved' && !s.test) {
      try {
        reward = await this.puzzles.completeToday(userId, s.puzzleId);
      } catch (e) {
        // Le défi du jour a changé pendant la partie : résolu, mais rien à verser.
        this.publish(userId, s);
        throw e;
      }
    }
    this.publish(userId, s, reward);
  }

  restart(userId: number): void {
    const s = this.require(userId);
    s.game = structuredClone(s.initial);
    s.track = startTrack(s.initial);
    s.outcome = 'ongoing';
    this.publish(userId, s);
  }

  close(userId: number): void {
    const s = this.sessions.get(userId);
    this.drop(userId);
    if (s) this.server.to(s.socketId).emit('puzzle:closed');
  }

  /** Coupure réseau : la partie attend dix minutes, puis disparaît (rien à perdre). */
  disconnect(userId: number): void {
    const s = this.sessions.get(userId);
    if (s) s.cleanup = setTimeout(() => this.sessions.delete(userId), CLEANUP_DELAY_MS);
  }

  private drop(userId: number) {
    const s = this.sessions.get(userId);
    if (s?.cleanup) clearTimeout(s.cleanup);
    this.sessions.delete(userId);
  }

  private require(userId: number): Session {
    const s = this.sessions.get(userId);
    if (!s) throw new Error('Aucun défi en cours.');
    return s;
  }

  private publish(userId: number, s: Session, reward?: PuzzleReward) {
    this.server.to(s.socketId).emit('puzzle:state', {
      puzzleId: s.puzzleId,
      view: buildClientState(s.game, userId),
      objective: s.objectiveView,
      outcome: s.outcome,
      reward,
      test: s.test,
    });
    s.game.pendingEvents = [];
  }
}
```

`buildClientState` vide peut-être déjà `pendingEvents` (ligne 103 du builder) : dans ce cas la dernière ligne est sans effet, la garder. Une reconnexion renvoie `puzzle:start` (le front le fait à chaque `connect`) : la partie repart du début, ce qui est sans conséquence puisque les essais sont illimités.

- [ ] **Step 3 : gateway.** Calquer `sandbox.gateway.ts` (mêmes `cors`, même `handleConnection` avec `readSocketUser`, sans exiger `isAdmin`), `namespace: 'puzzle'`. `afterInit(server)` → `sessions.bind(server)`. Handlers `puzzle:start`, `puzzle:action`, `puzzle:restart`, `puzzle:close` : chacun dans un `try/catch` qui émet `puzzle:error` `{ message }` avec `e instanceof Error ? e.message : 'Erreur inattendue.'` (les `HttpException` de `PuzzlesService` sont des `Error`). `handleDisconnect` → `sessions.disconnect(userId)`. `puzzle-socket.types.ts` : copie de `sandbox-socket.types.ts` avec `PuzzleClientEvents` / `PuzzleServerEvents`. Spec du gateway : connexion sans jeton → `disconnect()` ; erreur de service → `puzzle:error`.

Ajouter `PuzzleSessionService` et `PuzzleGateway` aux `providers` du module.

- [ ] **Step 4 :** tests PASS. **Commit** `feat(puzzle): partie de défi en temps réel`.

---

### Task 9 : Admin — CRUD, vérification, calendrier, bouton sandbox

**Files:** Create `puzzles/puzzles-admin.controller.ts`, `puzzles/dto/puzzle-save.dto.ts`, `dto/puzzle-schedule.dto.ts`, `puzzles/puzzles-admin.service.ts` (+ spec) ; Modify `puzzles.module.ts`, `sandbox/sandbox.service.ts`, `sandbox/sandbox.gateway.ts`, `packages/shared/src/socket/sandbox.ts`

**Routes** (toutes `@UseGuards(JwtAuthGuard, AdminGuard)`, préfixe `admin/puzzles`) :

| Méthode | Route | Corps | Effet |
|---|---|---|---|
| GET | `/` | | `AdminPuzzle[]` |
| PATCH | `/:id` | `PuzzleSaveBody` | modifie ; **remet `verifiedAt` à null et `status` à draft** |
| POST | `/:id/verify` | | lance le solveur ; `solved` → `verifiedAt = now` ; renvoie `PuzzleVerifyResult` |
| POST | `/:id/publish` | `PuzzlePublishBody` | exige `verifiedAt` ou `manualOverride` (qui pose `verifiedAt = now`) |
| POST | `/:id/unpublish` | | `status = draft` ; retire les programmations futures (`date > aujourd'hui`) |
| DELETE | `/:id` | | supprime (cascade sur le calendrier) |
| GET | `/schedule?days=14` | | `PuzzleScheduleEntry[]` à partir d'aujourd'hui |
| PUT | `/schedule` | `PuzzleScheduleBody` | programme (`origin manual`) ou libère une date |

La création passe par le sandbox (socket), pas par HTTP.

- [ ] **Step 1 : tests rouges** de `PuzzlesAdminService` : modification efface la vérification ; `verify` sur solution trouvée pose `verifiedAt` et renvoie les coups lisibles (`describeAction`) ; `verify` sur `not_found` ne pose rien ; `publish` sans vérification ni override → `BadRequestException('Vérifie le défi avant de le publier.')` ; `publish` avec override passe ; programmer un défi non publié → refus ; programmer une date passée → refus ; programmer aujourd'hui alors que quelqu'un l'a déjà résolu → refus (`'Le défi du jour a déjà été résolu : impossible de le remplacer.'`) ; libérer une date supprime la ligne ; `createFromSandbox` refuse un état hors phase principale du joueur 1 et un objectif invalide.

- [ ] **Step 2 : service.** Méthodes : `list()`, `update(id, body)`, `verify(id, admin)`, `publish(id, body)`, `unpublish(id)`, `remove(id)`, `getSchedule(days)`, `setSchedule(body)`, `createFromSandbox(admin, state: SerializedGame, body: PuzzleSaveBody): Promise<number>`.

```ts
async verify(id: number, admin: { userId: number; username: string }): Promise<PuzzleVerifyResult> {
  const { puzzle, objective, game } = await this.puzzles.load(id, admin);
  const problem = validateStart(game) ?? validateObjective(objective, game);
  if (problem) throw new BadRequestException(problem);
  const result = await solvePuzzle(this.engine, game, objective, puzzle.seed);
  if (result.status === 'solved')
    await this.repo.update(id, { verifiedAt: new Date() });
  // Les coups sont décrits sur l'état où ils sont joués.
  const replay = structuredClone(game);
  const track = startTrack(replay);
  const solution = result.solution.map((a) => {
    const text = describeAction(a, replay);
    playPuzzleAction(this.engine, replay, a, puzzle.seed, track);
    return text;
  });
  return { status: result.status, solution, nodes: result.nodes, ms: result.ms };
}

async createFromSandbox(admin, state, body) {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const saved = await this.repo.save(this.repo.create({
    title: body.title.trim(), description: body.description?.trim() || null, state,
    objectiveType: body.objective.type,
    objectiveParams: { targetInstanceId: body.objective.targetInstanceId, primes: body.objective.primes },
    seed, rewardGold: body.rewardGold ?? 100, rewardXp: body.rewardXp ?? 50,
    status: PuzzleStatus.DRAFT, verifiedAt: null, createdBy: { id: admin.userId },
  }));
  // Validé sur l'état relu : même chemin que la partie réelle.
  const { objective, game } = await this.puzzles.load(saved.id, admin);
  const problem = validateStart(game) ?? validateObjective(objective, game);
  if (problem) { await this.repo.delete(saved.id); throw new BadRequestException(problem); }
  return saved.id;
}
```

Un seul `verify` à la fois : garder un `Set<number>` des ids en cours et refuser avec `ConflictException('Vérification déjà en cours.')`.

DTO (`class-validator`, comme `quests/dto`) : `title` 1 à 80 caractères, `description` ≤ 255 optionnelle, `objective.type` dans `PuzzleObjectiveType`, `rewardGold` 0 à 10 000, `rewardXp` 0 à 5 000, `date` au format `^\d{4}-\d{2}-\d{2}$`, `puzzleId` entier ou null, `days` 1 à 60.

- [ ] **Step 3 : bouton sandbox, côté serveur.** Dans `packages/shared/src/socket/sandbox.ts` : ajouter à `SandboxClientEvents` `"sandbox:save_puzzle": (payload: PuzzleSaveBody) => void;` et à `SandboxServerEvents` `"sandbox:puzzle_saved": (payload: { puzzleId: number }) => void;`. Dans `sandbox.service.ts`, exposer `snapshot(adminId: number): SerializedGame` (le `serializeGame(sb.game)` déjà fait par `save`, extrait). Dans `sandbox.gateway.ts`, nouveau `@SubscribeMessage('sandbox:save_puzzle')` qui appelle `puzzlesAdmin.createFromSandbox(user, sandbox.snapshot(userId), payload)` et émet `sandbox:puzzle_saved`, erreurs via le `reply()` existant. `SandboxModule` importe `PuzzlesModule` (qui exporte `PuzzlesAdminService`) ; `PuzzlesModule` n'importe pas `SandboxModule` (il n'utilise que le fichier pur `scenario-serializer.ts`), donc pas de cycle. `pnpm build:shared`.

« Ouvrir dans le sandbox » : route `POST admin/puzzles/:id/scenario` qui copie l'état du défi dans un `sandbox_scenario` nommé `Défi #id — titre` et renvoie `{ scenarioId }` ; le front ouvre `/admin/sandbox?scenario=<id>` (lire `App.tsx` / `SandboxPage.tsx` pour le nom exact du paramètre). Utiliser le `Repository<SandboxScenario>` directement dans `PuzzlesAdminService` (ajouter l'entité au `forFeature` du module).

- [ ] **Step 4 :** tests PASS, `pnpm --filter @pipou/backend lint` PASS. **Commit** `feat(puzzle): administration des défis et enregistrement depuis le sandbox`.

---

### Task 10 : Front — carte d'arène et fiche du défi

**Files:** Create `services/puzzle.service.ts`, `features/puzzle/{PuzzleCard,PuzzlePage,puzzleView}.tsx|ts`, `puzzleView.test.ts`, `Puzzle.css` ; Modify `utils/querykeys.ts`, `pages/FightHub.tsx`, `App.tsx`, `components/Icons.tsx`, `features/achievements/achievementIcons.ts`, `i18n/locales/{fr,en,ko}.json`

- [ ] **Step 1 : service et clés.**

```ts
// services/puzzle.service.ts
export const puzzleService = {
  async today(): Promise<DailyPuzzleInfo> { return (await api.get("/puzzles/today")).data; },
  async adminList(): Promise<AdminPuzzle[]> { return (await api.get("/admin/puzzles")).data; },
  async update(id: number, body: PuzzleSaveBody): Promise<void> { await api.patch(`/admin/puzzles/${id}`, body); },
  async verify(id: number): Promise<PuzzleVerifyResult> { return (await api.post(`/admin/puzzles/${id}/verify`)).data; },
  async publish(id: number, body: PuzzlePublishBody): Promise<void> { await api.post(`/admin/puzzles/${id}/publish`, body); },
  async unpublish(id: number): Promise<void> { await api.post(`/admin/puzzles/${id}/unpublish`); },
  async remove(id: number): Promise<void> { await api.delete(`/admin/puzzles/${id}`); },
  async schedule(days = 14): Promise<PuzzleScheduleEntry[]> { return (await api.get("/admin/puzzles/schedule", { params: { days } })).data; },
  async setSchedule(body: PuzzleScheduleBody): Promise<void> { await api.put("/admin/puzzles/schedule", body); },
  async toScenario(id: number): Promise<{ scenarioId: number }> { return (await api.post(`/admin/puzzles/${id}/scenario`)).data; },
};
```

`querykeys.ts` : `puzzleToday: ["puzzle", "today"] as const,` et, dans `admin`, `puzzles: ["admin", "puzzles"] as const, puzzleSchedule: ["admin", "puzzles", "schedule"] as const,`.

- [ ] **Step 2 : `puzzleView.ts` + test rouge puis vert.**

```ts
/** Clé i18n et variables du texte d'objectif. */
export function objectiveText(o: PuzzleObjectiveView): { key: string; vars: Record<string, string | number> }
// WIN_GAME → puzzle.objective.WIN_GAME ; DESTROY_MONSTER → { name: o.targetName ?? "?" } ;
// CLEAR_ENEMY_BOARD ; TAKE_PRIMES → { count: o.primes ?? 1 }
/** Points de série affichés : 7 par cycle, le dernier est le cadeau. */
export function streakDots(streak: PuzzleStreak): { filled: boolean; gift: boolean }[]
// filled = index < (7 - nextBoosterIn) ; série à 7, 14… : nextBoosterIn = 7 → 0 point rempli (nouveau cycle)
export function countdown(nextResetAt: string, now: number): string  // "07:42:10"
```

Tests : les 4 objectifs ; `streakDots({current:4, longest:4, nextBoosterIn:3})` → 4 remplis, le 7e `gift` ; `countdown` borné à `00:00:00`.

- [ ] **Step 3 : icône.** Ajouter `IconBulb` à `Icons.tsx` au format des icônes à `IconProps` (voir `IconFlask`), tracé de la maquette : `M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z`, `fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"`. Dans `achievementIcons.ts`, `PUZZLES_SOLVED: IconBulb` (remplace le provisoire), `PUZZLE_STREAK: IconFire`.

- [ ] **Step 4 : `PuzzleCard`** (4e carte de `FightHub`, après Aventure). Même structure que les trois autres (`fh-card fh-card--puzzle`, `fh-card__glow/icon/body/title/desc/cta`), `IconBulb size={44}`, navigation vers `/puzzle`. `useQuery({ queryKey: QUERY_KEYS.puzzleToday, queryFn: puzzleService.today })`. Sous-titre : `puzzle.hub.streak` (`Série : {{count}} jours`). Badge : `puzzle.hub.todo` (« À faire »), `puzzle.hub.done` (« Résolu », avec `IconCheck`), `puzzle.hub.none` (« Pas de défi aujourd'hui », carte désactivée) ; rien pendant le chargement. Dans `FightHub.css`, `fh-card--puzzle` reprend la variante aventure avec le dégradé bordeaux `#7a1c3b → #4a1526` et l'accent or `#eebc77`.

- [ ] **Step 5 : `PuzzlePage`** (`/puzzle`), fidèle à l'écran 2 de la maquette (`.superpowers/brainstorm/1140-1794491651/content/daily-puzzle.html`) : en-tête avec retour vers `/arena` (`IconArrowLeft`), boîte titre + objectif (`objectiveText`), boîte récompense (deux tuiles or / XP, `IconGold`), boîte série (`streakDots`, `IconGift` sur le 7e, libellé `puzzle.streak.label` « Série : {{count}} jours, booster dans {{left}} »), bouton « Jouer » (ou « Rejouer » si `solved`, avec la mention `puzzle.already_solved` « Déjà résolu : rejouer ne rapporte rien »), ligne `puzzle.unlimited` « Essais illimités. Prochain défi dans {{time}} ». Le compte à rebours est un état dérivé d'un `now` rafraîchi chaque seconde par un `setInterval` ; à zéro, `invalidateQueries(QUERY_KEYS.puzzleToday)`. États : chargement (`Loading`), erreur (`apiErrorMessage`), aucun défi (`puzzle.none_today`). « Jouer » navigue vers `/puzzle/play`.

Routes dans `App.tsx`, à côté de l'aventure : `<Route path="/puzzle" element={<PuzzlePage />} />` et `<Route path="/puzzle/play" element={<PuzzlePlayRoute />} />` (Task 11).

- [ ] **Step 6 : i18n**, dans les trois fichiers. Bloc `puzzle` (hub, objective.*, reward, streak, play, result, errors) ; `achievements.families/goals/titles` pour `PUZZLES_SOLVED` (« Casse-tête » / « Résous {{n}} défis du jour » / « Stratège ») et `PUZZLE_STREAK` (« Assidu des défis » / « Résous le défi {{n}} jours de suite » / « Esprit affûté ») ; `admin.tabs.puzzles` « Défis ». Textes français de référence :

```json
"objective": {
  "WIN_GAME": "Gagne la partie ce tour",
  "DESTROY_MONSTER": "Détruis {{name}} ce tour",
  "CLEAR_ENEMY_BOARD": "Détruis tous les monstres adverses ce tour",
  "TAKE_PRIMES_one": "Prends {{count}} prime ce tour",
  "TAKE_PRIMES_other": "Prends {{count}} primes ce tour"
}
```

Traduire en anglais et en coréen (le coréen n'a pas de pluriel : une seule clé `TAKE_PRIMES_other`). Vérifier qu'un test de parité des clés entre langues existe (`rg "locales" apps/frontend/src --glob "*.test.*"`) et le lancer.

- [ ] **Step 7 :** `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint` PASS. **Commit** `feat(puzzle): carte d'arène et fiche du défi du jour`.

---

### Task 11 : Front — partie de défi

**Files:** Create `features/puzzle/{usePuzzleSession.ts,PuzzlePlay.tsx,PuzzleObjectiveBanner.tsx,PuzzleResult.tsx}`, `usePuzzleSession.test.ts` ; Modify `features/fight/FightArena.tsx` (uniquement si nécessaire, voir Step 3), `Puzzle.css`

- [ ] **Step 1 : `usePuzzleSession`**, sur le modèle de la socket de `SandboxPage.tsx` (lignes 87 à 125) :

```ts
interface Options { puzzleId?: number; onState?: () => void }
export function usePuzzleSession({ puzzleId, onState }: Options): {
  state: PuzzleState | null;
  error: string | null;       // dernier puzzle:error, effacé au prochain état
  send: (action: GameAction) => void;
  restart: () => void;
  close: () => void;
}
```

`io(\`${import.meta.env.VITE_API_URL}${PUZZLE_NAMESPACE}\`, { withCredentials: true, auth: (cb) => cb({ token: getAuthToken() }), transports: ["websocket"] })`. À chaque `connect` : `emit("puzzle:start", puzzleId === undefined ? {} : { puzzleId })` (couvre la reconnexion). `onState` lu via une ref pour ne pas recréer la socket. Nettoyage : `emit("puzzle:close")` puis `disconnect()`. Test (socket simulée comme dans `useFightConnection.test.ts`) : `puzzle:start` émis à la connexion ; `puzzle:state` met à jour `state` et efface `error` ; `puzzle:error` remplit `error` ; `send` émet `puzzle:action`.

- [ ] **Step 2 : `PuzzlePlay`** (route `/puzzle/play`, et `/puzzle/play?test=<id>` pour l'admin).

```tsx
function PuzzlePlay({ puzzleId }: { puzzleId?: number }) {
  const clearSelectionRef = useRef<() => void>(() => {});
  const onState = useCallback(() => clearSelectionRef.current(), []);
  const { state, error, send, restart } = usePuzzleSession({ puzzleId, onState });
  const controls = useBoardControls(state?.view ?? null, send);
  // même liaison par ref que AdventureFight (clearSelection ↔ onState)
  …
}
```

Rendu : `fp-root` ; `PuzzleObjectiveBanner` en haut (`IconTarget` + `objectiveText`) ; `FightArena gameState={state.view} timeLeft={0} controls={controls} onSurrender={quit}` dans `fp-fight-area` ; barre basse à trois boutons, comme l'écran 3 de la maquette : « Quitter » (retour `/puzzle`), « Recommencer » (`restart`), « Fin du tour » (action `end_phase`, bouton primaire). Avant d'émettre un `end_phase` qui clôt le tour (phase `battle`, ou phase `main` si le moteur passe directement la main : lire `phaseOptions.ts`), demander confirmation via `ConfirmActionSheet` : « Finir le tour sans avoir atteint l'objectif ? Le défi sera raté. ». Erreur serveur : toast `fp-toast fp-toast--err`.

Quand `state.outcome !== "ongoing"` : afficher `PuzzleResult` par-dessus le plateau, 900 ms après l'état (le temps des animations de `FightFxLayer`), via un `setTimeout` nettoyé.

À la résolution avec `reward.firstSolve` : invalider `QUERY_KEYS.puzzleToday`, `profile`, `inventory`, `quests`, `achievements`.

- [ ] **Step 3 : habillage du plateau.** Lire `FightArena.tsx` et `FightBoard.tsx` en entier. Trois besoins : (a) masquer le compte à rebours du tour et le bouton d'abandon ; (b) entourer le monstre cible en rouge ; (c) ne pas afficher « l'adversaire choisit ». Préférer le CSS : classe `pz-play` sur le conteneur, sélecteurs ciblant le timer et l'abandon, et pour la cible un attribut déjà présent sur la carte posée (chercher `data-instance-id` ou équivalent dans `Zonerow`). Si aucun attribut n'existe, ajouter à `FightArena` puis `FightBoard` une prop optionnelle `highlightInstanceId?: string` qui pose la classe `fb-monster--target` (bordure `2.5px solid #ff5a5a`, `box-shadow: 0 0 10px #ff5a5a`). Ne rien changer d'autre au combat ; relancer `FightPage.test.tsx` et `AdventureFight.test.tsx`.

- [ ] **Step 4 : `PuzzleResult`.** Props `{ outcome: "solved" | "failed"; reward?: PuzzleReward; test: boolean; onRestart; onBack }`.
  - Résolu, première fois : titre « Défi résolu ! », tuiles or / XP, ligne booster si `reward.booster` (`IconBooster`, « Série de {{count}} jours : booster offert »), série mise à jour (`streakDots`), boutons « Retour » et « Rejouer ».
  - Résolu, déjà fait (`firstSolve` false) ou test : « Résolu ! » + « Aucune récompense (déjà résolu aujourd'hui) » / « Partie de test ».
  - Raté : « Raté… », « L'objectif n'est pas atteint. », bouton primaire « Recommencer », secondaire « Retour ».
  Test de rendu pour les trois cas.

- [ ] **Step 5 :** tests, typecheck, lint PASS. **Commit** `feat(puzzle): partie de défi avec bandeau d'objectif et résultat`.

---

### Task 12 : Front — admin

**Files:** Create `features/puzzle/admin/{PuzzleManager,PuzzleCalendar,SavePuzzleDialog}.tsx` ; Modify `pages/Admin.tsx`, `features/sandbox/{SandboxToolbar,SandboxPage}.tsx`

- [ ] **Step 1 : onglet.** `Admin.tsx` : ajouter `"puzzles"` à `AdminTab`, une entrée `{ key: "puzzles", icon: <IconBulb size={16} /> }` dans `TABS` après `sandbox`, et `{tab === "puzzles" && <PuzzleManager />}`.

- [ ] **Step 2 : `PuzzleManager`.** Liste (`useQuery(QUERY_KEYS.admin.puzzles)`), une ligne par défaut : titre, objectif (`objectiveText`), statut (Brouillon / Publié), vérification (« Vérifié le … » ou « Non vérifié »), dernière programmation. Actions, chacune une `useMutation` qui invalide `admin.puzzles`, `admin.puzzleSchedule` et `puzzleToday` :
  - **Vérifier** : `puzzleService.verify(id)`, bouton en attente pendant l'appel (jusqu'à 20 s). Résultat affiché sous la ligne : `solved` → « Solution trouvée en {{ms}} ms ({{nodes}} positions) » + liste numérotée des coups ; `not_found` → « Aucune solution trouvée. Le solveur n'explore pas tous les coups : ce n'est pas une preuve. » ; `timeout` → « Recherche interrompue (plafond atteint). ».
  - **Publier** : si non vérifié, une case « Je l'ai résolu moi-même » à cocher pour activer le bouton (`manualOverride: true`).
  - **Dépublier**, **Supprimer** (avec `window.confirm`).
  - **Tester** : lien vers `/puzzle/play?test=<id>`.
  - **Ouvrir dans le sandbox** : `toScenario(id)` puis navigation.
  - **Modifier** : formulaire en ligne (titre, description, objectif, récompenses). Sélecteur de cible alimenté par `enemyMonsters` ; champ primes visible seulement pour `TAKE_PRIMES`. Avertissement : « Modifier un défi efface sa vérification et le repasse en brouillon. ».
  Erreurs : `apiErrorMessage(error)`.

- [ ] **Step 3 : `PuzzleCalendar`.** 14 lignes (`useQuery(QUERY_KEYS.admin.puzzleSchedule)`) : date, défi programmé, origine (« Manuel » / « Auto » / « Libre : repli automatique »). Par ligne, un `<select>` des défis publiés + « Libre » ; au changement, `setSchedule({ date, puzzleId })`. Sous le calendrier, un compteur : « {{n}} défis publiés » avec alerte (`IconAlert`) en dessous de 7.

- [ ] **Step 4 : bouton sandbox.** `SandboxToolbar` : nouvelle prop `onSavePuzzle: () => void` et bouton « Enregistrer comme défi » à côté de la sauvegarde. `SandboxPage` : ouvre `SavePuzzleDialog` (titre, description, objectif ; la cible se choisit parmi `state.views.p1.opponent` — monstres posés ; primes bornées à `state.views.p1.me.primes`), désactivé avec explication si `state.views.p1.phase !== "main"` ou si ce n'est pas le tour de J1. Validation : `socket.emit("sandbox:save_puzzle", body)` ; `sandbox:puzzle_saved` → toast « Défi enregistré en brouillon » (sans emoji) + invalidation de `admin.puzzles`.

- [ ] **Step 5 :** tests, typecheck, lint PASS. **Commit** `feat(puzzle): écran d'administration des défis`.

---

### Task 13 : Vérification de bout en bout et contenu

- [ ] **Step 1 : tout le dépôt.** `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Tout PASS, sortie collée dans le compte rendu.

- [ ] **Step 2 : parcours réel, en local uniquement** (mémoires « Local test env » et « Front visual check » : base docker `cardcollect_dev`, `ENV_FILE=.env.dev.local`, compte admin local, coque 430 px claire, relais IPv6 pour l'API). Dérouler :
  1. Sandbox → monter un plateau → « Enregistrer comme défi » → onglet Défis → Vérifier → Publier.
  2. Arène : la 4e carte affiche « À faire ». Fiche → Jouer.
  3. Finir le tour sans objectif : « Raté », Recommencer remet le plateau d'origine.
  4. Résoudre : or +100, XP +50, série 1, carte « Résolu », quête de défi terminée si elle est tirée.
  5. Rejouer : résolu sans récompense.
  6. Relance de quête : forcer en base locale la seule quête candidate à `d_puzzle`, relancer, constater qu'elle naît terminée.
  7. Dépublier le seul défi : la carte passe à « Pas de défi aujourd'hui ».
  Captures Playwright des trois écrans de la maquette, jointes au compte rendu.

- [ ] **Step 3 : première série de défis.** Sept propositions, à construire par Sasha dans le sandbox avec les vraies cartes (les noms ci-dessous décrivent le ressort, pas des cartes précises), puis à passer au solveur :

| # | Titre | Objectif | Ressort |
|---|---|---|---|
| 1 | Premier sang | `DESTROY_MONSTER` | Un monstre en main, une attaque suffit. Tutoriel du mode. |
| 2 | Le mur | `DESTROY_MONSTER` | La cible a trop de PV pour une attaque : il faut équiper avant d'attaquer. |
| 3 | La garde | `DESTROY_MONSTER` | Un monstre provocateur protège la cible : le détruire d'abord, dans le bon ordre d'attaquants. |
| 4 | Table rase | `CLEAR_ENEMY_BOARD` | Trois monstres adverses, deux attaquants : un effet de zone ou un sort doit en prendre un. |
| 5 | Juste assez | `TAKE_PRIMES` (2) | Deux destructions nécessaires avec une énergie comptée : recycler la bonne carte pour payer. |
| 6 | Évolution | `DESTROY_MONSTER` | Seule la forme évoluée a assez d'ATK ; l'évolution coûte la carte qu'on aurait voulu garder. |
| 7 | Coup de grâce | `WIN_GAME` | Dernière prime à prendre ; le chemin évident échoue sur une réduction de dégâts, il faut un perçant. |

  Difficulté croissante sur la semaine. Chaque défi : vérifié par le solveur (ou coché « résolu moi-même »), puis programmé sur 7 jours.

- [ ] **Step 4 : avant fusion.** La migration `1791000000029` s'applique en prod par le chemin habituel du dépôt (lire la mémoire « Prod deploy setup ») ; ne rien lancer à la main contre Aiven. Lancement joueur seulement quand au moins 7 défis sont publiés : tant qu'il n'y en a aucun, la carte affiche « Pas de défi aujourd'hui » et la quête de défi n'est pas tirée, la fusion est donc sans risque.

- [ ] **Step 5 :** utiliser superpowers:finishing-a-development-branch.

---

## Couverture de la spec

| Spec | Tâche |
|---|---|
| Objectifs (4 types), échec en fin de tour | 2 |
| Déterminisme, solveur plafonné, jamais « insoluble » à tort | 3 |
| Bascule à 4 h, repli « le moins récemment joué », série, booster tous les 7 jours | 4, 6 |
| Tables `daily_puzzle`, `daily_puzzle_schedule`, `user_puzzle_solve` | 5 |
| `GET /puzzles/today` sans plateau, récompense une fois par jour, `puzzle.solved` | 6 |
| Quête `SOLVE_DAILY_PUZZLE` : pré-terminée au tirage et à la relance, absente sans défi | 7 |
| Succès `PUZZLES_SOLVED` 5/30/100, `PUZZLE_STREAK` 3/7/30 | 1, 7, 10 |
| Événements socket start / action / restart / close / state | 1, 8 |
| Admin : enregistrer depuis le sandbox, vérifier, publier avec dérogation, tester, ouvrir dans le sandbox, dépublier, calendrier 14 jours, modification = vérification effacée | 9, 12 |
| Écrans joueur (carte, fiche, partie, résultat) | 10, 11 |
| Cas d'erreur (pas de défi, défi changé en cours de partie, double résolution, coupure réseau) | 6, 8 |
| Contenu : 7 défis avant lancement | 13 |
