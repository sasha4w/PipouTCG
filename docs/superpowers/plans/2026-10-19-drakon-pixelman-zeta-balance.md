# Rééquilibrage Drakon, Pixelman et Zeta — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** renforcer Drakon (œufs, évolution, deux cartes), assainir Pixelman (supports, deux cartes), refaire Noyau Zeta en « virus », adapter l'IA et ses decks d'aventure, et mesurer l'effet par une simulation IA contre IA avant/après.

**Architecture :** les règles nouvelles vivent dans le moteur (`apps/backend/src/fights`) et dans `@pipou/shared` (enums d'effet, règles partagées front/IA). Les cartes changent par un fichier de patch versionné + une migration gardée par empreinte (modèle `drakon-set-patches.ts`). Les decks d'IA sont régénérés par une migration qui réutilise `generateDeck`. Le tournoi est une fonction pure testée + une commande qui lit les decks de la base locale.

**Tech Stack :** NestJS 11, TypeORM (MySQL), Jest (back), React 18 + Vitest (front), pnpm workspaces, `@pipou/shared`.

**Spec :** `docs/superpowers/specs/2026-10-19-drakon-pixelman-zeta-balance-design.md`

## Global Constraints

- Tout type ou enum échangé entre front et back vit dans `@pipou/shared` ; après modification : `pnpm build:shared`.
- Chaque nouvelle valeur d'`ActionType` / `EffectTrigger` est implémentée **et** ajoutée à `apps/backend/src/fights/engine/supported-effects.ts` dans la même tâche (sinon `effects-coverage.spec.ts` échoue).
- Jamais d'écriture directe sur Aiven. Les migrations se vérifient sur la base Docker locale `cardcollect` (`ENV_FILE=.env.e2e DB_NAME=cardcollect`).
- Migrations de cartes gardées par empreinte avant/après (`planDrakonPatch` comme modèle) : une carte qui a divergé n'est pas touchée, un `warn` est logué.
- Code, commentaires, messages de log et textes de règles en français, dans le ton existant. UI : icônes SVG, jamais d'emoji nouveaux.
- Commits sur `dev`, messages `feat(back): …` / `feat(front): …` / `feat(shared): …`, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Valeurs de la spec (les seules à utiliser) : œufs Genèse/Dualité 900 PV, Céleste 1500 PV ; Zeta 0 ATK / 1200 PV / coût 2 / compteur 3 ; virus −300 ATK, −600 avec Module Bluetooth ; explosion 500 dégâts à tous les monstres adverses ; DuplicateX : copie bloquée en attaque 2 tours du propriétaire, PV actuels de l'original ; Appel des ancêtres : 2 cartes ; Mise à jour .patch : compteur remis à 3.

## Review Focus

1. **Zeta après la mort de son poseur ou en fin de partie** : un Zeta implanté dont l'adversaire est l'hôte ne doit jamais devenir un monstre utilisable par l'hôte (attaque, Garde, équipement, cible « allié » d'un éphémère, base d'évolution, recyclage). Testé en tâche 5.
2. **Copie de DuplicateX qui quitte le terrain** (destruction, renvoi en main, évolution par-dessus) : elle et ses équipements copiés disparaissent, rien n'arrive au cimetière ni en main. Testé en tâche 4.
3. **Mont Drakon sans cible** (deck et cimetière sans monstre Drakon) : pas de choix vide en attente, une ligne de log, la partie continue. Testé en tâche 9.
4. **Virus qui ferait passer l'ATK sous 0** (petit monstre à 100 ATK) : l'ATK effective reste à 0, et une attaque à 0 ATK ne fait pas de dégâts négatifs. Testé en tâche 7.
5. **Explosion de Zeta qui tue plusieurs monstres hôtes en chaîne** (effets ON_DEATH qui piochent ou invoquent) : ordre stable, pas d'exception, Zeta ne reçoit pas les 500 dégâts. Testé en tâche 8.

---

## Décisions prises en écrivant le plan (à relire par le joueur)

- **Mont Drakon** utilise l'action existante `RETURN_FROM_GRAVEYARD_OR_DECK` (filtre monstre Drakon) : une seule fenêtre liste les cartes du deck **et** du cimetière, chacune avec sa provenance affichée. Le joueur choisit toujours « une carte du deck ou une du cimetière » ; on n'ajoute pas d'écran « Deck / Cimetière » en deux temps.
- **Désinfecter** passe par l'action `attack` existante : `targetInstanceId` peut désigner le Zeta implanté sur son propre terrain. Pas de nouveau type d'action.
- **Copie de DuplicateX** : une carte `token` ; elle reprend PV actuels, bonus permanents (`perm`), mode, compteur d'éclosion ; son `ON_SUMMON` se déclenche.
- **Régénération des decks d'IA** : écrase les decks Drakon et Pixelman existants, y compris d'éventuelles retouches faites dans l'admin.

## Fichiers

| Fichier | Rôle |
|---|---|
| `apps/backend/src/fights/ai/tournament.ts` (créé) | `runTournament` : fonction pure, joue toutes les paires d'IA |
| `apps/backend/src/fights/ai/tournament.cli.ts` (créé) | lit les IA en base, lance le tournoi, imprime le tableau |
| `packages/shared/src/enums/effect.ts` | nouveaux `ActionType` et `EffectTrigger` |
| `packages/shared/src/game/instance.ts` | `CardInstance.token`, `MonsterOnBoard.disinfectImmune` |
| `packages/shared/src/game/rules.ts` | `isImplanted`, `canImplantOn` |
| `apps/backend/src/fights/helpers/hatching.ts`, `services/summon.service.ts`, `services/pick.service.ts` | évolution le tour même pour ce qui sort d'un œuf |
| `apps/backend/src/fights/effects/effect-actions.applier.ts` | `DUPLICATE_MONSTER`, `RESET_TURN_COUNTER`, `SET_DISINFECT_IMMUNITY` |
| `apps/backend/src/fights/helpers/game-state.helper.ts` | `sendToGraveyard` (ignore les tokens), plancher d'ATK |
| `apps/backend/src/fights/services/battle.service.ts` | désinfection, interdictions liées à Zeta |
| `apps/backend/src/fights/buffs-calculator.service.ts` | aura du virus |
| `apps/backend/src/fights/services/phase.service.ts` | explosion (`ON_SELF_DESTRUCT`), fin de l'immunité de désinfection |
| `apps/backend/src/database/balance-2026-10-patches.ts` (créé) + `migrations/1791000000009-BalanceDrakonPixelman.ts` | données des cartes |
| `apps/backend/src/fights/testing/real-cards.ts` | applique ces patches aux vraies cartes de test |
| `apps/backend/src/adventure/deck-generator.ts` + `migrations/1791000000010-RegenerateAdventureDecks.ts` | decks d'IA |
| `apps/backend/src/fights/ai/candidate-actions.ts`, `evaluate.ts` | IA |
| `apps/frontend/src/features/fight/effectText.ts` + `i18n/locales/{fr,en,ko}` | texte des nouveaux effets |
| `apps/frontend/src/features/fight/FightBoard.tsx` (+ `useBoardControls.ts`) | désinfection, Zeta inutilisable par l'hôte, équipement sur son Zeta |

---

### Task 1 : Tournoi IA contre IA et mesure « avant »

**Files :**
- Create : `apps/backend/src/fights/ai/tournament.ts`, `apps/backend/src/fights/ai/tournament.spec.ts`, `apps/backend/src/fights/ai/tournament.cli.ts`
- Modify : `apps/backend/package.json` (script `tournament`)

**Interfaces :**
- Produces :
  ```ts
  export interface TournamentEntry { name: string; archetype: AdventureArchetype; level: AiLevel; deck: Card[] /* une entrée par exemplaire */ }
  export interface TournamentResult {
    games: number;
    byEntry: { name: string; archetype: AdventureArchetype; level: AiLevel; wins: number; played: number }[];
    byArchetype: Record<AdventureArchetype, Record<AdventureArchetype, { wins: number; played: number }>>;
  }
  export function runTournament(entries: TournamentEntry[], gamesPerPair: number, seed: number): TournamentResult
  export function formatTournament(result: TournamentResult): string // tableau markdown
  ```
- Consumes : `createEngine`, `fixedRng`, `AiPlayer`, `aiMustAct`, `createGameState` (même câblage que `ai-selfplay.spec.ts`, y compris le `Math.random` figé et le mélange par `seeded`).

- [ ] **Step 1 : test** — `tournament.spec.ts` : deux entrées construites avec `allRealCards()` (un deck pipou niveau 3 et un deck dragon niveau 3 via `generateDeck`), `runTournament(entries, 2, 1)` ; asserts : `result.games === 2`, chaque entrée `played === 2`, somme des `wins` === 2 (pas de nul compté comme victoire : une partie sans vainqueur après `MAX_ACTIONS` compte dans `played` mais pas dans `wins`), et chaque paire joue autant de fois de chaque côté (p1/p2 alternés).
- [ ] **Step 2 :** `pnpm --filter @pipou/backend exec jest src/fights/ai/tournament.spec.ts` → FAIL (module absent).
- [ ] **Step 3 :** implémenter `runTournament` (chaque paire non ordonnée joue `gamesPerPair` parties, la moitié avec chaque entrée en p1 ; profil IA `{ archetype, level }` de l'entrée) et `formatTournament` (classement par taux de victoire puis tableau archétype contre archétype).
- [ ] **Step 4 :** test → PASS.
- [ ] **Step 5 :** `tournament.cli.ts` : initialise `src/database/data-source.ts`, charge `AdventureOpponent` (+ `world`, `cards` avec `card`) dont le monde est actif, construit les entrées (archétype lu dans `signature` JSON, niveau = `position`), lance `runTournament(entries, 10, 42)`, imprime `formatTournament` et écrit le JSON dans `apps/backend/.e2e/tournament-<horodatage>.json` (dossier déjà ignoré par git). Script `package.json` : `"tournament": "dotenv -e .env.e2e -- ts-node -r tsconfig-paths/register src/fights/ai/tournament.cli.ts"`.
- [ ] **Step 6 :** base Docker lancée (`docker compose up -d db`), `pnpm --filter @pipou/backend tournament` → tableau imprimé, 1 050 parties. Copier le tableau dans `docs/superpowers/plans/2026-10-19-balance-results.md` sous « Avant ».
- [ ] **Step 7 : commit** `feat(back): tournoi IA contre IA sur les decks d'aventure`.

### Task 2 : Évolution le tour même pour ce qui sort d'un œuf

**Files :**
- Modify : `apps/backend/src/fights/interfaces/game-state.interface.ts` (`PendingChoice.fromEgg?: boolean`), `fights/helpers/hatching.ts`, `fights/effects/effect-actions.applier.ts` (`SUMMON_FROM_DECK`), `fights/services/pick.service.ts`, `fights/services/summon.service.ts`
- Test : `apps/backend/src/fights/engine/drakon-mechanics.spec.ts`

**Interfaces :**
- Produces : `SummonService.summonFromDeck(game, owner, card, preferredZone?, opts?: { fromEgg?: boolean }): boolean` — avec `fromEgg`, le monstre posé a `canEvolveThisTurn = true`.

- [ ] **Step 1 : tests** (`describe('ce qui sort d\'un œuf évolue le tour même')`) :
  - « le Bébé éclos en début de tour peut évoluer aussitôt » : œuf (`SET_HATCH_COUNTER` 1, stage baby) chez p1, Bébé X dans le deck, Jeune X en main ; `passTurn` deux fois pour revenir à p1 ; résoudre le choix d'éclosion ; `evolve` du Jeune sur le Bébé → pas d'erreur, `monsterNamed(game,'p1','Jeune X')` existe.
  - « le Jeune invoqué par la mort de la Dualité pendant mon tour peut évoluer » : œuf avec `ON_DEATH SUMMON_FROM_DECK {stage:'young'}` détruit par un éphémère `DESTROY_MONSTER TARGET_ALLY` de p1 ; choisir le Jeune ; `evolve` de l'Adulte → OK.
  - « un monstre invoqué depuis le deck par un non-œuf attend toujours » : `SUMMON_FROM_DECK` déclenché par un monstre non-œuf → `evolve` refusé avec l'erreur `doit attendre un tour avant d'évoluer`.
- [ ] **Step 2 :** jest sur ce fichier → les deux premiers FAIL.
- [ ] **Step 3 :** `hatchEgg` met `fromEgg: true` sur le `queueChoice` ; `SUMMON_FROM_DECK` met `fromEgg: true` si `ctx.sourceMonster?.card.baseCard.stage === 'egg'` ; `PickService` (résolution `summon_to_zone`) passe `{ fromEgg: choice.fromEgg }` à `summonFromDeck`.
- [ ] **Step 4 :** jest → PASS ; `pnpm --filter @pipou/backend exec jest src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): un Drakon sorti d'un œuf peut évoluer le tour même`.

### Task 3 : Plancher d'ATK et cartes « token »

**Files :**
- Modify : `packages/shared/src/game/instance.ts` (`CardInstance.token?: boolean`), `apps/backend/src/fights/helpers/game-state.helper.ts`, `fights/effects-resolver.service.ts` (`destroyMonster`), `fights/services/evolution.service.ts`, `fights/effects/effect-actions.applier.ts` (`returnMonsterToHand`)
- Test : `apps/backend/src/fights/engine/destruction.spec.ts`, `combat.spec.ts`

**Interfaces :**
- Produces : `sendToGraveyard(player: PlayerGameState, ...cards: CardInstance[]): void` (ignore les `token`), `effectiveAtk` jamais négatif.

- [ ] **Step 1 : tests** — `effectiveAtk` d'un monstre 100 ATK avec `atkBuff = -300` vaut `0` ; un monstre à 0 ATK effective attaque un monstre 500 PV → PV inchangés ; un monstre dont `card.token` et un équipement `token` est détruit → cimetière inchangé ; renvoyé en main (éphémère `RETURN_TO_HAND`) → main inchangée ; servi de base à une évolution → cimetière sans le token.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** `effectiveAtk` = `Math.max(0, …)` ; `sendToGraveyard` utilisé par `destroyMonster`, `EvolutionService.evolve` (base), `hatchEgg` ; `returnMonsterToHand` ne remet pas en main les cartes `token`.
- [ ] **Step 4 :** `pnpm build:shared` puis jest `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): cartes token et ATK effective jamais négative`.

### Task 4 : `DUPLICATE_MONSTER` (DuplicateX)

**Files :**
- Modify : `packages/shared/src/enums/effect.ts` (`DUPLICATE_MONSTER`), `apps/backend/src/fights/engine/supported-effects.ts`, `fights/effects/effect-actions.applier.ts`, `fights/effects/effect-resolvability.ts`
- Test : `apps/backend/src/fights/engine/supports.spec.ts`

**Interfaces :**
- Consumes : `CardInstance.token`, `createMonsterOnBoard`.
- Produces : action `{ type: 'DUPLICATE_MONSTER', target: 'TARGET_ALLY', value: 2 }` — `value` = tours de blocage d'attaque de la copie.

- [ ] **Step 1 : tests** :
  - copie d'un allié équipé, abîmé (1200/1800 PV, 1 équipement) → nouvelle zone occupée par un monstre de même nom, `currentHp === 1200`, 1 équipement `token`, `card.token === true`, `blockAttackTurns === 2` ;
  - son `ON_SUMMON` se déclenche (monstre test avec `ON_SUMMON SET_TAUNT` → copie `hasTaunt`) ;
  - attaque refusée au tour de pose et au tour suivant du propriétaire, acceptée au troisième (`passTurn` ×2 entre) ;
  - éphémère injouable sans case libre (`Cette carte n'aurait aucun effet pour l'instant`) ;
  - destruction de la copie : l'adversaire gagne une Prime en combat comme d'habitude, cimetière du propriétaire inchangé.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** dans l'applier : première zone libre du propriétaire ; copie = `createMonsterOnBoard({ instanceId, baseCard, ownerId, token: true })`, puis `perm` cloné, `currentHp`, `mode`, `hatchCounter`/`hatchStage` repris, équipements clonés en `token`, `blockAttackTurns = value ?? 2` ; événement `monster_summoned` ; `ON_SUMMON` résolu sur la copie. `canResolveAction` : faux s'il n'y a pas de zone libre.
- [ ] **Step 4 :** jest → PASS (dont `effects-coverage.spec.ts`).
- [ ] **Step 5 : commit** `feat(back): effet de copie de monstre (DuplicateX)`.

### Task 5 : Zeta implanté — l'hôte ne peut pas s'en servir, un seul par terrain

**Files :**
- Modify : `packages/shared/src/game/rules.ts`, `apps/backend/src/fights/services/summon.service.ts`, `battle.service.ts`, `support.service.ts`, `evolution.service.ts`, `fights/effects/effect-targets.resolver.ts`
- Test : `packages/shared/src/game/rules.test.ts`, `apps/backend/src/fights/engine/card-rework-mechanics.spec.ts`

**Interfaces :**
- Produces (shared) :
  ```ts
  /** Monstre posé chez `hostUserId` par l'adversaire (Zeta). */
  export function isImplanted(m: { ownerUserId?: number }, hostUserId: number): boolean
  /** Le poseur peut-il implanter un monstre sur ce terrain ? (un seul à la fois) */
  export function canImplantOn(hostZones: readonly ({ ownerUserId?: number } | null)[], posterUserId: number): boolean
  ```

- [ ] **Step 1 : tests shared** — `isImplanted({ownerUserId: 1}, 2) === true`, `isImplanted({}, 2) === false`, `isImplanted({ownerUserId: 2}, 2) === false` ; `canImplantOn([null, {ownerUserId: 1}, null], 1) === false`, `canImplantOn([null, null, null], 1) === true`.
- [ ] **Step 2 : tests moteur** (Zeta de test : `SUMMONABLE_ON_ENEMY_SIDE`, posé chez p2 avec `ownerUserId: P1_ID`) :
  - p1 ne peut pas poser un second Zeta chez p2 (erreur `Un seul Zeta à la fois chez l'adversaire`) ;
  - p2 ne peut pas attaquer avec, ni changer son mode, ni l'équiper, ni le viser avec un éphémère « allié », ni faire évoluer dessus ;
  - un effet `ALL_ENEMIES` de p1 ne touche pas son propre Zeta ; `ALL_ALLIES` de p2 ne le compte pas ;
  - p1 peut l'équiper (`play_support` équipement avec `targetInstanceId` du Zeta chez p2).
- [ ] **Step 3 :** jest/vitest → FAIL.
- [ ] **Step 4 :** implémenter : helpers shared ; `summon` refuse si `!canImplantOn` ; `resolveTargets` retire les implantés des alliés de l'hôte et des ennemis du poseur ; `battle.attack` refuse un attaquant implanté ; `changeMode` refuse ; `playSupport` équipement : cible cherchée dans mes zones (hors implantés) **ou** parmi les monstres implantés par moi chez l'adversaire ; ciblage d'éphémère « ally » hors implantés (aussi dans `isTargetableByEphemeral` côté shared si c'est là que se filtre le pool) ; `evolve` refuse une base implantée.
- [ ] **Step 5 :** `pnpm build:shared`, vitest shared + jest `src/fights` → PASS.
- [ ] **Step 6 : commit** `feat(back): Zeta implanté reste au poseur, un seul par terrain`.

### Task 6 : Désinfecter

**Files :**
- Modify : `packages/shared/src/enums/effect.ts` (`SET_DISINFECT_IMMUNITY`), `packages/shared/src/game/instance.ts` (`MonsterOnBoard.disinfectImmune?: boolean`), `apps/backend/src/fights/services/battle.service.ts`, `fights/effects/effect-actions.applier.ts`, `fights/services/phase.service.ts`, `fights/engine/supported-effects.ts`
- Test : `apps/backend/src/fights/engine/combat.spec.ts`

- [ ] **Step 1 : tests** :
  - en phase de combat, p2 attaque le Zeta implanté chez lui (`attack` avec `targetInstanceId` = Zeta) : dégâts = ATK effective de l'attaquant, pas de riposte, l'attaque est consommée, aucune Prime pour personne, pas de pioche ; à 0 PV, Zeta est détruit et va au cimetière de p1 (son propriétaire de carte) ;
  - la Provocation de p1 n'oblige pas à attaquer ailleurs ; un monstre en Garde ne peut pas désinfecter ;
  - p1 ne peut pas attaquer son propre Zeta (erreur `Tu ne peux pas attaquer ton propre Zeta`) ;
  - `SET_DISINFECT_IMMUNITY` posé sur Zeta (équipement `ON_PLAY` condition `EQUIPPED_ON 'Noyau Zeta'`) : désinfection refusée (`Zeta est protégé jusqu'au prochain tour de son poseur`) jusqu'au début du tour suivant de p1, puis acceptée.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** `battle.attack` : si la cible est dans les zones de l'attaquant et `isImplanted` → chemin désinfection (mêmes validations d'attaquant ; refus si `disinfectImmune`) ; si la cible est implantée par l'attaquant chez l'adversaire → refus. Destruction : cause `COMBAT`, `draw: false`, carte au cimetière du poseur. Applier : `SET_DISINFECT_IMMUNITY` met `disinfectImmune = true` ; `processTurnCounters` le remet à `false` au début du tour du poseur.
- [ ] **Step 4 :** jest → PASS ; vérifier que `client-state.builder.ts` transmet `disinfectImmune` et `ownerUserId` au client (test dans `client-state.builder.spec.ts`).
- [ ] **Step 5 : commit** `feat(back): désinfecter un Zeta, protection par Firewall de Surcharge`.

### Task 7 : Aura du virus

**Files :**
- Modify : `packages/shared/src/enums/effect.ts` (`VIRUS_ATK_DEBUFF`), `apps/backend/src/fights/buffs-calculator.service.ts`, `fights/engine/supported-effects.ts`
- Test : `apps/backend/src/fights/engine/auras.spec.ts`

- [ ] **Step 1 : tests** :
  - Zeta avec `PASSIVE VIRUS_ATK_DEBUFF SELF value 300` implanté chez p2 : chaque autre monstre de p2 perd 300 ATK effective ; un monstre `SET_DEBUFF_IMMUNITY` ne perd rien ; un monstre à 100 ATK affiche 0 ;
  - équipement sur Zeta avec `PASSIVE VIRUS_ATK_DEBUFF SELF value 600` condition `EQUIPPED_ON 'Noyau Zeta'` → malus 600 (le plus fort, pas la somme) ;
  - Zeta posé sur son propre terrain (cas impossible en jeu mais pas d'aura) : aucun malus sur ses alliés ;
  - Zeta détruit → malus disparu au recalcul.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** dans `recalculatePlayer(host)`, après l'étape 4 : pour chaque monstre `isImplanted(m, host.userId)`, `virus = max(valeurs des actions VIRUS_ATK_DEBUFF de ses passifs et des passifs de ses équipements dont la condition est remplie)` ; `atkBuff -= virus` sur chaque autre monstre de l'hôte non `isImmuneToDebuffs`.
- [ ] **Step 4 :** jest → PASS.
- [ ] **Step 5 : commit** `feat(back): aura de virus des monstres implantés`.

### Task 8 : Explosion et remise du compteur

**Files :**
- Modify : `packages/shared/src/enums/effect.ts` (`EffectTrigger.ON_SELF_DESTRUCT`, `ActionType.RESET_TURN_COUNTER`), `apps/backend/src/fights/services/phase.service.ts`, `fights/effects/effect-actions.applier.ts`, `fights/effects/effect-resolvability.ts`, `fights/engine/supported-effects.ts`
- Test : `apps/backend/src/fights/engine/card-rework-mechanics.spec.ts`

- [ ] **Step 1 : tests** :
  - Zeta (`turnCounter` 1, `ON_SELF_DESTRUCT DEAL_DAMAGE ALL_ENEMIES 500`) implanté chez p2 avec deux monstres p2 (600 et 400 PV) : au début du tour de p1, p1 gagne 1 Prime, Zeta est détruit sans pioche pour p2, le monstre à 600 PV tombe à 100, celui à 400 meurt (son `ON_DEATH` qui pioche se résout) ; Zeta n'apparaît dans aucune ligne de dégâts ;
  - `RESET_TURN_COUNTER PLAYER value 3` joué par p1 avec un Zeta implanté à compteur 1 → compteur 3 ; injouable sans Zeta implanté.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** `processTurnCounters` : à 0, `gainPrime` puis `destroyMonster(..., { draw: false, cause: SELF_DESTRUCT })`, puis `resolve(zone.card, ON_SELF_DESTRUCT, { ownerUserId: poseur, sourceMonster: zone })`. Applier `RESET_TURN_COUNTER` : monstres implantés par le joueur chez l'adversaire ayant `turnCounter !== undefined` → `turnCounter = value ?? 3`. Résolvabilité : vrai seulement s'il en existe un.
- [ ] **Step 4 :** jest → PASS.
- [ ] **Step 5 : commit** `feat(back): explosion de Zeta et remise de son compteur`.

### Task 9 : Données des cartes (patch + migration)

**Files :**
- Create : `apps/backend/src/database/balance-2026-10-patches.ts`, `.spec.ts`, `apps/backend/src/database/migrations/1791000000009-BalanceDrakonPixelman.ts`
- Modify : `apps/backend/src/fights/testing/real-cards.ts`
- Test : `apps/backend/src/fights/engine/real-cards.spec.ts`

**Interfaces :**
- Produces :
  ```ts
  export interface BalanceFields { name: string; description: string | null; atk: number; hp: number; cost: number; effects: CardEffect[] | null }
  export interface BalancePatch { before: BalanceFields; after: BalanceFields }
  export interface BalanceNewCard { name: string; rarity: Rarity; type: 'monster' | 'support'; supportType: SupportType | null; archetype: 'dragon' | 'pixelman'; setOf: string /* nom d'une carte du set visé */; atk: number; hp: number; cost: number; description: string; effects: CardEffect[] }
  export const BALANCE_PATCHES: BalancePatch[]; export const BALANCE_NEW_CARDS: BalanceNewCard[];
  export function planBalancePatch(current, patch, direction): PatchDecision
  ```

`before` = valeurs actuelles exactes de la base locale (`SELECT name, description, atk, hp, cost, effects FROM card WHERE name = ?`). `after` :

| Carte | Changement |
|---|---|
| Œuf de la Genèse, Œuf de la Dualité | hp 900 |
| Œuf Céleste | hp 1500 |
| Incubation Rapide, Souffle Primordial | cost 0 |
| Écaille de Dragon | cost 0, hp 0 |
| Module de Réparation .exe | + `PASSIVE BUFF_HP SELF 400` |
| Firewall .sys | hp 0 |
| Surcharge Overclock | atk 0 |
| Force Delta | condition `SPECIFIC_CARD_ON_BOARD value 'Noyau Delta'` sur son `ON_PLAY` |
| Formatage .exe | `ON_PLAY` : `DESTROY_MONSTER TARGET_ALLY`, puis `RETURN_FROM_GRAVEYARD PLAYER value 1 filter {archetype:'pixelman', type:'monster'}` |
| Noyau Zeta | hp 1200 ; effets : `ON_SUMMON SET_TURN_COUNTER SELF 3`, `PASSIVE SUMMONABLE_ON_ENEMY_SIDE SELF`, `PASSIVE VIRUS_ATK_DEBUFF SELF 300`, `ON_SELF_DESTRUCT DEAL_DAMAGE ALL_ENEMIES 500` |
| Firewall de Surcharge .sys | + `ON_PLAY SET_DISINFECT_IMMUNITY SELF` condition `EQUIPPED_ON 'Noyau Zeta'` |
| Module Bluetooth .v2 | + `PASSIVE VIRUS_ATK_DEBUFF SELF 600` condition `EQUIPPED_ON 'Noyau Zeta'` |

Nouvelles cartes (`setOf` : `Bébé Teros` pour Drakon, `Noyau Alpha` pour Pixelman) :

| Nom | Type | Rareté | Coût | Effets |
|---|---|---|---|---|
| Mont Drakon | support TERRAIN | epic | 0 | `ON_TURN_START RETURN_FROM_GRAVEYARD_OR_DECK PLAYER filter {archetype:'dragon', type:'monster'}` |
| Appel des ancêtres | support EPHEMERAL | rare | 0 | `ON_PLAY RETURN_FROM_GRAVEYARD PLAYER value 2 filter {archetype:'dragon'}` |
| Restauration .bak | support EPHEMERAL | rare | 0 | `ON_PLAY RETURN_FROM_GRAVEYARD_OR_DECK PLAYER filter {name:'Noyau', archetype:'pixelman'}` |
| DuplicateX | support EPHEMERAL | legendary | 0 | `ON_PLAY DUPLICATE_MONSTER TARGET_ALLY value 2` |
| Mise à jour .patch | support EPHEMERAL | rare | 0 | `ON_PLAY RESET_TURN_COUNTER PLAYER value 3` |

Toutes les descriptions `after` et des nouvelles cartes décrivent exactement l'effet (ton des cartes existantes) ; `image_id` reste `NULL`.

- [ ] **Step 1 : tests du patch** (modèle `drakon-set-patches.spec.ts`) : `planBalancePatch` renvoie `apply` sur `before`, `already-done` sur `after`, `skip-diverged` sur une valeur modifiée ; aller-retour up/down.
- [ ] **Step 2 : tests vraies cartes** (`real-cards.spec.ts`, avec `realCard`) : Mont Drakon posé, au début du tour suivant de son propriétaire un choix liste les monstres Drakon du deck et du cimetière ; sans aucun → aucun choix, une ligne de log ; Appel des ancêtres propose 2 cartes Drakon du cimetière ; Force Delta injouable sans Noyau Delta, jouable avec ; Formatage détruit l'allié puis propose un monstre Pixelman du cimetière ; Module de Réparation donne +400 PV max ; Zeta réel : 1200 PV, virus, explosion.
- [ ] **Step 3 :** jest → FAIL.
- [ ] **Step 4 :** écrire le fichier de patch, la migration (`up` : patchs puis insertion des cartes absentes avec `card_set_id` de `setOf` ; `down` : suppression des cartes créées non référencées, puis patchs inverses — modèle `1791000000006-DrakonSet.ts`), et appliquer `BALANCE_PATCHES` / `BALANCE_NEW_CARDS` dans `allRealCards()`.
- [ ] **Step 5 :** jest `src/fights src/database` → PASS. Migration sur la base locale : `pnpm --filter @pipou/backend migration:run:local` (`.env.e2e` vise déjà `cardcollect`) puis vérifier en SQL les PV des œufs, les 5 nouvelles cartes et les effets de Zeta ; `pnpm --filter @pipou/backend migration:revert:local` puis `migration:run:local` à nouveau → identique.
- [ ] **Step 6 : commit** `feat(back): rééquilibrage des cartes Drakon et Pixelman`.

### Task 10 : Texte des effets (front)

**Files :**
- Modify : `apps/frontend/src/features/fight/effectText.ts`, `apps/frontend/src/i18n/locales/{fr,en,ko}/*.json` (clés `effects.action.*`, `effects.trigger.*`)
- Test : `apps/frontend/src/__tests__/unit/effectText.test.ts`

- [ ] **Step 1 : tests** — `describeCardEffects` en français pour : Zeta (« À son autodestruction : inflige 500 dégâts à tous les monstres adverses », ligne de virus « Les monstres adverses perdent 300 ATK »), DuplicateX (copie + « ne peut pas attaquer pendant 2 tours »), Mise à jour .patch (« remet le compteur de ton Zeta à 3 »), Firewall de Surcharge sur Zeta (protection contre la désinfection). Aucune ligne `effects.action.unknown`.
- [ ] **Step 2 :** vitest → FAIL.
- [ ] **Step 3 :** entrées `ACTIONS` pour `DUPLICATE_MONSTER`, `VIRUS_ATK_DEBUFF` (ton `debuff`), `RESET_TURN_COUNTER`, `SET_DISINFECT_IMMUNITY` ; libellé du déclencheur `ON_SELF_DESTRUCT` ; traductions fr/en/ko.
- [ ] **Step 4 :** vitest + `pnpm --filter @pipou/frontend typecheck` → PASS.
- [ ] **Step 5 : commit** `feat(front): texte des nouveaux effets`.

### Task 11 : Plateau de combat (front)

**Files :**
- Modify : `apps/frontend/src/features/fight/FightBoard.tsx`, `useBoardControls.ts` (si besoin)
- Test : `apps/frontend/src/__tests__/components/FightBoard.test.tsx`

**Interfaces :**
- Consumes : `isImplanted`, `canImplantOn` (shared), `MonsterOnBoard.ownerUserId`, `disinfectImmune`.

- [ ] **Step 1 : tests** :
  - phase combat, attaquant sélectionné, Zeta implanté sur mon terrain : la case du Zeta est une cible cliquable et envoie `attack` avec son `targetInstanceId` ; si `disinfectImmune`, elle est désactivée avec l'info « Protégé jusqu'au prochain tour adverse » ;
  - le Zeta implanté chez moi ne peut pas être sélectionné comme attaquant ni changer de mode ;
  - avec un équipement sélectionné, mon Zeta posé chez l'adversaire est une cible d'équipement ;
  - poser Zeta chez l'adversaire est désactivé quand `canImplantOn` est faux.
- [ ] **Step 2 :** vitest → FAIL.
- [ ] **Step 3 :** implémenter dans `FightBoard.tsx` (icônes SVG existantes de `components/Icons`, pas d'emoji).
- [ ] **Step 4 :** vitest + typecheck + lint front → PASS.
- [ ] **Step 5 : commit** `feat(front): désinfecter un Zeta et équiper son Zeta chez l'adversaire`.

### Task 12 : IA et decks d'aventure

**Files :**
- Modify : `apps/backend/src/fights/ai/candidate-actions.ts`, `evaluate.ts`, `apps/backend/src/adventure/deck-generator.ts`
- Create : `apps/backend/src/database/migrations/1791000000010-RegenerateAdventureDecks.ts`
- Test : `apps/backend/src/fights/ai/ai-player.spec.ts`, `apps/backend/src/adventure/deck-generator.spec.ts`

- [ ] **Step 1 : tests IA** :
  - candidats de l'hôte : désinfection du Zeta (attaque sur sa propre case) ; jamais d'attaque/changement de mode/équipement avec le Zeta implanté ;
  - candidats du poseur : équipements sur son Zeta chez l'adversaire ; pas de second Zeta si `!canImplantOn` ;
  - `evaluate` : un Zeta implanté ne compte pas dans la valeur de plateau de l'hôte ; pour l'hôte, une position où le Zeta est désinfecté vaut plus qu'une où il reste avec 2 monstres sous virus ;
  - situation scriptée : Bébé éclos + Jeune en main + coût payable → l'IA niveau 3 choisit `evolve` ce tour.
- [ ] **Step 2 : tests decks** : `generateDeck` Drakon niveau 3 contient ≥ 1 Mont Drakon et ≥ 1 Appel des ancêtres, niveau 5 : 2 de chaque ; niveaux 1-2 : aucun forcé ; Pixelman signature Noyau Zeta : 2 Mise à jour .patch, Firewall de Surcharge et Module Bluetooth présents ; Pixelman niveaux 4-5 : 2 Restauration .bak, niveau 5 : 1 DuplicateX ; toutes les tailles restent entre `DECK_RULES.MIN_CARDS` et `MAX_CARDS`.
- [ ] **Step 3 :** jest → FAIL.
- [ ] **Step 4 :** implémenter : `listCandidates` (désinfection dans `attackCandidates`, exclusions, équipements sur son Zeta, `canImplantOn`), `evaluate` (implantés exclus de la valeur de l'hôte ; garder `COUNTER_PRIME` pour le poseur ; le virus est déjà pris via `effectiveAtk`), `dragonPlan` / `pixelmanPlan` (forçages ci-dessus, par `findByName`).
- [ ] **Step 5 :** migration `RegenerateAdventureDecks` : pour chaque `AdventureOpponent` dont `signature.archetype` vaut `dragon` ou `pixelman`, charger les cartes du set du monde (`queryRunner.manager.find(Card, …)`), `generateDeck(setCards, position, signature, Math.random)`, remplacer ses `adventure_opponent_card` dans la transaction de la migration. `down` : log « decks régénérés, pas de retour arrière ».
- [ ] **Step 6 :** jest `src/fights/ai src/adventure` → PASS (dont `ai-selfplay.spec.ts`, aucune action refusée). Migration lancée sur la base locale.
- [ ] **Step 7 : commit** `feat(back): IA et decks d'aventure pour Mont Drakon, DuplicateX et Zeta`.

### Task 13 : Mesure « après » et réglage

**Files :**
- Modify : `docs/superpowers/plans/2026-10-19-balance-results.md`, éventuellement `apps/backend/src/database/balance-2026-10-patches.ts`

- [ ] **Step 1 :** base locale migrée (tâches 9 et 12), `pnpm --filter @pipou/backend tournament` → tableau « Après » ajouté au fichier de résultats.
- [ ] **Step 2 :** comparer aux critères : chaque archétype entre 40 et 60 % contre les autres ; dans chaque monde, taux croissants avec le niveau, boss en tête.
- [ ] **Step 3 :** si un critère échoue : ajuster **uniquement** les valeurs chiffrées (PV des œufs, PV de Zeta, virus, explosion), mettre à jour patch + tests, relancer migration et tournoi. Au plus trois itérations.
- [ ] **Step 4 :** **arrêt obligatoire** : présenter au joueur les tableaux avant/après et la liste des valeurs modifiées ; attendre son accord avant le moindre push.
- [ ] **Step 5 :** après accord : `pnpm typecheck && pnpm lint && pnpm test` à la racine → tout passe ; commit `chore: résultats du rééquilibrage`.
