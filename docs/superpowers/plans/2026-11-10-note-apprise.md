# Note apprise par auto-jeu — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la note manuelle de l'IA (`evaluate`) par une note dont les poids sont appris sur des parties d'auto-jeu, et le prouver en miroir contre la note actuelle.

**Architecture:** L'état est décrit par un vecteur de caractéristiques (`features.ts`). La note apprise est la somme pondérée de ce vecteur (`learned-eval.ts`), avec des poids générés hors ligne par une régression logistique (`train.ts`) et versionnés (`learned-weights.ts`). La note devient un paramètre du cerveau (`AiPlayer`, `planTurn`), pour que deux notes s'affrontent dans le même processus. Le planificateur, les candidats et le moteur ne changent pas.

**Tech Stack:** TypeScript, Node 22, Jest, ts-node. Aucune dépendance nouvelle.

**Spec:** `docs/superpowers/specs/2026-11-10-note-apprise-design.md`

## Global Constraints

- Tout le code est dans `apps/backend/src/fights/ai/`. Rien dans `@pipou/shared`.
- Aucune dépendance nouvelle, aucun réseau de neurones, aucun appel à un modèle de langage.
- Aucun accès à Aiven. Decks générés en code uniquement (`buildGeneratedEntries(allRealCards(), graine)`).
- Aucune caractéristique ne teste un nom de carte.
- L'IA ne triche pas : les caractéristiques sont calculées sur une copie `determinize(game, seat, random)`.
- Reproductible : mêmes graines et même code donnent les mêmes données, les mêmes poids, le même tournoi, quel que soit le nombre de processus. Pas de `Date.now()` ni de `Math.random()` non figé dans un calcul.
- Render gratuit : aucun calcul ajouté en partie au-delà d'une somme pondérée. Le coût d'une décision ne monte pas de plus de 20 % (`ai:bench`).
- La note manuelle garde son comportement au bit près sous le nom `evaluateLegacy`.
- Échelle : la note apprise est multipliée par `LEARNED_SCALE = 1000`, pour que les constantes comparées à un score (`MODE_TOLL` 5, `MISTAKE_MAX_LOSS` 1000, `IMPROVEMENT_EPSILON`) gardent un sens sans être modifiées.
- Graines de decks : 1 à 30 réservées au banc, aux miroirs et aux tournois ; l'entraînement utilise 101 et au-delà.
- Commentaires et messages de commit en français, style du dépôt (`feat(ia): …`).
- Commandes lancées depuis la racine du dépôt. Tests : `pnpm --filter @pipou/backend test -- <motif>`. Types : `pnpm --filter @pipou/backend typecheck`.
- Tests existants verts à la fin de chaque tâche.

## Fichiers

| Fichier | Rôle |
|---|---|
| `evaluate.ts` (modifié) | Note manuelle, renommée `evaluateLegacy`. Exporte le type `Evaluator` et les aides réutilisées. |
| `features.ts` (créé) | `FEATURE_NAMES`, `features(game, seat, archetype)`. |
| `learned-eval.ts` (créé) | `LearnedWeights`, `Note`, `learnedEvaluator`, `evaluatorOf`, `parseNote`, `LEARNED_SCALE`. |
| `learned-weights.ts` (créé, puis généré) | `LEARNED_WEIGHTS`. |
| `ai-player.ts`, `planner.ts`, `level-brains.ts`, `tournament.ts`, `tournament-jobs.ts`, `tournament-generated.cli.ts`, `ai-explain.cli.ts` (modifiés) | La note devient un paramètre. |
| `selfplay-data.ts`, `selfplay-data.cli.ts` (créés) | Positions étiquetées. |
| `train.ts`, `train.cli.ts` (créés) | Régression logistique, écriture des poids. |
| `rollout.ts` (créé), `ai-rollout.cli.ts` (réécrit), `regret.ts`, `ai-regret.cli.ts` (créés) | Banc de positions et regret. |
| `ai-judge.cli.ts` (supprimé) | Remplacé par le miroir du tournoi. |
| `learned-cases.spec.ts` (créé) | Les deux cas du joueur. |

Écart de nommage avec la spec, voulu : il n'y a plus de fonction `evaluate` nue. Les deux notes s'appellent `evaluateLegacy` et la valeur renvoyée par `evaluatorOf('learned')`. Un appel ne peut donc pas choisir une note par oubli.

---

### Task 1: La note devient un paramètre du cerveau

Refactorisation sans changement de comportement.

**Files:**
- Modify: `apps/backend/src/fights/ai/evaluate.ts`
- Modify: `apps/backend/src/fights/ai/ai-player.ts`
- Modify: `apps/backend/src/fights/ai/planner.ts`
- Modify (renommage seul) : `evaluate.spec.ts`, `ai-player.spec.ts`, `planner.spec.ts`, `ai-explain.cli.ts`, `ai-rollout.cli.ts`, `../engine/ancestral.spec.ts`
- Test: `apps/backend/src/fights/ai/ai-player.spec.ts`, `apps/backend/src/fights/ai/planner.spec.ts`

**Interfaces:**
- Produces:
  - `export type Evaluator = (game: GameState, seat: Seat, archetype: AdventureArchetype, prepare?: boolean, parts?: Record<string, number>) => number`
  - `export function evaluateLegacy(...)` : l'ancien `evaluate`, même signature.
  - Exports nouveaux de `evaluate.ts` : `STAGE_RANK`, `monsterValue`, `isEgg`, `isGrowing`, `damageTo`, `blocked`, `hasAttacksLeft`, `raid`, `reinforcements`, `protectWeight`, `handPrep`, `HandPrep`.
  - `new AiPlayer(engine, random, thinking = 'greedy', mistakeRate = 0, evaluate: Evaluator = evaluateLegacy)`
  - `planTurn(engine, game, seat, profile, thinking, random, counter, visited = new Set(), evaluate: Evaluator = evaluateLegacy)`
  - `riposte(engine, leaf, seat, profile, thinking, random, counter, evaluate: Evaluator = evaluateLegacy)`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `ai-player.spec.ts`, ajouter à la fin du `describe('AiPlayer', …)` :

```ts
  it('joue avec la note qu’on lui donne', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'battle',
      p1: { monsters: [monsterCard('Moucheron', { atk: 0, hp: 100 })] },
      p2: { primes: 1, monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] },
    });
    // Note inversée : la victoire devient le pire état
    const inverted = new AiPlayer(
      engine,
      () => 0.99,
      'greedy',
      0,
      (g, s, a, p) => -evaluateLegacy(g, s, a, p),
    );

    expect(ai.chooseAction(game, 'p2', profile).type).toBe('attack');
    expect(inverted.chooseAction(game, 'p2', profile).type).not.toBe('attack');
  });
```

Dans `planner.spec.ts`, ajouter à la fin du `describe` principal (les noms `engine`, `pipou`, `seeded`, `STRONGEST`, `scenario`, `monsterCard` y sont déjà importés ; ajouter `evaluateLegacy` à l'import de `./evaluate`) :

```ts
  it('planifie avec la note qu’on lui donne', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'battle',
      p1: { monsters: [monsterCard('Moucheron', { atk: 0, hp: 100 })] },
      p2: { primes: 1, monsters: [monsterCard('Lame', { atk: 200, hp: 500 })] },
    });
    const plan = (note?: Parameters<typeof planTurn>[8]) =>
      planTurn(
        engine,
        game,
        'p2',
        pipou,
        STRONGEST,
        seeded(1),
        { used: 0 },
        new Set(),
        note,
      )!;

    expect(plan().actions[0].type).toBe('attack');
    expect(
      plan((g, s, a, p) => -evaluateLegacy(g, s, a, p)).actions[0].type,
    ).not.toBe('attack');
  });
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- ai-player planner`
Expected: FAIL à la compilation, `evaluateLegacy` n'est pas exporté par `./evaluate`.

- [ ] **Step 3: Modifier `evaluate.ts`**

1. Ajouter, après les imports :

```ts
/** Une note d'état : la manuelle (`evaluateLegacy`) ou une note apprise. */
export type Evaluator = (
  game: GameState,
  seat: Seat,
  archetype: AdventureArchetype,
  prepare?: boolean,
  parts?: Record<string, number>,
) => number;
```

2. Renommer `export function evaluate(` en `export function evaluateLegacy(`. Ne rien changer d'autre dans son corps.

3. Ajouter `export` devant : `const STAGE_RANK`, `function monsterValue`, `const isEgg`, `function isGrowing`, `function damageTo`, `const blocked`, `function hasAttacksLeft`, `interface Raid`, `function raid`, `function reinforcements`, `function protectWeight`.

4. Remplacer `handPotential` par un comptage et une pondération séparés (même résultat : ce sont des sommes d'entiers) :

```ts
/** Cartes en main qui ont un usage prêt : évolution, équipement, éphémère ciblé. */
export interface HandPrep {
  evolve: number;
  equip: number;
  target: number;
}

export function handPrep(me: PlayerGameState, opp: PlayerGameState): HandPrep {
  const allies = me.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && !isImplanted(m, me.userId),
  );
  const planted = opp.monsterZones.some(
    (m) => m !== null && isPlantedBy(m, me.userId),
  );
  const enemies = opp.monsterZones.some(
    (m) => m !== null && !isPlantedBy(m, me.userId),
  );
  const out: HandPrep = { evolve: 0, equip: 0, target: 0 };
  for (const { baseCard: card } of me.hand) {
    if (
      card.stage === DrakonStage.YOUNG ||
      card.stage === DrakonStage.ADULT ||
      card.stage === DrakonStage.ANCESTRAL
    ) {
      if (allies.some((m) => canEvolveOnto(card, m))) out.evolve += 1;
    } else if (card.supportType === SupportType.EQUIPMENT) {
      if (allies.length > 0 || planted) out.equip += 1;
    } else if (card.supportType === SupportType.EPHEMERAL) {
      const side = ephemeralTargetSide(card.effects);
      if (
        (side === 'ally' && allies.length > 0) ||
        (side === 'enemy' && enemies)
      )
        out.target += 1;
    }
  }
  return out;
}

/**
 * Ce que la main prépare : une évolution qui a une base, un équipement qui a
 * un porteur, un éphémère ciblé qui a une cible.
 */
export function handPotential(
  me: PlayerGameState,
  opp: PlayerGameState,
  profile: ArchetypeProfile,
): number {
  const n = handPrep(me, opp);
  return (
    n.evolve * profile.prepEvolve +
    n.equip * profile.prepEquip +
    n.target * profile.prepTarget
  );
}
```

- [ ] **Step 4: Modifier `ai-player.ts`**

1. Import : `import { evaluateLegacy } from './evaluate';` et `import type { Evaluator } from './evaluate';` (à la place de `import { evaluate } from './evaluate';`).

2. Constructeur, cinquième paramètre :

```ts
    /** Probabilité de jouer un coup valide au hasard au lieu du meilleur. */
    private readonly mistakeRate = 0,
    /** Note des états : la manuelle par défaut. */
    private readonly evaluate: Evaluator = evaluateLegacy,
  ) {}
```

3. Remplacer les cinq appels `evaluate(` du fichier par `this.evaluate(` (dans `decide` : la fonction passée à `scoreAfterChoice` et `const current = …` ; dans `transformScore` : deux appels ; dans `guardedScore` : un appel).

4. Dans `planned`, passer la note à `planTurn` :

```ts
    const plan = planTurn(
      this.engine,
      game,
      seat,
      profile,
      thinking,
      this.random,
      { used: 0 },
      this.visited.states,
      this.evaluate,
    );
```

- [ ] **Step 5: Modifier `planner.ts`**

1. Import : `import { evaluateLegacy } from './evaluate';` et `import type { Evaluator } from './evaluate';`.

2. `planTurn` : ajouter le neuvième paramètre et l'utiliser.

```ts
  /** États déjà traversés ce tour : la recherche n'y revient pas. */
  visited: ReadonlySet<string> = new Set(),
  /** Note des états. */
  evaluate: Evaluator = evaluateLegacy,
): Plan | null {
```

La ligne `const score = (s: GameState) => evaluate(s, seat, profile.archetype, true);` reste telle quelle : elle utilise maintenant le paramètre.

3. L'appel à `riposte` dans `planTurn` reçoit `evaluate` en dernier argument.

4. `riposte` : ajouter `evaluate: Evaluator = evaluateLegacy` en dernier paramètre. Ses trois appels `evaluate(…)` utilisent le paramètre. Le glouton interne reçoit la même note :

```ts
  const greedy = new AiPlayer(counted, random, 'greedy', 0, evaluate);
```

- [ ] **Step 6: Renommer dans les autres fichiers**

Dans `evaluate.spec.ts`, `ai-player.spec.ts`, `planner.spec.ts`, `ai-explain.cli.ts`, `ai-rollout.cli.ts` et `../engine/ancestral.spec.ts` : remplacer l'import `evaluate` par `evaluateLegacy` et chaque appel `evaluate(` par `evaluateLegacy(`. Dans `evaluate.spec.ts`, le `describe('evaluate', …)` garde son nom.

`ai-rollout.cli.ts` et `ai-judge.cli.ts` ne sont pas suivis par git : les modifier pour que les types passent, sans les ajouter au commit (tâche 7).

- [ ] **Step 7: Vérifier**

Run: `pnpm --filter @pipou/backend typecheck`
Expected: aucune erreur.

Run: `pnpm --filter @pipou/backend test`
Expected: PASS, y compris les deux nouveaux tests.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/fights/ai/evaluate.ts apps/backend/src/fights/ai/ai-player.ts apps/backend/src/fights/ai/planner.ts apps/backend/src/fights/ai/evaluate.spec.ts apps/backend/src/fights/ai/ai-player.spec.ts apps/backend/src/fights/ai/planner.spec.ts apps/backend/src/fights/ai/ai-explain.cli.ts apps/backend/src/fights/engine/ancestral.spec.ts
git commit -m "refactor(ia): la note devient un paramètre du cerveau"
```

---

### Task 2: Décrire un état en nombres

**Files:**
- Create: `apps/backend/src/fights/ai/features.ts`
- Test: `apps/backend/src/fights/ai/features.spec.ts`

**Interfaces:**
- Consumes (tâche 1) : `STAGE_RANK`, `blocked`, `cardUsefulness`, `damageTo`, `handPrep`, `hasAttacksLeft`, `isEgg`, `isGrowing`, `monsterValue`, `protectWeight`, `raid`, `reinforcements` de `./evaluate`.
- Produces :
  - `export const FEATURE_NAMES: readonly [...]` (45 noms, ordre figé)
  - `export type FeatureName = (typeof FEATURE_NAMES)[number]`
  - `export function features(game: GameState, seat: Seat, archetype: AdventureArchetype): number[]` : même longueur et même ordre que `FEATURE_NAMES`. L'appelant fournit un état déjà déterminisé.

- [ ] **Step 1: Écrire les tests qui échouent**

`features.spec.ts` :

```ts
import { monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';
import { FEATURE_NAMES, features } from './features';
import type { FeatureName } from './features';

const named = (f: number[]) =>
  Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, f[i]])) as Record<
    FeatureName,
    number
  >;

describe('features', () => {
  const game = () =>
    scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        primes: 3,
        hand: [monsterCard('Recrue'), monsterCard('Recrue')],
        monsters: [monsterCard('Lame', { atk: 600, hp: 1500 })],
      },
      p2: {
        primes: 1,
        monsters: [
          {
            card: monsterCard('Colosse', { atk: 500, hp: 1000 }),
            currentHp: 400,
          },
        ],
      },
    });

  it('un nombre par nom, tous finis', () => {
    const f = features(game(), 'p1', 'pipou');
    expect(f).toHaveLength(FEATURE_NAMES.length);
    expect(f.every(Number.isFinite)).toBe(true);
    expect(new Set(FEATURE_NAMES).size).toBe(FEATURE_NAMES.length);
  });

  it('décrit les plateaux, la main et les Primes du point de vue du siège', () => {
    const f = named(features(game(), 'p1', 'pipou'));
    expect(f.bias).toBe(1);
    expect(f.myTurn).toBe(1);
    expect(f.myPrimesLeft).toBe(3);
    expect(f.oppPrimesLeft).toBe(1);
    expect(f.oppLastPrime).toBe(1);
    expect(f.myLastPrime).toBe(0);
    expect(f.handCount).toBe(2);
    expect(f.myMonsters).toBe(1);
    expect(f.myAtk).toBe(6);
    expect(f.myHp).toBe(15);
    expect(f.oppMonsters).toBe(1);
    expect(f.oppHp).toBe(4);
    // Moi : 2 en main + 1 monstre ; lui : 1 monstre
    expect(f.cardDiff).toBe(2);
  });

  it('compte les dégâts déjà infligés et ce qu’une attaque achève', () => {
    const f = named(features(game(), 'p1', 'pipou'));
    expect(f.oppMissingHp).toBe(6);
    // Lame (600) achève Colosse (400 PV restants)
    expect(f.finishable).toBe(1);
    // Colosse (500) n'achève pas Lame (1500 PV)
    expect(f.myFinishable).toBe(0);
    expect(f.myMissingHp).toBe(0);
  });

  it('vu de l’autre siège, les côtés s’échangent', () => {
    const f = named(features(game(), 'p2', 'pipou'));
    expect(f.myTurn).toBe(0);
    expect(f.myPrimesLeft).toBe(1);
    expect(f.myMissingHp).toBe(6);
    expect(f.myFinishable).toBe(1);
    expect(f.cardDiff).toBe(-2);
    // Lame tue Colosse en mode ATK : une Prime, et il ne m'en reste qu'une
    expect(f.threatPrimes).toBe(1);
  });

  it('le potentiel ne compte qu’à mon tour', () => {
    expect(named(features(game(), 'p1', 'pipou')).potentialPrimes).toBe(1);
    expect(named(features(game(), 'p2', 'pipou')).potentialPrimes).toBe(0);
  });

  it('ne modifie pas l’état', () => {
    const g = game();
    const before = JSON.stringify(g);
    features(g, 'p1', 'dragon');
    expect(JSON.stringify(g)).toBe(before);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- features`
Expected: FAIL, `Cannot find module './features'`.

- [ ] **Step 3: Écrire `features.ts`**

```ts
import { SupportType, isImplanted } from '@pipou/shared';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type {
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { effectiveAtk, seatPlayer } from '../helpers/game-state.helper';
import { chargesOf } from '../helpers/charges';
import { ARCHETYPE_PROFILES } from './archetype-profiles';
import {
  STAGE_RANK,
  blocked,
  cardUsefulness,
  damageTo,
  handPrep,
  hasAttacksLeft,
  isEgg,
  isGrowing,
  monsterValue,
  protectWeight,
  raid,
  reinforcements,
} from './evaluate';

/**
 * Noms des caractéristiques, dans l'ordre du vecteur. L'ordre est celui des
 * poids appris (`learned-weights.ts`) : en ajouter ou en déplacer une impose
 * de réentraîner.
 */
export const FEATURE_NAMES = [
  'bias',
  'myTurn',
  'turn',
  'myPrimesLeft',
  'oppPrimesLeft',
  'myLastPrime',
  'oppLastPrime',
  'handCount',
  'handUsefulness',
  'oppHandCount',
  'energy',
  'cardDiff',
  'persistents',
  'oppPersistents',
  'charges',
  'oppCharges',
  'counters',
  'counterTurns',
  'myMonsters',
  'myAtk',
  'myHp',
  'myEquipments',
  'myGuard',
  'myMissingHp',
  'oppMonsters',
  'oppAtk',
  'oppHp',
  'oppEquipments',
  'oppGuard',
  'oppMissingHp',
  'finishable',
  'myFinishable',
  'threatPrimes',
  'threatLethal',
  'threatValue',
  'threatCost',
  'threatProtected',
  'potentialPrimes',
  'potentialLethal',
  'stageSum',
  'growingHp',
  'mostEquipped',
  'prepEvolve',
  'prepEquip',
  'prepTarget',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

const sum = <T>(list: readonly T[], f: (x: T) => number) =>
  list.reduce((s, x) => s + f(x), 0);

/** Un Zeta implanté appartient à son poseur : hors du plateau de l'hôte. */
const ownZones = (host: PlayerGameState) =>
  host.monsterZones.map((m) => (m && !isImplanted(m, host.userId) ? m : null));

const persistents = (p: PlayerGameState) =>
  p.supportZones.filter(
    (z) => z?.baseCard.supportType === SupportType.PERSISTENT,
  ).length;

/** Une Charge compte plus à mesure qu'elle approche de son seuil. */
const charges = (p: PlayerGameState) =>
  sum(
    chargesOf(p),
    (c) => 1 + (c.chargeCounters ?? 0) / (c.baseCard.chargeMax ?? 1),
  );

const missingHp = (m: MonsterOnBoard) =>
  Math.max(0, (m.card.baseCard.hp ?? 0) - m.currentHp);

/** Monstres de `targets` qu'une seule attaque d'un monstre de `attackers` détruit. */
function finishableBy(
  targets: readonly MonsterOnBoard[],
  attackers: readonly MonsterOnBoard[],
): number {
  const strikers = attackers.filter((m) => !isEgg(m) && !blocked(m));
  return targets.filter((d) =>
    strikers.some((m) => damageTo(d, m) >= d.currentHp),
  ).length;
}

/**
 * L'état vu par `seat`, en nombres, dans l'ordre de `FEATURE_NAMES`. Aucune
 * pondération ici : c'est le travail des poids appris. L'appelant fournit un
 * état déterminisé (les cartes cachées y sont un tirage plausible).
 */
export function features(
  game: GameState,
  seat: Seat,
  archetype: AdventureArchetype,
): number[] {
  const me = seatPlayer(game, seat);
  const opp = seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
  const profile = ARCHETYPE_PROFILES[archetype];
  const myZones = ownZones(me);
  const oppZones = ownZones(opp);
  const mine = myZones.filter((m): m is MonsterOnBoard => m !== null);
  const theirs = oppZones.filter((m): m is MonsterOnBoard => m !== null);
  const myTurn = game.currentTurnUserId === me.userId;

  const cards = (p: PlayerGameState, board: readonly MonsterOnBoard[]) =>
    p.hand.length +
    board.length +
    sum(board, (m) => m.equipments.length) +
    p.supportZones.filter((c) => c !== null).length;

  // Compteurs de tour : la Prime va à celui qui a posé le monstre
  let counters = 0;
  let counterTurns = 0;
  for (const host of [me, opp])
    for (const m of host.monsterZones)
      if (m && m.turnCounter !== undefined) {
        const sign = (m.ownerUserId ?? host.userId) === me.userId ? 1 : -1;
        counters += sign;
        counterTurns += sign * m.turnCounter;
      }

  // Tour adverse : ses monstres repassent en ATK, ses renforts attaquent
  const threat = raid(
    [...theirs, ...reinforcements(opp)]
      .filter((m) => !isEgg(m) && !blocked(m) && !m.guardLocked)
      .map((m) => ({ m, attacks: m.attacksPerTurn })),
    myZones,
    true,
  );
  const threatPrimes = threat.primes - threat.conceded;

  // Mon tour : Primes encore à prendre avec les attaques qui me restent
  let potentialPrimes = 0;
  if (myTurn && (game.phase === 'main' || game.phase === 'battle')) {
    const potential = raid(
      mine
        .map((m) => ({ m, attacks: hasAttacksLeft(m) }))
        .filter((a) => a.attacks > 0),
      oppZones,
      game.turnNumber > 1,
    );
    potentialPrimes = potential.primes - potential.conceded;
  }

  const prep = handPrep(me, opp);
  const guard = (list: readonly MonsterOnBoard[]) =>
    list.filter((m) => m.mode === 'guard').length;

  const values: Record<FeatureName, number> = {
    bias: 1,
    myTurn: myTurn ? 1 : 0,
    turn: Math.min(game.turnNumber, 20) / 10,
    myPrimesLeft: me.primes,
    oppPrimesLeft: opp.primes,
    myLastPrime: me.primes === 1 ? 1 : 0,
    oppLastPrime: opp.primes === 1 ? 1 : 0,
    handCount: me.hand.length,
    handUsefulness: sum(me.hand, (c) => cardUsefulness(c.baseCard)) / 100,
    oppHandCount: opp.hand.length,
    energy: me.recycleEnergy,
    cardDiff: cards(me, mine) - cards(opp, theirs),
    persistents: persistents(me),
    oppPersistents: persistents(opp),
    charges: charges(me),
    oppCharges: charges(opp),
    counters,
    counterTurns,
    myMonsters: mine.length,
    myAtk: sum(mine, effectiveAtk) / 100,
    myHp: sum(mine, (m) => Math.max(0, m.currentHp)) / 100,
    myEquipments: sum(mine, (m) => m.equipments.length),
    myGuard: guard(mine),
    myMissingHp: sum(mine, missingHp) / 100,
    oppMonsters: theirs.length,
    oppAtk: sum(theirs, effectiveAtk) / 100,
    oppHp: sum(theirs, (m) => Math.max(0, m.currentHp)) / 100,
    oppEquipments: sum(theirs, (m) => m.equipments.length),
    oppGuard: guard(theirs),
    oppMissingHp: sum(theirs, missingHp) / 100,
    finishable: finishableBy(theirs, mine),
    myFinishable: finishableBy(mine, theirs),
    threatPrimes,
    threatLethal: threatPrimes > 0 && threatPrimes >= opp.primes ? 1 : 0,
    threatValue: sum(threat.destroyed, monsterValue) / 100,
    // Cartes payées pour ce que l'adversaire peut détruire : la carte et son coût
    threatCost: sum(threat.destroyed, (d) => 1 + (d.card.baseCard.cost ?? 0)),
    threatProtected: sum(threat.destroyed, (d) =>
      protectWeight(d, myZones, profile),
    ),
    potentialPrimes,
    potentialLethal:
      potentialPrimes > 0 && potentialPrimes >= me.primes ? 1 : 0,
    stageSum: sum(mine, (m) => STAGE_RANK[m.card.baseCard.stage ?? ''] ?? 0),
    growingHp:
      sum(mine, (m) => (isGrowing(m) ? Math.max(0, m.currentHp) : 0)) / 100,
    mostEquipped: Math.max(
      0,
      ...mine
        .filter((m) => m.turnCounter === undefined)
        .map((m) => m.equipments.length),
    ),
    prepEvolve: prep.evolve,
    prepEquip: prep.equip,
    prepTarget: prep.target,
  };
  return FEATURE_NAMES.map((name) => values[name]);
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend test -- features`
Expected: PASS (6 tests).

Si `threatPrimes` ou `potentialPrimes` diffèrent de l'attendu, lire `raid` dans `evaluate.ts` avant de toucher au test : le test décrit la règle (un monstre en mode ATK détruit rapporte une Prime), pas un nombre arbitraire.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/fights/ai/features.ts apps/backend/src/fights/ai/features.spec.ts
git commit -m "feat(ia): caractéristiques d'un état pour la note apprise"
```

---

### Task 3: La note apprise

**Files:**
- Create: `apps/backend/src/fights/ai/learned-eval.ts`
- Create: `apps/backend/src/fights/ai/learned-weights.ts`
- Test: `apps/backend/src/fights/ai/learned-eval.spec.ts`

**Interfaces:**
- Consumes : `FEATURE_NAMES`, `features` (tâche 2) ; `Evaluator`, `evaluateLegacy` (tâche 1).
- Produces :
  - `export interface LearnedWeights { generation: number; trainedAt: string; positions: number; holdoutAccuracy: number; features: readonly string[]; weights: Record<AdventureArchetype, number[]> }`
  - `export type Note = 'legacy' | 'learned' | LearnedWeights`
  - `export const LEARNED_SCALE = 1000`
  - `export function learnedEvaluator(w: LearnedWeights): Evaluator`
  - `export function evaluatorOf(note: Note): Evaluator`
  - `export function parseNote(raw: string | undefined, fallback: Note): Note`
  - `export const LEARNED_WEIGHTS: LearnedWeights` (dans `learned-weights.ts`)

- [ ] **Step 1: Écrire les tests qui échouent**

`learned-eval.spec.ts` :

```ts
import { monsterCard } from '../testing/cards';
import { P1_ID, scenario } from '../testing/scenario';
import { evaluateLegacy } from './evaluate';
import { FEATURE_NAMES, features } from './features';
import {
  LEARNED_SCALE,
  evaluatorOf,
  learnedEvaluator,
  parseNote,
} from './learned-eval';
import type { LearnedWeights } from './learned-eval';
import { LEARNED_WEIGHTS } from './learned-weights';

const weights = (set: Record<string, number>): LearnedWeights => {
  const row = FEATURE_NAMES.map((n) => set[n] ?? 0);
  return {
    generation: 0,
    trainedAt: 'test',
    positions: 0,
    holdoutAccuracy: 0,
    features: [...FEATURE_NAMES],
    weights: { pipou: row, pixelman: row, dragon: row },
  };
};

const game = () =>
  scenario({
    turn: 'p1',
    phase: 'main',
    p1: { monsters: [monsterCard('Lame', { atk: 600, hp: 1500 })] },
    p2: { monsters: [monsterCard('Colosse', { atk: 500, hp: 1000 })] },
  });

describe('note apprise', () => {
  it('somme pondérée des caractéristiques, à l’échelle', () => {
    const note = learnedEvaluator(weights({ myMonsters: 2, oppMonsters: -3 }));
    expect(note(game(), 'p1', 'pipou')).toBe(LEARNED_SCALE * (2 - 3));
  });

  it('le détail s’additionne au score', () => {
    const note = learnedEvaluator(
      weights({ bias: 0.5, myAtk: 0.1, oppHp: -0.2 }),
    );
    const parts: Record<string, number> = {};
    const score = note(game(), 'p1', 'pipou', true, parts);
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(score);
    expect(Object.keys(parts).sort()).toEqual(['bias', 'myAtk', 'oppHp']);
  });

  it('fin de partie : ±Infinity', () => {
    const note = learnedEvaluator(weights({ bias: 1 }));
    const won = { ...game(), phase: 'finished' as const, winner: P1_ID };
    expect(note(won, 'p1', 'pipou')).toBe(Infinity);
    expect(note(won, 'p2', 'pipou')).toBe(-Infinity);
  });

  it('refuse des poids qui ne correspondent pas aux caractéristiques', () => {
    const bad = { ...weights({}), features: ['bias'] };
    expect(() => learnedEvaluator(bad)).toThrow(/caractéristiques/);
  });

  it('les poids versionnés correspondent aux caractéristiques', () => {
    expect(LEARNED_WEIGHTS.features).toEqual([...FEATURE_NAMES]);
    for (const row of Object.values(LEARNED_WEIGHTS.weights))
      expect(row).toHaveLength(features(game(), 'p1', 'pipou').length);
    expect(() => learnedEvaluator(LEARNED_WEIGHTS)).not.toThrow();
  });

  it('evaluatorOf choisit la note', () => {
    expect(evaluatorOf('legacy')).toBe(evaluateLegacy);
    const custom = weights({ myMonsters: 1 });
    expect(evaluatorOf(custom)(game(), 'p1', 'pipou')).toBe(LEARNED_SCALE);
    expect(typeof evaluatorOf('learned')(game(), 'p1', 'pipou')).toBe('number');
  });

  it('parseNote lit un nom ou garde le défaut', () => {
    expect(parseNote(undefined, 'legacy')).toBe('legacy');
    expect(parseNote('learned', 'legacy')).toBe('learned');
    expect(() => parseNote('nimporte', 'legacy')).toThrow(/Note inconnue/);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- learned-eval`
Expected: FAIL, `Cannot find module './learned-eval'`.

- [ ] **Step 3: Écrire `learned-weights.ts` (génération 0, poids nuls)**

Ce fichier sera réécrit par `ai:train adopt` (tâche 6). La génération 0 ne sert qu'à compiler : aucun cerveau ne l'utilise avant l'adoption (tâche 9).

```ts
// Fichier généré par `pnpm --filter @pipou/backend ai:train adopt`. Ne pas modifier à la main.
import type { LearnedWeights } from './learned-eval';
import { FEATURE_NAMES } from './features';

const zeros = FEATURE_NAMES.map(() => 0);

/** Génération 0 : aucun entraînement, poids nuls. */
export const LEARNED_WEIGHTS: LearnedWeights = {
  generation: 0,
  trainedAt: '',
  positions: 0,
  holdoutAccuracy: 0,
  features: [...FEATURE_NAMES],
  weights: { pipou: zeros, pixelman: zeros, dragon: zeros },
};
```

- [ ] **Step 4: Écrire `learned-eval.ts`**

```ts
import { readFileSync } from 'node:fs';
import type { AdventureArchetype } from '@pipou/shared';
import { seatPlayer } from '../helpers/game-state.helper';
import { evaluateLegacy } from './evaluate';
import type { Evaluator } from './evaluate';
import { FEATURE_NAMES, features } from './features';
import { LEARNED_WEIGHTS } from './learned-weights';

/** Poids appris par auto-jeu : un vecteur par archétype, dans l'ordre de `features`. */
export interface LearnedWeights {
  generation: number;
  trainedAt: string;
  /** Positions d'entraînement. */
  positions: number;
  /** Part des parties mises de côté dont le vainqueur est bien prédit. */
  holdoutAccuracy: number;
  /** Noms des caractéristiques au moment de l'entraînement. */
  features: readonly string[];
  weights: Record<AdventureArchetype, number[]>;
}

/** La note d'un cerveau : la manuelle, l'apprise versionnée, ou des poids donnés (essai). */
export type Note = 'legacy' | 'learned' | LearnedWeights;

/**
 * La somme pondérée est un logit (1 = cote de victoire multipliée par e).
 * Multipliée par 1000, elle retrouve l'ordre de grandeur de la note manuelle :
 * `MODE_TOLL` (5) reste un départage, `MISTAKE_MAX_LOSS` (1000) vaut un logit.
 */
export const LEARNED_SCALE = 1000;

/** Partie nulle : à éviter, sans valoir une défaite. */
const DRAW = -10 * LEARNED_SCALE;

export function learnedEvaluator(w: LearnedWeights): Evaluator {
  if (
    w.features.length !== FEATURE_NAMES.length ||
    w.features.some((name, i) => name !== FEATURE_NAMES[i])
  )
    throw new Error(
      `Poids appris (génération ${w.generation}) : les caractéristiques ne correspondent plus à FEATURE_NAMES, il faut réentraîner`,
    );
  return (game, seat, archetype, _prepare, parts) => {
    if (game.phase === 'finished') {
      const me = seatPlayer(game, seat).userId;
      if (game.winner === me) return Infinity;
      if (game.winner != null) return -Infinity;
      return DRAW;
    }
    const f = features(game, seat, archetype);
    const row = w.weights[archetype];
    let score = 0;
    for (let i = 0; i < f.length; i++) {
      const value = LEARNED_SCALE * row[i] * f[i];
      score += value;
      if (parts && value !== 0) parts[FEATURE_NAMES[i]] = value;
    }
    return score;
  };
}

let versioned: Evaluator | undefined;

export function evaluatorOf(note: Note): Evaluator {
  if (note === 'legacy') return evaluateLegacy;
  if (note === 'learned') return (versioned ??= learnedEvaluator(LEARNED_WEIGHTS));
  return learnedEvaluator(note);
}

/** `legacy`, `learned`, ou le chemin d'un fichier de poids `.json` (outils en ligne de commande). */
export function parseNote(raw: string | undefined, fallback: Note): Note {
  if (raw === undefined) return fallback;
  if (raw === 'legacy' || raw === 'learned') return raw;
  if (raw.endsWith('.json'))
    return JSON.parse(readFileSync(raw, 'utf8')) as LearnedWeights;
  throw new Error(`Note inconnue « ${raw} » (legacy, learned, fichier .json)`);
}
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/backend test -- learned-eval`
Expected: PASS (7 tests).

Si le test « fin de partie » échoue sur la construction de l'état, regarder comment `evaluate.spec.ts` ou `planner.spec.ts` construit un état fini et faire pareil : c'est le test qui s'adapte, pas `learnedEvaluator`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/fights/ai/learned-eval.ts apps/backend/src/fights/ai/learned-eval.spec.ts apps/backend/src/fights/ai/learned-weights.ts
git commit -m "feat(ia): note apprise, somme pondérée des caractéristiques"
```

---

### Task 4: Choisir la note d'un cerveau, d'un tournoi, d'un miroir

**Files:**
- Modify: `apps/backend/src/fights/ai/level-brains.ts`
- Modify: `apps/backend/src/fights/ai/tournament.ts`
- Modify: `apps/backend/src/fights/ai/tournament-jobs.ts`
- Modify: `apps/backend/src/fights/ai/tournament-generated.cli.ts`
- Modify: `apps/backend/src/fights/ai/ai-explain.cli.ts`
- Test: `apps/backend/src/fights/ai/tournament.spec.ts`, `apps/backend/src/fights/ai/tournament-jobs.spec.ts`, `apps/backend/src/fights/ai/level-brains.spec.ts`

**Interfaces:**
- Consumes : `Note`, `evaluatorOf`, `parseNote` (tâche 3).
- Produces :
  - `LevelBrain` gagne `note?: Note` (absent = `'legacy'`).
  - `TournamentEntry` gagne `note?: Note` et `mistakeRate?: number`.
  - `brainOf(e): LevelBrain` renvoie aussi `note`.
  - `Job` gagne `note?: Note` et `oldNote?: Note`.
  - `export function mirrorEntries(deckSeed, deck, thinking?, note?, oldNote?): TournamentEntry[]`
  - `tournament:generated` accepte `--note <legacy|learned|fichier.json>` et `--old-note <…>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tournament.spec.ts`, ajouter (importer `brainOf` depuis `./tournament`, `FEATURE_NAMES` depuis `./features`, le type `LearnedWeights` depuis `./learned-eval`) :

```ts
describe('brainOf', () => {
  const base = { name: 'x', archetype: 'pipou' as const, level: 5 as const, deck: [] };
  const custom: LearnedWeights = {
    generation: 9,
    trainedAt: 'test',
    positions: 0,
    holdoutAccuracy: 0,
    features: [...FEATURE_NAMES],
    weights: {
      pipou: FEATURE_NAMES.map(() => 0),
      pixelman: FEATURE_NAMES.map(() => 0),
      dragon: FEATURE_NAMES.map(() => 0),
    },
  };

  it('note manuelle par défaut', () => {
    expect(brainOf({ ...base, brain: 'plan' }).note).toBe('legacy');
    expect(brainOf(base).note).toBe('legacy');
  });

  it('la note et le taux d’erreur de l’entrée priment', () => {
    const brain = brainOf({ ...base, brain: 'plan', note: custom, mistakeRate: 0.1 });
    expect(brain.note).toBe(custom);
    expect(brain.mistakeRate).toBe(0.1);
  });
});
```

Dans `tournament-jobs.spec.ts`, ajouter (importer `mirrorEntries`) :

```ts
describe('mirrorEntries', () => {
  it('sans ancienne note : nouveau planificateur contre glouton', () => {
    const [recent, old] = mirrorEntries(1, 0);
    expect(recent.brain).toBe('plan');
    expect(old.brain).toBe('greedy');
  });

  it('avec deux notes : même planificateur, notes différentes', () => {
    const [recent, old] = mirrorEntries(1, 0, undefined, 'learned', 'legacy');
    expect(recent.brain).toBe('plan');
    expect(old.brain).toBe('plan');
    expect(recent.note).toBe('learned');
    expect(old.note).toBe('legacy');
    expect(recent.deck).toBe(old.deck);
  });
});
```

Dans `level-brains.spec.ts`, ajouter (importer `LEVEL_BRAINS` s'il ne l'est pas) :

```ts
  it('tant que la note apprise n’est pas adoptée, tous les niveaux gardent la manuelle', () => {
    for (const level of [1, 2, 3, 4, 5] as const)
      expect(LEVEL_BRAINS[level].note ?? 'legacy').toBe('legacy');
  });
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- tournament level-brains`
Expected: FAIL (`note` absent de `LevelBrain`, `mirrorEntries` non exporté).

- [ ] **Step 3: `level-brains.ts`**

```ts
import { evaluatorOf } from './learned-eval';
import type { Note } from './learned-eval';

/** Cerveau d'un niveau d'aventure : façon de réfléchir, taux d'erreur, note. */
export interface LevelBrain {
  thinking: ThinkingProfile | 'greedy';
  mistakeRate: number;
  /** Note des états ; absente : la manuelle. */
  note?: Note;
}
```

Et `createLevelAi` :

```ts
  const { thinking, mistakeRate, note } = LEVEL_BRAINS[level];
  return new AiPlayer(
    engine,
    random,
    thinking,
    mistakeRate,
    evaluatorOf(note ?? 'legacy'),
  );
```

- [ ] **Step 4: `tournament.ts`**

1. Imports : `import { evaluatorOf } from './learned-eval';` et `import type { Note } from './learned-eval';`.

2. `TournamentEntry` :

```ts
  /** Réglage du planificateur, par-dessus STRONGEST. */
  thinking?: Partial<ThinkingProfile>;
  /** Note des états ; absente : la manuelle (ou celle du niveau avec `brain: 'level'`). */
  note?: Note;
  /** Taux d'erreur volontaire, à la place de celui du cerveau (exploration). */
  mistakeRate?: number;
```

3. `brainOf` :

```ts
export function brainOf(e: TournamentEntry): LevelBrain {
  const own = (brain: LevelBrain): LevelBrain => ({
    thinking: brain.thinking,
    mistakeRate: e.mistakeRate ?? brain.mistakeRate,
    note: e.note ?? brain.note ?? 'legacy',
  });
  if (e.brain === 'plan')
    return own({ thinking: { ...STRONGEST, ...e.thinking }, mistakeRate: 0 });
  if (e.brain === 'level') {
    const level = LEVEL_BRAINS[e.level];
    if (level.thinking === 'greedy') return own(level);
    const { timeLimitMs: _untimed, ...budgetOnly } = level.thinking;
    return own({ ...level, thinking: budgetOnly });
  }
  return own({ thinking: 'greedy', mistakeRate: 0 });
}
```

4. Dans `playGame`, `aiFor` :

```ts
    const aiFor = (e: TournamentEntry) => {
      const { thinking, mistakeRate, note } = brainOf(e);
      return new AiPlayer(
        engine,
        random,
        thinking,
        mistakeRate,
        evaluatorOf(note ?? 'legacy'),
      );
    };
```

- [ ] **Step 5: `tournament-jobs.ts`**

1. Import : `import type { Note } from './learned-eval';`.

2. `Job` :

```ts
  /** Note du nouveau cerveau (miroir) ou des 15 decks (hors miroir). */
  note?: Note;
  /** Miroir : note de l'ancien cerveau, qui planifie alors comme le nouveau. Absente : ancien = glouton. */
  oldNote?: Note;
```

3. `mirrorEntries`, exportée :

```ts
/** Les deux entrées d'un miroir : même deck, nouveau cerveau contre ancien. */
export function mirrorEntries(
  deckSeed: number,
  deck: number,
  thinking?: Partial<ThinkingProfile>,
  note?: Note,
  oldNote?: Note,
): TournamentEntry[] {
  const e = entriesFor(deckSeed)[deck];
  return [
    { ...e, name: `${e.name} nouveau`, brain: 'plan', thinking, note },
    oldNote === undefined
      ? { ...e, name: `${e.name} ancien`, brain: 'greedy' }
      : { ...e, name: `${e.name} ancien`, brain: 'plan', thinking, note: oldNote },
  ];
}
```

4. `runJob` :

```ts
export function runJob(job: Job): TournamentResult {
  if (job.mirror !== undefined)
    return playPlanned(
      mirrorEntries(job.deckSeed, job.mirror, job.thinking, job.note, job.oldNote),
      job.games,
    );
  const entries = entriesFor(job.deckSeed, job.excluded).map((e) => ({
    ...e,
    brain: job.brain,
    thinking: job.thinking,
    note: job.note,
  }));
  return playPlanned(entries, job.games);
}
```

`planMirrorJobs` ne change pas : les graines des parties ne dépendent pas des notes.

- [ ] **Step 6: `tournament-generated.cli.ts`**

1. Import : `import { parseNote } from './learned-eval';`.

2. Dans le commentaire d'en-tête, ajouter : `` `--note <legacy|learned|fichier.json>` (note des decks, ou du nouveau cerveau en miroir), `--old-note <…>` (miroir : l'ancien planifie avec cette note) ``.

3. Après la lecture de `thinking` :

```ts
  const note = parseNote(raw('note'), 'legacy');
  const rawOld = raw('old-note');
  const oldNote = rawOld === undefined ? undefined : parseNote(rawOld, 'legacy');
```

4. Dans le `.map` des jobs, ajouter `note` et `oldNote` :

```ts
  ).map((j) => ({
    ...j,
    thinking,
    note,
    ...(oldNote !== undefined && { oldNote }),
    ...(excluded.length > 0 && { excluded }),
  }));
```

5. Dans `label`, ajouter un suffixe quand la note n'est pas la manuelle :

```ts
  const noteTag =
    note === 'legacy' ? '' : note === 'learned' ? '-apprise' : `-gen${note.generation}`;
```

et concaténer `noteTag` à la fin de `label`.

- [ ] **Step 7: `ai-explain.cli.ts`**

Ajouter un argument facultatif `--note <legacy|learned|fichier.json>` (défaut `legacy`), lu avec `parseNote`. Remplacer les deux appels `evaluateLegacy(` du fichier par `note(` où `const note = evaluatorOf(parseNote(valeurDeLOption, 'legacy'))`. Le type `Parts` devient `Record<string, number>` et le cast `as ScorePart[]` devient `as string[]` : le détail d'une note apprise porte des noms de caractéristiques.

- [ ] **Step 8: Vérifier**

Run: `pnpm --filter @pipou/backend typecheck`
Expected: aucune erreur.

Run: `pnpm --filter @pipou/backend test`
Expected: PASS.

Run: `pnpm --filter @pipou/backend tournament:generated --deck-seed 1 --games 2 --mirror --note learned --old-note legacy`
Expected: le tournoi se termine et affiche un tableau miroir. Avec des poids nuls, le nouveau cerveau perd nettement : c'est attendu.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/fights/ai/level-brains.ts apps/backend/src/fights/ai/tournament.ts apps/backend/src/fights/ai/tournament-jobs.ts apps/backend/src/fights/ai/tournament-generated.cli.ts apps/backend/src/fights/ai/ai-explain.cli.ts apps/backend/src/fights/ai/tournament.spec.ts apps/backend/src/fights/ai/tournament-jobs.spec.ts apps/backend/src/fights/ai/level-brains.spec.ts
git commit -m "feat(ia): note au choix par cerveau, tournoi et miroir"
```

---

### Task 5: Produire des positions étiquetées

**Files:**
- Modify: `apps/backend/src/fights/ai/tournament.ts` (observateur de `playGame`)
- Create: `apps/backend/src/fights/ai/selfplay-data.ts`
- Create: `apps/backend/src/fights/ai/selfplay-data.cli.ts`
- Modify: `apps/backend/package.json` (script `ai:selfplay-data`)
- Test: `apps/backend/src/fights/ai/selfplay-data.spec.ts`

**Interfaces:**
- Consumes : `features`, `FEATURE_NAMES` (tâche 2) ; `Note`, `parseNote` (tâche 3) ; `TournamentEntry.note`, `.mistakeRate` (tâche 4).
- Produces :
  - `playGame(p1, p2, seed, maxActions, sink?, observe?: (game: GameState, seat: Seat) => void)` : `observe` est appelé après chaque coup, avec le siège qui vient de jouer.
  - `export interface Sample { g: number; s: Seat; a: AdventureArchetype; o: AdventureArchetype; end: boolean; f: number[]; y: number }`
  - `export function collectGame(p1: TournamentEntry, p2: TournamentEntry, seed: number, g: number): Sample[]`
  - `export const SAMPLES_PER_KIND = 4`
  - Fichier de données : une ligne JSON par `Sample`, triées par `g`.

Positions retenues : les états juste après un coup du joueur. `end: false` s'il doit encore jouer (milieu de tour), `end: true` sinon (son tour est fini ou l'adversaire a un choix). Au plus `SAMPLES_PER_KIND` de chaque sorte par joueur et par partie, donc au plus 16 lignes par partie. Les deux sortes sont nécessaires : le planificateur note les deux.

- [ ] **Step 1: Écrire les tests qui échouent**

`selfplay-data.spec.ts` :

```ts
import { allRealCards } from '../testing/real-cards';
import { FEATURE_NAMES } from './features';
import { buildGeneratedEntries } from './generated-entries';
import { SAMPLES_PER_KIND, collectGame } from './selfplay-data';

const [a, b] = buildGeneratedEntries(allRealCards(), 1).filter(
  (e) => e.level === 5,
);

describe('collectGame', () => {
  const samples = collectGame(a, b, 123, 7);

  it('des positions des deux joueurs, des deux sortes, sans dépasser le plafond', () => {
    for (const s of ['p1', 'p2'] as const)
      for (const end of [true, false]) {
        const kind = samples.filter((x) => x.s === s && x.end === end);
        expect(kind.length).toBeGreaterThan(0);
        expect(kind.length).toBeLessThanOrEqual(SAMPLES_PER_KIND);
      }
  });

  it('chaque ligne porte la partie, les archétypes et un vecteur complet', () => {
    for (const x of samples) {
      expect(x.g).toBe(7);
      expect(x.f).toHaveLength(FEATURE_NAMES.length);
      expect(x.f.every(Number.isFinite)).toBe(true);
      expect(x.a).toBe(x.s === 'p1' ? a.archetype : b.archetype);
      expect(x.o).toBe(x.s === 'p1' ? b.archetype : a.archetype);
    }
  });

  it('les étiquettes des deux joueurs se complètent', () => {
    const y = (s: 'p1' | 'p2') => samples.find((x) => x.s === s)!.y;
    expect(y('p1') + y('p2')).toBe(1);
    expect([0, 0.5, 1]).toContain(y('p1'));
  });

  it('reproductible', () => {
    expect(collectGame(a, b, 123, 7)).toEqual(samples);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- selfplay-data`
Expected: FAIL, `Cannot find module './selfplay-data'`.

- [ ] **Step 3: Observateur dans `playGame` (`tournament.ts`)**

Ajouter l'import de type `GameState` (`import type { CardInstance, GameState } from '../interfaces/game-state.interface';`), le sixième paramètre et son appel :

```ts
  /** Journal des décisions (diagnostic) ; n'influe pas sur la partie. */
  sink?: DecisionSink,
  /** Appelé après chaque coup, avec le siège qui vient de jouer ; ne doit pas modifier l'état. */
  observe?: (game: GameState, seat: Seat) => void,
): { winner: 0 | 1 | null; telemetry: Telemetry } {
```

```ts
      engine.dispatch(game, actor.seat, action);
      recorder.afterAction(game);
      observe?.(game, actor.seat);
      actions++;
```

- [ ] **Step 4: Écrire `selfplay-data.ts`**

```ts
import type { AdventureArchetype, Seat } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { seatPlayer } from '../helpers/game-state.helper';
import { aiMustAct } from './ai-player';
import { determinize } from './determinize';
import { features } from './features';
import { MAX_ACTIONS, playGame, seeded } from './tournament';
import type { TournamentEntry } from './tournament';

/** Une position étiquetée par le résultat de sa partie. */
export interface Sample {
  /** Rang de la partie : sert à trier et à mettre des parties de côté. */
  g: number;
  s: Seat;
  /** Archétype du joueur, puis de son adversaire. */
  a: AdventureArchetype;
  o: AdventureArchetype;
  /** true : le joueur n'a plus à jouer (fin de tour) ; false : milieu de tour. */
  end: boolean;
  f: number[];
  /** 1 victoire, 0 défaite, 0,5 sans vainqueur. */
  y: number;
}

/** Positions gardées par joueur, par partie et par sorte (milieu ou fin de tour). */
export const SAMPLES_PER_KIND = 4;

interface Reservoir {
  seen: number;
  kept: number[][];
}

/**
 * Joue une partie et en tire des positions, vues par le joueur qui vient de
 * jouer, sur une copie déterminisée. Le tirage des positions a son propre
 * générateur : la partie est la même avec ou sans collecte.
 */
export function collectGame(
  p1: TournamentEntry,
  p2: TournamentEntry,
  seed: number,
  g: number,
): Sample[] {
  const pick = seeded(seed ^ 0x51ed270b);
  const entry = { p1, p2 };
  const pools: Record<Seat, Record<'end' | 'mid', Reservoir>> = {
    p1: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
    p2: { end: { seen: 0, kept: [] }, mid: { seen: 0, kept: [] } },
  };

  const observe = (game: GameState, seat: Seat) => {
    // Une fin de partie n'a pas besoin d'être apprise : elle vaut ±Infinity
    if (game.phase === 'finished') return;
    const kind = aiMustAct(game, seatPlayer(game, seat).userId) ? 'mid' : 'end';
    const pool = pools[seat][kind];
    pool.seen++;
    // Échantillonnage par réservoir : chaque position a la même chance
    let slot = pool.kept.length;
    if (slot >= SAMPLES_PER_KIND) {
      slot = Math.floor(pick() * pool.seen);
      if (slot >= SAMPLES_PER_KIND) return;
    }
    pool.kept[slot] = features(
      determinize(game, seat, pick),
      seat,
      entry[seat].archetype,
    );
  };

  const { winner } = playGame(p1, p2, seed, MAX_ACTIONS, undefined, observe);
  const label = (seat: Seat) =>
    winner === null ? 0.5 : (winner === 0) === (seat === 'p1') ? 1 : 0;

  const out: Sample[] = [];
  for (const s of ['p1', 'p2'] as const)
    for (const kind of ['end', 'mid'] as const)
      for (const f of pools[s][kind].kept)
        out.push({
          g,
          s,
          a: entry[s].archetype,
          o: entry[s === 'p1' ? 'p2' : 'p1'].archetype,
          end: kind === 'end',
          f,
          y: label(s),
        });
  return out;
}
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/backend test -- selfplay-data tournament`
Expected: PASS.

- [ ] **Step 6: Écrire `selfplay-data.cli.ts`**

```ts
import { fork } from 'node:child_process';
import { appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { extname } from 'node:path';
import { allRealCards } from '../testing/real-cards';
import { buildGeneratedEntries } from './generated-entries';
import { parseNote } from './learned-eval';
import type { Note } from './learned-eval';
import { collectGame } from './selfplay-data';
import type { Sample } from './selfplay-data';
import { planGames } from './tournament';
import type { TournamentEntry } from './tournament';

/**
 * Positions étiquetées par auto-jeu, pour l'entraînement de la note.
 *
 *   pnpm --filter @pipou/backend ai:selfplay-data <sortie.jsonl>
 *     [--deck-seeds 95] [--first-deck-seed 101] [--games 2] [--seed 7]
 *     [--explore 0.1] [--note legacy|learned|fichier.json] [--workers N]
 *
 * Tous les decks jouent avec le planificateur le plus fort et la note donnée,
 * plus `--explore` de coups plausibles tirés au hasard. Le fichier est écrasé.
 * Les graines de decks commencent à 101 : 1 à 30 sont réservées aux contrôles.
 */
function raw(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const num = (name: string, fallback: number) =>
  raw(name) === undefined ? fallback : Number(raw(name));

interface Planned {
  g: number;
  p1: TournamentEntry;
  p2: TournamentEntry;
  seed: number;
}

/** Toutes les parties, dans un ordre qui ne dépend pas du nombre de processus. */
function plan(note: Note, explore: number): Planned[] {
  const cards = allRealCards();
  const first = num('first-deck-seed', 101);
  const out: Planned[] = [];
  for (let d = 0; d < num('deck-seeds', 95); d++) {
    const entries = buildGeneratedEntries(cards, first + d).map((e) => ({
      ...e,
      brain: 'plan' as const,
      note,
      mistakeRate: explore,
    }));
    const seed = num('seed', 7) + (first + d) * 1_000_003;
    for (const game of planGames(entries, num('games', 2), seed))
      out.push({
        g: out.length,
        p1: entries[game.p1],
        p2: entries[game.p2],
        seed: game.seed,
      });
  }
  return out;
}

const part = (out: string, shard: number) => `${out}.part${shard}`;

function runShard(out: string, shard: number, shards: number): void {
  const games = plan(
    parseNote(raw('note'), 'legacy'),
    num('explore', 0.1),
  ).filter((game) => game.g % shards === shard);
  writeFileSync(part(out, shard), '');
  for (const game of games) {
    const lines = collectGame(game.p1, game.p2, game.seed, game.g)
      .map((s) => JSON.stringify(s))
      .join('\n');
    if (lines) appendFileSync(part(out, shard), `${lines}\n`);
  }
}

function forkShard(shard: number, shards: number): Promise<void> {
  const ts = extname(__filename) === '.ts';
  const child = fork(
    __filename,
    [...process.argv.slice(2), '--shard', String(shard), '--shards', String(shards)],
    {
      execArgv: ts ? ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'] : [],
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  );
  return new Promise((resolve, reject) =>
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Processus ${shard} arrêté (code ${code})`)),
    ),
  );
}

async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out || out.startsWith('--'))
    throw new Error('Usage : ai:selfplay-data <sortie.jsonl> [options]');
  const shard = raw('shard');
  if (shard !== undefined) {
    runShard(out, Number(shard), num('shards', 1));
    return;
  }
  const workers = num('workers', Math.max(1, cpus().length - 2));
  const started = Date.now();
  console.log(`Auto-jeu sur ${workers} processus…`);
  await Promise.all(
    Array.from({ length: workers }, (_, i) => forkShard(i, workers)),
  );
  // Tri par partie : le fichier ne dépend pas du nombre de processus
  const lines: { g: number; line: string }[] = [];
  for (let i = 0; i < workers; i++) {
    for (const line of readFileSync(part(out, i), 'utf8').split('\n'))
      if (line) lines.push({ g: (JSON.parse(line) as Sample).g, line });
    rmSync(part(out, i));
  }
  lines.sort((x, y) => x.g - y.g);
  writeFileSync(out, lines.map((l) => l.line).join('\n') + '\n');
  const games = new Set(lines.map((l) => l.g)).size;
  console.log(
    `${lines.length} positions de ${games} parties en ${Math.round((Date.now() - started) / 1000)} s : ${out}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

`Array.prototype.sort` est stable : les lignes d'une même partie gardent l'ordre d'écriture.

- [ ] **Step 7: Script `package.json`**

Dans `apps/backend/package.json`, après la ligne `"ai:explain"` :

```json
    "ai:selfplay-data": "ts-node -r tsconfig-paths/register src/fights/ai/selfplay-data.cli.ts",
```

- [ ] **Step 8: Essai réel, et preuve que le découpage ne change rien**

```bash
pnpm --filter @pipou/backend ai:selfplay-data .e2e/essai-a.jsonl --deck-seeds 1 --games 1 --workers 2
pnpm --filter @pipou/backend ai:selfplay-data .e2e/essai-b.jsonl --deck-seeds 1 --games 1 --workers 5
cmp apps/backend/.e2e/essai-a.jsonl apps/backend/.e2e/essai-b.jsonl && echo IDENTIQUES
```

Expected: chaque commande annonce environ 1 600 positions de 105 parties, puis `IDENTIQUES`. Supprimer les deux fichiers d'essai ensuite.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/fights/ai/tournament.ts apps/backend/src/fights/ai/selfplay-data.ts apps/backend/src/fights/ai/selfplay-data.cli.ts apps/backend/src/fights/ai/selfplay-data.spec.ts apps/backend/package.json
git commit -m "feat(ia): positions étiquetées par auto-jeu"
```

---

### Task 6: Entraîner les poids

**Files:**
- Create: `apps/backend/src/fights/ai/train.ts`
- Create: `apps/backend/src/fights/ai/train.cli.ts`
- Modify: `apps/backend/package.json` (script `ai:train`)
- Test: `apps/backend/src/fights/ai/train.spec.ts`

**Interfaces:**
- Consumes : `Sample` (tâche 5), `LearnedWeights` (tâche 3), `FEATURE_NAMES` (tâche 2).
- Produces :
  - `export interface TrainOptions { iterations: number; learningRate: number; l2: number }`
  - `export const DEFAULT_TRAIN: TrainOptions`
  - `export function fit(rows: readonly { f: readonly number[]; y: number }[], opts?: TrainOptions): number[]` : poids bruts ; l'indice 0 est le biais (caractéristique constante à 1).
  - `export function predict(weights: readonly number[], f: readonly number[]): number` : probabilité de victoire.
  - `export const isHoldout = (g: number) => g % 10 === 0`
  - `export function train(samples: readonly Sample[], generation: number, trainedAt: string, opts?: TrainOptions): { weights: LearnedWeights; byArchetype: Record<AdventureArchetype, { positions: number; accuracy: number; loss: number }> }`
  - `export function weightsModule(w: LearnedWeights): string` : source de `learned-weights.ts`.
  - CLI : `ai:train train <données.jsonl…> --generation N --out <poids.json>` et `ai:train adopt <poids.json>`.

- [ ] **Step 1: Écrire les tests qui échouent**

`train.spec.ts` :

```ts
import { FEATURE_NAMES } from './features';
import type { Sample } from './selfplay-data';
import { seeded } from './tournament';
import { fit, isHoldout, predict, train, weightsModule } from './train';

/** Victoire quand x1 est grand et x2 petit ; x3 ne varie jamais. */
function synthetic(n: number, seed: number) {
  const random = seeded(seed);
  return Array.from({ length: n }, () => {
    const x1 = random() * 10;
    const x2 = random() * 500;
    const p = 1 / (1 + Math.exp(-(0.8 * (x1 - 5) - 0.01 * (x2 - 250))));
    return { f: [1, x1, x2, 3], y: random() < p ? 1 : 0 };
  });
}

describe('fit', () => {
  const rows = synthetic(4000, 1);
  const w = fit(rows);

  it('retrouve le sens et l’ordre de grandeur des poids', () => {
    expect(w[1]).toBeGreaterThan(0.5);
    expect(w[1]).toBeLessThan(1.1);
    expect(w[2]).toBeLessThan(-0.006);
    expect(w[2]).toBeGreaterThan(-0.014);
  });

  it('une caractéristique qui ne varie pas reçoit un poids nul', () => {
    expect(w[3]).toBe(0);
  });

  it('prédit bien des positions jamais vues', () => {
    const fresh = synthetic(2000, 2);
    const right = fresh.filter((r) => predict(w, r.f) > 0.5 === (r.y === 1));
    expect(right.length / fresh.length).toBeGreaterThan(0.8);
  });

  it('reproductible', () => {
    expect(fit(rows)).toEqual(w);
  });

  it('sans données : aucun poids', () => {
    expect(fit([])).toEqual([]);
  });
});

describe('train', () => {
  const index = FEATURE_NAMES.indexOf('myMonsters');
  const samples: Sample[] = [];
  const random = seeded(3);
  for (let g = 0; g < 600; g++)
    for (const a of ['pipou', 'pixelman', 'dragon'] as const) {
      const f = FEATURE_NAMES.map(() => 0);
      f[0] = 1;
      f[index] = Math.floor(random() * 4);
      // Plus de monstres, plus de victoires
      const y = random() < 0.15 + 0.23 * f[index] ? 1 : 0;
      samples.push({ g, s: 'p1', a, o: 'pipou', end: true, f, y });
    }
  const { weights, byArchetype } = train(samples, 1, '2026-11-10');

  it('un vecteur par archétype, de la bonne longueur', () => {
    for (const a of ['pipou', 'pixelman', 'dragon'] as const) {
      expect(weights.weights[a]).toHaveLength(FEATURE_NAMES.length);
      expect(weights.weights[a][index]).toBeGreaterThan(0);
      expect(byArchetype[a].accuracy).toBeGreaterThan(0.6);
    }
    expect(weights.features).toEqual([...FEATURE_NAMES]);
    expect(weights.generation).toBe(1);
  });

  it('une partie sur dix est mise de côté, entière', () => {
    expect(isHoldout(20)).toBe(true);
    expect(isHoldout(21)).toBe(false);
    const kept = samples.filter((s) => !isHoldout(s.g)).length;
    expect(weights.positions).toBe(kept);
  });

  it('le module généré redonne les mêmes poids', () => {
    const source = weightsModule(weights);
    expect(source).toContain('export const LEARNED_WEIGHTS: LearnedWeights =');
    const json = source.slice(source.indexOf('= {') + 2, source.lastIndexOf(';'));
    expect(JSON.parse(json)).toEqual(weights);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- train`
Expected: FAIL, `Cannot find module './train'`.

- [ ] **Step 3: Écrire `train.ts`**

```ts
import type { AdventureArchetype } from '@pipou/shared';
import { FEATURE_NAMES } from './features';
import type { LearnedWeights } from './learned-eval';
import type { Sample } from './selfplay-data';

export interface TrainOptions {
  /** Passes de descente de gradient sur toutes les positions. */
  iterations: number;
  learningRate: number;
  /** Régularisation L2 : retient les poids des caractéristiques peu informatives. */
  l2: number;
}

export const DEFAULT_TRAIN: TrainOptions = {
  iterations: 400,
  learningRate: 0.5,
  l2: 0.001,
};

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Probabilité de victoire prédite par des poids bruts. */
export function predict(
  weights: readonly number[],
  f: readonly number[],
): number {
  let x = 0;
  for (let j = 0; j < f.length; j++) x += weights[j] * f[j];
  return sigmoid(x);
}

/**
 * Régression logistique par descente de gradient sur tout le jeu de données.
 * L'indice 0 est le biais (caractéristique constante à 1). Les autres sont
 * centrées et réduites pour l'ajustement, puis les poids sont ramenés à
 * l'échelle brute : la note n'a rien à normaliser en partie.
 */
export function fit(
  rows: readonly { f: readonly number[]; y: number }[],
  opts: TrainOptions = DEFAULT_TRAIN,
): number[] {
  const n = rows.length;
  if (n === 0) return [];
  const d = rows[0].f.length;
  const mean = new Array<number>(d).fill(0);
  const std = new Array<number>(d).fill(0);
  for (const r of rows) for (let j = 1; j < d; j++) mean[j] += r.f[j] / n;
  for (const r of rows)
    for (let j = 1; j < d; j++) std[j] += (r.f[j] - mean[j]) ** 2 / n;
  for (let j = 1; j < d; j++) std[j] = Math.sqrt(std[j]);
  // Une caractéristique qui ne varie pas n'apprend rien : poids nul
  const live: number[] = [];
  for (let j = 1; j < d; j++) if (std[j] > 1e-9) live.push(j);

  const z = rows.map((r) =>
    Float64Array.from(live, (j) => (r.f[j] - mean[j]) / std[j]),
  );
  const w = new Float64Array(live.length);
  const grad = new Float64Array(live.length);
  let bias = 0;
  for (let it = 0; it < opts.iterations; it++) {
    grad.fill(0);
    let gradBias = 0;
    for (let i = 0; i < n; i++) {
      const zi = z[i];
      let x = bias;
      for (let k = 0; k < w.length; k++) x += w[k] * zi[k];
      const error = sigmoid(x) - rows[i].y;
      gradBias += error;
      for (let k = 0; k < w.length; k++) grad[k] += error * zi[k];
    }
    bias -= (opts.learningRate * gradBias) / n;
    for (let k = 0; k < w.length; k++)
      w[k] -= opts.learningRate * (grad[k] / n + opts.l2 * w[k]);
  }

  const raw = new Array<number>(d).fill(0);
  raw[0] = bias;
  live.forEach((j, k) => {
    raw[j] = w[k] / std[j];
    raw[0] -= (w[k] * mean[j]) / std[j];
  });
  return raw;
}

/** Une partie sur dix est mise de côté, entière, pour vérifier la prédiction. */
export const isHoldout = (g: number) => g % 10 === 0;

const ARCHETYPES: AdventureArchetype[] = ['pipou', 'pixelman', 'dragon'];

/** Un jeu de poids par archétype, et sa précision sur les parties mises de côté. */
export function train(
  samples: readonly Sample[],
  generation: number,
  trainedAt: string,
  opts: TrainOptions = DEFAULT_TRAIN,
): {
  weights: LearnedWeights;
  byArchetype: Record<
    AdventureArchetype,
    { positions: number; accuracy: number; loss: number }
  >;
} {
  const zeros = () => FEATURE_NAMES.map(() => 0);
  const weights = {} as Record<AdventureArchetype, number[]>;
  const byArchetype = {} as Record<
    AdventureArchetype,
    { positions: number; accuracy: number; loss: number }
  >;
  let positions = 0;
  let right = 0;
  let decided = 0;
  for (const a of ARCHETYPES) {
    const own = samples.filter((s) => s.a === a);
    const learn = own.filter((s) => !isHoldout(s.g));
    const check = own.filter((s) => isHoldout(s.g));
    const w = fit(learn, opts);
    weights[a] = w.length === FEATURE_NAMES.length ? w : zeros();
    positions += learn.length;
    let ok = 0;
    let n = 0;
    let loss = 0;
    for (const s of check) {
      const p = Math.min(1 - 1e-12, Math.max(1e-12, predict(weights[a], s.f)));
      loss -= s.y * Math.log(p) + (1 - s.y) * Math.log(1 - p);
      // Une partie sans vainqueur n'a pas de bonne réponse
      if (s.y === 0.5) continue;
      n++;
      if (p > 0.5 === (s.y === 1)) ok++;
    }
    right += ok;
    decided += n;
    byArchetype[a] = {
      positions: learn.length,
      accuracy: n === 0 ? 0 : ok / n,
      loss: check.length === 0 ? 0 : loss / check.length,
    };
  }
  return {
    weights: {
      generation,
      trainedAt,
      positions,
      holdoutAccuracy: decided === 0 ? 0 : right / decided,
      features: [...FEATURE_NAMES],
      weights,
    },
    byArchetype,
  };
}

/** Source de `learned-weights.ts` pour ces poids. */
export function weightsModule(w: LearnedWeights): string {
  return [
    '// Fichier généré par `pnpm --filter @pipou/backend ai:train adopt`. Ne pas modifier à la main.',
    "import type { LearnedWeights } from './learned-eval';",
    '',
    `/** Génération ${w.generation}, ${w.trainedAt} : ${w.positions} positions, ${(100 * w.holdoutAccuracy).toFixed(1)} % de vainqueurs bien prédits sur les parties mises de côté. */`,
    `export const LEARNED_WEIGHTS: LearnedWeights = ${JSON.stringify(w, null, 2)};`,
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend test -- train`
Expected: PASS (8 tests).

Si « retrouve le sens et l'ordre de grandeur » échoue par sous-apprentissage (poids trop petits), augmenter `iterations` dans `DEFAULT_TRAIN` (800), pas les bornes du test.

- [ ] **Step 5: Écrire `train.cli.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_NAMES } from './features';
import type { LearnedWeights } from './learned-eval';
import type { Sample } from './selfplay-data';
import { train, weightsModule } from './train';

/**
 * Entraîne la note sur des positions d'auto-jeu, ou adopte un fichier de poids.
 *
 *   pnpm --filter @pipou/backend ai:train train <données.jsonl> [autres.jsonl…]
 *     --generation <n> --out <poids.json> [--date AAAA-MM-JJ]
 *   pnpm --filter @pipou/backend ai:train adopt <poids.json>
 *
 * `adopt` réécrit `learned-weights.ts` : à faire seulement après les contrôles
 * (banc de positions, miroir).
 */
function raw(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function runTrain(files: string[]): void {
  const out = raw('out');
  const generation = Number(raw('generation'));
  if (files.length === 0 || !out || !Number.isInteger(generation))
    throw new Error(
      'Usage : ai:train train <données.jsonl…> --generation <n> --out <poids.json>',
    );
  const samples: Sample[] = [];
  for (const file of files)
    for (const line of readFileSync(file, 'utf8').split('\n'))
      if (line) samples.push(JSON.parse(line) as Sample);
  // La date est une étiquette : elle n'entre dans aucun calcul
  const date = raw('date') ?? new Date().toISOString().slice(0, 10);
  const { weights, byArchetype } = train(samples, generation, date);
  writeFileSync(out, JSON.stringify(weights, null, 2));

  console.log(
    `Génération ${generation} : ${weights.positions} positions, ${(100 * weights.holdoutAccuracy).toFixed(1)} % de vainqueurs bien prédits (parties mises de côté).`,
  );
  for (const [a, r] of Object.entries(byArchetype)) {
    console.log(
      `\n${a} : ${r.positions} positions, précision ${(100 * r.accuracy).toFixed(1)} %, perte ${r.loss.toFixed(4)}`,
    );
    const row = weights.weights[a as keyof typeof weights.weights];
    FEATURE_NAMES.map((name, i) => ({ name, w: row[i] }))
      .sort((x, y) => Math.abs(y.w) - Math.abs(x.w))
      .slice(0, 10)
      .forEach(({ name, w }) =>
        console.log(`  ${name.padEnd(16)} ${w >= 0 ? '+' : ''}${w.toFixed(4)}`),
      );
  }
  console.log(`\nPoids : ${out}`);
}

function runAdopt(file: string | undefined): void {
  if (!file) throw new Error('Usage : ai:train adopt <poids.json>');
  const weights = JSON.parse(readFileSync(file, 'utf8')) as LearnedWeights;
  const target = join(__dirname, 'learned-weights.ts');
  writeFileSync(target, weightsModule(weights));
  console.log(`Génération ${weights.generation} adoptée : ${target}`);
}

const [command, ...rest] = process.argv.slice(2);
const positional = rest.filter(
  (arg, i) => !arg.startsWith('--') && !rest[i - 1]?.startsWith('--'),
);
if (command === 'train') runTrain(positional);
else if (command === 'adopt') runAdopt(positional[0]);
else throw new Error('Commande attendue : train ou adopt');
```

- [ ] **Step 6: Script `package.json`**

```json
    "ai:train": "ts-node -r tsconfig-paths/register src/fights/ai/train.cli.ts",
```

- [ ] **Step 7: Essai réel de bout en bout, sur peu de données**

```bash
pnpm --filter @pipou/backend ai:selfplay-data .e2e/essai.jsonl --deck-seeds 2 --games 1
pnpm --filter @pipou/backend ai:train train .e2e/essai.jsonl --generation 0 --out .e2e/essai-poids.json
```

Expected: une ligne « Génération 0 : … positions, … % », puis dix poids par archétype. Sur si peu de données, la précision est bruitée ; elle doit rester au-dessus de 55 %. `myPrimesLeft` doit sortir négatif et `oppPrimesLeft` positif pour au moins deux archétypes : sinon l'étiquette est inversée, relire `label` dans `selfplay-data.ts`.

Ne pas lancer `adopt`. Supprimer les fichiers d'essai.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/fights/ai/train.ts apps/backend/src/fights/ai/train.cli.ts apps/backend/src/fights/ai/train.spec.ts apps/backend/package.json
git commit -m "feat(ia): entraînement de la note par régression logistique"
```

---

### Task 7: Banc de positions jugées par rollouts, et regret d'une note

**Files:**
- Create: `apps/backend/src/fights/ai/rollout.ts`
- Rewrite: `apps/backend/src/fights/ai/ai-rollout.cli.ts` (non suivi aujourd'hui)
- Create: `apps/backend/src/fights/ai/regret.ts`
- Create: `apps/backend/src/fights/ai/ai-regret.cli.ts`
- Delete: `apps/backend/src/fights/ai/ai-judge.cli.ts` (non suivi ; le miroir du tournoi le remplace depuis la tâche 4)
- Modify: `apps/backend/package.json` (scripts `ai:rollout`, `ai:regret`)
- Test: `apps/backend/src/fights/ai/regret.spec.ts`, `apps/backend/src/fights/ai/rollout.spec.ts`

**Interfaces:**
- Consumes : `Evaluator`, `evaluateLegacy` (tâche 1) ; `evaluatorOf`, `parseNote` (tâche 3).
- Produces :
  - `export interface JudgedRow { action: GameAction; text: string; eval: number; wins: number; n: number }`
  - `export function judge(game: GameState, seat: Seat, archetypes: Record<Seat, AdventureArchetype>, rollouts: number, seed: number, maxCandidates?: number): JudgedRow[] | null`
  - `export interface BenchPosition { id: string; seat: Seat; archetype: AdventureArchetype; state: GameState; rows: { action: GameAction; wins: number; n: number }[] }`
  - `export function regretOf(engine: GameEngine, pos: BenchPosition, evaluate: Evaluator): { regret: number; best: boolean } | null`

Le juge finit chaque partie en glouton avec la note manuelle des deux côtés. C'est un arbitre fixe : il ne change pas quand la note apprise change, donc les regrets de deux notes sont comparables.

- [ ] **Step 1: Écrire les tests qui échouent**

`regret.spec.ts` :

```ts
import { monsterCard } from '../testing/cards';
import { createEngine } from '../testing/engine';
import { monsterNamed, scenario, seatState } from '../testing/scenario';
import type { Evaluator } from './evaluate';
import { regretOf } from './regret';
import type { BenchPosition } from './regret';

const engine = createEngine();

function position(): BenchPosition {
  const state = scenario({
    turn: 'p1',
    phase: 'main',
    p1: { monsters: [monsterCard('Lame', { atk: 600, hp: 1500 })] },
    p2: { monsters: [monsterCard('Colosse', { atk: 500, hp: 1000 })] },
  });
  return {
    id: 'test:1',
    seat: 'p1',
    archetype: 'pipou',
    state,
    rows: [
      { action: { type: 'end_phase' }, wins: 20, n: 24 },
      {
        action: {
          type: 'change_mode',
          instanceId: monsterNamed(state, 'p1', 'Lame').instanceId,
          mode: 'guard',
        },
        wins: 5,
        n: 24,
      },
    ],
  };
}

/** Aime (ou non) avoir un monstre en Garde. */
const guardLover =
  (sign: number): Evaluator =>
  (game, seat) =>
    sign *
    seatState(game, seat).monsterZones.filter((m) => m?.mode === 'guard').length;

describe('regretOf', () => {
  it('nul quand la note préfère le coup qui gagne le plus', () => {
    expect(regretOf(engine, position(), guardLover(-1))).toEqual({
      regret: 0,
      best: true,
    });
  });

  it('écart de taux de victoire quand elle en préfère un autre', () => {
    const r = regretOf(engine, position(), guardLover(1))!;
    expect(r.regret).toBeCloseTo((20 - 5) / 24);
    expect(r.best).toBe(false);
  });

  it('null s’il reste moins de deux coups jouables', () => {
    const pos = position();
    pos.rows = [pos.rows[0]];
    expect(regretOf(engine, pos, guardLover(1))).toBeNull();
  });

  it('ne modifie pas la position', () => {
    const pos = position();
    const before = JSON.stringify(pos);
    regretOf(engine, pos, guardLover(1));
    expect(JSON.stringify(pos)).toBe(before);
  });
});
```

`rollout.spec.ts` :

```ts
import { allRealCards } from '../testing/real-cards';
import { createGameState } from '../helpers/game-factory';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { buildGeneratedEntries } from './generated-entries';
import { judge } from './rollout';
import { instances, seeded } from './tournament';

function opening() {
  const [a, b] = buildGeneratedEntries(allRealCards(), 1).filter(
    (e) => e.level === 5,
  );
  const engine = createEngine(fixedRng());
  const game = createGameState(
    1,
    { userId: 1, username: a.name, socketId: 's1' },
    { userId: 2, username: b.name, socketId: 's2' },
  );
  const random = seeded(11);
  engine.setupDeck(game, 'p1', instances(a.deck, 1, random));
  engine.setupDeck(game, 'p2', instances(b.deck, 2, random));
  // Mulligans refusés, puis l'état est celui du premier tour
  for (const seat of ['p1', 'p2'] as const)
    engine.dispatch(game, seat, { type: 'mulligan', redraw: false });
  return { game, archetypes: { p1: a.archetype, p2: b.archetype } };
}

describe('judge', () => {
  it('donne un taux de victoire par coup, sans toucher à la partie, de façon reproductible', () => {
    const { game, archetypes } = opening();
    const seat = game.currentTurnUserId === 1 ? 'p1' : 'p2';
    const before = JSON.stringify(game);

    const rows = judge(game, seat, archetypes, 2, 5, 3);

    expect(JSON.stringify(game)).toBe(before);
    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThanOrEqual(2);
    expect(rows!.length).toBeLessThanOrEqual(3);
    for (const r of rows!) {
      expect(r.n).toBe(2);
      expect(r.wins).toBeGreaterThanOrEqual(0);
      expect(r.wins).toBeLessThanOrEqual(2);
    }
    expect(judge(game, seat, archetypes, 2, 5, 3)).toEqual(rows);
  });
});
```

Si le début de partie ne passe pas par `mulligan` de cette façon, reprendre la séquence de mise en place de `ai-selfplay.spec.ts`. Le but du test est seulement d'obtenir une vraie position de phase principale avec au moins deux coups.

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- regret rollout`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Écrire `rollout.ts`**

```ts
import type { AdventureArchetype, GameAction, Seat } from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { seatPlayer } from '../helpers/game-state.helper';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { AiPlayer, aiMustAct } from './ai-player';
import { describeAction } from './ai-review';
import { listCandidates } from './candidate-actions';
import { determinize } from './determinize';
import { evaluateLegacy } from './evaluate';
import { scoreAfterChoice, stateSignature } from './planner';
import { MAX_ACTIONS, seeded } from './tournament';

/** Un coup candidat et son taux de victoire mesuré par fins de partie. */
export interface JudgedRow {
  action: GameAction;
  text: string;
  /** Note manuelle après le coup, pour comparaison. */
  eval: number;
  /** Victoires (0,5 par partie sans vainqueur) sur `n` fins de partie. */
  wins: number;
  n: number;
}

/** `Math.random` figé le temps de `f` : le moteur mélange avec lui. */
export function withRandom<T>(seed: number, f: () => T): T {
  const real = Math.random;
  Math.random = seeded(seed);
  try {
    return f();
  } finally {
    Math.random = real;
  }
}

/** Finit la partie en glouton des deux côtés (note manuelle) ; 1 si `seat` gagne. */
export function rollout(
  state: GameState,
  seat: Seat,
  archetypes: Record<Seat, AdventureArchetype>,
  seed: number,
): number {
  return withRandom(seed ^ 0x5bd1e995, () => {
    const engine = createEngine(fixedRng());
    const greedy = new AiPlayer(engine, seeded(seed));
    const ids = { p1: state.player1.userId, p2: state.player2.userId };
    for (let n = 0; state.phase !== 'finished' && n < MAX_ACTIONS; n++) {
      const actor = (['p1', 'p2'] as Seat[]).find((s) =>
        aiMustAct(state, ids[s]),
      );
      if (!actor) break;
      engine.dispatch(
        state,
        actor,
        greedy.chooseAction(state, actor, {
          archetype: archetypes[actor],
          level: 3,
        }),
      );
    }
    if (state.phase !== 'finished' || state.winner == null) return 0.5;
    return state.winner === seatPlayer(state, seat).userId ? 1 : 0;
  });
}

/**
 * Juge les coups de `seat` dans `game` : chacun est joué sur `rollouts` copies
 * déterminisées (le même tirage de cartes cachées pour tous les coups), puis
 * la partie est finie en glouton. null s'il y a moins de deux coups distincts.
 * Au-delà de `maxCandidates`, les coups jugés sont tirés au hasard, pas
 * choisis par une note : le banc ne favorise aucune note.
 */
export function judge(
  game: GameState,
  seat: Seat,
  archetypes: Record<Seat, AdventureArchetype>,
  rollouts: number,
  seed: number,
  maxCandidates = 12,
): JudgedRow[] | null {
  const engine = createEngine(fixedRng());
  const score = (s: GameState) =>
    evaluateLegacy(s, seat, archetypes[seat], false);
  const seen = new Set<string>();
  let options: { action: GameAction; eval: number }[] = [];
  for (const action of listCandidates(game, seat)) {
    const after = structuredClone(game);
    try {
      if (withRandom(seed, () => engine.dispatch(after, seat, action)).error)
        continue;
    } catch {
      continue;
    }
    const sig = stateSignature(after, seat);
    if (seen.has(sig)) continue;
    seen.add(sig);
    options.push({
      action,
      eval: scoreAfterChoice(engine, after, seat, score),
    });
  }
  if (options.length < 2) return null;
  if (options.length > maxCandidates) {
    const pick = seeded(seed ^ 0x2c1b3c6d);
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(pick() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    options = options.slice(0, maxCandidates);
  }
  return options.map((o) => {
    let wins = 0;
    for (let k = 0; k < rollouts; k++) {
      const s = determinize(game, seat, seeded(seed * 1000 + k));
      withRandom(seed * 1000 + k, () => {
        try {
          engine.dispatch(s, seat, o.action);
        } catch {
          /* coup refusé sur cette copie : la partie continue */
        }
      });
      wins += rollout(s, seat, archetypes, seed * 1000 + k);
    }
    return {
      action: o.action,
      text: describeAction(o.action, game),
      eval: o.eval,
      wins,
      n: rollouts,
    };
  });
}
```

- [ ] **Step 4: Écrire `regret.ts`**

```ts
import type { AdventureArchetype, GameAction, Seat } from '@pipou/shared';
import type { GameEngine } from '../engine/game-engine';
import type { GameState } from '../interfaces/game-state.interface';
import { determinize } from './determinize';
import type { Evaluator } from './evaluate';
import { scoreAfterChoice } from './planner';
import { seeded } from './tournament';

/** Une position du banc : l'état complet et le taux de victoire de chaque coup. */
export interface BenchPosition {
  id: string;
  seat: Seat;
  archetype: AdventureArchetype;
  state: GameState;
  rows: { action: GameAction; wins: number; n: number }[];
}

/** Graine stable tirée de l'identifiant de la position. */
function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Regret de `evaluate` sur une position : taux de victoire du meilleur coup
 * moins celui du coup qu'elle préfère. La note voit une copie déterminisée,
 * comme en partie. null s'il reste moins de deux coups jouables.
 */
export function regretOf(
  engine: GameEngine,
  pos: BenchPosition,
  evaluate: Evaluator,
): { regret: number; best: boolean } | null {
  const view = determinize(pos.state, pos.seat, seeded(seedOf(pos.id)));
  const score = (s: GameState) => evaluate(s, pos.seat, pos.archetype, true);
  const scored: { rate: number; score: number }[] = [];
  for (const row of pos.rows) {
    const after = structuredClone(view);
    try {
      if (engine.dispatch(after, pos.seat, row.action).error) continue;
    } catch {
      continue;
    }
    scored.push({
      rate: row.wins / row.n,
      score: scoreAfterChoice(engine, after, pos.seat, score),
    });
  }
  if (scored.length < 2) return null;
  const chosen = scored.reduce((a, b) => (b.score > a.score ? b : a));
  const top = Math.max(...scored.map((s) => s.rate));
  return { regret: top - chosen.rate, best: chosen.rate === top };
}
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/backend test -- regret rollout`
Expected: PASS.

- [ ] **Step 6: Réécrire `ai-rollout.cli.ts`**

Remplacer tout le fichier :

```ts
import { appendFileSync, writeFileSync } from 'node:fs';
import type { AdventureArchetype, Seat } from '@pipou/shared';
import { createGameState } from '../helpers/game-factory';
import { seatPlayer } from '../helpers/game-state.helper';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { allRealCards } from '../testing/real-cards';
import { AiPlayer, aiMustAct } from './ai-player';
import { buildGeneratedEntries } from './generated-entries';
import { LEVEL_BRAINS } from './level-brains';
import type { ThinkingProfile } from './planner';
import type { BenchPosition } from './regret';
import { judge, withRandom } from './rollout';
import { MAX_ACTIONS, instances, seeded } from './tournament';

/**
 * Banc de positions jugées par fins de partie. Sur des positions tirées de
 * parties entre decks de niveau 5 (graine de decks 1), chaque coup candidat
 * est joué puis la partie est finie en glouton. Une ligne = une `BenchPosition`.
 *
 *   pnpm --filter @pipou/backend ai:rollout <sortie.jsonl> <part> <parts> [parties par paire] [rollouts]
 *
 * Lancer une commande par part (0 à parts − 1) en parallèle, puis concaténer.
 */
const SAMPLE_RATE = 0.2;

const PLANNER: ThinkingProfile = {
  ...(LEVEL_BRAINS[3].thinking as ThinkingProfile),
  timeLimitMs: undefined,
};

function main(argv: string[]): void {
  const [out, shardArg, shardsArg, gamesArg, rollArg] = argv;
  if (!out || shardArg === undefined || shardsArg === undefined)
    throw new Error(
      'Usage : ai:rollout <sortie.jsonl> <part> <parts> [parties par paire] [rollouts]',
    );
  const shard = Number(shardArg);
  const shards = Number(shardsArg);
  const games = Number(gamesArg ?? 3);
  const rollouts = Number(rollArg ?? 24);
  writeFileSync(out, '');
  const decks = buildGeneratedEntries(allRealCards(), 1).filter(
    (e) => e.level === 5,
  );
  let g = 0;
  for (const da of decks)
    for (const db of decks)
      for (let k = 0; k < games; k++, g++) {
        if (g % shards !== shard) continue;
        const seed = 5000 + g;
        const random = seeded(seed);
        const sampler = seeded(seed + 77);
        const archetypes: Record<Seat, AdventureArchetype> = {
          p1: da.archetype,
          p2: db.archetype,
        };
        withRandom(seed ^ 0x9e3779b9, () => {
          const engine = createEngine(fixedRng());
          const game = createGameState(
            1,
            { userId: 1, username: da.name, socketId: 's1' },
            { userId: 2, username: db.name, socketId: 's2' },
          );
          engine.setupDeck(game, 'p1', instances(da.deck, 1, random));
          engine.setupDeck(game, 'p2', instances(db.deck, 2, random));
          const ai = new AiPlayer(engine, seeded(seed * 3), PLANNER);
          for (let n = 0; game.phase !== 'finished' && n < MAX_ACTIONS; n++) {
            const seat = (['p1', 'p2'] as Seat[]).find((s) =>
              aiMustAct(game, seatPlayer(game, s).userId),
            );
            if (!seat) break;
            if (
              (game.phase === 'main' || game.phase === 'battle') &&
              sampler() < SAMPLE_RATE
            ) {
              // Le juge fige Math.random : on le remet pour la suite de la partie
              const frozen = Math.random;
              const rows = judge(game, seat, archetypes, rollouts, seed * 100 + n);
              Math.random = frozen;
              if (rows) {
                const position: BenchPosition = {
                  id: `g${g}:${n}`,
                  seat,
                  archetype: archetypes[seat],
                  state: structuredClone(game),
                  rows,
                };
                appendFileSync(out, JSON.stringify(position) + '\n');
              }
            }
            engine.dispatch(
              game,
              seat,
              ai.chooseAction(game, seat, {
                archetype: archetypes[seat],
                level: 3,
              }),
            );
          }
        });
        console.log(`partie ${g} finie`);
      }
}

main(process.argv.slice(2));
```

- [ ] **Step 7: Écrire `ai-regret.cli.ts`**

```ts
import { readFileSync } from 'node:fs';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { evaluatorOf, parseNote } from './learned-eval';
import { regretOf } from './regret';
import type { BenchPosition } from './regret';

/**
 * Regret d'une note sur le banc de positions (`ai:rollout`).
 *
 *   pnpm --filter @pipou/backend ai:regret <banc.jsonl> [--note legacy|learned|fichier.json]
 *
 * Regret : taux de victoire du meilleur coup moins celui du coup préféré par
 * la note. Plus bas, mieux c'est.
 */
function main(argv: string[]): void {
  const file = argv[0];
  if (!file) throw new Error('Usage : ai:regret <banc.jsonl> [--note …]');
  const i = argv.indexOf('--note');
  const note = parseNote(i >= 0 ? argv[i + 1] : undefined, 'legacy');
  const evaluate = evaluatorOf(note);
  const engine = createEngine(fixedRng());
  const groups = new Map<string, { n: number; regret: number; best: number }>();
  const add = (key: string, regret: number, best: boolean) => {
    const g = groups.get(key) ?? { n: 0, regret: 0, best: 0 };
    g.n++;
    g.regret += regret;
    g.best += best ? 1 : 0;
    groups.set(key, g);
  };
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    const pos = JSON.parse(line) as BenchPosition;
    const r = regretOf(engine, pos, evaluate);
    if (!r) continue;
    add('total', r.regret, r.best);
    add(pos.archetype, r.regret, r.best);
  }
  console.log('| Groupe | Positions | Regret moyen | Meilleur coup choisi |');
  console.log('|---|---|---|---|');
  for (const [key, g] of groups)
    console.log(
      `| ${key} | ${g.n} | ${((100 * g.regret) / g.n).toFixed(2)} points | ${((100 * g.best) / g.n).toFixed(1)} % |`,
    );
}

main(process.argv.slice(2));
```

- [ ] **Step 8: Scripts `package.json`, suppression de `ai-judge.cli.ts`**

```json
    "ai:rollout": "ts-node -T -r tsconfig-paths/register src/fights/ai/ai-rollout.cli.ts",
    "ai:regret": "ts-node -T -r tsconfig-paths/register src/fights/ai/ai-regret.cli.ts",
```

Supprimer `apps/backend/src/fights/ai/ai-judge.cli.ts` (fichier non suivi : `rm`, pas `git rm`).

- [ ] **Step 9: Essai réel**

```bash
pnpm --filter @pipou/backend ai:rollout .e2e/essai-banc.jsonl 0 27 1 4
pnpm --filter @pipou/backend ai:regret .e2e/essai-banc.jsonl --note legacy
```

Expected: « partie 0 finie », puis un tableau avec une ligne `total` et un regret entre 0 et 100 points. Supprimer le fichier d'essai.

Run: `pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/fights/ai/rollout.ts apps/backend/src/fights/ai/rollout.spec.ts apps/backend/src/fights/ai/regret.ts apps/backend/src/fights/ai/regret.spec.ts apps/backend/src/fights/ai/ai-rollout.cli.ts apps/backend/src/fights/ai/ai-regret.cli.ts apps/backend/package.json
git commit -m "feat(ia): banc de positions jugées par rollouts et regret d'une note"
```

---

### Task 8: Générations — produire, entraîner, contrôler

Tâche d'exécution : pas de code nouveau, sauf correction d'un défaut trouvé en route. Elle occupe la machine plusieurs heures (environ 30 min pour le banc, 1 h 40 de données et 10 min de miroir par génération). Les fichiers de `apps/backend/.e2e/` ne sont pas versionnés. Les chemins `.e2e/…` des commandes sont relatifs à `apps/backend`, où `pnpm --filter` lance les scripts.

**Files:**
- Modify: `docs/superpowers/plans/2026-10-19-balance-results.md` (nouvelle section)

**Interfaces:**
- Consumes : tous les outils des tâches 4 à 7.
- Produces : `apps/backend/.e2e/weights-gen<N>.json` pour la génération retenue, et la décision d'adopter ou non, écrite dans `balance-results.md`.

- [ ] **Step 1: Construire le banc (une seule fois)**

Depuis `apps/backend`, dans Git Bash :

```bash
for i in 0 1 2 3 4 5 6 7 8 9; do
  npx ts-node -T -r tsconfig-paths/register src/fights/ai/ai-rollout.cli.ts .e2e/banc-$i.jsonl $i 10 3 24 > .e2e/banc-$i.log 2>&1 &
done
wait
cat .e2e/banc-?.jsonl > .e2e/banc.jsonl && rm .e2e/banc-?.jsonl
wc -l .e2e/banc.jsonl
```

Expected: entre 350 et 700 positions. Moins de 350 : relancer avec 5 parties par paire à la place de 3.

- [ ] **Step 2: Regret de référence**

Run: `pnpm --filter @pipou/backend ai:regret .e2e/banc.jsonl --note legacy`

Noter le tableau : c'est la référence à battre.

- [ ] **Step 3: Génération 1 — données jouées par la note manuelle**

```bash
pnpm --filter @pipou/backend ai:selfplay-data .e2e/data-gen1.jsonl --note legacy --seed 7
pnpm --filter @pipou/backend ai:train train .e2e/data-gen1.jsonl --generation 1 --out .e2e/weights-gen1.json
```

Expected: environ 19 950 parties et 300 000 positions ; précision sur les parties mises de côté au-dessus de 60 %.

Contrôle de bon sens sur les dix poids les plus forts de chaque archétype : `oppPrimesLeft` positif, `myPrimesLeft` négatif, `threatLethal` négatif, `potentialLethal` positif. Un signe inversé sur l'un d'eux est un défaut de données ou de caractéristique : s'arrêter et chercher la cause avant de continuer (skill `superpowers:systematic-debugging`).

- [ ] **Step 4: Contrôles de la génération 1**

```bash
pnpm --filter @pipou/backend ai:regret .e2e/banc.jsonl --note .e2e/weights-gen1.json
pnpm --filter @pipou/backend tournament:generated --scale standard --mirror --note .e2e/weights-gen1.json --old-note legacy
```

Le miroir joue 1 500 parties : même deck, même planificateur `STRONGEST`, note apprise (« nouveau ») contre note manuelle (« ancien »).

Critères :
1. regret moyen `total` inférieur à la référence du step 2 ;
2. « nouveau » gagne au moins 60 % dans chaque archétype ;
3. moins de 10 points entre le meilleur et le moins bon archétype.

- [ ] **Step 5: Générations 2 et 3, si la précédente progresse**

Une génération N + 1 n'est lancée que si la génération N bat la note de référence en miroir avec plus de 52,5 % au total (au-delà de la marge d'erreur de 1 500 parties).

```bash
pnpm --filter @pipou/backend ai:selfplay-data .e2e/data-gen2.jsonl --note .e2e/weights-gen1.json --seed 1007
pnpm --filter @pipou/backend ai:train train .e2e/data-gen1.jsonl .e2e/data-gen2.jsonl --generation 2 --out .e2e/weights-gen2.json
pnpm --filter @pipou/backend ai:regret .e2e/banc.jsonl --note .e2e/weights-gen2.json
pnpm --filter @pipou/backend tournament:generated --scale standard --mirror --note .e2e/weights-gen2.json --old-note .e2e/weights-gen1.json
```

La génération 2 s'entraîne sur les données des générations 1 et 2. Si elle bat la génération 1 (plus de 52,5 %), refaire la même chose pour la génération 3 : `--seed 2007`, données 2 et 3, miroir contre la génération 2. Sinon, la génération 1 est retenue. Trois générations au plus.

- [ ] **Step 6: Critère final, contre la note manuelle**

Si la génération retenue n'est pas la 1 :

```bash
pnpm --filter @pipou/backend tournament:generated --scale standard --mirror --note .e2e/weights-gen<N>.json --old-note legacy
```

Les trois critères du step 4 s'appliquent à ce miroir.

- [ ] **Step 7: Écrire les résultats**

Ajouter à la fin de `docs/superpowers/plans/2026-10-19-balance-results.md` une section `## Note apprise par auto-jeu (2026-11)` avec : la commande et le volume de chaque génération, le tableau de regret (référence et chaque génération), le tableau miroir par archétype de chaque génération avec son intervalle de confiance, les dix poids les plus forts de la génération retenue par archétype, et la décision.

- [ ] **Step 8: Décision**

- **Les trois critères sont remplis** : passer à la tâche 9 avec `weights-gen<N>.json`.
- **Un critère manque** : ne pas adopter, ne pas corriger les poids à la main. Écrire dans la section des résultats quelles positions du banc restent mal jugées (les 20 plus gros regrets, avec `ai:explain --note`), puis s'arrêter et rendre la main au joueur. La tâche 9 n'est pas exécutée.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/plans/2026-10-19-balance-results.md
git commit -m "docs(ia): résultats des générations de la note apprise"
```

---

### Task 9: Adopter la note apprise

À exécuter seulement si la tâche 8 a conclu à l'adoption.

**Files:**
- Regenerate: `apps/backend/src/fights/ai/learned-weights.ts`
- Modify: `apps/backend/src/fights/ai/level-brains.ts`
- Modify: `apps/backend/src/fights/ai/tournament-generated.cli.ts` (note par défaut)
- Modify: `apps/backend/src/fights/ai/level-brains.spec.ts`
- Create: `apps/backend/src/fights/ai/learned-cases.spec.ts`
- Modify: `apps/backend/src/fights/ai/REVIEW.md`
- Modify: `docs/superpowers/plans/2026-10-19-balance-results.md`

**Interfaces:**
- Consumes : `weights-gen<N>.json` (tâche 8), `evaluatorOf` (tâche 3), `judge` (tâche 7).
- Produces : niveaux 3 à 5 de l'aventure sur la note apprise ; `tournament:generated` sur la note apprise par défaut.

- [ ] **Step 1: Mesure de temps avant**

Run: `pnpm --filter @pipou/backend ai:bench`

Garder le tableau (médiane et 95e centile des niveaux 3, 4 et 5).

- [ ] **Step 2: Adopter les poids**

```bash
pnpm --filter @pipou/backend ai:train adopt .e2e/weights-gen<N>.json
pnpm --filter @pipou/backend test -- learned-eval
```

Expected: PASS. Le test « les poids versionnés correspondent aux caractéristiques » protège contre un fichier périmé.

- [ ] **Step 3: Proposer au joueur les deux positions de régression**

Avant d'écrire les tests, montrer au joueur les deux positions ci-dessous et attendre son accord ou ses corrections : un test qui impose un coup n'a de valeur que si ce coup est le bon.

Position 1, « affaiblir plutôt que se mettre en Garde » : mon tour, phase principale. Mon monstre Lame (600 ATK, 1 500 PV, mode ATK) fait face à Colosse (500 ATK, 1 000 PV, mode ATK). Attaquer laisse Colosse à 400 PV ; il ne peut pas tuer Lame à son tour ; je l'achève au tour suivant et je prends la Prime. Coup attendu : attaquer, et ne pas passer Lame en Garde.

Position 2, « remplir le plateau plutôt que tout payer » : mon tour, phase principale, plateau vide. En main : Titan (900 ATK, 700 PV, coût 3), deux Soldats (400 ATK, 600 PV, coût 0) et deux cartes sans effet. En face : Brute (1 000 ATK, 1 200 PV), qui détruit Titan en une attaque. Coup attendu : poser les deux Soldats, ne pas poser Titan.

- [ ] **Step 4: Écrire les tests des deux cas**

`learned-cases.spec.ts` (adapter les positions aux corrections du joueur) :

```ts
import type { GameAction } from '@pipou/shared';
import { fillerCard, monsterCard } from '../testing/cards';
import { createEngine } from '../testing/engine';
import { P1_ID, scenario, seatState } from '../testing/scenario';
import type { GameState } from '../interfaces/game-state.interface';
import { AiPlayer, aiMustAct } from './ai-player';
import { evaluatorOf } from './learned-eval';
import { STRONGEST } from './planner';
import { seeded } from './tournament';

const engine = createEngine();

/** Joue le tour de p1 avec le cerveau le plus fort et la note apprise. */
function playTurn(game: GameState): GameAction[] {
  const ai = new AiPlayer(engine, seeded(1), STRONGEST, 0, evaluatorOf('learned'));
  const turn = game.turnNumber;
  const played: GameAction[] = [];
  for (
    let n = 0;
    n < 40 && game.turnNumber === turn && aiMustAct(game, P1_ID);
    n++
  ) {
    const action = ai.chooseAction(game, 'p1', { archetype: 'pipou', level: 5 });
    played.push(action);
    expect(engine.dispatch(game, 'p1', action).error).toBeUndefined();
  }
  return played;
}

describe('note apprise : cas signalés par le joueur', () => {
  it('attaque pour affaiblir un monstre qu’elle achèvera au tour suivant, au lieu de se mettre en Garde', () => {
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: { monsters: [monsterCard('Lame', { atk: 600, hp: 1500 })] },
      p2: { monsters: [monsterCard('Colosse', { atk: 500, hp: 1000 })] },
    });

    const played = playTurn(game);

    expect(played.some((a) => a.type === 'attack')).toBe(true);
    expect(
      played.some((a) => a.type === 'change_mode' && a.mode === 'guard'),
    ).toBe(false);
  });

  it('remplit son plateau au lieu de payer trois cartes pour un monstre qui meurt au tour adverse', () => {
    const soldier = () => monsterCard('Soldat', { atk: 400, hp: 600 });
    const game = scenario({
      turn: 'p1',
      phase: 'main',
      p1: {
        hand: [
          monsterCard('Titan', { atk: 900, hp: 700, cost: 3 }),
          soldier(),
          soldier(),
          fillerCard(),
          fillerCard(),
        ],
      },
      p2: { monsters: [monsterCard('Brute', { atk: 1000, hp: 1200 })] },
    });

    playTurn(game);

    const board = seatState(game, 'p1')
      .monsterZones.filter((m) => m !== null)
      .map((m) => m.card.baseCard.name);
    expect(board.filter((name) => name === 'Soldat')).toHaveLength(2);
    expect(board).not.toContain('Titan');
  });
});
```

- [ ] **Step 5: Lancer les deux cas**

Run: `pnpm --filter @pipou/backend test -- learned-cases`
Expected: PASS.

Si un cas échoue, ne pas retoucher les poids ni la position pour le faire passer. Afficher le détail de la décision (`evaluatorOf('learned')(état, 'p1', 'pipou', true, parts)` sur l'état après chacun des deux coups) et passer la position au juge (`judge(game, 'p1', { p1: 'pipou', p2: 'pipou' }, 48, 1)`, avec des decks de monstres simples dans le scénario à la place des cartes neutres). Deux issues :
- le juge donne raison à l'IA : la position était mal choisie, la corriger avec le joueur ;
- le juge donne raison au test : la note a un angle mort. Le rapporter au joueur avec les chiffres ; l'adoption reste possible si les critères de la tâche 8 tiennent, mais c'est sa décision, et le test est alors marqué `it.failing` avec un commentaire qui renvoie au sous-projet 2.

- [ ] **Step 6: Niveaux d'aventure**

Dans `level-brains.ts`, ajouter `note: 'learned'` aux niveaux 3, 4 et 5 :

```ts
  3: {
    thinking: {
      beamWidth: 3,
      depth: 6,
      ripostes: 0,
      budget: 1500,
      timeLimitMs: AI_TIME_LIMIT_MS,
    },
    mistakeRate: 0,
    note: 'learned',
  },
  4: {
    thinking: {
      beamWidth: 6,
      depth: 9,
      ripostes: 0,
      budget: 4000,
      timeLimitMs: AI_TIME_LIMIT_MS,
    },
    mistakeRate: 0,
    note: 'learned',
  },
  5: {
    thinking: { ...STRONGEST, timeLimitMs: AI_TIME_LIMIT_MS },
    mistakeRate: 0,
    note: 'learned',
  },
```

Mettre à jour le commentaire au-dessus de `LEVEL_BRAINS` : niveaux 1 et 2 sur la note manuelle (ils doivent rester faibles et `plausibleMistake` est calé sur son échelle), niveaux 3 à 5 sur la note apprise.

Dans `level-brains.spec.ts`, remplacer le test ajouté à la tâche 4 par :

```ts
  it('niveaux 1 et 2 sur la note manuelle, 3 à 5 sur la note apprise', () => {
    for (const level of [1, 2] as const)
      expect(LEVEL_BRAINS[level].note ?? 'legacy').toBe('legacy');
    for (const level of [3, 4, 5] as const)
      expect(LEVEL_BRAINS[level].note).toBe('learned');
  });
```

- [ ] **Step 7: Note par défaut du tournoi**

Dans `tournament-generated.cli.ts` : `const note = parseNote(raw('note'), 'learned');` et, dans le commentaire d'en-tête, préciser que la note apprise est le défaut et que `--note legacy` rejoue les références d'octobre. Ajuster `noteTag` pour que le défaut n'ajoute pas de suffixe et que `legacy` ajoute `-manuelle`.

Le miroir sans `--old-note` garde son sens d'origine (planificateur contre glouton à note manuelle).

- [ ] **Step 8: Tous les tests, puis mesure de temps après**

Run: `pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend lint`
Expected: PASS. `ai-selfplay.spec.ts` joue des parties aux cerveaux de niveau : s'il échoue, c'est un vrai défaut (partie qui ne finit pas, coup refusé), à traiter avec `superpowers:systematic-debugging`.

Run: `pnpm --filter @pipou/backend ai:bench`
Expected: médiane et 95e centile des niveaux 3 à 5 à moins de 20 % au-dessus du step 1. Au-delà : profiler `features` (les deux appels à `raid` dominent) avant de continuer.

- [ ] **Step 9: Tournoi Standard et documentation**

Run: `pnpm --filter @pipou/backend tournament:generated --scale standard`

Environ une heure. Ajouter son résumé à la section « Note apprise par auto-jeu » de `balance-results.md`, à côté de la référence d'octobre, avec l'écart par duel d'archétypes et les deux tableaux `ai:bench`.

Dans `REVIEW.md`, section « Expliquer une décision », ajouter : `--note learned` donne le détail par caractéristique (`myMonsters`, `threatPrimes`, `oppMissingHp`…), et le regret de `ai:review` reste calculé sur le score enregistré de la note qui a joué.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/fights/ai/learned-weights.ts apps/backend/src/fights/ai/level-brains.ts apps/backend/src/fights/ai/level-brains.spec.ts apps/backend/src/fights/ai/learned-cases.spec.ts apps/backend/src/fights/ai/tournament-generated.cli.ts apps/backend/src/fights/ai/REVIEW.md docs/superpowers/plans/2026-10-19-balance-results.md
git commit -m "feat(ia): note apprise adoptée aux niveaux 3 à 5 et au tournoi"
```

---

## Couverture de la spec

| Exigence de la spec | Tâche |
|---|---|
| `features.ts`, caractéristiques existantes et nouvelles, aucun nom de carte | 2 |
| `learned-weights.ts` versionné, test de longueur | 3 |
| Note = somme pondérée, fins de partie à ±Infinity, `parts` conservé | 3, 4 (`ai-explain`) |
| `evaluateLegacy` conservée au bit près | 1 |
| Note = choix du cerveau, pas une variable globale | 1, 4 |
| Auto-jeu parallèle, exploration 10 %, positions déterminisées, plafond par partie | 5 |
| Régression logistique, graine fixe, 10 % de parties mises de côté | 6 |
| Juge par rollouts suivi, regret d'une note | 7 |
| `ai-judge.cli.ts` suivi ou supprimé | 7 (supprimé) |
| Générations, trois au plus | 8 |
| Trois contrôles : banc, miroir, cas du joueur | 8, 9 |
| Échelle des scores | Contraintes globales, 3 (`LEARNED_SCALE`) |
| Niveaux 1 et 2 inchangés, 3 à 5 sur la note apprise | 9 |
| Coût par décision, tolérance 20 % | 9 |
| Tournoi Standard après adoption, résultats consignés | 8, 9 |
| Arrêt et rapport si la note linéaire ne suffit pas | 8 (step 8) |
