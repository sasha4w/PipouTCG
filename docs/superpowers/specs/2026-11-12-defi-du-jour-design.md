# Défi du jour (énigme en un tour) — design

Date : 2026-11-12
Statut : validé en brainstorming, en attente de relecture
Prérequis : sandbox de duel admin (`2026-10-02-admin-duel-sandbox-design.md`), quêtes et succès (`2026-10-18-quests-achievements-rework-design.md`)

## Intention

Donner au joueur une raison de revenir chaque jour, en dehors du duel : une énigme courte. Le jeu impose une main et un plateau, et le joueur doit atteindre un objectif pendant son tour. La résolution donne une récompense, alimente une série, des succès et une quête.

C'est la première de trois features prévues, chacune avec sa spec, son plan et sa branche, dans cet ordre :

1. Défi du jour (cette spec).
2. Tour de challenge (30 étages, remise à zéro toutes les 2 semaines), après le merge de `BETTER-AI`.
3. Mode Aventure enrichi (histoire, contenu).

Les branches se suivent : chacune part de `main` après le merge de la précédente. Les trois features modifient les mêmes fichiers (`AchievementFamily`, `ACHIEVEMENTS`, `FightHub.tsx`, migrations), et des branches parallèles se gêneraient.

## Décisions (prises avec Sasha)

1. **Origine des énigmes** : écrites à la main par un admin dans le sandbox. Un solveur vérifie qu'une solution existe avant la publication. Pas de génération automatique.
2. **Objectif variable par défi**, un seul objectif par défi, parmi quatre types (voir « Objectifs »).
3. **Essais illimités.** La récompense est payée une seule fois par joueur et par jour.
4. **Récompense** : or et XP, réglables par défi (défaut 100 or, 50 XP). Pas de booster quotidien.
5. **Série** de jours consécutifs résolus, avec 1 booster tous les 7 jours de série.
6. **Deux familles de succès** : `PUZZLES_SOLVED` et `PUZZLE_STREAK`.
7. **Une quête journalière** `SOLVE_DAILY_PUZZLE`. Si le joueur a déjà résolu le défi du jour quand il reçoit cette quête (tirage du jour ou relance), la quête arrive déjà complétée.
8. **Choix du défi du jour** : calendrier dans l'admin, avec repli automatique les jours non planifiés. Le même défi pour tous les joueurs.
9. **Architecture** : un service de session dédié, calqué sur `SandboxService`. `FightsService` n'est pas modifié.
10. **Maquette validée** : `.superpowers/brainstorm/1140-1794491651/content/daily-puzzle.html` (non versionnée).

## Parcours joueur

1. **Arène** ([FightHub.tsx](../../../apps/frontend/src/pages/FightHub.tsx)) : une 4e carte « Défi du jour ». Elle affiche la série en cours et un badge « À faire » ou « Résolu ».
2. **Fiche du défi** : titre, objectif en clair (« Détruis le Noyau Omega ce tour »), récompense, série sur 7 jours avec le booster au bout, compte à rebours jusqu'au prochain défi, bouton **Jouer**. Si le défi est déjà résolu : une coche, et **Rejouer** sans récompense.
3. **En jeu** : le plateau `FightBoard` existant, avec un bandeau d'objectif permanent en haut. Si l'objectif désigne un monstre, ce monstre est entouré sur le plateau. Barre d'actions : **Quitter**, **Recommencer**, **Fin du tour**.
4. **Objectif atteint** : écran de victoire immédiat, avec le butin, même si le tour n'est pas terminé.
5. **Fin du tour sans objectif atteint, ou défaite du joueur** : écran « Raté », avec **Recommencer**.

## Règles

- Le joueur démarre en phase principale de son tour, avec la main et le plateau du défi. Il n'y a ni mulligan, ni minuteur, ni choix de deck.
- Le tour adverse n'est jamais joué. Un effet qui se déclenche au début du tour adverse ne compte pas.
- **Déterminisme** : l'ordre du deck vient de l'état sauvegardé, et le RNG du moteur est initialisé avec une graine fixe, propre au défi. Recommencer donne exactement la même partie. Le joueur et le solveur voient le même jeu.
- **Recommencer** recharge l'état de départ. Il n'y a pas d'annulation coup par coup.
- Le jour de jeu va de `RESET_HOUR` à `RESET_HOUR` ([quest-schedule.ts](../../../apps/backend/src/quests/quest-schedule.ts)), comme les quêtes.
- Si le jour change pendant une session, la résolution compte pour le jour où la session a démarré.
- La session vit en mémoire. Si elle est perdue (redémarrage du serveur, déconnexion longue), le joueur relance le défi. Rien n'est perdu, puisque les essais sont illimités.

## Objectifs

Un défi porte un type d'objectif et ses paramètres. L'objectif est testé après chaque action. Il est acquis dès qu'il est atteint.

| Type | Paramètre | Atteint quand |
|---|---|---|
| `WIN_GAME` | aucun | le joueur remporte les dernières Primes et gagne la partie |
| `DESTROY_MONSTER` | instance du monstre cible | ce monstre n'est plus sur le terrain adverse parce qu'il a été détruit |
| `CLEAR_ENEMY_BOARD` | aucun | le terrain adverse n'a plus aucun monstre |
| `TAKE_PRIMES` | N | le joueur a remporté au moins N Primes depuis le début du défi |

Pour `DESTROY_MONSTER`, un monstre qui quitte le terrain autrement que par destruction (retour en main, par exemple) ne valide pas l'objectif. Le builder vérifie comment le moteur distingue ces cas et s'appuie sur les événements de destruction existants.

## Récompenses, série, succès, quête

**Récompense**
- Or et XP du défi, crédités côté serveur dans une transaction, par le même chemin que les quêtes (`UsersService.addGold`, `UsersService.addExperience`).
- Une seule fois par joueur et par jour. Une contrainte d'unicité en base la garantit, y compris avec deux onglets ouverts.

**Série**
- La série vaut 1 après une résolution si le défi de la veille n'était pas résolu, sinon elle augmente de 1.
- Un jour sans défi publié ne casse pas la série.
- Tous les 7 jours de série (7, 14, 21…), le joueur reçoit 1 booster, ajouté à son inventaire. Le booster est `ACHIEVEMENT_REWARD_BOOSTER_ID` par défaut, réglable dans l'admin.

**Succès** : deux familles dans `AchievementFamily` et `ACHIEVEMENTS` ([achievements.ts](../../../packages/shared/src/game/achievements.ts)), avec les récompenses de palier habituelles. Le calcul est rétroactif, depuis `user_puzzle_solve`.

| Famille | Valeur | Bronze | Argent | Or |
|---|---|---|---|---|
| `PUZZLES_SOLVED` | défis résolus au total | 5 | 30 | 100 |
| `PUZZLE_STREAK` | meilleure série atteinte | 3 | 7 | 30 |

Les titres du palier or sont laissés au builder.

**Quête**
- Nouveau `QuestConditionType.SOLVE_DAILY_PUZZLE`, ajouté au pool des quêtes journalières ([quest-pool.ts](../../../apps/backend/src/quests/quest-pool.ts)).
- La résolution émet l'événement `puzzle.solved`. `QuestsService` l'écoute et fait progresser la quête.
- **Quête reçue après la résolution** : au tirage du jour et dans `rerollQuest` ([quests.service.ts](../../../apps/backend/src/quests/quests.service.ts)), si la quête attribuée est de type `SOLVE_DAILY_PUZZLE` et que le joueur a déjà résolu le défi du jour, la quête est créée complétée et réclamable. Un test couvre chacun des deux chemins.
- Un jour sans défi publié, cette quête n'est pas tirée.

## Choix du défi du jour

- L'admin peut assigner un défi publié à une date.
- Un jour sans assignation, le serveur choisit le défi publié et vérifié qui a été joué le moins récemment. Un défi jamais joué passe en premier.
- Le choix est écrit en base au premier accès du jour. Le défi d'un jour ne change donc plus après coup, et un historique existe.
- Quand tous les défis ont été joués, les plus anciens reviennent.

## Données

Une migration crée trois tables. Elle est testée en local seulement.

- `daily_puzzle` : `id`, `title`, `description`, `state` (JSON), `objective_type`, `objective_params` (JSON), `seed`, `reward_gold`, `reward_xp`, `status` (`draft` ou `published`), `verified_at`, `created_by`, dates de création et de modification. `state` utilise le format du sandbox (`serializeGame` dans [scenario-serializer.ts](../../../apps/backend/src/sandbox/scenario-serializer.ts)) : les cartes y sont des ids, rechargés depuis la base au lancement.
- `daily_puzzle_schedule` : `date` (unique), `puzzle_id`, origine (`manual` ou `auto`).
- `user_puzzle_solve` : `user_id`, `date`, `puzzle_id`, `solved_at`, avec une unicité sur (`user_id`, `date`). C'est la source de vérité pour la récompense, la série et les succès.

Le réglage du booster de série va dans une table de réglages existante si elle convient, sinon dans une constante. Au choix du builder.

## Backend

Nouveau module `apps/backend/src/puzzles/`. Chaque fichier a un seul rôle.

| Fichier | Rôle |
|---|---|
| `puzzle-objective.ts` | Fonction pure `isObjectiveMet(game, objective, start)`, un cas par type d'objectif. |
| `puzzle-solver.ts` | Fonction pure. Recherche en profondeur sur des clones de l'état, avec les actions légales de [candidate-actions.ts](../../../apps/backend/src/fights/ai/candidate-actions.ts). Renvoie `solved` avec la suite d'actions, `unsolvable`, ou `budget_exceeded`. |
| `puzzle-schedule.ts` | Fonction pure qui choisit le défi d'un jour. |
| `puzzle-streak.ts` | Fonction pure qui calcule la série courante et la meilleure série depuis les dates résolues. |
| `PuzzleSessionService` | Sessions en mémoire, une par joueur : `start`, `action`, `restart`, `close`. Délègue les actions à `GameEngine.dispatch`. Refuse une action qui ne vient pas du siège du joueur. |
| `PuzzlesService` | Défi du jour, enregistrement de la résolution, récompense, série, événement `puzzle.solved`. |
| `PuzzleGateway` | Événements socket sur le namespace `/fight`. |
| Contrôleurs HTTP | `GET /puzzles/today` pour le joueur, CRUD et calendrier pour l'admin sous `AdminGuard`. |

**Événements socket** (dans `@pipou/shared`, `socket/puzzle.ts`)
- `puzzle:start` : crée la session du défi du jour.
- `puzzle:action` : la même union d'actions que le moteur.
- `puzzle:restart` : recharge l'état de départ.
- `puzzle:close`.
- Le serveur répond par `puzzle:state` (vue du joueur, objectif, statut `playing`, `solved` ou `failed`) et, à la résolution, par le butin.

**Points d'attention**
- `candidate-actions.ts` sert l'IA et élague certains coups (paiement le moins cher, combinaisons plafonnées par `MAX_PICK_COMBOS`). Le solveur peut donc manquer une solution qui existe. C'est acceptable : dans ce cas l'admin force la publication (voir « Admin »). Le solveur ne doit jamais déclarer `unsolvable` quand l'élagage a pu cacher une solution : il répond alors `budget_exceeded` ou un statut « non trouvé », au choix du builder, mais pas une affirmation fausse.
- Le solveur a un plafond de nœuds et un plafond de temps. Il ne doit pas bloquer la boucle d'événements pendant des parties en cours : il s'exécute dans un worker ou par tranches. Le dossier `fights/ai` a déjà un worker de tournoi qui peut servir de modèle.
- `GET /puzzles/today` ne renvoie pas l'état du plateau. L'état arrive par le socket, au lancement de la session.
- Le module n'écrit jamais dans `match`, `player_stats` ni `adventure_match`, et ne touche pas à l'ELO.

## Admin

**Création** : dans le sandbox (`/admin/sandbox`), un bouton « Enregistrer comme défi », à côté de « Sauver un scénario ». L'état courant doit être en phase principale du joueur 1. Le formulaire demande le titre, la description, le type d'objectif, son paramètre (pour `DESTROY_MONSTER`, l'admin touche le monstre cible sur le plateau), l'or et l'XP. Le défi est créé en `draft`.

**Onglet « Défis »** dans [Admin.tsx](../../../apps/frontend/src/pages/Admin.tsx)
- Liste : titre, objectif, statut, dernière date jouée, vérifié ou non, défi cassé ou non.
- **Vérifier** : lance le solveur et affiche la solution trouvée, en liste d'actions.
- **Publier** : exige une vérification réussie. Si le solveur n'a pas conclu, l'admin peut publier en cochant « je l'ai résolu moi-même ».
- **Tester** : ouvre le défi en jeu, sans récompense ni enregistrement.
- **Ouvrir dans le sandbox** pour le retoucher, et **Dépublier**.
- Modifier l'état ou l'objectif d'un défi efface sa vérification et le repasse en `draft`.
- **Calendrier** : les 14 jours à venir, avec le défi assigné ou la mention « automatique ».

## Frontend

Nouveau dossier `apps/frontend/src/features/puzzle/`.

- `PuzzleCard` : la 4e carte de l'Arène.
- `PuzzlePage` : la fiche du défi, puis le plateau.
- `usePuzzleSession` : socket, état, recommencer.
- `PuzzleObjectiveBanner` et `PuzzleResult` (victoire avec butin, ou raté).
- `admin/` : l'onglet « Défis » et le formulaire d'enregistrement.

Conventions de [apps/frontend/CLAUDE.md](../../../apps/frontend/CLAUDE.md) :
- Le plateau réutilise `FightBoard`. Les éléments propres au duel (minuteur, abandon, mulligan) sont masqués par des props, pas dupliqués.
- Les données HTTP passent par TanStack Query, avec des clés dans `QUERY_KEYS`. Après une résolution, les requêtes du défi, des quêtes, des succès et du solde sont invalidées.
- Icônes SVG de `Icons.tsx`, aucun emoji.
- Libellés en fr, en et ko, y compris les quatre objectifs et les deux familles de succès.

## Cas d'erreur

- **Aucun défi publié** : la carte de l'Arène affiche « Pas de défi aujourd'hui ». La quête n'est pas tirée et la série n'est pas cassée.
- **Carte introuvable au chargement** : le défi est injouable. Le repli automatique le saute et l'admin le signale comme cassé. S'il était assigné à la date du jour, le repli automatique prend le relais.
- **Carte du défi modifiée** (effets, coût, valeurs) : la vérification est effacée. Le défi reste jouable s'il est le défi du jour, mais il n'est plus tiré avant une nouvelle vérification.
- **Double résolution** : l'unicité (`user_id`, `date`) garantit une seule récompense. La seconde requête reçoit le résultat déjà enregistré, sans erreur.
- **Action refusée par le moteur** : même message d'erreur que le duel. L'état ne change pas.
- **Session absente** à la réception d'une action : le serveur répond par une erreur claire, et le client propose de relancer le défi.

## Tests

- **Unitaires purs** : `isObjectiveMet` (quatre types, cas atteint et non atteint, sortie de terrain sans destruction), solveur (défi résoluble, insoluble, plafond atteint), choix du défi du jour, calcul de série.
- **Services** : récompense unique, booster au 7e jour, quête complétée au tirage et à la relance, aucune écriture dans `match`, `player_stats` ni `adventure_match`.
- **Gateway** : action hors siège refusée, `puzzle:restart` rend un état identique à l'état de départ, accès admin exigé pour « Tester ».
- **Frontend** : Vitest sur `usePuzzleSession` et `PuzzleResult`. Capture Playwright à 430 px avant la remise.
- **Vérification finale** : `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test`. Migration `run` puis `revert` sur la base locale `cardcollect_dev`, jamais sur Aiven.

## Contenu

Le code livre l'outil, pas les énigmes. Il faut au moins 7 défis publiés avant la mise en ligne, pour éviter une répétition la première semaine. Le plan propose une première série, que Sasha valide dans le sandbox.

## Hors périmètre

- Génération automatique d'énigmes.
- Indices pour le joueur, et affichage de la solution après un échec.
- Classement, temps de résolution, nombre de coups, bonus pour une réussite au premier essai.
- Archive pour rejouer les anciens défis.
- Énigmes sur plusieurs tours, ou avec une réponse de l'adversaire.
- Plusieurs objectifs sur un même défi, ou des objectifs combinés.
- Annulation coup par coup pendant un défi.
- Défis différents selon le joueur, son niveau ou sa collection.
- Achat d'un essai, d'un indice ou d'une protection de série.
- Notification push « nouveau défi disponible ».
- Retrait des emoji encore présents sur le plateau partagé et dans `FightHub.tsx`.

## Laissé au builder

- La forme exacte des tables, des endpoints et des payloads.
- Les plafonds du solveur (nœuds, temps) et son mode d'exécution hors de la boucle principale.
- La façon de détecter qu'une carte d'un défi a été modifiée.
- Les titres du palier or des deux succès, et le montant de la quête journalière.
- Les animations de l'écran de résultat, dans le style de l'Arène.

## Branche

`feat/daily-puzzle`, partie de `main`. Les fichiers non commités de `BETTER-AI` restent sur `BETTER-AI`.
