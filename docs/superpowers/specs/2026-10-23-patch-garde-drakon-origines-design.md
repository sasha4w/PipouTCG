# Patch « Garde, Relève et Drakons des Origines » — design

Date : 2026-10-23. Conçu avec le joueur à partir du tournoi Standard du nouveau cerveau (`docs/superpowers/plans/2026-10-19-balance-results.md`, section « Nouveau cerveau »).

## Pourquoi

Le joueur veut un TCG solide : trois archétypes à parité, une défense qui compte sans rendre le jeu bloqué, et un monde Drakon qui a une vraie finale. Le tournoi (10 500 parties) montre :
- **Drakon** perd surtout à cause de sa ligne défensive et lente. Bébé Teros (−36 pts) et Œuf Céleste (−39 pts) font perdre, alors que ses cartes offensives font gagner (Souffle Primordial +26, Adulte Tempestu +12). Contre Pipou, il reste à 36 %.
- **Le jeu ne récompense pas la défense** : les murs à Provocation, le soin et le contrôle sont tous entre −25 et −38 pts. Un monstre en Garde refuse une Prime mais ne fait rien d'autre. On ne gagne jamais en se défendant, et rien n'empêche de rester en Garde sans fin.
- **Pipou étouffe faute de place** : il n'a aucun coup utile dans 16 % de ses phases principales, deux fois plus que les autres, surtout faute de zone libre (3 926 phases) et de cartes pour payer (2 178).
- **Des cartes de soutien à coût 0 sont trop fortes.** Tactique Gang Gang (+300 ATK permanent à **tous** les alliés, cumulable : jusqu'à 3 terrains, donc +900) est jouée dans 2 929 parties. Canon à Particules .vxd et Surcharge Overclock sont aussi en tête.
- **Des cartes sont mortes** à cause d'une condition trop étroite : Force Delta (jouable 0 à 3 % du temps en main), Mise à jour .patch (1 %).

Ces chiffres sont des corrélations, et le critère de force égale de l'IA n'est pas tout à fait atteint (Pipou à 59 % au lieu de 60). Le patch se mesure donc par le tournoi, avant et après.

## Réussite

Tournoi Standard après le patch, comparé au tournoi « Nouveau cerveau » (même cerveau, mêmes graines) :
- Drakon à au moins 40 % contre Pipou et contre Pixelman.
- Chaque archétype entre 40 et 60 % contre chacun des deux autres.
- Pipou : part des phases principales sans coup utile sous 12 % (16,1 % aujourd'hui).
- Aucune des cartes modifiées par ce patch en alerte « trop forte », et ni Force Plasma ni Mise à jour .patch en alerte « morte ».
- **Pas de jeu bloqué** : le nombre moyen de tours par partie n'augmente pas de plus de 2 (12 à 14 aujourd'hui selon l'archétype), et aucune partie sans vainqueur de plus qu'avant.

## Ce qu'on ne fait pas

- Pas de copie de la position Défense de Yu-Gi-Oh : pas de stat de défense, pas de dégâts divisés par la Garde.
- **Pas d'énergie gagnée en encaissant une attaque** (refusé par le joueur : trop fort).
- Pas de changement de Souffle Primordial (meilleure carte du Drakon, l'archétype le plus faible), de Rootkit de Transmission ni de Clairon de l'Union. Pour ce dernier, le joueur juge la carte bonne, avec un combo réel via Ouille au rapport, et l'alerte vient sans doute de l'IA qui sous-estime l'énergie.
- Pas l'étape 3 de l'IA (cascade vers l'aventure), traitée après ce patch.

## Contraintes

- Règles du monorepo : types et enums échangés entre front et back dans `@pipou/shared`. Le backend est la source de vérité des valeurs d'enum (elles sont en base). `@pipou/shared` n'a pas de dépendance d'exécution. Lancer `pnpm build:shared` après l'avoir modifié.
- Les données de cartes sont en base (MySQL Aiven). On les modifie par des patchs et une migration, sur le modèle de `apps/backend/src/database/balance-2026-10-patches.ts` (planifier `apply` / `already-done` / `skip-diverged`, aller-retour up/down), avec les tests de `real-cards.spec.ts` sur les vraies cartes.
- Les nouvelles mécaniques passent par le moteur et ses effets génériques (`effects/`), avec leur texte côté front (comme « texte des nouveaux effets » du patch précédent).
- L'IA doit savoir jouer chaque nouvelle mécanique : candidats dans `ai/candidate-actions.ts` et prise en compte par la simulation. Sinon le tournoi mesure une mécanique jamais utilisée.
- Déploiement uniquement par la CI sur `main`. Le travail se fait sur une branche dédiée *(choix de Claude : `patch-garde-origines`, créée depuis `ai-better-brain`, qui contient le tournoi et le nouveau cerveau)*.

## 1. La Garde

Intention du joueur : **« soit je perds une Prime, soit je gagne du temps pour me refaire »**. La Garde achète du temps, mais ce temps doit servir à se refaire, et il ne doit pas pouvoir s'accumuler.

Ce qui ne change pas : un monstre en Garde ne peut pas attaquer, encaisse sans riposter, et sa destruction ne donne pas de Prime à l'attaquant, sauf avec la perforation.

Ce qui s'ajoute :
- **Durée limitée** : un monstre ne peut pas rester en Garde plus de **2 tours adverses d'affilée**. Au début du tour de son propriétaire qui suit le 2ᵉ tour adverse tenu, il repasse automatiquement en Attaque. Le compteur repart à zéro dès que le monstre est en Attaque.
- **Contre-offensive** : quand un monstre passe de la Garde à l'Attaque, que ce soit par le joueur ou automatiquement, il gagne **+100 ATK par tour adverse tenu, +200 au maximum, jusqu'à la fin de ce tour**.
- *(Choix de Claude)* Un monstre verrouillé en Garde (Verrou de Position .lock) est soumis à la même limite : au-delà de 2 tours adverses, le verrou tombe et le monstre repasse en Attaque.
- Le joueur voit, sur le monstre, le nombre de tours de Garde tenus et le bonus de contre-offensive qui l'attend.

## 2. Récompenser la défense, carte par carte

Ce ne sont pas des règles générales, mais des pouvoirs de certaines cartes.

- **Renvoi de dégâts (nouvelle mécanique)** : un monstre qui a ce pouvoir renvoie à l'attaquant un pourcentage des dégâts de combat qu'il subit, calculé après réduction. Le renvoi s'applique en Attaque comme en Garde.
  - *(Choix de Claude)* Un attaquant détruit par un renvoi ne rapporte pas de Prime au défenseur en Garde. En Attaque, la règle de Prime habituelle s'applique.
  - Valeurs : Bébé Teros 30 %, Jeune Teros 40 %, Adulte Teros 50 %, Ancestral Teros 60 %.
- **Les murs à Provocation font piocher** : chaque monstre qui pose une Provocation à son arrivée gagne « détruit : son propriétaire pioche 1 carte » (`ON_DEATH` → `DRAW` 1, effet existant). Cartes concernées : Sentinelle Gargouille, Capitaine Gribouille, Mastodonte Grossebouille, Noyau Alpha, Bébé / Jeune / Adulte Teros.
  - *Proposé par le joueur à 2 cartes et pour tout monstre en Garde, ramené à 1 carte et aux seuls murs à Provocation, pour ne pas pousser l'attaquant à épargner les monstres en Garde.*

## 3. Pipou : la Relève

**Relève (N)** : nouveau mot-clé. Au lieu de payer le coût d'un monstre qui a ce mot-clé, on peut l'invoquer depuis la main en envoyant **N alliés Pipou de son terrain** au cimetière. Il arrive dans une des zones libérées.
- Le nom vient de « la relève » militaire : les soldats en place cèdent leur poste à un plus gradé. Les Pipou sont une escouade à grades.
- **Relève (2)** sur Général Chatouille, Champion Ouille-Ouille et Mastodonte Grossebouille.
- Les alliés envoyés au cimetière comptent comme envoyés au cimetière, pas comme détruits en combat : ni Prime ni pioche de Prime. *(Choix de Claude)* Leurs effets « détruit » (`ON_DEATH`) se déclenchent. Ça donne une synergie avec les murs qui font piocher et avec Vice Capitaine Patouille.
- Le joueur choisit les alliés sacrifiés. L'action `summon` reçoit les alliés sacrifiés (type dans `@pipou/shared`), et l'interface de pose propose ce choix quand la Relève est possible.

## 4. Cartes existantes modifiées

| Carte | Aujourd'hui | Après le patch |
|---|---|---|
| Tactique Gang Gang (terrain) | +300 ATK à tous les alliés, cumulable | +300 ATK aux **alliés Pipou** (`ARCHETYPE_ALLIES`) |
| Tous les terrains | plusieurs exemplaires du même terrain possibles | **un seul exemplaire d'un même terrain** en jeu par joueur *(choix de Claude : règle générale, Mont Drakon compris, plutôt qu'une exception propre à Tactique)* |
| Force Delta → **Force Plasma** | détruit un ennemi si Noyau Delta est en jeu | détruit un ennemi si **un Noyau est sur mon terrain**. Zeta, implanté chez l'adversaire, ne compte donc pas. Renommage décidé par le joueur. |
| Mise à jour .patch | remet le compteur du Zeta à 3 | remet le compteur à 3 **et** récupère jusqu'à 2 monstres Pixelman du cimetière |
| Canon à Particules .vxd (équipement) | +400 ATK, perforation | **+250 ATK**, perforation |
| Surcharge Overclock (éphémère) | +500 ATK temporaire à tous les alliés | +500 ATK temporaire à tous les alliés, qui **perdent 200 PV** *(valeur : choix de Claude)*. Un allié tué ainsi ne rapporte pas de Prime à l'adversaire. |
| Œuf Céleste | éclot en Adulte au bout de 4 tours | éclot au bout de **3 tours** ; pendant l'incubation, soigne 100 PV aux Drakons alliés au début de chaque tour de son propriétaire *(valeur : choix de Claude)* |
| Bébé / Jeune / Adulte Teros | Provocation (+ réduction de dégâts pour Jeune et Adulte) | + renvoi de dégâts 30 / 40 / 50 % et pioche à la destruction (sections 2) |

## 5. Extension Drakon

### Les Ancestraux (4 légendaires)

- Un par élément : **Ancestral Teros** (Terre), **Ancestral Feros** (Feu), **Ancestral Ackos** (Eau), **Ancestral Tempestu** (Vent).
- **Nouveau stade `ancestral`** après `adult`. Un Ancestral se joue **comme une évolution** sur l'Adulte de même lignée, aux mêmes conditions qu'une évolution : la base n'a pas été posée ce tour, et on paie la différence de coût. L'Adulte part au cimetière, comme pour toute évolution.
  - *Choix du joueur : pas un stade long à atteindre, mais un Adulte déjà en jeu peut devenir Ancestral tout de suite.*
- *(Choix de Claude)* La règle « Transformer » (récupérer un Bébé en défaussant un Jeune ou un Adulte coincé en main) accepte aussi un Ancestral coincé en main.
- *(Choix de Claude, valeurs à régler au tournoi)* : coût 4, statistiques d'environ +30 % sur l'Adulte, et le pouvoir de l'Adulte renforcé :
  - **Teros** : Provocation, immunité aux affaiblissements, réduction de dégâts, renvoi 60 % ;
  - **Feros** : perforation, 600 dégâts à tous les ennemis à l'arrivée ;
  - **Ackos** : soin de 500 aux alliés au début du tour, récupère 2 cartes du cimetière à l'arrivée ;
  - **Tempestu** : 2 attaques par tour, renvoie en main l'ennemi le plus fort à l'arrivée, +ATK.

### Le Drakon des Origines (secret)

- **Invocation** : depuis la main, seulement si le cimetière du joueur contient **un Adulte ou un Ancestral de chacun des 4 éléments**. Peu importe comment ils y sont arrivés : évolution, combat, paiement, recyclage ou défausse (précisé par le joueur).
- **Immunisé aux effets adverses**, comme Maître Magouille (`SET_DEBUFF_IMMUNITY`).
- **À son arrivée, il choisit un pouvoir élémentaire** : le joueur choisit un Adulte ou un Ancestral de son cimetière, et le Drakon des Origines **copie ses effets**. La carte choisie reste au cimetière.
  - *Nouvelle mécanique : copier les effets d'une carte choisie. Le choix passe par le `pick_cards` existant, depuis le cimetière.*
  - *(Choix de Claude)* Il copie **tous** les effets de la carte choisie. Ses effets d'arrivée (`ON_SUMMON`) se résolvent une fois, aussitôt après le choix. Ses autres effets (passifs, début de tour…) restent actifs tant que le Drakon des Origines est en jeu.
  - *(Choix de Claude)* : coût 4 ; statistiques au-dessus des Ancestraux (environ 1 500 / 4 000), à régler au tournoi.

### Le monde Drakon en aventure

- Monde « Drakon - Les légendes primaires » : les niveaux 1 à 4 restent ceux des 4 éléments (Teros, Feros, Ackos, Tempestu). **Le boss du niveau 5 devient le Drakon des Origines**, à la place du Gardien de l'Œuf Céleste. Sa signature (`adventure/signatures.ts`) et son deck généré doivent pouvoir l'invoquer.
- **Farmer le Drakon qu'on veut** *(choix de Claude, réglable dans l'admin des récompenses)* :
  - les victoires de farm des niveaux 1 à 4 ont un taux de drop de l'**Ancestral de leur élément** ;
  - le tirage légendaire du boss se fait parmi les 4 Ancestraux ;
  - le Drakon des Origines tombe du boss à un taux faible, et ne se trouve pas dans les boosters.
- Les decks d'IA d'aventure et le générateur (`adventure/deck-generator.ts`, `dragonPlan`) intègrent les Ancestraux à partir d'un niveau donné, et le Drakon des Origines pour le boss.

### Visuels

Les nouvelles cartes ont besoin d'illustrations. *(Choix de Claude)* : le patch peut les livrer avec une image provisoire, et le joueur fournit les visuels.

## 6. L'IA

- Nouveaux candidats : invocation par Relève (les combinaisons d'alliés sacrifiés, plafonnées comme les `pick_cards`), évolution vers un Ancestral, invocation du Drakon des Origines et son choix au cimetière.
- La Garde à durée limitée et la contre-offensive viennent du moteur. Le planificateur les voit par simulation. Si `evaluate` doit les valoriser, par exemple le bonus de contre-offensive à venir, le poids va dans `archetype-profiles.ts` ou dans les poids communs.
- `evaluate` reconnaît le stade `ancestral` (rang 5) dans le bonus Drakon.

## 7. Mesure

1. Tournoi Rapide après chaque grand bloc (mécaniques, données) pour voir le sens de l'effet.
2. Tournoi Standard final avec le nouveau cerveau. On le compare au tournoi « Nouveau cerveau » sur les critères de réussite. Les résultats sont ajoutés à `docs/superpowers/plans/2026-10-19-balance-results.md`.
3. Si un critère n'est pas atteint, on règle uniquement les valeurs marquées « choix de Claude » ou « à régler » (au plus 3 itérations), puis le joueur tranche.

## Laissé au builder

- Le découpage en plans : le patch est gros (moteur, données, aventure, front, IA). *Suggestion : plan 1 mécaniques moteur + IA, plan 2 données de cartes + migration, plan 3 extension Drakon + aventure, plan 4 front.*
- Les noms exacts des nouveaux types d'action et de condition dans `@pipou/shared`, et leur texte affiché.
- La façon de stocker le compteur de Garde sur le monstre.
- Les valeurs marquées « à régler », en mesurant.
