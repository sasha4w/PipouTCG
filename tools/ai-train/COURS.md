# Cours : comprendre l'IA réseau de neurones

Une section par notion, dans l'ordre où elles servent. Chaque section finit par les endroits du code où la notion apparaît (`fichier:ligne`, lignes relevées à la rédaction ; elles peuvent glisser un peu). Les chemins TypeScript sont relatifs à `apps/backend/src/fights/ai/`.

## 1. Neurone et couche

Un neurone prend des nombres en entrée, multiplie chacun par un poids, additionne le tout et ajoute un biais (un nombre fixe, lui aussi appris). C'est la seule opération de base : `sortie = poids1 × entrée1 + poids2 × entrée2 + ... + biais`. Les poids sont ce que l'entraînement règle.

Une couche, c'est plusieurs neurones qui lisent la même entrée, chacun avec ses propres poids. Une couche de 64 neurones transforme donc une liste de nombres en une autre liste de 64 nombres. Un réseau est une suite de couches : la sortie de l'une est l'entrée de la suivante.

Dans le code : `nn.Linear` dans `model.py:28` (`ValueNet.__init__`) et `dense` dans `nn/mlp.ts:17`.

## 2. Activation (ReLU, tanh)

Si l'on empile deux couches sans rien entre elles, le résultat est équivalent à une seule couche : additionner des sommes pondérées reste une somme pondérée. Pour que la profondeur serve à quelque chose, on passe la sortie de chaque couche dans une fonction non linéaire, l'activation.

ReLU est la plus simple : elle garde les nombres positifs et remplace les négatifs par 0. tanh écrase n'importe quel nombre dans l'intervalle de −1 à +1. On l'utilise sur la toute dernière sortie, car le résultat d'une partie est justement compris entre −1 (défaite) et +1 (victoire).

Dans le code : `ValueNet.forward` dans `model.py:40` (ReLU ligne 54, tanh ligne 55) et `NnModel.value` dans `nn/mlp.ts:61` (tanh ligne 74).

## 3. Ce que le réseau prédit

Le réseau reçoit une position (état des deux joueurs à un instant) et prédit le résultat final de la partie vu par le joueur qui doit jouer : +1 s'il va gagner, −1 s'il va perdre, 0 pour un nul. Entre les deux, c'est une estimation : 0,4 veut dire « plutôt favorable ».

C'est exactement la note dont le planificateur a besoin. Il explore des suites de coups, arrive sur des positions qu'il ne peut pas jouer jusqu'au bout, et doit les comparer. Une note qui ressemble à « ma probabilité de gagner » permet de choisir la branche la plus prometteuse. L'étiquette d'apprentissage est donc simplement l'issue réelle de la partie dont la position est issue.

Dans le code : `collectGame` dans `nn/selfplay.ts:103` (étiquette `y`, lignes 140 et 146) et `nnEvaluator` dans `nn/nn-eval.ts:12`.

## 4. Erreur et MSE

Pour apprendre, il faut mesurer à quel point la prédiction est fausse. On prend l'écart entre la prédiction et la cible, on le met au carré (pour que les écarts positifs et négatifs comptent pareil, et que les grosses erreurs pèsent plus), puis on fait la moyenne sur beaucoup de positions. C'est l'erreur quadratique moyenne, en anglais MSE.

Repère : prédire toujours 0 donne une MSE proche de 1 sur des parties qui finissent en +1 ou −1. Une MSE nettement plus basse montre que le réseau tire une vraie information de la position. Plus elle est basse, mieux le réseau prédit.

Dans le code : `F.mse_loss` dans `train.py:76` (apprentissage) et `train.py:31` (évaluation).

## 5. Descente de gradient et rétropropagation

Le gradient indique, pour chaque poids, dans quel sens et à quel point il faut le bouger pour réduire l'erreur. Imagine une bille dans un relief : le gradient est la pente, et on descend la pente par petits pas.

Le calcul de tous les gradients à la fois s'appelle la rétropropagation : l'erreur est remontée de la sortie vers l'entrée, couche par couche. En PyTorch, `loss.backward()` calcule les gradients et `optimizer.step()` applique un pas. `optimizer.zero_grad()` efface les gradients du pas précédent, sinon ils s'additionnent.

Dans le code : la boucle de `train` dans `train.py:35`, lignes 76 à 79.

## 6. Adam et taux d'apprentissage

Le taux d'apprentissage (`lr`) est la taille du pas. Trop grand, on saute par-dessus le minimum et l'erreur oscille ; trop petit, l'apprentissage traîne. Ici `lr = 1e-3` (0,001), une valeur courante.

Adam est une variante de la descente de gradient qui adapte le pas de chaque poids : il avance plus prudemment sur les poids dont le gradient change tout le temps, plus vite sur les autres. C'est le choix par défaut qui marche presque toujours sans réglage fin. `weight_decay` tire en plus les poids très légèrement vers 0, ce qui limite le sur-apprentissage.

Dans le code : `torch.optim.Adam` dans `train.py:57`, `lr` ligne 44.

## 7. Lots et époques

Calculer le gradient sur toutes les positions d'un coup serait lent, et le faire sur une seule serait bruité. On prend un lot (ici 256 positions), on fait un pas, puis le lot suivant. Une époque, c'est un passage complet sur toutes les positions, chacune vue une fois.

À chaque époque, l'ordre est mélangé : sinon le réseau verrait toujours les mêmes positions voisines ensemble. Le mélange est tiré avec une graine, donc il est différent d'une époque à l'autre mais reproductible.

Dans le code : `order` (`train.py:71`) et `batch_size` (`train.py:43`, boucle ligne 73).

## 8. Sur-apprentissage, validation, arrêt précoce

Un réseau peut apprendre les exemples par cœur au lieu d'apprendre la règle : l'erreur d'entraînement continue de baisser mais il prédit mal les positions nouvelles. C'est le sur-apprentissage. Pour le détecter, on garde des positions que le réseau ne voit jamais pendant l'apprentissage (la validation) et on mesure l'erreur dessus.

Une partie entière va du même côté : deux positions d'une même partie se ressemblent beaucoup et ont la même étiquette. Si l'une était en entraînement et l'autre en validation, la validation serait trop facile. On sépare donc par partie : une partie sur dix en validation, entière.

L'arrêt précoce : si la perte de validation ne s'améliore plus pendant `patience` époques, on arrête, et on revient aux meilleurs poids vus (fichier `best.pt`).

Dans le code : `split_by_game` dans `dataset.py:117` ; `patience` et `best_path` dans `train.py:42` et `train.py:60` ; test d'arrêt ligne 67.

## 9. Embeddings

Un identifiant de carte n'a pas de sens numérique : la carte 12 n'est pas « plus petite » que la carte 40. Un embedding associe à chaque carte une petite liste de 8 nombres, apprise comme les poids. Le réseau les ajuste pour que ces 8 nombres résument ce qui compte au-delà des caractéristiques déjà connues.

Conséquence : des cartes au rôle proche finissent avec des embeddings proches, sans que personne ne le leur ait dit (voir la dernière cellule du notebook `explore.ipynb`). La ligne 0 de la table est réservée à la carte inconnue : elle reste à 0.

Dans le code : `nn.Embedding` dans `model.py:27` ; `cardIndex` dans `nn/mlp.ts:51` (identifiant de carte vers ligne de la table).

## 10. DeepSets

Une main de cartes n'a pas d'ordre, et sa taille varie. Un réseau classique veut un nombre fixe d'entrées dans un ordre fixe, ce qui ne convient pas. L'astuce DeepSets : un même petit réseau encode chaque carte (mêmes poids pour toutes), puis on additionne les vecteurs obtenus. Une somme ne dépend pas de l'ordre et accepte n'importe quel nombre de cartes.

Il y a 7 ensembles de cartes par position (monstres et supports de chaque camp, ma main, mon deck restant, ce qui peut se trouver dans la main adverse). Les decks contiennent beaucoup plus de cartes que les autres ensembles ; pour que leur somme reste du même ordre de grandeur, chaque carte de deck pèse 0,1 au lieu de 1.

Dans le code : `encode_cards` dans `model.py:35` ; `SET_SCALE` dans `nn/encode.ts:42`, repris côté Python par `set_scale` (`model.py:25` et `model.py:51`).

## 11. La menace cachée

Le réseau ne doit pas tricher : il ne voit pas la main de l'adversaire. Ce qu'il voit, c'est le multiensemble de ce qui peut s'y trouver : les cartes de la liste de l'adversaire, moins celles déjà vues. C'est un ensemble de cartes possibles, pas une main précise, et il se rétrécit au fil de la partie.

Ainsi la note dépend de ce qu'un joueur pourrait raisonnablement savoir : le réseau résume le danger moyen.

Dans le code : `encodePosition` dans `nn/encode.ts:154`, ensemble `oppHidden` ligne 186.

## 12. Auto-jeu et boucle AlphaZero-lite

Pas besoin de parties humaines : l'IA joue contre elle-même. Chaque partie produit des positions étiquetées par l'issue. On entraîne un réseau dessus, on le compare au champion actuel (voir arène), et s'il est meilleur il devient champion et joue les parties de la génération suivante. Le cycle jouer, apprendre, comparer, promouvoir s'appelle ici AlphaZero-lite, par référence à la méthode d'AlphaZero.

Pour que les parties ne soient pas toutes identiques, les 8 premières décisions sont tirées avec une température (un peu de hasard). Cette variété donne des positions différentes à apprendre.

Dans le code : `run_step` dans `loop.py:195` ; `collectGame` dans `nn/selfplay.ts:103` ; options `--temperature` et `--explore-decisions` dans `nn/selfplay.cli.ts:38`.

## 13. Arène et intervalle de Wilson

L'arène fait jouer le challenger contre le champion sur des decks miroirs (chacun joue les deux côtés). Un 55 % sur 400 parties ne suffit pas toujours à conclure : avec peu de parties, un score un peu au-dessus de 50 % peut être de la chance.

L'intervalle de Wilson donne une fourchette dans laquelle le vrai score se trouve avec 95 % de confiance. Si la borne basse est au-dessus de 50 %, on est sûr à 95 % que le challenger est réellement meilleur, pas juste chanceux. La promotion exige les deux : score d'au moins 55 % et borne basse au-dessus de 50 %.

Dans le code : `wilson` dans `nn/stats.ts:2`, utilisé par `verdict` dans `nn/arena.ts:122` ; `should_promote` dans `loop.py:29`.

## 14. De Python à TypeScript

L'entraînement se fait en Python (PyTorch), mais le jeu tourne en TypeScript. Le pont est un fichier JSON : `export.py` y écrit les poids de chaque couche, arrondis à 6 décimales. `mlp.ts` refait le même calcul, couche par couche, en nombres à virgule 64 bits.

Deux langages, un seul calcul : pour s'en assurer, la parité compare les sorties des deux implémentations sur des positions figées. L'écart doit rester sous 1e-5. Sinon, le réseau joué en prod ne serait pas celui qu'on a entraîné.

Dans le code : `export.py:46` (`export_weights`) et `export.py:22` (`round6`) ; `nn/mlp.ts:37` (`NnModel`) ; `nn/parity.spec.ts:7`.

## 15. Niveaux et température

Pour qu'un niveau 1 soit plus facile qu'un niveau 5, on ne dégrade pas le réseau, on ajoute du hasard au choix du coup. La température règle ce hasard : élevée, l'IA tire souvent un coup moins bon, donc elle varie et joue moins fort ; à 0, elle joue toujours le meilleur coup trouvé. Le niveau 5 joue toujours le meilleur.

Le tirage se fait avec une fonction softmax : chaque coup a une probabilité d'autant plus grande que sa note est haute, et la température aplatit ou accentue ces écarts.

Dans le code : `pickSoftmax` dans `temperature.ts:7` ; `LEVEL_BRAINS` dans `level-brains.ts:22`.
