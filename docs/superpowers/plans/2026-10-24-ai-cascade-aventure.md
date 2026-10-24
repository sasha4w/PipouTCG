# IA — étape 3 : la cascade vers l'aventure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chaque niveau d'aventure joue avec son propre cerveau (glouton qui se trompe aux niveaux 1 et 2, planificateur de plus en plus fort aux niveaux 3 à 5), avec un plafond de temps par décision ; le tournoi joue au plus fort par défaut et sait mesurer la vraie difficulté de l'aventure.

**Architecture:** une table `LEVEL_BRAINS` (niveau → cerveau + taux d'erreur) remplace `MISTAKE_RATE`. `AiPlayer` reçoit son taux d'erreur à la construction au lieu de le lire dans le profil. Le planificateur s'arrête au plafond de temps et rend la meilleure suite trouvée. `FightsService` crée une IA par combat d'aventure au lieu d'une IA partagée.

**Tech Stack:** NestJS 11, TypeScript strict, Jest.

**Spec:** `docs/superpowers/specs/2026-10-22-ai-better-brain-design.md`, section « Étape 3 — La cascade vers l'aventure ».

## Global Constraints

- Branche `ai-cascade-aventure` (partie de `dev`). Jamais de commit sur `main`.
- Niveaux : 1 = glouton, 25 % d'erreurs ; 2 = glouton, 10 % d'erreurs ; 3 à 5 = planification, faisceau et profondeur croissants ; 5 = le profil le plus fort.
- Plafond de temps par décision en aventure : **50 ms** par défaut ; au plafond, l'IA joue la meilleure suite trouvée.
- Garde-fous inchangés : `safeFallback`, `AI_MAX_ACTIONS_PER_TURN`, `forceAiProgress`.
- Tournoi : `--brain max` par défaut (profil le plus fort, aucune erreur, quel que soit le niveau) ; `--brain niveau` (profil de chaque niveau) ; `--brain greedy` reste disponible.
- Le tournoi reste déterministe : **aucun plafond de temps dans le tournoi**, seulement le budget en simulations.
- `worker_threads` seulement si la mesure de la Task 4 montre que 50 ms ne suffisent pas.
- `pnpm --filter @pipou/backend test`, `typecheck` et `lint` restent verts.

## Review Focus

1. **Deux combats d'aventure en même temps** : chacun a sa propre IA ; le plan de l'un ne fuit pas dans l'autre. Testé en Task 3.
2. **Plafond de temps atteint avant la moindre simulation** (`timeLimitMs: 0`) : l'IA joue quand même un coup valide (repli glouton). Testé en Task 1.
3. **Tournoi `max` avec un deck de niveau 1** : aucun coup au hasard, même si le tirage aléatoire vaut toujours 0. Testé en Task 2.
4. **Tournoi `niveau`** : le niveau 1 se trompe, le niveau 5 non, et le plafond de temps est retiré (résultats reproductibles). Testé en Task 2.
5. **Combat d'aventure terminé** : l'IA du combat disparaît avec sa session (pas de fuite dans une table à part). Couvert par la Task 3 (l'IA vit dans `PveSession`).

---

### Task 1 : Cerveaux par niveau et plafond de temps

**Files:**
- Create: `apps/backend/src/fights/ai/level-brains.ts`
- Modify: `apps/backend/src/fights/ai/planner.ts` (`ThinkingProfile.timeLimitMs`, arrêt dans `planTurn`), `apps/backend/src/fights/ai/ai-player.ts` (supprimer `MISTAKE_RATE`, 4e paramètre du constructeur)
- Test: `apps/backend/src/fights/ai/level-brains.spec.ts`, `planner.spec.ts`, `ai-player.spec.ts` (le test de `MISTAKE_RATE` passe sur `LEVEL_BRAINS`)

**Interfaces:**
- Produces :
  - `ThinkingProfile.timeLimitMs?: number` — absent = pas de plafond.
  - `interface LevelBrain { thinking: ThinkingProfile | 'greedy'; mistakeRate: number }`
  - `const LEVEL_BRAINS: Record<AiLevel, LevelBrain>`
  - `function createLevelAi(engine: GameEngine, level: AiLevel, random?: () => number): AiPlayer` (défaut `Math.random`)
  - `new AiPlayer(engine, random, thinking = 'greedy', mistakeRate = 0)`

Valeurs (*ripostes à 0 partout : la riposte a été mesurée nuisible, voir `STRONGEST`*) :

| Niveau | thinking | mistakeRate |
|---|---|---|
| 1 | `'greedy'` | 0.25 |
| 2 | `'greedy'` | 0.1 |
| 3 | `{ beamWidth: 3, depth: 6, ripostes: 0, budget: 1500, timeLimitMs: 50 }` | 0 |
| 4 | `{ beamWidth: 6, depth: 9, ripostes: 0, budget: 4000, timeLimitMs: 50 }` | 0 |
| 5 | `{ ...STRONGEST, timeLimitMs: 50 }` | 0 |

- [ ] **Step 1 : tests**
  - `LEVEL_BRAINS` : niveaux 1 et 2 gloutons à 0.25 et 0.1 ; 3 à 5 planifient, `beamWidth` et `depth` croissants, `timeLimitMs: 50` ; le niveau 5 a `beamWidth`, `depth` et `budget` de `STRONGEST`.
  - `createLevelAi(engine, 1, () => 0)` sur un état où deux coups sont valides joue le premier coup valide (erreur forcée) ; `createLevelAi(engine, 3, () => 0)` joue le même coup que `new AiPlayer(engine, () => 0, LEVEL_BRAINS[3].thinking)`.
  - `new AiPlayer(engine, () => 0)` (taux 0 par défaut) ne joue jamais au hasard, même pour un profil de niveau 1.
  - `planTurn` avec `{ ...STRONGEST, timeLimitMs: 0 }` : renvoie `null` sans aucune simulation (`counter.used === 0`) ; `AiPlayer` avec ce profil renvoie un coup accepté par le moteur.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend exec jest src/fights/ai` → FAIL.
- [ ] **Step 3 : implémenter.** Le taux d'erreur se lit sur `this.mistakeRate` (plus sur `profile.level`). `planTurn` calcule une échéance `performance.now() + timeLimitMs` et s'arrête comme pour le budget épuisé (même endroit de la boucle) ; sans `timeLimitMs`, aucune lecture d'horloge.
- [ ] **Step 4 :** même commande → PASS (tout `src/fights/ai`).
- [ ] **Step 5 : commit** `feat(ia): un cerveau par niveau d'aventure et un plafond de temps`.

### Task 2 : Le tournoi choisit le cerveau

**Files:**
- Modify: `apps/backend/src/fights/ai/tournament.ts` (`Brain = 'greedy' | 'plan' | 'level'`, `brainOf` rend cerveau + taux), `tournament-generated.cli.ts` (`--brain max|niveau|greedy`, défaut `max`), `tournament-jobs.ts` si le type `Brain` y transite
- Test: `apps/backend/src/fights/ai/tournament.spec.ts`

**Interfaces:**
- Consumes : `LEVEL_BRAINS`, `new AiPlayer(engine, random, thinking, mistakeRate)` (Task 1).
- Produces : `function brainOf(e: TournamentEntry): LevelBrain` (exportée) :
  - `'plan'` → `{ thinking: { ...STRONGEST, ...e.thinking }, mistakeRate: 0 }` ;
  - `'greedy'` ou absent → `{ thinking: 'greedy', mistakeRate: 0 }` ;
  - `'level'` → `LEVEL_BRAINS[e.level]` **sans `timeLimitMs`**.
- CLI : `max` → `'plan'`, `niveau` → `'level'`, `greedy` → `'greedy'` ; libellé de sortie suffixé `-niveau` pour `niveau` (le suffixe `-glouton` existant reste).

- [ ] **Step 1 : tests** de `brainOf` :
  - entrée niveau 1, `brain: 'plan'` → `mistakeRate: 0` et profil `STRONGEST` ;
  - entrée niveau 1, `brain: 'level'` → `mistakeRate: 0.25`, `thinking: 'greedy'` ;
  - entrée niveau 5, `brain: 'level'` → profil planifié sans `timeLimitMs` ;
  - `thinking: { beamWidth: 4 }` avec `'plan'` → `beamWidth: 4`, le reste de `STRONGEST`.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend exec jest src/fights/ai/tournament.spec.ts` → FAIL.
- [ ] **Step 3 :** implémenter ; un `--brain` inconnu lève `Cerveau inconnu « x » (max, niveau, greedy)`.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend exec jest src/fights/ai` → PASS.
- [ ] **Step 5 : commit** `feat(ia): tournoi au plus fort par défaut, ou au cerveau de chaque niveau`.

### Task 3 : Une IA par combat d'aventure

**Files:**
- Modify: `apps/backend/src/fights/fights.service.ts` (supprimer `private readonly ai` ; `PveSession.ai: AiPlayer` créé avec `createLevelAi(this.engine, start.profile.level)` dans `startAdventure` ; `aiStep` appelle `session.ai.chooseAction`)
- Test: `apps/backend/src/fights/fights-pve.spec.ts`

**Interfaces:**
- Consumes : `createLevelAi` (Task 1).

- [ ] **Step 1 : tests**
  - deux combats d'aventure lancés par deux joueurs (niveaux 1 et 5) : les `this` vus par `jest.spyOn(AiPlayer.prototype, 'chooseAction')` sont deux instances différentes ;
  - un combat de niveau 5 : l'instance a été construite avec le profil de `LEVEL_BRAINS[5]` (espionner `createLevelAi` via le module `./ai/level-brains`, appelé avec le niveau du profil) ;
  - les tests existants (`plafond de 60 actions`, repli, timeouts) restent verts.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend exec jest src/fights/fights-pve.spec.ts` → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend test` → PASS ; `typecheck` et `lint` → OK.
- [ ] **Step 5 : commit** `feat(aventure): chaque combat a l'IA de son niveau`.

### Task 4 : Mesurer le temps et la difficulté

**Files:**
- Create: `apps/backend/src/fights/ai/ai-bench.cli.ts` (script `ai:bench` dans `apps/backend/package.json`, même lancement que `tournament:generated`)
- Modify: `docs/superpowers/plans/2026-10-19-balance-results.md` (section « Cascade vers l'aventure »)

Le banc joue, sans processus parallèles, 20 parties entre decks générés (graine de decks 1) où chaque deck utilise `createLevelAi` de son niveau **avec** le plafond de 50 ms, et chronomètre chaque `chooseAction` (`performance.now()`). Sortie : par niveau, médiane, 95e centile et maximum en ms, et part des décisions qui ont atteint le plafond.

- [ ] **Step 1 :** écrire le banc ; `pnpm --filter @pipou/backend ai:bench` → tableau par niveau.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend tournament:generated --scale rapide --brain niveau` → taux par deck (difficulté réelle de l'aventure).
- [ ] **Step 3 :** reporter les deux tableaux dans le document de résultats, avec la lecture :
  - 95e centile du niveau 5 sous **100 ms** (plafond 50 ms + simulation des coups candidats) → pas de `worker_threads` ;
  - au-delà, le noter et proposer le passage sur un fil séparé au joueur, sans l'implémenter ;
  - la progression des taux par niveau doit être croissante dans chaque monde.
- [ ] **Step 4 : commit** `docs: temps de décision et difficulté de l'aventure par niveau`.
