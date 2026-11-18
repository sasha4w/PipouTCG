# IA à réseau de neurones — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la note manuelle des positions par un petit réseau de neurones appris par auto-jeu sur un seul PC, et en dériver les 5 niveaux d'aventure.

**Architecture:** L'auto-jeu (Node, multi-processus) écrit des positions encodées en JSONL.gz. PyTorch CPU entraîne un réseau de valeur (DeepSets + MLP) et l'exporte en JSON. Une inférence pure TypeScript branche ce réseau dans le planificateur beam existant via le type `Evaluator`. Une arène champion/challenger décide des promotions. En prod, l'IA réfléchit dans un `worker_thread` avec un plafond dur de 4 s.

**Tech Stack:** NestJS 11 / TypeScript / Jest (backend), Node `worker_threads`, `zlib`, Python 3.12 + PyTorch CPU + numpy + matplotlib + pytest + Jupyter (`tools/ai-train`).

**Spec:** `docs/superpowers/specs/2026-11-18-ia-reseau-neurones-design.md`

## Global Constraints

- Branche `feat/ai-neural`, worktree `PipouTCG-ai-neural`. Point de départ : `evaluate.ts` de `main`. Ne pas reprendre les modifications non commitées de la branche `BETTER-AI`.
- Un seul PC. Pas de LLM, pas d'appel réseau pendant l'entraînement. Pas de Python en CI ni en prod.
- Tout type ou enum échangé entre front et back vit dans `@pipou/shared`. Ce plan n'en ajoute aucun : tout reste dans `apps/backend`.
- Ne jamais lancer de commande sur la base Aiven (`apps/backend/.env` pointe sur la prod). Les CLI d'IA de ce plan n'ouvrent aucune base.
- Commits : messages en français, au format conventionnel (`feat(ia): …`, `test(ia): …`). Committer à la fin de chaque tâche. Ne jamais pousser sans demande explicite.
- Encodage : `ENCODING_VERSION = 1`. Un seul encodeur, `nn/encode.ts`.
- Réseau :
  - carte : [x(32) + embedding(8)] → 64 ReLU → 32 ReLU ;
  - tête : concat(global 22, 7 sommes × 32) → 128 ReLU → 128 ReLU → 1 → tanh.
- Valeur réseau × 1000 (`NN_SCALE`). Victoire +Infinity, défaite −Infinity, nul −10 000.
- Parité PyTorch / TypeScript : écart max `1e-5` sur 50 positions. Les nombres du fichier de poids sont arrondis à 6 chiffres significatifs.
- Arène : 400 parties, decks miroirs, même graine dans les deux sens. Promotion si score ≥ 0,55 et borne basse de Wilson à 95 % > 0,5.
- Prod :
  - plafond dur de 4 s, puis repli sur le coup glouton de `evaluate.ts` ;
  - `AI_EVAL=nn|legacy` (défaut `nn`), repli `legacy` si le fichier de poids manque ou si sa version diffère ;
  - `AI_WORKER=off` désactive le worker.
- Python : code commenté ligne par ligne, en français.
- Les commandes `pnpm` se lancent depuis la racine du worktree. Les commandes Python se lancent depuis `tools/ai-train` avec `.venv/Scripts/python` (Windows).

---

## Carte des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `apps/backend/src/fights/ai/temperature.ts` (+ spec) | Tirage softmax avec température | 1 |
| `apps/backend/src/fights/ai/ai-player.ts` | `mistakeRate` remplacé par `temperature` | 1 |
| `apps/backend/src/fights/ai/planner.ts` | `planTurn` rend aussi `alternatives` | 1 |
| `apps/backend/src/fights/ai/level-brains.ts`, `tournament.ts` | `temperature` partout | 1, 11 |
| `apps/backend/src/fights/ai/nn/encode.ts` (+ spec) | Position → entrée du réseau | 2 |
| `apps/backend/src/fights/ai/nn/weights.ts` (+ spec) | Format, validation, chargement des poids | 3 |
| `apps/backend/src/fights/ai/nn/mlp.ts` (+ spec) | Inférence pure TS, parité | 3 |
| `apps/backend/src/fights/testing/nn-weights.ts` | Poids factices pour les tests | 3 |
| `apps/backend/src/fights/ai/nn/nn-eval.ts` (+ spec) | `nnEvaluator` | 4 |
| `apps/backend/src/fights/ai/note.ts` (+ spec) | `Note`, `evaluatorOf`, `parseNote`, `defaultNote` | 4 |
| `apps/backend/src/fights/ai/nn/shards.ts` | Arguments CLI et processus parallèles | 5 |
| `apps/backend/src/fights/ai/nn/selfplay.ts` + `.cli.ts` (+ spec) | Auto-jeu → JSONL.gz | 5 |
| `apps/backend/src/fights/ai/nn/stats.ts`, `arena.ts` + `.cli.ts` (+ specs) | Arène | 6 |
| `apps/backend/src/fights/ai/nn/check-weights.cli.ts` | Parité en ligne de commande | 7 |
| `tools/ai-train/model.py`, `dataset.py`, `tests/` | Réseau et données Python | 8 |
| `tools/ai-train/train.py`, `export.py`, `nn/parity-fixture.json`, `parity.spec.ts` | Entraînement, export, parité | 9 |
| `tools/ai-train/loop.py` | Boucle de générations | 10 |
| `apps/backend/src/fights/ai/ai-engine.ts`, `ai-mover.ts`, `nn/ai-worker.ts` (+ specs) | Worker de prod | 11 |
| `tools/ai-train/README.md`, `COURS.md`, `make_notebook.py`, `explore.ipynb` | Guide | 12 |
| `tools/ai-train/loop.py` (constante `DEFAULT_GAMES`) | Calibrage et premier champion (manuel) | 13 |

---

### Task 1: La température remplace `mistakeRate`

**Files:**
- Create: `apps/backend/src/fights/ai/temperature.ts`
- Test: `apps/backend/src/fights/ai/temperature.spec.ts`
- Modify:
  - `apps/backend/src/fights/ai/ai-player.ts` (constructeur l.88-97, bloc d'erreur l.240-244, partie gloutonne l.253-264, `planned` l.274-320, `plausibleMistake` l.383-404)
  - `apps/backend/src/fights/ai/planner.ts` (`Plan` l.128, fin de `planTurn` l.261-289)
  - `apps/backend/src/fights/ai/level-brains.ts`
  - `apps/backend/src/fights/ai/tournament.ts` (l.31-46, l.64, l.133-142)
  - `apps/backend/src/fights/ai/selfplay-data.cli.ts` (l.49)
- Test (modify): `level-brains.spec.ts`, `tournament.spec.ts` (l.120-200), `planner.spec.ts`, `ai-player.spec.ts`

**Interfaces:**
- Produces:
  - `pickSoftmax<T>(items: readonly T[], score: (item: T) => number, temperature: number, random: () => number): T`
  - `new AiPlayer(engine, random, thinking = 'greedy', temperature = 0, evaluate = evaluateLegacy, temperatureDecisions = Infinity)`
  - `interface PlanChoice extends Plan { alternatives: Plan[] }`, avec `planTurn(...): PlanChoice | null`
  - `LevelBrain { thinking; temperature: number; note?: Note }`
  - `TournamentEntry.temperature?: number` et `TournamentEntry.temperatureDecisions?: number` (remplacent `mistakeRate?`)

- [ ] **Step 1: Écrire le test de `pickSoftmax`**

```ts
// apps/backend/src/fights/ai/temperature.spec.ts
import { pickSoftmax } from './temperature';

const items = [
  { name: 'a', score: 0 },
  { name: 'b', score: 100 },
  { name: 'c', score: 100 },
];
const score = (i: { score: number }) => i.score;

describe('pickSoftmax', () => {
  it('température 0 : le premier meilleur, sans tirage', () => {
    const random = jest.fn(() => 0.99);
    expect(pickSoftmax(items, score, 0, random).name).toBe('b');
    expect(random).not.toHaveBeenCalled();
  });

  it('meilleur score infini : toujours lui, même très chaud', () => {
    const win = [...items, { name: 'w', score: Infinity }];
    expect(pickSoftmax(win, score, 1e9, () => 0).name).toBe('w');
  });

  it('très chaud : tirage presque uniforme selon random', () => {
    expect(pickSoftmax(items, score, 1e9, () => 0).name).toBe('a');
    expect(pickSoftmax(items, score, 1e9, () => 0.5).name).toBe('b');
    expect(pickSoftmax(items, score, 1e9, () => 0.99).name).toBe('c');
  });

  it('froid : le moins bon devient improbable', () => {
    // poids de a : exp(-100/10) ≈ 4,5e-5 ; random 0,001 tombe déjà sur b
    expect(pickSoftmax(items, score, 10, () => 0.001).name).toBe('b');
  });

  it('un score -Infinity n’est jamais tiré', () => {
    const lost = [{ name: 'x', score: -Infinity }, ...items];
    expect(pickSoftmax(lost, score, 1e9, () => 0).name).toBe('a');
  });

  it('refuse une liste vide', () => {
    expect(() => pickSoftmax([], score, 1, () => 0)).toThrow();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- temperature.spec`
Expected: FAIL, `Cannot find module './temperature'`.

- [ ] **Step 3: Écrire `temperature.ts`**

```ts
// apps/backend/src/fights/ai/temperature.ts
/**
 * Tire un élément avec une probabilité proportionnelle à
 * exp((score - meilleur) / température). Température ≤ 0, un seul élément ou
 * meilleur score infini : le premier meilleur, sans consommer `random`.
 * Un score non fini (−Infinity) n'est jamais tiré.
 */
export function pickSoftmax<T>(
  items: readonly T[],
  score: (item: T) => number,
  temperature: number,
  random: () => number,
): T {
  if (items.length === 0) throw new Error('pickSoftmax : aucun élément');
  let best = items[0];
  for (const item of items) if (score(item) > score(best)) best = item;
  const top = score(best);
  if (temperature <= 0 || items.length === 1 || !Number.isFinite(top))
    return best;
  const weights = items.map((item) => {
    const s = score(item);
    return Number.isFinite(s) ? Math.exp((s - top) / temperature) : 0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let rest = random() * total;
  for (let k = 0; k < items.length; k++) {
    rest -= weights[k];
    if (rest < 0) return items[k];
  }
  return best;
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `pnpm --filter @pipou/backend test -- temperature.spec`
Expected: PASS (6 tests).

- [ ] **Step 5: Test planificateur : `alternatives` triées, la première est le plan rendu**

Ajouter à la fin de `planner.spec.ts`, en réutilisant la première position du fichier qui appelle `planTurn` (l.82) :

```ts
describe('planTurn : alternatives', () => {
  it('finalistes triés par score décroissant, le premier est le plan rendu', () => {
    // même position et mêmes arguments que le premier test qui appelle planTurn (l.82)
    const plan = planTurn(engine, game, 'p1', pipou, STRONGEST, seeded(1), {
      used: 0,
    })!;
    expect(plan.alternatives.length).toBeGreaterThan(0);
    expect(plan.alternatives.length).toBeLessThanOrEqual(STRONGEST.beamWidth);
    expect(plan.alternatives[0].keys).toEqual(plan.keys);
    expect(plan.alternatives[0].score).toBe(plan.score);
    for (let k = 1; k < plan.alternatives.length; k++)
      expect(plan.alternatives[k - 1].score).toBeGreaterThanOrEqual(
        plan.alternatives[k].score,
      );
  });
});
```

`game`, `engine`, `pipou` et `seeded` sont ceux du premier test du fichier : déplacer la construction de la position dans une fonction locale si elle est à l'intérieur d'un `it`.

- [ ] **Step 6: `planTurn` rend `alternatives`**

Dans `planner.ts`, ajouter après l'interface `Plan` :

```ts
/** Plan retenu et finalistes du faisceau, du meilleur au moins bon (le premier est le plan). */
export interface PlanChoice extends Plan {
  alternatives: Plan[];
}
```

Changer le type de retour de `planTurn` en `PlanChoice | null`. Remplacer la fin de la fonction, de `const best = finalists.reduce(...)` jusqu'au `return { ... }`, par :

```ts
  // Tri stable : à score égal, l'ordre des finalistes est gardé (comme reduce)
  const ranked = [...finalists]
    .sort((a, b) => b.score - a.score)
    .map(
      (n): Plan => ({
        actions: n.actions,
        keys: n.keys,
        expected: n.expected,
        score: n.score,
      }),
    );
  return { ...ranked[0], alternatives: ranked };
```

- [ ] **Step 7: Tests `AiPlayer` : la température remplace l'erreur**

Ajouter à `ai-player.spec.ts` (imports `scenario`, `monsterCard`, `createEngine`, `evaluateLegacy` à compléter si absents) :

```ts
describe('AiPlayer : température', () => {
  const engine = createEngine();
  /** Lame peut tuer Moucheron, sans gagner la partie : le meilleur coup est fini. */
  const position = () =>
    scenario({
      turn: 'p2',
      phase: 'battle',
      p1: {
        monsters: [
          monsterCard('Colosse', { atk: 50, hp: 5000 }),
          monsterCard('Moucheron', { atk: 0, hp: 100 }),
        ],
      },
      p2: {
        primes: 3,
        monsters: [monsterCard('Lame', { atk: 200, hp: 500 })],
      },
    });
  const profile = { archetype: 'pipou' as const, level: 1 as const };

  it('température 0 : le meilleur coup, pas la fin de phase', () => {
    const action = new AiPlayer(engine, () => 0).chooseAction(
      position(),
      'p2',
      profile,
    );
    expect(action.type).not.toBe('end_phase');
  });

  it('très chaud et random 0 : le premier candidat (fin de phase) est tiré', () => {
    const ai = new AiPlayer(engine, () => 0, 'greedy', 1e9);
    expect(ai.chooseAction(position(), 'p2', profile).type).toBe('end_phase');
  });

  it('température limitée aux N premières décisions', () => {
    const ai = new AiPlayer(
      engine,
      () => 0,
      'greedy',
      1e9,
      evaluateLegacy,
      0,
    );
    expect(ai.chooseAction(position(), 'p2', profile).type).not.toBe(
      'end_phase',
    );
  });
});
```

Supprimer de `ai-player.spec.ts` tout test qui passe un `mistakeRate` (rechercher `mistake`).

- [ ] **Step 8: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- ai-player.spec planner.spec`
Expected: FAIL. Le test « très chaud » joue l'attaque, car le 4e paramètre est encore `mistakeRate`.

- [ ] **Step 9: Brancher la température dans `AiPlayer`**

Dans `ai-player.ts` :

1. Ajouter `import { pickSoftmax } from './temperature';`.
2. Remplacer le paramètre `mistakeRate` du constructeur et ajouter le dernier paramètre :

```ts
  constructor(
    private readonly engine: GameEngine,
    private readonly random: () => number,
    /** 'greedy' : un coup à l'avance (aventure) ; sinon, planifie son tour. */
    private readonly thinking: ThinkingProfile | 'greedy' = 'greedy',
    /**
     * Écart de score (points de note) qui rend un coup e fois moins probable
     * qu'un autre. 0 : toujours le meilleur.
     */
    private readonly temperature = 0,
    /** Note des états : la manuelle par défaut. */
    private readonly evaluate: Evaluator = evaluateLegacy,
    /** Décisions jouées avec la température ; ensuite, le meilleur coup (auto-jeu). */
    private readonly temperatureDecisions = Infinity,
  ) {}
```

3. Ajouter le champ `private decided = 0;` à côté de `decisionCount`.
4. Dans `decide`, juste après `if (valid.length === 0) return null;`, ajouter :

```ts
    const temperature =
      this.decided++ < this.temperatureDecisions ? this.temperature : 0;
```

5. Supprimer le bloc `if (this.mistakeRate > 0 && ...) { ... }` en entier.
6. Remplacer `this.planned(game, seat, profile, valid)` par `this.planned(game, seat, profile, valid, temperature)`.
7. Remplacer la partie gloutonne (de `const endPhase = ...` à la fin de `decide`) par :

```ts
    const endPhase = valid.find((v) => v.action.type === 'end_phase');
    const others = valid.filter((v) => v.action.type !== 'end_phase');
    if (others.length === 0) return result(endPhase!.action);
    // Finir sa phase vaut l'état actuel ; en premier : gagne les égalités
    const options: Scored[] = [...others];
    if (endPhase) {
      const current = this.evaluate(known, seat, profile.archetype);
      if (trace) trace.baseline = current;
      options.unshift({
        action: endPhase.action,
        score: current + IMPROVEMENT_EPSILON,
      });
    }
    const top = Math.max(...options.map((o) => o.score));
    const chosen = pickSoftmax(options, (o) => o.score, temperature, this.random);
    return result(chosen.action, chosen.score < top ? 'mistake' : 'greedy');
```

8. Dans `planned`, ajouter le paramètre `temperature: number` et remplacer le bloc après l'appel à `planTurn` :

```ts
    if (!plan) {
      this.plan = null;
      return null;
    }
    const picked = pickSoftmax(
      plan.alternatives,
      (p) => p.score,
      temperature,
      this.random,
    );
    const first = find(picked.keys[0]);
    if (!first) {
      this.plan = null;
      return null;
    }
    this.plan = { ...picked, seat, next: 1 };
    return first;
```

9. Supprimer `MISTAKE_MAX_LOSS` et `plausibleMistake` (fin de fichier).

- [ ] **Step 10: `LevelBrain` et le tournoi passent à la température**

`level-brains.ts` : remplacer `mistakeRate: number` par `temperature: number` dans `LevelBrain`, avec ce commentaire : « Écart de score qui rend un coup e fois moins probable ; 0 : toujours le meilleur. » Puis valeurs :

```ts
export const LEVEL_BRAINS: Record<AiLevel, LevelBrain> = {
  1: { thinking: 'greedy', temperature: 200 },
  2: { thinking: 'greedy', temperature: 100 },
  3: {
    thinking: { beamWidth: 3, depth: 6, ripostes: 0, budget: 1500, timeLimitMs: AI_TIME_LIMIT_MS },
    temperature: 30,
  },
  4: {
    thinking: { beamWidth: 6, depth: 9, ripostes: 0, budget: 4000, timeLimitMs: AI_TIME_LIMIT_MS },
    temperature: 10,
  },
  5: { thinking: { ...STRONGEST, timeLimitMs: AI_TIME_LIMIT_MS }, temperature: 0 },
};
```

Dans `createLevelAi`, remplacer `mistakeRate` par `temperature`.

`tournament.ts` :
- `brainOf` : `temperature: e.temperature ?? brain.temperature` ; `mistakeRate: 0` devient `temperature: 0` aux deux endroits.
- `TournamentEntry` : remplacer `mistakeRate?: number;` par :

```ts
  /** Température du cerveau (voir AiPlayer) ; celle du cerveau par défaut. */
  temperature?: number;
  /** Décisions jouées avec la température (auto-jeu) ; toutes par défaut. */
  temperatureDecisions?: number;
```

- `playGame` : construire `new AiPlayer(engine, random, thinking, temperature, evaluatorOf(note ?? 'legacy'), e.temperatureDecisions ?? Infinity)`.

`selfplay-data.cli.ts` l.49 : `mistakeRate: explore` devient `temperature: explore` (fichier supprimé en tâche 4).

- [ ] **Step 11: Mettre à jour les specs existantes**

- `level-brains.spec.ts`, premier test :

```ts
  it('niveaux 1 et 2 gloutons et chauds, 3 à 5 qui planifient de plus en plus froid', () => {
    expect(LEVEL_BRAINS[1]).toEqual({ thinking: 'greedy', temperature: 200 });
    expect(LEVEL_BRAINS[2]).toEqual({ thinking: 'greedy', temperature: 100 });
    expect(LEVEL_BRAINS[3].temperature).toBeGreaterThan(LEVEL_BRAINS[4].temperature);
    expect(LEVEL_BRAINS[5].temperature).toBe(0);
    // ... garder les assertions sur beamWidth / depth / STRONGEST et timeLimitMs 200
  });
```

  Supprimer la ligne `for (const n of [3, 4, 5] as const) expect(LEVEL_BRAINS[n].mistakeRate).toBe(0);`. Renommer le test « niveau 1 : erreur forcée… » en « niveau 1 : chaud, mais la victoire n’est jamais ratée » ; son corps ne change pas.
- `tournament.spec.ts` :
  - chaque `mistakeRate: 0` devient `temperature: 0` ;
  - `mistakeRate: 0.25` devient `temperature: 200` ;
  - `top.mistakeRate` devient `top.temperature` ;
  - dans « la note et le taux d’erreur de l’entrée priment », `mistakeRate: 0.1` devient `temperature: 7`, avec `expect(brain.temperature).toBe(7)`, et le titre devient « la note et la température de l’entrée priment ».

- [ ] **Step 12: Vérifier**

Run: `pnpm --filter @pipou/backend exec grep -rn "mistakeRate\|plausibleMistake" src` (ou la recherche de l'éditeur)
Expected: aucune ligne.

Run: `pnpm --filter @pipou/backend typecheck; pnpm --filter @pipou/backend test -- src/fights/ai`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add apps/backend/src/fights/ai
git commit -m "feat(ia): la température remplace le taux d'erreur des niveaux"
```

---

### Task 2: Encodeur de position `nn/encode.ts`

**Files:**
- Create: `apps/backend/src/fights/ai/nn/encode.ts`
- Test: `apps/backend/src/fights/ai/nn/encode.spec.ts`

**Interfaces:**
- Consumes: `seatPlayer`, `effectiveAtk` (`helpers/game-state.helper`), `activeChoice` (`ai/candidate-actions`), `inferArchetype` (`ai/planner`).
- Produces:
  - constantes : `ENCODING_VERSION = 1`, `CARD_DIM = 32`, `GLOBAL_DIM = 22`, `STATIC_FROM = 18`, `ARCHETYPES`, `SET_NAMES`, `type SetName`, `SET_SCALE: Record<SetName, number>` ;
  - types : `interface EncodedCard { i: number; x: number[] }`, `interface EncodedPosition { global: number[]; sets: Record<SetName, EncodedCard[]> }`, `interface CompactCard { i: number; x?: number[] }`, `interface CompactPosition { global: number[]; sets: Record<SetName, CompactCard[]> }` ;
  - fonctions : `staticCardFeatures(card: Card): number[]`, `isStaticCard(x: readonly number[]): boolean`, `encodePosition(game, seat, archetype): EncodedPosition`, `compactPosition(pos): CompactPosition`, `expandPosition(pos: CompactPosition, cards: Record<string, number[]>): EncodedPosition`.

Disposition de `x` (32) :
- 0 monstre, 1 support, 2 ATK/1000, 3 PV/1000, 4 coût/10 ;
- 5-8 élément (earth, fire, wind, water) ;
- 9-13 stade (egg, baby, young, adult, ancestral) ;
- 14-17 type de support (EPHEMERAL, EQUIPMENT, PERSISTENT, CHARGE) ;
- **à partir de 18 : état en jeu** :
  - 18 sur le plateau, 19 ATK effective/1000, 20 PV actuels/1000, 21 bonus PV/1000 ;
  - 22 garde, 23 provocation, 24 perçant, 25 réduction/4, 26 immunités/4, 27 attaques restantes/2 ;
  - 28 invoqué ce tour, 29 équipements/3, 30 compteurs de Charge/5, 31 jeton.

Disposition de `global` (22) :
- 0 mon tour, 1 min(tour, 30)/30 ;
- 2-3 primes moi/adv. /6, 4-5 mains /7, 6-7 decks /40, 8-9 cimetières /40, 10 énergie /10 ;
- 11-14 phase (mulligan, main, battle, end), 15 choix en attente pour moi ;
- 16-18 mon archétype, 19-21 archétype adverse (`inferArchetype`).

- [ ] **Step 1: Écrire les tests**

```ts
// apps/backend/src/fights/ai/nn/encode.spec.ts
import { monsterCard } from '../../testing/cards';
import { scenario } from '../../testing/scenario';
import { determinize } from '../determinize';
import { seeded } from '../tournament';
import {
  CARD_DIM,
  GLOBAL_DIM,
  SET_NAMES,
  compactPosition,
  encodePosition,
  expandPosition,
  isStaticCard,
  staticCardFeatures,
} from './encode';

function position() {
  return scenario({
    turn: 'p2',
    phase: 'battle',
    turnNumber: 5,
    p1: {
      primes: 4,
      hand: [monsterCard('Main A'), monsterCard('Main B')],
      deck: [monsterCard('Deck A'), monsterCard('Deck B'), monsterCard('Deck C')],
      monsters: [monsterCard('Colosse', { atk: 50, hp: 5000 })],
    },
    p2: {
      primes: 2,
      hand: [monsterCard('Ma main')],
      monsters: [monsterCard('Lame', { atk: 200, hp: 500 })],
    },
  });
}

describe('encodePosition', () => {
  it('dimensions fixes, 7 ensembles', () => {
    const pos = encodePosition(position(), 'p2', 'pipou');
    expect(pos.global).toHaveLength(GLOBAL_DIM);
    expect(Object.keys(pos.sets)).toEqual([...SET_NAMES]);
    for (const name of SET_NAMES)
      for (const card of pos.sets[name]) expect(card.x).toHaveLength(CARD_DIM);
  });

  it('valeurs attendues : global et monstre sur le plateau', () => {
    const pos = encodePosition(position(), 'p2', 'pipou');
    expect(pos.global[0]).toBe(1); // mon tour
    expect(pos.global[1]).toBeCloseTo(5 / 30);
    expect(pos.global[2]).toBeCloseTo(2 / 6); // mes primes
    expect(pos.global[3]).toBeCloseTo(4 / 6); // primes adverses
    expect(pos.global[4]).toBeCloseTo(1 / 7); // ma main
    expect(pos.global[5]).toBeCloseTo(2 / 7); // main adverse
    expect(pos.global[13]).toBe(1); // phase battle
    expect(pos.global[16]).toBe(1); // moi : pipou
    const [lame] = pos.sets.myMonsters;
    expect(lame.x[0]).toBe(1);
    expect(lame.x[2]).toBeCloseTo(0.2);
    expect(lame.x[3]).toBeCloseTo(0.5);
    expect(lame.x[18]).toBe(1);
    expect(lame.x[20]).toBeCloseTo(0.5);
    expect(pos.sets.oppMonsters).toHaveLength(1);
    expect(pos.sets.myHand).toHaveLength(1);
  });

  it('menace cachée : main + deck + Primes adverses, mon deck restant à part', () => {
    const game = position();
    const pos = encodePosition(game, 'p2', 'pipou');
    const opp = game.player1;
    expect(pos.sets.oppHidden).toHaveLength(
      opp.hand.length + opp.deck.length + opp.primeDeck.length,
    );
    const me = game.player2;
    expect(pos.sets.myRemaining).toHaveLength(me.deck.length + me.primeDeck.length);
  });

  it('la répartition main / deck adverse n’influe pas (seul le multiensemble compte)', () => {
    const game = position();
    const shuffled = determinize(game, 'p2', seeded(3));
    expect(encodePosition(shuffled, 'p2', 'pipou')).toEqual(
      encodePosition(game, 'p2', 'pipou'),
    );
    const swapped = structuredClone(game);
    const opp = swapped.player1;
    [opp.hand[0], opp.deck[0]] = [opp.deck[0], opp.hand[0]];
    expect(encodePosition(swapped, 'p2', 'pipou')).toEqual(
      encodePosition(game, 'p2', 'pipou'),
    );
  });

  it('symétrie : camps inversés, même encodage', () => {
    const game = position();
    const mirrored = { ...game, player1: game.player2, player2: game.player1 };
    expect(encodePosition(mirrored, 'p1', 'pipou')).toEqual(
      encodePosition(game, 'p2', 'pipou'),
    );
  });

  it('cartes hors plateau statiques ; monstre posé dynamique', () => {
    const pos = encodePosition(position(), 'p2', 'pipou');
    for (const card of pos.sets.myHand) expect(isStaticCard(card.x)).toBe(true);
    expect(isStaticCard(pos.sets.myMonsters[0].x)).toBe(false);
  });

  it('compact puis développé : même position (à l’arrondi près)', () => {
    const game = position();
    const pos = encodePosition(game, 'p2', 'pipou');
    const cards: Record<string, number[]> = {};
    for (const p of [game.player1, game.player2])
      for (const c of [...p.hand, ...p.deck, ...p.primeDeck])
        cards[String(c.baseCard.id)] = staticCardFeatures(c.baseCard);
    const back = expandPosition(compactPosition(pos), cards);
    for (const name of SET_NAMES)
      back.sets[name].forEach((card, k) => {
        expect(card.i).toBe(pos.sets[name][k].i);
        card.x.forEach((v, d) => expect(v).toBeCloseTo(pos.sets[name][k].x[d], 4));
      });
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- nn/encode.spec`
Expected: FAIL, `Cannot find module './encode'`.

- [ ] **Step 3: Écrire `encode.ts`**

```ts
// apps/backend/src/fights/ai/nn/encode.ts
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { Card } from '../../../cards/card.entity';
import { effectiveAtk, seatPlayer } from '../../helpers/game-state.helper';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../../interfaces/game-state.interface';
import { activeChoice } from '../candidate-actions';
import { inferArchetype } from '../planner';

/** À incrémenter à chaque changement d'encodage : les poids anciens sont refusés. */
export const ENCODING_VERSION = 1;
export const CARD_DIM = 32;
export const GLOBAL_DIM = 22;
/** Premier indice de l'état en jeu : avant, la carte seule (stats de base). */
export const STATIC_FROM = 18;

export const ARCHETYPES: readonly AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];
const ELEMENTS = ['earth', 'fire', 'wind', 'water'];
const STAGES = ['egg', 'baby', 'young', 'adult', 'ancestral'];
const SUPPORT_TYPES = ['EPHEMERAL', 'EQUIPMENT', 'PERSISTENT', 'CHARGE'];
const PHASES = ['mulligan', 'main', 'battle', 'end'];

export const SET_NAMES = [
  'myMonsters',
  'oppMonsters',
  'mySupports',
  'oppSupports',
  'myHand',
  'myRemaining',
  'oppHidden',
] as const;
export type SetName = (typeof SET_NAMES)[number];

/** Les grands ensembles (decks) pèsent moins par carte : leur somme reste du même ordre. */
export const SET_SCALE: Record<SetName, number> = {
  myMonsters: 1,
  oppMonsters: 1,
  mySupports: 1,
  oppSupports: 1,
  myHand: 1,
  myRemaining: 0.1,
  oppHidden: 0.1,
};

/** Une carte : son identifiant (embedding) et ses caractéristiques. */
export interface EncodedCard {
  i: number;
  x: number[];
}

export interface EncodedPosition {
  global: number[];
  sets: Record<SetName, EncodedCard[]>;
}

/** Carte statique : `x` omis, relu dans la table des cartes. */
export interface CompactCard {
  i: number;
  x?: number[];
}

export interface CompactPosition {
  global: number[];
  sets: Record<SetName, CompactCard[]>;
}

function oneHot(x: number[], from: number, values: readonly string[], value: string | null | undefined): void {
  const k = value == null ? -1 : values.indexOf(value);
  if (k >= 0) x[from + k] = 1;
}

/** Caractéristiques de la carte seule ; l'état en jeu (18 à 31) reste à 0. */
export function staticCardFeatures(card: Card): number[] {
  const x = new Array<number>(CARD_DIM).fill(0);
  x[0] = card.type === 'monster' ? 1 : 0;
  x[1] = card.type === 'support' ? 1 : 0;
  x[2] = card.atk / 1000;
  x[3] = card.hp / 1000;
  x[4] = card.cost / 10;
  oneHot(x, 5, ELEMENTS, card.element);
  oneHot(x, 9, STAGES, card.stage);
  oneHot(x, 14, SUPPORT_TYPES, card.supportType);
  return x;
}

/** Vrai si la carte ne porte aucun état de partie : sa valeur ne dépend que de son id. */
export function isStaticCard(x: readonly number[]): boolean {
  for (let d = STATIC_FROM; d < x.length; d++) if (x[d] !== 0) return false;
  return true;
}

function instanceCard(c: CardInstance): EncodedCard {
  const x = staticCardFeatures(c.baseCard);
  x[30] = (c.chargeCounters ?? 0) / 5;
  x[31] = c.token ? 1 : 0;
  return { i: c.baseCard.id, x };
}

function monsterCard(m: MonsterOnBoard): EncodedCard {
  const { i, x } = instanceCard(m.card);
  x[18] = 1;
  x[19] = effectiveAtk(m) / 1000;
  x[20] = m.currentHp / 1000;
  x[21] = m.hpBuff / 1000;
  x[22] = m.mode === 'guard' ? 1 : 0;
  x[23] = m.hasTaunt ? 1 : 0;
  x[24] = m.hasPiercing ? 1 : 0;
  x[25] = (m.damageReduction ?? 0) / 4;
  x[26] = m.immunities.length / 4;
  x[27] =
    Math.max(0, m.attacksPerTurn + m.extraAttacksThisTurn - m.attacksUsedThisTurn) / 2;
  x[28] = m.summonedThisTurn ? 1 : 0;
  x[29] = m.equipments.length / 3;
  return { i, x };
}

const byId = (a: EncodedCard, b: EncodedCard) => a.i - b.i;

function monsters(p: PlayerGameState): EncodedCard[] {
  return p.monsterZones.flatMap((m) => (m ? [monsterCard(m)] : [])).sort(byId);
}

/** Supports posés et équipements des monstres. */
function supports(p: PlayerGameState): EncodedCard[] {
  const placed = p.supportZones.flatMap((c) => (c ? [instanceCard(c)] : []));
  const equipped = p.monsterZones.flatMap((m) => (m ? m.equipments.map(instanceCard) : []));
  return [...placed, ...equipped].sort(byId);
}

const cards = (list: CardInstance[]) => list.map(instanceCard).sort(byId);

/**
 * Position vue par `seat`, information publique seulement. Les cartes cachées
 * de l'adversaire (main, deck, Primes) forment un seul multiensemble, comme
 * dans `determinize.ts` : l'encodage ne dépend pas de leur répartition.
 */
export function encodePosition(
  game: GameState,
  seat: Seat,
  archetype: AdventureArchetype,
): EncodedPosition {
  const me = seatPlayer(game, seat);
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
  const global = new Array<number>(GLOBAL_DIM).fill(0);
  global[0] = game.currentTurnUserId === me.userId ? 1 : 0;
  global[1] = Math.min(game.turnNumber, 30) / 30;
  global[2] = me.primes / 6;
  global[3] = opp.primes / 6;
  global[4] = me.hand.length / 7;
  global[5] = opp.hand.length / 7;
  global[6] = me.deck.length / 40;
  global[7] = opp.deck.length / 40;
  global[8] = me.graveyard.length / 40;
  global[9] = opp.graveyard.length / 40;
  global[10] = me.recycleEnergy / 10;
  oneHot(global, 11, PHASES, game.phase);
  global[15] = activeChoice(game)?.forUserId === me.userId ? 1 : 0;
  oneHot(global, 16, ARCHETYPES, archetype);
  oneHot(global, 19, ARCHETYPES, inferArchetype(opp));
  return {
    global,
    sets: {
      myMonsters: monsters(me),
      oppMonsters: monsters(opp),
      mySupports: supports(me),
      oppSupports: supports(opp),
      myHand: cards(me.hand),
      myRemaining: cards([...me.deck, ...me.primeDeck]),
      oppHidden: cards([...opp.hand, ...opp.deck, ...opp.primeDeck]),
    },
  };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Forme écrite sur disque : `x` arrondi, omis pour une carte statique. */
export function compactPosition(pos: EncodedPosition): CompactPosition {
  const sets = {} as Record<SetName, CompactCard[]>;
  for (const name of SET_NAMES)
    sets[name] = pos.sets[name].map((c) =>
      isStaticCard(c.x) ? { i: c.i } : { i: c.i, x: c.x.map(round4) },
    );
  return { global: pos.global.map(round4), sets };
}

/** Inverse de `compactPosition` ; `cards` donne `x` des cartes statiques par id. */
export function expandPosition(
  pos: CompactPosition,
  cards: Record<string, number[]>,
): EncodedPosition {
  const sets = {} as Record<SetName, EncodedCard[]>;
  for (const name of SET_NAMES)
    sets[name] = pos.sets[name].map((c) => {
      const x = c.x ?? cards[String(c.i)];
      if (!x) throw new Error(`Carte ${c.i} absente de la table des cartes`);
      return { i: c.i, x };
    });
  return { global: pos.global, sets };
}
```

Le test « cartes statiques » exige que `chargeCounters` et `token` soient absents en main ; c'est le cas des instances créées par `scenario`.

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `pnpm --filter @pipou/backend test -- nn/encode.spec`
Expected: PASS (7 tests). Si « symétrie » échoue à cause de `matchId` ou des journaux, comparer seulement `encodePosition(...)` : c'est déjà le cas.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/fights/ai/nn
git commit -m "feat(ia): encodeur de position pour le réseau de neurones"
```

---

### Task 3: Poids et inférence TypeScript (`weights.ts`, `mlp.ts`)

**Files:**
- Create:
  - `apps/backend/src/fights/ai/nn/weights.ts`
  - `apps/backend/src/fights/ai/nn/mlp.ts`
  - `apps/backend/src/fights/testing/nn-weights.ts`
  - `apps/backend/src/fights/ai/nn/weights/.gitkeep` (vide)
- Test: `apps/backend/src/fights/ai/nn/mlp.spec.ts`, `apps/backend/src/fights/ai/nn/weights.spec.ts`

**Interfaces:**
- Consumes: Tâche 2 (`CARD_DIM`, `GLOBAL_DIM`, `SET_NAMES`, `SET_SCALE`, `ENCODING_VERSION`, `isStaticCard`, `expandPosition`, `EncodedPosition`, `EncodedCard`, `CompactPosition`).
- Produces:
  - `weights.ts` :
    - constantes `EMBED_DIM = 8`, `CARD_HIDDEN = 64`, `CARD_OUT = 32`, `HEAD_HIDDEN = 128` ;
    - `interface DenseLayer { w: number[][]; b: number[] }` ;
    - `interface NnWeights { encodingVersion; generation; trainedAt; positions; valLoss; cardIndex: Record<string, number>; layers: { emb: number[][]; card1; card2; head1; head2; out: DenseLayer }; parity?: ParityBlock }` ;
    - `interface ParityBlock { cards: Record<string, number[]>; positions: CompactPosition[]; values: number[] }` ;
    - `CHAMPION_PATH`, `validateWeights(w): void`, `readWeights(path): NnWeights`, `loadChampion(path?): { weights: NnWeights } | { reason: string }`.
  - `mlp.ts` : `class NnModel { constructor(w: NnWeights); value(pos: EncodedPosition): number }`, `PARITY_TOLERANCE = 1e-5`, `parityError(w: NnWeights): number`.
  - `testing/nn-weights.ts` : `randomWeights(seed: number, cardIds?: number[], scale?: number): NnWeights`, `zeroWeights(cardIds?: number[]): NnWeights`.

- [ ] **Step 1: Écrire l'aide de test `testing/nn-weights.ts`**

```ts
// apps/backend/src/fights/testing/nn-weights.ts
import { CARD_DIM, ENCODING_VERSION, GLOBAL_DIM, SET_NAMES } from '../ai/nn/encode';
import { CARD_HIDDEN, CARD_OUT, EMBED_DIM, HEAD_HIDDEN } from '../ai/nn/weights';
import type { DenseLayer, NnWeights } from '../ai/nn/weights';

/** Générateur déterministe (mulberry32), sans dépendre du moteur. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Poids aléatoires de forme valide (tests). Ligne 0 de l'embedding : carte inconnue, à 0. */
export function randomWeights(seed: number, cardIds: number[] = [], scale = 0.1): NnWeights {
  const r = mulberry32(seed);
  const v = () => (r() * 2 - 1) * scale;
  const dense = (out: number, inp: number): DenseLayer => ({
    w: Array.from({ length: out }, () => Array.from({ length: inp }, v)),
    b: Array.from({ length: out }, v),
  });
  return {
    encodingVersion: ENCODING_VERSION,
    generation: 0,
    trainedAt: 'test',
    positions: 0,
    valLoss: 0,
    cardIndex: Object.fromEntries(cardIds.map((id, k) => [String(id), k + 1])),
    layers: {
      emb: [
        new Array<number>(EMBED_DIM).fill(0),
        ...cardIds.map(() => Array.from({ length: EMBED_DIM }, v)),
      ],
      card1: dense(CARD_HIDDEN, CARD_DIM + EMBED_DIM),
      card2: dense(CARD_OUT, CARD_HIDDEN),
      head1: dense(HEAD_HIDDEN, GLOBAL_DIM + SET_NAMES.length * CARD_OUT),
      head2: dense(HEAD_HIDDEN, HEAD_HIDDEN),
      out: dense(1, HEAD_HIDDEN),
    },
  };
}

export function zeroWeights(cardIds: number[] = []): NnWeights {
  return randomWeights(0, cardIds, 0);
}
```

- [ ] **Step 2: Écrire les tests de `mlp.ts`**

```ts
// apps/backend/src/fights/ai/nn/mlp.spec.ts
import { zeroWeights, randomWeights } from '../../testing/nn-weights';
import { CARD_DIM, GLOBAL_DIM, SET_NAMES } from './encode';
import type { EncodedCard, EncodedPosition, SetName } from './encode';
import { NnModel } from './mlp';
import { CARD_OUT } from './weights';

function card(i: number, atk: number, onBoard = true): EncodedCard {
  const x = new Array<number>(CARD_DIM).fill(0);
  x[2] = atk;
  if (onBoard) x[18] = 1;
  return { i, x };
}

function position(sets: Partial<Record<SetName, EncodedCard[]>>): EncodedPosition {
  const all = Object.fromEntries(SET_NAMES.map((n) => [n, sets[n] ?? []]));
  return {
    global: new Array<number>(GLOBAL_DIM).fill(0),
    sets: all as Record<SetName, EncodedCard[]>,
  };
}

/** Réseau qui calcule tanh(somme des x[2] de l'ensemble k, × son échelle). */
function sumAtkOfSet(k: number) {
  const w = zeroWeights([1, 2]);
  w.layers.card1.w[0][2] = 1;
  w.layers.card2.w[0][0] = 1;
  w.layers.head1.w[0][GLOBAL_DIM + k * CARD_OUT] = 1;
  w.layers.head2.w[0][0] = 1;
  w.layers.out.w[0][0] = 1;
  return w;
}

describe('NnModel', () => {
  it('poids nuls : tanh du biais de sortie', () => {
    const w = zeroWeights();
    w.layers.out.b[0] = 0.5;
    expect(new NnModel(w).value(position({}))).toBeCloseTo(Math.tanh(0.5), 12);
  });

  it('calcul à la main : somme des ATK de mes monstres', () => {
    const model = new NnModel(sumAtkOfSet(0));
    const pos = position({ myMonsters: [card(1, 0.2), card(2, 0.3)] });
    expect(model.value(pos)).toBeCloseTo(Math.tanh(0.5), 12);
  });

  it('échelle de l’ensemble : mon deck restant compte pour 0,1', () => {
    const k = SET_NAMES.indexOf('myRemaining');
    const model = new NnModel(sumAtkOfSet(k));
    const pos = position({ myRemaining: [card(1, 0.2, false), card(2, 0.3, false)] });
    expect(model.value(pos)).toBeCloseTo(Math.tanh(0.05), 12);
  });

  it('ordre des cartes sans effet (somme)', () => {
    const model = new NnModel(randomWeights(7, [1, 2]));
    const a = position({ oppMonsters: [card(1, 0.2), card(2, 0.3)] });
    const b = position({ oppMonsters: [card(2, 0.3), card(1, 0.2)] });
    expect(model.value(a)).toBeCloseTo(model.value(b), 12);
  });

  it('carte inconnue : embedding de la ligne 0', () => {
    const w = randomWeights(3, [1]);
    w.layers.emb[1] = [...w.layers.emb[0]];
    const model = new NnModel(w);
    const known = position({ myHand: [card(1, 0.2, false)] });
    const unknown = position({ myHand: [card(999, 0.2, false)] });
    expect(model.value(unknown)).toBeCloseTo(model.value(known), 12);
  });

  it('cache des cartes statiques : même valeur au second appel', () => {
    const model = new NnModel(randomWeights(5, [1, 2]));
    const pos = position({ myHand: [card(1, 0.2, false), card(1, 0.2, false)] });
    expect(model.value(pos)).toBe(model.value(pos));
  });
});
```

- [ ] **Step 3: Écrire les tests de `weights.ts`**

```ts
// apps/backend/src/fights/ai/nn/weights.spec.ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomWeights } from '../../testing/nn-weights';
import { loadChampion, validateWeights } from './weights';

describe('weights', () => {
  it('poids de forme valide acceptés', () => {
    expect(() => validateWeights(randomWeights(1, [1, 2]))).not.toThrow();
  });

  it('version d’encodage différente : refusée', () => {
    const w = { ...randomWeights(1), encodingVersion: 999 };
    expect(() => validateWeights(w)).toThrow(/encodage/);
  });

  it('couche de mauvaise taille : refusée', () => {
    const w = randomWeights(1);
    w.layers.head1.w[0].pop();
    expect(() => validateWeights(w)).toThrow(/head1/);
  });

  it('loadChampion : fichier absent ou invalide → raison', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nn-'));
    expect(loadChampion(join(dir, 'absent.json'))).toEqual({
      reason: expect.stringContaining('absent') as string,
    });
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify({ ...randomWeights(1), encodingVersion: 999 }));
    expect('reason' in loadChampion(bad)).toBe(true);
    const good = join(dir, 'good.json');
    writeFileSync(good, JSON.stringify(randomWeights(1)));
    expect('weights' in loadChampion(good)).toBe(true);
  });
});
```

- [ ] **Step 4: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- nn/mlp.spec nn/weights.spec`
Expected: FAIL, modules introuvables.

- [ ] **Step 5: Écrire `weights.ts`**

```ts
// apps/backend/src/fights/ai/nn/weights.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CARD_DIM, ENCODING_VERSION, GLOBAL_DIM, SET_NAMES } from './encode';
import type { CompactPosition } from './encode';

export const EMBED_DIM = 8;
export const CARD_HIDDEN = 64;
export const CARD_OUT = 32;
export const HEAD_HIDDEN = 128;

/** Couche linéaire au format PyTorch : w[sortie][entrée]. */
export interface DenseLayer {
  w: number[][];
  b: number[];
}

/** Positions et sorties PyTorch figées à l'export : l'inférence TS doit les retrouver. */
export interface ParityBlock {
  /** `x` des cartes statiques utilisées, par id. */
  cards: Record<string, number[]>;
  positions: CompactPosition[];
  values: number[];
}

export interface NnWeights {
  encodingVersion: number;
  generation: number;
  trainedAt: string;
  /** Positions d'entraînement. */
  positions: number;
  /** Perte MSE de validation. */
  valLoss: number;
  /** id de carte → ligne de l'embedding (0 : carte inconnue). */
  cardIndex: Record<string, number>;
  layers: {
    emb: number[][];
    card1: DenseLayer;
    card2: DenseLayer;
    head1: DenseLayer;
    head2: DenseLayer;
    out: DenseLayer;
  };
  parity?: ParityBlock;
}

/** Champion déployé ; copié dans dist par nest-cli (assets). */
export const CHAMPION_PATH = join(__dirname, 'weights', 'champion.json');

/** Lève si les poids ne correspondent pas à l'encodage ou au réseau actuels. */
export function validateWeights(w: NnWeights): void {
  const who = `Poids génération ${w.generation}`;
  if (w.encodingVersion !== ENCODING_VERSION)
    throw new Error(`${who} : encodage ${w.encodingVersion}, attendu ${ENCODING_VERSION}, il faut réentraîner`);
  const check = (name: string, l: DenseLayer, out: number, inp: number) => {
    if (l.b.length !== out || l.w.length !== out || l.w.some((row) => row.length !== inp))
      throw new Error(`${who} : couche ${name} de taille inattendue (attendu ${out}×${inp})`);
  };
  check('card1', w.layers.card1, CARD_HIDDEN, CARD_DIM + EMBED_DIM);
  check('card2', w.layers.card2, CARD_OUT, CARD_HIDDEN);
  check('head1', w.layers.head1, HEAD_HIDDEN, GLOBAL_DIM + SET_NAMES.length * CARD_OUT);
  check('head2', w.layers.head2, HEAD_HIDDEN, HEAD_HIDDEN);
  check('out', w.layers.out, 1, HEAD_HIDDEN);
  const rows = w.layers.emb.length;
  if (rows === 0 || w.layers.emb.some((row) => row.length !== EMBED_DIM))
    throw new Error(`${who} : embedding de taille inattendue`);
  for (const [id, row] of Object.entries(w.cardIndex))
    if (!Number.isInteger(row) || row < 1 || row >= rows)
      throw new Error(`${who} : carte ${id} hors de l'embedding (ligne ${row})`);
}

export function readWeights(path: string): NnWeights {
  const w = JSON.parse(readFileSync(path, 'utf8')) as NnWeights;
  validateWeights(w);
  return w;
}

/** Le champion, ou la raison pour laquelle il est inutilisable. */
export function loadChampion(path: string = CHAMPION_PATH): { weights: NnWeights } | { reason: string } {
  if (!existsSync(path)) return { reason: `fichier absent (${path})` };
  try {
    return { weights: readWeights(path) };
  } catch (err) {
    return { reason: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 6: Écrire `mlp.ts`**

```ts
// apps/backend/src/fights/ai/nn/mlp.ts
import { CARD_DIM, GLOBAL_DIM, SET_NAMES, SET_SCALE, expandPosition, isStaticCard } from './encode';
import type { EncodedCard, EncodedPosition } from './encode';
import { CARD_OUT, EMBED_DIM } from './weights';
import type { DenseLayer, NnWeights } from './weights';

/** Écart max toléré entre PyTorch et cette inférence. */
export const PARITY_TOLERANCE = 1e-5;

function dense(layer: DenseLayer, input: ArrayLike<number>, relu: boolean): Float64Array {
  const out = new Float64Array(layer.b.length);
  for (let o = 0; o < out.length; o++) {
    const row = layer.w[o];
    let s = layer.b[o];
    for (let k = 0; k < row.length; k++) s += row[k] * input[k];
    out[o] = relu && s < 0 ? 0 : s;
  }
  return out;
}

/**
 * Réseau de valeur, même calcul que `tools/ai-train/model.py` : encodeur de
 * carte partagé, somme par ensemble × échelle, MLP, tanh. Le vecteur d'une
 * carte statique ne dépend que de son id : calculé une fois.
 */
export class NnModel {
  private readonly cache = new Map<number, Float64Array>();

  constructor(private readonly w: NnWeights) {}

  private cardVector(card: EncodedCard): Float64Array {
    const isStatic = isStaticCard(card.x);
    if (isStatic) {
      const hit = this.cache.get(card.i);
      if (hit) return hit;
    }
    const input = new Float64Array(CARD_DIM + EMBED_DIM);
    input.set(card.x);
    input.set(this.w.layers.emb[this.w.cardIndex[String(card.i)] ?? 0], CARD_DIM);
    const hidden = dense(this.w.layers.card1, input, true);
    const out = dense(this.w.layers.card2, hidden, true);
    if (isStatic) this.cache.set(card.i, out);
    return out;
  }

  /** Valeur dans [−1, 1] pour le joueur de la position. */
  value(pos: EncodedPosition): number {
    const z = new Float64Array(GLOBAL_DIM + SET_NAMES.length * CARD_OUT);
    z.set(pos.global);
    SET_NAMES.forEach((name, k) => {
      const base = GLOBAL_DIM + k * CARD_OUT;
      for (const card of pos.sets[name]) {
        const v = this.cardVector(card);
        for (let d = 0; d < CARD_OUT; d++) z[base + d] += v[d];
      }
      for (let d = 0; d < CARD_OUT; d++) z[base + d] *= SET_SCALE[name];
    });
    const h1 = dense(this.w.layers.head1, z, true);
    const h2 = dense(this.w.layers.head2, h1, true);
    return Math.tanh(dense(this.w.layers.out, h2, false)[0]);
  }
}

/** Plus grand écart entre cette inférence et les sorties PyTorch figées. */
export function parityError(w: NnWeights): number {
  if (!w.parity) throw new Error(`Poids génération ${w.generation} sans bloc de parité`);
  const model = new NnModel(w);
  const { cards, positions, values } = w.parity;
  let worst = 0;
  positions.forEach((p, k) => {
    worst = Math.max(worst, Math.abs(model.value(expandPosition(p, cards)) - values[k]));
  });
  return worst;
}
```

- [ ] **Step 7: Lancer, vérifier le succès**

Run: `pnpm --filter @pipou/backend test -- nn/mlp.spec nn/weights.spec`
Expected: PASS (10 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/fights/ai/nn apps/backend/src/fights/testing/nn-weights.ts
git commit -m "feat(ia): inférence du réseau de valeur en TypeScript"
```

---

### Task 4: Note réseau, `note.ts` et suppression de la note linéaire

**Files:**
- Create: `apps/backend/src/fights/ai/nn/nn-eval.ts`, `apps/backend/src/fights/ai/note.ts`
- Test: `apps/backend/src/fights/ai/nn/nn-eval.spec.ts`, `apps/backend/src/fights/ai/note.spec.ts`
- Delete:
  - `features.ts`, `features.spec.ts`
  - `learned-eval.ts`, `learned-eval.spec.ts`, `learned-weights.ts`
  - `train.ts`, `train.spec.ts`, `train.cli.ts`
  - `selfplay-data.ts`, `selfplay-data.spec.ts`, `selfplay-data.cli.ts`
  - (tous dans `apps/backend/src/fights/ai/`)
- Modify:
  - `level-brains.ts`, `tournament.ts`, `tournament-jobs.ts`, `tournament-generated.cli.ts` (l.4, l.60-65)
  - `ai-explain.cli.ts` (l.3), `ai-regret.cli.ts` (l.4)
  - specs `tournament.spec.ts` (l.14-15, l.180-195), `tournament-jobs.spec.ts` (l.93-96), `level-brains.spec.ts`
  - `apps/backend/package.json` : retirer `ai:selfplay-data` et `ai:train`

**Interfaces:**
- Consumes: Tâche 2 (`encodePosition`), Tâche 3 (`NnModel`, `NnWeights`, `loadChampion`, `readWeights`, `CHAMPION_PATH`).
- Produces:
  - `nn-eval.ts` : `NN_SCALE = 1000`, `nnEvaluator(w: NnWeights): Evaluator` ;
  - `note.ts` : `type Note = 'legacy' | 'nn' | NnWeights`, `championOrLegacy(path?: string): Evaluator`, `evaluatorOf(note: Note): Evaluator`, `defaultNote(): Note`, `parseNote(raw: string | undefined, fallback: Note): Note`.

- [ ] **Step 1: Écrire les tests**

```ts
// apps/backend/src/fights/ai/nn/nn-eval.spec.ts
import { seatPlayer } from '../../helpers/game-state.helper';
import { monsterCard } from '../../testing/cards';
import { randomWeights } from '../../testing/nn-weights';
import { scenario } from '../../testing/scenario';
import { NN_SCALE, nnEvaluator } from './nn-eval';

const game = () =>
  scenario({ p1: { monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] } });

describe('nnEvaluator', () => {
  const evaluate = nnEvaluator(randomWeights(11));

  it('position en cours : valeur finie dans [−1000, 1000]', () => {
    const v = evaluate(game(), 'p1', 'pipou');
    expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(v)).toBeLessThanOrEqual(NN_SCALE);
  });

  it('fin de partie : ±Infinity, nul −10 000', () => {
    const won = game();
    won.phase = 'finished';
    won.winner = seatPlayer(won, 'p1').userId;
    expect(evaluate(won, 'p1', 'pipou')).toBe(Infinity);
    expect(evaluate(won, 'p2', 'pipou')).toBe(-Infinity);
    const draw = game();
    draw.phase = 'finished';
    expect(evaluate(draw, 'p1', 'pipou')).toBe(-10 * NN_SCALE);
  });
});
```

```ts
// apps/backend/src/fights/ai/note.spec.ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomWeights } from '../testing/nn-weights';
import { evaluateLegacy } from './evaluate';
import { championOrLegacy, defaultNote, evaluatorOf, parseNote } from './note';

describe('note', () => {
  const dir = mkdtempSync(join(tmpdir(), 'note-'));

  it('legacy : la note manuelle', () => {
    expect(evaluatorOf('legacy')).toBe(evaluateLegacy);
  });

  it('champion absent ou de version différente : repli sur la manuelle', () => {
    expect(championOrLegacy(join(dir, 'absent.json'))).toBe(evaluateLegacy);
    const old = join(dir, 'old.json');
    writeFileSync(old, JSON.stringify({ ...randomWeights(1), encodingVersion: 999 }));
    expect(championOrLegacy(old)).toBe(evaluateLegacy);
  });

  it('champion valide : note réseau', () => {
    const good = join(dir, 'good.json');
    writeFileSync(good, JSON.stringify(randomWeights(1)));
    expect(championOrLegacy(good)).not.toBe(evaluateLegacy);
  });

  it('AI_EVAL : nn par défaut, legacy sur demande', () => {
    const saved = process.env.AI_EVAL;
    delete process.env.AI_EVAL;
    expect(defaultNote()).toBe('nn');
    process.env.AI_EVAL = 'legacy';
    expect(defaultNote()).toBe('legacy');
    if (saved === undefined) delete process.env.AI_EVAL;
    else process.env.AI_EVAL = saved;
  });

  it('parseNote : mots-clés, fichier .json, erreur sinon', () => {
    expect(parseNote(undefined, 'legacy')).toBe('legacy');
    expect(parseNote('nn', 'legacy')).toBe('nn');
    const file = join(dir, 'w.json');
    writeFileSync(file, JSON.stringify(randomWeights(2)));
    expect(parseNote(file, 'legacy')).toMatchObject({ generation: 0 });
    expect(() => parseNote('learned', 'legacy')).toThrow(/inconnue/);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- nn-eval.spec note.spec`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Écrire `nn-eval.ts` et `note.ts`**

```ts
// apps/backend/src/fights/ai/nn/nn-eval.ts
import { seatPlayer } from '../../helpers/game-state.helper';
import type { Evaluator } from '../evaluate';
import { encodePosition } from './encode';
import { NnModel } from './mlp';
import type { NnWeights } from './weights';

/** Valeur × 1000 : même ordre de grandeur que la note manuelle (MODE_TOLL, températures). */
export const NN_SCALE = 1000;
/** Partie nulle : à éviter, sans valoir une défaite. */
const DRAW = -10 * NN_SCALE;

export function nnEvaluator(w: NnWeights): Evaluator {
  const model = new NnModel(w);
  return (game, seat, archetype) => {
    if (game.phase === 'finished') {
      const me = seatPlayer(game, seat).userId;
      if (game.winner === me) return Infinity;
      if (game.winner != null) return -Infinity;
      return DRAW;
    }
    return NN_SCALE * model.value(encodePosition(game, seat, archetype));
  };
}
```

```ts
// apps/backend/src/fights/ai/note.ts
import { Logger } from '@nestjs/common';
import { evaluateLegacy } from './evaluate';
import type { Evaluator } from './evaluate';
import { nnEvaluator } from './nn/nn-eval';
import { CHAMPION_PATH, loadChampion, readWeights } from './nn/weights';
import type { NnWeights } from './nn/weights';

/** La note d'un cerveau : la manuelle, le champion réseau déployé, ou des poids donnés (essai). */
export type Note = 'legacy' | 'nn' | NnWeights;

const logger = new Logger('NoteIA');

/** Le champion, ou la note manuelle (avec un avertissement) s'il est absent ou périmé. */
export function championOrLegacy(path: string = CHAMPION_PATH): Evaluator {
  const loaded = loadChampion(path);
  if ('weights' in loaded) return nnEvaluator(loaded.weights);
  logger.warn(`Note réseau indisponible, repli sur la note manuelle : ${loaded.reason}`);
  return evaluateLegacy;
}

let champion: Evaluator | undefined;

export function evaluatorOf(note: Note): Evaluator {
  if (note === 'legacy') return evaluateLegacy;
  if (note === 'nn') return (champion ??= championOrLegacy());
  return nnEvaluator(note);
}

/** Note des niveaux d'aventure : `AI_EVAL=legacy` revient à la manuelle. */
export function defaultNote(): Note {
  return process.env.AI_EVAL === 'legacy' ? 'legacy' : 'nn';
}

/** `legacy`, `nn`, ou le chemin d'un fichier de poids `.json` (outils en ligne de commande). */
export function parseNote(raw: string | undefined, fallback: Note): Note {
  if (raw === undefined) return fallback;
  if (raw === 'legacy' || raw === 'nn') return raw;
  if (raw.endsWith('.json')) return readWeights(raw);
  throw new Error(`Note inconnue « ${raw} » (legacy, nn, fichier .json)`);
}
```

- [ ] **Step 4: Rebrancher les importeurs, supprimer la note linéaire**

1. Supprimer les 11 fichiers listés plus haut :
   `git rm apps/backend/src/fights/ai/{features,features.spec,learned-eval,learned-eval.spec,learned-weights,train,train.spec,train.cli,selfplay-data,selfplay-data.spec,selfplay-data.cli}.ts`
2. Dans `level-brains.ts`, `tournament.ts`, `tournament-jobs.ts`, `tournament-generated.cli.ts`, `ai-explain.cli.ts` et `ai-regret.cli.ts`, remplacer `from './learned-eval'` par `from './note'`.
3. `level-brains.ts` : `createLevelAi` utilise `evaluatorOf(note ?? defaultNote())`, avec `defaultNote` importé de `./note`.
4. `tournament-generated.cli.ts`, calcul de `noteTag` :

```ts
  const noteTag =
    note === 'legacy' ? '' : note === 'nn' ? '-reseau' : `-gen${note.generation}`;
```

5. `tournament-jobs.spec.ts` l.93-96 : `'learned'` devient `'nn'`.
6. `tournament.spec.ts` : supprimer les imports `FEATURE_NAMES` et `LearnedWeights`, ajouter `import { randomWeights } from '../testing/nn-weights';` et remplacer le bloc `const custom: LearnedWeights = {...}` par `const custom = randomWeights(9);`.
7. `level-brains.spec.ts` : remplacer le test « tant que la note apprise n’est pas adoptée… » par :

```ts
  it('aucun niveau ne fixe sa note : AI_EVAL décide (réseau par défaut)', () => {
    for (const level of [1, 2, 3, 4, 5] as const)
      expect(LEVEL_BRAINS[level].note).toBeUndefined();
  });
```

   Dans le test « niveau 3 : même coup que le planificateur de son profil », construire la référence avec la même note :
   `new AiPlayer(engine, () => 0, LEVEL_BRAINS[3].thinking, LEVEL_BRAINS[3].temperature, evaluatorOf(defaultNote()))`.
8. `apps/backend/package.json` : supprimer les lignes `"ai:selfplay-data"` et `"ai:train"`.

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/backend typecheck; pnpm --filter @pipou/backend lint; pnpm --filter @pipou/backend test -- src/fights`
Expected: PASS. Une recherche de `learned` dans `apps/backend/src` ne renvoie plus que des commentaires sans rapport, ou rien.

- [ ] **Step 6: Commit**

```bash
git add -A apps/backend
git commit -m "feat(ia): note réseau branchée, note linéaire supprimée"
```

---

### Task 5: Auto-jeu `ai:selfplay`

**Files:**
- Create:
  - `apps/backend/src/fights/ai/nn/shards.ts`
  - `apps/backend/src/fights/ai/nn/selfplay.ts`
  - `apps/backend/src/fights/ai/nn/selfplay.cli.ts`
- Test: `apps/backend/src/fights/ai/nn/selfplay.spec.ts`
- Modify: `apps/backend/package.json` (script `ai:selfplay`)

**Interfaces:**
- Consumes:
  - `playGame`, `MAX_ACTIONS`, `seeded`, `TournamentEntry` (`tournament.ts`), avec `temperature` et `temperatureDecisions` de la tâche 1 ;
  - `buildGeneratedEntries` ;
  - `determinize`, `aiMustAct` ;
  - `encodePosition`, `compactPosition`, `staticCardFeatures` et les constantes de la tâche 2 ;
  - `Note` (tâche 4).
- Produces:
  - `shards.ts` : `arg(name): string | undefined`, `num(name, fallback): number`, `forkShards(script: string, args: string[], workers: number): Promise<void>` ;
  - `selfplay.ts` :
    - `interface NnSample extends CompactPosition { g: number; v: number; y: number }` ;
    - `interface SelfplayGame { g: number; p1: TournamentEntry; p2: TournamentEntry; seed: number }` ;
    - `interface SelfplayOptions { games: number; seed: number; note: Note; budget: number; temperature: number; exploreDecisions: number }` ;
    - `SAMPLES_PER_KIND = 4`, `planSelfplay(cards: Card[], o: SelfplayOptions): SelfplayGame[]`, `collectGame(game: SelfplayGame): NnSample[]` ;
    - `selfplayMeta(cards: Card[]): SelfplayMeta`.
  - Dossier de sortie : `part-<k>.jsonl.gz`, `part-<k>.json` (`{ games, positions }`), `meta.json`, puis `done.json` (`{ games, positions, seconds }`) écrit en dernier.

`meta.json` : `{ encodingVersion, globalDim, cardDim, sets: string[], setScale: number[], cards: Record<string, number[]> }`.

- [ ] **Step 1: Écrire les tests**

```ts
// apps/backend/src/fights/ai/nn/selfplay.spec.ts
import { allRealCards } from '../../testing/real-cards';
import { CARD_DIM, ENCODING_VERSION, GLOBAL_DIM, SET_NAMES } from './encode';
import { collectGame, planSelfplay, selfplayMeta, SAMPLES_PER_KIND } from './selfplay';

const options = {
  games: 3,
  seed: 4,
  note: 'legacy' as const,
  budget: 150,
  temperature: 50,
  exploreDecisions: 8,
};

describe('auto-jeu', () => {
  const cards = allRealCards();

  it('plan déterministe, deux decks différents, planificateur au budget donné', () => {
    const a = planSelfplay(cards, options);
    const b = planSelfplay(cards, options);
    expect(a.map((g) => [g.p1.name, g.p2.name, g.seed])).toEqual(
      b.map((g) => [g.p1.name, g.p2.name, g.seed]),
    );
    expect(a).toHaveLength(3);
    for (const g of a) {
      expect(g.p1.brain).toBe('plan');
      expect(g.p1.thinking).toEqual({ budget: 150 });
      expect(g.p1.temperatureDecisions).toBe(8);
      expect(g.p1.deck).not.toBe(g.p2.deck);
    }
  });

  it('une partie : positions au format, résultat ±1 ou 0, au plus 4 par joueur et par sorte', () => {
    const [game] = planSelfplay(cards, options);
    const samples = collectGame(game);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.length).toBeLessThanOrEqual(2 * 2 * SAMPLES_PER_KIND);
    for (const s of samples) {
      expect(s.g).toBe(game.g);
      expect(s.v).toBe(ENCODING_VERSION);
      expect([-1, 0, 1]).toContain(s.y);
      expect(s.global).toHaveLength(GLOBAL_DIM);
      expect(Object.keys(s.sets)).toEqual([...SET_NAMES]);
    }
    // deux camps : des étiquettes opposées (ou 0 et 0 en cas de nul)
    const labels = new Set(samples.map((s) => s.y));
    expect(labels.has(1) === labels.has(-1)).toBe(true);
  }, 60_000);

  it('meta : dimensions et x statique de chaque carte', () => {
    const meta = selfplayMeta(cards);
    expect(meta.globalDim).toBe(GLOBAL_DIM);
    expect(meta.cardDim).toBe(CARD_DIM);
    expect(meta.sets).toEqual([...SET_NAMES]);
    expect(Object.keys(meta.cards)).toHaveLength(new Set(cards.map((c) => c.id)).size);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- nn/selfplay.spec`
Expected: FAIL, `Cannot find module './selfplay'`.

- [ ] **Step 3: Écrire `shards.ts`**

```ts
// apps/backend/src/fights/ai/nn/shards.ts
import { fork } from 'node:child_process';
import { extname } from 'node:path';

/** Valeur de `--name` sur la ligne de commande. */
export function arg(name: string): string | undefined {
  const k = process.argv.indexOf(`--${name}`);
  return k >= 0 ? process.argv[k + 1] : undefined;
}

export function num(name: string, fallback: number): number {
  const raw = arg(name);
  return raw === undefined ? fallback : Number(raw);
}

/**
 * Relance `script` dans `workers` processus, chacun avec `--shard k --shards n`
 * en plus de `args`. Rejette si un processus échoue.
 */
export async function forkShards(script: string, args: string[], workers: number): Promise<void> {
  const ts = extname(script) === '.ts';
  await Promise.all(
    Array.from(
      { length: workers },
      (_, shard) =>
        new Promise<void>((resolve, reject) => {
          const child = fork(script, [...args, '--shard', String(shard), '--shards', String(workers)], {
            execArgv: ts ? ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'] : [],
            env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
          });
          child.once('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`Processus ${shard} arrêté (code ${code})`)),
          );
        }),
    ),
  );
}
```

- [ ] **Step 4: Écrire `selfplay.ts`**

```ts
// apps/backend/src/fights/ai/nn/selfplay.ts
import type { Seat } from '@pipou/shared';
import type { Card } from '../../../cards/card.entity';
import { seatPlayer } from '../../helpers/game-state.helper';
import type { GameState } from '../../interfaces/game-state.interface';
import { aiMustAct } from '../ai-player';
import { determinize } from '../determinize';
import { buildGeneratedEntries } from '../generated-entries';
import type { Note } from '../note';
import { MAX_ACTIONS, playGame, seeded } from '../tournament';
import type { TournamentEntry } from '../tournament';
import {
  CARD_DIM,
  ENCODING_VERSION,
  GLOBAL_DIM,
  SET_NAMES,
  SET_SCALE,
  compactPosition,
  encodePosition,
  staticCardFeatures,
} from './encode';
import type { CompactPosition } from './encode';

/** Une position, vue par un joueur, étiquetée par le résultat de sa partie. */
export interface NnSample extends CompactPosition {
  /** Rang de la partie : sert à mettre des parties entières en validation. */
  g: number;
  /** ENCODING_VERSION. */
  v: number;
  /** +1 victoire, −1 défaite, 0 sans vainqueur. */
  y: number;
}

export interface SelfplayGame {
  g: number;
  p1: TournamentEntry;
  p2: TournamentEntry;
  seed: number;
}

export interface SelfplayOptions {
  games: number;
  seed: number;
  note: Note;
  /** Nœuds du planificateur par décision (la cible vient du résultat, pas de la recherche). */
  budget: number;
  /** Température des premières décisions : variété des parties. */
  temperature: number;
  exploreDecisions: number;
}

/** Positions gardées par joueur, par partie et par sorte (milieu ou fin de tour). */
export const SAMPLES_PER_KIND = 4;
/** Graines de decks de l'auto-jeu ; 1 à 30 : contrôles, 5001+ : arène. */
const FIRST_DECK_SEED = 101;
const DECK_SEEDS = 500;

/** Parties de la génération, dans un ordre qui ne dépend pas du nombre de processus. */
export function planSelfplay(cards: Card[], o: SelfplayOptions): SelfplayGame[] {
  const decks = new Map<number, TournamentEntry[]>();
  const brain = (e: TournamentEntry): TournamentEntry => ({
    ...e,
    brain: 'plan',
    thinking: { budget: o.budget },
    note: o.note,
    temperature: o.temperature,
    temperatureDecisions: o.exploreDecisions,
  });
  const out: SelfplayGame[] = [];
  for (let g = 0; g < o.games; g++) {
    const r = seeded(o.seed * 1_000_003 + g);
    const deckSeed = FIRST_DECK_SEED + Math.floor(r() * DECK_SEEDS);
    let entries = decks.get(deckSeed);
    if (!entries) {
      entries = buildGeneratedEntries(cards, deckSeed);
      decks.set(deckSeed, entries);
    }
    const i = Math.floor(r() * entries.length);
    let j = Math.floor(r() * (entries.length - 1));
    if (j >= i) j++;
    out.push({ g, p1: brain(entries[i]), p2: brain(entries[j]), seed: Math.floor(r() * 2 ** 31) });
  }
  return out;
}

interface Reservoir {
  seen: number;
  kept: CompactPosition[];
}

/**
 * Joue une partie et en tire des positions, vues par le joueur qui vient de
 * jouer, sur une copie déterminisée. Le tirage des positions a son propre
 * générateur : la partie est la même avec ou sans collecte.
 */
export function collectGame(game: SelfplayGame): NnSample[] {
  const pick = seeded(game.seed ^ 0x51ed270b);
  const entry = { p1: game.p1, p2: game.p2 };
  const pools: Record<Seat, Record<'end' | 'mid', Reservoir>> = {
    p1: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
    p2: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
  };
  const observe = (state: GameState, seat: Seat) => {
    // Une fin de partie n'a pas besoin d'être apprise : elle vaut ±Infinity
    if (state.phase === 'finished') return;
    const kind = aiMustAct(state, seatPlayer(state, seat).userId) ? 'mid' : 'end';
    const pool = pools[seat][kind];
    pool.seen++;
    // Échantillonnage par réservoir : chaque position a la même chance
    let slot = pool.kept.length;
    if (slot >= SAMPLES_PER_KIND) {
      slot = Math.floor(pick() * pool.seen);
      if (slot >= SAMPLES_PER_KIND) return;
    }
    pool.kept[slot] = compactPosition(
      encodePosition(determinize(state, seat, pick), seat, entry[seat].archetype),
    );
  };
  const { winner } = playGame(game.p1, game.p2, game.seed, MAX_ACTIONS, undefined, observe);
  const label = (seat: Seat) =>
    winner === null ? 0 : (winner === 0) === (seat === 'p1') ? 1 : -1;
  const out: NnSample[] = [];
  for (const s of ['p1', 'p2'] as const)
    for (const kind of ['end', 'mid'] as const)
      for (const pos of pools[s][kind].kept)
        out.push({ g: game.g, v: ENCODING_VERSION, ...pos, y: label(s) });
  return out;
}

export interface SelfplayMeta {
  encodingVersion: number;
  globalDim: number;
  cardDim: number;
  sets: string[];
  setScale: number[];
  /** x statique de chaque carte, par id : Python ne réimplémente pas l'encodage. */
  cards: Record<string, number[]>;
}

export function selfplayMeta(cards: Card[]): SelfplayMeta {
  return {
    encodingVersion: ENCODING_VERSION,
    globalDim: GLOBAL_DIM,
    cardDim: CARD_DIM,
    sets: [...SET_NAMES],
    setScale: SET_NAMES.map((n) => SET_SCALE[n]),
    cards: Object.fromEntries(cards.map((c) => [String(c.id), staticCardFeatures(c)])),
  };
}
```

- [ ] **Step 5: Écrire `selfplay.cli.ts` et le script**

```ts
// apps/backend/src/fights/ai/nn/selfplay.cli.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { allRealCards } from '../../testing/real-cards';
import { parseNote } from '../note';
import { collectGame, planSelfplay, selfplayMeta } from './selfplay';
import { arg, forkShards, num } from './shards';

/**
 * Parties d'auto-jeu pour l'entraînement du réseau.
 *
 *   pnpm --filter @pipou/backend ai:selfplay <dossier> --games 1500
 *     [--seed 1] [--note legacy|nn|poids.json] [--budget 2000]
 *     [--temperature 50] [--explore-decisions 8] [--workers N]
 *
 * Écrit part-<k>.jsonl.gz par processus, meta.json, puis done.json en dernier.
 */
function options() {
  return {
    games: num('games', 100),
    seed: num('seed', 1),
    note: parseNote(arg('note'), 'legacy'),
    budget: num('budget', 2000),
    temperature: num('temperature', 50),
    exploreDecisions: num('explore-decisions', 8),
  };
}

function runShard(dir: string, shard: number, shards: number): void {
  const games = planSelfplay(allRealCards(), options()).filter((g) => g.g % shards === shard);
  const lines: string[] = [];
  for (const game of games) for (const s of collectGame(game)) lines.push(JSON.stringify(s));
  writeFileSync(join(dir, `part-${shard}.jsonl.gz`), gzipSync(lines.length ? `${lines.join('\n')}\n` : ''));
  writeFileSync(join(dir, `part-${shard}.json`), JSON.stringify({ games: games.length, positions: lines.length }));
}

async function main(): Promise<void> {
  const raw = process.argv[2];
  if (!raw || raw.startsWith('--')) throw new Error('Usage : ai:selfplay <dossier> [options]');
  const dir = resolve(raw);
  const shard = arg('shard');
  if (shard !== undefined) {
    runShard(dir, Number(shard), num('shards', 1));
    return;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(selfplayMeta(allRealCards())));
  const workers = num('workers', Math.max(1, cpus().length - 1));
  const started = Date.now();
  await forkShards(__filename, [dir, ...process.argv.slice(3)], workers);
  let games = 0;
  let positions = 0;
  for (let k = 0; k < workers; k++) {
    const part = JSON.parse(readFileSync(join(dir, `part-${k}.json`), 'utf8')) as { games: number; positions: number };
    games += part.games;
    positions += part.positions;
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  writeFileSync(join(dir, 'done.json'), JSON.stringify({ games, positions, seconds }));
  console.log(`${positions} positions de ${games} parties en ${seconds} s : ${dir}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

`package.json`, dans `scripts`, après `ai:regret` :

```json
    "ai:selfplay": "ts-node -T -r tsconfig-paths/register src/fights/ai/nn/selfplay.cli.ts",
```

- [ ] **Step 6: Lancer les tests et un essai réel**

Run: `pnpm --filter @pipou/backend test -- nn/selfplay.spec`
Expected: PASS (3 tests).

Run: `pnpm --filter @pipou/backend ai:selfplay ../../tools/ai-train/data/essai --games 8 --budget 200 --workers 2`
Expected: une ligne `… positions de 8 parties en … s`. Le dossier contient `part-0.jsonl.gz`, `part-1.jsonl.gz`, `meta.json` et `done.json`. Supprimer ce dossier ensuite.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/fights/ai/nn apps/backend/package.json
git commit -m "feat(ia): auto-jeu qui écrit des positions encodées"
```

---

### Task 6: Arène `ai:arena`

**Files:**
- Create:
  - `apps/backend/src/fights/ai/nn/stats.ts`
  - `apps/backend/src/fights/ai/nn/arena.ts`
  - `apps/backend/src/fights/ai/nn/arena.cli.ts`
- Test: `apps/backend/src/fights/ai/nn/stats.spec.ts`, `apps/backend/src/fights/ai/nn/arena.spec.ts`
- Modify: `apps/backend/package.json` (script `ai:arena`)

**Interfaces:**
- Consumes: `playGame`, `MAX_ACTIONS`, `seeded`, `TournamentEntry`, `buildGeneratedEntries`, `Note`, `parseNote`, `AiLevel`, `forkShards`, `arg`, `num`.
- Produces:
  - `stats.ts` : `wilson(successes: number, n: number, z?: number): { lower: number; upper: number }` ;
  - `arena.ts` :
    - `type Side = Note | { level: AiLevel }`, `parseSide(raw: string): Side` ;
    - `interface ArenaSettings { challenger: Side; champion: Side; budget: number; timeMs?: number }` ;
    - `interface ArenaPair { k: number; deckSeed: number; i: number; j: number; seed: number }` ;
    - `type Outcome = 'win' | 'loss' | 'draw'` (du point de vue du challenger) ;
    - `planArena(pairs: number, seed: number): ArenaPair[]`, `playPair(cards: Card[], pair: ArenaPair, s: ArenaSettings): [Outcome, Outcome]` ;
    - `interface ArenaVerdict { games; wins; losses; draws; score; lower; upper }`, `verdict(outcomes: Outcome[]): ArenaVerdict`.

- [ ] **Step 1: Écrire les tests**

```ts
// apps/backend/src/fights/ai/nn/stats.spec.ts
import { wilson } from './stats';

describe('wilson', () => {
  it('55 % sur 400 : borne basse juste au-dessus de 50 %', () => {
    const { lower, upper } = wilson(220, 400);
    expect(lower).toBeCloseTo(0.501, 3);
    expect(upper).toBeCloseTo(0.598, 3);
  });

  it('aucune partie : intervalle [0, 1]', () => {
    expect(wilson(0, 0)).toEqual({ lower: 0, upper: 1 });
  });
});
```

```ts
// apps/backend/src/fights/ai/nn/arena.spec.ts
import { allRealCards } from '../../testing/real-cards';
import { parseSide, planArena, playPair, verdict } from './arena';

describe('arène', () => {
  it('paires déterministes, decks distincts, graines d’arène 5001+', () => {
    const a = planArena(5, 1);
    expect(a).toEqual(planArena(5, 1));
    for (const p of a) {
      expect(p.deckSeed).toBeGreaterThanOrEqual(5001);
      expect(p.i).not.toBe(p.j);
    }
  });

  it('même cerveau des deux côtés, decks miroirs : résultats opposés ou nuls', () => {
    const [pair] = planArena(1, 2);
    const s = { challenger: 'legacy' as const, champion: 'legacy' as const, budget: 150 };
    const [a, b] = playPair(allRealCards(), pair, s);
    // Même cerveau, même graine : la partie B est la partie A, rôles échangés
    const flip = { win: 'loss', loss: 'win', draw: 'draw' } as const;
    expect(b).toBe(flip[a]);
  }, 60_000);

  it('verdict : nul = demi-victoire, borne de Wilson', () => {
    const v = verdict(['win', 'win', 'loss', 'draw']);
    expect(v).toMatchObject({ games: 4, wins: 2, losses: 1, draws: 1, score: 0.625 });
    expect(v.lower).toBeLessThan(0.625);
  });

  it('parseSide : niveau ou note', () => {
    expect(parseSide('level:4')).toEqual({ level: 4 });
    expect(parseSide('legacy')).toBe('legacy');
    expect(() => parseSide('level:9')).toThrow();
  });
});
```

Le test « résultats opposés » repose sur ceci : la partie B rejoue la partie A, avec le même cerveau, les mêmes decks aux mêmes sièges et la même graine. Seule l'étiquette challenger/champion change de siège, donc le résultat est inversé.

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- nn/stats.spec nn/arena.spec`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Écrire `stats.ts` et `arena.ts`**

```ts
// apps/backend/src/fights/ai/nn/stats.ts
/** Intervalle de Wilson (95 % par défaut) d'une proportion de succès. */
export function wilson(successes: number, n: number, z = 1.96): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { lower: (center - margin) / denom, upper: (center + margin) / denom };
}
```

```ts
// apps/backend/src/fights/ai/nn/arena.ts
import type { Card } from '../../../cards/card.entity';
import type { AiLevel } from '../ai-player';
import { buildGeneratedEntries } from '../generated-entries';
import { parseNote } from '../note';
import type { Note } from '../note';
import { MAX_ACTIONS, playGame, seeded } from '../tournament';
import type { TournamentEntry } from '../tournament';
import { wilson } from './stats';

/** Un cerveau d'arène : le planificateur fort avec une note, ou un niveau d'aventure (note réseau). */
export type Side = Note | { level: AiLevel };

export function parseSide(raw: string): Side {
  const m = /^level:(\d)$/.exec(raw);
  if (m) {
    const level = Number(m[1]);
    if (level < 1 || level > 5) throw new Error(`Niveau inconnu « ${raw} » (level:1 à level:5)`);
    return { level: level as AiLevel };
  }
  return parseNote(raw, 'legacy');
}

export interface ArenaSettings {
  challenger: Side;
  champion: Side;
  /** Nœuds par décision du planificateur fort. */
  budget: number;
  /** Temps par décision : comparaison à temps égal (jauge). */
  timeMs?: number;
}

export interface ArenaPair {
  k: number;
  deckSeed: number;
  i: number;
  j: number;
  seed: number;
}

/** Du point de vue du challenger. */
export type Outcome = 'win' | 'loss' | 'draw';

/** Decks jamais vus en auto-jeu (101 à 600). */
const FIRST_DECK_SEED = 5001;

export function planArena(pairs: number, seed: number): ArenaPair[] {
  return Array.from({ length: pairs }, (_, k) => {
    const r = seeded(seed * 1_000_003 + k);
    const i = Math.floor(r() * 15);
    let j = Math.floor(r() * 14);
    if (j >= i) j++;
    return { k, deckSeed: FIRST_DECK_SEED + k, i, j, seed: Math.floor(r() * 2 ** 31) };
  });
}

function entry(base: TournamentEntry, side: Side, s: ArenaSettings, name: string): TournamentEntry {
  if (typeof side === 'object' && 'level' in side)
    return { ...base, name, brain: 'level', level: side.level, note: 'nn' };
  return {
    ...base,
    name,
    brain: 'plan',
    thinking: { budget: s.budget, ...(s.timeMs !== undefined && { timeLimitMs: s.timeMs }) },
    note: side,
  };
}

/**
 * Deux parties, même graine : le challenger joue le deck i en p1, puis le
 * deck j en p2. Chaque cerveau joue chaque deck et chaque siège une fois.
 */
export function playPair(cards: Card[], pair: ArenaPair, s: ArenaSettings): [Outcome, Outcome] {
  const decks = buildGeneratedEntries(cards, pair.deckSeed);
  const [di, dj] = [decks[pair.i], decks[pair.j]];
  const outcome = (winner: 0 | 1 | null, challengerSeat: 0 | 1): Outcome =>
    winner === null ? 'draw' : winner === challengerSeat ? 'win' : 'loss';
  const a = playGame(entry(di, s.challenger, s, 'challenger'), entry(dj, s.champion, s, 'champion'), pair.seed, MAX_ACTIONS);
  const b = playGame(entry(di, s.champion, s, 'champion'), entry(dj, s.challenger, s, 'challenger'), pair.seed, MAX_ACTIONS);
  return [outcome(a.winner, 0), outcome(b.winner, 1)];
}

export interface ArenaVerdict {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** (victoires + nuls / 2) / parties. */
  score: number;
  lower: number;
  upper: number;
}

export function verdict(outcomes: Outcome[]): ArenaVerdict {
  const count = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const [wins, losses, draws] = [count('win'), count('loss'), count('draw')];
  const games = outcomes.length;
  const points = wins + draws / 2;
  return { games, wins, losses, draws, score: games ? points / games : 0, ...wilson(points, games) };
}
```

- [ ] **Step 4: Écrire `arena.cli.ts` et le script**

```ts
// apps/backend/src/fights/ai/nn/arena.cli.ts
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { allRealCards } from '../../testing/real-cards';
import { parseSide, planArena, playPair, verdict } from './arena';
import type { Outcome } from './arena';
import { arg, forkShards, num } from './shards';

/**
 * Challenger contre champion, decks miroirs.
 *
 *   pnpm --filter @pipou/backend ai:arena --challenger poids.json --champion legacy
 *     [--games 400] [--seed 1] [--budget 2000] [--time-ms 200] [--workers N] [--json sortie.json]
 *
 * Un côté : legacy, nn, un fichier de poids .json, ou level:1 à level:5.
 */
function settings() {
  const challenger = arg('challenger');
  const champion = arg('champion');
  if (!challenger || !champion) throw new Error('Usage : ai:arena --challenger <côté> --champion <côté> [options]');
  const time = arg('time-ms');
  return {
    challenger: parseSide(challenger),
    champion: parseSide(champion),
    budget: num('budget', 2000),
    ...(time !== undefined && { timeMs: Number(time) }),
  };
}

const pairs = () => planArena(Math.ceil(num('games', 400) / 2), num('seed', 1));

function runShard(out: string, shard: number, shards: number): void {
  const s = settings();
  const cards = allRealCards();
  const part = `${out}.part${shard}`;
  writeFileSync(part, '');
  for (const pair of pairs().filter((p) => p.k % shards === shard))
    appendFileSync(part, `${JSON.stringify(playPair(cards, pair, s))}\n`);
}

async function main(): Promise<void> {
  const out = resolve(arg('json') ?? join(tmpdir(), `arena-${Date.now()}.json`));
  const shard = arg('shard');
  if (shard !== undefined) {
    runShard(out, Number(shard), num('shards', 1));
    return;
  }
  settings(); // erreurs d'arguments avant de lancer les processus
  const workers = Math.min(num('workers', Math.max(1, cpus().length - 1)), pairs().length);
  const args = process.argv.slice(2).filter((_, k, all) => all[k] !== '--json' && all[k - 1] !== '--json');
  await forkShards(__filename, [...args, '--json', out], workers);
  const outcomes: Outcome[] = [];
  for (let k = 0; k < workers; k++) {
    for (const line of readFileSync(`${out}.part${k}`, 'utf8').split('\n'))
      if (line) outcomes.push(...(JSON.parse(line) as Outcome[]));
    rmSync(`${out}.part${k}`);
  }
  const v = verdict(outcomes);
  writeFileSync(out, JSON.stringify(v, null, 2));
  console.log(
    `Arène : ${(v.score * 100).toFixed(1)} % sur ${v.games} parties (${v.wins} V, ${v.losses} D, ${v.draws} N), Wilson [${(v.lower * 100).toFixed(1)} ; ${(v.upper * 100).toFixed(1)}] : ${out}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

`package.json` :

```json
    "ai:arena": "ts-node -T -r tsconfig-paths/register src/fights/ai/nn/arena.cli.ts",
```

- [ ] **Step 5: Lancer les tests et un essai**

Run: `pnpm --filter @pipou/backend test -- nn/stats.spec nn/arena.spec`
Expected: PASS (6 tests).

Run: `pnpm --filter @pipou/backend ai:arena --challenger legacy --champion legacy --games 4 --budget 200 --workers 2`
Expected: une ligne `Arène : 50.0 % sur 4 parties …`. Le score vaut exactement 50 %, car c'est le même cerveau en miroir.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/fights/ai/nn apps/backend/package.json
git commit -m "feat(ia): arène champion contre challenger en decks miroirs"
```

---

### Task 7: Parité en ligne de commande `ai:check-weights`

**Files:**
- Create: `apps/backend/src/fights/ai/nn/check-weights.cli.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Consumes: `readWeights` (tâche 3), `parityError` et `PARITY_TOLERANCE` (tâche 3).
- Produces: `ai:check-weights <poids.json>`. Code de sortie 0 si l'écart est ≤ 1e-5, sinon 1. La sortie est une ligne `Parité génération N : écart max E (OK|REFUSÉ)`.

- [ ] **Step 1: Écrire le CLI**

```ts
// apps/backend/src/fights/ai/nn/check-weights.cli.ts
import { PARITY_TOLERANCE, parityError } from './mlp';
import { readWeights } from './weights';

/**
 * Vérifie qu'un fichier de poids est lisible et que l'inférence TypeScript
 * retrouve les sorties PyTorch figées à l'export.
 *
 *   pnpm --filter @pipou/backend ai:check-weights <poids.json>
 */
const path = process.argv[2];
if (!path) {
  console.error('Usage : ai:check-weights <poids.json>');
  process.exit(1);
}
try {
  const w = readWeights(path);
  const error = parityError(w);
  const ok = error <= PARITY_TOLERANCE;
  console.log(`Parité génération ${w.generation} : écart max ${error.toExponential(2)} (${ok ? 'OK' : 'REFUSÉ'})`);
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
```

`package.json` :

```json
    "ai:check-weights": "ts-node -T -r tsconfig-paths/register src/fights/ai/nn/check-weights.cli.ts",
```

- [ ] **Step 2: Vérifier sur des poids sans parité**

Run: `pnpm --filter @pipou/backend ai:check-weights does-not-exist.json`
Expected: message `ENOENT …`, code de sortie 1. La vérification positive se fait en tâche 9, avec le premier vrai export.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/fights/ai/nn/check-weights.cli.ts apps/backend/package.json
git commit -m "feat(ia): commande de vérification de parité des poids"
```

---

### Task 8: Réseau et données côté Python

**Files:**
- Create:
  - `tools/ai-train/requirements.txt`
  - `tools/ai-train/model.py`
  - `tools/ai-train/dataset.py`
  - `tools/ai-train/tests/conftest.py`
  - `tools/ai-train/tests/fake_data.py`
  - `tools/ai-train/tests/test_model.py`
  - `tools/ai-train/tests/test_dataset.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: le format `meta.json` et les lignes `NnSample` de la tâche 5.
- Produces:
  - `dataset.py` :
    - `Meta` (`load(path)`, champs `encoding_version`, `global_dim`, `card_dim`, `set_names`, `set_scale`, `card_ids`, `row_of`, `static_x`) ;
    - `Sample` (`g`, `glob`, `counts`, `dyn_set`, `dyn_row`, `dyn_id`, `dyn_x`, `y`) ;
    - `parse(obj, meta) -> Sample`, `sample_files(dirs) -> list[Path]`, `load_samples(paths, meta) -> list[Sample]`, `split_by_game(samples) -> (train, val)`, `collate(samples, meta, dtype=torch.float32) -> dict[str, Tensor]`, `to_compact(sample, meta) -> dict`.
  - `model.py` : constantes `EMBED_DIM`, `CARD_HIDDEN`, `CARD_OUT`, `HEAD_HIDDEN` ; `ValueNet(static_x: Tensor, global_dim: int, set_scale: list[float])` avec `forward(batch) -> Tensor[B]`.
  - `tests/fake_data.py` : `fake_meta() -> Meta`, `fake_line(g, y, *, dyn=False) -> dict`.

- [ ] **Step 1: Environnement Python**

`tools/ai-train/requirements.txt` :

```
--extra-index-url https://download.pytorch.org/whl/cpu
torch==2.5.1
numpy==2.1.3
matplotlib==3.9.2
pytest==8.3.3
jupyter==1.1.1
```

Ajouter à `.gitignore` :

```
# entraînement de l'IA
tools/ai-train/.venv/
tools/ai-train/data/
tools/ai-train/runs/
__pycache__/
.ipynb_checkpoints/
```

Run (dans `tools/ai-train`) : `py -3.12 -m venv .venv; .venv/Scripts/python -m pip install -r requirements.txt`
Expected: installation sans erreur. Si `py -3.12` est introuvable, installer Python 3.12 depuis python.org (case « py launcher » cochée) puis recommencer.

- [ ] **Step 2: Écrire les données de test**

```python
# tools/ai-train/tests/conftest.py
# Rend les modules de tools/ai-train importables depuis les tests.
import sys  # liste des chemins où Python cherche les modules
from pathlib import Path  # manipulation de chemins indépendante du système

# Ajoute le dossier parent (tools/ai-train) en tête de la recherche de modules.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

```python
# tools/ai-train/tests/fake_data.py
# Petites données inventées, de la même forme que celles écrites par ai:selfplay.
import numpy as np  # calcul sur tableaux

from dataset import Meta  # description des données (dimensions, cartes)

# Les 7 ensembles, dans l'ordre de nn/encode.ts.
SETS = ["myMonsters", "oppMonsters", "mySupports", "oppSupports", "myHand", "myRemaining", "oppHidden"]


def fake_meta() -> Meta:
    # Trois cartes (ids 10, 20, 30) aux caractéristiques simples.
    cards = {}
    for k, card_id in enumerate([10, 20, 30]):
        x = [0.0] * 32  # 32 caractéristiques, toutes à 0
        x[0] = 1.0  # c'est un monstre
        x[2] = 0.1 * (k + 1)  # ATK / 1000 différente pour chaque carte
        cards[str(card_id)] = x
    # Même structure que meta.json.
    return Meta.from_json({
        "encodingVersion": 1,
        "globalDim": 22,
        "cardDim": 32,
        "sets": SETS,
        "setScale": [1, 1, 1, 1, 1, 0.1, 0.1],
        "cards": cards,
    })


def fake_line(g: int, y: int, *, dyn: bool = False) -> dict:
    # Une position : 2 cartes en main, 3 cartes cachées adverses.
    sets = {name: [] for name in SETS}
    sets["myHand"] = [{"i": 10}, {"i": 20}]
    sets["oppHidden"] = [{"i": 30}, {"i": 30}, {"i": 10}]
    if dyn:
        # Un monstre sur le plateau : x complet (état en jeu non nul).
        x = [0.0] * 32
        x[0], x[2], x[18], x[20] = 1.0, 0.2, 1.0, 0.5
        sets["myMonsters"] = [{"i": 20, "x": x}]
    glob = list(np.linspace(0, 1, 22))  # 22 valeurs globales quelconques
    return {"g": g, "v": 1, "global": glob, "sets": sets, "y": y}
```

- [ ] **Step 3: Écrire les tests**

```python
# tools/ai-train/tests/test_dataset.py
# Tests de lecture des positions et de construction des lots.
import gzip  # fichiers .gz
import json  # format JSON

import pytest  # cadre de test
import torch  # tenseurs

from dataset import collate, load_samples, parse, split_by_game, to_compact
from fake_data import fake_line, fake_meta


def test_parse_compte_les_cartes_statiques():
    meta = fake_meta()
    s = parse(fake_line(0, 1), meta)
    # oppHidden (ensemble 6) : la carte 30 deux fois, la 10 une fois.
    counts = {(int(a), int(b)): int(c) for a, b, c in s.counts}
    assert counts[(6, meta.row_of[30])] == 2
    assert counts[(6, meta.row_of[10])] == 1
    assert len(s.dyn_row) == 0  # aucune carte dynamique


def test_parse_garde_les_cartes_dynamiques():
    s = parse(fake_line(0, 1, dyn=True), fake_meta())
    assert list(s.dyn_set) == [0]  # myMonsters
    assert s.dyn_x.shape == (1, 32)


def test_parse_refuse_une_autre_version():
    line = fake_line(0, 1)
    line["v"] = 2
    with pytest.raises(ValueError):
        parse(line, fake_meta())


def test_split_par_partie_sans_fuite():
    meta = fake_meta()
    samples = [parse(fake_line(g, 1), meta) for g in range(30) for _ in range(3)]
    train, val = split_by_game(samples)
    train_games = {s.g for s in train}
    val_games = {s.g for s in val}
    assert val_games == {0, 10, 20}
    assert not train_games & val_games  # aucune partie des deux côtés


def test_collate_formes():
    meta = fake_meta()
    batch = collate([parse(fake_line(0, 1, dyn=True), meta), parse(fake_line(1, -1), meta)], meta)
    assert batch["global"].shape == (2, 22)
    assert batch["counts"].shape == (2, 7, 4)  # 3 cartes + ligne 0
    assert batch["dyn_x"].shape == (2, 1, 32)
    assert batch["dyn_mask"].tolist() == [[1.0], [0.0]]
    assert batch["y"].tolist() == [1.0, -1.0]


def test_lecture_gzip_et_retour_au_format_compact(tmp_path):
    meta = fake_meta()
    path = tmp_path / "part-0.jsonl.gz"
    with gzip.open(path, "wt", encoding="utf-8") as f:
        f.write(json.dumps(fake_line(3, 1, dyn=True)) + "\n")
    [s] = load_samples([path], meta)
    compact = to_compact(s, meta)
    assert sorted(c["i"] for c in compact["sets"]["oppHidden"]) == [10, 30, 30]
    assert compact["sets"]["myMonsters"][0]["i"] == 20
```

```python
# tools/ai-train/tests/test_model.py
# Tests du réseau de valeur.
import torch  # tenseurs

from dataset import collate, parse
from fake_data import fake_line, fake_meta
from model import ValueNet


def make_model(meta):
    torch.manual_seed(0)  # poids initiaux reproductibles
    return ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)


def test_sortie_dans_moins_un_un():
    meta = fake_meta()
    batch = collate([parse(fake_line(g, 1, dyn=g % 2 == 0), meta) for g in range(5)], meta)
    out = make_model(meta)(batch)
    assert out.shape == (5,)
    assert bool(((out > -1) & (out < 1)).all())


def test_carte_statique_comptee_ou_listee_meme_valeur():
    # Une carte statique peut passer par les comptes ou par la liste dynamique :
    # la somme DeepSets doit donner le même résultat (l'inférence TS s'appuie dessus).
    meta = fake_meta()
    counted = fake_line(0, 1)
    listed = fake_line(0, 1)
    listed["sets"]["myHand"] = [{"i": 10, "x": meta.static_x[meta.row_of[10]].tolist()}, {"i": 20}]
    model = make_model(meta).double()
    a = model(collate([parse(counted, meta)], meta, dtype=torch.float64))
    b = model(collate([parse(listed, meta)], meta, dtype=torch.float64))
    assert torch.allclose(a, b, atol=1e-12)


def test_ordre_des_cartes_sans_effet():
    meta = fake_meta()
    line = fake_line(0, 1)
    reverse = fake_line(0, 1)
    reverse["sets"]["oppHidden"] = list(reversed(reverse["sets"]["oppHidden"]))
    model = make_model(meta)
    a = model(collate([parse(line, meta)], meta))
    b = model(collate([parse(reverse, meta)], meta))
    assert torch.allclose(a, b)


def test_nombre_de_parametres_raisonnable():
    model = make_model(fake_meta())
    total = sum(p.numel() for p in model.parameters())
    assert 40_000 < total < 70_000
```

- [ ] **Step 4: Lancer, vérifier l'échec**

Run (dans `tools/ai-train`) : `.venv/Scripts/python -m pytest -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'dataset'`.

- [ ] **Step 5: Écrire `dataset.py`**

```python
# tools/ai-train/dataset.py
"""Lecture des positions d'auto-jeu (JSONL.gz) et mise en lots pour PyTorch.

Une position contient 7 ensembles de cartes. Une carte « statique » (hors
plateau) n'est écrite que par son id : ses caractéristiques sont dans
meta.json. Pour aller vite, ces cartes sont comptées (combien de fois chaque
carte dans chaque ensemble) ; les cartes « dynamiques » (sur le plateau) gardent
leur vecteur x complet.
"""
from __future__ import annotations  # annotations de type modernes

import gzip  # lecture des fichiers .gz
import json  # format JSON
from dataclasses import dataclass  # classes de données simples
from pathlib import Path  # chemins de fichiers

import numpy as np  # tableaux numériques
import torch  # tenseurs PyTorch


@dataclass
class Meta:
    """Ce que l'auto-jeu dit de l'encodage : dimensions et cartes connues."""

    encoding_version: int  # doit égaler ENCODING_VERSION côté TypeScript
    global_dim: int  # taille du vecteur global (22)
    card_dim: int  # taille du vecteur d'une carte (32)
    set_names: list[str]  # noms des 7 ensembles, dans l'ordre
    set_scale: list[float]  # poids de chaque ensemble dans la somme
    card_ids: list[int]  # id de carte de chaque ligne (ligne r = card_ids[r - 1])
    row_of: dict[int, int]  # id de carte -> ligne de l'embedding (0 = inconnue)
    static_x: np.ndarray  # x statique de chaque ligne, ligne 0 à zéro

    @staticmethod
    def from_json(data: dict) -> "Meta":
        ids = sorted(int(k) for k in data["cards"])  # ordre stable des cartes
        static_x = np.zeros((len(ids) + 1, data["cardDim"]), dtype=np.float32)  # +1 : ligne 0
        for row, card_id in enumerate(ids, start=1):  # les lignes commencent à 1
            static_x[row] = data["cards"][str(card_id)]  # copie le vecteur de la carte
        return Meta(
            encoding_version=data["encodingVersion"],
            global_dim=data["globalDim"],
            card_dim=data["cardDim"],
            set_names=list(data["sets"]),
            set_scale=[float(s) for s in data["setScale"]],
            card_ids=ids,
            row_of={card_id: row for row, card_id in enumerate(ids, start=1)},
            static_x=static_x,
        )

    @staticmethod
    def load(path: Path | str) -> "Meta":
        return Meta.from_json(json.loads(Path(path).read_text(encoding="utf-8")))  # lit meta.json


@dataclass
class Sample:
    """Une position prête pour le réseau."""

    g: int  # rang de la partie (séparation entraînement / validation)
    glob: np.ndarray  # vecteur global, float32 [global_dim]
    counts: np.ndarray  # cartes statiques : lignes (ensemble, ligne, nombre), int64 [k, 3]
    dyn_set: np.ndarray  # ensemble de chaque carte dynamique, int64 [d]
    dyn_row: np.ndarray  # ligne d'embedding de chaque carte dynamique, int64 [d]
    dyn_id: np.ndarray  # id d'origine de chaque carte dynamique, int64 [d]
    dyn_x: np.ndarray  # vecteur de chaque carte dynamique, float32 [d, card_dim]
    y: float  # résultat : +1 victoire, -1 défaite, 0 nul


def parse(obj: dict, meta: Meta) -> Sample:
    """Convertit une ligne JSON en Sample."""
    if obj["v"] != meta.encoding_version:  # données d'un autre encodage : inutilisables
        raise ValueError(f"position encodée en version {obj['v']}, attendu {meta.encoding_version}")
    counts: dict[tuple[int, int], int] = {}  # (ensemble, ligne) -> nombre de cartes
    dyn_set, dyn_row, dyn_id, dyn_x = [], [], [], []  # cartes dynamiques, colonne par colonne
    for s, name in enumerate(meta.set_names):  # pour chaque ensemble, dans l'ordre
        for card in obj["sets"][name]:  # pour chaque carte de l'ensemble
            row = meta.row_of.get(card["i"])  # sa ligne d'embedding, None si inconnue
            if "x" in card:  # carte dynamique : vecteur fourni
                dyn_set.append(s)
                dyn_row.append(row or 0)  # inconnue -> ligne 0, comme en TypeScript
                dyn_id.append(card["i"])
                dyn_x.append(card["x"])
            elif row is None:  # statique mais absente de meta.json : impossible à encoder
                raise ValueError(f"carte {card['i']} absente de meta.json")
            else:  # statique : on compte
                counts[(s, row)] = counts.get((s, row), 0) + 1
    return Sample(
        g=int(obj["g"]),
        glob=np.asarray(obj["global"], dtype=np.float32),
        counts=np.asarray([(s, r, c) for (s, r), c in counts.items()], dtype=np.int64).reshape(-1, 3),
        dyn_set=np.asarray(dyn_set, dtype=np.int64),
        dyn_row=np.asarray(dyn_row, dtype=np.int64),
        dyn_id=np.asarray(dyn_id, dtype=np.int64),
        dyn_x=np.asarray(dyn_x, dtype=np.float32).reshape(-1, meta.card_dim),
        y=float(obj["y"]),
    )


def sample_files(dirs: list[Path]) -> list[Path]:
    """Tous les fichiers de positions des dossiers de générations donnés."""
    return [p for d in dirs for p in sorted(Path(d).glob("part-*.jsonl.gz"))]


def load_samples(paths: list[Path], meta: Meta) -> list[Sample]:
    """Lit toutes les positions des fichiers .jsonl.gz."""
    out: list[Sample] = []
    for path in paths:  # un fichier par processus d'auto-jeu
        with gzip.open(path, "rt", encoding="utf-8") as f:  # décompression à la volée
            for line in f:  # une position par ligne
                if line.strip():  # ignore les lignes vides
                    out.append(parse(json.loads(line), meta))
    return out


def split_by_game(samples: list[Sample]) -> tuple[list[Sample], list[Sample]]:
    """Une partie sur dix en validation, entière : jamais une même partie des deux côtés."""
    train = [s for s in samples if s.g % 10 != 0]
    val = [s for s in samples if s.g % 10 == 0]
    return train, val


def collate(samples: list[Sample], meta: Meta, dtype: torch.dtype = torch.float32) -> dict[str, torch.Tensor]:
    """Assemble des positions en un lot de tenseurs."""
    b = len(samples)  # taille du lot
    n_sets = len(meta.set_names)  # 7 ensembles
    n_rows = meta.static_x.shape[0]  # cartes connues + ligne 0
    d = max(1, max(len(s.dyn_row) for s in samples))  # cartes dynamiques max (au moins 1)
    glob = torch.tensor(np.stack([s.glob for s in samples]), dtype=dtype)  # [B, 22]
    counts = torch.zeros((b, n_sets, n_rows), dtype=dtype)  # [B, 7, R]
    dyn_x = torch.zeros((b, d, meta.card_dim), dtype=dtype)  # [B, D, 32]
    dyn_row = torch.zeros((b, d), dtype=torch.long)  # [B, D]
    dyn_set = torch.zeros((b, d), dtype=torch.long)  # [B, D]
    dyn_mask = torch.zeros((b, d), dtype=dtype)  # 1 = vraie carte, 0 = remplissage
    for k, s in enumerate(samples):  # remplit position par position
        if len(s.counts):  # cartes statiques
            c = torch.from_numpy(s.counts)
            counts[k, c[:, 0], c[:, 1]] = c[:, 2].to(dtype)
        n = len(s.dyn_row)  # cartes dynamiques de cette position
        if n:
            dyn_x[k, :n] = torch.from_numpy(s.dyn_x).to(dtype)
            dyn_row[k, :n] = torch.from_numpy(s.dyn_row)
            dyn_set[k, :n] = torch.from_numpy(s.dyn_set)
            dyn_mask[k, :n] = 1
    y = torch.tensor([s.y for s in samples], dtype=dtype)  # cibles [B]
    return {"global": glob, "counts": counts, "dyn_x": dyn_x, "dyn_row": dyn_row,
            "dyn_set": dyn_set, "dyn_mask": dyn_mask, "y": y}


def to_compact(sample: Sample, meta: Meta) -> dict:
    """Retour au format compact (celui de CompactPosition en TypeScript), pour la parité."""
    sets: dict[str, list[dict]] = {name: [] for name in meta.set_names}
    for s, row, count in sample.counts.tolist():  # cartes statiques : répétées count fois
        sets[meta.set_names[s]].extend({"i": meta.card_ids[row - 1]} for _ in range(count))
    for s, card_id, x in zip(sample.dyn_set.tolist(), sample.dyn_id.tolist(), sample.dyn_x):
        sets[meta.set_names[s]].append({"i": card_id, "x": x.tolist()})  # vecteur complet
    return {"global": sample.glob.tolist(), "sets": sets}
```

- [ ] **Step 6: Écrire `model.py`**

```python
# tools/ai-train/model.py
"""Réseau de valeur : même calcul que apps/backend/src/fights/ai/nn/mlp.ts.

carte : [x (32), embedding (8)] -> Linéaire 64 -> ReLU -> Linéaire 32 -> ReLU
ensemble : somme des vecteurs de ses cartes (DeepSets), multipliée par son échelle
tête : [global (22), 7 sommes (7 x 32)] -> 128 -> ReLU -> 128 -> ReLU -> 1 -> tanh
"""
import torch  # tenseurs et calcul de gradients
from torch import nn  # couches de réseaux de neurones

EMBED_DIM = 8  # taille de l'embedding d'une carte
CARD_HIDDEN = 64  # couche cachée de l'encodeur de carte
CARD_OUT = 32  # vecteur d'une carte après encodage
HEAD_HIDDEN = 128  # couches cachées de la tête


class ValueNet(nn.Module):
    """Prédit le résultat de la partie (entre -1 et +1) pour le joueur de la position."""

    def __init__(self, static_x: torch.Tensor, global_dim: int, set_scale: list[float]):
        super().__init__()  # initialisation obligatoire d'un module PyTorch
        n_rows, card_dim = static_x.shape  # cartes connues (+ ligne 0) et taille de x
        # Tampons : sauvegardés avec le modèle mais jamais entraînés.
        self.register_buffer("static_x", static_x.clone())
        self.register_buffer("set_scale", torch.tensor(set_scale, dtype=static_x.dtype))
        # Une ligne de 8 nombres appris par carte ; ligne 0 = carte inconnue, figée à 0.
        self.emb = nn.Embedding(n_rows, EMBED_DIM, padding_idx=0)
        self.card1 = nn.Linear(card_dim + EMBED_DIM, CARD_HIDDEN)  # 40 -> 64
        self.card2 = nn.Linear(CARD_HIDDEN, CARD_OUT)  # 64 -> 32
        n_sets = len(set_scale)  # 7 ensembles
        self.head1 = nn.Linear(global_dim + n_sets * CARD_OUT, HEAD_HIDDEN)  # 246 -> 128
        self.head2 = nn.Linear(HEAD_HIDDEN, HEAD_HIDDEN)  # 128 -> 128
        self.out = nn.Linear(HEAD_HIDDEN, 1)  # 128 -> 1

    def encode_cards(self, x: torch.Tensor, rows: torch.Tensor) -> torch.Tensor:
        """Encodeur de carte partagé : même poids pour toutes les cartes."""
        h = torch.cat([x, self.emb(rows)], dim=-1)  # colle x et l'embedding
        return torch.relu(self.card2(torch.relu(self.card1(h))))  # deux couches + ReLU

    def forward(self, batch: dict[str, torch.Tensor]) -> torch.Tensor:
        # 1. Vecteur de chaque carte connue, calculé une fois pour tout le lot.
        rows = torch.arange(self.static_x.shape[0], device=self.static_x.device)
        phi = self.encode_cards(self.static_x, rows)  # [R, 32]
        # 2. Somme des cartes statiques : nombre de chaque carte x son vecteur.
        static_sum = batch["counts"] @ phi  # [B, 7, R] @ [R, 32] -> [B, 7, 32]
        # 3. Cartes dynamiques : encodées une à une, remplissage annulé par le masque.
        dyn = self.encode_cards(batch["dyn_x"], batch["dyn_row"]) * batch["dyn_mask"].unsqueeze(-1)
        index = batch["dyn_set"].unsqueeze(-1).expand(-1, -1, CARD_OUT)  # ensemble de chaque carte
        dyn_sum = torch.zeros_like(static_sum).scatter_add(1, index, dyn)  # ajoute à son ensemble
        # 4. Échelle de chaque ensemble (les decks pèsent 0,1 par carte).
        sets = (static_sum + dyn_sum) * self.set_scale.view(1, -1, 1)
        # 5. Tête : global + 7 sommes, deux couches cachées, sortie tanh.
        z = torch.cat([batch["global"], sets.flatten(1)], dim=1)  # [B, 246]
        h = torch.relu(self.head2(torch.relu(self.head1(z))))
        return torch.tanh(self.out(h)).squeeze(-1)  # [B], entre -1 et +1
```

- [ ] **Step 7: Lancer, vérifier le succès**

Run (dans `tools/ai-train`) : `.venv/Scripts/python -m pytest -q`
Expected: `10 passed`.

- [ ] **Step 8: Commit**

```bash
git add tools/ai-train .gitignore
git commit -m "feat(ia): réseau de valeur et lecture des positions en Python"
```

---

### Task 9: Entraînement, export et parité TS/PyTorch

**Files:**
- Create:
  - `tools/ai-train/train.py`
  - `tools/ai-train/export.py`
  - `tools/ai-train/tests/test_train.py`
  - `tools/ai-train/tests/test_export.py`
  - `apps/backend/src/fights/ai/nn/parity-fixture.json` (généré)
  - `apps/backend/src/fights/ai/nn/parity.spec.ts`

**Interfaces:**
- Consumes: Tâche 8 (`Meta`, `Sample`, `collate`, `to_compact`, `ValueNet`), tâche 7 (`ai:check-weights`), tâche 3 (`parityError`, `PARITY_TOLERANCE`, `CHAMPION_PATH`).
- Produces:
  - `train.py` : `evaluate(model, samples, meta) -> float` ; `train(train_samples, val_samples, meta, out_dir, *, epochs=30, patience=3, batch_size=256, lr=1e-3, seed=0, log=print) -> tuple[ValueNet, dict]` (dict `{"valLoss": float, "epochs": int}`).
  - `export.py` :
    - `round6(v) -> float` ;
    - `export_weights(model, meta, *, generation, positions, val_loss, parity_samples, path=None) -> dict` ;
    - `model_from_json(data, meta) -> ValueNet` (float64) ;
    - CLI `python export.py --fixture <dossier_données> <sortie.json>`.

- [ ] **Step 1: Écrire les tests Python**

```python
# tools/ai-train/tests/test_train.py
# Tests de l'entraînement : la perte baisse, la reprise repart du checkpoint.
from dataset import parse, split_by_game
from fake_data import fake_line, fake_meta
from train import evaluate, train


def data():
    meta = fake_meta()
    # Cible apprenable : la position avec un monstre gagne, l'autre perd.
    samples = [parse(fake_line(g, 1 if g % 2 else -1, dyn=g % 2 == 1), meta) for g in range(60)]
    return meta, *split_by_game(samples)


def test_la_perte_baisse(tmp_path):
    meta, tr, va = data()
    model, info = train(tr, va, meta, tmp_path, epochs=40, patience=40, batch_size=16, log=lambda m: None)
    assert info["valLoss"] < 0.2  # bien en dessous de 1 (prédire 0 partout)
    assert evaluate(model, va, meta) == info["valLoss"]


def test_reprise_depuis_le_checkpoint(tmp_path):
    meta, tr, va = data()
    logs = []
    train(tr, va, meta, tmp_path, epochs=2, patience=10, batch_size=16, log=logs.append)
    assert len([m for m in logs if m.startswith("époque")]) == 2
    logs.clear()
    _, info = train(tr, va, meta, tmp_path, epochs=4, patience=10, batch_size=16, log=logs.append)
    assert logs[0] == "reprise à l'époque 3"  # les 2 premières ne sont pas refaites
    assert len([m for m in logs if m.startswith("époque")]) == 2
    assert info["epochs"] == 4
```

```python
# tools/ai-train/tests/test_export.py
# Tests de l'export JSON : forme, relecture à l'identique, parité.
import json  # format JSON

import torch  # tenseurs

from dataset import collate, parse
from export import export_weights, model_from_json, round6
from fake_data import fake_line, fake_meta
from model import ValueNet


def setup():
    meta = fake_meta()
    torch.manual_seed(0)
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)
    samples = [parse(fake_line(g, 1, dyn=g % 2 == 0), meta) for g in range(6)]
    return meta, model, samples


def test_forme_du_fichier(tmp_path):
    meta, model, samples = setup()
    path = tmp_path / "w.json"
    data = export_weights(model, meta, generation=3, positions=6, val_loss=0.5, parity_samples=samples, path=path)
    assert json.loads(path.read_text(encoding="utf-8")) == data
    assert data["encodingVersion"] == 1
    assert data["cardIndex"] == {"10": 1, "20": 2, "30": 3}
    assert len(data["layers"]["emb"]) == 4
    assert len(data["layers"]["head1"]["w"][0]) == 22 + 7 * 32
    assert len(data["parity"]["positions"]) == 6


def test_relu_a_l_identique():
    meta, model, samples = setup()
    data = export_weights(model, meta, generation=0, positions=0, val_loss=0, parity_samples=samples)
    back = model_from_json(data, meta)
    with torch.no_grad():
        values = back(collate(samples, meta, dtype=torch.float64)).tolist()
    assert values == data["parity"]["values"]


def test_arrondi_a_6_chiffres():
    assert round6(0.123456789) == 0.123457
    assert round6(-1.5e-9) == -1.5e-9
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `.venv/Scripts/python -m pytest -q tests/test_train.py tests/test_export.py`
Expected: FAIL, `No module named 'train'`.

- [ ] **Step 3: Écrire `train.py`**

```python
# tools/ai-train/train.py
"""Entraînement du réseau de valeur, avec reprise après interruption."""
from __future__ import annotations  # annotations de type modernes

import os  # remplacement atomique de fichiers
from pathlib import Path  # chemins de fichiers
from typing import Callable  # type des fonctions passées en argument

import numpy as np  # tirages aléatoires reproductibles
import torch  # tenseurs, gradients, optimiseurs
import torch.nn.functional as F  # fonctions de perte

from dataset import Meta, Sample, collate  # données
from model import ValueNet  # réseau


def save_atomic(obj, path: Path) -> None:
    """Écrit dans un fichier temporaire puis le renomme : jamais de fichier à moitié écrit."""
    tmp = path.with_name(path.name + ".tmp")
    torch.save(obj, tmp)
    os.replace(tmp, path)  # remplacement en une seule opération


def evaluate(model: ValueNet, samples: list[Sample], meta: Meta, batch_size: int = 1024) -> float:
    """Perte MSE moyenne sur des positions, sans apprendre."""
    model.eval()  # mode évaluation
    total = 0.0  # somme des erreurs au carré
    with torch.no_grad():  # pas de gradients : plus rapide
        for start in range(0, len(samples), batch_size):  # lot par lot
            batch = collate(samples[start:start + batch_size], meta)
            total += F.mse_loss(model(batch), batch["y"], reduction="sum").item()
    return total / len(samples)  # moyenne


def train(
    train_samples: list[Sample],
    val_samples: list[Sample],
    meta: Meta,
    out_dir: Path | str,
    *,
    epochs: int = 30,  # passages complets sur les données, au plus
    patience: int = 3,  # époques sans progrès avant l'arrêt précoce
    batch_size: int = 256,  # positions par pas de gradient
    lr: float = 1e-3,  # taux d'apprentissage d'Adam
    seed: int = 0,  # graine : même entraînement à chaque fois
    log: Callable[[str], None] = print,  # où écrire l'avancement
) -> tuple[ValueNet, dict]:
    """Entraîne et renvoie le meilleur modèle (perte de validation la plus basse)."""
    if not val_samples:  # sans validation, impossible de savoir quand s'arrêter
        raise ValueError("aucune position de validation : il faut au moins 10 parties")
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)  # dossier de la génération
    torch.manual_seed(seed)  # poids initiaux reproductibles
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)
    # Adam : descente de gradient avec un pas adapté à chaque poids ;
    # weight_decay tire légèrement les poids vers 0 (limite le sur-apprentissage).
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    progress = {"epoch": 0, "best": float("inf"), "bad": 0}  # état de l'entraînement
    checkpoint = out_dir / "checkpoint.pt"  # sauvegarde complète à chaque époque
    best_path = out_dir / "best.pt"  # meilleurs poids vus jusqu'ici
    if checkpoint.exists():  # entraînement interrompu : on reprend
        saved = torch.load(checkpoint, weights_only=False)
        model.load_state_dict(saved["model"])
        optimizer.load_state_dict(saved["optimizer"])
        progress = saved["progress"]
        log(f"reprise à l'époque {progress['epoch'] + 1}")
    while progress["epoch"] < epochs and progress["bad"] < patience:
        epoch = progress["epoch"]
        model.train()  # mode apprentissage
        # Ordre aléatoire des positions, différent à chaque époque mais reproductible.
        order = np.random.default_rng(seed + epoch).permutation(len(train_samples))
        total = 0.0
        for start in range(0, len(order), batch_size):  # un pas de gradient par lot
            chunk = [train_samples[k] for k in order[start:start + batch_size]]
            batch = collate(chunk, meta)
            loss = F.mse_loss(model(batch), batch["y"])  # erreur moyenne au carré
            optimizer.zero_grad()  # efface les gradients du pas précédent
            loss.backward()  # calcule les gradients (rétropropagation)
            optimizer.step()  # ajuste les poids
            total += loss.item() * len(chunk)
        train_loss = total / max(1, len(order))
        val_loss = evaluate(model, val_samples, meta)  # sur des parties jamais vues
        if val_loss < progress["best"]:  # progrès : on garde ces poids
            progress.update(best=val_loss, bad=0)
            save_atomic(model.state_dict(), best_path)
        else:  # pas de progrès : une époque de plus sans amélioration
            progress["bad"] += 1
        progress["epoch"] = epoch + 1
        save_atomic({"model": model.state_dict(), "optimizer": optimizer.state_dict(),
                     "progress": progress}, checkpoint)
        log(f"époque {epoch + 1} : perte entraînement {train_loss:.4f}, validation {val_loss:.4f}")
    model.load_state_dict(torch.load(best_path, weights_only=True))  # revient aux meilleurs poids
    return model, {"valLoss": progress["best"], "epochs": progress["epoch"]}
```

- [ ] **Step 4: Écrire `export.py`**

```python
# tools/ai-train/export.py
"""Export du réseau en JSON pour l'inférence TypeScript, avec un bloc de parité."""
from __future__ import annotations  # annotations de type modernes

import argparse  # arguments de la ligne de commande
import json  # format JSON
import os  # remplacement atomique
import sys  # sortie d'erreur
from datetime import datetime, timezone  # date d'entraînement
from pathlib import Path  # chemins

import torch  # tenseurs

from dataset import Meta, Sample, collate, load_samples, sample_files, to_compact
from model import ValueNet

LAYERS = ["card1", "card2", "head1", "head2", "out"]  # couches linéaires, dans l'ordre
PARITY_POSITIONS = 50  # positions figées pour la vérification TS / PyTorch


def round6(v: float) -> float:
    """6 chiffres significatifs : fichier plus petit, précision largement suffisante."""
    return float(f"{v:.6g}")


def _layer(linear: torch.nn.Linear) -> dict:
    return {"w": [[round6(v) for v in row] for row in linear.weight.tolist()],  # [sortie][entrée]
            "b": [round6(v) for v in linear.bias.tolist()]}


def model_from_json(data: dict, meta: Meta) -> ValueNet:
    """Reconstruit le réseau, en double précision comme TypeScript, à partir du JSON."""
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale).double()
    model.set_scale = torch.tensor(meta.set_scale, dtype=torch.float64)  # 0,1 exact, comme en TS
    with torch.no_grad():  # copie de poids, pas d'apprentissage
        model.emb.weight.copy_(torch.tensor(data["layers"]["emb"], dtype=torch.float64))
        for name in LAYERS:
            layer = getattr(model, name)
            layer.weight.copy_(torch.tensor(data["layers"][name]["w"], dtype=torch.float64))
            layer.bias.copy_(torch.tensor(data["layers"][name]["b"], dtype=torch.float64))
    return model.eval()


def export_weights(model: ValueNet, meta: Meta, *, generation: int, positions: int, val_loss: float,
                   parity_samples: list[Sample], path: Path | None = None) -> dict:
    """Construit le fichier de poids ; les valeurs de parité sont calculées sur les poids arrondis."""
    data = {
        "encodingVersion": meta.encoding_version,
        "generation": generation,
        "trainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "positions": positions,
        "valLoss": round6(val_loss),
        "cardIndex": {str(card_id): row for row, card_id in enumerate(meta.card_ids, start=1)},
        "layers": {"emb": [[round6(v) for v in row] for row in model.emb.weight.tolist()],
                   **{name: _layer(getattr(model, name)) for name in LAYERS}},
    }
    samples = parity_samples[:PARITY_POSITIONS]
    with torch.no_grad():  # sorties de référence pour TypeScript
        values = model_from_json(data, meta)(collate(samples, meta, dtype=torch.float64)).tolist()
    compact = [to_compact(s, meta) for s in samples]
    used = sorted({c["i"] for p in compact for cards in p["sets"].values() for c in cards if "x" not in c})
    data["parity"] = {"cards": {str(i): meta.static_x[meta.row_of[i]].tolist() for i in used},
                      "positions": compact, "values": values}
    if path is not None:  # écriture atomique
        path = Path(path)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(data), encoding="utf-8")
        os.replace(tmp, path)
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Fixture de parité : réseau non entraîné, positions réelles")
    parser.add_argument("--fixture", nargs=2, metavar=("DONNEES", "SORTIE"), required=True)
    args = parser.parse_args()
    data_dir, out = Path(args.fixture[0]), Path(args.fixture[1])
    meta = Meta.load(data_dir / "meta.json")
    samples = load_samples(sample_files([data_dir]), meta)[:PARITY_POSITIONS]
    if len(samples) < PARITY_POSITIONS:
        sys.exit(f"{len(samples)} positions seulement, il en faut {PARITY_POSITIONS}")
    torch.manual_seed(0)  # poids reproductibles
    model = ValueNet(torch.from_numpy(meta.static_x), meta.global_dim, meta.set_scale)
    export_weights(model, meta, generation=0, positions=0, val_loss=0.0, parity_samples=samples, path=out)
    print(f"Fixture écrite : {out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Lancer les tests Python**

Run: `.venv/Scripts/python -m pytest -q`
Expected: `15 passed`.

- [ ] **Step 6: Générer la fixture et écrire le test Jest de parité**

Run (depuis la racine) :
1. `pnpm --filter @pipou/backend ai:selfplay ../../tools/ai-train/data/fixture --games 12 --budget 200 --workers 4`
2. `tools/ai-train/.venv/Scripts/python tools/ai-train/export.py --fixture tools/ai-train/data/fixture apps/backend/src/fights/ai/nn/parity-fixture.json`
3. `pnpm --filter @pipou/backend ai:check-weights src/fights/ai/nn/parity-fixture.json`

Expected: `Parité génération 0 : écart max …e-1x (OK)`, avec un écart inférieur à 1e-5.

```ts
// apps/backend/src/fights/ai/nn/parity.spec.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PARITY_TOLERANCE, parityError } from './mlp';
import { CHAMPION_PATH, readWeights } from './weights';

describe('parité PyTorch / TypeScript', () => {
  it('fixture : l’inférence TS retrouve les sorties PyTorch', () => {
    const w = readWeights(join(__dirname, 'parity-fixture.json'));
    expect(w.parity?.positions.length).toBe(50);
    expect(parityError(w)).toBeLessThan(PARITY_TOLERANCE);
  });

  (existsSync(CHAMPION_PATH) ? it : it.skip)('champion déployé : parité respectée', () => {
    expect(parityError(readWeights(CHAMPION_PATH))).toBeLessThan(PARITY_TOLERANCE);
  });
});
```

Run: `pnpm --filter @pipou/backend test -- nn/parity.spec`
Expected: PASS (1 test, 1 ignoré tant qu'il n'y a pas de champion).

- [ ] **Step 7: Commit**

```bash
git add tools/ai-train apps/backend/src/fights/ai/nn/parity-fixture.json apps/backend/src/fights/ai/nn/parity.spec.ts
git commit -m "feat(ia): entraînement, export JSON et parité PyTorch / TypeScript"
```

---

### Task 10: Boucle de générations `loop.py`

**Files:**
- Create: `tools/ai-train/loop.py`, `tools/ai-train/tests/test_loop.py`

**Interfaces:**
- Consumes:
  - `ai:selfplay`, `ai:check-weights`, `ai:arena` (tâches 5 à 7) ;
  - `Meta`, `load_samples`, `sample_files`, `split_by_game` (tâche 8) ;
  - `train` (tâche 9) ;
  - `export_weights` (tâche 9).
- Produces:
  - `python loop.py --hours N [--run main] [--games 1500] [--arena-games 400] [--gauge-games 100] [--budget 2000] [--workers N]` ;
  - fonctions testées : `should_promote(verdict) -> bool`, `load_state(run_dir, run) -> dict`, `save_json(path, data)`, `record_of(state, n) -> dict`, `write_report(run_dir, state)` ;
  - fichiers : `runs/<run>/state.json`, `report.md`, `*.png`, `train.log`, `champion.json`, `gen-NNN/{checkpoint.pt,best.pt,weights.json,arena.json,gauge.json}`, et `data/<run>/gen-NNN/`.

- [ ] **Step 1: Écrire les tests**

```python
# tools/ai-train/tests/test_loop.py
# Tests des morceaux de la boucle qui ne lancent pas Node.
import json  # format JSON

from loop import load_state, record_of, save_json, should_promote, write_report


def test_promotion_score_et_wilson():
    assert should_promote({"score": 0.56, "lower": 0.51})
    assert not should_promote({"score": 0.56, "lower": 0.49})  # pas assez sûr
    assert not should_promote({"score": 0.54, "lower": 0.51})  # pas assez fort


def test_etat_initial_puis_relu(tmp_path):
    state = load_state(tmp_path, "essai")
    assert state == {"run": "essai", "generation": 1, "step": "selfplay", "champion": None, "history": []}
    state["step"] = "train"
    save_json(tmp_path / "state.json", state)
    assert load_state(tmp_path, "essai")["step"] == "train"
    assert not (tmp_path / "state.json.tmp").exists()  # écriture atomique


def test_rapport(tmp_path):
    state = load_state(tmp_path, "essai")
    record_of(state, 1).update(positions=100, valLoss=0.8, arena=0.58, promoted=True, gauge=0.61)
    record_of(state, 2).update(positions=120, valLoss=0.7, arena=0.5, promoted=False)
    write_report(tmp_path, state)
    report = (tmp_path / "report.md").read_text(encoding="utf-8")
    assert "| 1 | 100 | 0.8000 | 58.0 % | oui | 61.0 % |" in report
    assert (tmp_path / "progression.png").exists()
    json.dumps(state)  # l'état reste sérialisable
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `.venv/Scripts/python -m pytest -q tests/test_loop.py`
Expected: FAIL, `No module named 'loop'`.

- [ ] **Step 3: Écrire `loop.py`**

```python
# tools/ai-train/loop.py
"""Boucle d'entraînement AlphaZero-lite, sur un seul PC.

Une génération : auto-jeu (Node) -> entraînement (PyTorch) -> parité -> arène
-> jauge contre evaluate.ts si promu. L'état est sauvé après chaque étape :
relancer la même commande reprend là où on s'était arrêté.

    .venv/Scripts/python loop.py --hours 8
"""
from __future__ import annotations  # annotations de type modernes

import argparse  # arguments de la ligne de commande
import json  # format JSON
import os  # remplacement atomique, nombre de cœurs
import shutil  # copie de fichiers, recherche de pnpm
import subprocess  # lancement des commandes Node
import time  # chronomètre
from datetime import datetime  # horodatage du journal
from pathlib import Path  # chemins

ROOT = Path(__file__).resolve().parent  # tools/ai-train
REPO = ROOT.parent.parent  # racine du monorepo
DEFAULT_GAMES = 1500  # parties par génération ; fixé par la mesure de la tâche 13
KEEP_GENERATIONS = 4  # générations de données gardées pour l'entraînement
PROMOTE_SCORE = 0.55  # score d'arène minimal pour promouvoir


def should_promote(verdict: dict) -> bool:
    """Promu si assez fort (≥ 55 %) et assez sûr (borne basse de Wilson > 50 %)."""
    return verdict["score"] >= PROMOTE_SCORE and verdict["lower"] > 0.5


def save_json(path: Path, data: dict) -> None:
    """Écrit dans un .tmp puis renomme : jamais de fichier à moitié écrit."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def load_state(run_dir: Path, run: str) -> dict:
    """État sauvé, ou état de départ (génération 1, auto-jeu avec evaluate.ts)."""
    path = run_dir / "state.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"run": run, "generation": 1, "step": "selfplay", "champion": None, "history": []}


def record_of(state: dict, n: int) -> dict:
    """Ligne d'historique de la génération n (créée au besoin)."""
    for record in state["history"]:
        if record["generation"] == n:
            return record
    record = {"generation": n}
    state["history"].append(record)
    return record


def _pct(v) -> str:
    return "—" if v is None else f"{v * 100:.1f} %"


def write_report(run_dir: Path, state: dict) -> None:
    """report.md (tableau) et progression.png (courbes)."""
    import matplotlib  # graphiques (importé ici : inutile au reste de la boucle)
    matplotlib.use("Agg")  # pas de fenêtre : image seulement
    import matplotlib.pyplot as plt

    rows = sorted(state["history"], key=lambda r: r["generation"])
    lines = [f"# Entraînement « {state['run']} »", "",
             f"Champion : {state['champion'] or 'evaluate.ts (aucun promu)'}", "",
             "| Gén. | Positions | Perte val. | Arène | Promu | Jauge vs evaluate.ts |",
             "|---|---|---|---|---|---|"]
    for r in rows:
        loss = "—" if r.get("valLoss") is None else f"{r['valLoss']:.4f}"
        promoted = {True: "oui", False: "non"}.get(r.get("promoted"), "—")
        lines.append(f"| {r['generation']} | {r.get('positions', '—')} | {loss} | "
                     f"{_pct(r.get('arena'))} | {promoted} | {_pct(r.get('gauge'))} |")
    lines += ["", "![progression](progression.png)", ""]
    (run_dir / "report.md").write_text("\n".join(lines), encoding="utf-8")

    fig, (left, right) = plt.subplots(1, 2, figsize=(10, 4))
    gens = [r["generation"] for r in rows]
    left.plot(gens, [r.get("valLoss") for r in rows], marker="o")
    left.set(title="Perte de validation", xlabel="génération")
    for key, label in (("arena", "arène"), ("gauge", "jauge vs evaluate.ts")):
        points = [(r["generation"], r[key]) for r in rows if r.get(key) is not None]
        if points:
            right.plot(*zip(*points), marker="o", label=label)
    right.axhline(0.5, color="grey", linestyle="--")
    right.set(title="Score", xlabel="génération", ylim=(0, 1))
    right.legend()
    fig.tight_layout()
    fig.savefig(run_dir / "progression.png")
    plt.close(fig)


def node(script: str, *args) -> None:
    """Lance un script pnpm du backend ; lève si la commande échoue."""
    pnpm = shutil.which("pnpm")
    if pnpm is None:
        raise SystemExit("pnpm introuvable dans le PATH")
    subprocess.run([pnpm, "--silent", "--filter", "@pipou/backend", script, *map(str, args)],
                   cwd=REPO, check=True)


def say(message: str) -> None:
    """Une ligne de console par étape, horodatée."""
    print(f"{datetime.now():%H:%M} {message}", flush=True)


def gen_name(n: int) -> str:
    return f"gen-{n:03d}"


def run_step(state: dict, args, run_dir: Path, data_root: Path) -> None:
    """Exécute l'étape courante et passe à la suivante."""
    from dataset import Meta, load_samples, sample_files, split_by_game  # données
    from export import export_weights  # export JSON
    from train import train  # entraînement

    n, step = state["generation"], state["step"]
    gen_dir = run_dir / gen_name(n)
    gen_dir.mkdir(parents=True, exist_ok=True)
    champion = state["champion"] or "legacy"  # génération 1 : evaluate.ts
    record = record_of(state, n)
    started = time.time()
    minutes = lambda: f"{(time.time() - started) / 60:.0f} min"  # noqa: E731

    if step == "selfplay":
        out = data_root / gen_name(n)
        if out.exists():  # étape interrompue : refaite entièrement
            shutil.rmtree(out)
        node("ai:selfplay", out, "--games", args.games, "--seed", n, "--note", champion,
             "--budget", args.budget, "--workers", args.workers)
        done = json.loads((out / "done.json").read_text(encoding="utf-8"))
        record["positions"] = done["positions"]
        say(f"gen {n} · auto-jeu : {done['games']} parties, {done['positions']} positions ({minutes()})")
        state["step"] = "train"
    elif step == "train":
        first = max(1, n - KEEP_GENERATIONS + 1)
        dirs = [data_root / gen_name(k) for k in range(first, n + 1)]
        meta = Meta.load(data_root / gen_name(n) / "meta.json")
        train_samples, val_samples = split_by_game(load_samples(sample_files(dirs), meta))
        log_path = run_dir / "train.log"

        def log(message: str) -> None:  # détails dans un fichier, pas en console
            with log_path.open("a", encoding="utf-8") as f:
                f.write(f"{datetime.now():%Y-%m-%d %H:%M} gen {n} {message}\n")

        model, info = train(train_samples, val_samples, meta, gen_dir, log=log)
        export_weights(model, meta, generation=n, positions=len(train_samples), val_loss=info["valLoss"],
                       parity_samples=val_samples, path=gen_dir / "weights.json")
        record["valLoss"] = info["valLoss"]
        say(f"gen {n} · entraînement : perte de validation {info['valLoss']:.4f}, "
            f"{info['epochs']} époques ({minutes()})")
        state["step"] = "parity"
    elif step == "parity":
        node("ai:check-weights", gen_dir / "weights.json")  # lève si l'écart dépasse 1e-5
        state["step"] = "arena"
    elif step == "arena":
        out = gen_dir / "arena.json"
        node("ai:arena", "--challenger", gen_dir / "weights.json", "--champion", champion,
             "--games", args.arena_games, "--seed", n, "--budget", args.budget,
             "--workers", args.workers, "--json", out)
        verdict = json.loads(out.read_text(encoding="utf-8"))
        promoted = should_promote(verdict)
        record.update(arena=verdict["score"], promoted=promoted)
        if promoted:
            shutil.copyfile(gen_dir / "weights.json", run_dir / "champion.json")
            state["champion"] = str(run_dir / "champion.json")
        say(f"gen {n} · arène {verdict['score'] * 100:.1f} % → {'promu' if promoted else 'rejeté'} ({minutes()})")
        state["step"] = "gauge" if promoted else "next"
    elif step == "gauge":
        out = gen_dir / "gauge.json"
        node("ai:arena", "--challenger", state["champion"], "--champion", "legacy",
             "--games", args.gauge_games, "--seed", 999, "--time-ms", 200,
             "--workers", args.workers, "--json", out)
        gauge = json.loads(out.read_text(encoding="utf-8"))
        record["gauge"] = gauge["score"]
        say(f"gen {n} · jauge contre evaluate.ts à temps égal : {gauge['score'] * 100:.1f} % ({minutes()})")
        state["step"] = "next"
    if state["step"] == "next":
        state["generation"] = n + 1
        state["step"] = "selfplay"


def main() -> None:
    parser = argparse.ArgumentParser(description="Boucle d'entraînement de l'IA (reprend automatiquement)")
    parser.add_argument("--hours", type=float, required=True, help="durée avant de s'arrêter entre deux étapes")
    parser.add_argument("--run", default="main", help="nom de l'entraînement (dossier runs/<run>)")
    parser.add_argument("--games", type=int, default=DEFAULT_GAMES, help="parties d'auto-jeu par génération")
    parser.add_argument("--arena-games", type=int, default=400)
    parser.add_argument("--gauge-games", type=int, default=100)
    parser.add_argument("--budget", type=int, default=2000, help="nœuds du planificateur par décision")
    parser.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    args = parser.parse_args()

    run_dir = ROOT / "runs" / args.run
    data_root = ROOT / "data" / args.run
    run_dir.mkdir(parents=True, exist_ok=True)
    state = load_state(run_dir, args.run)
    deadline = time.time() + args.hours * 3600
    say(f"« {args.run} » : génération {state['generation']}, étape {state['step']}, {args.workers} processus")
    while time.time() < deadline:
        run_step(state, args, run_dir, data_root)
        save_json(run_dir / "state.json", state)
        write_report(run_dir, state)
    say(f"Temps écoulé. Rapport : {run_dir / 'report.md'}. Relancer la même commande pour continuer.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Lancer les tests**

Run: `.venv/Scripts/python -m pytest -q`
Expected: `18 passed`.

- [ ] **Step 5: Essai de bout en bout, très court**

Run (dans `tools/ai-train`) : `.venv/Scripts/python loop.py --hours 0.01 --run essai --games 20 --arena-games 4 --gauge-games 4 --budget 150`
Expected:
- des lignes `gen 1 · auto-jeu …`, `gen 1 · entraînement …`, une ligne de parité OK, puis `gen 1 · arène …` ;
- arrêt quand le temps est écoulé ;
- relancer la même commande reprend à l'étape suivante (`étape …` affichée au démarrage).

Supprimer ensuite `runs/essai` et `data/essai`.

- [ ] **Step 6: Commit**

```bash
git add tools/ai-train/loop.py tools/ai-train/tests/test_loop.py
git commit -m "feat(ia): boucle de générations avec reprise et rapport"
```

---

### Task 11: Worker de prod et temps des niveaux

**Files:**
- Create:
  - `apps/backend/src/fights/ai/ai-engine.ts`
  - `apps/backend/src/fights/ai/ai-mover.ts`
  - `apps/backend/src/fights/ai/nn/ai-worker.ts`
- Test: `apps/backend/src/fights/ai/ai-mover.spec.ts`, `apps/backend/src/fights/ai/nn/ai-worker.spec.ts`
- Modify:
  - `apps/backend/src/fights/helpers/evolution-catalog.ts` (getter)
  - `apps/backend/src/fights/testing/engine.ts`
  - `apps/backend/src/fights/fights.service.ts` (l.44, 52, 92, 246-251, 775, 945)
  - `apps/backend/src/fights/ai/level-brains.ts` (temps)
  - `apps/backend/src/fights/ai/level-brains.spec.ts`
  - `apps/backend/nest-cli.json`

**Interfaces:**
- Consumes: `createLevelAi`, `AiPlayer`, `AiProfile`, `AiLevel`, `DecisionSink`, `DecisionRecord`, `GameEngine`.
- Produces:
  - `evolutionCatalog(): Card[]` ;
  - `createAiEngine(rng?: Rng): GameEngine` ;
  - `ai-mover.ts` :
    - `interface AiMover { decide(game, seat, profile): Promise<GameAction>; setDecisionSink(sink, run?): void; dispose(): void }` ;
    - `LocalMover`, `WorkerMover`, `AiWorkerPool`, `AI_HARD_LIMIT_MS = 4000` ;
    - `useAiWorker(): boolean`, `spawnAiWorker(): WorkerLike` ;
    - types `ToWorker`, `FromWorker`, `WorkerLike`.

- [ ] **Step 1: Getter du catalogue et moteur sans dépendance de test**

`evolution-catalog.ts`, après `setEvolutionCatalog` :

```ts
/** Catalogue courant (copié vers le worker d'IA). */
export function evolutionCatalog(): Card[] {
  return catalog;
}
```

```ts
// apps/backend/src/fights/ai/ai-engine.ts
import { BuffsCalculatorService } from '../buffs-calculator.service';
import { EffectsResolverService } from '../effects-resolver.service';
import { GameEngine } from '../engine/game-engine';
import { mathRandomRng } from '../engine/rng';
import type { Rng } from '../engine/rng';
import { BattleService } from '../services/battle.service';
import { EvolutionService } from '../services/evolution.service';
import { PhaseService } from '../services/phase.service';
import { PickService } from '../services/pick.service';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';

/** Moteur câblé à la main, comme le ferait Nest (worker d'IA, outils, tests). */
export function createAiEngine(rng: Rng = mathRandomRng): GameEngine {
  const effects = new EffectsResolverService();
  const summon = new SummonService(effects);
  return new GameEngine(
    new PhaseService(effects),
    summon,
    new EvolutionService(effects),
    new SupportService(effects),
    new BattleService(effects),
    new PickService(summon, effects),
    effects,
    new BuffsCalculatorService(),
    rng,
  );
}
```

`testing/engine.ts` devient :

```ts
import type { GameEngine } from '../engine/game-engine';
import type { Rng } from '../engine/rng';
import { createAiEngine } from '../ai/ai-engine';
import { setEvolutionCatalog } from '../helpers/evolution-catalog';
import { fixedRng } from './fixed-rng';
import { allRealCards } from './real-cards';

/** Moteur câblé à la main, comme le ferait Nest, pour les tests. */
export function createEngine(rng: Rng = fixedRng()): GameEngine {
  setEvolutionCatalog(allRealCards());
  return createAiEngine(rng);
}
```

Run: `pnpm --filter @pipou/backend test -- src/fights/ai/planner.spec`
Expected: PASS (le moteur de test est inchangé).

- [ ] **Step 2: Écrire les tests du pool, avec un faux worker**

```ts
// apps/backend/src/fights/ai/ai-mover.spec.ts
import { EventEmitter } from 'node:events';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';
import { AiWorkerPool, WorkerMover } from './ai-mover';
import type { FromWorker, ToWorker, WorkerLike } from './ai-mover';

class FakeWorker extends EventEmitter implements WorkerLike {
  sent: ToWorker[] = [];
  terminated = false;
  constructor(private readonly reply: ((msg: ToWorker) => FromWorker) | null) {
    super();
  }
  postMessage(msg: ToWorker): void {
    this.sent.push(msg);
    if (this.reply && msg.type === 'decide') {
      const out = this.reply(msg);
      setImmediate(() => this.emit('message', out));
    }
  }
  terminate(): Promise<number> {
    this.terminated = true;
    return Promise.resolve(0);
  }
}

const engine = createEngine();
const game = () =>
  scenario({ p1: { monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] } });
const profile = { archetype: 'pipou' as const, level: 3 as const };

describe('WorkerMover', () => {
  it('coup du worker, décisions transmises au journal', async () => {
    const worker = new FakeWorker((msg) => ({
      type: 'decided',
      id: msg.type === 'decide' ? msg.id : 0,
      action: { type: 'end_phase' },
      records: [{ id: 'r1' } as never],
    }));
    const mover = new WorkerMover(new AiWorkerPool(() => worker), 1, 3, engine);
    const sink = jest.fn();
    mover.setDecisionSink(sink, 'pve');
    await expect(mover.decide(game(), 'p1', profile)).resolves.toEqual({ type: 'end_phase' });
    expect(sink).toHaveBeenCalledWith({ id: 'r1' });
    expect(worker.sent[0]).toMatchObject({ type: 'decide', matchId: 1, level: 3, log: 'pve' });
  });

  it('pas de réponse dans le délai : coup glouton légal, worker relancé', async () => {
    const spawned: FakeWorker[] = [];
    const pool = new AiWorkerPool(() => {
      const w = new FakeWorker(null);
      spawned.push(w);
      return w;
    }, 20);
    const mover = new WorkerMover(pool, 1, 3, engine);
    const state = game();
    const action = await mover.decide(state, 'p1', profile);
    expect(engine.dispatch(structuredClone(state), 'p1', action).error).toBeUndefined();
    expect(spawned[0].terminated).toBe(true);
    await mover.decide(state, 'p1', profile);
    expect(spawned).toHaveLength(2);
  });

  it('worker mort pendant la réflexion : repli', async () => {
    const worker = new FakeWorker(null);
    const mover = new WorkerMover(new AiWorkerPool(() => worker), 1, 3, engine);
    const pending = mover.decide(game(), 'p1', profile);
    worker.emit('exit', 1);
    await expect(pending).resolves.toHaveProperty('type');
  });

  it('dispose : le worker oublie la partie', async () => {
    const worker = new FakeWorker((msg) => ({
      type: 'decided',
      id: msg.type === 'decide' ? msg.id : 0,
      action: { type: 'end_phase' },
      records: [],
    }));
    const mover = new WorkerMover(new AiWorkerPool(() => worker), 7, 3, engine);
    await mover.decide(game(), 'p1', profile);
    mover.dispose();
    expect(worker.sent.at(-1)).toEqual({ type: 'dispose', matchId: 7 });
  });
});
```

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- ai-mover.spec`
Expected: FAIL, `Cannot find module './ai-mover'`.

- [ ] **Step 4: Écrire `ai-mover.ts`**

```ts
// apps/backend/src/fights/ai/ai-mover.ts
import { Logger } from '@nestjs/common';
import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { GameAction, Seat } from '@pipou/shared';
import type { GameEngine } from '../engine/game-engine';
import { evolutionCatalog } from '../helpers/evolution-catalog';
import type { GameState } from '../interfaces/game-state.interface';
import { AiPlayer } from './ai-player';
import type { AiLevel, AiProfile } from './ai-player';
import type { DecisionRecord, DecisionSink } from './decision-log';

/** Au-delà, le coup glouton de la note manuelle est joué et le worker relancé. */
export const AI_HARD_LIMIT_MS = 4000;

/** L'IA d'un combat, vue par le service : asynchrone, qu'elle réfléchisse ici ou dans le worker. */
export interface AiMover {
  decide(game: GameState, seat: Seat, profile: AiProfile): Promise<GameAction>;
  setDecisionSink(sink: DecisionSink | null, run?: string): void;
  dispose(): void;
}

/** Réflexion dans le thread principal (tests, AI_WORKER=off). */
export class LocalMover implements AiMover {
  constructor(private readonly ai: AiPlayer) {}

  decide(game: GameState, seat: Seat, profile: AiProfile): Promise<GameAction> {
    return Promise.resolve(this.ai.chooseAction(game, seat, profile));
  }

  setDecisionSink(sink: DecisionSink | null, run = 'run'): void {
    this.ai.setDecisionSink(sink, run);
  }

  dispose(): void {}
}

export type ToWorker =
  | {
      type: 'decide';
      id: number;
      matchId: number;
      level: AiLevel;
      game: GameState;
      seat: Seat;
      profile: AiProfile;
      /** Préfixe du journal de décisions ; null : pas de journal. */
      log: string | null;
    }
  | { type: 'dispose'; matchId: number };

export type FromWorker =
  | { type: 'decided'; id: number; action: GameAction; records: DecisionRecord[] }
  | { type: 'failed'; id: number; message: string };

/** Ce dont le pool a besoin d'un Worker (remplaçable en test). */
export interface WorkerLike {
  postMessage(msg: ToWorker): void;
  on(event: 'message', listener: (msg: FromWorker) => void): unknown;
  on(event: 'error' | 'exit', listener: (arg: unknown) => void): unknown;
  terminate(): Promise<number>;
}

type DecideRequest = Omit<Extract<ToWorker, { type: 'decide' }>, 'id'>;

/** Un seul worker pour toutes les parties ; relancé s'il dépasse le délai ou meurt. */
export class AiWorkerPool {
  private worker: WorkerLike | null = null;
  private next = 1;
  private readonly pending = new Map<number, (reply: FromWorker | null) => void>();

  constructor(
    private readonly spawn: () => WorkerLike,
    private readonly limitMs = AI_HARD_LIMIT_MS,
  ) {}

  /** Réponse du worker, ou null (délai dépassé, worker mort, état non transmissible). */
  ask(request: DecideRequest): Promise<FromWorker | null> {
    const id = this.next++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.restart();
        resolve(null);
      }, this.limitMs);
      this.pending.set(id, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
      try {
        this.ensure().postMessage({ ...request, id });
      } catch {
        this.settle(id, null);
      }
    });
  }

  post(msg: ToWorker): void {
    this.worker?.postMessage(msg);
  }

  dispose(): void {
    this.restart();
  }

  private settle(id: number, reply: FromWorker | null): void {
    const done = this.pending.get(id);
    if (!done) return;
    this.pending.delete(id);
    done(reply);
  }

  private ensure(): WorkerLike {
    if (this.worker) return this.worker;
    const w = this.spawn();
    w.on('message', (reply: FromWorker) => this.settle(reply.id, reply));
    w.on('error', () => {
      if (this.worker === w) this.restart();
    });
    w.on('exit', () => {
      if (this.worker === w) this.restart();
    });
    this.worker = w;
    return w;
  }

  /** Arrête le worker courant ; toutes les réflexions en cours passent en repli. */
  private restart(): void {
    const w = this.worker;
    this.worker = null;
    for (const id of [...this.pending.keys()]) this.settle(id, null);
    void w?.terminate();
  }
}

/** Réflexion dans le worker ; en cas d'échec, coup glouton de la note manuelle ici. */
export class WorkerMover implements AiMover {
  private readonly logger = new Logger(WorkerMover.name);
  private readonly fallback: AiPlayer;
  private sink: DecisionSink | null = null;
  private run = 'run';

  constructor(
    private readonly pool: AiWorkerPool,
    private readonly matchId: number,
    private readonly level: AiLevel,
    engine: GameEngine,
  ) {
    this.fallback = new AiPlayer(engine, Math.random);
  }

  async decide(game: GameState, seat: Seat, profile: AiProfile): Promise<GameAction> {
    const reply = await this.pool.ask({
      type: 'decide',
      matchId: this.matchId,
      level: this.level,
      game,
      seat,
      profile,
      log: this.sink ? this.run : null,
    });
    if (reply?.type === 'decided') {
      for (const record of reply.records) {
        try {
          this.sink?.(record);
        } catch (err) {
          this.logger.warn(`Journal de décisions en échec — ${String(err)}`);
        }
      }
      return reply.action;
    }
    this.logger.warn(
      `Match ${this.matchId} : IA ${reply ? `en échec (${reply.message})` : 'hors délai'}, coup glouton de repli`,
    );
    return this.fallback.chooseAction(game, seat, profile);
  }

  setDecisionSink(sink: DecisionSink | null, run = 'run'): void {
    this.sink = sink;
    this.run = run;
  }

  dispose(): void {
    this.pool.post({ type: 'dispose', matchId: this.matchId });
  }
}

/** Worker hors tests, sauf AI_WORKER=off. */
export function useAiWorker(): boolean {
  return process.env.NODE_ENV !== 'test' && process.env.AI_WORKER !== 'off';
}

/** Lance nn/ai-worker ; en développement (.ts), via ts-node. */
export function spawnAiWorker(): WorkerLike {
  const ts = extname(__filename) === '.ts';
  const file = join(__dirname, 'nn', `ai-worker${ts ? '.ts' : '.js'}`);
  const workerData = { catalog: evolutionCatalog() };
  if (!ts) return new Worker(file, { workerData }) as unknown as WorkerLike;
  const boot = [
    "require('ts-node').register({ transpileOnly: true });",
    "require('tsconfig-paths/register');",
    `require(${JSON.stringify(file)});`,
  ].join('\n');
  return new Worker(boot, { eval: true, workerData }) as unknown as WorkerLike;
}
```

- [ ] **Step 5: Écrire `nn/ai-worker.ts`**

```ts
// apps/backend/src/fights/ai/nn/ai-worker.ts
import { parentPort, workerData } from 'node:worker_threads';
import type { Card } from '../../../cards/card.entity';
import { setEvolutionCatalog } from '../../helpers/evolution-catalog';
import { createAiEngine } from '../ai-engine';
import type { FromWorker, ToWorker } from '../ai-mover';
import type { AiPlayer } from '../ai-player';
import type { DecisionRecord } from '../decision-log';
import { createLevelAi } from '../level-brains';

/**
 * Thread de réflexion de l'IA d'aventure : un AiPlayer par partie (il garde son
 * plan d'un coup à l'autre), poids du réseau chargés une fois.
 */
const port = parentPort!;
setEvolutionCatalog((workerData as { catalog: Card[] }).catalog);
const engine = createAiEngine();
const players = new Map<number, AiPlayer>();
let records: DecisionRecord[] = [];

port.on('message', (msg: ToWorker) => {
  if (msg.type === 'dispose') {
    players.delete(msg.matchId);
    return;
  }
  let ai = players.get(msg.matchId);
  if (!ai) {
    ai = createLevelAi(engine, msg.level);
    if (msg.log !== null) ai.setDecisionSink((r) => records.push(r), msg.log);
    players.set(msg.matchId, ai);
  }
  records = [];
  let reply: FromWorker;
  try {
    const action = ai.chooseAction(msg.game, msg.seat, msg.profile);
    reply = { type: 'decided', id: msg.id, action, records };
  } catch (err) {
    reply = { type: 'failed', id: msg.id, message: err instanceof Error ? err.message : String(err) };
  }
  port.postMessage(reply);
});
```

```ts
// apps/backend/src/fights/ai/nn/ai-worker.spec.ts
import { createEngine } from '../../testing/engine';
import { monsterCard } from '../../testing/cards';
import { scenario } from '../../testing/scenario';
import { AiWorkerPool, WorkerMover, spawnAiWorker } from '../ai-mover';

describe('worker d’IA réel', () => {
  const engine = createEngine(); // remplit le catalogue copié vers le worker
  const pool = new AiWorkerPool(spawnAiWorker, 60_000);
  afterAll(() => pool.dispose());

  it('rend un coup légal', async () => {
    const game = scenario({ p1: { monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] } });
    const mover = new WorkerMover(pool, 1, 2, engine);
    const action = await mover.decide(game, 'p1', { archetype: 'pipou', level: 2 });
    expect(engine.dispatch(structuredClone(game), 'p1', action).error).toBeUndefined();
  }, 90_000);
});
```

- [ ] **Step 6: Lancer les tests**

Run: `pnpm --filter @pipou/backend test -- ai-mover.spec nn/ai-worker.spec`
Expected: PASS (5 tests). Le test réel peut prendre une vingtaine de secondes, le temps que ts-node compile le moteur dans le worker.

- [ ] **Step 7: Brancher le service**

`fights.service.ts` :

1. Imports : remplacer `import type { AiPlayer } from './ai/ai-player';` par :

```ts
import { AiWorkerPool, LocalMover, WorkerMover, spawnAiWorker, useAiWorker } from './ai/ai-mover';
import type { AiMover } from './ai/ai-mover';
```

2. `PveSession` : `ai: AiPlayer;` devient `ai: AiMover;`.
3. Champ de la classe : `private readonly aiPool = useAiWorker() ? new AiWorkerPool(spawnAiWorker) : null;`
4. La classe implémente `OnModuleDestroy` (import de `@nestjs/common`, à ajouter s'il manque) avec :

```ts
  onModuleDestroy(): void {
    this.aiPool?.dispose();
  }
```

   Si la classe a déjà `onModuleDestroy`, y ajouter la ligne.
5. Création (l.246) :

```ts
      const ai: AiMover = this.aiPool
        ? new WorkerMover(this.aiPool, matchId, start.profile.level, this.engine)
        : new LocalMover(createLevelAi(this.engine, start.profile.level));
```

   Les lignes suivantes (`ai.setDecisionSink(sink, …)`) ne changent pas.
6. `aiStep` (l.775) : `const action = await session.ai.decide(game, seat, info.profile);`.
7. `cleanupGame` : avant `this.pve.delete(game.matchId);`, ajouter `session.ai.dispose();`.

Run: `pnpm --filter @pipou/backend test -- fights`
Expected: PASS, y compris `fights-pve.spec.ts` : en test, `LocalMover` enveloppe l'`AiPlayer` créé par `createLevelAi`, donc les espions restent valables. Si un test lit `session.ai` comme un `AiPlayer`, le faire passer par `created.mock.results`, comme l.317.

- [ ] **Step 8: Temps de réflexion des niveaux et assets de build**

`level-brains.ts` : supprimer `AI_TIME_LIMIT_MS`. Mettre les temps du tableau de la spec : 800 pour le niveau 3, 1500 pour le niveau 4 et 2500 pour le niveau 5. Les niveaux 1 et 2 sont gloutons et n'ont pas de plafond.

```ts
  3: { thinking: { beamWidth: 3, depth: 6, ripostes: 0, budget: 1500, timeLimitMs: 800 }, temperature: 30 },
  4: { thinking: { beamWidth: 6, depth: 9, ripostes: 0, budget: 4000, timeLimitMs: 1500 }, temperature: 10 },
  5: { thinking: { ...STRONGEST, timeLimitMs: 2500 }, temperature: 0 },
```

`level-brains.spec.ts` :
- remplacer `for (const p of planned) expect(p.timeLimitMs).toBe(200);` par `expect(planned.map((p) => p.timeLimitMs)).toEqual([800, 1500, 2500]);` ;
- ajouter :

```ts
  it('niveau 5 : déterministe à graine fixe', () => {
    const game = winningAttack();
    const play = () => createLevelAi(engine, 5, seeded(1)).chooseAction(game, 'p2', level(5));
    expect(play()).toEqual(play());
  });
```

  (avec `import { seeded } from './tournament';`).

`nest-cli.json` :

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [{ "include": "fights/ai/nn/weights/*.json", "watchAssets": true }]
  }
}
```

Run :
1. `Copy-Item apps/backend/src/fights/ai/nn/parity-fixture.json apps/backend/src/fights/ai/nn/weights/champion.json` (temporaire)
2. `pnpm --filter @pipou/backend build`
3. `Test-Path apps/backend/dist/fights/ai/nn/weights/champion.json; Test-Path apps/backend/dist/fights/ai/nn/ai-worker.js`
4. `Remove-Item apps/backend/src/fights/ai/nn/weights/champion.json`

Expected: `True` deux fois. Le champion temporaire ne doit **pas** être commité.

- [ ] **Step 9: Essai manuel local (sans Aiven)**

Avec l'environnement de test local (docker `cardcollect_dev`, `ENV_FILE=.env.dev.local`, compte admin local), lancer `pnpm dev` et jouer un combat d'aventure de niveau 5. Vérifier trois points :
- l'IA joue ;
- le serveur reste réactif (le chat et les animations ne gèlent pas) ;
- les logs ne contiennent ni `hors délai` ni d'erreur. Le seul avertissement attendu est `Note réseau indisponible…`, tant qu'il n'y a pas de champion.

Puis relancer avec `AI_WORKER=off` et vérifier que l'IA joue toujours.

- [ ] **Step 10: Vérifier et committer**

Run: `pnpm --filter @pipou/backend typecheck; pnpm --filter @pipou/backend lint; pnpm --filter @pipou/backend test`
Expected: PASS.

```bash
git add apps/backend
git commit -m "feat(ia): réflexion dans un worker avec plafond de 4 s et temps par niveau"
```

---

### Task 12: Guide (README, cours, notebook)

**Files:**
- Create:
  - `tools/ai-train/README.md`
  - `tools/ai-train/COURS.md`
  - `tools/ai-train/make_notebook.py`
  - `tools/ai-train/explore.ipynb` (généré)

**Interfaces:**
- Consumes: tous les fichiers des tâches 8 à 10, et les commandes `ai:selfplay`, `ai:arena`, `ai:check-weights` et `ai:bench`.
- Produces: la documentation. Pas de code de production.

- [ ] **Step 1: Écrire `README.md`**

Sections, dans cet ordre, rédigées en entier :

1. **Ce que fait ce dossier.** Un paragraphe et le schéma de la spec (auto-jeu → entraîneur → note réseau → arène).
2. **Installation (une fois).**

```powershell
# Python 3.12 depuis python.org (cocher « py launcher »), puis :
cd tools/ai-train
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -m pytest -q   # tout doit passer
```

3. **Lancer un entraînement.** `.venv/Scripts/python loop.py --hours 8` ; options `--run`, `--games`, `--budget`, `--workers`. Ctrl+C à tout moment : relancer la même commande reprend. Le PC peut rester utilisable si l'on ajoute `--workers 6`.
4. **Lire le résultat.** `runs/main/report.md` et `progression.png` :
   - perte de validation : elle doit baisser puis se stabiliser ;
   - arène : au moins 55 % pour qu'un challenger soit promu ;
   - jauge : score du champion contre `evaluate.ts` à temps égal. Le but est de dépasser 60 %.
5. **Mettre un champion en prod.**

```powershell
Copy-Item runs/main/champion.json ../../apps/backend/src/fights/ai/nn/weights/champion.json
cd ../..
pnpm --filter @pipou/backend ai:check-weights src/fights/ai/nn/weights/champion.json
pnpm --filter @pipou/backend test -- nn/parity.spec level-brains.spec
pnpm --filter @pipou/backend ai:bench           # niveau 5 sous 2,5 s
git add apps/backend/src/fights/ai/nn/weights/champion.json
git commit -m "feat(ia): champion génération N"
```

   La CI déploie après fusion sur `main`.
6. **Revenir en arrière.** Deux possibilités :
   - variable `AI_EVAL=legacy` sur Render, sans redéploiement de code ;
   - `git revert` du commit du champion.
7. **Comparer deux IA à la main.** Exemples avec `ai:arena` :
   - `--challenger runs/main/gen-007/weights.json --champion legacy --time-ms 200` ;
   - `--challenger level:4 --champion level:3`.
8. **Dépannage.** Quatre cas :
   - `pnpm introuvable` : ouvrir le terminal à la racine du dépôt ;
   - `encodage … attendu …` : l'encodage a changé, il faut repartir avec un nouveau `--run` ;
   - parité refusée : ne pas promouvoir, ouvrir un ticket ;
   - PC trop lent : baisser `--games` ou `--budget`.

- [ ] **Step 2: Écrire `COURS.md`**

Une section par notion. Chaque section contient 5 à 15 lignes d'explication en français simple, sans formule non expliquée, et finit par « Dans le code : » suivi de `fichier:ligne`. Relever les lignes avec la recherche de l'éditeur une fois le code écrit. Sections et contenu :

1. **Neurone et couche.** Somme pondérée + biais. Une couche, c'est plusieurs neurones qui lisent la même entrée. Dans le code : `nn.Linear` de `model.py` (`ValueNet.__init__`) et `dense` de `mlp.ts`.
2. **Activation (ReLU, tanh).** Sans activation, empiler des couches revient à une seule couche. ReLU coupe le négatif. tanh borne la sortie entre −1 et +1, comme le résultat d'une partie. Dans le code : `ValueNet.forward`, `NnModel.value`.
3. **Ce que le réseau prédit.** Le résultat final de la partie (+1, −1, 0) depuis une position. Pourquoi c'est une bonne note pour le planificateur. Dans le code : `collectGame` (étiquette `y`), `nnEvaluator`.
4. **Erreur et MSE.** (prédiction − cible)², en moyenne. Dans le code : `train.py`, `F.mse_loss`.
5. **Descente de gradient et rétropropagation.** Le gradient indique dans quel sens bouger chaque poids pour réduire l'erreur. `loss.backward()` le calcule et `optimizer.step()` applique le pas. Dans le code : la boucle de `train`.
6. **Adam et taux d'apprentissage.** Un pas adapté à chaque poids ; `lr = 1e-3`. Dans le code : `torch.optim.Adam`.
7. **Lots et époques.** 256 positions par pas ; une époque = toutes les positions une fois, dans un ordre mélangé. Dans le code : `order`, `batch_size`.
8. **Sur-apprentissage, validation, arrêt précoce.** Pourquoi une partie entière va d'un seul côté (deux positions d'une même partie se ressemblent trop). `patience`, `best.pt`. Dans le code : `split_by_game`, `train`.
9. **Embeddings.** 8 nombres appris par carte. Des cartes au rôle proche finissent avec des embeddings proches (voir le notebook). Ligne 0 : carte inconnue. Dans le code : `nn.Embedding`, `cardIndex`.
10. **DeepSets.** Une main n'a pas d'ordre. Le même petit réseau encode chaque carte, puis on additionne : le résultat ne dépend pas de l'ordre et accepte n'importe quel nombre de cartes. Pourquoi les decks pèsent 0,1 par carte. Dans le code : `encode_cards`, `SET_SCALE`.
11. **La menace cachée.** Le réseau ne voit pas la main adverse ; il voit le multiensemble de ce qui peut s'y trouver (decklist − cartes vues). Dans le code : `encodePosition`, ensemble `oppHidden`.
12. **Auto-jeu et boucle AlphaZero-lite.** Jouer, apprendre, comparer, promouvoir. Pourquoi l'IA s'améliore sans exemples humains. Température des 8 premiers coups : la variété. Dans le code : `loop.py` (`run_step`), `selfplay.ts`.
13. **Arène et intervalle de Wilson.** Pourquoi 55 % sur 400 parties ne suffit pas toujours à conclure : la borne basse > 50 % garantit que ce n'est pas de la chance. Dans le code : `stats.ts`, `should_promote`.
14. **De Python à TypeScript.** Export JSON, arrondi, parité (même calcul, deux langages). Dans le code : `export.py`, `mlp.ts`, `parity.spec.ts`.
15. **Niveaux et température.** Une température élevée donne des coups variés et plus faibles. Le niveau 5 joue toujours le meilleur. Dans le code : `pickSoftmax`, `LEVEL_BRAINS`.

- [ ] **Step 3: Générer le notebook**

```python
# tools/ai-train/make_notebook.py
"""Génère explore.ipynb (relancer après modification des cellules)."""
import nbformat  # format des notebooks Jupyter (installé avec jupyter)
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook

cells = [
    new_markdown_cell("# Explorer l'IA\nCharger des parties, entraîner un petit réseau en regardant la perte, "
                      "inspecter les embeddings. Lancer d'abord une génération (`loop.py`) "
                      "ou `ai:selfplay` vers `data/essai`."),
    new_code_cell("from pathlib import Path\nimport matplotlib.pyplot as plt\nimport numpy as np\nimport torch\n\n"
                  "from dataset import Meta, load_samples, sample_files, split_by_game\n"
                  "from model import ValueNet\nfrom train import train, evaluate"),
    new_markdown_cell("## 1. Charger des positions\nChoisir un dossier de génération."),
    new_code_cell("data_dir = sorted(Path('data').glob('*/gen-*'))[-1]  # dernière génération trouvée\n"
                  "meta = Meta.load(data_dir / 'meta.json')\n"
                  "samples = load_samples(sample_files([data_dir]), meta)\n"
                  "train_s, val_s = split_by_game(samples)\n"
                  "print(data_dir, len(train_s), 'positions d’entraînement,', len(val_s), 'de validation')"),
    new_markdown_cell("## 2. Ce que contient une position"),
    new_code_cell("s = samples[0]\nprint('résultat :', s.y)\n"
                  "for (k, row, n) in s.counts.tolist()[:10]:\n"
                  "    print(meta.set_names[k], 'carte', meta.card_ids[row - 1], '×', n)"),
    new_markdown_cell("## 3. Entraîner sur un petit échantillon\nLa perte de validation doit baisser, "
                      "puis remonter quand le réseau apprend par cœur (sur-apprentissage)."),
    new_code_cell("history = []\n"
                  "model, info = train(train_s[:3000], val_s[:500], meta, Path('runs/notebook'), epochs=15, patience=15,\n"
                  "                    log=history.append)\n"
                  "val = [float(line.split('validation ')[1]) for line in history if line.startswith('époque')]\n"
                  "plt.plot(range(1, len(val) + 1), val, marker='o'); plt.xlabel('époque'); plt.ylabel('perte de validation')"),
    new_markdown_cell("## 4. Cartes jugées proches\nDistance entre embeddings : des cartes au rôle proche "
                      "devraient être voisines."),
    new_code_cell("emb = model.emb.weight.detach().numpy()[1:]  # sans la ligne 0 (inconnue)\n"
                  "norm = emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-9)\n"
                  "similar = norm @ norm.T\n"
                  "card = 0  # indice de la carte étudiée\n"
                  "for k in np.argsort(-similar[card])[1:6]:\n"
                  "    print(meta.card_ids[k], round(float(similar[card, k]), 3))"),
]
nbformat.write(new_notebook(cells=cells), "explore.ipynb")
print("explore.ipynb écrit")
```

Run (dans `tools/ai-train`) : `.venv/Scripts/python make_notebook.py`
Expected: `explore.ipynb écrit`.

Pour contrôler le notebook :
1. Lancer `pnpm --filter @pipou/backend ai:selfplay ../../tools/ai-train/data/essai/gen-001 --games 40 --budget 200`.
2. Ouvrir `explore.ipynb` avec `.venv/Scripts/jupyter notebook` et exécuter toutes les cellules : aucune erreur.
3. Supprimer `data/essai` et `runs/notebook`.

- [ ] **Step 4: Commit**

```bash
git add tools/ai-train/README.md tools/ai-train/COURS.md tools/ai-train/make_notebook.py tools/ai-train/explore.ipynb
git commit -m "docs(ia): guide d'entraînement, cours et notebook d'exploration"
```

---

### Task 13: Calibrage et premier champion (avec l'utilisateur)

Cette tâche se fait sur le PC de l'utilisateur. Les étapes longues sont lancées par lui ; un agent prépare les commandes et lit les résultats.

**Files:**
- Modify: `tools/ai-train/loop.py` (`DEFAULT_GAMES`), `apps/backend/src/fights/ai/level-brains.ts` (températures et temps, si la mesure l'exige)
- Create (si promu) : `apps/backend/src/fights/ai/nn/weights/champion.json`

**Interfaces:**
- Consumes: tout le reste.
- Produces: `DEFAULT_GAMES` mesuré ; un champion commité, ou un compte rendu qui dit pourquoi il n'y en a pas.

- [ ] **Step 1: Mesurer le débit d'auto-jeu**

Run: `pnpm --filter @pipou/backend ai:selfplay ../../tools/ai-train/data/mesure --games 120 --budget 2000`

Lire `seconds` dans `data/mesure/done.json` et calculer `parties_par_heure = 120 × 3600 / seconds`. Fixer `DEFAULT_GAMES` pour qu'une génération d'auto-jeu dure environ 45 min : `DEFAULT_GAMES = round(0.75 × parties_par_heure, -2)`. Si cela donne moins de 600 parties, refaire la mesure avec `--budget 1000` et retenir ce budget comme défaut de `loop.py` (`--budget`). Supprimer `data/mesure`.

- [ ] **Step 2: Commit du calibrage**

```bash
git add tools/ai-train/loop.py
git commit -m "chore(ia): parties par génération mesurées sur le PC d'entraînement"
```

- [ ] **Step 3: Première session**

L'utilisateur lance : `.venv/Scripts/python loop.py --hours 8`.

Le lendemain, lire `runs/main/report.md` :
- perte de validation en baisse ;
- au moins une promotion ;
- jauge en hausse.

Si aucune génération n'est promue après 4 générations, consulter `train.log` (sur-apprentissage rapide ? baisser `--budget` pour plus de parties) et refaire une session avant d'aller plus loin.

- [ ] **Step 4: Vérifier les critères de la spec**

1. Jauge du champion contre `evaluate.ts` : `ai:arena --challenger <champion> --champion legacy --games 400 --time-ms 200`. Le score doit être d'au moins 60 %.
2. Niveaux : `ai:arena --challenger level:N --champion level:N-1 --games 200` pour N de 2 à 5, après avoir copié le champion en place (Step 5). Chaque score doit être proche de 70 %. Sinon, ajuster les températures de `LEVEL_BRAINS` (plus chaud = plus faible) et recommencer.
3. Temps : `pnpm --filter @pipou/backend ai:bench`. Le niveau 5 doit rester sous 2,5 s par décision.

- [ ] **Step 5: Promouvoir**

```powershell
Copy-Item tools/ai-train/runs/main/champion.json apps/backend/src/fights/ai/nn/weights/champion.json
pnpm --filter @pipou/backend ai:check-weights src/fights/ai/nn/weights/champion.json
pnpm --filter @pipou/backend test
```

```bash
git add apps/backend/src/fights/ai/nn/weights/champion.json apps/backend/src/fights/ai/level-brains.ts
git commit -m "feat(ia): premier champion du réseau de neurones"
```

Ne pas pousser ni fusionner sans l'accord de l'utilisateur. Le déploiement passe par la CI sur `main`.
