# Rework de l'ouverture de boosters et méga booster

## Intention

L'ouverture actuelle est plate à chaque étape : on clique sur un emoji, des flashs de couleur s'enchaînent, puis les cartes défilent sans émotion. Le but est de créer un vrai effet wow et l'envie d'en ouvrir un autre.

Le plaisir recherché, dans les mots du joueur : entendre la déchirure, avoir une petite attente pour espérer un truc de fou, voir défiler les cartes, sentir leur rareté à l'image et au son. L'intensité doit monter avec la rareté.

Références citées : Pokémon TCG Pocket et Yu-Gi-Oh! Master Duel. On reprend des principes (geste, son, suspense), jamais leur mise en scène ni leur look.

## Objectifs

- Remplacer le clic sur emoji par un geste de déchirure sonore.
- Remplacer les flashs par une attente qui évolue selon la meilleure carte.
- Rendre chaque rareté immédiatement reconnaissable à l'image et au son.
- Permettre d'ouvrir 5 ou 10 boosters identiques en une seule grande ouverture.

## Non-objectifs

- Pas de changement des taux de drop ni de bonus lié au multi.
- Pas de nouveau bundle ni de méga bundle.
- Pas de changement du design des cartes.

## Anti-objectifs

- **Effet « AI slop » :** le premier prototype, avec particules et rayons partout dès les basses raretés, a été rejeté.
- **Trop timide :** la v3 a aussi été rejetée. Le niveau validé est celui de la v4.
- **Corvée :** une ouverture multiple ne doit jamais imposer de regarder chaque carte lentement.

## Référence visuelle

Le prototype validé est `.superpowers/brainstorm/52-1793903356/content/dechirure-v4.html` (dossier ignoré par git, jetable). Il fait référence pour le rythme et l'intensité, pas pour le code. Ce fichier doit être conservé jusqu'à la fin de l'implémentation.

## Déroulé d'une ouverture

1. **Booster :** un vrai visuel de booster remplace l'emoji. Le joueur glisse le long de la bande du haut, à la souris ou au doigt, pour le déchirer. Le son suit la vitesse du geste. Le geste va dans les deux sens et se termine à 96 % de la largeur.
2. **Attente :** le paquet de cartes sort du booster, face cachée, par paliers. Une lueur passe entre les cartes, change de couleur à chaque palier, et une note monte d'un cran. Le dernier palier atteint est celui de la meilleure carte. L'animation commence pareil pour tous, donc le joueur ne connaît pas la fin à l'avance.
3. **Défilé :** les cartes passent de la moins rare à la plus rare. Un clic ou un tap passe à la suivante.
4. **Récapitulatif :** une grille montre toutes les cartes, les meilleures en premier, et marque les nouvelles.

Un bouton Skip reste disponible après la déchirure et mène directement au récapitulatif. Les cartes sont déjà acquises côté serveur, donc le Skip ne change rien au gain.

## Effets par rareté

Chaque rareté reprend les effets de la précédente, en plus fort.

| Rareté | Effets |
|---|---|
| Commune | Sobre, aucun effet |
| Peu commune | Halo et teinte légère du fond |
| Rare | Arrivée écrasée de la carte, flash coloré, ondes |
| Épique | Noir de 0,4 s avec grondement, tremblement, coup de basse, éclats, reflet sur la carte, nom de la rareté en grand |
| Légendaire | Noir de 0,6 s, flash blanc, rayons tournants derrière la carte |
| Secrète | Noir de 0,9 s, éclats multicolores, reflet holographique |

La carte s'incline en suivant le pointeur. Pendant le noir, les clics sont ignorés pour ne pas sauter la meilleure carte par accident.

## Méga booster

- Quand le joueur possède au moins 5 exemplaires d'un booster, il peut choisir d'en ouvrir 5. À partir de 10, il peut en ouvrir 10.
- Il y a une seule déchirure et une seule attente, calée sur la meilleure carte de tout le lot. Le visuel du booster est plus grand et affiche ×5 ou ×10.
- Les cartes basses défilent seules et vite (environ 110 ms par carte, 480 ms pour une Rare).
- Le défilé s'arrête jusqu'à un clic sur chaque carte Épique ou plus et sur chaque nouvelle Rare ou plus.
- Les nouvelles Communes et Peu communes ne bloquent pas le défilé : elles gardent leur badge et une pause un peu plus longue.
- Un lot peut contenir 100 cartes et au moins 10 Épiques (une garantie par booster de 10 cartes). Pour ne pas user l'effet, les Épiques ont une version courte en méga : pas de noir ni de grondement, mais arrivée écrasée, tremblement et arrêt jusqu'au clic.
- Les Légendaires et les Secrètes gardent toujours le rituel complet. Si le lot n'en contient aucune, la dernière Épique du défilé a le rituel complet.
- Le récapitulatif final est le même, avec défilement si besoin.

## Sons et visuels (décision du joueur)

- **Cartes :** utiliser le vrai composant `CardDisplay`, pas les cartes factices du prototype.
- **Sons :** combiner les sons du projet (`open-booster`, `rarity-common`, `rarity-rare`, `rarity-epic`, `rarity-legendary`, `select`, `confirm`, via `soundService`) avec les sons synthétiques du prototype (déchirure, notes de palier, grondement, coup de basse).

Il n'existe pas de fichier `rarity-secret` : la Secrète utilise `rarity-legendary` avec les sons synthétiques en plus. Le faux suspense aléatoire actuel (fake-out) est retiré, car l'attente par paliers le remplace.

## Backend

L'API actuelle `POST /boosters/:id/open` ouvre un seul booster. Il faut une ouverture multiple atomique : si le joueur n'a pas assez de boosters ou si une étape échoue, rien n'est consommé ni ajouté.

- La quantité acceptée est 1, 5 ou 10. Tout le reste est refusé.
- Le tirage de chaque booster garde ses règles actuelles, garanties comprises.
- Les statistiques, l'historique, les quêtes et les succès comptent le bon nombre de boosters : une ligne d'historique par booster, 50 XP par booster, et une seule notification de drop par lot.
- `isNew` est vrai sur une seule occurrence par carte dans tout le lot, celle de la première copie obtenue.
- Le contrat de requête et de réponse vit dans `@pipou/shared`.

## Bundles

Les bundles gardent leur écran de contenu actuel et ne sont pas concernés par le multi. Ils profitent du nouveau début d'ouverture (déchirure et attente) si cela reste simple. Sinon, ils restent inchangés.

## Contraintes

- **Animations réduites :** avec `reduced` de `AnimationContext`, pas de tremblement, de flash, de rayons ni d'éclats. La déchirure et le défilé restent utilisables.
- **Mobile :** le geste et les effets fonctionnent au doigt. Le récapitulatif reste fluide avec plusieurs dizaines de cartes.
- **Interface :** icônes SVG, jamais d'emoji. Les textes passent par i18n (fr, en, ko).
- **Son :** les réglages de son existants s'appliquent aussi aux sons synthétiques.

## Laissé au constructeur

- Dessin du booster, tant qu'il reste un visuel propre au jeu et cohérent avec le prototype.
- Découpage en composants de `OpeningModal` et emplacement du choix ×1, ×5, ×10.
- Forme exacte de la route multiple.
- Réglage fin des durées autour des valeurs ci-dessus.
