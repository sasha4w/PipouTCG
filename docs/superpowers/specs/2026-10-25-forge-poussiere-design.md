# Forge et poussière — design

Date : 2026-10-25

## Problème

Une copie en trop n'a qu'un seul usage : être vendue sur la place de marché (prix libre en gold, sans taxe). Au-delà de 3 exemplaires (`DECK_RULES.MAX_COPIES`), une carte ne sert plus à rien en jeu. On veut donner de la valeur aux doublons sans casser l'économie existante.

## Décisions

1. Deux nouveaux usages d'une copie en trop : la **forge** (transformer des copies en une carte de rareté supérieure) et la **destruction** (copie → poussière).
2. **Forge** : le joueur donne `FORGE_COST[rareté]` copies de **même rareté et du même set** (cartes différentes autorisées) et choisit **n'importe quelle carte de la rareté au-dessus dans ce set**, même non possédée. La restriction porte sur l'entrée, pas sur la sortie.
3. **Destruction** : chaque copie détruite donne `DUST_VALUE[rareté]` poussière.
4. **Poussière** : une seule nouvelle monnaie, obtenue uniquement par destruction de cartes, **non échangeable** entre joueurs. Elle ne sert à rien pour l'instant : les cosmétiques seront un chantier à part, qui fixera ses dépenses.
5. **Copies protégées** : pour une carte, les exemplaires protégés sont le **maximum** des quantités de cette carte dans **un seul** deck (pas la somme, une carte peut être dans plusieurs decks). Seul le surplus peut être forgé ou détruit. Les copies mises en vente sur la place de marché sont déjà retirées de `UserCard.quantity` par le système actuel.
6. La secrète n'est jamais forgeable (ni en entrée, ni en sortie) et la légendaire ne peut pas être forgée (elle mènerait à la secrète). Les deux restent destructibles.
7. Chiffres de départ, à régler après des tests (constantes dans `@pipou/shared`) :

| Rareté | Coût de forge (copies → 1 carte au-dessus) | Poussière par copie détruite |
|---|---|---|
| Commune | 10 | 1 |
| Peu commune | 10 | 3 |
| Rare | 10 | 10 |
| Épique | 15 | 30 |
| Légendaire | non forgeable | 100 |
| Secrète | non forgeable | 300 |

Pour mémoire, les poids de tirage en booster sont 60 / 25 / 10 / 4 / 0,8 / 0,2. La forge reste donc moins rentable que l'ouverture de boosters ; sa valeur est de **choisir** la carte obtenue.

## Non-objectifs

- Les cosmétiques eux-mêmes (chantier séparé).
- Échanger ou vendre de la poussière, obtenir de la poussière autrement que par destruction.
- Corriger la place de marché, qui laisse aujourd'hui lister des copies utilisées dans un deck (le deck devient invalide au match). Hors périmètre, mais à garder en tête.

## Anti-objectifs

- Un joueur ne doit jamais pouvoir rendre un deck invalide en forgeant ou détruisant.
- La forge ne doit pas devenir le chemin le plus rapide vers les raretés hautes (elle doit rester moins rentable que les boosters).

## Backend

Données existantes utiles : `UserCard` (une ligne par joueur et carte, colonne `quantity`), `DeckCard` (pointe vers `UserCard`, avec `quantity`), `Card.rarity`, `Card.cardSet`, `RARITY_RANK` dans `packages/shared/src/enums/card.ts`.

- `User.dust` : nouvelle colonne entière, défaut 0.
- Quantité utilisable d'un `UserCard` = `quantity − max(DeckCard.quantity pour ce userCardId, tous decks confondus)`.
- `POST` forge : corps = liste de `{ cardId, quantity }` (entrée) + `targetCardId`. Validations : toutes les cartes de même rareté et de même set, total exact = `FORGE_COST[rareté]`, rareté forgeable, quantités utilisables suffisantes, la cible est dans le même set et exactement une rareté au-dessus. Effet, dans une seule transaction : décrémente les entrées, crée ou incrémente le `UserCard` de la cible.
- `POST` destruction : corps = `{ cardId, quantity }`. Validations : quantité utilisable suffisante. Effet : décrémente la carte, ajoute `quantity × DUST_VALUE[rareté]` à `User.dust`.
- Les deux opérations sont transactionnelles avec verrou sur les lignes concernées (même précaution que pour les listings de la place de marché).
- Les cartes réservées à l'aventure (Drakon des Origines, exclues des boosters) ne sont pas des cibles de forge. C'est mon choix. Les cartes sans set ne sont pas forgeables (également mon choix).

## Statistiques, succès et quêtes (demandé par Sasha)

Même mécanique que `cardsSold` : compteurs sur `User`, familles de succès dans `@pipou/shared`, valeurs dans `achievement-values.ts`, lecture dans `achievement-stats.service.ts`, affichage dans `StatsPanel.tsx`.

- Compteurs (mon choix) : `cardsForged` (cartes obtenues par forge), `cardsDestroyed` (copies détruites), `dustEarned` (poussière cumulée gagnée).
- Succès (mon choix) : une famille `CARDS_FORGED` et une famille `CARDS_DESTROYED`, avec les paliers bronze / argent / or habituels. Comme le palier or d'une famille débloque un titre, on gagne deux titres de plus. Seuils à fixer, à calibrer sur la vitesse d'accumulation de doublons.
- Quêtes : de nouveaux types de condition (forger N cartes, détruire N copies) dans `QuestConditionType`, avec quelques quêtes dans `quest-pool.ts`. Choix précis des quêtes à la charge du builder.
- Profil : les trois compteurs apparaissent dans `StatsPanel.tsx`, textes via i18n.
- La poussière dépensée n'existe pas encore (pas de dépense avant le chantier cosmétiques), donc pas de compteur pour elle.

## `@pipou/shared`

`FORGE_COST`, `DUST_VALUE`, helper « rareté forgeable / rareté suivante », types des corps de requêtes et des réponses, champ `dust` côté profil utilisateur.

## Frontend

Dans la collection (`features/profile/CollectionPanel.tsx`) : sur une carte avec surplus, actions « Forger » et « Détruire » à côté de la vente. Forge : choix des 10 cartes d'un même set puis de la cible parmi les cartes de la rareté au-dessus. Affichage du solde de poussière, des quantités protégées par les decks, et confirmation avant toute action irréversible. Icônes SVG uniquement (`components/Icons.tsx`), aucun emoji, textes traduits via i18n.

## À la charge du builder

- Forme exacte des routes, de l'UI et du flux de sélection des 10 cartes.
- Migration de la colonne `dust` (voir comment le schéma de prod est géré, les entités sont « alignées sur le schéma de production »).
- Tests : surtout le calcul des copies protégées (plusieurs decks) et les validations de forge.
