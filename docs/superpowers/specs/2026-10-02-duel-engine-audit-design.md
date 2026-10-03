# Moteur de duel : audit, tests et corrections — Design

Date : 2026-10-02
Statut : validé en brainstorming, en attente de relecture
Branche : `feat/duel-engine-audit`
Suite : `2026-10-02-admin-duel-sandbox-design.md` (sandbox admin, réalisé après ce chantier)

## Objectif

Fiabiliser le moteur de duel avant de construire le sandbox admin. Concrètement :
- fixer les règles de référence là où le code et l'écran de règles divergent ;
- couvrir chaque règle, déclencheur, condition, action et cible par des tests automatisés ;
- corriger les bugs ;
- remplacer les cartes codées en dur par des effets génériques ;
- rendre le moteur pilotable sans Socket.io, pour les tests et pour le sandbox.

## Contexte actuel

- L'état des parties vit en mémoire dans `FightsService` (`games`, `userToMatch`). La logique est répartie dans `apps/backend/src/fights/services/*`, `effects/*`, `effects-resolver.service.ts` et `buffs-calculator.service.ts`.
- Les services reçoivent le serveur Socket.io et émettent eux-mêmes l'état. Ils sont donc difficiles à tester.
- Le seul test du moteur porte sur le timer (`turn-timeout.service.spec.ts`).
- Les effets sont stockés en JSON dans `card.effects` (type `CardEffect[]` dans `@pipou/shared`).
- Quatre cartes sont codées en dur par ID : #9, #17, #29 et #122. Leurs IDs sont recopiés côté front dans `fight.types.ts`.
- L'écran de règles (`FightRules.tsx`) contredit le moteur : 30 cartes contre 20, main de 9 contre 7, une Draw Phase qui n'existe pas, et Perçant décrit autrement.

## Règles de référence

| Sujet | Règle |
|---|---|
| Deck | 30 à 40 cartes, 3 exemplaires max. Vérifié à la création du deck **et** à sa soumission en match (taille, exemplaires, possession). |
| Préparation | Mélange, puis les 6 premières cartes deviennent les Primes, puis main de 5. |
| Mulligan | 1 mulligan gratuit par joueur : la main est remélangée dans le deck et le joueur repioche 5. Nouvelle phase `mulligan` avant le tour 1. Les deux joueurs décident en parallèle (garder ou mulligan) ; la partie démarre quand les deux ont décidé. |
| Premier joueur | Tirage aléatoire. |
| Pioche | Chaque joueur pioche 1 carte au **début de son tour**, y compris le premier joueur au tour 1. Un joueur qui ne peut pas piocher perd (`deck_empty`). |
| Phases | `main` → `battle` → `end`. La pioche fait partie du début de tour : il n'y a pas de phase `draw` interactive, et la valeur `draw` est retirée de `GamePhase`. |
| Limite de main | 7, vérifiée en End Phase. Le joueur doit défausser l'excédent avant de finir son tour. |
| Coût d'un monstre | 0 à 3. Payé d'abord avec l'énergie de recyclage, puis en défaussant des cartes de la main. |
| Énergie | 1 carte recyclée = 1 énergie. Le compteur retombe à 0 en fin de tour. |
| Mal d'invocation | Pas de règle générale : un monstre peut attaquer le tour où il est invoqué. L'action `CANNOT_ATTACK_ON_SUMMON_TURN` l'en empêche. |
| Combat ATK contre ATK | Les deux monstres se blessent. Un monstre détruit rapporte une Prime à l'adversaire, et son propriétaire pioche 1 carte. |
| Combat ATK contre Garde | Le défenseur ne riposte pas. S'il est détruit, son propriétaire pioche 1 carte, mais l'attaquant ne gagne une Prime que s'il a Perçant. |
| Perçant | Rapporte une Prime quand l'attaquant détruit un monstre en Garde, **et** ses dégâts ignorent `damageReduction`. |
| Attaque directe | Seulement si l'adversaire n'a aucun monstre, et jamais au tour 1. L'attaquant gagne une Prime et le défenseur pioche 1 carte. |
| Double K.O. | Les deux monstres meurent : chaque joueur gagne une Prime et pioche 1 carte. |
| Victoire | Le premier joueur dont le compteur de Primes atteint 0 gagne. Si les deux y arrivent en même temps : **match nul**. |
| Timeout (90 s) | Le joueur passe à la phase suivante, avec défausse automatique en End Phase si nécessaire, et le timer repart. Toute action réussie relance le timer, y compris une défausse ou un choix. Aucun timer ne tourne sur une partie finie. |
| Déconnexion | Le joueur a 60 s pour se reconnecter. Au retour, il retrouve son match et reçoit l'état. Passé ce délai, il perd (`disconnect`). Le timer de tour continue pendant l'absence. |
| Terrain | Agit seulement sur les monstres de son propriétaire. |
| Buffs déclenchés | `BUFF_ATK` et `BUFF_HP` venant d'un déclencheur (ON_SUMMON, ON_PLAY, ON_TURN_START, ON_ATTACK…) sont **permanents** tant que le monstre reste en jeu. `BUFF_ATK_TEMP` dure jusqu'à la fin du tour où il a été donné, et ce pour les monstres des deux joueurs. Les buffs passifs (PASSIVE, terrain, équipement) sont recalculés à chaque changement. |
| Pioche à la destruction | Le propriétaire d'un monstre détruit pioche 1 carte : en combat, et quand le monstre est détruit par un effet de l'adversaire. Il ne pioche pas quand il sacrifie lui-même son monstre (Formatage, Recyclage) ni quand un compteur de tour expire (Noyau Zeta). C'est le comportement actuel du moteur, que ce chantier conserve. |
| Gel `BLOCK_ATTACK` (N) | Le monstre ne peut pas attaquer pendant ses N prochains tours, comptés **sur les tours de son propriétaire**. N vient de la carte. |
| `SET_DELAY_DOUBLE_ATK` | Le monstre pourra attaquer 2 fois **au prochain tour de son propriétaire seulement**. |
| `SET_ATTACKS_PER_TURN` | Fixe le nombre d'attaques par tour. En PASSIVE, la valeur ne s'applique que tant que l'effet est actif (par exemple tant que l'équipement est porté). |
| Choix en attente | Les choix forment une file : un nouveau choix se range derrière ceux déjà en attente. Tant que la file n'est pas vide, seul le joueur qui doit faire le premier choix peut agir, et uniquement pour le résoudre. Le timeout vide la file. |
| Éphémère sans effet possible | Un Éphémère n'est jouable que si au moins un de ses effets ON_PLAY actifs peut produire quelque chose (carte éligible à récupérer, deck à piocher, monstre visé…). Sinon il est refusé et reste en main. |
| Supports Éphémères ciblés | Le client envoie `targetInstanceId`. Le serveur vérifie que la cible est légale (bon camp, monstre présent) et l'utilise. Sans cible légale, la carte n'est pas jouable. |

## Modèle d'effets

### Ajouts dans `@pipou/shared`

| Enum | Ajout | Sens |
|---|---|---|
| `EffectTrigger` | `ON_RECYCLE` | La carte est recyclée depuis la main (remplace le cas codé en dur de Clairon #17). |
| `EffectConditionType` | `EQUIPPED_ON` | L'équipement source est attaché au monstre nommé. |
| `ActionType` | `CANNOT_ATTACK_ON_SUMMON_TURN` | Le monstre ne peut pas attaquer le tour de son invocation. |
| `EffectTrigger` | `ON_BATTLE_PHASE_START` | Le propriétaire de la carte passe de la Main Phase à la Battle Phase. |
| `EffectTarget` | `ADJACENT_ALLIES` | Les monstres à gauche et à droite de la source. |
| `ActionType` | `SUMMONABLE_ON_ENEMY_SIDE` | En PASSIVE : la carte peut aussi être invoquée sur une zone adverse libre (remplace le cas codé en dur de Noyau Zeta #122). |

`ON_TURN_END` est désormais implémenté : il se déclenche en End Phase, juste avant le passage au tour suivant, pour les monstres, équipements et terrains du joueur actif. `DISCARD` aussi : il défausse N cartes de la main de la cible (`PLAYER` ou `OPPONENT`), choisies par leur propriétaire via un choix en attente, ou toute la main si elle contient N cartes ou moins.

### Retraits

- `STEAL_PRIME` est supprimé : enum, moteur, libellés front et admin. Aucune carte ne l'utilise.
- `DEAL_DAMAGE` ne vise plus que des monstres. Les cibles `PLAYER` et `OPPONENT` sont refusées par le DTO.

### Conditions par nom

`SPECIFIC_CARD_ON_BOARD` et `EQUIPPED_ON` comparent des noms **normalisés** : trim, minuscules, accents retirés (NFD), espaces multiples réduits.

Un champ optionnel `match: 'exact' | 'contains'` s'ajoute à `EffectCondition`. Il vaut `exact` par défaut ; `contains` permet de viser une série, par exemple « de la rose ».

`SPECIFIC_CARD_ON_BOARD` cherche sur le terrain **du propriétaire de la source**.

### Cartes jusqu'ici codées en dur

| Carte | Avant | Après |
|---|---|---|
| #9 Commandant Quenouille | Test `id === 9` dans `battle.service.ts`. | ON_SUMMON : `CANNOT_ATTACK_ON_SUMMON_TURN` + `SET_DELAY_DOUBLE_ATK`. Il attend un tour, attaque 2 fois au tour suivant, puis 1 fois par tour. |
| #17 Clairon de l'Union | Test `id === 17` dans `recycleFromHand`. | Il garde son effet ON_PLAY et gagne un effet ON_RECYCLE : `DRAW 1` sur `PLAYER`. |
| #29 Chevalier Touille | Test `id === 29` dans `summon.service.ts`. | `SET_FREE_SUMMON` déclenché en main rend gratuite **la carte source** (on mémorise son `instanceId`). Le JSON de la carte ne change pas. |
| #122 Noyau Zeta | Constante `ZETA_CARD_ID`. | PASSIVE : `SUMMONABLE_ON_ENEMY_SIDE`. Le compteur de tour reste générique : quand il expire, le monstre est détruit et son poseur gagne une Prime. |

Le miroir de ces IDs dans `apps/frontend/src/features/fight/fight.types.ts` est supprimé. Le front déduit les capacités des effets de la carte.

### Équipements « Sur X »

Dans les cartes #127 (Module d'Extension .v2) et #128 (Firewall de Surcharge .sys), `SPECIFIC_CARD_ON_BOARD` devient `EQUIPPED_ON`. Le bonus « Sur Delta » du Firewall devient : PASSIVE, `EQUIPPED_ON` « Noyau Delta », `SET_ATTACKS_PER_TURN 2` sur `SELF`. Delta a donc 2 attaques par tour tant que le Firewall est équipé, dès ce tour.

Pour un équipement, la cible `SELF` désigne le monstre qui le porte.

## Corrections du moteur

Chaque correction commence par un test qui échoue.

1. **Appartenance au match.**
   - `getPlayerState` et `getOpponentState` lèvent une erreur pour un userId étranger au match.
   - `surrender`, `submitDeck` et toutes les actions vérifient l'appartenance.
   - `fight:test_match` et `fight:submit_deck_test_p2` sont retirés en attendant le sandbox.
2. **Timer.**
   - Il repart après un timeout, une défausse et un choix.
   - Il est supprimé à la fin de la partie, et la référence est retirée de la map quand il se déclenche.
3. **Victoire vérifiée après toute variation de Primes.** On passe par un seul point d'entrée `gainPrime`, suivi d'un contrôle de victoire : compteur de tour, effets d'invocation, choix, combat. Le double KO final donne un match nul.
4. **Buffs.**
   - Les buffs déclenchés et permanents sont stockés à part (`permAtkBuff`, `permHpBuff`) et ne sont plus effacés par le recalcul.
   - Le recalcul s'applique aux deux joueurs après chaque mutation.
   - Les PV courants suivent les variations de PV max sans dépasser le nouveau max.
   - Un monstre à 0 PV ou moins est détruit via le point d'entrée unique.
5. **Passifs.**
   - Les conditions sont évaluées pour les monstres, les équipements et les terrains.
   - `ARCHETYPE_ALLIES` filtre bien par archétype.
   - `ALL_ALLIES` en passif touche tous les alliés.
6. **Destruction.** Un seul point d'entrée `destroyMonster`. L'ordre est fixe : ON_DEATH, équipements et monstre au cimetière, pioche du propriétaire si la règle l'exige, Prime si la règle l'exige, contrôle de victoire.
7. **Équipements.** Leurs effets ON_PLAY se déclenchent quand ils sont équipés. Les effets ON_SUMMON des équipements sont migrés en ON_PLAY (Canon à Particules #97, par la migration de données).
8. **Supports.** Dans `isSupportPlayable`, une condition non bloquante passe à la suivante au lieu de valider la carte entière.
9. **Combat.**
   - L'ATK du défenseur est lue après ON_DEFEND et inclut son `tempAtkBuff`.
   - Si ON_ATTACK retire la cible, l'attaque s'arrête proprement.
10. **Gel.** Il se décompte au début du tour du propriétaire du monstre gelé, pour N tours de ce propriétaire. Le 3 codé en dur dans `pick.service.ts` disparaît au profit de la valeur de la carte.
11. **Double attaque différée.** Elle s'applique au prochain tour seulement, puis le nombre d'attaques revient à sa valeur de base.
12. **Concurrence.** Une file d'actions par match exécute les actions l'une après l'autre.
13. **DTO admin.**
    - `EffectActionDto` accepte `filter`, ce qui débloque l'édition des cartes #14, #18, #26, #27, #30, #100 et #129 à #131.
    - Le DTO de condition accepte `EQUIPPED_ON` et `match`.
    - Le DTO refuse `STEAL_PRIME` et `DEAL_DAMAGE` sur un joueur.

## Architecture

```
gateway (Socket.io) ──► FightsService ──► GameEngine.dispatch(game, seat, action)
   ▲                       │  file d'actions par match          │
   │  emitGameState         │  timer, reconnexion, BDD fin       ├─ services (summon, support, battle, phase, pick)
   └──────── EngineResult ◄─┘                                    ├─ effects resolver / applier / conditions / targets
                                                                 └─ buffs calculator
```

- **`GameEngine`** (`apps/backend/src/fights/engine/game-engine.ts`)
  - Il expose `dispatch(game, seat, action): EngineResult`, avec `EngineResult = { error?: string }`. Une fin de partie se lit dans l'état : `phase === 'finished'`, `winner` (absent en cas de nul) et `endReason`.
  - Il est synchrone et ne connaît ni Socket.io ni la BDD.
  - Les services gardent leur logique, mais perdent les paramètres `server`, `emitState` et `checkWinAndEmit`.
- **`seat: 'p1' | 'p2'`** est l'adresse d'un joueur dans l'API du moteur. `FightsService` traduit le userId authentifié en seat, et refuse les utilisateurs qui ne font pas partie du match. Le sandbox pourra envoyer le seat explicitement. À l'intérieur du moteur, les services continuent de manipuler le `userId` du siège : c'est ce qui limite le refactor.
- **Les actions** forment une union discriminée dans `@pipou/shared` (`game/action.ts`) : `mulligan`, `end_phase`, `summon`, `play_support`, `recycle`, `change_mode`, `attack`, `discard`, `pick_cards`, `surrender`.
- **Ports.** `Rng` (`shuffle`, `pickFirstPlayer`) est injecté. L'implémentation de production utilise `Math.random`, et les tests utilisent un RNG déterministe.
- **`FightsService`**
  - Il tient la file d'actions par match, appelle le moteur, émet l'état et gère le timer.
  - Il gère la reconnexion : à la connexion, si `userToMatch` contient l'utilisateur, il annule le délai de 60 s, met à jour le `socketId` et renvoie l'état.
  - Il écrit la fin de partie en BDD : victoire, défaite ou nul, ELO et stats.
- **ELO du match nul** : score 0,5 pour chaque joueur avec la formule existante (K = 32).

## Données

### Migration de schéma

- `MatchEndReason` gagne la valeur `double_ko`, ajoutée à l'enum MySQL `match.end_reason`.
- Un match nul a le statut `finished` et un `winner_id` NULL.
- La colonne `player_stats.draws` existe déjà en production (vérifié sur le dump) : seul l'enum `end_reason` change.

### Migration de données

La migration est idempotente et prudente. Elle ne met à jour une carte que si son JSON `effects` actuel correspond à la valeur attendue d'après le dump du 23/09. Sinon, elle laisse la carte telle quelle et l'inscrit dans le log de migration, pour que tu la corriges via l'admin.

| Carte | Changement |
|---|---|
| #7 Général Chatouille | ON_ATTACK `BUFF_ATK_TEMP` 200 sur `ALL_ALLIES` devient ON_BATTLE_PHASE_START `BUFF_ATK_TEMP` 200 sur `ALLIES_EXCEPT_SELF`. |
| #9 | Ajout de `CANNOT_ATTACK_ON_SUMMON_TURN` à l'effet ON_SUMMON. |
| #17 | Ajout de l'effet ON_RECYCLE `DRAW 1` sur `PLAYER`. |
| #32 Champion Ouille-Ouille | `BUFF_HP_PER_ADJACENT_ALLY` 300 sur `SELF` devient `BUFF_HP` 300 sur `ADJACENT_ALLIES` : ce sont ses voisins qui gagnent les PV max. |
| #97 | ON_SUMMON devient ON_PLAY. |
| #99 Rootkit de Transmission | La cible `ALL_ENEMIES` devient `ENEMY_MONSTER`. Sa description parle d'« un monstre adverse », et le moteur applique désormais l'action à toutes les cibles résolues. |
| #122 | Ajout de l'effet PASSIVE `SUMMONABLE_ON_ENEMY_SIDE`. |
| #127, #128 | `SPECIFIC_CARD_ON_BOARD` devient `EQUIPPED_ON`. Pour #128, le bonus Delta devient le PASSIVE `SET_ATTACKS_PER_TURN 2`. |

La méthode `down` restaure les JSON d'origine.

La migration est testée sur une base MySQL **locale** chargée depuis `apps/backend/.e2e/aiven-dump.sql`, en lançant `migration:run` puis `migration:revert`. Elle n'est **jamais** lancée sur Aiven à la main.

Aujourd'hui, la production n'exécute aucune migration : le conteneur démarre avec `node dist/main`. Le `CMD` du Dockerfile devient donc « migrations puis serveur ». Les migrations en attente s'appliquent ainsi à chaque déploiement, et le conteneur refuse de démarrer si l'une d'elles échoue. La table `migrations` de production ne contient que `InitSchema`, donc seules les nouvelles migrations s'exécuteront.

### Rapport d'écarts

Le document `docs/duel-cards-audit.md` liste, carte par carte, les écarts entre la description et les effets, ainsi que les données suspectes. Par exemple :
- Soin d'urgence : la description parle de 30 % et 60 % des PV max, alors que les effets donnent +600 et +200 fixes.
- Les supports dragons #115 à #120 n'ont aucun effet.
- Le nom « Noyau Alpha » finit par un espace (la normalisation le neutralise, mais le nom reste à nettoyer).

Tu corriges ces données via l'admin. Ce chantier ne les modifie pas.

## Tests

Les tests utilisent Jest, dans `apps/backend/src/fights/**/*.spec.ts`.

- **`ScenarioBuilder`** (`apps/backend/src/fights/testing/scenario-builder.ts`)
  - Il construit un `GameState` de façon déclarative : decks ordonnés, mains, monstres (mode, PV, buffs), équipements, terrains, cimetières, Primes, phase, tour et joueur actif.
  - Il fournit aussi un moteur câblé avec un RNG déterministe.
  - Le sandbox le réutilise.
- **Cartes synthétiques** (`testing/cards.ts`) : des fabriques minimales par déclencheur, condition, action et cible.
- **Vraies cartes** : `testing/fixtures/cards.snapshot.json` contient l'id, le nom, le type, les stats, l'archétype et les effets des vraies cartes, extraits du dump local et commités. Ce sont des données de jeu, sans rien de personnel. Il sert à deux choses :
  - un test qui vérifie que chaque déclencheur, condition, action et cible utilisé par une vraie carte est géré par le moteur ;
  - des tests de combos réels : Noyaux avec Module .v2 et Firewall, Bidouille avec Fripouille, Quenouille, Zeta, Clairon, Touille, Force Delta, Soin d'urgence, Protocole de Gel, Surcharge Overclock.
- **Suites par domaine** :
  - préparation, mulligan, premier joueur ;
  - début de tour et pioche ;
  - phases et limite de main ;
  - coût et énergie ;
  - combat : ATK contre ATK, ATK contre Garde, Perçant, Provocation, attaque directe, double KO, nul ;
  - chaque action ;
  - chaque condition, dont la normalisation des noms et `contains` ;
  - chaque cible ;
  - buffs (permanents, temporaires, passifs, recalcul, PV max) ;
  - choix en attente ;
  - gel ;
  - attaques multiples et différées ;
  - compteur de tour ;
  - fin de partie, ELO et nul ;
  - timer avec fake timers ;
  - reconnexion ;
  - appartenance au match ;
  - file d'actions.
- **Shared** : `enums.test.ts` est mis à jour pour les nouvelles valeurs.

## Frontend

- `FightRules.tsx` est réécrit selon les règles de référence ci-dessus.
- `fight.effects.ts` reçoit des libellés pour `ON_RECYCLE`, `EQUIPPED_ON`, `CANNOT_ATTACK_ON_SUMMON_TURN`, `SUMMONABLE_ON_ENEMY_SIDE`, `ON_TURN_END` et `DISCARD`. `STEAL_PRIME` est retiré, et le libellé du Terrain est corrigé.
- `DeckBuilder` reprend les règles de deck partagées (`DECK_RULES` : 30 à 40 cartes, 3 exemplaires max).
- L'admin des cartes (`CardManager`) n'a aujourd'hui **aucun éditeur d'effets**. Un éditeur visuel fera l'objet d'une spec séparée, après ce chantier. D'ici là, le DTO serveur accepte `filter`, `match` et `EQUIPPED_ON`.
- Écran du duel :
  - écran de mulligan ;
  - envoi de la cible des Éphémères, sans second choix serveur ;
  - affichage du résultat nul ;
  - reconnexion au rechargement de la page ;
  - capacités (mal d'invocation, invocation adverse) déduites des effets plutôt que des IDs.

## Hors périmètre

- Le sandbox admin (spec suivante).
- L'éditeur visuel d'effets dans l'admin des cartes (spec séparée).
- La correction des descriptions et des effets des cartes listées dans le rapport d'écarts : tu t'en charges via l'admin.
- La persistance des parties en cours après un redémarrage du serveur.

## Vérification

- `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test` au vert.
- Migrations : `migration:run` puis `migration:revert` sur une base MySQL locale issue du dump, avec le `.env` pointé sur `localhost`.
- Partie manuelle en local (`pnpm dev`, deux navigateurs). Elle couvre le mulligan, un Éphémère ciblé, un timeout, une reconnexion par rechargement, l'abandon et la limite de main.
- Déploiement par la CI après merge sur `main`.
