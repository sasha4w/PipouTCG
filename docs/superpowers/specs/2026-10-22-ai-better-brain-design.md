# Une IA qui réfléchit mieux — design

Branche : `ai-better-brain`. Code concerné : `apps/backend/src/fights/ai/`.

## Pourquoi

Le tournoi IA contre IA sert au joueur à deux choses :
1. vérifier que les trois archétypes (pipou, pixelman, dragon) ont des taux de victoire proches ;
2. voir ce qui manque à chaque deck ou ce qui est trop fort, pour concevoir de nouvelles cartes et, plus tard, des extensions qui ajoutent des mécaniques (voir `docs/vision-extensions.md`).

L'IA actuelle ne permet de faire ni l'un ni l'autre de façon fiable :
- Elle est gloutonne à un coup : elle simule chaque coup possible avec le vrai moteur, note l'état obtenu (`evaluate`) et garde le meilleur. Elle ne voit pas les combos (« j'équipe, puis j'attaque ») et ne prépare rien d'un tour à l'autre. C'est pour ça que la règle « Transformer » n'a rien changé, et que les archétypes qui demandent de préparer leur jeu (Drakon) sont désavantagés. Les mesures reflètent alors la force de l'IA autant que celle des cartes.
- Elle simule sur une copie complète de l'état : quand un effet fait piocher, elle voit la vraie carte du dessus du deck.
- Les niveaux 3, 4 et 5 ont le même cerveau : le niveau ne règle que le taux d'erreurs au hasard (`MISTAKE_RATE`).
- Le tournoi donne un taux de victoire par deck et par archétype, mais rien par carte. Avec 10 parties par paire et une seule graine de decks, un écart de 5 points n'est pas significatif : d'une graine de decks à l'autre, une même confrontation varie souvent de 10 à 20 points.

L'IA de l'aventure est le même `AiPlayer` (`fights.service.ts`). Améliorer l'IA des tests doit améliorer l'aventure par ricochet.

## Réussite

- Le tournoi mesure les cartes et non l'IA : chaque archétype est joué par un cerveau de même force.
- Les mesures sont assez précises pour conclure. À l'échelle Standard, l'intervalle de confiance à 95 % d'un duel d'archétypes ne dépasse pas ± 2 points.
- Le rapport dit, carte par carte, si elle fait gagner, si c'est une vraie option et ce qu'elle fait subir à l'adversaire. Il dit aussi ce qui manque à chaque deck.
- Critère d'équilibre (repris du plan précédent) : chaque archétype a entre 40 et 60 % de victoires contre chacun des deux autres. Un archétype un peu plus fort et un autre un peu plus faible, c'est acceptable dans cette fourchette.
- En aventure, l'IA joue mieux sans ralentir le serveur.

## Ce qu'on ne fait pas (non-objectifs)

- Pas de nouvelles cartes ni de rééquilibrage dans ce projet : il produit l'outil de mesure et le cerveau.
- Pas d'appel à un modèle de langage, ni dans le tournoi ni dans le rapport. Les alertes sont calculées par du code (contrainte de tokens du joueur).
- Pas d'apprentissage automatique (réseau, auto-jeu entraîné).

## Ce qui ferait échouer le projet, même s'il « marche »

- Un archétype mieux joué que les autres parce que ses règles sont plus fines.
- Une IA qui triche (main ou pioche connue) : ça fausse les mesures et c'est injuste en aventure.
- Un tournoi non reproductible : mêmes graines et même code doivent donner le même résultat, quel que soit le nombre de processus.
- Un coup d'IA en aventure qui bloque le serveur. Le serveur Node (Render) est mono-fil : pendant que l'IA calcule, tous les joueurs attendent.
- Des recettes propres à une carte (« si Noyau Delta, alors… ») qu'il faudrait réécrire à chaque extension. L'IA doit jouer une nouvelle mécanique grâce à la simulation par le vrai moteur.

## Contraintes

- Règles du monorepo (`CLAUDE.md`) : `@pipou/shared` n'a pas de dépendance d'exécution. Ce projet est côté backend : n'ajouter de type dans shared que s'il est échangé avec le front.
- Tests existants verts : `ai-player.spec.ts`, `ai-selfplay.spec.ts`, `tournament.spec.ts`, `pnpm --filter @pipou/backend test`.
- Le tournoi tourne en local, sans base (`tournament:generated`, decks générés en code par `buildGeneratedEntries`). Le tournoi sur base (`tournament`) reste disponible.
- Tokens : le travail est fait en trois étapes avec un plan chacune, exécutées une à la fois, dans la conversation plutôt qu'avec de nombreux agents. La sortie console du tournoi est un résumé court ; le détail va dans des fichiers.

## Étape 1 — Un tournoi fiable et son rapport (cerveau actuel)

### 1a. L'IA ne voit que ce qu'un joueur voit

Avant de simuler, l'IA travaille sur une **copie déterminisée** de l'état :
- Elle voit telles quelles sa propre main, les terrains, les cimetières, les compteurs, les Primes et les choix en attente.
- Son propre deck est mélangé dans la copie : elle sait ce qu'il contient, pas dans quel ordre.
- La main et le deck adverses sont remplacés par un tirage dans le **pool inconnu**. Ce pool est la liste du deck adverse moins les cartes visibles : terrain, cimetière, et cartes révélées si le moteur en révèle. La taille de la main et celle du deck sont conservées.
- Le tirage utilise le générateur de l'IA (`random`), pour que le tournoi reste reproductible.
- Une carte adverse citée par un choix en attente (`pendingChoices`) reste à sa place, pour que le choix reste valide dans la copie. Les cartes de mon deck citées par un de mes choix sont visibles : mélanger mon deck conserve les instances, donc le choix reste valide. *(Choix de Claude.)*

L'IA connaît la liste du deck adverse, comme un joueur qui connaît le jeu. En tournoi, c'est la liste exacte du deck. En aventure, c'est la liste du deck du joueur humain, déjà connue du serveur. *(Choix de Claude : en aventure, l'IA connaît aussi la liste du deck du joueur. Un joueur averti connaît les cartes du jeu, et c'est ce qui rend l'idée « savoir de quoi se prémunir » utile.)*

À l'étape 1, une seule déterminisation par décision suffit. L'étape 2 en fait la moyenne sur plusieurs.

### 1b. Tournoi parallèle et échelles

Nouvelle option `--scale rapide|standard|complet` de `tournament:generated` :

| Échelle | Graines de decks | Parties par paire | Parties (15 decks, 105 paires) |
|---|---|---|---|
| rapide | 3 (1 à 3) | 4 | ~1 260 |
| standard | 10 (1 à 10) | 10 | ~10 500 |
| complet | 30 (1 à 30) | 20 | ~63 000 |

- Les options existantes `--deck-seed`, `--games` et `--seed` restent disponibles pour un essai à la main.
- Le travail est réparti sur plusieurs processus (par défaut : nombre de cœurs − 2 ; option `--workers`). Une graine de parties est attribuée à chaque partie avant la répartition, pour que le résultat ne dépende pas du nombre de processus.
- Raison : `Math.random` est remplacé de façon globale pendant une partie (`playGame`). Des processus séparés évitent que deux parties se marchent dessus. Le mécanisme (processus enfants ou `worker_threads`) est laissé au builder.
- Mesure actuelle : 105 parties en ~20 s, démarrage compris, sur un cœur.

### 1c. Journal des parties et rapport par carte

Le tournoi enregistre, pour chaque partie et chaque joueur, ce qu'il faut pour les indicateurs ci-dessous, sans modifier le moteur. Il s'appuie sur la boucle de `playGame`, sur les coups valides que l'IA calcule déjà, et sur la comparaison de l'état avant et après chaque coup.

**Par carte (agrégé par carte de base, par archétype et par archétype adverse)** :
- **Valeur ajoutée** : le taux de victoire des parties où la carte a été jouée, comparé à celui des parties où elle a été en main sans être jouée. On compare deux groupes de parties où on avait la carte, pour ne pas confondre « jouée parce qu'on gagnait déjà » et « fait gagner ».
- **Jouabilité** : parmi les phases principales où la carte était en main, la part où au moins un coup valide l'utilisait, puis la part où l'IA a choisi un de ces coups.
- **Blocage** : quand elle était en main sans être jouable, la raison principale (pas assez de cartes pour payer, pas de cible, pas de zone libre, condition non remplie). Le builder prend la raison la plus simple à établir à partir des candidats et des refus du moteur.
- **Impact sur l'adversaire** : dans les 2 tours qui suivent le moment où la carte est jouée, les monstres adverses détruits, les Primes prises, les cartes adverses défaussées, et les monstres adverses bloqués (attaque ou mode) qui ne l'étaient pas avant. Le rapport le présente comme « observé après », pas comme une cause certaine.

**Par deck** : la part des phases principales sans coup utile (rien d'autre que `end_phase`, `recycle` ou `change_mode`), avec la raison (main vide, rien d'abordable, pas de cible), les causes de défaite et le nombre moyen de tours.

**Alertes** (seuils dans une constante, à régler ensuite) :
- « Pas assez de données » : moins de 30 parties jouée ou moins de 30 parties gardée en main. Aucun autre jugement n'est alors affiché pour cette carte.
- « Trop forte » : la valeur ajoutée dépasse +15 points contre chacun des deux autres archétypes.
- « Morte » : jouable moins de 20 % du temps en main, ou choisie moins de 10 % du temps quand elle est jouable.
- « Manque du deck » : plus de 25 % de phases principales sans coup utile, avec la raison dominante.

**Sorties** :
- Console et `apps/backend/.e2e/tournament-<échelle>-<horodatage>-resume.md` : un résumé court. Il contient les tableaux d'archétypes avec l'intervalle de confiance à 95 % (Wilson), le taux par niveau et les 10 alertes les plus fortes.
- Le détail complet par carte, en JSON et en markdown, va dans le même dossier.

### 1d. Mesure de référence

Un tournoi Standard avec le cerveau actuel (déterminisé). Son résumé est ajouté dans `docs/superpowers/plans/2026-10-19-balance-results.md`, nouvelle section « Référence IA actuelle (Standard) ».

## Étape 2 — Le nouveau cerveau

Méthode proposée par Claude. Le joueur peut la corriger à la relecture.

### 2a. Planifier son tour

L'IA cherche des **suites de coups** dans son tour, au lieu du meilleur coup isolé :
- **Recherche en faisceau** : à chaque profondeur, on développe tous les coups valides des états gardés, et on garde les W meilleurs états (notés par `evaluate`).
- La suite s'arrête à la fin de son tour, à un choix qui revient à l'adversaire, ou à la profondeur maximale D.
- Les choix en attente pour l'IA (`pick_cards`) font partie de la suite.
- L'IA joue le premier coup de la meilleure suite, puis replanifie au coup suivant : une pioche ou un choix peut avoir révélé de l'information.
- Ça remplace les cas spéciaux actuels à deux coups (`guardedScore`, `transformScore`), qui deviennent des suites ordinaires.
- Les coups équivalents sont dédoublonnés pour limiter la recherche. C'est déjà le cas pour les exemplaires identiques d'une même carte en main.

### 2b. Anticiper la riposte

Les meilleures fins de tour (les W retenues) sont notées après une **riposte simulée** de l'adversaire :
- sur K déterminisations (étape 1a), on joue le tour adverse avec le cerveau glouton à un coup actuel ;
- la note d'une fin de tour est la moyenne des notes obtenues.

C'est ainsi que l'IA « se prémunit » de ce que le deck adverse peut encore sortir, sans règle propre à une carte. La riposte remplace l'estimation actuelle de la menace (`raid` et `THREAT_PRIME`) pour ces fins de tour. `raid` reste utilisé pour les états intermédiaires, qui coûtent moins cher.

### 2c. Valeur de ce qui se prépare

`evaluate` ajoute une valeur à une carte en main qui aura un usage au prochain tour :
- une évolution qui a une base valide sur le terrain ;
- un équipement qui a un porteur ;
- une carte dont la condition de jeu est presque remplie.

C'est calculé de façon générique, avec les règles partagées existantes (`canEvolveOnto`, `canEvolveNow`, `ephemeralTargetSide`, `evolutionCost`…) et sans test sur le nom d'une carte. C'est ce qui fera garder un Jeune quand un Bébé est sur le terrain.

### 2d. La philosophie de chaque deck dans un fichier

Les poids propres à chaque archétype sortent de `evaluate.ts` vers `ai/archetype-profiles.ts` (données seulement, typées) :
- pipou : par monstre ;
- pixelman : équipements et Noyau ;
- dragon : stades et PV des unités en croissance ;
- les poids « à protéger » ;
- les nouveaux poids de 2c.

Les poids communs restent dans `evaluate.ts`. Une nouvelle extension = de nouvelles lignes dans ce fichier, au besoin.

### 2e. Un budget compté en simulations

La recherche est limitée par un **nombre de simulations** par décision (appels à `engine.dispatch`), pas par le temps : le résultat est ainsi reproductible. W, D, K et le budget forment un « profil de réflexion ». Le builder choisit leurs valeurs en mesurant un tournoi Rapide.

### 2f. Vérifier que les cerveaux ont la même force

Sur un tournoi Rapide, chaque archétype joue des duels miroirs, avec le même deck, nouveau cerveau contre ancien. « Ancien » désigne le cerveau glouton de l'étape 1, déjà déterminisé.
- le nouveau cerveau doit gagner au moins 60 % de ses parties dans chaque archétype ;
- l'écart entre le meilleur et le moins bon archétype doit rester sous 10 points.

Si un archétype progresse beaucoup moins que les autres, on corrige la recherche ou ses poids avant de conclure quoi que ce soit sur les cartes.

Ensuite, on lance un tournoi Standard avec le nouveau cerveau. On ajoute son résumé à côté de la référence (1d), avec l'écart pour chaque archétype et chaque alerte.

## Étape 3 — La cascade vers l'aventure

- **Niveaux** : chaque niveau d'aventure a son profil de réflexion. *(Choix de Claude :)*
  - niveau 1 : glouton à un coup avec 25 % d'erreurs ;
  - niveau 2 : glouton à un coup avec 10 % d'erreurs ;
  - niveaux 3 à 5 : planification du tour, avec un faisceau et une riposte de plus en plus larges ;
  - le niveau 5 (boss) a le profil le plus fort que permet le budget de l'aventure.
- **Tournoi d'équilibrage** : tous les decks jouent avec le profil le plus fort, quel que soit leur niveau (option par défaut `--brain max`). L'option `--brain niveau` mesure la difficulté réelle de l'aventure, avec le profil de chaque niveau.
- **Budget en aventure** :
  - en plus du budget en simulations, un plafond de temps par décision, 50 ms par défaut *(choix de Claude)* ;
  - au plafond, l'IA joue la meilleure suite trouvée jusque-là ;
  - si les mesures montrent que ça ne suffit pas, le calcul passe sur un fil séparé (`worker_threads`), dans ce même projet.
- **Mêmes garde-fous qu'aujourd'hui** : repli si le calcul échoue (`safeFallback`), plafond de coups par tour, et `forceAiProgress`.

## Laissé au builder

- Les valeurs de W, D, K, du budget de simulations et des nouveaux poids, en mesurant.
- Le mécanisme de parallélisme et le format exact des fichiers de détail.
- La façon d'établir la raison d'un blocage.
- Le découpage en tâches de chaque étape (un plan par étape, à faire juste avant l'étape).
