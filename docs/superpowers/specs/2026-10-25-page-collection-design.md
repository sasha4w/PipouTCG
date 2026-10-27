# Page Collection (collection, forge, destruction) — design

Date : 2026-10-25

Suite de `2026-10-25-forge-poussiere-design.md`. Le backend de la forge et de la destruction existe ; ce chantier refait le front.

## Problème

La forge et la destruction vivent dans l'accordéon « Cartes » de l'inventaire du profil (669 cartes chez Sasha) : une modale de forge serrée et un bouton « Détruire » par ligne. On ne voit pas les cartes en détail (illustration, description, effets) au moment de choisir, et détruire beaucoup de doublons après de nombreuses ouvertures de boosters se fait une carte à la fois.

## Décisions (prises avec Sasha)

1. Une **page dédiée** `/collection` avec trois onglets : **Collection**, **Forge**, **Destruction**.
2. Partout (les trois onglets, et les deux étapes de forge), une **icône œil** sur chaque carte ouvre sa fiche comme dans le glossaire : illustration, description, effets. Réutiliser le composant du glossaire (`features/fight/CardInspect`), pas de nouvelle fiche.
3. **Forge en deux étapes** (maquette A) :
   - Étape 1 « Copies » : liste défilante de mes cartes ayant des copies utilisables, avec tri et filtres (set, rareté, nom ; réutiliser `CardFilterBar` du glossaire si adapté). Chaque ligne : vignette, nom, copies utilisables, sélecteur − / +, icône œil. Un bandeau fixe en bas affiche « n / coût » et un bouton **Suivant** actif quand n = coût.
   - Étape 2 « Résultat » : liste des cartes obtenables (même set, rareté au-dessus, y compris non possédées, mention « non possédée »), chacune avec son icône œil. On en choisit une puis **Forger**. Un retour à l'étape 1 conserve la sélection.
4. **Onglet Destruction** :
   - Panneau **Destruction rapide** en haut : « Garder N copies » (1, 2 ou 3 ; **3 par défaut**), raretés concernées, set (« Tous » par défaut). Résumé en direct : nombre de copies en trop et poussière gagnée. Bouton « Voir et confirmer ».
   - **Confirmation obligatoire** listant les cartes, quantités et poussière ; rien n'est détruit avant.
   - Si la sélection contient des cartes **épiques, légendaires ou secrètes**, la confirmation affiche en plus un **avertissement** (texte d'alerte nommant ces cartes) et une case « Je comprends » à cocher avant que le bouton Détruire s'active. Même règle pour la destruction carte par carte d'une de ces raretés.
   - Les copies utilisées dans les decks sont toujours gardées (même règle que l'existant : max des quantités dans un seul deck).
   - En dessous, **destruction carte par carte** : même liste avec sélecteur et icône œil.
5. **Onglet Collection** : la liste de cartes actuelle de l'inventaire (filtres, cartes manquantes, pagination par set), avec l'icône œil en plus. Rien d'autre.
6. **Accès** : la ligne « Cartes » de l'inventaire du profil mène à `/collection` au lieu de dérouler l'accordéon.
7. Les boutons « Forger » et « Détruire » actuels de la collection (et la modale de forge) disparaissent : tout passe par les onglets.

## Choix de Claude (à valider en relisant)

- Raretés cochées par défaut dans la destruction rapide : commune, peu commune, rare. Épique, légendaire et secrète décochées, pour éviter les accidents.
- Étape 1 de la forge : dès la première copie choisie, la liste se restreint à ce set et à cette rareté ; les cartes sans copie utilisable (toutes dans un deck) restent visibles mais grisées avec la mention « dans un deck ». Les raretés non forgeables (légendaire, secrète) n'apparaissent pas à l'étape 1.
- La destruction rapide passe par une **nouvelle route backend atomique** (`POST /forge/destroy/batch`, corps `{ items: { cardId, quantity }[] }`) : tout ou rien, dans une transaction, mêmes verrous et règles que la destruction unitaire, un seul événement `destroy.done` avec le total. Le calcul de « ce qui est en trop » se fait côté front à partir de `GET /forge/usable` (copies utilisables = surplus hors decks), `garder N` s'appliquant au nombre d'exemplaires possédés : `à détruire = min(usable, owned − N)` si positif.
- Exclure les cartes d'aventure (Drakon des Origines) des cibles de l'étape 2 : exposer l'info nécessaire au front (par exemple un champ `forgeable` sur les cartes de la collection), le backend continuant de refuser.
- « Garder N » compte les exemplaires **possédés**, copies de deck incluses : `à détruire = min(usable, owned − N)` si positif. Exemple : 5 possédées dont 3 dans un deck, N = 3 → 2 détruites, les 3 du deck restent.
- La route batch compte le **total des copies** détruites : `cardsDestroyed` et `dustEarned` augmentent du total, et `destroy.done` est émis une fois avec `amount` = total (une destruction rapide de 40 copies fait avancer « détruire N copies » de 40).
- Route batch : au plus une ligne par carte et `@ArrayMaxSize(200)`. Si une carte a changé entre l'aperçu et la confirmation (mise en vente, ajoutée à un deck), **toute** la destruction échoue avec un message ; le front rafraîchit l'aperçu (`forgeUsable`) et laisse le joueur reconfirmer.
- Source des données : la collection (`GET /users/me/collection`) renvoie déjà toutes les cartes de tous les sets avec la quantité possédée ; l'étape 2 de la forge et les lignes grisées de l'étape 1 s'en servent, jointes à `GET /forge/usable`. Le champ `forgeable` (faux pour les cartes d'aventure et sans set) est ajouté aux cartes de ce payload.
- Étape 1 de la forge : le verrouillage set/rareté se lève quand la sélection revient à zéro, et un bouton « Réinitialiser » vide la sélection.
- Sélecteur de set de la destruction rapide : un seul set ou « Tous ».
- Lien vers `/collection` également dans l'en-tête (`components/Header.tsx`), à côté des autres entrées.

## Non-objectifs

- Toucher aux règles de forge, aux coûts, aux valeurs de poussière, aux succès ou aux quêtes.
- Les cosmétiques (dépense de poussière).
- Modifier le glossaire ou le deck builder.

## Anti-objectifs

- Une destruction rapide qui détruit quoi que ce soit sans confirmation explicite, ou qui touche des copies utilisées dans un deck.
- Une destruction rapide partiellement appliquée (moitié des cartes détruites en cas d'erreur).

## Contraintes

- Conventions front (`apps/frontend/CLAUDE.md`) : TanStack Query avec clés dans `QUERY_KEYS`, pas de composant déclaré dans un composant, pas de `any`, erreurs via `apiErrorMessage`, état dérivé calculé au rendu.
- Icônes SVG (`components/Icons.tsx`), jamais d'emoji. Textes i18n en fr, en, ko.
- Utilisable sur mobile (listes et bandeau en largeur téléphone), comme le reste du jeu.
- Types échangés front/back dans `@pipou/shared`.
- Après forge ou destruction : invalider collection, inventaire, `forgeUsable`, profil, quêtes, succès (comme aujourd'hui).

## À la charge du builder

- Découpage des composants, nom exact de la route, routage des onglets (paramètre d'URL conseillé pour pouvoir lier un onglet).
- Pagination ou virtualisation de la liste si 669 cartes posent problème.
- Que faire de la section « Cartes » de `CollectionPanel` une fois le lien en place (la remplacer par le lien seul est attendu).
