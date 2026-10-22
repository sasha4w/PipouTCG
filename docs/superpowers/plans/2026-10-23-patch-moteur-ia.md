# Patch Garde / Relève / Origines — plan 1 : moteur et IA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le moteur et l'IA savent jouer les mécaniques du patch : Garde à durée limitée et contre-offensive, renvoi de dégâts, Relève, terrain unique, stade ancestral, invocation et copie d'effets du Drakon des Origines, condition « un Noyau sur mon terrain ».

**Architecture:** les règles partagées (stades, mots-clés, conditions d'invocation) vont dans `@pipou/shared`, sans dépendance d'exécution. Le moteur (`apps/backend/src/fights`) les applique : `phase.service` (Garde), `battle.service` (renvoi), `summon.service` (Relève, Origines), `support.service` (terrain unique, changement de mode), le calculateur de bonus et l'applicateur d'effets. L'IA reçoit les nouveaux candidats dans `ai/candidate-actions.ts` et le stade ancestral dans `ai/evaluate.ts`. Aucune carte réelle n'est modifiée ici : les tests utilisent des cartes de test.

**Tech Stack:** NestJS 11, TypeScript, Jest (backend), Vitest (`@pipou/shared`).

**Spec:** `docs/superpowers/specs/2026-10-23-patch-garde-drakon-origines-design.md` (sections 1, 2 « renvoi de dégâts », 3, 4 « terrains » et « Force Plasma » côté condition, 5 « stade » et « Origines » côté moteur, 6).

## Global Constraints

- Branche `patch-garde-origines`. Commits en français : `feat(back): …`, `feat(shared): …`.
- Types et enums échangés front/back dans `@pipou/shared`, jamais redéfinis ailleurs. Après chaque modification de shared : `pnpm build:shared`.
- Toute valeur ajoutée à `ActionType`, `EffectTrigger` ou `EffectConditionType` est implémentée dans la même tâche et déclarée dans `apps/backend/src/fights/engine/supported-effects.ts`. Sinon `effects-coverage.spec.ts` échoue.
- Valeurs du design :
  - Garde : 2 tours adverses au plus, puis retour automatique en Attaque ;
  - contre-offensive : +100 ATK par tour adverse tenu, +200 au maximum, jusqu'à la fin du tour ;
  - Relève (N) : N alliés Pipou de son terrain envoyés au cimetière à la place du coût ;
  - un seul exemplaire d'un même terrain en jeu par joueur ;
  - stade `ancestral` après `adult` ;
  - Drakon des Origines invocable si le cimetière contient un Adulte ou un Ancestral de chacun des 4 éléments (`earth`, `fire`, `water`, `wind`).
- Le renvoi de dégâts se calcule sur les dégâts réellement subis (après réduction). Un attaquant tué par un renvoi pendant que le défenseur est en Garde ne rapporte pas de Prime.
- Les alliés sacrifiés par la Relève passent par `destroyMonster` avec la cause `DestroyCause.SACRIFICE` et `draw: false` : leur `ON_DEATH` se déclenche, sans Prime ni pioche de Prime.
- `pnpm --filter @pipou/backend test`, `pnpm --filter @pipou/shared test`, `pnpm --filter @pipou/backend lint` restent verts.

## Review Focus

1. **Relève sur un terrain plein** : la zone visée est occupée par un des alliés sacrifiés. L'invocation doit réussir dans cette zone, ce que le contrôle actuel « Zone occupée » refuserait. Testé en Task 4.
2. **Monstre en Garde verrouillé (Verrou de Position)** : après 2 tours adverses, le verrou tombe et le monstre repasse en Attaque. Testé en Task 2.
3. **Drakon des Origines qui quitte le terrain** (détruit ou renvoyé en main) : la carte qui part au cimetière ou en main est la carte d'origine, sans les effets copiés. Testé en Task 7.
4. **Renvoi de dégâts contre un attaquant insensible au combat (`combatImmune`) ou perçant** : pas de renvoi sur un monstre insensible au combat. Une attaque perçante est renvoyée normalement, puisqu'elle a infligé des dégâts. Testé en Task 3.
5. **Origines avec un cimetière à 3 éléments seulement**, ou un Bébé de l'élément manquant : l'invocation est refusée avec un message clair, et l'IA ne propose pas le coup. Testé en Task 7.

---

### Task 1 : Règles partagées (stade ancestral, éléments du cimetière)

**Files:**
- Modify: `packages/shared/src/enums/card.ts` (`DrakonStage`)
- Modify: `packages/shared/src/game/rules.ts`
- Test: `packages/shared/src/game/rules.test.ts` (créé s'il n'existe pas, à côté des tests shared existants)

**Interfaces:**
- Produces :
  - `DrakonStage.ANCESTRAL = "ancestral"` ;
  - `NEXT_STAGE` : `adult → ancestral` ;
  - `canSummonFromHand(card)` : faux aussi pour `ancestral` ;
  - `canTransform(card)` : vrai aussi pour `ancestral` (avec une lignée) ;
  - `export const ORIGIN_ELEMENTS = ["earth", "fire", "water", "wind"] as const` ;
  - `export function graveyardHasAllElements(graveyard: { stage: DrakonStage | null; element: DrakonElement | null }[]): boolean` : vrai si, pour chacun des 4 éléments, le cimetière contient une carte de cet élément au stade `adult` ou `ancestral`.
- [ ] **Step 1 : tests** :
  - `canEvolveOnto(ancestral feros, adulte feros) === true` ; sur un Adulte d'une autre lignée → `false` ; sur un Jeune → `false` ;
  - `canSummonFromHand({ stage: 'ancestral' }) === false` ;
  - `canTransform({ stage: 'ancestral', lineage: 'feros' }) === true` ;
  - `graveyardHasAllElements` : vrai avec 4 Adultes ou Ancestraux d'éléments différents ; faux avec 3 éléments ; faux si l'élément manquant n'est représenté que par un Bébé.
- [ ] **Step 2 :** `pnpm --filter @pipou/shared test` → FAIL.
- [ ] **Step 3 :** implémenter, puis `pnpm build:shared`.
- [ ] **Step 4 :** `pnpm --filter @pipou/shared test` → PASS ; `pnpm --filter @pipou/backend exec jest src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(shared): stade ancestral et éléments du cimetière`.

### Task 2 : Garde à durée limitée et contre-offensive

**Files:**
- Modify: `packages/shared/src/game/instance.ts` (`MonsterOnBoard.guardTurns?: number`, tours adverses tenus en Garde)
- Modify: `apps/backend/src/fights/services/phase.service.ts` (`startTurn`)
- Modify: `apps/backend/src/fights/services/support.service.ts` (changement de mode)
- Test: `apps/backend/src/fights/engine/guard.spec.ts` (créé)

**Interfaces:**
- Produces : `export const GUARD_MAX_TURNS = 2` et `export const COUNTER_OFFENSIVE_PER_TURN = 100` dans `packages/shared/src/game/rules.ts`.

Règles :
- **Au début du tour d'un joueur**, pour chacun de ses monstres en Garde (implantés exclus), `guardTurns += 1`. Si `guardTurns >= GUARD_MAX_TURNS` : le monstre passe en Attaque, `guardLocked = false`, il reçoit la contre-offensive, et une ligne de journal est écrite.
  - Le calcul se fait avant `ON_TURN_START`, comme les compteurs existants.
- **Contre-offensive** : à chaque passage de la Garde à l'Attaque, automatique ou par `change_mode`, `tempAtkBuff += COUNTER_OFFENSIVE_PER_TURN * min(guardTurns, GUARD_MAX_TURNS)`, puis `guardTurns = 0`. `tempAtkBuff` expire déjà en fin de tour (`endTurn`).
- **Passage en Garde** : `guardTurns = 0`.
- [ ] **Step 1 : tests** (`guard.spec.ts`, `scenario` + `passTurn`) :
  - `un monstre en Garde repasse en Attaque après 2 tours adverses` : p1 met « Mur » en Garde au tour 2. Après `passTurn` × 2, `mode === 'guard'` et `guardTurns === 1` (tour 4 de p1). Après `passTurn` × 2 de plus, au début du tour 6 de p1, `mode === 'attack'` et `effectiveAtk` vaut l'ATK de base + 200.
  - `la contre-offensive volontaire après 1 tour tenu donne +100` : Garde au tour 2, `passTurn` × 2, `change_mode` vers `attack` → `effectiveAtk` = base + 100. À la fin de ce tour, le bonus disparaît.
  - `repasser en Garde remet le compteur à zéro`.
  - `un monstre verrouillé en Garde est libéré après 2 tours adverses` : `guardLocked: true` → au début du tour 6 de p1, `guardLocked === false` et `mode === 'attack'`.
- [ ] **Step 2 :** jest `guard.spec.ts` → FAIL.
- [ ] **Step 3 :** implémenter, puis `pnpm build:shared`.
- [ ] **Step 4 :** jest `src/fights` → PASS. Les tests existants qui laissaient un monstre en Garde plus de 2 tours adverses doivent être adaptés à la nouvelle règle, et chaque adaptation est consignée.
- [ ] **Step 5 : commit** `feat(back): Garde limitée à 2 tours adverses et contre-offensive`.

### Task 3 : Renvoi de dégâts

**Files:**
- Modify: `packages/shared/src/enums/effect.ts` (`ActionType.REFLECT_DAMAGE`), `packages/shared/src/game/instance.ts` (`MonsterOnBoard.reflectPercent?: number`)
- Modify: `apps/backend/src/fights/buffs-calculator.service.ts` (étape 1 : `reflectPercent = undefined` ; passif : `reflectPercent = max(…, value)`), `apps/backend/src/fights/services/battle.service.ts`, `apps/backend/src/fights/engine/supported-effects.ts`
- Test: `apps/backend/src/fights/engine/reflect.spec.ts` (créé)

Règle : dans `attack`, après les dégâts de combat sur la cible (en Attaque comme en Garde), si `target.reflectPercent` est défini et que l'attaquant n'est pas `combatImmune`, l'attaquant subit `Math.floor(dégâts réellement subis par la cible × reflectPercent / 100)` par `applyDamage` (avec sa propre réduction). Les morts se résolvent ensuite :
- cible en Attaque : la logique actuelle (`aDied` / `tDied` / double KO) s'applique, renvoi compris ;
- cible en Garde : un attaquant tué est détruit (cause `COMBAT`), sans Prime pour personne.

`applyDamage` renvoie déjà les dégâts subis.

- [ ] **Step 1 : tests** (monstres de test avec `effect(PASSIVE, [act(REFLECT_DAMAGE, SELF, { value: 50 })])`) :
  - `renvoie la moitié des dégâts subis` : un attaquant 400 ATK / 1000 PV contre un défenseur en Attaque 0 ATK / 2000 PV avec renvoi 50 → défenseur à 1600, attaquant à 800.
  - `après réduction` : défenseur avec réduction 2 et renvoi 50, attaquant 400 → défenseur subit 200, attaquant 100.
  - `en Garde, un attaquant tué par le renvoi ne donne pas de Prime` : attaquant 400 ATK / 100 PV, défenseur en Garde avec renvoi 50 → attaquant au cimetière, Primes des deux joueurs inchangées.
  - `pas de renvoi sur un attaquant insensible au combat` : `combatImmune: true` → PV de l'attaquant inchangés.
  - `une attaque perçante est renvoyée` : attaquant perçant 400 contre défenseur réduction 2 renvoi 50 → défenseur subit 400, attaquant 200.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter, `pnpm build:shared`.
- [ ] **Step 4 :** jest `src/fights` → PASS (dont `effects-coverage.spec.ts`).
- [ ] **Step 5 : commit** `feat(back): renvoi de dégâts`.

### Task 4 : Relève

**Files:**
- Modify: `packages/shared/src/enums/effect.ts` (`ActionType.RELEVE`, passif dont `value` vaut N), `packages/shared/src/game/rules.ts` (`export function releveCount(effects: CardEffect[] | null): number`, 0 sans Relève), `packages/shared/src/game/action.ts` (`summon` gagne `releveInstanceIds?: string[]`)
- Modify: `apps/backend/src/fights/services/summon.service.ts`, `apps/backend/src/fights/engine/game-engine.ts` (transmettre `releveInstanceIds`), `apps/backend/src/fights/engine/supported-effects.ts`, `apps/backend/src/fights/ai/candidate-actions.ts`
- Test: `apps/backend/src/fights/engine/releve.spec.ts` (créé), `apps/backend/src/fights/ai/ai-player.spec.ts` (un test ajouté)

Règles dans `doSummon` quand `releveInstanceIds` est fourni :
- refus si `releveCount(card.effects) === 0` : « Ce monstre n'a pas la Relève » ;
- refus si le nombre d'identifiants n'est pas exactement N ;
- refus si un identifiant n'est pas un monstre allié non implanté de `archetype === 'pipou'` sur mon terrain ;
- refus si `zoneIndex` n'est ni une zone libre, ni la zone d'un allié sacrifié ;
- pas de paiement (`paymentHandIndices` ignorés, énergie non consommée) ;
- les alliés sont détruits par `destroyMonster(game, player, id, log, { draw: false, cause: DestroyCause.SACRIFICE })` **avant** la pose ;
- puis la pose suit le chemin normal (`ON_SUMMON`, `ON_ALLY_SUMMON`).

IA :
- dans `mainCandidates`, pour une carte avec `releveCount = N > 0` et au moins N alliés Pipou non implantés, on ajoute des `summon` avec `releveInstanceIds` ;
- combinaisons des alliés plafonnées à `MAX_PICK_COMBOS` ;
- zone visée : la zone du premier sacrifié ;
- `paymentHandIndices: []`.

- [ ] **Step 1 : tests** :
  - `Relève (2) : invoque à la place de 2 alliés Pipou sur un terrain plein` : 3 alliés Pipou, main « Chef » (coût 3, Relève 2), aucune énergie, aucune autre carte en main → `summon` avec 2 identifiants et la zone du 1er → « Chef » est en jeu, les 2 alliés sont au cimetière, la main est vide, `recycleEnergy` reste à 0.
  - `les sacrifiés déclenchent leur ON_DEATH sans Prime` : un allié avec `ON_DEATH: DRAW 1` → main +1, Primes inchangées.
  - `refus` : (a) 1 identifiant pour Relève 2 ; (b) un allié non Pipou ; (c) une carte sans Relève avec `releveInstanceIds` ; (d) une zone occupée par un allié non sacrifié. Chaque cas renvoie une erreur et laisse l'état inchangé.
  - `sans releveInstanceIds, le chemin de paiement habituel est inchangé`.
  - (`ai-player.spec.ts`) `IA : Relève proposée et acceptée par le moteur sur terrain plein` : le candidat existe dans `listCandidates`, et son `dispatch` ne renvoie pas d'erreur.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter, `pnpm build:shared`.
- [ ] **Step 4 :** jest `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): Relève, invocation par sacrifice d'alliés Pipou`.

### Task 5 : Un seul exemplaire d'un même terrain

**Files:**
- Modify: `apps/backend/src/fights/services/support.service.ts` (pose d'un terrain)
- Test: `apps/backend/src/fights/engine/supports.spec.ts` (tests ajoutés)

Règle : poser un terrain est refusé si une de mes zones de support contient déjà un terrain de même `baseCard.name`. Message : « Ce terrain est déjà en jeu ». Un terrain du même nom **chez l'adversaire** n'empêche rien.

- [ ] **Step 1 : tests** : `refuse un second exemplaire du même terrain` ; `accepte deux terrains différents` ; `accepte le même terrain que l'adversaire`.
- [ ] **Step 2 :** jest → FAIL (le premier).
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** jest `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): un seul exemplaire d'un même terrain en jeu`.

### Task 6 : Évolution ancestrale, côté moteur et IA

**Files:**
- Modify: `apps/backend/src/fights/services/evolution.service.ts` (si un contrôle code en dur `young` / `adult`), `apps/backend/src/fights/ai/candidate-actions.ts`, `apps/backend/src/fights/ai/evaluate.ts` (`STAGE_RANK.ancestral = 5`, `isGrowing` faux pour `ancestral`), `apps/backend/src/fights/ai/telemetry.ts` (`blockReason` : l'Ancestral se traite comme une évolution)
- Test: `apps/backend/src/fights/engine/drakon-mechanics.spec.ts` (tests ajoutés), `apps/backend/src/fights/ai/ai-player.spec.ts` (un test ajouté)

- [ ] **Step 1 : tests** :
  - `un Ancestral évolue sur l'Adulte de sa lignée` : Adulte Feros en jeu depuis un tour précédent, Ancestral Feros (coût 4) en main, 1 énergie → `evolve` accepté, l'Adulte est au cimetière, l'Ancestral est dans sa zone.
  - `pas sur un Adulte posé ce tour` → erreur.
  - `Transformer un Ancestral coincé en main récupère le Bébé de sa lignée`.
  - `IA : évolue l'Adulte en Ancestral quand c'est payable` : le candidat `evolve` existe et il est accepté par le moteur.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter (le plus gros vient de la Task 1 ; ici, retirer les contrôles codés en dur `young` / `adult`).
- [ ] **Step 4 :** jest `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): évolution en Drakon Ancestral`.

### Task 7 : Drakon des Origines (invocation et copie d'effets)

**Files:**
- Modify: `packages/shared/src/enums/effect.ts` :
  - `ActionType.SUMMON_IF_ALL_ELEMENTS` : passif marqueur, invocable seulement si `graveyardHasAllElements` ;
  - `ActionType.COPY_GRAVEYARD_EFFECTS` : `ON_SUMMON`, choisir un Adulte ou un Ancestral de son cimetière et copier ses effets.
- Modify: `packages/shared/src/game/state.ts` (`PendingChoiceResolution` gagne `"copy_effects"`), `packages/shared/src/game/instance.ts` (`MonsterOnBoard.originalCard?: CardInstance<C>`)
- Modify: `apps/backend/src/fights/services/summon.service.ts`, `apps/backend/src/fights/effects/effect-actions.applier.ts`, `apps/backend/src/fights/services/pick.service.ts`, les aides de sortie du terrain (`sendToGraveyard`, `returnMonsterToHand` et la base d'évolution), `apps/backend/src/fights/engine/supported-effects.ts`, `apps/backend/src/fights/ai/candidate-actions.ts`
- Test: `apps/backend/src/fights/engine/origins.spec.ts` (créé)

Règles :
- **Invocation** : `doSummon` refuse une carte qui a `SUMMON_IF_ALL_ELEMENTS` si `!graveyardHasAllElements(player.graveyard.map(c => c.baseCard))`. Message : « Il faut un Adulte ou un Ancestral de chaque élément au cimetière ». L'IA (`mainCandidates`) ne propose pas cette invocation dans ce cas.
- **Copie** : `COPY_GRAVEYARD_EFFECTS` met en file un choix (`queueChoice`) pour le poseur. Candidats : les cartes de son cimetière de stade `adult` ou `ancestral` ; `count: 1`, `resolution: 'copy_effects'`, et l'`instanceId` du monstre source est mémorisé dans le choix. Sans candidat, une ligne de journal et rien d'autre.
- **Résolution (`pick.service`)** :
  - `originalCard = monstre.card` ;
  - `monstre.card` devient une copie de la carte d'origine dont `baseCard.effects` = ses effets + les effets de la carte choisie ;
  - les effets `ON_SUMMON` de la carte choisie se résolvent une fois, aussitôt, avec le Drakon des Origines comme `sourceMonster` ;
  - la carte choisie reste au cimetière.
- **Sortie du terrain** : si `originalCard` est défini, c'est elle qui part au cimetière ou en main, et la copie disparaît.

Tests :
- [ ] **Step 1 : tests** :
  - `refuse l'invocation sans les 4 éléments au cimetière` (3 Adultes) ; `refuse si l'élément manquant n'a qu'un Bébé`.
  - `invoque avec 4 Adultes d'éléments différents au cimetière, puis propose de choisir l'un d'eux` : `pendingChoices[0]` a 4 candidats et `resolution: 'copy_effects'`.
  - `copie les effets choisis` : choisir un Adulte qui a `PASSIVE: SET_ATTACKS_PER_TURN 2` → `attacksPerTurn === 2` après le recalcul ; choisir un Adulte qui a `ON_SUMMON: DEAL_DAMAGE ALL_ENEMIES 400` → les ennemis perdent 400 PV tout de suite.
  - `en partant au cimetière, il redevient la carte d'origine` : après sa destruction, la carte du cimetière n'a que ses propres effets.
  - `IA : n'invoque pas les Origines sans les 4 éléments ; résout le choix de copie par un pick_cards accepté`.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter, `pnpm build:shared`.
- [ ] **Step 4 :** jest `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): Drakon des Origines, invocation et copie d'effets`.

### Task 8 : Condition « un Noyau sur mon terrain »

**Files:**
- Modify: `packages/shared/src/enums/effect.ts` (`EffectConditionType.CARD_FAMILY_ON_BOARD`, dont `value` est le début du nom normalisé, ex. `"noyau"`), le résolveur de conditions du backend, `apps/backend/src/fights/engine/supported-effects.ts`
- Test: `apps/backend/src/fights/engine/generic-cards.spec.ts` (tests ajoutés)

Règle : vrai si un monstre de **mon terrain**, implantés exclus, a un nom normalisé (`normalizeCardName`) qui commence par `value`. Un Zeta implanté chez l'adversaire n'est pas sur mon terrain et ne compte pas.

- [ ] **Step 1 : tests** : un éphémère « détruire un ennemi si `CARD_FAMILY_ON_BOARD` noyau » est **jouable** avec Noyau Alpha en jeu et **refusé** sans Noyau. Il est **refusé** si mon seul Noyau est un Zeta que j'ai implanté chez l'adversaire.
- [ ] **Step 2 :** jest → FAIL.
- [ ] **Step 3 :** implémenter, `pnpm build:shared`.
- [ ] **Step 4 :** jest `src/fights` → PASS.
- [ ] **Step 5 : commit** `feat(back): condition « un Noyau sur mon terrain »`.

### Task 9 : Vérification d'ensemble

- [ ] **Step 1 :** `pnpm --filter @pipou/shared test`, `pnpm --filter @pipou/backend test`, `pnpm --filter @pipou/backend lint`, `pnpm typecheck` → verts. Le front doit compiler avec les types shared modifiés ; s'il ne compile pas, le corriger au plus simple et le consigner.
- [ ] **Step 2 :** `pnpm --filter @pipou/backend tournament:generated --scale rapide`. Les cartes réelles n'ont pas encore les nouvelles mécaniques (plan 2), donc on ne vérifie ici que la non-régression : aucune partie sans vainqueur de plus que dans la référence, et une durée comparable. On consigne aussi l'effet de la nouvelle règle de Garde seule (taux par archétype et tours par partie).
- [ ] **Step 3 : commit** si des corrections ont été nécessaires.
