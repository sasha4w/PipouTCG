# Refonte des récompenses journalières — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** rendre l'oubli d'un jour réellement punitif (reset complet, rachat d'un seul jour, cher) et refaire la modal avec uniquement des icônes, un calendrier compact basé sur l'historique réel et une carte « prochain palier ».

**Architecture :** les règles pures (écart de jours, coût, semaine, cycle) vivent dans `streak-rules.ts` côté back et sont testées seules. `DailyRewardService` les orchestre. Le contrat (types de `/status` et `/claim`, plus `stripEmoji`) vit dans `@pipou/shared`. Côté front, la modal orchestre trois composants de module : `MonthCalendar`, `MilestoneCard` et `rewardDisplay`.

**Tech Stack :** NestJS 11 + TypeORM 0.3 (Jest), React 18 + TanStack Query + framer-motion (Vitest + Testing Library), `@pipou/shared` (Vitest).

**Spec :** `docs/superpowers/specs/2026-10-16-daily-reward-rework-design.md`

## Global Constraints

- Coût du rachat : `100 + 10 × currentStreak` gold, uniquement si exactement 1 jour a été manqué (`diff === 2`), le jour du retour.
- `diff ≥ 3` → reset automatique pendant le claim, qui renvoie `streakLost`.
- La semaine et le cycle dérivent du jour de streak réclamé : `weekNumber = floor((jour − 1) / 7) + 1`, `cycleDay = ((jour − 1) % 7) + 1`.
- Palier versé quand `currentStreak === dayThreshold`, regagnable après un reset.
- `totalDays` et `longestStreak` ne sont jamais remis à zéro.
- Les jours sont calculés en UTC (`YYYY-MM-DD`).
- Aucun emoji dans l'UI : uniquement les composants de `apps/frontend/src/components/Icons.tsx`.
- Tout type échangé entre le front et le back vit dans `@pipou/shared` (règle du `CLAUDE.md` racine, même pattern que `api/sales-stats.ts`). Après une modification de `packages/shared` : `pnpm build:shared`.
- Front : données serveur via TanStack Query uniquement, clés dans `QUERY_KEYS`, pas de composant déclaré dans un composant, pas de `any`.
- Ne jamais toucher à Aiven : le `.env` local pointe sur la BDD de prod. Les clics de test se font avec `ENV_FILE=.env.dev.local` sur la base Docker `cardcollect_dev`.

**Écart assumé avec la spec :**
- Les types de réponse vont dans `@pipou/shared` (règle racine) plutôt que dans le service front.
- `streak.cycleDay` et `streak.weekNumber` de `/status` deviennent `nextDay: { cycleDay, weekNumber }`, ce qui lève l'ambiguïté « jour courant / prochain jour ».
- `/status` renvoie aussi `rescuedDates` (jours rachetés), sinon un jour racheté apparaîtrait comme manqué dans le calendrier.
- `claimedDates` couvre le mois courant **et** les 6 derniers jours, pour que la semaine du widget soit juste en début de mois.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/api/daily-reward.ts` (créé) | Types `DailyRewardStatus`, `ClaimDailyResult`… + `stripEmoji` |
| `packages/shared/src/api/daily-reward.test.ts` (créé) | Tests de `stripEmoji` |
| `packages/shared/src/api/index.ts` | export du nouveau module |
| `packages/shared/src/api/requests.ts` | suppression de `RescueStreakRequest` (tâche 5) |
| `apps/backend/src/daily-reward/streak-rules.ts` (créé) | Fonctions pures : dates UTC, écart, coût, semaine, cycle |
| `apps/backend/src/daily-reward/streak-rules.spec.ts` (créé) | Tests |
| `apps/backend/src/daily-reward/daily-reward.service.ts` | claim / rescue / reset / status réécrits |
| `apps/backend/src/daily-reward/daily-reward.service.spec.ts` | Tests du service |
| `apps/backend/src/daily-reward/daily-reward.controller.ts` | `/rescue` sans body |
| `apps/backend/src/daily-reward/dto/daily-reward.dto.ts` | suppression de `RescueStreakDto` |
| `apps/frontend/src/services/dailyReward.service.ts` | types venant de shared, `rescueStreak()` sans argument |
| `apps/frontend/src/components/daily-reward/rewardDisplay.tsx` (créé) | `RewardIcon`, `rewardText`, `todayUtc`, `MONTH_FR` |
| `apps/frontend/src/components/daily-reward/MonthCalendar.tsx` (créé) | Calendrier compact |
| `apps/frontend/src/components/daily-reward/MilestoneCard.tsx` (créé) | Carte prochain palier + pastilles |
| `apps/frontend/src/components/DailyRewardModal.tsx` / `.css` | Modal réécrite |
| `apps/frontend/src/components/DailyStreakWidget.tsx` | Icônes + `claimedDates` |
| `apps/frontend/src/hooks/Usedailyrewardmodal.ts` | Condition d'ouverture |
| `apps/frontend/src/__tests__/components/{MonthCalendar,MilestoneCard,DailyRewardModal}.test.tsx` (créés) | Tests |

---

### Task 1 : contrat partagé et `stripEmoji`

**Files :**
- Create : `packages/shared/src/api/daily-reward.ts`
- Create : `packages/shared/src/api/daily-reward.test.ts`
- Modify : `packages/shared/src/api/index.ts`

**Interfaces :**
- Produces : `stripEmoji(label: string | null | undefined): string | null`, et les types `DailyRewardItem`, `DailyRewardGain`, `DailyRewardMilestone`, `StreakView`, `DailyRewardStatus`, `ClaimDailyResult`, `ClaimedDailyResult`, `RescueStreakResult` (définitions ci-dessous).

- [ ] **Step 1 : écrire le test qui échoue**

`packages/shared/src/api/daily-reward.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { stripEmoji } from "./daily-reward";

describe("stripEmoji", () => {
  it("retire les emojis et les espaces superflus", () => {
    expect(stripEmoji("💎 Semaine 6 - Jour 2")).toBe("Semaine 6 - Jour 2");
    expect(stripEmoji("🌹 Spécial  Saint-Valentin ❤️")).toBe("Spécial Saint-Valentin");
  });

  it("garde le texte sans emoji intact", () => {
    expect(stripEmoji("Coffre rare")).toBe("Coffre rare");
  });

  it("renvoie null pour un label vide ou composé uniquement d'emojis", () => {
    expect(stripEmoji(null)).toBeNull();
    expect(stripEmoji(undefined)).toBeNull();
    expect(stripEmoji("")).toBeNull();
    expect(stripEmoji("🏆 ✨")).toBeNull();
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

Run : `pnpm --filter @pipou/shared test`
Expected : FAIL, `Failed to resolve import "./daily-reward"`.

- [ ] **Step 3 : implémenter**

`packages/shared/src/api/daily-reward.ts` :

```ts
import type { DailyRewardType } from "../enums/reward";

/** Récompense telle que définie en BDD (jour du cycle ou palier). */
export interface DailyRewardItem {
  type: DailyRewardType;
  /** Gold par unité, ou id de la carte / du booster / du bundle. */
  value: number;
  quantity: number;
  /** Label admin, sans emoji. */
  label: string | null;
}

/** Récompense distribuée lors d'un claim. */
export interface DailyRewardGain extends DailyRewardItem {
  isMilestone: boolean;
}

/** Palier de fidélité : versé quand le streak atteint exactement dayThreshold. */
export interface DailyRewardMilestone extends DailyRewardItem {
  dayThreshold: number;
}

export interface StreakView {
  current: number;
  longest: number;
  /** Cumul all-time, jamais remis à zéro (stats uniquement). */
  totalDays: number;
  /** YYYY-MM-DD (UTC). */
  lastClaimDate: string | null;
}

/** GET /daily-reward/status */
export interface DailyRewardStatus {
  streak: StreakView;
  /** Position du prochain jour à réclamer. */
  nextDay: { cycleDay: number; weekNumber: number };
  alreadyClaimed: boolean;
  /** Exactement 1 jour manqué : rachat possible aujourd'hui. */
  rescueAvailable: boolean;
  rescueCost: number | null;
  /** 2 jours manqués ou plus : le prochain claim remet la série à zéro. */
  streakAtRisk: boolean;
  nextReward: DailyRewardItem | null;
  /** Paliers actifs, triés par seuil croissant. */
  milestones: DailyRewardMilestone[];
  /** YYYY-MM-DD (UTC) réclamés depuis min(1er du mois, J-6). */
  claimedDates: string[];
  /** YYYY-MM-DD (UTC) rachetés sur la même période. */
  rescuedDates: string[];
}

export interface ClaimedDailyResult {
  status: "claimed";
  message: string;
  streak: StreakView;
  rewards: DailyRewardGain[];
  /** Longueur de la série perdue juste avant ce claim. */
  streakLost?: number;
}

/** POST /daily-reward/claim */
export type ClaimDailyResult =
  | ClaimedDailyResult
  | {
      status: "rescue_required";
      message: string;
      streak: StreakView;
      rescue: { cost: number };
    };

/** POST /daily-reward/rescue */
export interface RescueStreakResult {
  message: string;
  goldSpent: number;
  goldRemaining: number;
  streak: number;
}

const EMOJI = /\p{Extended_Pictographic}️?/gu;

/** Retire les emojis d'un label admin ; null si rien ne reste. */
export function stripEmoji(label: string | null | undefined): string | null {
  if (!label) return null;
  const cleaned = label.replace(EMOJI, "").replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}
```

`packages/shared/src/api/index.ts` : ajouter la ligne

```ts
export * from "./daily-reward";
```

- [ ] **Step 4 : lancer le test et vérifier qu'il passe**

Run : `pnpm --filter @pipou/shared test && pnpm build:shared`
Expected : PASS, build OK.

- [ ] **Step 5 : commit**

```bash
git add packages/shared/src/api/daily-reward.ts packages/shared/src/api/daily-reward.test.ts packages/shared/src/api/index.ts
git commit -m "feat(shared): daily reward contract and stripEmoji"
```

---

### Task 2 : règles pures du streak (back)

**Files :**
- Create : `apps/backend/src/daily-reward/streak-rules.ts`
- Test : `apps/backend/src/daily-reward/streak-rules.spec.ts`

**Interfaces :**
- Produces :
  - `todayUtc(now?: Date): string`
  - `shiftDay(day: string, delta: number): string`
  - `daysBetween(from: string, to: string): number` (signé)
  - `type ReturnGap = 'first' | 'claimed_today' | 'consecutive' | 'rescuable' | 'lost'`
  - `classifyGap(lastClaimDate: string | null, today: string): ReturnGap`
  - `rescueCost(streak: number): number`
  - `weekNumberFor(streakDay: number): number`
  - `cycleDayFor(streakDay: number): number`

- [ ] **Step 1 : écrire le test qui échoue**

`apps/backend/src/daily-reward/streak-rules.spec.ts` :

```ts
import {
  classifyGap,
  cycleDayFor,
  daysBetween,
  rescueCost,
  shiftDay,
  todayUtc,
  weekNumberFor,
} from './streak-rules';

describe('streak-rules', () => {
  it('todayUtc renvoie la date UTC même tard le soir en heure locale', () => {
    expect(todayUtc(new Date('2026-10-16T23:30:00Z'))).toBe('2026-10-16');
  });

  it('shiftDay passe les changements de mois', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDay('2026-10-16', -6)).toBe('2026-10-10');
  });

  it('daysBetween est signé', () => {
    expect(daysBetween('2026-10-14', '2026-10-16')).toBe(2);
    expect(daysBetween('2026-10-16', '2026-10-14')).toBe(-2);
  });

  it.each([
    [null, 'first'],
    ['2026-10-16', 'claimed_today'],
    ['2026-10-15', 'consecutive'],
    ['2026-10-14', 'rescuable'],
    ['2026-10-13', 'lost'],
    ['2026-09-01', 'lost'],
  ] as const)('classifyGap(%s) → %s', (last, expected) => {
    expect(classifyGap(last, '2026-10-16')).toBe(expected);
  });

  it('rescueCost = 100 + 10 × streak', () => {
    expect(rescueCost(0)).toBe(100);
    expect(rescueCost(7)).toBe(170);
    expect(rescueCost(30)).toBe(400);
    expect(rescueCost(100)).toBe(1100);
  });

  it('semaine et cycle dérivent du jour de streak', () => {
    expect([1, 7, 8, 14, 15].map(weekNumberFor)).toEqual([1, 1, 2, 2, 3]);
    expect([1, 7, 8, 14, 15].map(cycleDayFor)).toEqual([1, 7, 1, 7, 1]);
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

Run : `pnpm --filter @pipou/backend test -- streak-rules`
Expected : FAIL, `Cannot find module './streak-rules'`.

- [ ] **Step 3 : implémenter**

`apps/backend/src/daily-reward/streak-rules.ts` :

```ts
/** Règles pures du streak journalier. Les jours sont des chaînes YYYY-MM-DD en UTC. */

const DAY_MS = 86_400_000;

export const RESCUE_BASE_COST = 100;
export const RESCUE_COST_PER_STREAK_DAY = 10;

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function shiftDay(day: string, delta: number): string {
  return todayUtc(new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS));
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
}

export type ReturnGap =
  | 'first'
  | 'claimed_today'
  | 'consecutive'
  | 'rescuable'
  | 'lost';

/**
 * Situation du joueur aujourd'hui par rapport à son dernier claim :
 * 1 jour d'écart = consécutif, 2 = un jour manqué (rachetable), 3+ = série perdue.
 */
export function classifyGap(
  lastClaimDate: string | null,
  today: string,
): ReturnGap {
  if (!lastClaimDate) return 'first';
  const diff = daysBetween(lastClaimDate, today);
  if (diff <= 0) return 'claimed_today';
  if (diff === 1) return 'consecutive';
  if (diff === 2) return 'rescuable';
  return 'lost';
}

/** Plus la série est longue, plus la sauver coûte cher. */
export function rescueCost(streak: number): number {
  return RESCUE_BASE_COST + RESCUE_COST_PER_STREAK_DAY * streak;
}

/** Semaine de récompense du jour de streak (J1-J7 → 1, J8 → 2…). */
export function weekNumberFor(streakDay: number): number {
  return Math.floor((Math.max(streakDay, 1) - 1) / 7) + 1;
}

/** Position 1-7 du jour de streak dans le cycle hebdomadaire. */
export function cycleDayFor(streakDay: number): number {
  return ((Math.max(streakDay, 1) - 1) % 7) + 1;
}
```

- [ ] **Step 4 : lancer le test et vérifier qu'il passe**

Run : `pnpm --filter @pipou/backend test -- streak-rules`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/backend/src/daily-reward/streak-rules.ts apps/backend/src/daily-reward/streak-rules.spec.ts
git commit -m "feat(daily-reward): pure streak rules"
```

---

### Task 3 : claim, rachat et reset punitifs (back)

**Files :**
- Modify : `apps/backend/src/daily-reward/daily-reward.service.ts` (helpers lignes 24-60, `claimDaily`, `rescueStreak`, `resetStreak`)
- Modify : `apps/backend/src/daily-reward/daily-reward.controller.ts` (route `rescue`, import `RescueStreakDto`)
- Modify : `apps/backend/src/daily-reward/dto/daily-reward.dto.ts` (supprimer `RescueStreakDto` et l'import `RescueStreakRequest`)
- Test : `apps/backend/src/daily-reward/daily-reward.service.spec.ts`

**Interfaces :**
- Consumes : Task 2 (`todayUtc`, `shiftDay`, `classifyGap`, `rescueCost`, `weekNumberFor`, `cycleDayFor`) ; Task 1 (`ClaimDailyResult`, `DailyRewardGain`, `StreakView`, `RescueStreakResult`).
- Produces : `claimDaily(userId): Promise<ClaimDailyResult>`, `rescueStreak(userId): Promise<RescueStreakResult>`, `resetStreak(userId): Promise<{ message: string }>`, et le helper privé `streakView(streak: LoginStreak): StreakView` (réutilisé en Task 4).

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à la fin de `daily-reward.service.spec.ts`, et ajouter `import type { LoginStreak } from './login-streak.entity';` aux imports :

```ts
const TODAY = '2026-10-16';

function setup(row: Partial<LoginStreak> | null, gold = 10_000) {
  const streak = row
    ? {
        userId: 1,
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0,
        cycleDay: 1,
        lastClaimDate: null,
        ...row,
      }
    : null;
  const def = {
    cycleDay: 1,
    weekNumber: null,
    rewardType: 'gold',
    rewardValue: 50,
    quantity: 1,
    label: '💎 Bonus',
  };
  const repos = {
    streak: {
      findOne: jest.fn().mockResolvedValue(streak),
      create: jest.fn((x: object) => ({
        longestStreak: 0,
        lastClaimDate: null,
        ...x,
      })),
      save: jest.fn(async (x: object) => x),
    },
    def: {
      findOne: jest.fn().mockResolvedValue(def),
      create: jest.fn((x: object) => x),
      save: jest.fn(async (x: object) => x),
    },
    milestone: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x: object) => x),
      save: jest.fn(async (x: object) => x),
    },
    history: {
      create: jest.fn((x: object) => x),
      save: jest.fn(async (x: object) => x),
      find: jest.fn().mockResolvedValue([]),
    },
    rescue: {
      create: jest.fn((x: object) => x),
      save: jest.fn(async (x: object) => x),
      find: jest.fn().mockResolvedValue([]),
    },
  };
  const users = {
    addGold: jest.fn(),
    addCardToUser: jest.fn(),
    addBoosterToUser: jest.fn(),
    addBundleToUser: jest.fn(),
    findOne: jest.fn().mockResolvedValue({ gold }),
  };
  const service = new DailyRewardService(
    repos.streak as never,
    repos.def as never,
    repos.milestone as never,
    repos.history as never,
    repos.rescue as never,
    users as never,
  );
  return { service, repos, users, streak };
}

describe('DailyRewardService — claim', () => {
  beforeEach(() =>
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
      .setSystemTime(new Date(`${TODAY}T10:00:00Z`)),
  );
  afterEach(() => jest.useRealTimers());

  it('premier claim : streak 1, semaine 1 jour 1', async () => {
    const { service, repos } = setup(null);
    const res = await service.claimDaily(1);
    expect(res.status).toBe('claimed');
    expect(res.streak.current).toBe(1);
    expect(repos.def.findOne).toHaveBeenCalledWith({
      where: { cycleDay: 1, weekNumber: 1, isActive: true },
    });
  });

  it('jour consécutif : streak +1, semaine dérivée du streak', async () => {
    const { service, repos } = setup({
      currentStreak: 7,
      totalDays: 40,
      lastClaimDate: '2026-10-15',
    });
    const res = await service.claimDaily(1);
    expect(res.streak.current).toBe(8);
    expect(res.streak.totalDays).toBe(41);
    expect(repos.def.findOne).toHaveBeenCalledWith({
      where: { cycleDay: 1, weekNumber: 2, isActive: true },
    });
  });

  it('déjà réclamé aujourd\'hui : 409', async () => {
    const { service } = setup({ currentStreak: 3, lastClaimDate: TODAY });
    await expect(service.claimDaily(1)).rejects.toThrow('déjà réclamée');
  });

  it('un jour manqué : rescue_required avec le coût, rien distribué', async () => {
    const { service, users } = setup({
      currentStreak: 30,
      lastClaimDate: '2026-10-14',
    });
    const res = await service.claimDaily(1);
    expect(res).toMatchObject({
      status: 'rescue_required',
      rescue: { cost: 400 },
    });
    expect(users.addGold).not.toHaveBeenCalled();
  });

  it('deux jours manqués ou plus : reset auto, J1 réclamé, streakLost renvoyé', async () => {
    const { service, repos } = setup({
      currentStreak: 42,
      longestStreak: 50,
      totalDays: 90,
      lastClaimDate: '2026-10-13',
    });
    const res = await service.claimDaily(1);
    expect(res).toMatchObject({
      status: 'claimed',
      streakLost: 42,
      streak: { current: 1, longest: 50, totalDays: 91 },
    });
    expect(repos.def.findOne).toHaveBeenCalledWith({
      where: { cycleDay: 1, weekNumber: 1, isActive: true },
    });
  });

  it('palier versé quand le streak atteint le seuil, même déjà atteint avant', async () => {
    const { service, repos, users } = setup({
      currentStreak: 6,
      totalDays: 200,
      lastClaimDate: '2026-10-15',
    });
    repos.milestone.findOne.mockResolvedValue({
      dayThreshold: 7,
      rewardType: 'gold',
      rewardValue: 500,
      quantity: 1,
      label: '🏆 Coffre',
    });
    const res = await service.claimDaily(1);
    expect(repos.milestone.findOne).toHaveBeenCalledWith({
      where: { dayThreshold: 7, isActive: true },
    });
    expect(users.addGold).toHaveBeenCalledWith(1, 500);
    expect(res.status === 'claimed' && res.rewards[1]).toMatchObject({
      isMilestone: true,
      label: 'Coffre',
    });
  });
});

describe('DailyRewardService — rescue & reset', () => {
  beforeEach(() =>
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
      .setSystemTime(new Date(`${TODAY}T10:00:00Z`)),
  );
  afterEach(() => jest.useRealTimers());

  it('rachat : débite 100 + 10 × streak et place lastClaimDate à hier (UTC)', async () => {
    const { service, repos, users, streak } = setup({
      currentStreak: 10,
      lastClaimDate: '2026-10-14',
    });
    const res = await service.rescueStreak(1);
    expect(res.goldSpent).toBe(200);
    expect(users.addGold).toHaveBeenCalledWith(1, -200);
    expect(streak?.lastClaimDate).toBe('2026-10-15');
    expect(repos.rescue.save).toHaveBeenCalledWith(
      expect.objectContaining({ daysMissed: 1, goldSpent: 200 }),
    );
  });

  it.each(['2026-10-15', '2026-10-13'])(
    'rachat refusé si lastClaimDate = %s',
    async (last) => {
      const { service } = setup({ currentStreak: 10, lastClaimDate: last });
      await expect(service.rescueStreak(1)).rejects.toThrow();
    },
  );

  it('rachat refusé si gold insuffisant', async () => {
    const { service, users } = setup(
      { currentStreak: 10, lastClaimDate: '2026-10-14' },
      199,
    );
    await expect(service.rescueStreak(1)).rejects.toThrow('Pas assez de gold');
    expect(users.addGold).not.toHaveBeenCalled();
  });

  it('reset : streak 0, record et total conservés, prochain claim = J1', async () => {
    const { service, streak } = setup({
      currentStreak: 12,
      longestStreak: 20,
      totalDays: 80,
      lastClaimDate: '2026-10-14',
    });
    await service.resetStreak(1);
    expect(streak).toMatchObject({
      currentStreak: 0,
      longestStreak: 20,
      totalDays: 80,
      lastClaimDate: null,
    });
    const res = await service.claimDaily(1);
    expect(res.streak.current).toBe(1);
  });
});
```

- [ ] **Step 2 : lancer les tests et vérifier qu'ils échouent**

Run : `pnpm --filter @pipou/backend test -- daily-reward.service`
Expected : FAIL. `rescueStreak` attend encore un DTO, et le claim sur un écart de 3 jours renvoie `rescue_required` au lieu d'un reset.

- [ ] **Step 3 : implémenter**

Dans `daily-reward.service.ts` :

1. Supprimer `todayStr`, `daysBetween`, `calculateRescueCost`, `maxRescuableDays` (lignes 24-60), ainsi que `RescueStreakDto` dans l'import des DTO.
2. Ajouter les imports :

```ts
import {
  DailyRewardType as RewardType,
  stripEmoji,
  type ClaimDailyResult,
  type DailyRewardGain,
  type RescueStreakResult,
  type StreakView,
} from '@pipou/shared';
import {
  classifyGap,
  cycleDayFor,
  rescueCost,
  shiftDay,
  todayUtc,
  weekNumberFor,
} from './streak-rules';
```

(retirer l'ancien `import { DailyRewardType as RewardType } from '@pipou/shared';`)

3. Supprimer `nextCycleDay` et ajouter dans la section « Streak helpers » :

```ts
  private streakView(streak: LoginStreak): StreakView {
    return {
      current: streak.currentStreak,
      longest: streak.longestStreak,
      totalDays: streak.totalDays,
      lastClaimDate: streak.lastClaimDate,
    };
  }
```

4. Remplacer `claimDaily` entièrement par :

```ts
  /**
   * Réclame la récompense journalière.
   * 1 jour manqué → rescue_required (rien n'est distribué).
   * 2+ jours manqués → la série repart à J1 dans la même requête (streakLost).
   */
  async claimDaily(userId: number): Promise<ClaimDailyResult> {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayUtc();
    const gap = classifyGap(streak.lastClaimDate, today);

    if (gap === 'claimed_today') {
      throw new ConflictException(
        "Récompense journalière déjà réclamée aujourd'hui.",
      );
    }
    if (gap === 'rescuable') {
      return {
        status: 'rescue_required',
        message:
          'Tu as manqué un jour. Sauve ta série en gold ou repars de J1.',
        streak: this.streakView(streak),
        rescue: { cost: rescueCost(streak.currentStreak) },
      };
    }

    let streakLost: number | undefined;
    if (gap === 'lost' && streak.currentStreak > 0) {
      streakLost = streak.currentStreak;
    }
    if (gap === 'lost' || gap === 'first') streak.currentStreak = 0;

    const day = streak.currentStreak + 1;
    const cycleDay = cycleDayFor(day);
    const rewardDef = await this.getRewardDefinition(
      cycleDay,
      weekNumberFor(day),
    );
    if (!rewardDef) {
      throw new NotFoundException(
        `Aucune récompense définie pour le jour ${cycleDay}`,
      );
    }

    await this.distributeReward(userId, rewardDef);
    const rewards: DailyRewardGain[] = [
      {
        type: rewardDef.rewardType,
        value: rewardDef.rewardValue,
        quantity: rewardDef.quantity,
        label: stripEmoji(rewardDef.label),
        isMilestone: false,
      },
    ];

    streak.currentStreak = day;
    streak.totalDays += 1;
    streak.longestStreak = Math.max(streak.longestStreak, day);
    streak.lastClaimDate = today;
    streak.cycleDay = cycleDayFor(day + 1);
    await this.streakRepo.save(streak);

    await this.historyRepo.save(
      this.historyRepo.create({
        userId,
        dayNumber: streak.totalDays,
        cycleDay,
        rewardType: rewardDef.rewardType,
        rewardValue: rewardDef.rewardValue,
        quantity: rewardDef.quantity,
        wasPurchased: false,
        isMilestone: false,
      }),
    );

    // Palier : atteint à chaque fois que la série passe le seuil
    const milestone = await this.milestoneRepo.findOne({
      where: { dayThreshold: day, isActive: true },
    });
    if (milestone) {
      await this.distributeReward(userId, milestone);
      rewards.push({
        type: milestone.rewardType,
        value: milestone.rewardValue,
        quantity: milestone.quantity,
        label: stripEmoji(milestone.label),
        isMilestone: true,
      });
      await this.historyRepo.save(
        this.historyRepo.create({
          userId,
          dayNumber: streak.totalDays,
          cycleDay,
          rewardType: milestone.rewardType,
          rewardValue: milestone.rewardValue,
          quantity: milestone.quantity,
          isMilestone: true,
        }),
      );
    }

    return {
      status: 'claimed',
      message: `Jour ${day} réclamé !`,
      streak: this.streakView(streak),
      rewards,
      ...(streakLost ? { streakLost } : {}),
    };
  }
```

5. Remplacer `rescueStreak` par :

```ts
  /** Rachète l'unique jour manqué, uniquement le jour du retour. */
  async rescueStreak(userId: number): Promise<RescueStreakResult> {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayUtc();

    if (classifyGap(streak.lastClaimDate, today) !== 'rescuable') {
      throw new BadRequestException(
        "Seul un jour manqué peut être racheté, et uniquement aujourd'hui.",
      );
    }

    const cost = rescueCost(streak.currentStreak);
    const user = await this.usersService.findOne(userId);
    if (Number(user.gold) < cost) {
      throw new BadRequestException(
        `Pas assez de gold. Il te faut ${cost}g, tu as ${user.gold}g.`,
      );
    }

    await this.usersService.addGold(userId, -cost);
    await this.rescueRepo.save(
      this.rescueRepo.create({
        userId,
        daysMissed: 1,
        goldSpent: cost,
        streakBefore: streak.currentStreak,
        streakAfter: streak.currentStreak,
      }),
    );

    // Le jour manqué devient « hier » : le claim du jour redevient consécutif
    streak.lastClaimDate = shiftDay(today, -1);
    await this.streakRepo.save(streak);

    return {
      message: `Série sauvée pour ${cost}g ! Tu peux réclamer ta récompense du jour.`,
      goldSpent: cost,
      goldRemaining: Number(user.gold) - cost,
      streak: streak.currentStreak,
    };
  }
```

6. Remplacer `resetStreak` par :

```ts
  async resetStreak(userId: number) {
    const streak = await this.getOrCreateStreak(userId);
    streak.currentStreak = 0;
    streak.cycleDay = 1;
    streak.lastClaimDate = null;
    await this.streakRepo.save(streak);
    return { message: 'Série réinitialisée. Tu repars de J1 !' };
  }
```

7. `getStatus` ne compile plus, car il utilise les helpers supprimés. Le remplacer **provisoirement** par le corps minimal ci-dessous (la Task 4 l'écrit en entier) :

```ts
  async getStatus(userId: number) {
    const streak = await this.getOrCreateStreak(userId);
    return { streak: this.streakView(streak) };
  }
```

8. Dans le controller, remplacer la route `rescue` et retirer `RescueStreakDto` de l'import :

```ts
  /** Rachète l'unique jour manqué en gold pour maintenir la série */
  @UseGuards(JwtAuthGuard)
  @Post('rescue')
  rescueStreak(@Req() req: AuthenticatedRequest) {
    return this.dailyRewardService.rescueStreak(req.user.userId);
  }
```

9. Dans `dto/daily-reward.dto.ts` : supprimer la classe `RescueStreakDto`, la section « Streak Rescue » et `import type { RescueStreakRequest } from '@pipou/shared';`.

- [ ] **Step 4 : lancer les tests et vérifier qu'ils passent**

Run : `pnpm --filter @pipou/backend test -- daily-reward && pnpm --filter @pipou/backend typecheck`
Expected : PASS (nouveaux tests et deux anciens tests de lookup), typecheck OK.

- [ ] **Step 5 : commit**

```bash
git add apps/backend/src/daily-reward
git commit -m "feat(daily-reward): full reset on missed days, single-day costly rescue"
```

---

### Task 4 : `/status` enrichi et labels sans emoji (back)

**Files :**
- Modify : `apps/backend/src/daily-reward/daily-reward.service.ts` (`getStatus`, nouveau helper `datesSince`, CRUD admin)
- Test : `apps/backend/src/daily-reward/daily-reward.service.spec.ts`

**Interfaces :**
- Consumes : Task 3 (`streakView`, `setup()` des tests), Task 2, Task 1 (`DailyRewardStatus`).
- Produces : `getStatus(userId): Promise<DailyRewardStatus>`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `daily-reward.service.spec.ts` :

```ts
describe('DailyRewardService — status', () => {
  beforeEach(() =>
    jest
      .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
      .setSystemTime(new Date(`${TODAY}T10:00:00Z`)),
  );
  afterEach(() => jest.useRealTimers());

  it('jour consécutif : prochain jour = streak + 1, pas de risque', async () => {
    const { service } = setup({ currentStreak: 7, lastClaimDate: '2026-10-15' });
    const s = await service.getStatus(1);
    expect(s).toMatchObject({
      alreadyClaimed: false,
      rescueAvailable: false,
      rescueCost: null,
      streakAtRisk: false,
      nextDay: { cycleDay: 1, weekNumber: 2 },
      nextReward: { type: 'gold', value: 50, label: 'Bonus' },
    });
  });

  it('un jour manqué : rachat disponible et chiffré', async () => {
    const { service } = setup({ currentStreak: 7, lastClaimDate: '2026-10-14' });
    const s = await service.getStatus(1);
    expect(s).toMatchObject({ rescueAvailable: true, rescueCost: 170 });
  });

  it('série perdue : streakAtRisk et prochain jour = J1', async () => {
    const { service } = setup({ currentStreak: 30, lastClaimDate: '2026-10-10' });
    const s = await service.getStatus(1);
    expect(s).toMatchObject({
      streakAtRisk: true,
      nextDay: { cycleDay: 1, weekNumber: 1 },
    });
  });

  it('paliers actifs depuis la BDD, labels nettoyés', async () => {
    const { service, repos } = setup({ currentStreak: 3, lastClaimDate: TODAY });
    repos.milestone.find.mockResolvedValue([
      { dayThreshold: 7, rewardType: 'gold', rewardValue: 500, quantity: 1, label: '🏆 Coffre' },
    ]);
    const s = await service.getStatus(1);
    expect(repos.milestone.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { dayThreshold: 'ASC' },
    });
    expect(s.milestones).toEqual([
      { dayThreshold: 7, type: 'gold', value: 500, quantity: 1, label: 'Coffre' },
    ]);
  });

  it('claimedDates dédoublonnés, rescuedDates = veille du rachat', async () => {
    const { service, repos } = setup({ currentStreak: 3, lastClaimDate: TODAY });
    repos.history.find.mockResolvedValue([
      { claimedAt: new Date('2026-10-14T08:00:00Z') },
      { claimedAt: new Date('2026-10-16T09:00:00Z') },
      { claimedAt: new Date('2026-10-16T09:00:01Z') },
    ]);
    repos.rescue.find.mockResolvedValue([
      { rescuedAt: new Date('2026-10-16T08:59:00Z') },
    ]);
    const s = await service.getStatus(1);
    expect(s.claimedDates).toEqual(['2026-10-14', '2026-10-16']);
    expect(s.rescuedDates).toEqual(['2026-10-15']);
  });
});

describe('DailyRewardService — labels admin', () => {
  it('retire les emojis à la création d\'un palier', async () => {
    const { service, repos } = setup({});
    await service.createMilestone({
      dayThreshold: 7,
      rewardType: 'gold',
      rewardValue: 500,
      label: '🏆 Coffre',
    });
    expect(repos.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Coffre' }),
    );
  });
});
```

- [ ] **Step 2 : lancer les tests et vérifier qu'ils échouent**

Run : `pnpm --filter @pipou/backend test -- daily-reward.service`
Expected : FAIL. `getStatus` ne renvoie que `streak`, et le label du palier garde son emoji.

- [ ] **Step 3 : implémenter**

Imports à compléter : `import { Repository, IsNull, MoreThanOrEqual } from 'typeorm';` et `type DailyRewardStatus` depuis `@pipou/shared`.

Remplacer le `getStatus` provisoire par :

```ts
  async getStatus(userId: number): Promise<DailyRewardStatus> {
    const streak = await this.getOrCreateStreak(userId);
    const today = todayUtc();
    const gap = classifyGap(streak.lastClaimDate, today);
    const nextDay = gap === 'lost' ? 1 : streak.currentStreak + 1;

    const [nextReward, milestones, dates] = await Promise.all([
      this.getRewardDefinition(cycleDayFor(nextDay), weekNumberFor(nextDay)),
      this.milestoneRepo.find({
        where: { isActive: true },
        order: { dayThreshold: 'ASC' },
      }),
      this.datesSince(userId, today),
    ]);

    return {
      streak: this.streakView(streak),
      nextDay: {
        cycleDay: cycleDayFor(nextDay),
        weekNumber: weekNumberFor(nextDay),
      },
      alreadyClaimed: gap === 'claimed_today',
      rescueAvailable: gap === 'rescuable',
      rescueCost: gap === 'rescuable' ? rescueCost(streak.currentStreak) : null,
      streakAtRisk: gap === 'lost' && streak.currentStreak > 0,
      nextReward: nextReward
        ? {
            type: nextReward.rewardType,
            value: nextReward.rewardValue,
            quantity: nextReward.quantity,
            label: stripEmoji(nextReward.label),
          }
        : null,
      milestones: milestones.map((m) => ({
        dayThreshold: m.dayThreshold,
        type: m.rewardType,
        value: m.rewardValue,
        quantity: m.quantity,
        label: stripEmoji(m.label),
      })),
      ...dates,
    };
  }

  /**
   * Jours réclamés et rachetés depuis min(1er du mois, J-6) :
   * de quoi remplir le calendrier du mois et la semaine du widget.
   */
  private async datesSince(userId: number, today: string) {
    const from = [`${today.slice(0, 8)}01`, shiftDay(today, -6)].sort()[0];
    const since = MoreThanOrEqual(new Date(`${from}T00:00:00Z`));

    const [claims, rescues] = await Promise.all([
      this.historyRepo.find({
        where: { userId, isMilestone: false, claimedAt: since },
        order: { claimedAt: 'ASC' },
      }),
      this.rescueRepo.find({ where: { userId, rescuedAt: since } }),
    ]);

    return {
      claimedDates: [...new Set(claims.map((c) => todayUtc(c.claimedAt)))],
      // Un rachat se fait le jour du retour et couvre la veille
      rescuedDates: rescues.map((r) => shiftDay(todayUtc(r.rescuedAt), -1)),
    };
  }
```

Labels admin : dans `createDefinition`, `updateDefinition`, `createMilestone` et `updateMilestone`, nettoyer le label avant l'enregistrement :

```ts
  // createDefinition
    const def = this.rewardDefRepo.create({
      ...dto,
      label: stripEmoji(dto.label),
      quantity: dto.quantity ?? 1,
      isActive: dto.isActive ?? true,
    });

  // updateDefinition
    Object.assign(def, dto);
    if (dto.label !== undefined) def.label = stripEmoji(dto.label);

  // createMilestone
      label: stripEmoji(dto.label) ?? undefined,

  // updateMilestone
    Object.assign(m, dto);
    if (dto.label !== undefined) m.label = stripEmoji(dto.label) ?? undefined;
```

- [ ] **Step 4 : lancer les tests et vérifier qu'ils passent**

Run : `pnpm --filter @pipou/backend test -- daily-reward && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected : PASS / OK.

- [ ] **Step 5 : commit**

```bash
git add apps/backend/src/daily-reward
git commit -m "feat(daily-reward): status exposes milestones, real claimed dates and rescue state"
```

---

### Task 5 : service front et helpers d'affichage

**Files :**
- Modify : `apps/frontend/src/services/dailyReward.service.ts` (réécriture)
- Modify : `packages/shared/src/api/requests.ts` (supprimer `RescueStreakRequest` et sa section, lignes 178-183)
- Create : `apps/frontend/src/components/daily-reward/rewardDisplay.tsx`

**Interfaces :**
- Consumes : Task 1.
- Produces :
  - `dailyRewardService.getStatus(): Promise<DailyRewardStatus>`, `.claimDaily(): Promise<ClaimDailyResult>`, `.rescueStreak(): Promise<RescueStreakResult>`, `.resetStreak(): Promise<{ message: string }>`
  - `RewardIcon({ type, size }: { type: DailyRewardType; size?: number }): JSX.Element`
  - `rewardText(r: Pick<DailyRewardItem, "type" | "value" | "quantity">): string`
  - `todayUtc(): string`
  - `MONTH_FR: string[]`

- [ ] **Step 1 : réécrire le service**

`apps/frontend/src/services/dailyReward.service.ts` :

```ts
import { api } from "../api/api";
import type {
  ClaimDailyResult,
  DailyRewardStatus,
  RescueStreakResult,
} from "@pipou/shared";

export const dailyRewardService = {
  async getStatus(): Promise<DailyRewardStatus> {
    const res = await api.get("/daily-reward/status");
    return res.data;
  },

  async claimDaily(): Promise<ClaimDailyResult> {
    const res = await api.post("/daily-reward/claim");
    return res.data;
  },

  async rescueStreak(): Promise<RescueStreakResult> {
    const res = await api.post("/daily-reward/rescue");
    return res.data;
  },

  async resetStreak(): Promise<{ message: string }> {
    const res = await api.post("/daily-reward/reset");
    return res.data;
  },
};
```

- [ ] **Step 2 : créer les helpers d'affichage**

`apps/frontend/src/components/daily-reward/rewardDisplay.tsx` :

```tsx
import type { DailyRewardItem, DailyRewardType } from "@pipou/shared";
import { IconBooster, IconBundle, IconCards, IconGold } from "../Icons";

export const MONTH_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const REWARD_LABEL: Record<DailyRewardType, string> = {
  gold: "Gold",
  card: "Carte",
  booster: "Booster",
  bundle: "Bundle",
};

/** Jour courant YYYY-MM-DD en UTC (même découpage que le serveur). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** « 150 gold », « 2× Booster »… */
export function rewardText(
  r: Pick<DailyRewardItem, "type" | "value" | "quantity">,
): string {
  return r.type === "gold"
    ? `${r.value * r.quantity} gold`
    : `${r.quantity}× ${REWARD_LABEL[r.type]}`;
}

export function RewardIcon({
  type,
  size = 24,
}: {
  type: DailyRewardType;
  size?: number;
}) {
  switch (type) {
    case "gold":
      return <IconGold size={size} color="#c8960c" />;
    case "card":
      return <IconCards size={size} color="#eebc77" />;
    case "booster":
      return <IconBooster size={size} color="#eebc77" />;
    case "bundle":
      return <IconBundle size={size} color="#eebc77" />;
  }
}
```

- [ ] **Step 3 : retirer `RescueStreakRequest` de shared**

Dans `packages/shared/src/api/requests.ts`, supprimer le bloc :

```ts
// ─── Récompense quotidienne ───────────────────────────────────────────────────

export interface RescueStreakRequest {
  daysToBuy: number;
}
```

Puis : `pnpm build:shared`.

- [ ] **Step 4 : vérifier**

Run : `pnpm --filter @pipou/shared test && pnpm --filter @pipou/backend typecheck`
Expected : OK. Le typecheck front échoue encore, sur `DailyRewardModal`, `DailyStreakWidget` et `Usedailyrewardmodal` : c'est attendu, les tâches 6 à 8 le corrigent. Ne pas lancer le typecheck front ici.

- [ ] **Step 5 : commit**

```bash
git add apps/frontend/src/services/dailyReward.service.ts apps/frontend/src/components/daily-reward/rewardDisplay.tsx packages/shared/src/api/requests.ts
git commit -m "feat(front): daily reward service on shared contract, reward display helpers"
```

---

### Task 6 : `MonthCalendar` compact

**Files :**
- Create : `apps/frontend/src/components/daily-reward/MonthCalendar.tsx`
- Test : `apps/frontend/src/__tests__/components/MonthCalendar.test.tsx`
- CSS : les classes `drm-cal*` sont ajoutées dans `DailyRewardModal.css` en Task 8. Le composant importe la feuille de la modal, ce qui évite un fichier CSS en plus.

**Interfaces :**
- Produces : `export default function MonthCalendar(props: { today: string; claimedDates: string[]; rescuedDates?: string[] })`. Chaque case a `data-state` ∈ `claimed | rescued | missed | today | future | past` et `data-today="true"` pour le jour courant.

- [ ] **Step 1 : écrire le test qui échoue**

`apps/frontend/src/__tests__/components/MonthCalendar.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MonthCalendar from "../../components/daily-reward/MonthCalendar";

const state = (day: string) =>
  screen.getByText(day, { selector: "[data-state]" }).getAttribute("data-state");

describe("MonthCalendar", () => {
  it("place le 1er octobre 2026 un jeudi", () => {
    render(<MonthCalendar today="2026-10-16" claimedDates={[]} />);
    const cells = document.querySelectorAll(".drm-cal__grid--days > *");
    expect(cells[3]).toHaveTextContent("1");
    expect(cells[2]).toBeEmptyDOMElement();
  });

  it("distingue réclamé, racheté, manqué, aujourd'hui et futur", () => {
    render(
      <MonthCalendar
        today="2026-10-16"
        claimedDates={["2026-09-30", "2026-10-03", "2026-10-04", "2026-10-06"]}
        rescuedDates={["2026-10-05"]}
      />,
    );
    expect(state("2")).toBe("past"); // avant le premier claim du mois
    expect(state("3")).toBe("claimed");
    expect(state("5")).toBe("rescued");
    expect(state("7")).toBe("missed");
    expect(state("16")).toBe("today");
    expect(state("17")).toBe("future");
  });

  it("aujourd'hui réclamé reste marqué comme aujourd'hui", () => {
    render(<MonthCalendar today="2026-10-16" claimedDates={["2026-10-16"]} />);
    const cell = screen.getByText("16", { selector: "[data-state]" });
    expect(cell).toHaveAttribute("data-state", "claimed");
    expect(cell).toHaveAttribute("data-today", "true");
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

Run : `pnpm --filter @pipou/frontend test -- MonthCalendar`
Expected : FAIL, module introuvable.

- [ ] **Step 3 : implémenter**

`apps/frontend/src/components/daily-reward/MonthCalendar.tsx` :

```tsx
import "../DailyRewardModal.css";

const DAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

type DayState = "claimed" | "rescued" | "missed" | "today" | "future" | "past";

interface MonthCalendarProps {
  /** YYYY-MM-DD (UTC) : fixe le mois affiché et le jour courant. */
  today: string;
  claimedDates: string[];
  rescuedDates?: string[];
}

/**
 * Calendrier compact du mois courant. Un jour est « manqué » s'il est passé,
 * non réclamé, et postérieur au premier jour actif visible du mois.
 */
export default function MonthCalendar({
  today,
  claimedDates,
  rescuedDates = [],
}: MonthCalendarProps) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const prefix = today.slice(0, 8);
  const startOffset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const claimed = new Set(claimedDates);
  const rescued = new Set(rescuedDates);
  const firstActive =
    [...claimedDates, ...rescuedDates].filter((d) => d.startsWith(prefix)).sort()[0] ??
    null;

  const stateOf = (date: string): DayState => {
    if (claimed.has(date)) return "claimed";
    if (rescued.has(date)) return "rescued";
    if (date === today) return "today";
    if (date > today) return "future";
    return firstActive && date > firstActive ? "missed" : "past";
  };

  return (
    <div className="drm-cal">
      <div className="drm-cal__grid">
        {DAY_SHORT.map((d, i) => (
          <span key={`dow-${i}`} className="drm-cal__dow">
            {d}
          </span>
        ))}
      </div>
      <div className="drm-cal__grid drm-cal__grid--days">
        {Array.from({ length: startOffset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = `${prefix}${String(day).padStart(2, "0")}`;
          const state = stateOf(date);
          return (
            <span
              key={date}
              className={`drm-cal__day drm-cal__day--${state}`}
              data-state={state}
              data-today={date === today ? "true" : undefined}
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : lancer le test et vérifier qu'il passe**

Run : `pnpm --filter @pipou/frontend test -- MonthCalendar`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/frontend/src/components/daily-reward/MonthCalendar.tsx apps/frontend/src/__tests__/components/MonthCalendar.test.tsx
git commit -m "feat(front): compact month calendar from real claim history"
```

---

### Task 7 : `MilestoneCard`

**Files :**
- Create : `apps/frontend/src/components/daily-reward/MilestoneCard.tsx`
- Test : `apps/frontend/src/__tests__/components/MilestoneCard.test.tsx`

**Interfaces :**
- Consumes : Task 5 (`RewardIcon`, `rewardText`), Task 1 (`DailyRewardMilestone`, `stripEmoji`).
- Produces :
  - `export default function MilestoneCard(props: { milestones: DailyRewardMilestone[]; streak: number })` : renvoie `null` si `milestones` est vide.
  - `export function visibleChips(milestones: DailyRewardMilestone[], streak: number): DailyRewardMilestone[]` : au plus les 2 derniers atteints, le prochain et les 3 suivants.

- [ ] **Step 1 : écrire le test qui échoue**

`apps/frontend/src/__tests__/components/MilestoneCard.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DailyRewardMilestone } from "@pipou/shared";
import MilestoneCard, {
  visibleChips,
} from "../../components/daily-reward/MilestoneCard";

const ms = (dayThreshold: number, label: string | null = null): DailyRewardMilestone => ({
  dayThreshold,
  type: "gold",
  value: 100,
  quantity: 1,
  label,
});
const ALL = [7, 14, 21, 30, 60, 77, 100].map((d) => ms(d));

describe("MilestoneCard", () => {
  it("affiche le prochain palier et la progression", () => {
    render(<MilestoneCard milestones={[ms(7), ms(21, "🎁 Coffre rare")]} streak={18} />);
    expect(screen.getByText("J21 · Coffre rare")).toBeInTheDocument();
    expect(screen.getByText("18 / 21 jours consécutifs")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "18");
  });

  it("utilise le texte de la récompense sans label", () => {
    render(<MilestoneCard milestones={[ms(7)]} streak={2} />);
    expect(screen.getByText("J7 · 100 gold")).toBeInTheDocument();
  });

  it("indique quand tous les paliers sont atteints", () => {
    render(<MilestoneCard milestones={[ms(7)]} streak={9} />);
    expect(screen.getByText("Tous les paliers atteints")).toBeInTheDocument();
  });

  it("ne rend rien sans palier", () => {
    const { container } = render(<MilestoneCard milestones={[]} streak={3} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("visibleChips : 2 atteints, le prochain et 3 suivants", () => {
    expect(visibleChips(ALL, 25).map((m) => m.dayThreshold)).toEqual([
      14, 21, 30, 60, 77, 100,
    ]);
    expect(visibleChips(ALL, 0).map((m) => m.dayThreshold)).toEqual([7, 14, 21, 30]);
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

Run : `pnpm --filter @pipou/frontend test -- MilestoneCard`
Expected : FAIL, module introuvable.

- [ ] **Step 3 : implémenter**

`apps/frontend/src/components/daily-reward/MilestoneCard.tsx` :

```tsx
import { motion } from "framer-motion";
import { stripEmoji, type DailyRewardMilestone } from "@pipou/shared";
import { IconTrophy } from "../Icons";
import { RewardIcon, rewardText } from "./rewardDisplay";
import "../DailyRewardModal.css";

/** 2 derniers paliers atteints, le prochain et les 3 suivants. */
export function visibleChips(
  milestones: DailyRewardMilestone[],
  streak: number,
): DailyRewardMilestone[] {
  const nextIdx = milestones.findIndex((m) => m.dayThreshold > streak);
  const pivot = nextIdx === -1 ? milestones.length : nextIdx;
  return milestones.slice(Math.max(pivot - 2, 0), pivot + 4);
}

interface MilestoneCardProps {
  milestones: DailyRewardMilestone[];
  streak: number;
}

export default function MilestoneCard({ milestones, streak }: MilestoneCardProps) {
  if (milestones.length === 0) return null;
  const next = milestones.find((m) => m.dayThreshold > streak) ?? null;

  return (
    <div className="drm-ms">
      {next ? (
        <div className="drm-ms__main">
          <span className="drm-ms__icon">
            <RewardIcon type={next.type} size={26} />
          </span>
          <div className="drm-ms__body">
            <span className="drm-ms__title">
              J{next.dayThreshold} · {stripEmoji(next.label) ?? rewardText(next)}
            </span>
            <span className="drm-ms__count">
              {streak} / {next.dayThreshold} jours consécutifs
            </span>
            <div
              className="drm-ms__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={next.dayThreshold}
              aria-valuenow={streak}
            >
              <motion.div
                className="drm-ms__fill"
                initial={{ width: 0 }}
                animate={{ width: `${(streak / next.dayThreshold) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="drm-ms__done">
          <IconTrophy size={18} color="#eebc77" />
          Tous les paliers atteints
        </div>
      )}
      <div className="drm-ms__chips">
        {visibleChips(milestones, streak).map((m) => (
          <span
            key={m.dayThreshold}
            className={[
              "drm-ms__chip",
              m.dayThreshold <= streak ? "is-done" : "",
              m === next ? "is-next" : "",
            ].join(" ")}
          >
            J{m.dayThreshold}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : lancer le test et vérifier qu'il passe**

Run : `pnpm --filter @pipou/frontend test -- MilestoneCard`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/frontend/src/components/daily-reward/MilestoneCard.tsx apps/frontend/src/__tests__/components/MilestoneCard.test.tsx
git commit -m "feat(front): next milestone card with progress and chips"
```

---

### Task 8 : modal réécrite

**Files :**
- Modify : `apps/frontend/src/components/DailyRewardModal.tsx` (réécriture complète)
- Modify : `apps/frontend/src/components/DailyRewardModal.css` (réécriture complète)
- Test : `apps/frontend/src/__tests__/components/DailyRewardModal.test.tsx`

**Interfaces :**
- Consumes : Tasks 5, 6 et 7 ; `userService.getMe()` (`UserMe.gold`), `QUERY_KEYS.profile`, `QUERY_KEYS.dailyRewardStatus`.
- Produces : même signature qu'avant, `DailyRewardModal({ onClose, addToast })`.

- [ ] **Step 1 : écrire le test qui échoue**

`apps/frontend/src/__tests__/components/DailyRewardModal.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DailyRewardStatus } from "@pipou/shared";
import DailyRewardModal from "../../components/DailyRewardModal";
import { dailyRewardService } from "../../services/dailyReward.service";
import { userService } from "../../services/user.service";

vi.mock("../../services/dailyReward.service");
vi.mock("../../services/user.service");

const status: DailyRewardStatus = {
  streak: { current: 20, longest: 28, totalDays: 38, lastClaimDate: "2026-10-14" },
  nextDay: { cycleDay: 7, weekNumber: 3 },
  alreadyClaimed: false,
  rescueAvailable: true,
  rescueCost: 300,
  streakAtRisk: false,
  nextReward: { type: "gold", value: 150, quantity: 1, label: "💎 Semaine 3" },
  milestones: [{ dayThreshold: 21, type: "gold", value: 500, quantity: 1, label: null }],
  claimedDates: ["2026-10-14"],
  rescuedDates: [],
};

function renderModal(gold: number) {
  vi.mocked(dailyRewardService.getStatus).mockResolvedValue(status);
  vi.mocked(userService.getMe).mockResolvedValue({ gold } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DailyRewardModal onClose={vi.fn()} addToast={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("DailyRewardModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("affiche la récompense du jour sans emoji", async () => {
    renderModal(1000);
    expect(await screen.findByText("150 gold")).toBeInTheDocument();
    expect(screen.getByText("Semaine 3")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("propose le rachat et le bloque si le gold manque", async () => {
    vi.mocked(dailyRewardService.claimDaily).mockResolvedValue({
      status: "rescue_required",
      message: "",
      streak: status.streak,
      rescue: { cost: 300 },
    });
    renderModal(120);
    await userEvent.click(await screen.findByRole("button", { name: /réclamer/i }));
    expect(await screen.findByText("Série de 20 jours en danger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /il manque 180 gold/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /repartir à j1/i })).toBeEnabled();
  });

  it("annonce la série perdue après un reset automatique", async () => {
    vi.mocked(dailyRewardService.claimDaily).mockResolvedValue({
      status: "claimed",
      message: "",
      streak: { current: 1, longest: 28, totalDays: 39, lastClaimDate: "2026-10-16" },
      rewards: [{ type: "gold", value: 50, quantity: 1, label: null, isMilestone: false }],
      streakLost: 20,
    });
    renderModal(1000);
    await userEvent.click(await screen.findByRole("button", { name: /réclamer/i }));
    expect(await screen.findByText("Série de 20 jours perdue")).toBeInTheDocument();
    expect(screen.getByText("+50")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

Run : `pnpm --filter @pipou/frontend test -- DailyRewardModal`
Expected : FAIL (l'ancienne modal ne compile plus avec les nouveaux types, ou les textes ne correspondent pas).

- [ ] **Step 3 : réécrire la modal**

`apps/frontend/src/components/DailyRewardModal.tsx` :

```tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  stripEmoji,
  type ClaimDailyResult,
  type ClaimedDailyResult,
  type DailyRewardGain,
} from "@pipou/shared";
import { dailyRewardService } from "../services/dailyReward.service";
import { userService } from "../services/user.service";
import { QUERY_KEYS } from "../utils/querykeys";
import type { ToastType } from "../hooks/useToast";
import { apiErrorMessage } from "../utils/errors";
import Button from "./Button";
import MonthCalendar from "./daily-reward/MonthCalendar";
import MilestoneCard from "./daily-reward/MilestoneCard";
import { MONTH_FR, RewardIcon, rewardText, todayUtc } from "./daily-reward/rewardDisplay";
import {
  IconCalendar,
  IconCheck,
  IconClose,
  IconFire,
  IconGold,
  IconPartyHorn,
  IconSkull,
  IconTrophy,
} from "./Icons";
import "./DailyRewardModal.css";

type Phase = "idle" | "claiming" | "rescue" | "result";

interface DailyRewardModalProps {
  onClose: () => void;
  addToast: (message: string, type?: ToastType) => void;
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

function RewardList({ rewards }: { rewards: DailyRewardGain[] }) {
  return (
    <div className="drm-rewards">
      {rewards.map((r, i) => (
        <motion.div
          key={i}
          className={`drm-reward ${r.isMilestone ? "drm-reward--milestone" : ""}`}
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: i * 0.15, type: "spring", damping: 14 }}
        >
          <RewardIcon type={r.type} size={28} />
          <span className="drm-reward__qty">
            {r.type === "gold" ? `+${r.value * r.quantity}` : `×${r.quantity}`}
          </span>
          <span className="drm-reward__type">
            {stripEmoji(r.label) ?? rewardText(r)}
          </span>
          {r.isMilestone && (
            <span className="drm-reward__badge">
              <IconTrophy size={10} color="#eebc77" /> Palier
            </span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export default function DailyRewardModal({ onClose, addToast }: DailyRewardModalProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [claimResult, setClaimResult] = useState<ClaimedDailyResult | null>(null);
  const [rescue, setRescue] = useState<{ cost: number; streak: number } | null>(null);
  const [error, setError] = useState("");

  const { data: status } = useQuery({
    queryKey: QUERY_KEYS.dailyRewardStatus,
    queryFn: () => dailyRewardService.getStatus(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: me } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    staleTime: 10 * 60 * 1000,
  });

  const today = todayUtc();
  const monthTitle = `${MONTH_FR[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}`;
  const missingGold =
    rescue && me ? Math.max(rescue.cost - Number(me.gold), 0) : 0;

  const showResult = (result: ClaimDailyResult, streakLost?: number) => {
    if (result.status === "rescue_required") {
      setRescue({ cost: result.rescue.cost, streak: result.streak.current });
      setPhase("rescue");
      return;
    }
    setClaimResult(streakLost ? { ...result, streakLost } : result);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dailyRewardStatus });
    setPhase("result");
  };

  const run = async (action: () => Promise<void>, fallback: string, onError: Phase) => {
    setPhase("claiming");
    setError("");
    try {
      await action();
    } catch (e) {
      setError(apiErrorMessage(e) ?? fallback);
      setPhase(onError);
    }
  };

  const handleClaim = () =>
    run(async () => showResult(await dailyRewardService.claimDaily()), "Erreur lors du claim.", "idle");

  const handleRescue = () =>
    run(
      async () => {
        const res = await dailyRewardService.rescueStreak();
        addToast(`Série sauvée ! ${res.goldSpent} gold dépensés.`, "success");
        showResult(await dailyRewardService.claimDaily());
      },
      "Erreur lors du rachat.",
      "rescue",
    );

  const handleRestart = () =>
    run(
      async () => {
        await dailyRewardService.resetStreak();
        showResult(await dailyRewardService.claimDaily(), rescue?.streak);
      },
      "Erreur lors de la réinitialisation.",
      "rescue",
    );

  return (
    <div
      className="drm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "claiming") onClose();
      }}
    >
      <motion.div
        className="drm-modal"
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 20, stiffness: 260 }}
      >
        {phase !== "claiming" && (
          <Button variant="ghost-gold" size="icon" aria-label="Fermer" className="drm-close" onClick={onClose}>
            <IconClose size={16} />
          </Button>
        )}

        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div key="idle" className="drm-content" {...fade}>
              <div className="drm-header">
                <div className="drm-header__row">
                  <IconCalendar size={22} color="#eebc77" />
                  <h2 className="drm-header__title">{monthTitle}</h2>
                </div>
                {status && (
                  <div className="drm-header__stats">
                    <span className="drm-stat">
                      <IconFire size={12} color="#e05a00" />
                      <strong>{status.streak.current}</strong> consécutifs
                    </span>
                    <span className="drm-stat-sep">·</span>
                    <span className="drm-stat">
                      <strong>{status.streak.totalDays}</strong> au total
                    </span>
                    <span className="drm-stat-sep">·</span>
                    <span className="drm-stat">
                      record <strong>{status.streak.longest}</strong> j
                    </span>
                  </div>
                )}
              </div>

              {status && (
                <MonthCalendar
                  today={today}
                  claimedDates={status.claimedDates}
                  rescuedDates={status.rescuedDates}
                />
              )}

              {status?.nextReward && (
                <div className="drm-today">
                  <span className="drm-today__icon">
                    <RewardIcon type={status.nextReward.type} size={24} />
                  </span>
                  <div className="drm-today__body">
                    <span className="drm-today__meta">
                      Aujourd'hui · Semaine {status.nextDay.weekNumber} · Jour {status.nextDay.cycleDay}
                    </span>
                    <strong className="drm-today__value">{rewardText(status.nextReward)}</strong>
                    {stripEmoji(status.nextReward.label) && (
                      <span className="drm-today__label">{stripEmoji(status.nextReward.label)}</span>
                    )}
                  </div>
                </div>
              )}

              {status && <MilestoneCard milestones={status.milestones} streak={status.streak.current} />}

              {status?.streakAtRisk && (
                <p className="drm-warning">
                  <IconSkull size={14} color="#f27aaa" />
                  Ta série de {status.streak.current} jours sera perdue en réclamant.
                </p>
              )}

              {error && <p className="drm-error">{error}</p>}

              <Button variant="primary-inverse" size="lg" fullWidth onClick={handleClaim} disabled={status?.alreadyClaimed}>
                {status?.alreadyClaimed ? (
                  <>
                    <IconCheck size={14} /> Réclamée aujourd'hui
                  </>
                ) : (
                  "Réclamer ma récompense"
                )}
              </Button>
            </motion.div>
          )}

          {phase === "claiming" && (
            <motion.div key="claiming" className="drm-content drm-content--center" {...fade}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <IconGold size={36} color="#c8960c" />
              </motion.div>
              <p className="drm-loading-text">Récupération en cours…</p>
            </motion.div>
          )}

          {phase === "rescue" && rescue && (
            <motion.div key="rescue" className="drm-content" {...fade}>
              <div className="drm-header">
                <div className="drm-header__row">
                  <IconSkull size={22} color="#f27aaa" />
                  <h2 className="drm-header__title drm-header__title--danger">
                    Série de {rescue.streak} jours en danger
                  </h2>
                </div>
                <p className="drm-header__subtitle">
                  Tu as manqué hier. Sauve ta série aujourd'hui, demain il sera trop tard.
                </p>
              </div>

              {status && (
                <MonthCalendar today={today} claimedDates={status.claimedDates} rescuedDates={status.rescuedDates} />
              )}

              {error && <p className="drm-error">{error}</p>}

              <div className="drm-rescue-actions">
                <Button variant="primary-inverse" fullWidth onClick={handleRescue} disabled={missingGold > 0}>
                  <IconGold size={14} color="#c8960c" />
                  {missingGold > 0 ? `Il manque ${missingGold} gold` : `Sauver pour ${rescue.cost} gold`}
                </Button>
                <Button variant="danger-inverse" fullWidth onClick={handleRestart}>
                  Repartir à J1
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "result" && claimResult && (
            <motion.div key="result" className="drm-content" {...fade}>
              {claimResult.streakLost && (
                <p className="drm-warning">
                  <IconSkull size={14} color="#f27aaa" />
                  Série de {claimResult.streakLost} jours perdue
                </p>
              )}
              <div className="drm-header">
                <div className="drm-header__row">
                  <IconPartyHorn size={22} color="#c8960c" />
                  <h2 className="drm-header__title">Récompense reçue !</h2>
                </div>
                <p className="drm-header__subtitle">
                  <IconFire size={12} color="#e05a00" /> Série :{" "}
                  <strong>
                    {claimResult.streak.current} jour{claimResult.streak.current > 1 ? "s" : ""}
                  </strong>
                </p>
              </div>

              <RewardList rewards={claimResult.rewards} />

              <MilestoneCard milestones={status?.milestones ?? []} streak={claimResult.streak.current} />

              <Button variant="primary-inverse" fullWidth onClick={onClose}>
                Super, merci !
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

Note : Testing Library concatène les nœuds texte directs d'un même élément, donc `Série de {n} jours perdue` (avec l'icône SVG en frère) est bien trouvé par `getByText("Série de 20 jours perdue")`.

- [ ] **Step 4 : réécrire la feuille de style**

Remplacer `apps/frontend/src/components/DailyRewardModal.css` par :

```css
/* ── Overlay ── */
.drm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 3, 7, 0.92);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* ── Modal ── */
.drm-modal {
  width: 100%;
  max-width: 360px;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: linear-gradient(160deg, #1a0a12 0%, #120818 100%);
  border: 1.5px solid rgba(238, 188, 119, 0.25);
  border-radius: 18px;
  padding: 1rem 1rem 1.1rem;
  position: relative;
  box-shadow: 0 0 60px rgba(238, 188, 119, 0.08);
  scrollbar-width: none;
}
.drm-modal::-webkit-scrollbar {
  display: none;
}
.btn.drm-close {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  z-index: 2;
}

.drm-content {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.drm-content--center {
  min-height: 160px;
  align-items: center;
  justify-content: center;
}

/* ── Header ── */
.drm-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-right: 2rem;
}
.drm-header__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.drm-header__title {
  font-family: "Lilita One", cursive;
  font-size: 1.1rem;
  color: #eebc77;
  margin: 0;
}
.drm-header__title--danger {
  color: #f27aaa;
}
.drm-header__subtitle {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-family: "Comfortaa", sans-serif;
  font-size: 0.74rem;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
  line-height: 1.45;
}
.drm-header__subtitle strong {
  color: #eebc77;
}
.drm-header__stats {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.drm-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: "Comfortaa", sans-serif;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.5);
}
.drm-stat strong {
  color: #eebc77;
}
.drm-stat-sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.68rem;
}

/* ── Bloc commun ── */
.drm-cal,
.drm-today,
.drm-ms {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(238, 188, 119, 0.12);
  border-radius: 12px;
  padding: 0.6rem;
}

/* ── Calendrier compact ── */
.drm-cal__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.drm-cal__grid + .drm-cal__grid {
  margin-top: 3px;
}
.drm-cal__dow {
  text-align: center;
  font-family: "Comfortaa", sans-serif;
  font-size: 0.55rem;
  color: rgba(255, 255, 255, 0.3);
}
.drm-cal__day {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1.5px solid transparent;
  font-family: "Lilita One", cursive;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.35);
}
.drm-cal__day--claimed {
  background: rgba(112, 184, 112, 0.18);
  color: #70b870;
}
.drm-cal__day--rescued {
  border: 1.5px dashed rgba(238, 188, 119, 0.5);
  color: #eebc77;
}
.drm-cal__day--missed {
  background: rgba(242, 122, 170, 0.12);
  color: #f27aaa;
}
.drm-cal__day--future,
.drm-cal__day--past {
  color: rgba(255, 255, 255, 0.22);
}
.drm-cal__day[data-today="true"] {
  border-color: #eebc77;
  color: #eebc77;
}
.drm-cal__day--claimed[data-today="true"] {
  border-color: #70b870;
  color: #70b870;
}

/* ── Récompense du jour ── */
.drm-today {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drm-today__icon,
.drm-ms__icon {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(238, 188, 119, 0.12);
  border: 1.5px solid rgba(238, 188, 119, 0.4);
}
.drm-today__body,
.drm-ms__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.drm-today__meta {
  font-family: "Comfortaa", sans-serif;
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(255, 255, 255, 0.4);
}
.drm-today__value {
  font-family: "Lilita One", cursive;
  font-size: 1rem;
  font-weight: normal;
  color: #eebc77;
}
.drm-today__label {
  font-family: "Comfortaa", sans-serif;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
}

/* ── Prochain palier ── */
.drm-ms__main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.drm-ms__title {
  font-family: "Lilita One", cursive;
  font-size: 0.88rem;
  color: #eebc77;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.drm-ms__count {
  font-family: "Comfortaa", sans-serif;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.45);
}
.drm-ms__bar {
  height: 6px;
  margin-top: 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.drm-ms__fill {
  height: 100%;
  background: linear-gradient(90deg, #70b870, #eebc77);
}
.drm-ms__done {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: "Lilita One", cursive;
  font-size: 0.85rem;
  color: #eebc77;
}
.drm-ms__chips {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.drm-ms__chip {
  font-family: "Lilita One", cursive;
  font-size: 0.56rem;
  padding: 2px 7px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.3);
}
.drm-ms__chip.is-done {
  border-color: rgba(112, 184, 112, 0.5);
  color: #70b870;
}
.drm-ms__chip.is-next {
  border-color: #eebc77;
  color: #eebc77;
}

/* ── Résultat ── */
.drm-rewards {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
.drm-reward {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0.65rem 0.9rem;
  min-width: 80px;
}
.drm-reward--milestone {
  border-color: rgba(238, 188, 119, 0.4);
  background: rgba(238, 188, 119, 0.08);
}
.drm-reward__qty {
  font-family: "Lilita One", cursive;
  font-size: 1rem;
  color: #eebc77;
}
.drm-reward__type {
  font-family: "Comfortaa", sans-serif;
  font-size: 0.62rem;
  color: rgba(255, 255, 255, 0.45);
}
.drm-reward__badge {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: "Comfortaa", sans-serif;
  font-size: 0.55rem;
  color: #eebc77;
  background: rgba(238, 188, 119, 0.15);
  padding: 2px 6px;
  border-radius: 20px;
}

/* ── Rachat ── */
.drm-rescue-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Messages ── */
.drm-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
  background: rgba(242, 122, 170, 0.1);
  border: 1px solid rgba(242, 122, 170, 0.3);
  font-family: "Comfortaa", sans-serif;
  font-size: 0.72rem;
  color: #f27aaa;
}
.drm-loading-text {
  font-family: "Comfortaa", sans-serif;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}
.drm-error {
  margin: 0;
  font-family: "Comfortaa", sans-serif;
  font-size: 0.75rem;
  color: #f27aaa;
  text-align: center;
}
```

- [ ] **Step 5 : lancer les tests et vérifier qu'ils passent**

Run : `pnpm --filter @pipou/frontend test -- DailyRewardModal MonthCalendar MilestoneCard`
Expected : PASS.

- [ ] **Step 6 : commit**

```bash
git add apps/frontend/src/components/DailyRewardModal.tsx apps/frontend/src/components/DailyRewardModal.css apps/frontend/src/__tests__/components/DailyRewardModal.test.tsx
git commit -m "feat(front): compact daily reward modal with icons, rescue and lost-streak states"
```

---

### Task 9 : widget, hook, vérification complète

**Files :**
- Modify : `apps/frontend/src/components/DailyStreakWidget.tsx`
- Modify : `apps/frontend/src/hooks/Usedailyrewardmodal.ts` (ligne 24-25)

**Interfaces :**
- Consumes : Task 1 (`DailyRewardStatus`), Task 5 (`RewardIcon`, `rewardText`, `todayUtc`).

- [ ] **Step 1 : hook d'ouverture automatique**

Dans `Usedailyrewardmodal.ts`, remplacer :

```ts
    // Auto-ouvre si pas encore réclamé ou si streak en danger
    if (!status.alreadyClaimed || status.daysMissed > 0) {
```

par :

```ts
    // Auto-ouvre tant que la récompense du jour n'est pas réclamée
    if (!status.alreadyClaimed) {
```

- [ ] **Step 2 : widget**

Dans `DailyStreakWidget.tsx` :

1. Supprimer `REWARD_ICON` (les emojis) et remplacer `buildWeekDays` par :

```tsx
/** 7 jours de la semaine courante (lundi → dimanche), en UTC comme le serveur. */
function buildWeekDays(today: string, claimedDates: string[]) {
  const claimed = new Set(claimedDates);
  const base = new Date(`${today}T00:00:00Z`);
  const dow = (base.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - dow + i);
    const ds = d.toISOString().slice(0, 10);
    return {
      dateStr: ds,
      dayNum: d.getUTCDate(),
      isToday: ds === today,
      isClaimed: claimed.has(ds),
      isFuture: ds > today,
    };
  });
}
```

2. Imports :

```tsx
import { IconCheck, IconFire, IconSkull, IconTrophy } from "./Icons";
import { RewardIcon, rewardText, todayUtc } from "./daily-reward/rewardDisplay";
```

3. Dans le composant, remplacer la déstructuration et le calcul :

```tsx
  const { streak, alreadyClaimed, rescueAvailable, streakAtRisk, nextReward, milestones } =
    status;
  const today = todayUtc();
  const weekDays = buildWeekDays(today, status.claimedDates);
  const nextMilestone = milestones.find((m) => m.dayThreshold > streak.current);
  const daysToMilestone = nextMilestone ? nextMilestone.dayThreshold - streak.current : null;
  const inDanger = rescueAvailable || streakAtRisk;
```

4. Icône et libellé de la série :

```tsx
        <span className="dsw__streak-icon">
          {alreadyClaimed ? (
            <IconCheck size={18} color="#70b870" />
          ) : inDanger ? (
            <IconSkull size={18} color="#f27aaa" />
          ) : (
            <IconFire size={18} color="#e05a00" />
          )}
        </span>
        ...
          <span className="dsw__streak-label">
            {alreadyClaimed
              ? "Réclamé aujourd'hui"
              : rescueAvailable
                ? "Série en danger"
                : streakAtRisk
                  ? "Série perdue"
                  : "À réclamer !"}
          </span>
```

5. Case du jour réclamé : `{day.isClaimed ? <IconCheck size={10} /> : day.dayNum}`.

6. Prochaine récompense :

```tsx
      {!alreadyClaimed && nextReward && (
        <div className="dsw__next">
          <RewardIcon type={nextReward.type} size={16} />
          <span className="dsw__next-label">{rewardText(nextReward)}</span>
        </div>
      )}
```

7. Palier proche :

```tsx
      {nextMilestone && daysToMilestone !== null && daysToMilestone <= 3 && (
        <div className="dsw__milestone">
          <IconTrophy size={12} color="#eebc77" /> J{nextMilestone.dayThreshold} dans{" "}
          {daysToMilestone}j
        </div>
      )}
```

Si `.dsw__streak-icon` ou `.dsw__milestone` reposent sur `font-size` pour dimensionner l'emoji, ajouter `display: flex; align-items: center; gap: 4px;` dans `DailyStreakWidget.css`.

- [ ] **Step 3 : vérifier qu'il ne reste aucun emoji**

Run : `grep -nP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}]" apps/frontend/src/components/DailyRewardModal.tsx apps/frontend/src/components/DailyStreakWidget.tsx apps/frontend/src/components/daily-reward/*.tsx`
Expected : aucune sortie.

- [ ] **Step 4 : vérification complète**

Run : `pnpm typecheck && pnpm lint && pnpm test`
Expected : tout passe. Corriger toute référence restante à `daysMissed`, `nextMilestone`, `maxRescuable` ou `RescueStreakRequest` (`grep -rn "daysMissed\|maxRescuable\|RescueStreakRequest" apps packages --include=*.ts --include=*.tsx | grep -v dist`).

- [ ] **Step 5 : contrôle visuel**

Suivre la mémoire « Front visual check » et « Local test env » : back sur la base Docker `cardcollect_dev` (`ENV_FILE=.env.dev.local`, **jamais Aiven**), front en local, compte admin local. Avec Playwright à 430px, capturer :
1. l'écran idle (non réclamé) : vérifier que la modal tient sans scroll et que le calendrier et la carte palier sont lisibles ;
2. l'écran de rachat : dans la base locale, `UPDATE login_streak SET lastClaimDate = CURDATE() - INTERVAL 2 DAY, currentStreak = 12 WHERE userId = <id>` ;
3. la série perdue : même requête avec `INTERVAL 4 DAY` ;
4. l'écran de résultat ;
5. le widget de la page d'accueil.

Corriger les défauts visibles, puis recapturer.

- [ ] **Step 6 : commit**

```bash
git add apps/frontend/src/components/DailyStreakWidget.tsx apps/frontend/src/components/DailyStreakWidget.css apps/frontend/src/hooks/Usedailyrewardmodal.ts
git commit -m "feat(front): streak widget with icons and real claim dates"
```
