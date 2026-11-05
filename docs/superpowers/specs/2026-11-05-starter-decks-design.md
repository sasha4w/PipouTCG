# Starter decks — conception

## Intention

Aujourd'hui un compte démarre à 0 gold, sans carte ni deck : un nouveau joueur ne peut pas jouer tout de suite. Chaque joueur doit pouvoir choisir un deck de départ parmi 3 archétypes (Pipou, Pixelman, Drakon), comprendre comment il se joue, et recevoir 5000 gold. Les comptes existants ont droit à la même chose.

L'accueil est réussi si le joueur sait, après son choix, comment jouer son deck.

## Objectifs

- Modal de choix à la première connexion, pour les nouveaux comptes et les comptes existants.
- Consultation de la liste des cartes de chaque deck, avec leur description, comme dans le glossaire.
- Dotation unique : 5000 gold + cartes du deck + deck prêt à jouer.
- Composition des 3 decks modifiable depuis l'admin, sans déploiement.
- Explication de chaque deck ajoutée au panneau des règles.
- Correction de la section support du panneau des règles.

## Hors périmètre

- Plus de 3 starter decks, ou des decks autres que ces 3 archétypes.
- Édition des textes depuis l'admin : ils vivent dans les fichiers de traduction.
- Changement de starter après validation.
- Mise à jour des decks déjà reçus quand l'admin modifie une composition.

## À éviter absolument

- Un double versement du gold ou des cartes (double clic, deux onglets, nouvelle tentative).
- Une dotation partielle : gold reçu sans cartes, ou l'inverse.
- Un joueur bloqué par le modal : il peut toujours le fermer.

## Parcours joueur

1. À la première connexion après mise en ligne, le modal s'ouvre tout seul, une seule fois. La récompense quotidienne attend sa fermeture.
2. Le joueur parcourt Pipou, Pixelman et Drakon par onglets (disposition B de la maquette). Chaque onglet affiche la mention « 5000 gold offerts », la description du gameplay, les cartes phares et un bouton vers la liste complète.
3. La liste complète montre les cartes et leur quantité, avec le visuel et le texte d'effet comme dans le glossaire. Un appui sur une carte ouvre son détail.
4. S'il ferme sans choisir, un message indique que le starter reste disponible sur Home. Un bouton « Réclamer Starter Deck » reste visible sur Home et rouvre le modal.
5. S'il choisit, une confirmation rappelle que le choix est définitif.
6. Après validation, il reçoit 5000 gold, toutes les cartes du deck et le deck créé dans ses decks. Un compte qui possède déjà ces cartes les reçoit quand même, en plus.
7. Une courte explication montre comment jouer le deck, puis le bouton Home disparaît.

## Admin

- Une section « Starter Decks » dans la page admin existante, avec exactement 3 decks, un par archétype : ni création ni suppression.
- L'admin édite uniquement la liste des cartes avec leurs quantités, et les cartes phares parmi celles du deck.
- L'enregistrement refuse une liste hors règles : `DECK_RULES` de `@pipou/shared` (30 à 40 cartes, 3 exemplaires maximum).
- Le modal et le bouton Home restent cachés tant que les 3 decks ne sont pas valides. On peut donc déployer avant que les listes soient prêtes.
- Une modification ne touche que les choix futurs.

## Compositions initiales

Choisies par Sasha, 30 cartes par deck, noms alignés sur les données de cartes. Une migration les insère en retrouvant les cartes par nom (`TRIM(name)`), et échoue si un nom est introuvable. Elles restent ensuite modifiables dans l'admin. Les 3 decks étant valides dès la migration, le modal apparaît dès la mise en ligne.

**Pipou** : 3 Chevalier Touille, 3 Mastodonte Grossebouille, 3 Maraudeur Friponouille, 2 Tactique Gang Gang, 3 Sentinelle Gargouille, 2 Clairon de l'Union, 3 Ouille au rapport, 3 Soin d'urgence, 3 Capitaine Gribouille, 3 Éclaireur Nouille, 1 Général Chatouille, 1 Alerte générale.

**Pixelman** : 3 Noyau Alpha, 3 Noyau Beta, 3 Force Plasma, 3 Module de Réparation .exe, 3 Canon à Particules .vxd, 3 Verrou de Position .lock, 3 Protocole de Gel .frz, 3 Drone Éclaireur .log, 2 Firewall de Surcharge .sys, 1 Noyau Omega, 2 Extraction de données, 1 DuplicateX.

**Drakon** : 3 Potion de Lucidité, 3 Bouclier de Fortune, 2 Œuf de la Genèse, 1 Œuf de la Dualité, 2 Bébé Ackos, 2 Jeune Ackos, 2 Adulte Ackos, 2 Bébé Feros, 2 Jeune Feros, 2 Adulte Feros, 1 Ancestral Feros, 1 Ancestral Ackos, 2 Mont Drakon, 2 Souffle Primordial, 3 Incubation Rapide.

Cartes phares initiales (choix de Claude, modifiables dans l'admin) :

- **Pipou** : Général Chatouille, Capitaine Gribouille, Mastodonte Grossebouille, Chevalier Touille.
- **Pixelman** : Noyau Omega, Noyau Alpha, Canon à Particules .vxd, DuplicateX.
- **Drakon** : Ancestral Ackos, Ancestral Feros, Œuf de la Genèse, Mont Drakon.

## Cartes reçues

Décision de Sasha : les cartes du starter sont des cartes normales. Le joueur peut les vendre, les forger ou les détruire, sans verrou ni limite anti-multi-comptes. S'il casse son deck, il n'a pas de second starter.

## Textes

Noms, descriptions de gameplay et explications « comment le jouer » vivent dans `apps/frontend/src/i18n/locales` (fr, en, ko). Le modal et le panneau des règles utilisent les mêmes clés. Claude les rédige à partir des listes ci-dessus, en lisant les effets réels des cartes.

## Panneau des règles (`FightRules.tsx`)

- Ajouter la ligne Charge dans la section support : la clé `fight.rules.charge` existe mais n'est pas affichée.
- Compléter le texte Équipement avec les emplacements, d'après `EQUIP_SLOT_CAPACITY` : 1 offensif, 1 défensif, 2 accessoires par monstre.
- Ajouter une section présentant les 3 decks.

## Contraintes techniques

- Les types échangés et l'enum `Archetype` restent dans `@pipou/shared`. La valeur pour Drakon est `dragon`.
- `DeckCard` pointe vers `UserCard` : les cartes sont ajoutées à la collection avant la création du deck.
- Le nouvel état du compte doit figurer dans le `select` de `UsersService.findOne`, car `GET users/me` passe par là.
- Migrations manuelles en SQL brut, prochaine : 026. Vérifier `migrations-columns.spec.ts`.
- Frontend : TanStack Query, clés dans `QUERY_KEYS`, invalidation du profil, des decks et de l'inventaire après validation.
- UI : icônes SVG, jamais d'emoji.

## Décisions prises par Claude

- Le droit au starter est porté par un marqueur sur le compte, posé à la validation. Aucune migration ne verse de gold : les comptes existants passent par le même parcours, ce qui évite tout double versement.
- La validation se fait dans une seule transaction, avec verrouillage ou mise à jour conditionnelle du marqueur.
- Le « déjà vu » de l'ouverture automatique est laissé au constructeur, s'il respecte « une seule fois ».
- Un deck est valide s'il respecte `DECK_RULES` et a exactement 4 cartes phares présentes dans sa liste. La validité est recalculée à chaque lecture, pas stockée.
- Une carte utilisée dans un starter ne peut pas être supprimée : clé étrangère `RESTRICT`, avec un message clair dans l'admin.
- La validation du choix revérifie la liste dans la transaction. En cas d'échec, rien n'est versé, le joueur voit une erreur et garde son dû.

## Laissé au constructeur

- Structure des tables des starter decks. Stocker les cartes par `cardId`, sans dépendre d'une collection.
- Réutilisation d'`OpponentDeckEditor` pour l'admin, de `CardFace`, `CardEffectsText` et `CardInspect` pour la liste.
- Base visuelle : `DailyRewardModal`. Point de montage : `AppLayout`, à côté du modal quotidien.
