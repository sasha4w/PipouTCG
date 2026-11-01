# Refonte mobile du HUD et des modales de combat

## Intention

L'appli est mobile first, mais en combat le joueur scrolle sans arrêt entre le terrain adverse, son terrain, sa main, les boutons d'action et les logs : c'est un effet « essuie-glace ». Les boutons changent aussi de place sous le doigt et provoquent des erreurs. Par exemple, le joueur sélectionne une carte pour l'invoquer, et « Recycler » apparaît à l'endroit où « Invoquer » allait s'afficher. Il recycle alors sa carte par erreur.

Objectif : sur un téléphone tenu en portrait, jouer un tour entier sans scroller et sans appuyer sur le mauvais bouton.

## Objectifs

- La page de combat tient dans un seul écran de téléphone, sans scroll vertical.
- La main reste toujours visible.
- Les boutons d'action ne changent jamais de place.
- On lit l'effet d'une carte en un geste, sous forme d'un résumé court.
- Le joueur sait toujours si c'est son tour.

## Non-objectifs

- Aucune modification des règles de jeu, sauf le renommage de la phase.
- Pas de refonte desktop dédiée. Le desktop doit rester utilisable, sans plus.
- Pas de refonte graphique des cartes elles-mêmes.

## Anti-objectifs (échec même si « ça marche »)

- Une action irréversible (recycler, finir le tour, invoquer en payant) déclenchée par un seul appui involontaire.
- Un bouton qui apparaît ou disparaît en décalant les autres.
- Un texte d'effet en gros bloc illisible à l'écran.

## Existant (point de départ)

- `apps/frontend/src/features/fight/FightBoard.tsx` affiche, de haut en bas : `FightHUD` (sticky), le terrain adverse, le terrain du joueur, `FightHand`, `FightActionBar` et `FightLog`. Toute la page scrolle.
- `FightActionBar.tsx` : « Invoquer » ne s'affiche que si une carte **et** une zone sont sélectionnées. « Recycler » s'affiche dès qu'une carte est sélectionnée, c'est la cause du missclick. Le bouton de phase (`fab-btn-phase`) affiche successivement « Phase de Combat → », « Fin de Tour → » et « Terminer le Tour → ».
- Effets : appui long via `InspectableCard` / `useLongPress`, qui ouvre `CardInspect` + `CardEffectSheet` tant que le doigt reste appuyé.
- Coût d'invocation : `SummonCostModal` gère déjà le paiement par recyclage (`payIndices`, `recycleEnergy`).
- Cimetière : modale dans `GraveyardPile.tsx`.

## Décisions de l'utilisateur

### Disposition (option A validée sur maquette)

- La barre de navigation globale (menu, market…) est **masquée** sur la page de combat. Pour quitter un combat, on passe par l'abandon, qui existe déjà.
- Organisation de l'écran, de haut en bas :
  1. Le HUD.
  2. Le terrain adverse et le terrain du joueur, **à la même taille**, réduits pour tenir dans l'écran.
  3. Un **dock fixé en bas** : la main en éventail, toujours visible au-dessus du reste, puis la barre d'actions.
- Les **logs** et le **cimetière** s'ouvrent en modale depuis des icônes du HUD. Les logs ne sont plus affichés en permanence.

### Barre d'actions

- Ses emplacements sont fixes : « Recycler » petit à gauche, en couleur atténuée ; l'action principale grande à droite (« Invoquer », « Jouer », « Attaque directe »…).
- Une action indisponible reste à sa place, grisée. Elle ne disparaît pas.
- « Recycler » utilisé seul, sans invocation, demande toujours une confirmation : « Recycler [X] ? ».
- **Évoluer et Transformer n'ont pas de bouton.** Le joueur sélectionne la carte dans sa main, puis touche la carte cible sur son terrain. Une confirmation s'affiche alors : « Faire évoluer [cible] en [carte] ? » ou « Transformer… ? ». Les emplacements de la barre ne changent donc pas.
- **Toute utilisation d'une carte passe par une confirmation** : invocation (gratuite ou payante), support, équipement, terrain, évolution, transformation, recyclage.
- Pendant le tour adverse, le dock reste visible mais tous ses boutons sont grisés *(choix du rédacteur)*.

### Énergie

- Le **compteur d'énergie** (réserve `recycleEnergy`) est toujours visible, à gauche, au milieu de l'écran, au-dessus du terrain.
- L'énergie en surplus d'un recyclage reste dans la réserve, c'est le comportement actuel du serveur. L'avertissement indique : « [N] énergie en trop, gardée en réserve ».

### Tour et phases

- La phase « Fin de tour » est renommée **« Phase de contrôle »** (phase `end`). Seuls les textes i18n changent. La valeur d'enum `end` reste la même, en shared comme en BDD *(choix du rédacteur)*.
- **Limite de main :** tant que le joueur a trop de cartes en Phase de contrôle, « Finir le tour » est grisé dans le menu des phases, avec le message « Défausse X cartes ». La défausse se fait avec le bouton Recycler. Ce blocage vaut aussi quand on finit le tour depuis une phase précédente.
- La **pastille de tour** du HUD est verte quand c'est le tour du joueur, grise sinon. Elle affiche la phase en cours.
- Un appui sur la pastille ouvre un menu avec **uniquement les phases suivantes**, sans retour possible à une phase précédente. Il propose aussi de **finir le tour directement**, par exemple en phase principale : Combat / Contrôle / Finir le tour. On peut ainsi rester en défense et passer au tour adverse. Ce menu remplace le gros bouton de phase de la barre d'actions.
- Au **début du tour du joueur**, une courte animation s'affiche : fond assombri et texte « À toi de jouer ! ».

### Consulter un effet

- Règle unique pour **toutes** les cartes (main, terrain du joueur, terrain adverse, cimetière, modales de choix) : **un appui sélectionne** la carte, qui reçoit une bordure. Une **icône « i »** apparaît alors sur la carte sélectionnée.
- Le « i » ouvre un **tiroir depuis le bas**. Le tiroir montre l'illustration, le nom, les stats, les mots-clés en étiquettes et un **résumé de l'effet en une ligne**. On le glisse vers le haut pour voir le texte complet et les buffs et debuffs en cours, et vers le bas pour le fermer.
- L'appui long est **supprimé**.
- Exception au « un appui sélectionne » : quand une action attend une cible (attaque, ciblage d'un support, zone d'invocation, cible d'évolution), un appui sur une cible valide déclenche cette action et sa confirmation *(choix du rédacteur)*.

### Invocation avec recyclage rapide (en phase principale)

1. Le joueur touche une carte monstre de sa main : elle passe en « à invoquer ».
2. Les cartes qu'il touche ensuite passent en « à recycler », avec une marque visuelle différente. Un nouvel appui sur une carte la retire de la sélection.
3. Il touche une zone vide de son terrain. Une confirmation s'affiche : « Invoquer [carte] en recyclant [X] et [Y] ? ».
4. Il valide ou il annule.

- Si l'énergie des cartes recyclées, plus l'énergie déjà en réserve, ne couvre pas le coût, l'invocation est refusée et un message indique l'énergie manquante.
- Si elle dépasse le coût, la confirmation affiche un **avertissement visible** sur l'énergie en surplus. L'invocation reste possible.
- Ce parcours remplace `SummonCostModal` pour le paiement.
- Un nouvel appui sur la carte « à invoquer » annule toute la sélection. Toutes les cartes peuvent être recyclées, pas seulement les monstres *(choix du rédacteur)*.

## Laissé au constructeur

- La taille exacte des cartes et des zones, et la façon de réduire le terrain selon la hauteur d'écran.
- L'emplacement exact des icônes du HUD : logs, cimetières et abandon (suggestion : abandon derrière une icône du HUD, puisque la barre d'actions ne contient plus le bouton de phase).
- Les animations : durée et style du « À toi de jouer ! », animation du tiroir.
- Comment générer le résumé d'effet en une ligne à partir de `effectText.ts`, et quels mots-clés deviennent des étiquettes.
- Pour « Finir le tour » depuis une phase antérieure : enchaîner les changements de phase côté client, ou ajouter une action serveur.
- Les icônes en SVG uniquement, sans emoji, y compris pour remplacer les ⚡ et ⬆️ actuels des libellés.
