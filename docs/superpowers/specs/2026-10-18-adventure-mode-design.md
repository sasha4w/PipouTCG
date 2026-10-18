# Mode Aventure (PvE contre IA) — design

Date : 2026-10-18

## Intention

Donner aux joueurs un contenu solo : affronter des IA avec les règles du duel JcJ, sans attendre un adversaire en ligne. La progression se fait monde par monde, une belle récompense tombe à la première victoire, et une petite boucle de farm façon gacha permet de rejouer. Le mode ajoute aussi des succès et des quêtes propres au PvE.

## Décisions (prises avec Sasha)

1. **Accès** : une 3e carte « Aventure » sur la page Arène ([FightHub.tsx](../../../apps/frontend/src/pages/FightHub.tsx)), à côté de Deck Builder et Combat.
2. **Un monde = un card_set.** Chaque monde contient **5 IA**, de niveau 1 (faible) à 5 (forte, le boss). Un monde n'est pas plus dur qu'un autre : il change de set. Un nouveau set peut donner un nouveau monde.
3. **Mêmes règles que le JcJ** : l'IA joue via le moteur existant ([game-engine.ts](../../../apps/backend/src/fights/engine/game-engine.ts)).
4. **Difficulté = qualité du deck.** Plus le niveau monte, plus le deck de l'IA contient de cartes fortes (rareté). Toutes les IA partagent le même « cerveau », simple mais correct. Les niveaux 1 et 2 font en plus quelques erreurs volontaires.
5. **Le joueur utilise n'importe lequel de ses decks** (validé comme en JcJ). Aucune restriction au set du monde.
6. **Progression** : battre l'IA *n* débloque l'IA *n+1*. Un monde peut avoir des **mondes prérequis** (à terminer avant). Au lancement, les 3 mondes n'en ont pas et sont ouverts.
7. **Récompenses première victoire** : or + XP + 1 booster du set du monde. Le **boss** donne en plus **une carte légendaire tirée au hasard dans le set**.
8. **Farm (victoires suivantes)** : un peu d'or et d'XP garantis, plus des **tirages avec taux de drop** (booster du set, légendaire pour le boss). Les taux sont affichés avant le combat.
9. **Plafond journalier** sur les récompenses de farm.
10. **Défaite** : aucune récompense.
11. **Decks des IA** : générés automatiquement au départ, enregistrés en BDD, **modifiables dans l'admin**.
12. **Admin** : mondes (nom, set, prérequis), IA (nom, réplique, carte portrait, deck) **et récompenses** (montants, taux, plafond).
13. **Séparation JcJ / PvE** : les parties IA ne touchent ni l'ELO, ni le classement, ni l'historique JcJ, ni les succès `DUELS_WON` / `DUELS_PLAYED`.
14. **Nouveaux succès Aventure** : mondes terminés, victoires contre l'IA, parties jouées contre l'IA.
15. **Quêtes** : « gagner / jouer un combat » se décline en 3 variantes : JcJ, IA, les deux.
16. **UI** : navigation « chemin » façon Candy Crush (maquette validée, voir plus bas). **Icônes SVG uniquement, aucun emoji.**
17. Travail sur la branche `dev`.

## Mondes de lancement

D'après le dump de prod (`apps/backend/.e2e/aiven-dump.sql`, 2026-10-18). *L'ordre suit l'id du set, donc l'ordre de sortie ; c'est un choix de Claude.*

| Monde | card_set (id) | Booster de récompense par défaut | Légendaires (tirage boss) | Cartes du set |
|---|---|---|---|---|
| 1 | PipouSquad - à la rescousse (1) | Brigade de Combat (1) — alternative : Expédition pour le bonheur !! (2) | Général Chatouille, Champion Ouille-Ouille | 27 (23 monstres, 4 supports) |
| 2 | SquareWorld - dans le monde virtuel (2) | La foire au pixel (3) — alternative : PixelKing (5) | Noyau Omega | 23 (8 monstres, 15 supports) |
| 3 | Drakon - Les légendes primaires (3) | Les quatres éléments (4) | Œuf Céleste | 21 (15 monstres, 6 supports) |

### Identité de chaque monde (donnée par Sasha)

Les decks **et** le jeu de l'IA doivent incarner la philosophie du set. Une IA qui joue Pixelman sans équiper son noyau serait un échec.

- **PipouSquad (archétype `pipou`) — « l'union fait la force »** : beaucoup de monstres qui se boostent entre eux. On invoque en nombre, et les monstres se renforcent les uns les autres.
- **SquareWorld (archétype `pixelman`) — un noyau, bombardé d'équipements** : il y a plusieurs Noyaux, chacun avec sa philosophie de combat. On choisit un noyau et on l'empile d'équipements. Le faible nombre de monstres du set est voulu.
- **Drakon (archétype `dragon`) — protéger le faible pour le faire évoluer** : des monstres évolutifs (œuf → bébé → jeune → adulte) de 4 éléments. On protège ses unités faibles pour en faire des monstres puissants.

**Signature de chaque IA** (*proposition de Claude*, modifiable dans l'admin) : chaque IA d'un monde porte une variante de l'archétype, et sa carte signature lui sert de portrait.

| Niveau | PipouSquad | SquareWorld (noyau) | Drakon (élément) |
|---|---|---|---|
| 1 | Recrue Andouille — petite escouade | Noyau Alpha | Teros (terre) |
| 2 | Caporal Gazouille | Noyau Beta | Feros (feu) |
| 3 | Capitaine Gribouille | Noyau Zeta | Ackos (eau) |
| 4 | Commandant Quenouille | Noyau Delta | Tempestu (vent) |
| 5 boss | Général Chatouille | Noyau Omega | Œuf Céleste — multi-éléments |

- Les noms des IA restent au choix du builder. La carte signature indique le thème et sert de portrait par défaut.
- **Génération de decks** : elle part de la signature. Pixelman : 1 noyau (en 2 ou 3 exemplaires) + une majorité d'équipements et de supports qui les servent. Drakon : les œufs et les stades de l'élément signature. Pipou : un maximum de monstres, avec les cartes de boost d'équipe (Clairon de l'Union, Tactique Gang Gang…).
- **Heuristiques par archétype**, en plus du socle commun :
  - Pipou : remplir le terrain en priorité, garder les monstres qui boostent les autres en vie.
  - Pixelman : poser le noyau, puis lui donner tous les équipements ; protéger le noyau équipé.
  - Drakon : ne pas exposer les unités en cours d'évolution, et évoluer dès que c'est possible.
- Les **combats instructifs** (projet suivant) expliqueront ces trois mêmes philosophies : la signature et les heuristiques doivent pouvoir être réutilisées.

- Le booster par défaut est celui de plus petit id du set ; l'admin peut le changer.
- Le seed retrouve les sets **par id** et vérifie qu'ils existent toujours et que la condition d'activation est remplie (booster et légendaire). Sinon il crée le monde inactif.
- Points d'attention pour la génération de decks (30 à 40 cartes, 3 exemplaires max, cartes du set uniquement) :
  - **SquareWorld** n'a que 8 monstres, dont 1 légendaire et 1 secret. Les decks bas niveau auront peu de monstres, et le générateur doit quand même produire un deck jouable.
  - **Drakon** repose sur l'évolution œuf → bébé → jeune → adulte, par lignée. Un deck doit contenir les stades de base des lignées qu'il joue.

## Non-objectifs

- **Combats instructifs** (deck imposé, tutoriel qui explique un archétype) : **projet suivant**, construit sur la même IA. Rien ici ne doit l'empêcher, mais il n'est pas développé.
- Pas d'IA « intelligente » (recherche d'arbres, apprentissage) : des heuristiques suffisent.
- Pas de PvE coopératif ni de classement PvE.
- Pas d'énergie ni d'endurance : le seul frein au farm est le plafond de récompenses. On peut toujours jouer au-delà, sans gain.

## Anti-objectifs (échec même si « ça marche »)

- Le farm casse l'économie (boosters et légendaires à l'infini, marché inondé).
- L'IA bloque une partie (aucune action valide trouvée, boucle infinie, attente sans fin).
- Une partie PvE pollue les stats, l'ELO ou l'historique JcJ.
- Des emoji dans l'UI.

## Parcours joueur

1. **Arène → Aventure** : liste des mondes en cartes colorées. Chaque carte montre le nom du monde et du set, une barre de progression (x/5 IA battues) et une coche si le monde est terminé. Un monde verrouillé est grisé, avec un cadenas et ses prérequis (« Termine les mondes 2 et 3 »). En haut, le compteur de récompenses farm du jour (icône cadeau, `12/20`).
2. **Monde → chemin** : 5 ronds reliés en zigzag, de bas (IA 1) en haut (boss, plus gros, icône couronne). États : battu (plein, coche), à battre (anneau doré), verrouillé (gris, cadenas). Bouton retour vers les mondes.
3. **Toucher un rond débloqué → fiche IA** en bottom sheet, par-dessus le chemin :
   - portrait (visuel d'une carte du set), nom, badge de niveau, mention « Boss » pour le niveau 5, nombre de victoires si déjà battue
   - réplique courte
   - **jamais battue** : liste « Première victoire » (or, XP, booster, et légendaire pour le boss)
   - **déjà battue** : « Gains à chaque victoire » (or, XP) et « Chances de drop » (libellé + %), plus le compteur du jour. Si le plafond est atteint, le dire clairement (« Plus de récompenses aujourd'hui »).
   - sélecteur de deck (même `DeckWidget` que le JcJ), bouton **Combattre** ou **Rejouer**
4. **Combat** : écran de duel existant ([FightPage.tsx](../../../apps/frontend/src/features/fight/FightPage.tsx)). L'adversaire affiché est l'IA (nom, portrait). Pas de matchmaking.
5. **Fin de partie** : en victoire, écran « Victoire » qui liste le butin réel en tuiles (or, XP, booster, légendaire mise en avant). Il signale aussi « Monde X terminé », un succès devenu réclamable et les mondes débloqués. En défaite, écran de défaite simple avec Rejouer et Retour. Ensuite, retour au chemin du monde.

Maquettes validées (visual companion, non versionnées) : `.superpowers/brainstorm/583-1792327081/content/adventure-path-v2.html` (mondes + chemin) et `adventure-sheets-v2.html` (fiches + victoire). Palette de l'Arène : bordeaux `#7a1c3b`, crème `#fdf6f0`, or `#eebc77`, Comfortaa / Lilita One.

## Récompenses

Les valeurs sont **réglables dans l'admin**, par IA. À la création, chaque IA reçoit les valeurs par défaut de son niveau (*valeurs proposées par Claude, à ajuster*) :

| Niveau | 1re victoire : or / XP | Farm : or / XP | Farm : booster | Farm : légendaire |
|---|---|---|---|---|
| 1 | 100 / 50 | 15 / 10 | 3 % | — |
| 2 | 150 / 80 | 20 / 15 | 4 % | — |
| 3 | 200 / 120 | 30 / 20 | 5 % | — |
| 4 | 300 / 180 | 40 / 30 | 7 % | — |
| 5 (boss) | 500 / 300 | 60 / 40 | 10 % | 2 % |

- 1re victoire, toutes les IA : **1 booster du set**. Boss : **+1 légendaire aléatoire du set**, tirée parmi les cartes `rarity = legendary` du set et ajoutée à la collection (`user_card`).
- « Booster du set » : un `Booster` dont `cardSet` est le set du monde, ajouté à l'inventaire (`user_booster`). Si le set a plusieurs boosters, l'admin choisit lequel par monde. Par défaut, le premier booster du set.
- Le **plafond journalier** (défaut **20 victoires farm récompensées**) est un **réglage global** modifiable dans l'admin. Il compte uniquement les victoires de farm : une 1re victoire est toujours payée et ne consomme pas le plafond. Il se remet à zéro à la même heure que les quêtes (`RESET_HOUR` de [quest-schedule.ts](../../../apps/backend/src/quests/quest-schedule.ts)).
- **Set sans booster ou sans légendaire** : *choix de Claude* — un monde ne peut être **activé** (admin ou seed) que si son set a un booster de récompense et au moins une carte `legendary`. Sinon le seed le crée inactif et l'admin affiche pourquoi. Pas de récompense de remplacement silencieuse.
- Au-delà du plafond : on peut jouer et la victoire compte pour la progression, les succès et les quêtes, mais elle ne rapporte ni or, ni XP, ni drop.
- Les récompenses sont calculées et attribuées **côté serveur** à la fin de partie, en une transaction. Le client ne fait qu'afficher le butin renvoyé.
- XP via `UsersService.addExperience`. L'or crédité doit suivre le même chemin que les autres gains, pour que `moneyEarned` et le succès `GOLD_EARNED` restent cohérents (le builder vérifie comment les quêtes créditent l'or et fait pareil).

## Succès Aventure

Trois nouvelles familles dans `AchievementFamily` ([enums/achievement.ts](../../../packages/shared/src/enums/achievement.ts)) et `ACHIEVEMENTS` ([game/achievements.ts](../../../packages/shared/src/game/achievements.ts)). Mêmes récompenses de palier que les autres (bronze 100 or, argent booster, or bundle + titre). Calcul rétroactif depuis les données PvE, comme le reste.

| Famille | Valeur | Bronze | Argent | Or | Titre (or) |
|---|---|---|---|---|---|
| `ADVENTURE_WORLDS` | mondes dont le boss est battu | 1 | 3 | tous les mondes existants (comme `ALL_SETS`) | Explorateur |
| `PVE_WON` | victoires contre l'IA | 5 | 50 | 200 | Chasseur d'IA |
| `PVE_PLAYED` | parties jouées contre l'IA | 10 | 100 | 300 | Infatigable |

*Seuils et titres proposés par Claude.* Les libellés de `DUELS_WON` / `DUELS_PLAYED` précisent « JcJ » dans l'UI (i18n fr/en/ko). Leur source (`player_stats`) ne change pas, et elle est déjà réservée au JcJ tant que le PvE n'y écrit pas.

## Quêtes

- Nouveaux `QuestConditionType` : `WIN_PVP_FIGHT`, `WIN_PVE_FIGHT`, `PLAY_PVP_FIGHT`, `PLAY_PVE_FIGHT`. Les existants `WIN_FIGHT` / `PLAY_FIGHT` comptent **les deux modes**.
- Fin de partie JcJ : on garde `fight.finished` et on ajoute les conditions PvP. Fin de partie PvE : un nouvel événement (par ex. `adventure.finished`) alimente `PLAY_FIGHT`, `PLAY_PVE_FIGHT`, et en cas de victoire `WIN_FIGHT`, `WIN_PVE_FIGHT`.
- Ajouter au pool ([quest-pool.ts](../../../apps/backend/src/quests/quest-pool.ts)) quelques daily et hebdos PvE et PvP. Le contenu exact est laissé au builder, dans les ordres de grandeur des quêtes existantes.

## IA : comportement

- Tourne **côté serveur**, sur le siège du joueur 2. À chaque fois que c'est à elle d'agir (son tour, mulligan, choix en attente `pendingChoices`, défausse), elle calcule une action et la passe à `GameEngine.dispatch`, comme le ferait le gateway pour un humain.
- **Délai entre actions** (~0,6 à 1 s) pour que le joueur voie les animations et le log. Les événements partent au client par le même canal que le JcJ.
- Heuristiques de base : garder une main jouable au mulligan, invoquer ce qu'elle peut payer en privilégiant le plus fort, jouer les supports utiles, attaquer quand l'échange est favorable ou que la cible est sans défense, choisir des cibles raisonnables, puis finir la phase.
- **Erreurs volontaires** aux niveaux 1-2 : une probabilité (par ex. 25 % / 10 %) de choisir une action valide au hasard au lieu de la meilleure.
- **Filet de sécurité obligatoire** : si l'IA ne trouve aucune action valide, ou si le moteur refuse son action, elle termine sa phase. Un plafond d'actions par tour évite toute boucle. Une IA ne doit jamais bloquer une partie.
- L'IA n'a pas de minuteur. Le joueur garde le timeout de tour JcJ (90 s, [turn-timeout.service.ts](../../../apps/backend/src/fights/services/turn-timeout.service.ts)) avec le même effet qu'en JcJ (`GameEngine.timeout()` : passage automatique de phase ou de mulligan).
- **Fin forcée** : *choix de Claude* — **3 timeouts consécutifs** du joueur = défaite (un seul ne suffit pas : on ne punit pas un regard ailleurs). Ça évite qu'un onglet laissé ouvert fasse tourner l'IA indéfiniment. Le compteur repart à zéro dès que le joueur agit.
- **Abandon** (bouton) : défaite. Une **déconnexion** suit les mêmes règles que le JcJ (délai de grâce puis défaite).
- L'IA est un module réutilisable (entrée : état + siège ; sortie : action). Les combats instructifs pourront s'en servir.

## Decks des IA

- Un deck de taille JcJ, qui respecte les règles de deck ([deck-rules.ts](../../../apps/backend/src/decks/deck-rules.ts) : 40 cartes max, 3 exemplaires max), composé **uniquement des cartes du set du monde**. L'IA ne possède pas de collection : son deck ne dépend pas de `user_card`.
- **Génération** : une fonction pure (set, niveau, rng) → liste de cartes. Plus le niveau monte, plus la part des raretés hautes (`epic`, `legendary`, `secret`) augmente. Le deck doit rester jouable : une courbe de coût cohérente, et assez de monstres de base pour pouvoir invoquer et évoluer selon les règles du moteur. Le builder fixe les proportions par niveau.
- Les decks sont générés une fois à la création de l'IA (seed), puis **stockés en BDD**. L'admin peut les éditer carte par carte et les **régénérer** (bouton).

## Données (proposition, le builder ajuste)

- `adventure_world` : id, `card_set_id`, nom, ordre d'affichage, `booster_id` récompense, actif.
- `adventure_world_prerequisite` : (`world_id`, `required_world_id`).
- `adventure_opponent` : id, `world_id`, position 1-5 (= niveau), nom, réplique, `portrait_card_id`, champs de récompense (or/XP 1re victoire, or/XP farm, % booster, % légendaire).
- `adventure_opponent_card` : (`opponent_id`, `card_id`, quantité).
- `adventure_match` : id, `user_id`, `opponent_id`, résultat (victoire / défaite), première victoire oui/non, récompenses attribuées (JSON ou colonnes), tours, `started_at`, `ended_at`. **Source de vérité** pour la progression, les succès PvE, l'historique et le comptage du plafond journalier.
- Réglage global du plafond journalier : une table de réglages simple, ou une colonne dédiée. Au choix du builder.
- **La table `match` n'est pas utilisée** pour le PvE : elle exige deux `User` réels (FK), et elle alimente l'historique et les stats JcJ.
- Les types et enums échangés vont dans `@pipou/shared` (règle du monorepo). Les mondes et IA de départ (3 mondes) sont seedés au démarrage, comme le pool de quêtes. Le schéma doit passer par le mécanisme existant ([synchronize.ts](../../../apps/backend/src/database/synchronize.ts) et migrations), sans casser les tables de prod.

## Moteur / réseau

- `GameState` a deux joueurs avec `userId`. Le joueur IA a besoin d'une identité qui ne correspond à aucun `User` (par ex. un id négatif ou un drapeau `isAi`). La fin de partie doit **router** vers la persistance PvE au lieu de `GameEndService.persistResult` (match + ELO + `fight.finished`).
- Démarrage : un message socket dédié (par ex. `adventure:start` avec `opponentId` + `deckId`) remplace le matchmaking. Le serveur vérifie que l'IA est débloquée pour ce joueur et que le deck est valide, puis crée la partie avec le deck de l'IA déjà installé. Ensuite, le flux de jeu reste celui du JcJ (mêmes messages d'action, même état client).
- Le client doit savoir qu'il est en PvE : pour afficher l'IA, puis le bon écran de fin avec le butin, et revenir au chemin au lieu du lobby.

## Admin

Nouvel onglet « Aventure » dans [Admin.tsx](../../../apps/frontend/src/pages/Admin.tsx) :
- Mondes : créer / modifier / désactiver, set, booster de récompense, prérequis, ordre.
- IA d'un monde (5) : nom, réplique, carte portrait (choisie parmi les cartes du set), récompenses.
- Deck d'une IA : éditeur de cartes (ajout / retrait / quantités, filtré sur le set), bouton « Régénérer ».
- Réglage global : plafond journalier.
- Les endpoints sont protégés par `AdminGuard`.

## Laissé au builder

- Les heuristiques précises de l'IA, et la façon de lister ses actions valides.
- Les proportions de rareté par niveau dans la génération de decks.
- Les noms, répliques et portraits des 15 IA de départ (thématiques du set, en français ; l'admin pourra les changer).
- La forme exacte des tables et des endpoints, et l'organisation des modules NestJS.
- Le contenu exact des nouvelles quêtes du pool.
- Les animations de l'écran de victoire, tant qu'elles restent dans le style de l'Arène.

## Écarts d'implémentation

*Décisions prises pendant l'implémentation et constats de la vérification finale (2026-10-18, base locale).*

**Décisions**
- **Seed d'un monde sans sa carte boss** : le seeder **ignore** le monde (avec un log) au lieu de le créer inactif. Sans la carte signature du boss, le monde ne peut pas avoir ses 5 IA. Le cas « inactif » de la spec reste appliqué à un set sans booster ou sans légendaire.
- **Parties d'aventure orphelines** : une ligne `adventure_match` avec `won IS NULL` (par ex. deck d'IA refusé par le moteur après la préparation) est ignorée par tous les comptes : plafond, progression, succès, « parties jouées ». Aucun hook d'abandon ne la ferme.
- **Câblage Nest** : `FightsService` reçoit les hooks PvE (`PVE_HOOKS`, fournis par `AdventureService`) en `@Optional()`. Sans eux, `adventure:start` répond « Mode Aventure indisponible ». `AdventureModule` n'importe pas `FightsModule`, ce qui évite un cycle.
- **IA** : elle ne change le mode d'un monstre qu'en phase principale (règle du moteur). Si son choix de mulligan échoue, elle garde sa main (`redraw: false`). Elle regarde un seul coup en avance pour décider de passer en garde.
- **Fin forcée par timeouts** : après 3 timeouts consécutifs du joueur, la partie se termine avec `endReason = 'surrender'`. `MatchEndReason` n'a pas de valeur `timeout`, et c'est un enum en BDD sur `match`.
- **Prérequis** : si un monde prérequis est inactif, le monde qui en dépend reste verrouillé.
- **Monde devenu injouable** : un monde dont le booster a été supprimé ou dont le set n'a plus de légendaire refuse le lancement d'un combat. La vue `GET /adventure` le montre quand même. Le joueur voit donc une IA « disponible » qui renvoie une erreur au lancement.
- **Admin** :
  - Le booster de récompense doit appartenir au set du monde. Sinon : 400 « Le booster doit appartenir au set du monde ».
  - Le `cardSetId` d'un monde ne peut pas être modifié par `PATCH` (400), parce que les decks des IA sont tirés de ce set.
  - `PATCH` attend le corps complet (type partagé).
  - Un monde créé dans l'admin reçoit des IA nommées « Set — IA n ».
  - On peut désactiver un monde pendant qu'une partie s'y joue. Cette partie est quand même payée.
- **Succès `ADVENTURE_WORLDS`** : avec 3 mondes actifs, le palier argent (3) est égal au palier or (« tous les mondes »), comme pour `ALL_SETS`.
- **Migration** `1791000000008-Adventure` modifiée sur place (`signature` varchar 32 → 255) : elle n'avait jamais quitté `dev`.
- **Front** :
  - Reprise : si `adventure:start` est refusé (« déjà en partie ») et qu'un `fight:resumed` arrive pour la même IA, l'écran reprend cette partie sans toast. Le démarrage en attente n'est effacé à la réception d'un état que s'il n'y a pas eu de reprise.
  - Le combat PvE n'affiche pas le toast « Adversaire trouvé ».
  - La fiche d'une IA utilise la `BottomSheet` sombre existante (la maquette était blanche).
  - Le plateau de combat partagé (`FightArena`, `FightBoard`, mulligan, barre d'actions) affiche encore des emoji en aventure. C'est hors périmètre et reste à faire.

**Constats de la vérification finale**
- **À trancher : or d'aventure et `GOLD_EARNED`.** L'or passe par `UsersService.addGold`, comme pour les quêtes et la récompense de connexion. `money_earned` n'est incrémenté que par les ventes du marché. L'or d'aventure ne compte donc pas pour `GOLD_EARNED`, de la même manière que l'or des quêtes. C'est cohérent avec « suivre le chemin des quêtes », mais pas avec l'intention de cohérence `moneyEarned` / `GOLD_EARNED` écrite plus haut.
- **Horodatage** : `started_at` est rempli par MySQL (`CURRENT_TIMESTAMP`, fuseau du serveur), `ended_at` par l'application (heure locale de Node). En local (MySQL en UTC, Node en Europe/Paris), les deux colonnes ont 2 h d'écart. Le plafond journalier ne lit que `ended_at` face à une heure calculée par Node, donc il reste juste. Fuseaux de Render et d'Aiven : **à vérifier en prod**.
- **Logs du seeder** : il n'écrit rien quand les mondes existent déjà ou quand il les crée. Il ne logue que les avertissements et les erreurs.
- **Decks seedés** : les 15 IA ont 35 cartes, au plus 3 exemplaires, toutes du set de leur monde. Aucun prérequis entre les 3 mondes de départ.
- **Partie PvE** vérifiée par un client socket.io scripté, contre une MySQL locale réelle : défaite, abandon, 1re victoire, victoire de farm. Butin, progression et succès sont corrects. Aucune ligne dans `match` ni `player_stats`.

**À vérifier par l'utilisateur**
- [ ] Une partie dans le navigateur : Arène → Aventure → combat → écran de résultat (butin) → retour au chemin.
- [ ] Un `pnpm build` propre à la racine, une fois les `nest start --watch` arrêtés (ils partagent `apps/backend/dist` avec `nest build`).
