# Rework construction de deck et sélection en combat

Date : 2026-11-04

## Objectifs
1. Decks favoris (plusieurs) affichés en premier à la sélection ; dernier deck utilisé mémorisé et présélectionné.
2. Decks incomplets masqués à la sélection en combat.
3. Éditeur : deck en cours lisible sans le bandeau horizontal (img 1).
4. Éditeur : ajout de cartes sans grand scroll ni passage par la fiche (img 2).

Principe visuel : s'inspirer de la galerie (`features/glossary/CardGlossary.tsx`) — ligne `cg__row` avec vignette `CardFace size="xs"`, nom, type · set, `CardEffectsText`.

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
- Masque les decks dont le total < `DECK_RULES.MAX_CARDS`.
- Aucun deck complet : message + bouton « Compléter un deck » vers `/decks`.
- Ordre : favoris puis autres, chacun trié par nom.
- Étoile SVG (ajoutée à `Icons.tsx` si absente) pour basculer le favori, mise à jour optimiste puis invalidation `QUERY_KEYS.decks`.
- Présélection à l'arrivée sur l'écran de combat (PvP et aventure) : `lastDeckId` s'il existe et est complet, sinon premier favori complet, sinon rien.
- Étoile aussi dans la liste des decks de `DeckBuilder`.

## 3. Éditeur — deck en cours
- Remplace `deck-strip` par une section repliable « Mon deck · N / 40 ».
- Liste verticale de `DeckCardRow` (style galerie) avec `− qté +` à droite.
- Tri par coût puis nom. Hauteur max ~45vh, scroll vertical.
- Tap sur la ligne : `DeckCardSheet` existant.

## 4. Éditeur — collection
- Champ de recherche par nom au-dessus de `CardFilterBar`.
- Remplace `deck-grid` par une liste de `DeckCardRow` : `qté deck / max` et bouton `+` direct ; `✓` désactivé quand le max (règles de deck ou exemplaires possédés) est atteint.
- Tap sur la ligne : `DeckCardSheet`.

## Composant `DeckCardRow`
- Props : carte, quantité dans le deck, max, `onAdd?`, `onRemove?`, `onOpen`.
- Réutilise les classes et `CardEffectsText` de la galerie ; boutons +/− hors du bouton principal (pas de bouton imbriqué).
- Utilisé par les sections 3 et 4.

## Tests
- Back : service favori (propriété, bascule), mise à jour de `last_deck_id`, `SET NULL` à la suppression du deck.
- Front : `DeckWidget` (filtre incomplets, tri favoris, présélection), `DeckCardRow` (+/−, désactivation au max), recherche par nom.
- Capture Playwright 430px de l'éditeur et du sélecteur avant livraison.

## Hors périmètre
- Tri/filtres supplémentaires, import/export de decks, statistiques de deck.
