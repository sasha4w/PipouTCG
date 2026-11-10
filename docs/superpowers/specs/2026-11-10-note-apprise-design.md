# Une note apprise par auto-jeu — design

Branche : `BETTER-AI`. Code concerné : `apps/backend/src/fights/ai/`.

Sous-projet 1 sur 2. Le sous-projet 2 (recherche à deux tours, calcul par tranches, budget de temps mesuré sur Render) aura sa propre spec, une fois celui-ci adopté.

## Pourquoi

L'IA joue mal, en aventure comme en tournoi. Deux exemples donnés par le joueur :

1. Elle passe un monstre en Garde alors qu'elle pourrait attaquer pour affaiblir un monstre adverse et prendre la Prime au tour suivant.
2. Elle paie beaucoup de cartes pour poser un monstre qui se fait détruire aussitôt, alors qu'elle pourrait remplir son plateau et monter en puissance.

Les deux coups sont bien proposés par `listCandidates`. Ils sont mal notés par `evaluate` :

- Des dégâts sans destruction valent `PV / 2` (300 dégâts rapportent 150), alors que rester en mode ATK expose une Prime comptée `THREAT_PRIME` (1 500). La Garde gagne presque toujours. `raid` ne compte que les destructions du tour : « je l'achève au tour suivant » n'existe pas dans la note.
- Une carte en main vaut environ 100 à 150, un gros monstre posé vaut `100 + ATK + PV / 2`. Payer trois cartes paraît rentable. La destruction probable du monstre n'est comptée qu'à moitié, et les cartes payées ne sont pas regrettées.

Ce qui a déjà été tenté (spec `2026-10-22-ai-better-brain-design.md`, résultats dans `plans/2026-10-19-balance-results.md`) :

| Tentative | Résultat |
|---|---|
| Recherche en faisceau sur le tour (faisceau 10, profondeur 12, 10 000 simulations) | 59 à 65 % contre le glouton ; critère des 60 % non atteint pour Pipou |
| Faisceau 3 → 10 | + 6 points seulement |
| Riposte adverse simulée | Moins bien que sans (12/24 contre 17/24), temps triplé, désactivée |
| Valeur de préparation, profils d'archétype | Gain marginal |

Élargir la recherche rapporte peu : le plafond vient de la note. Ses poids (`PRIME`, `THREAT_PRIME`, `MONSTER_PRESENCE`…) sont réglés à la main et n'ont jamais été confrontés au résultat des parties. Chaque correctif manuel (`guardedScore`, `prepEvolve`, `LETHAL_THREAT`) a déplacé le problème.

## But

Le joueur veut un algorithme qui s'approprie le jeu et qui soit un adversaire exigeant. L'IA connaît déjà les règles : chaque coup est simulé par le vrai moteur. Il lui manque de savoir ce qui fait gagner. Ce sous-projet le lui fait apprendre en jouant contre elle-même, au lieu de le lui dicter.

## Réussite

- En miroir Standard (même deck des deux côtés, même planificateur `STRONGEST`), la nouvelle note gagne au moins 60 % des parties contre la note manuelle dans chaque archétype, avec moins de 10 points d'écart entre le meilleur et le moins bon archétype.
- Sur le banc de positions jugées par rollouts, le regret moyen est plus bas qu'avec la note manuelle.
- Les deux cas du joueur sont joués correctement et couverts par un test.
- Le coût d'une simulation n'augmente pas de plus de 20 % (`ai:bench`).

## Contraintes

- **Render, plan gratuit** : environ 0,1 CPU partagé et 512 Mo de RAM. La force doit venir du travail hors ligne. Ce sous-projet n'ajoute aucun calcul en partie : la note reste une somme pondérée.
- **Aiven** : aucun accès à la base. Tout tourne sur les decks générés en code (`buildGeneratedEntries`, `allRealCards`).
- Pas de réseau de neurones, pas de dépendance nouvelle, pas d'appel à un modèle de langage.
- Pas de recette propre à une carte : aucune caractéristique ne teste un nom de carte. Une nouvelle extension doit être jouable sans réécrire la note.
- L'IA ne triche pas : les caractéristiques sont calculées sur la copie déterminisée (`determinize`), en entraînement comme en partie.
- Reproductible : mêmes graines et même code donnent les mêmes données, les mêmes poids et le même tournoi, quel que soit le nombre de processus.
- Tests existants verts : `pnpm --filter @pipou/backend test`.

Cette spec lève un non-objectif de la spec d'octobre (« pas d'apprentissage automatique »). La levée est limitée à une régression logistique entraînée en local, dont le résultat est un fichier de nombres versionné.

## Ce qu'on ne fait pas

- La recherche à deux tours, le calcul par tranches, le relèvement du plafond de 200 ms : sous-projet 2.
- Le rééquilibrage des cartes. La nouvelle note changera la force relative des archétypes ; on le mesure, on ne le corrige pas ici.
- Modifier le planificateur, les candidats ou le moteur. Seule la note change, pour que tout gain mesuré lui soit attribuable.

## Architecture

### `features.ts` — décrire un état en nombres

`features(game, seat, archetype) → number[]`, fonction pure, avec la liste des noms dans le même ordre (`FEATURE_NAMES`).

Elle reprend les grandeurs que `evaluate` calcule déjà, sans les pondérer :

- écart de Primes ;
- main (nombre de cartes, somme de `cardUsefulness`), énergie de recyclage ;
- Persistants et Charges de chaque côté ;
- plateaux : nombre de monstres, ATK effective, PV, équipements, de chaque côté ;
- compteurs de tour (Zeta) ;
- menace au tour adverse d'après `raid` : Primes prenables, Primes concédées, valeur des monstres détruits, menace létale ;
- potentiel de mon tour en phase principale ;
- grandeurs d'archétype (monstres, Noyau et équipements, stades Drakon, PV des unités en croissance) ;
- ce que la main prépare (`handPotential`, détaillé par type).

Elle ajoute ce qui manque d'après les deux cas du joueur :

- PV manquants des monstres adverses, et nombre de monstres adverses qu'une seule de mes attaques achèverait à mon prochain tour ;
- écart de cartes total (main + plateau + supports) entre les deux joueurs ;
- valeur de mon plateau que l'adversaire peut détruire à son tour, et la même valeur rapportée au coût des monstres concernés ;
- zones de monstre occupées de chaque côté ;
- numéro de tour.

`raid`, `reinforcements`, `teamBoost` et `handPotential` restent dans `evaluate.ts` ou migrent dans un fichier d'aide si `features.ts` en a besoin : au choix du builder, sans changer leur comportement.

### `learned-weights.ts` — les poids

Données seules, typées, générées par l'entraînement et versionnées. Un vecteur de poids par archétype, de même longueur que `FEATURE_NAMES`. En tête de fichier : la génération, la date, le nombre de positions et la précision mesurée sur les parties mises de côté. C'est le seul fichier que l'entraînement modifie.

Un test vérifie que la longueur des poids correspond à `FEATURE_NAMES`, pour qu'une caractéristique ajoutée sans réentraînement casse le build plutôt que la partie.

### `evaluate.ts` — la note

- `evaluate` devient la somme des poids par les caractéristiques. Les fins de partie restent à ±Infinity, la partie nulle à sa valeur actuelle.
- La note manuelle actuelle est conservée telle quelle sous le nom `evaluateLegacy`. Elle sert d'adversaire de référence dans les miroirs et de note pour les niveaux 1 et 2 de l'aventure.
- Le paramètre `parts` (détail du score pour `ai:explain` et la revue admin) reste disponible : avec la note apprise, il donne la contribution de chaque caractéristique.
- La note utilisée (apprise ou manuelle) est un choix du cerveau (`AiPlayer`, `ThinkingProfile` ou `LevelBrain`), pas une variable globale, pour que deux cerveaux différents puissent s'affronter dans le même processus.

### `selfplay-data.cli.ts` — produire les positions

Auto-jeu en local sur les decks générés, réparti sur plusieurs processus comme le tournoi (`tournament-jobs.ts`).

- Les positions candidates sont les fins de tour de chaque joueur, vues par ce joueur sur une copie déterminisée.
- Au plus 8 positions par partie, tirées au hasard parmi ces fins de tour, pour que les longues parties ne dominent pas.
- Environ 10 % des coups sont tirés au hasard parmi les coups plausibles (`plausibleMistake`). Sans exploration, l'IA ne visite jamais les positions qu'elle évite aujourd'hui et ne peut pas apprendre qu'elles sont bonnes.
- Une ligne JSONL par position : archétype, archétype adverse, caractéristiques, victoire (1), défaite (0) ou nulle (0,5), identifiant de partie.
- Sortie dans `apps/backend/.e2e/`, non versionnée.

Volume visé : 20 000 parties, environ 160 000 positions, de l'ordre de 1 h 40 sur 10 processus d'après les mesures de tournoi.

### `train.cli.ts` — ajuster les poids

- Régression logistique : la note prédit la probabilité de victoire. Descente de gradient en TypeScript simple, avec régularisation L2, à graine fixe.
- Les caractéristiques sont normalisées pour l'entraînement ; les poids écrits sont ramenés à l'échelle brute, pour que `evaluate` n'ait rien à normaliser en partie.
- 10 % des parties (et non des positions) sont mises de côté : les positions d'une même partie ne sont jamais réparties entre entraînement et vérification.
- La console affiche la précision et la perte sur les parties mises de côté, par archétype, et les dix poids les plus forts. Écrit `learned-weights.ts`.

### `ai-rollout.cli.ts` — le juge

Le fichier existe, non suivi. Il devient un outil suivi, avec une entrée `ai:rollout` dans `package.json`.

- Sur environ 500 positions fixes (graines fixes), il joue chaque coup candidat puis finit la partie 24 fois, sur des copies déterminisées, avec le même tirage de cartes cachées pour tous les coups d'une position.
- Il donne, par position, le taux de victoire de chaque coup. C'est un banc de test indépendant de l'auto-jeu.
- Il ne sert pas à entraîner : trop coûteux.
- Un second mode lit ce fichier et calcule le regret d'une note donnée : l'écart de taux de victoire entre le coup qu'elle préfère et le meilleur coup du banc, en moyenne et par archétype.

`ai-judge.cli.ts` (cerveau contre cerveau, non suivi) est suivi lui aussi s'il sert aux miroirs ; sinon il est supprimé au profit du tournoi en mode miroir existant. Au choix du builder.

## Générations

Les premières données viennent du cerveau actuel et reflètent ses défauts. On boucle :

1. le cerveau courant joue les données ;
2. entraînement ;
3. contrôles (ci-dessous), nouvelle note contre la note courante ;
4. si elle passe, elle devient la note courante et rejoue des données.

Trois générations au plus. On s'arrête plus tôt si une génération ne bat pas la précédente en miroir. La génération 1 est comparée à `evaluateLegacy` ; les suivantes à la génération précédente, puis la génération finale de nouveau à `evaluateLegacy` pour le critère de réussite.

## Contrôles

Du moins cher au plus cher. Un jeu de poids n'est adopté que s'il passe les trois.

1. **Banc de positions** (quelques minutes). Le regret moyen doit baisser par rapport à la note manuelle.
2. **Miroir Standard** (1 500 parties, environ 5 min). Critères de la section Réussite.
3. **Les deux cas du joueur**, en tests dans `evaluate.spec.ts` ou `planner.spec.ts` :
   - un monstre adverse qu'une attaque affaiblit assez pour être achevé au tour suivant : l'IA attaque, elle ne passe pas en Garde ;
   - une main qui permet soit un gros monstre exposé payé trois cartes, soit deux monstres : l'IA remplit son plateau.

   Les deux positions sont soumises au joueur avant d'être figées. Elles sont aussi passées au juge par rollouts : un test qui impose un coup n'a de valeur que si ce coup est réellement le meilleur.

Après adoption, un tournoi Standard est relancé et son résumé ajouté à `docs/superpowers/plans/2026-10-19-balance-results.md`, à côté des références précédentes.

## Mise en service en aventure

| Niveau | Note | Recherche | Erreurs volontaires |
|---|---|---|---|
| 1 | `evaluateLegacy` | glouton | 25 % |
| 2 | `evaluateLegacy` | glouton | 10 % |
| 3 | apprise | faisceau 3, profondeur 6 | 0 |
| 4 | apprise | faisceau 6, profondeur 9 | 0 |
| 5 | apprise | `STRONGEST` | 0 |

Le plafond de 200 ms par décision reste en place. `plausibleMistake` compare des scores à `MISTAKE_MAX_LOSS` : il ne sert qu'aux niveaux 1 et 2, qui gardent la note manuelle, donc son seuil ne change pas.

Les garde-fous existants restent : `safeFallback`, plafond de coups par tour, `forceAiProgress`.

## Risques

- **Une note linéaire ne suffit pas.** Si le miroir reste sous 60 % après trois générations, on s'arrête et le builder rapporte les chiffres et ce que le banc montre (quelles positions restent mal jugées). Pas de correctifs manuels empilés sur les poids appris.
- **L'échelle de la note change.** Tout code qui compare un score à une constante (`IMPROVEMENT_EPSILON`, `MODE_TOLL`, `MISTAKE_MAX_LOSS`, seuils de `ai-review`) est recensé et recalé, ou reste sur la note manuelle.
- **Surapprentissage aux decks générés.** Les données utilisent plusieurs graines de decks ; le banc et le miroir utilisent des graines que l'entraînement n'a pas vues.
- **Un archétype mieux servi que les autres.** Le critère d'écart de 10 points en miroir le détecte.

## Laissé au builder

- La liste exacte des caractéristiques et leur calcul, tant que la règle « aucun nom de carte » tient.
- Le taux d'apprentissage, la régularisation, le nombre de passes.
- Le format exact des fichiers de données et du banc.
- Le découpage en tâches (plan à écrire juste avant l'implémentation).
