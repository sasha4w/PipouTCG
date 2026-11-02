# Rework des cartes Support — design

Date : 2026-11-02 · Statut : validé en brainstorming

## Problèmes

1. Les 3 zones support ne servent qu'aux Terrains, et plusieurs Terrains peuvent être actifs en même temps, ce qui est illogique.
2. Les équipements se cumulent sans limite, y compris plusieurs fois le même sur un même monstre.
3. Il manque un type de support pour dynamiser les parties.
4. La soumission de carte dans le panneau admin ne fonctionne pas.

Les supports Éphémères ne changent pas.

## Règles de jeu

### Persistant (remplace « Terrain »)
- Carte posée en zone support (3 cases) ; ses effets durent tant qu'elle n'est pas détruite.
- Un seul exemplaire d'une même carte en jeu par joueur (règle existante).
- Sous-famille **Terrain** (`is_terrain`) : un seul Terrain à la fois par joueur. En poser un nouveau **remplace** l'ancien (cimetière), après confirmation côté client. Le nouveau prend la case de l'ancien.
- Les Persistants non-Terrain se cumulent librement dans les cases libres.
- 3 cases pleines → pose refusée (sauf remplacement de Terrain).
- Tactique Gang Gang et Mont Drakon sont des Terrains.

### Équipement — emplacements
Chaque monstre a 4 emplacements :

| Emplacement | Capacité | Cartes actuelles |
|---|---|---|
| Offensif | 1 | Processeur de Calcul .bin, Canon à Particules .vxd, Module Bluetooth .v2 |
| Défensif | 1 | Firewall .sys, Firewall de Surcharge .sys, Écaille de Dragon |
| Accessoire | 2, pas deux fois le même | Module de Réparation .exe |

- Emplacement plein → **remplacement** : l'ancien part au cimetière, ses bonus disparaissent au recalcul des buffs. Le client demande confirmation (« Remplacer X ? ») ; pour l'Accessoire plein, le joueur choisit lequel remplacer.
- Équiper un accessoire déjà porté par ce monstre → refusé.
- Les cibles autorisées restent celles d'aujourd'hui (ses monstres hors implantés chez soi, ou ses monstres implantés chez l'adversaire).

### Charge (nouveau type de carte Support)
- Quatrième `SupportType`, au même niveau qu'Éphémère, Équipement et Persistant (carte de type `support`, `supportType = CHARGE`).
- Posée dans une case support libre, compteurs à 0.
- +1 compteur au début de chaque tour de son propriétaire.
- L'action `ADD_CHARGE_COUNTERS` permet aux effets d'en ajouter.
- Quand `chargeCounters >= charge_max` : le trigger `ON_CHARGED` se résout.
- Mode `charge_mode` : `ONE_SHOT` (puis cimetière) ou `CYCLIC` (remise à 0). **Seul `ONE_SHOT` est implémenté** ; `CYCLIC` existe dans le type, est refusé par le moteur et grisé dans l'admin.
- Destructible par les effets de destruction de support existants.

## Données

### `@pipou/shared`
- `SupportType` : `EPHEMERAL | EQUIPMENT | PERSISTENT | CHARGE` (`TERRAIN` disparaît).
- Nouveaux enums `EquipmentSlot` (`OFFENSIVE | DEFENSIVE | ACCESSORY`) et `ChargeMode` (`ONE_SHOT | CYCLIC`).
- `EffectTrigger.ON_CHARGED`, `ActionType.ADD_CHARGE_COUNTERS`.
- `ClientCard` : `equipmentSlot`, `isTerrain`, `chargeMax`, `chargeMode` (nullables).
- `CardInstance.chargeCounters?`.
- `CreateCardRequest` : mêmes champs, optionnels.
- `PlaySupportPayload.replaceInstanceId?`.
- Événements de jeu : `terrain_played` devient `support_placed` (pose d'un Persistant ou d'une Charge) ; ajout de `charge_progress` et `charge_triggered`.
- Helpers purs dans `game/support-rules.ts` : `equipSlotCapacity(slot)`, `canEquip(monster, card)` → `ok | slot_full (candidats) | duplicate`, `terrainToReplace(player, card)`. Utilisés par le back (validation) et le front (surbrillance, modale).

### Migration TypeORM (une seule)
1. Ajouter `PERSISTENT` et `CHARGE` à l'enum `support_type` ; ajouter les colonnes `equipment_slot`, `is_terrain` (défaut 0), `charge_max`, `charge_mode`.
2. `TERRAIN → PERSISTENT` avec `is_terrain = 1` (Tactique Gang Gang, Mont Drakon).
3. Renseigner `equipment_slot` des 7 équipements selon le tableau ci-dessus.
4. Retirer `TERRAIN` de l'enum.
5. `down` inverse.

Testée uniquement sur la base Docker locale `cardcollect_dev` (up → down → up). Jamais sur Aiven ; la prod reçoit la migration via la CI sur `main`. Le fichier `apps/backend/.e2e/cards-*.json` est mis à jour.

`MonsterOnBoard.equipments` reste un tableau : l'emplacement se lit sur `baseCard.equipmentSlot`. Les consommateurs actuels (buffs, IA, effets) n'ont pas à changer de forme.

## Moteur (backend)
- `support.service` : branches `PERSISTENT` (règle Terrain + remplacement), `EQUIPMENT` (`canEquip`, erreur `slot_full` sans `replaceInstanceId`), `CHARGE`.
- `phase.service` (début de tour) : parcours des Persistants au lieu des Terrains ; tic des Charges et déclenchement.
- `buffs-calculator.service` : `PERSISTENT` au lieu de `TERRAIN`.
- `effect-actions.applier` : `ADD_CHARGE_COUNTERS`.
- Sandbox (`sandbox-setup.ts`) : mêmes règles d'emplacements et de zones.

## Interface (frontend)
- **Équipements sur le plateau** : colonne de pastilles collée au bord droit de la carte monstre, une par emplacement occupé (rouge Offensif, bleu Défensif, vert Accessoire). Remplace les chips de `MonsterZoneContent.tsx`. `CardInspect` détaille les 4 emplacements, vides compris.
- **Charge** : le contour de l'illustration se remplit avec la progression, « n/max » en petit sous l'image. Animation au gain de compteur et au déclenchement.
- **Terrain** : petite icône SVG distinguant les Terrains des autres Persistants.
- **Jouer un équipement** : surbrillance des seuls monstres valides ; monstre qui porte déjà l'accessoire grisé ; modale beige de confirmation de remplacement (choix de l'accessoire si deux).
- **Jouer un Terrain** avec un Terrain déjà posé : même modale.
- **Persistant/Charge** avec 3 cases pleines : carte grisée en main avec raison.
- **Libellés** : « Persistant », « Terrain » (sous-famille), « Charge », « Offensif », « Défensif », « Accessoire » — collection, filtres, deck builder, textes d'effet, admin.
- Icônes SVG uniquement (`Icons.tsx`).

## Panneau admin
1. **D'abord** : diagnostiquer et corriger la soumission de carte cassée (`CardManager.tsx` ↔ `create-card.dto.ts` / `cards.service`), avec un test qui reproduit l'échec.
2. Formulaire de création et d'édition fonctionnel pour Monstre et Support, avec des champs qui dépendent du type : Équipement → emplacement ; Persistant → case Terrain ; Charge → charge max et mode (Cyclique grisé « bientôt »).
3. Validation DTO alignée (emplacement obligatoire pour un Équipement, `charge_max ≥ 1` pour une Charge, champs interdits ailleurs).
4. Test e2e de création par type.

## IA
- `candidate-actions` : n'équipe que des cibles valides ; remplacement seulement si `evaluate` y gagne ; pose Persistants/Charges ; ne remplace un Terrain que si c'est rentable.
- `evaluate` : valeur d'une Charge croissante avec sa progression ; détruire une Charge adverse proche du seuil est prioritaire.
- Mise à jour d'`archetype-profiles` et du générateur de decks d'aventure (Pixelman).

## Tests
- Shared : `canEquip`, `terrainToReplace`, enums.
- Moteur : emplacement plein → `slot_full` ; remplacement → ancien au cimetière, buffs recalculés ; doublon d'accessoire refusé ; Terrain remplace Terrain ; 4ᵉ carte en zone refusée ; Charge : tic, `ADD_CHARGE_COUNTERS`, `ON_CHARGED` puis cimetière, destruction avant seuil, `CYCLIC` refusé.
- Specs vraies cartes (`real-cards`, `card-rework-cards`) avec les emplacements.
- Migration sur `cardcollect_dev`.
- Front : modale de remplacement, pastilles, contour de charge ; capture Playwright 430px.

## Hors périmètre
- Mode `CYCLIC` des Charges (logique uniquement préparée).
- Création de nouvelles cartes Charge ou Accessoire (le design les rend possibles ; les cartes viendront via l'admin).
