# Retravail des cartes PipouSquad et SquareWorld — design

Date : 2026-10-17 · Branche : `card-rework` (depuis `duel-animations`)

## Objectif

Corriger les effets qui ne font pas ce que la carte annonce, donner un effet aux cartes PipouSquad qui n'en ont pas,
remplacer les bonus d'équipement inutiles et nettoyer les textes, sur les sets **PipouSquad** (set 1) et
**SquareWorld** (set 2). Les changements partent en prod par une migration de données appliquée au démarrage.

## Hors périmètre

- Set **Drakon** (set 3 : Œuf, lignées Bébé/Jeune/Adulte, 6 supports) : sous-projet B, spec séparée.
- Équilibrage des cartes non citées ici.
- Traduction des descriptions de cartes (elles restent en français en base, comme aujourd'hui).

## Décisions

| Sujet | Choix |
|---|---|
| Maître Magouille | Insensible à **tout effet d'une carte adverse** ; le combat le blesse normalement ; les effets de son camp s'appliquent |
| Soin d'urgence | Valeurs fixes conservées (600, +200 avec Médecin) ; description réécrite |
| Ouille au rapport | 2 cartes ; 3 si une carte dont le nom contient « Capitaine » est en jeu ; un seul choix |
| Noyau Omega | Effet inchangé (tous les Pixelman alliés) ; description corrigée |
| Module d'Extension .v2 | Renommé **Module Bluetooth .v2** ; Alpha : 2 attaques/tour · Beta : 600 dégâts à l'équipement (une fois) · Delta : +600 ATK |
| Firewall de Surcharge .sys | Alpha : immunisé aux dégâts de combat jusqu'au prochain tour de son propriétaire · Beta : non destructible par une carte Support (les dégâts de support passent) · Delta : ignore la Provocation |
| Cartes PipouSquad sans effet | 6 effets simples (tableau plus bas) |
| Architecture | Mécaniques génériques dans le moteur (pas de code par carte) + migration de données |
| Ciblage des cartes dans la migration | Par **nom** (pas par id : export prod sans id, base locale différente), avec vérification de l'état attendu |

## Mécaniques moteur

### 1. Immunité aux effets adverses (`SET_DEBUFF_IMMUNITY`, sémantique élargie)

- L'action existante pose déjà `isImmuneToDebuffs` sur le monstre. Désormais, ce drapeau signifie : **aucun effet
  d'une carte adverse ne peut le viser**.
- Mise en œuvre centrale dans `effects/effect-targets.resolver.ts` : pour les cibles côté adverse (`ALL_ENEMIES`,
  `ENEMY_MONSTER`), les monstres `isImmuneToDebuffs` sont retirés. Toutes les actions passent par ce résolveur :
  dégâts, destruction, renvoi en main, forçage de mode, gel, verrou, bonus temporaires.
- Éphémère à cible adverse choisie (`ENEMY_MONSTER`) : `support.service` refuse un monstre immunisé
  (« Ce monstre est insensible aux effets adverses ») et, si tous les monstres adverses sont immunisés, la carte est
  injouable comme quand il n'y a aucune cible.
- `ephemeralTargetSide` / la liste de cibles du front (`FightBoard.openTargetPick`) excluent les monstres immunisés ;
  la barre d'action désactive « Jouer » s'il ne reste aucune cible.
- Le combat n'est pas concerné. Les effets de son propre camp (soins, bonus, Formatage…) s'appliquent.
- La règle actuelle « un bonus d'ATK temporaire négatif est ignoré » reste vraie (elle devient un cas particulier).

### 2. Quantité conditionnelle (`valueIf`)

- `EffectAction` (dans `@pipou/shared`) gagne un champ optionnel
  `valueIf?: { condition: EffectCondition; value: number }`.
- Résolution : si la condition est remplie (évaluée avec `checkCondition`, mêmes règles que les conditions d'effet),
  `valueIf.value` remplace `value` ; sinon `value` s'applique.
- Utilisé par Ouille au rapport (`RETURN_FROM_GRAVEYARD`, 2 ou 3). Utilisable par toute action à quantité.
- Le texte d'effet du front l'affiche : « Récupère 2 cartes (3 si … en jeu) ».

### 3. `SET_COMBAT_IMMUNITY` (nouvelle action)

- Pose sur la cible un drapeau « immunisé aux dégâts de combat jusqu'au début du prochain tour de son propriétaire ».
- `battle.service` : un monstre immunisé ne subit aucun dégât de combat, qu'il attaque (pas de riposte subie) ou qu'il
  soit attaqué.
- Le drapeau est retiré au début du tour de son propriétaire (`phase.service.startTurn`).
- Exposé au client (`MonsterOnBoard.combatImmune?: boolean`) pour l'afficher dans les statuts de la zone.

### 4. `SET_SUPPORT_DESTROY_IMMUNITY` (nouvelle action, passive)

- Drapeau recalculé avec les passifs (`buffs-calculator`) : `MonsterOnBoard.supportDestroyImmune`.
- Le rappel de destruction d'`applyActions` distingue la **destruction directe** (`DESTROY_MONSTER`) des **dégâts
  mortels** (`DEAL_DAMAGE`). Une destruction directe venant d'une carte Support (Éphémère, Équipement, Terrain) ne
  détruit pas un monstre protégé (journal : « X résiste à la destruction »). Les dégâts mortels le détruisent.

### 5. `IGNORE_TAUNT` (nouvelle action, passive)

- Drapeau recalculé avec les passifs : `MonsterOnBoard.ignoresTaunt`.
- `battle.service` : un attaquant `ignoresTaunt` peut viser n'importe quel monstre adverse malgré une Provocation.
- Front : le plateau laisse choisir n'importe quelle cible à cet attaquant ; statut affiché dans la zone.

### Partagé et front

- `ActionType` gagne `SET_COMBAT_IMMUNITY`, `SET_SUPPORT_DESTROY_IMMUNITY`, `IGNORE_TAUNT` ; ajoutés à
  `SUPPORTED_ACTIONS` (le test de couverture l'exige).
- `MonsterOnBoard` gagne `combatImmune?`, `supportDestroyImmune?`, `ignoresTaunt?`.
- `effectText.ts` + i18n fr/en/ko : textes des 3 actions, du `valueIf` et du nouveau sens de l'immunité
  (« Insensible aux effets adverses »). `zoneRow.effects.ts` : statuts des 3 drapeaux.
- Admin d'édition de cartes : les nouvelles actions apparaissent dans les listes déroulantes si celles-ci sont
  construites depuis `ActionType` (à vérifier au plan ; sinon les ajouter).

## Données : nouvelles valeurs des cartes

Notation des effets : `TRIGGER → ACTION valeur CIBLE [condition]`.

### Effets modifiés

| Carte (nom actuel) | Nouveaux effets |
|---|---|
| Ouille au rapport | `ON_PLAY → RETURN_FROM_GRAVEYARD 2 PLAYER` filtre {archetype pipou, rarities common/uncommon}, `valueIf { SPECIFIC_CARD_ON_BOARD "Capitaine" match contains → 3 }` |
| Module d'Extension .v2 → **Module Bluetooth .v2** | `PASSIVE → SET_ATTACKS_PER_TURN 2 SELF [EQUIPPED_ON Noyau Alpha]` · `ON_PLAY → DEAL_DAMAGE 600 ALL_ENEMIES [EQUIPPED_ON Noyau Beta]` · `PASSIVE → BUFF_ATK 600 SELF [EQUIPPED_ON Noyau Delta]` |
| Firewall de Surcharge .sys | `ON_PLAY → SET_COMBAT_IMMUNITY SELF [EQUIPPED_ON Noyau Alpha]` · `PASSIVE → SET_SUPPORT_DESTROY_IMMUNITY SELF [EQUIPPED_ON Noyau Beta]` · `PASSIVE → IGNORE_TAUNT SELF [EQUIPPED_ON Noyau Delta]` |
| Recrue Andouille | `ON_SUMMON → FORCE_ATTACK_MODE SELF` · `ON_BATTLE_PHASE_START → BUFF_ATK_TEMP 200 SELF` |
| Éclaireur Nouille | `ON_SUMMON → DRAW 1 PLAYER` |
| Guerrier Bafouille | `ON_ATTACK → BUFF_ATK_TEMP 100 SELF` |
| Canouille le Bleu | `ON_SUMMON → DEAL_DAMAGE 100 ALL_ENEMIES` |
| Sentinelle Gargouille | `ON_SUMMON → SET_TAUNT SELF` |
| Caporal Gazouille | `PASSIVE → BUFF_ATK 100 ADJACENT_ALLIES` |

Maître Magouille garde `ON_SUMMON → SET_DEBUFF_IMMUNITY SELF` : seule la sémantique moteur change.

### Noms

| Avant | Après |
|---|---|
| `Module d'Extension .v2` | `Module Bluetooth .v2` |
| `Noyau Alpha ` (espace final) | `Noyau Alpha` |
| `Sorcier Ratatouille ` (espace final) | `Sorcier Ratatouille` |

### Descriptions

| Carte | Nouvelle description |
|---|---|
| Capitaine Gribouille | Leader de la Brigade Ouille, reconnu pour sa noble manie de protéger son prochain. |
| Lieutenant Fripouille | Rival de Bidouille depuis leur entrée dans la PipouSquad : ils sont comme chien et chat. |
| Commandant Quenouille | Paresseux, à son poste malgré lui : jamais en avance, jamais en retard. Si on a vraiment besoin de lui, il vient. |
| Maître Magouille | Membre fondateur de la PipouSquad, ne se présente qu'en de rares occasions. Insensible aux effets des cartes adverses. |
| Médecin Citrouille | Un peu fou sur les bords, il sait exploiter tout le potentiel de la médecine végétale. |
| Soin d'urgence | Soigne un de vos monstres de 600 PV, ou de 800 PV si Médecin Citrouille est sur le terrain. |
| Ouille au rapport | Récupère jusqu'à 2 Ouilles communs ou peu communs de votre cimetière, ou 3 si un Capitaine est sur le terrain. |
| Vice Capitaine Patouille | Fidèle second du Capitaine. À sa destruction, récupère Capitaine Gribouille depuis votre cimetière ou votre deck. |
| Tactique Gang Gang | La stratégie de groupe signée Ouille. Tous vos monstres gagnent +300 ATK. |
| Recrue Andouille | Tête brûlée de la Brigade Ouille, plus préoccupé par son allure que par sa santé. Toujours en mode Attaque, +200 ATK au début de chaque phase de combat. |
| Éclaireur Nouille | Sa curiosité l'a poussé à s'engager dans la Brigade Ouille. À son arrivée, pioche une carte. |
| Guerrier Bafouille | Fonce dans la mêlée sans réfléchir. +100 ATK quand il attaque. |
| Canouille le Bleu | L'artilleur de la brigade. À son arrivée, inflige 100 dégâts à tous les monstres adverses. |
| Sentinelle Gargouille | Veille sur la brigade sans jamais ciller. Provocation. |
| Caporal Gazouille | Expert en communication de la brigade. Donne +100 ATK aux alliés adjacents. |
| Noyau Omega | Le cerveau du réseau. Donne en permanence +300 ATK et +300 PV à tous les Pixelman alliés. |
| Module Bluetooth .v2 | Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK. |
| Firewall de Surcharge .sys | Sur Alpha : à l'équipement, insensible aux dégâts de combat jusqu'à votre prochain tour. Sur Beta : ne peut pas être détruit par une carte Support. Sur Delta : ignore la Provocation. |

## Migration `CardRework`

- Nouveau fichier de patchs `apps/backend/src/database/card-rework-patches.ts`, au format élargi :
  `{ name, before: { name, description, effects }, after: { name, description, effects } }` (champ absent = inchangé).
- Chaque patch retrouve la carte par son **nom actuel** (`before.name`, comparaison exacte en base). Il ne s'applique
  que si `effects` et `description` actuels sont identiques à `before` (même règle que `planPatch` : égalité JSON
  structurelle). Sinon : journal « carte modifiée depuis l'export, non touchée — à corriger via l'admin ».
- Les valeurs `before` sont celles de l'export de prod du 2026-10-17 (`card_202610171125.sql`).
- `down` : applique les patchs en sens inverse avec la même vérification.
- `fights/testing/real-cards.ts` applique aussi ces patchs, pour que les tests sur cartes réelles voient les nouvelles
  valeurs.
- Base locale (`cardcollect_dev`, migrations non suivies) : patchs rejoués par script, comme pour `GenericCardEffects`.

## Tests

- **Moteur** (Jest, specs existantes de `fights/engine`) :
  - Magouille : Force Delta (refusé), Rootkit, Gel, Verrou, burn de Beta, 600 du Module Bluetooth ne l'affectent pas ;
    il subit la riposte au combat ; Soin d'urgence de son camp le soigne.
  - Ouille au rapport : choix de 2 cartes ; 3 avec Capitaine Gribouille ; 3 avec Vice Capitaine Patouille.
  - Firewall/Alpha : aucun dégât de combat (attaque et riposte) jusqu'au début de son tour suivant, puis vulnérable.
  - Firewall/Beta : Force Delta et Formatage n'ont pas d'effet ; un `DEAL_DAMAGE` mortel d'un support le détruit.
  - Firewall/Delta : attaque une cible sans Provocation malgré une Provocation adverse.
  - Module Bluetooth : Alpha attaque 2 fois ; Beta inflige 600 à l'équipement, une seule fois.
  - Les 6 cartes PipouSquad.
  - `valueIf` : condition vraie / fausse.
- **Couverture** : `effects-coverage.spec.ts` couvre les 3 nouvelles actions.
- **Migration** : patch appliqué quand l'état est l'attendu ; ignoré si la carte a divergé ; `down` restaure.
- **Front** (Vitest) : textes d'effets des 3 actions et du `valueIf` ; cibles d'Éphémère excluant un monstre immunisé ;
  statuts de zone des 3 drapeaux.
- **Visuel** : sandbox local (base Docker), captures Playwright 430 px des cartes modifiées en jeu.
