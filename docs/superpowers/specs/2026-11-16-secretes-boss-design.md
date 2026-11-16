# Cartes secrètes : butin de boss, conditions d'invocation, renfort

Date : 2026-11-16 — statut : validé en brainstorming.

## Objectif
Les secrètes ne sortent plus des boosters. Elles tombent du boss (niveau 5) de leur monde d'aventure. Maître Magouille et Noyau Delta sont renforcés au niveau du Drakon des Origines, avec une condition d'invocation chacun. L'écran de victoire met une secrète en valeur.

## 1. Boosters
`apps/backend/src/boosters/boosters.service.ts` : `RARITY_WEIGHTS` passe à LEGENDARY 1.0, SECRET 0. La secrète sort aussi de `rarityOrder` (repli de `drawCardOfRarity`) : un booster ne peut jamais donner de secrète.

## 2. Butin des boss
`adventure/farm-card.ts` : au niveau 5, si la carte signature est de rareté `secret`, `farmCardFor` renvoie cette carte à `ORIGINES_FARM_PCT` (1 %). Cela couvre Drakon des Origines, Maître Magouille et Noyau Delta. Une migration règle `farmCardId`/`farmCardPct` sur les boss existants dont la signature est secrète et dont `farmCardId` est vide. La migration n'est testée que sur la base Docker locale, jamais sur Aiven.

## 3. Maître Magouille
- 1200 ATK / 3500 PV, coût 4.
- Garde l'insensibilité à tous les effets adverses.
- À l'invocation : soigne tous les alliés de 500 PV et leur donne +300 ATK jusqu'à la fin du tour.
- Condition : invocable seulement si le cimetière du joueur contient au moins 4 monstres Pipou de rareté Épique ou Légendaire.
- Nouvelle action PASSIVE `SUMMON_IF_GRAVEYARD_COUNT` (cible SELF), paramètres : `archetype`, `minRarity`, `value` (nombre).

## 4. Noyau Delta
- 1800 ATK / 2500 PV, coût 4.
- Perforant, insensible aux effets adverses, deux attaques par tour.
- Condition : non invocable depuis la main. Nouvelle action PASSIVE `SUMMON_ONLY_BY_EFFECT` (cible SELF).
- Les effets actuels qui dépendent de Noyau Delta (`equippedOn`/`onBoard`) ne changent pas.

## 5. Nouvelle carte : Protocole Delta .core
- Support CHARGE, archétype pixelman, rareté epic, `chargeMax` 4, `chargeMode` ONE_SHOT.
- +1 compteur chaque fois que son propriétaire pose un équipement.
- ON_CHARGED : invoque Noyau Delta depuis la main, sinon depuis le deck, sur une zone monstre libre.
- Terrain plein (3 zones monstre occupées) : un choix s'ouvre via PickService. Le joueur envoie un de ses monstres au cimetière, puis Delta prend sa zone.
- Aucun Noyau Delta en main ni dans le deck : la Charge n'a aucun effet (`fizzled`) et part au cimetière.
- La carte est ajoutée au set Pixelman, donc disponible dans ses boosters.

## 6. Code partagé, moteur, IA, front
- `@pipou/shared` : nouvelles actions dans l'enum et dans `effect-schema`. Les règles d'invocation depuis la main (`canSummonFromHand` ou équivalent) refusent Magouille sans la condition remplie et refusent toujours Delta.
- Migration BDD : nouvelles valeurs d'enum, stats et effets des deux secrètes, insertion de Protocole Delta .core.
- Moteur : contrôle à l'invocation depuis la main, résolution de la Charge (comptage des équipements, invocation, choix si le terrain est plein).
- IA (`candidate-actions`) : ne propose pas d'invocation interdite et sait poser la Charge.
- Front : texte des nouveaux effets (fr/en/ko), et main qui grise une carte non invocable.

## 7. Écran de victoire
`AdventureResult.tsx` : une carte `secret` reçoit le cadre doré `adv-loot__tile--legend` et le libellé `adventure.result.secret` (« Secrète : {{name}} »), en fr/en/ko.

## 8. Tests
- Unitaires : tirage des boosters (jamais de secrète), `farmCardFor`, migration et patch des cartes, conditions d'invocation, Charge (remplissage, invocation depuis la main ou le deck, terrain plein, absence de Delta), IA, `AdventureResult`.
- Auto-jeu de l'IA : le taux de victoire avec Magouille et avec Delta doit rester proche de celui du Drakon des Origines. Si l'écart est trop grand, ajuster les stats.
- Capture Playwright de l'écran de victoire (shell 430px).
