# Phase de contrôle interactive — design

## Intention

La phase de contrôle (`game.phase === 'end'`, après le combat) ne sert aujourd'hui qu'à défausser jusqu'à `HAND_LIMIT`. Elle devient un moment pour **réorganiser son board** avant le tour adverse : on peut agir sur le terrain, mais jamais invoquer normalement.

## Règles

Autorisé en phase de contrôle :
- **Jouer une carte support** (`playSupport`), sans restriction supplémentaire.
- **Invoquer par Relève** : action `summon` avec `releveInstanceIds` non vide et valide. Une invocation sans Relève est refusée (« Invocation normale interdite en phase de contrôle »).
- **Invoquer une carte à condition spéciale `SUMMON_IF_ALL_ELEMENTS`** (Drakon des Origines : un Adulte ou Ancestral de chaque élément au cimetière), avec son coût habituel.
- **Faire évoluer un Drakon** (`evolve`), avec son paiement habituel (énergie de recyclage restante puis cartes défaussées de la main).
- **Défausser** (existant), toujours obligatoire si la main dépasse `HAND_LIMIT` avant `end_phase`.

Interdit en phase de contrôle :
- invocation normale (payée), y compris sur le terrain adverse ;
- attaques ;
- changement de mode Garde/Attaque (`changeMode`) ;
- recyclage seul (`recycleFromHand`) — le recyclage n'existe ici que comme paiement dans la fenêtre de coût d'une évolution / Relève ;
- Transformer (`transformFromHand`).

Les effets déclenchés par ces actions (ON_SUMMON, ON_ALLY_SUMMON, effets de support…) se résolvent normalement. Aucun déclencheur de phase n'est rejoué. Un support peu utile après le combat (ex. +ATK ce tour) reste jouable : c'est au joueur de juger.

## Backend

- `support.service.ts` `playSupport` : accepter `main` et `end`.
- `evolution.service.ts` `evolve` : accepter `main` et `end`.
- `summon.service.ts` `doSummon` : accepter `end` uniquement si `releveInstanceIds?.length` ou si `requiresAllElements(card.baseCard.effects)` ; garder les validations existantes (Relève, cimetière à 4 éléments, coût).
- `recycleFromHand`, `transformFromHand`, `changeMode`, attaques : inchangés (`main` / `battle` seulement).
- Message d'erreur des refus : remplacer « Phase principale uniquement » par un message adapté là où la phase de contrôle est aussi acceptée.
- Le timeout de phase (`game-engine.ts`, défausse auto puis passage) reste tel quel.

Suggestion au builder : un petit helper partagé (ex. `isBoardPhase(phase)`) plutôt que des conditions dupliquées, si ça reste lisible.

## Frontend

- `FightBoard.tsx`, `FightHand.tsx`, `FightActionBar.tsx`, `mainSlot.ts` : en phase `end` et à ton tour, une carte de la main sélectionnée propose ce qu'elle permet réellement :
  - support → le jouer (mêmes flux de ciblage qu'en phase principale) ;
  - monstre avec Relève et assez d'alliés Pipou → invocation par Relève (même flux qu'en phase principale, sans l'option de paiement normal) ;
  - Drakon pouvant évoluer sur un allié → évolution ;
  - Drakon des Origines avec cimetière complet → invocation (fenêtre de coût habituelle) ;
  - **toujours** « Défausser ».
- Le clic sur une carte ne la défausse plus directement : la défausse devient un choix explicite.
- Les contrôles de mode Garde/Attaque, Recycler et Transformer restent masqués en phase `end`.
- Indication de phase (HUD / `PhaseMenu`) : texte FR/EN/KO qui dit que la phase permet de réorganiser le board (supports, Relève, évolution) et de défausser.

## IA

`candidate-actions.ts` : en phase `end`, proposer les candidats support, Relève et évolution (réutiliser les générateurs de `mainCandidates` filtrés), plus les défausses obligatoires et `end_phase`. Évaluation identique à la phase principale. Vérifier que `ai-player.ts` (ligne ~364, `after.phase !== 'main'`) et la télémétrie ne cassent pas.

## Tests

- Moteur : chaque action autorisée réussit en `end` ; invocation sans Relève, recyclage, Transformer, changement de mode et attaque refusés en `end` ; `end_phase` refusé tant que la main dépasse la limite.
- Front : sélection d'une carte en phase `end` propose les bonnes options + Défausser.
- IA : en `end`, les candidats incluent support/Relève/évolution, jamais d'invocation normale.

## Non-objectifs

- Pas de déplacement de monstres entre zones.
- Pas de nouvelle mécanique de carte, pas de changement d'équilibrage.

## Choix faits par Claude (à vérifier)

- Le clic main en phase de contrôle ouvre un choix (jouer / défausser) au lieu de défausser directement.
- Transformer reste interdit en phase de contrôle.
- Aucun déclencheur de phase n'est rejoué ; les supports « ce tour » restent jouables.
- L'IA évalue ces coups comme en phase principale.
- Le recyclage proposé dans la fenêtre de paiement reste disponible pour l'invocation `SUMMON_IF_ALL_ELEMENTS` (décidé : elle compte comme invocation spéciale).
