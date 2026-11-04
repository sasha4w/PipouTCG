# Rework construction de deck et sélection en combat

Date : 2026-11-04

## Objectifs
1. Decks favoris (plusieurs) affichés en premier à la sélection ; dernier deck utilisé mémorisé et présélectionné.
2. Decks incomplets masqués à la sélection en combat.
3. Éditeur : deck en cours lisible sans le bandeau horizontal (img 1).
4. Éditeur : ajout de cartes sans grand scroll ni passage par la fiche (img 2).

Principe visuel : s'inspirer de la galerie (`features/glossary/CardGlossary.tsx`) — ligne `cg__row` avec vignette `CardFace size="xs"`, nom, type · set, `CardEffectsText`.

Maquettes validées (compagnon visuel) : éditeur en onglets (option C), collection en liste + recherche + filtres (option A), sélection en combat « deck par défaut + Changer » (option C).

## 1. Données (backend + shared)
- Migration TypeORM :
  - `deck.is_favorite` BOOLEAN NOT NULL DEFAULT false.
  - `user.last_deck_id` INT NULL, FK vers `deck.id` `ON DELETE SET NULL`.
- Entités `Deck.isFavorite`, `User.lastDeckId` alignées sur la migration.
- `PATCH /decks/:id/favorite` corps `{ favorite: boolean }` ; vérifie que le deck appartient à l'utilisateur (404 sinon).
- `last_deck_id` mis à jour par le back quand un deck est engagé en combat (entrée en file PvP, lancement d'un combat d'aventure). Aucune route dédiée.
- `@pipou/shared` : `isFavorite` sur le type deck, `lastDeckId` sur le profil utilisateur, corps de la requête favori.
- Rappel : ne pas toucher Aiven ; vérifier la migration sur la BDD docker locale.

## 2. Sélection en combat (`DeckWidget`)
- Ne considère que les decks complets (total = `DECK_RULES.MAX_CARDS`).
- Deck par défaut affiché en grand : carte de couverture (monstre de plus haut coût du deck, puis ATK), `★` + nom, « 40 cartes », mention « dernier utilisé » le cas échéant, bouton « Changer ».
- Deck par défaut : `lastDeckId` s'il est complet, sinon premier favori complet, sinon premier deck complet.
- « Changer » ouvre une liste : favoris puis autres, chacun trié par nom ; étoile SVG pour basculer le favori (mise à jour optimiste, invalidation `QUERY_KEYS.decks`) ; tap sur un deck = le choisir et refermer.
- Pied de liste : « N decks incomplets masqués › » vers `/decks` si N > 0.
- Aucun deck complet : message + bouton « Compléter un deck » vers `/decks`.
- Même composant en PvP et en aventure (`OpponentSheet`).
- Étoile aussi dans la liste des decks de `DeckBuilder`.

## 3. Éditeur : onglets Deck / Collection
- Sous le nom du deck, deux onglets plein écran : « Mon deck N » et « Collection ». Remplacent `deck-strip` et `deck-grid`.
- Onglet ouvert par défaut : Collection si le deck est vide, sinon Mon deck. Choix mémorisé pendant la session d'édition.
- Barre du bas (progression, N / 40, Sauvegarder) inchangée.

### Onglet Mon deck
- Liste verticale de `DeckCardRow` (vignette, nom, type, effets) avec `− qté +` à droite.
- Tri par coût puis nom.
- Tap sur la ligne : `DeckCardSheet` existant.

### Onglet Collection
- Champ de recherche par nom, puis `CardFilterBar` (types, coût).
- Liste de `DeckCardRow` : `qté deck / max` et bouton `+` direct ; `✓` désactivé quand le max (règles de deck ou exemplaires possédés) est atteint.
- Tap sur la ligne : `DeckCardSheet`.

## Composant `DeckCardRow`
- Props : carte, quantité dans le deck, max, `onAdd?`, `onRemove?`, `onOpen`.
- Réutilise les classes et `CardEffectsText` de la galerie ; boutons +/− hors du bouton principal (pas de bouton imbriqué), cibles ≥ 44 px.
- Utilisé par les deux onglets.

## Tests
- Back : service favori (propriété, bascule), mise à jour de `last_deck_id`, `SET NULL` à la suppression du deck.
- Front : `DeckWidget` (filtre incomplets, choix du deck par défaut, tri favoris, « Changer »), `DeckCardRow` (+/−, désactivation au max), recherche par nom, onglet par défaut.
- Capture Playwright 430px de l'éditeur (deux onglets) et du sélecteur avant livraison.

## Hors périmètre
- Choix manuel de la carte de couverture, tri/filtres supplémentaires, import/export, statistiques de deck.
