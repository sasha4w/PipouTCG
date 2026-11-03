# Correctifs d'effets de cartes et nouvelles cartes Charge

Date : 2026-11-03. Ordre de livraison : correctifs d'abord, nouvelles cartes ensuite. Pas d'image de carte (aucun visuel fourni).

## Partie 1 — Correctifs

Chaque bug commence par un test qui le reproduit, puis le correctif.

1. **Monstre gelé qui perd sa réduction de dégâts ÷2.** Reproduire avec Protocole de Gel .frz sur un monstre portant une réduction (Firewall, Sécurité réseau). Chercher où `damageReduction` est perdu : recalcul dans `buffs-calculator.service.ts`, ou remise à zéro dans `phase.service.ts`. Cause non confirmée à ce stade.
2. **Œuf Céleste.** À l'éclosion : chercher un Drakon Adulte dans le deck, puis dans le cimetière. S'il n'y en a aucun, repli sur un Jeune, puis un Bébé. L'œuf n'est plus perdu sans contrepartie.
3. **Module Bluetooth .v2 sur Noyau Beta.** Le texte promet « à l'équipement, 600 dégâts à tous les monstres adverses » ; le déclencheur `ON_PLAY` d'un effet d'équipement ne semble pas résolu. Vérifier par test, corriger le moteur.
4. **Mise à jour .patch sans effet.** Tester `RESET_TURN_COUNTER` contre un Zeta implanté chez l'adversaire.
5. **Double destruction avec DuplicateX.** Hypothèse : la copie partage un `instanceId` ou une référence avec l'original. La copie doit être un clone profond avec son propre identifiant.

Hors périmètre : le Noyau Zeta posé chez l'adversaire reste attaquable (comportement voulu).

## Partie 2 — Moteur

- **`ChargeMode.CYCLIC`** (enum déjà présent dans `@pipou/shared`, non implémenté). Dans `fights/helpers/charges.ts`, à `chargeMax` : exécuter `ON_CHARGED`, remettre le compteur à 0, laisser la carte sur sa case. `ONE_SHOT` inchangé (cimetière).
- **Nouvelles actions** dans `@pipou/shared` (enum, schéma `effect-schema.ts`, tests) puis dans `effect-actions.applier.ts` et `supported-effects.ts` :
  - `GRANT_EXTRA_ATTACK_THIS_TURN` : tous les monstres alliés peuvent attaquer une fois de plus ce tour.
  - `TRANSFER_HALF_ATK` : retire la moitié de l'ATK d'un monstre choisi (allié ou adverse) pendant 1 tour et l'ajoute à un Noyau allié choisi pour 1 tour.
  - `FORCE_EVOLVE` : un Drakon allié choisi évolue au stade suivant, sans carte en main ni dans le deck ; l'instance est créée depuis le catalogue. Si l'évolution a plusieurs branches, le joueur choisit.
- **Condition** « un Général Chatouille est sur le terrain », évaluée au début de tour pour détruire Alerte générale si elle devient fausse.

## Partie 3 — Nouvelles cartes

Ajoutées par une migration de patch, sur le modèle de `balance-2026-10-patches.ts`. Elles ne touchent jamais une carte modifiée à la main (même garde que `planBalancePatch`).

| Carte | Archétype | Rareté | Charge | Mode | Effet à la charge |
|---|---|---|---|---|---|
| Alerte générale | pipou | légendaire | 3 tours | ONE_SHOT | Les monstres alliés attaquent 2 fois ce tour. Détruite si plus aucun Général Chatouille sur le terrain. |
| Extraction de données | pixelman | épique | 2 tours | CYCLIC | Prend la moitié de l'ATK d'un monstre au choix et la donne à un Noyau allié au choix pour 1 tour. |
| Méditation céleste | dragon | épique | 3 tours | ONE_SHOT | Un Drakon allié choisi évolue, sans avoir la carte dans la main ni le deck. |

« Unique » signifie ici ONE_SHOT : la carte part au cimetière après son effet. Les copies en deck ne sont pas limitées. Les trois cartes sont des supports : coût 0, comme les autres supports du catalogue.

L'IA reçoit des entrées minimales pour pouvoir jouer ces cartes.

## Tests et vérification

- Un spec par bug et par carte dans `apps/backend/src/fights/engine/`, avec `realCard` pour les cartes réelles.
- Spec de cohérence du schéma d'effets (`effect-schema.test.ts`, `effects-coverage.spec.ts`) mis à jour pour les nouvelles actions.
- `pnpm build:shared`, puis `pnpm typecheck && pnpm test && pnpm lint`.
- Migration jouée uniquement sur la base locale (`cardcollect_dev`), jamais sur Aiven. La prod la reçoit via la CI.
