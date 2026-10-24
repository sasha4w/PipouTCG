# Le nouveau cerveau — plan d'implémentation (étape 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une IA qui planifie son tour par recherche en faisceau, note les fins de tour après une riposte adverse simulée, valorise les cartes qui préparent un coup, et dont la philosophie de chaque archétype vit dans un fichier dédié. On vérifie ensuite qu'elle progresse autant dans les trois archétypes, puis on la mesure en tournoi Standard.

**Architecture:** `planner.ts` explore des suites de coups sur la copie déterminisée (étape 1) avec le vrai moteur, sous un budget compté en simulations. `AiPlayer` reçoit un profil de réflexion : `'greedy'` (comportement actuel, valeur par défaut, donc l'aventure est inchangée jusqu'à l'étape 3) ou un `ThinkingProfile`. Le tournoi choisit le cerveau de chaque entrée et offre un mode miroir (nouveau contre ancien, même deck).

**Tech Stack:** NestJS 11 backend, TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-10-22-ai-better-brain-design.md` (étape 2 : sections 2a à 2f).

## Global Constraints

- Code dans `apps/backend/src/fights/ai/`. Aucun changement du moteur ni de `@pipou/shared`.
- `AiPlayer` sans profil de réflexion = comportement actuel : `fights.service.ts` (aventure) n'est pas modifié dans cette étape.
- Budget compté en appels à `engine.dispatch`, jamais en temps : mêmes graines = même résultat.
- Aucune règle propre à une carte (pas de test sur un nom de carte) dans le planificateur et dans `evaluate`. Les poids d'archétype sont des données dans `archetype-profiles.ts`.
- Critère de force égale (2f), sur l'échelle rapide en miroir : le nouveau cerveau gagne au moins 60 % contre l'ancien dans chaque archétype, et l'écart entre le meilleur et le moins bon archétype est inférieur à 10 points.
- Cible de durée : un tournoi Standard avec le nouveau cerveau tient en environ une heure sur 10 processus. Sinon, on réduit le faisceau ou la profondeur, pas les graines.
- Commits sur `ai-better-brain`, messages en français.

## Review Focus

1. Une suite planifiée dont un coup dépend d'une pioche ou d'un mélange : le coup suivant joué doit rester valide. On replanifie dès que l'état réel diffère de l'état prévu. Testé en Task 2.
2. Un choix en attente pour l'IA au milieu de la suite (`pick_cards`) : il fait partie de la suite, et le choix pour l'adversaire termine la suite. Testé en Task 2.
3. Le budget épuisé en cours de recherche : l'IA joue la meilleure suite trouvée, jamais rien d'illégal. Testé en Task 2.
4. Une fin de tour où la partie est finie : ±Infinity, sans simuler de riposte. Testé en Task 3.
5. Le cerveau glouton (aventure) strictement inchangé : les tests existants de `ai-player.spec.ts` passent sans modification. Vérifié dans chaque tâche.

---

### Task 1 : La philosophie des decks dans un fichier, et la valeur de ce qui se prépare

**Files:**
- Create: `apps/backend/src/fights/ai/archetype-profiles.ts`
- Modify: `apps/backend/src/fights/ai/evaluate.ts`
- Test: `apps/backend/src/fights/ai/evaluate.spec.ts` (créé)

**Interfaces:**
- Produces :

```ts
export interface ArchetypeProfile {
  perMonster: number;             // pipou : 400 (ancien PIPOU_PER_MONSTER), autres 0
  perEquipment: number;           // pixelman : 400
  coreFactor: number;             // pixelman : 1.25
  corePresence: number;           // pixelman : 300
  perStage: number;               // dragon : 300
  growingHp: number;              // dragon : 0.3
  protect: 'equipments' | 'growing' | 'boosters';
  prepEvolve: number;             // carte d'évolution en main avec une base valide sur le terrain
  prepEquip: number;              // équipement en main avec un porteur
  prepTarget: number;             // éphémère ciblé en main avec une cible
}
export const ARCHETYPE_PROFILES: Record<AdventureArchetype, ArchetypeProfile>;
```

Valeurs de préparation *(choix de l'exécutant, à régler en Task 5)* :
- `prepEvolve` : pipou 150, pixelman 150, dragon 400 ;
- `prepEquip` : pipou 100, pixelman 300, dragon 100 ;
- `prepTarget` : 50 partout.

Les autres valeurs reprennent exactement les constantes actuelles de `evaluate.ts`, qui sont supprimées. `archetypeBonus` et `protectWeight` lisent le profil.

**Préparation** (`handPotential(me, opp, profile): number`, exportée depuis `evaluate.ts`) : on fait la somme sur les cartes en main.
- Une carte d'évolution (Jeune ou Adulte) ajoute `prepEvolve` si `canEvolveOnto(card, base)` est vrai pour au moins un monstre allié non implanté.
- Un équipement ajoute `prepEquip` s'il y a au moins un allié non implanté, ou un monstre implanté par moi chez l'adversaire.
- Un éphémère dont `ephemeralTargetSide` vaut `ally` ou `enemy` ajoute `prepTarget` si une cible de ce côté existe.

`evaluate` ajoute `handPotential`.

- [ ] **Step 1 : tests** (`evaluate.spec.ts`, cartes de test avec `stage` et `lineage`) :
  - `les poids d'archétype viennent du profil` : `ARCHETYPE_PROFILES.pipou.perMonster === 400`, `ARCHETYPE_PROFILES.pixelman.perEquipment === 400`, `ARCHETYPE_PROFILES.dragon.perStage === 300`.
  - `un Jeune compatible avec le Bébé en jeu vaut plus qu'un Jeune d'une autre lignée` : deux états identiques (Bébé lignée A en jeu). Le premier a en main un Jeune de lignée A, le second un Jeune de lignée B, mêmes stats et même coût. La différence d'`evaluate` (dragon) vaut exactement `ARCHETYPE_PROFILES.dragon.prepEvolve`.
  - `un équipement sans porteur ne prépare rien` : `handPotential` vaut 0 avec un équipement en main et aucun allié, et `ARCHETYPE_PROFILES.pixelman.prepEquip` avec un allié.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend exec jest src/fights/ai/evaluate.spec.ts` → FAIL (module absent).
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend exec jest src/fights/ai` → PASS, avec `ai-player.spec.ts` inchangé. Si un test existant change de décision à cause de `handPotential`, régler la valeur de préparation concernée (et la consigner) plutôt que modifier le test.
- [ ] **Step 5 : commit** `feat(back): philosophie des decks dans un fichier et valeur de ce qui se prépare`.

### Task 2 : Planifier son tour

**Files:**
- Create: `apps/backend/src/fights/ai/planner.ts`
- Create: `apps/backend/src/fights/ai/planner.spec.ts`
- Modify: `apps/backend/src/fights/ai/ai-player.ts`

**Interfaces:**
- Consumes : `determinize` (étape 1), `listCandidates`, `evaluate`.
- Produces :

```ts
export interface ThinkingProfile { beamWidth: number; depth: number; ripostes: number; budget: number }
export const STRONGEST: ThinkingProfile = { beamWidth: 3, depth: 8, ripostes: 2, budget: 2500 };
export interface Counter { used: number }
export function countingEngine(engine: GameEngine, counter: Counter): GameEngine; // dispatch compté
export function stateSignature(game: GameState): string;
export interface Plan { actions: GameAction[]; expected: string[]; score: number }
export function planTurn(
  engine: GameEngine, game: GameState, seat: Seat, profile: AiProfile,
  thinking: ThinkingProfile, random: () => number, counter: Counter,
): Plan | null;
```

Dans `ai-player.ts` : `constructor(engine, random, thinking: ThinkingProfile | 'greedy' = 'greedy')`.

Règles :
- **Signature d'état** : phase, `turnNumber`, `currentTurnUserId`, nombre de `pendingChoices` ; et pour chaque joueur : Primes, `instanceId` de la main, monstres (`instanceId`, PV, mode, `instanceId` des équipements), terrains, tailles du cimetière et du deck, énergie.
- **Recherche** : la racine est `determinize(game, seat, random)`.
  - À chaque profondeur, chaque état du faisceau est développé par tous ses `listCandidates` acceptés par le moteur. Les états identiques (même signature) sont dédoublonnés, et on garde les `beamWidth` meilleurs selon `evaluate`.
  - Un état est une **fin de suite** quand :
    - la partie est finie ;
    - le tour n'est plus le mien ;
    - un choix en attente revient à l'adversaire ;
    - ou la profondeur `depth` est atteinte.
  - Les fins de suite gardent leur meilleure note. Les `beamWidth` meilleures sont notées par `riposte` (Task 3, si `ripostes > 0`), sinon par `evaluate`.
  - Le budget est vérifié avant chaque `dispatch` : épuisé, la recherche s'arrête et les états du faisceau deviennent des fins de suite.
  - `Plan.actions` est la meilleure suite, et `expected[k]` la signature attendue après `actions[k]`.
- **Dans `AiPlayer.chooseDetailed`** (profil de réflexion ≠ `'greedy'`) :
  - le mulligan et le taux d'erreurs gardent leur logique actuelle ;
  - si un plan en cours a encore des coups, et que `stateSignature(determinize(game, seat, random))` vaut `expected[k - 1]` (les cartes cachées ne comptent pas dans la signature, sauf leur nombre), on joue `actions[k]` ;
  - sinon, on replanifie ;
  - `valid` reste la liste des candidats acceptés sur la copie déterminisée (télémétrie) ;
  - `guardedScore` et `transformScore` ne servent qu'au cerveau glouton.

  *Note : la signature n'inclut pas l'ordre des cartes cachées ; une pioche change la main, donc la signature, donc on replanifie.*

- [ ] **Step 1 : tests** (`planner.spec.ts`, scénarios de `ai-player.spec.ts` réutilisés quand c'est possible) :
  - `Transformer puis invoquer le Bébé, sans cas spécial` : même scénario que le test « Adulte coincé en main, Bébé au cimetière, zone libre : transforme ». Avec `new AiPlayer(engine, () => 0.99, STRONGEST)`, le premier coup est `transform`.
  - `invocation puis Garde` : scénario où une invocation n'est bonne qu'en défense (repris de la logique de `guardedScore`) ; le plan contient `summon` puis `change_mode` vers `guard`.
  - `un choix de l'IA au milieu de la suite en fait partie` : effet d'invocation qui ouvre un `pick_cards` pour l'IA ; le plan contient le `summon` suivi d'un `pick_cards`.
  - `budget respecté` : avec `ripostes: 0, budget: 40`, après `planTurn`, `counter.used <= 40`, et le plan renvoyé, rejoué sur une copie avec le vrai moteur, n'a aucun coup refusé.
  - `suit son plan sans rechercher à nouveau` : après le premier coup joué, le second `chooseDetailed` consomme moins de simulations que le premier (compteur via `countingEngine`). Après une pioche (signature différente), il replanifie.
  - `déterministe` : deux `planTurn` avec `seeded(5)` donnent les mêmes `actions`.
  - `le cerveau glouton est inchangé` : `ai-player.spec.ts` passe sans modification (vérifié au Step 4).
- [ ] **Step 2 :** jest `planner.spec.ts` → FAIL.
- [ ] **Step 3 :** implémenter `planner.ts` (avec `riposte` provisoirement égal à `evaluate`, Task 3 le remplace) et le branchement dans `AiPlayer`.
- [ ] **Step 4 :** `pnpm --filter @pipou/backend exec jest src/fights/ai` → PASS.
- [ ] **Step 5 : commit** `feat(back): l'IA planifie son tour`.

### Task 3 : Anticiper la riposte

**Files:**
- Modify: `apps/backend/src/fights/ai/planner.ts`
- Test: `apps/backend/src/fights/ai/planner.spec.ts`

**Interfaces:**
- Produces :
  - `inferArchetype(player: PlayerGameState): AdventureArchetype` : l'archétype le plus fréquent parmi toutes les cartes du joueur (main, deck, Primes, terrain, cimetière, équipements). En cas d'égalité, l'ordre est pipou, pixelman, dragon ; sans aucune carte d'archétype, `'pipou'`.
  - `riposte(engine, leaf: GameState, seat: Seat, profile: AiProfile, thinking: ThinkingProfile, random: () => number, counter: Counter): number`.

Règle :
- Si la partie est finie dans `leaf`, `riposte` renvoie `evaluate(leaf, …)`, c'est-à-dire ±Infinity.
- Sinon, sur `thinking.ripostes` copies `determinize(leaf, seat, random)`, on joue le reste de mon tour (`end_phase` jusqu'à ce que ce ne soit plus mon tour, en résolvant mes choix avec le glouton). Puis on joue tout le tour adverse avec un `AiPlayer` glouton : profil `{ archetype: inferArchetype(adversaire), level: 3 }`, moteur compté, 80 coups au plus. Ça s'arrête quand c'est de nouveau mon tour ou que la partie est finie.
- La note est la moyenne des `evaluate(état final, seat, profile.archetype)`. Si une copie donne -Infinity, la moyenne vaut -Infinity.
- Si le budget est épuisé avant une copie, la copie n'est pas jouée. Sans aucune copie jouée, on prend `evaluate(leaf, …)`.

- [ ] **Step 1 : tests** :
  - `inferArchetype : majorité dragon` : un joueur avec 6 cartes `archetype: 'dragon'` et 2 `'pipou'` → `'dragon'`.
  - `riposte voit la Prime gagnante adverse` : mon terrain est vide, et l'adversaire a une Prime restante et un monstre en mode ATK qui peut attaquer. Après la fin de mon tour, `riposte` vaut `-Infinity`, alors qu'`evaluate(leaf)` est fini.
  - `riposte sur une partie finie` : `leaf` gagnée → `Infinity`, `counter.used === 0`.
  - `le plan évite une fin de tour perdante` : un scénario où laisser un monstre en ATK permet à l'adversaire de prendre la dernière Prime, et où passer en Garde l'en empêche. Avec `STRONGEST`, le plan se termine avec ce monstre en Garde.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter, et brancher `riposte` dans `planTurn`.
- [ ] **Step 4 :** jest `src/fights/ai` → PASS.
- [ ] **Step 5 : commit** `feat(back): l'IA anticipe la riposte adverse`.

### Task 4 : Cerveaux au tournoi et mode miroir

**Files:**
- Modify: `apps/backend/src/fights/ai/tournament.ts`, `tournament-jobs.ts`, `tournament-generated.cli.ts`, `report.ts`
- Test: `tournament.spec.ts`, `tournament-jobs.spec.ts`, `report.spec.ts`

**Interfaces:**
- `TournamentEntry` gagne `brain?: 'greedy' | 'plan'` (absent = `'greedy'`). `playGame` crée un `AiPlayer` par siège : `STRONGEST` pour `'plan'`.
- `Job` gagne `brain: 'greedy' | 'plan'` et `mirror?: number` (indice du deck). `runJob` construit :
  - sans miroir : les 15 entrées générées avec `brain` ;
  - en miroir : 2 entrées du même deck, `"<nom> nouveau"` (`plan`) et `"<nom> ancien"` (`greedy`).
- `planMirrorJobs(deckSeeds: number[], gamesPerPair: number, seed: number): Job[]` : un job par graine de decks et par deck. Pour chaque job, les parties viennent de `planGames(deux entrées, gamesPerPair, seed + 1000 * indiceDeck)`.
- `formatMirror(r: TournamentResult): string` : par archétype, le taux de victoire des entrées « nouveau » avec l'intervalle de Wilson, l'écart entre le meilleur et le moins bon archétype, et le verdict (≥ 60 % partout, écart < 10 points).
- CLI : `--brain greedy|plan` (défaut `plan`) et `--mirror`. En miroir, le résumé est `formatMirror` et les fichiers s'appellent `tournament-miroir-<échelle>-…`.

- [ ] **Step 1 : tests** :
  - `tournament.spec` : `un deck « plan » joue avec le planificateur` : `runTournament` sur deux entrées dont une `brain: 'plan'` finit ses parties, et la télémétrie a ses 2 decks.
  - `tournament-jobs.spec` : `planMirrorJobs([1], 2, 42)` donne 15 jobs de 2 parties ; `runJob(jobs[0]).byEntry` a les noms `… nouveau` et `… ancien`.
  - `report.spec` : `formatMirror` avec un nouveau cerveau à 70 % / 65 % / 62 % → « critère atteint » ; à 70 % / 50 % / 62 % → « critère non atteint ».
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** jest `src/fights/ai` → PASS.
- [ ] **Step 5 : commit** `feat(back): cerveau par deck au tournoi et mode miroir`.

### Task 5 : Réglage, vérification de force égale, mesure

**Files:**
- Modify: `apps/backend/src/fights/ai/planner.ts` (`STRONGEST`) et `archetype-profiles.ts` si le réglage l'exige
- Modify: `docs/superpowers/plans/2026-10-19-balance-results.md`

- [ ] **Step 1 :** `pnpm --filter @pipou/backend tournament:generated --scale rapide --mirror`. Noter la durée et le verdict.
- [ ] **Step 2 :** si la durée extrapolée au Standard (× 8,3 environ) dépasse ~1 h, réduire `budget`, puis `depth`, puis `ripostes`. Si le critère de force égale n'est pas atteint, régler `prepEvolve` / `prepEquip` / `prepTarget` de l'archétype en retard, puis relancer. Au plus 3 itérations. Chaque essai est consigné : valeurs, verdict, durée.
- [ ] **Step 3 :** `pnpm --filter @pipou/backend tournament:generated --scale standard`, avec le nouveau cerveau par défaut.
- [ ] **Step 4 :** ajouter « Nouveau cerveau (Standard) » au document de résultats :
  - les valeurs retenues et les essais du miroir ;
  - le résumé copié tel quel ;
  - l'écart par archétype avec la référence ;
  - 3 à 5 lignes de lecture : l'écart Dragon venait-il de l'IA ou des cartes ? Quelles alertes changent ?
- [ ] **Step 5 :** `pnpm --filter @pipou/backend test` et `lint` → verts. **Commit** `docs: mesure du nouveau cerveau`, avec le réglage s'il a changé.
