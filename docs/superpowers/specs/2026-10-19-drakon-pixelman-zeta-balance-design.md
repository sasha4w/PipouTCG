# Rééquilibrage Drakon, Pixelman et Zeta — conception

Date : 2026-10-19

## Pourquoi

Une simulation IA contre IA (15 IA de l'aventure, 1 050 parties, vrais decks de la base locale, vrai moteur) a donné :

- **Pipou** est l'archétype de référence : il bat Drakon 77 % du temps et Pixelman 64 %.
- **Drakon** est le plus faible. Ses niveaux 1 à 4 plafonnent entre 28 et 36 % de victoires, sans progression. Seul le boss (Gardien de l'Œuf Céleste, 56 %) se détache. Ses œufs (300 PV) meurent en un coup et offrent une Prime à l'adversaire.
- **Pixelman** est cassé au niveau 3 : Noyau Zeta est la pire IA du jeu (12 %). Zeta (0 ATK / 400 PV, coût 2) se pose dans une case de l'adversaire, qui le **contrôle** ensuite (`summon.service.ts`, seul `ownerUserId` retient le poseur). Il ne fait rien pour son poseur pendant 3 tours, et l'hôte peut s'en servir comme d'un monstre à lui (le mettre en Garde, attaquer avec). Bilan : une carte chère qui n'apporte presque rien.
- Plusieurs supports Pixelman, écrits par un ancien prompt, n'ont pas de sens (stats affichées qui ne s'appliquent pas, carte sans effet utile, carte trop forte sans condition).

Le joueur veut que **Drakon gagne en régularité et en survie**, que les œufs deviennent une pièce importante du deck, que **Pixelman tourne vraiment autour des Noyaux** avec de quoi récupérer ses monstres, et que **Zeta devienne un « virus »** : une stratégie volontairement toxique qui étouffe l'adversaire.

## Objectifs

- Drakon remonte au niveau de Pixelman, et ses niveaux d'aventure montent en difficulté.
- Les œufs survivent 2 à 3 attaques d'un monstre adverse courant, et ce qui en sort peut évoluer tout de suite.
- Chaque support Pixelman a un rôle lisible au service des Noyaux. Ce qui est imprimé sur une carte est vrai.
- Zeta est une menace que l'adversaire doit gérer, plus un cadeau.

## Non-objectifs

- Pas de changement à Pipou.
- Pas de terrain Pixelman.
- Pas de refonte du système de Primes ni de l'évolution en dehors de ce qui est décrit.

## Anti-objectifs

- Zeta ne doit pas verrouiller une partie sans issue : un seul Zeta à la fois chez l'adversaire, et des contres existent (immunité aux malus, destruction directe).
- DuplicateX ne doit pas créer un deuxième Noyau surpuissant qui frappe immédiatement.
- Le buff Drakon ne doit pas seulement exister pour un humain : l'IA doit savoir s'en servir, sinon les simulations et l'aventure n'en profitent pas.

## Contexte technique

- Les cartes vivent en base MySQL (`card`). Les changements de cartes passent par des fichiers de patch versionnés et une migration TypeORM, sur le modèle de `apps/backend/src/database/drakon-set-patches.ts` et `card-effect-patches.ts` (avant/après, nouvelles cartes). Jamais d'édition directe sur Aiven.
- Les effets sont du JSON `{ trigger, condition, actions[] }`. Les types (`ActionType`, `EffectTrigger`, `EffectTarget`, `EffectConditionType`) vivent dans `@pipou/shared` (`packages/shared/src/enums/effect.ts`). Toute nouvelle action y est ajoutée, puis déclarée dans `apps/backend/src/fights/engine/supported-effects.ts`, appliquée dans `effects/effect-actions.applier.ts`, et rédigée pour le joueur dans `apps/frontend/src/features/fight/effectText.ts` (+ i18n fr/en/ko).
- Le moteur n'applique jamais l'ATK/PV imprimés d'un support : seuls ses effets comptent (`buffs-calculator.service.ts`).
- L'éclosion se fait en début de tour (`phase.service.ts` → `helpers/hatching.ts`). Le monstre éclos arrive via un choix `summon_to_zone`. La règle « attendre un tour avant d'évoluer » est `canEvolveNow` dans `packages/shared/src/game/rules.ts` (`summonedThisTurn`, `instantEvolution`, `canEvolveThisTurn`).
- Le compte à rebours de Zeta est `processTurnCounters` dans `phase.service.ts`. Les Primes de combat sont dans `battle.service.ts` (`gainPrime`).
- L'IA : `apps/backend/src/fights/ai/` (`candidate-actions.ts`, `evaluate.ts`, `ai-player.ts`). Elle ne regarde qu'un coup à l'avance.

## Volet 1 — Drakon

### Œufs (PV)

| Carte | Avant | Après |
|---|---|---|
| Œuf de la Genèse (id 4) | 300 PV | **900 PV** |
| Œuf de la Dualité (id 134) | 300 PV | **900 PV** |
| Œuf Céleste (id 135) | 600 PV | **1500 PV** |

Repère : un monstre Pipou courant en début de partie frappe entre 300 et 500 ATK avec ses buffs.

### Évolution le tour même pour ce qui sort d'un œuf

Tout Drakon qui arrive **depuis un œuf** peut évoluer pendant le tour où il arrive :

- le monstre choisi à l'**éclosion** (Bébé pour Genèse/Dualité ; Adulte pour Céleste, donc sans effet pratique) ;
- le Jeune invoqué par la **mort de l'Œuf de la Dualité** (`SUMMON_FROM_DECK`). Cela ne change quelque chose que si l'œuf meurt pendant le tour de son propriétaire.

Le coût d'évolution ne change pas. Le monstre qui vient d'évoluer suit la règle normale (pas de réévolution le même tour, sauf effets existants comme Tempestu).

### Nouvelles cartes

**Mont Drakon** — Terrain, coût 0, rareté épique, archétype `dragon`, set Drakon.
Au début de chacun de tes tours, tu choisis : **un monstre Drakon de ton deck** ou **un monstre Drakon de ton cimetière**. La carte va dans ta main.
- Le choix « Deck / Cimetière » précède la fenêtre habituelle de sélection de carte. Une source vide est grisée. Si les deux sont vides, rien ne se passe (ligne de log).
- Ce n'est pas l'action existante `RETURN_FROM_GRAVEYARD_OR_DECK` (une seule liste mélangée), à moins que le constructeur constate qu'elle offre déjà ce choix en deux temps.

**Appel des ancêtres** — Éphémère, coût 0, rareté rare, archétype `dragon`, set Drakon.
Récupère **2 cartes Drakon** de ton cimetière (monstres ou supports), qui vont dans ta main. S'appuie sur `RETURN_FROM_GRAVEYARD` avec `value: 2` et un filtre d'archétype.

### Supports existants

Incubation Rapide (115), Écaille de Dragon (116) et Souffle Primordial (117) passent à **coût 0**. Écaille de Dragon affiche **0 PV** (voir la règle des stats affichées, volet 2).

## Volet 2 — Pixelman

Ligne directrice : le deck tourne autour des Noyaux. Les petits monstres et les supports servent à les trouver, les protéger et les renforcer.

### Règle : ce qui est imprimé est vrai

| Carte | Changement |
|---|---|
| Module de Réparation .exe (95) | Garde 400 PV imprimés et **les donne vraiment** (+400 PV au porteur), en plus du soin de 200 par tour. |
| Firewall .sys (98) | PV imprimés à **0** (l'effet reste la réduction de dégâts). |
| Surcharge Overclock (101) | ATK imprimée à **0** (l'effet reste +500 ATK temporaire). |
| Écaille de Dragon (116) | PV imprimés à **0**. |

Processeur de Calcul et Canon à Particules sont déjà cohérents.

### Corrections

- **Force Delta (3)** : ne peut être jouée que si tu contrôles un **Noyau Delta** (condition `SPECIFIC_CARD_ON_BOARD`). Effet inchangé.
- **Formatage .exe (124)** : détruit un de tes monstres, **puis récupère un monstre Pixelman de ton cimetière** dans ta main. Le monstre détruit déclenche normalement son effet de mort (les petits monstres cherchent un Noyau).

### Nouvelles cartes

**Restauration .bak** — Éphémère, coût 0, rareté rare, archétype `pixelman`, set SquareWorld.
Récupère **un Noyau** depuis ton cimetière ou ton deck, dans ta main.

**DuplicateX** — Éphémère, coût 0, rareté légendaire, archétype `pixelman`, set SquareWorld.
Crée dans une de tes cases libres une **copie d'un de tes monstres**, avec des copies de ses équipements.
- La copie reprend les **PV actuels** de l'original, pas ses PV pleins, et ses stats et effets.
- Son effet « à l'invocation » se déclenche.
- Elle **ne peut pas attaquer pendant 2 de tes tours** : celui de son arrivée et le suivant. Elle peut défendre (et garder Provocation).
- Si elle meurt, elle donne une Prime comme tout monstre. Elle n'est pas une vraie carte : elle disparaît, ainsi que ses copies d'équipements, sans aller au cimetière.
- Sans case libre ou sans monstre allié, la carte ne peut pas être jouée.

## Volet 3 — Noyau Zeta (« virus »)

Intention : Zeta infecte le terrain adverse, l'affaiblit, et explose. L'adversaire doit payer pour s'en débarrasser.

**Contrôle et retrait de Zeta** (décidé avec le joueur) :
- Zeta occupe une case de l'hôte (l'adversaire du poseur), mais l'hôte **ne peut rien faire avec** : pas d'attaque avec Zeta, pas de changement de mode, pas de paiement ni de sacrifice avec lui.
- **Désinfecter** : nouvelle action de combat. L'hôte peut attaquer le Zeta posé chez lui avec un de ses monstres. Cela consomme l'attaque de ce monstre pour le tour, sans riposte (Zeta a 0 ATK) et **sans Prime pour personne**. Il faut l'exposer au front (cible d'attaque sur son propre terrain) et à l'IA (candidat d'action).
- Le poseur ne peut pas attaquer son propre Zeta.
- Les effets de destruction ou de renvoi restent un moyen de l'enlever, toujours sans Prime.

**Noyau Zeta (122)** :
- **0 ATK / 1200 PV**, coût 2, toujours posable chez l'adversaire (inchangé).
- **Un seul Zeta à la fois** sur un même terrain adverse : impossible d'en poser un second tant que le premier est là.
- **Virus** (passif) : tant qu'il est chez l'adversaire, **tous les monstres adverses perdent 300 ATK**. Les monstres immunisés aux malus (ex. Adulte Teros) n'en souffrent pas. L'ATK ne descend pas sous 0.
- **Le tuer ne rapporte pas de Prime** à celui qui le tue, quel que soit le moyen.
- **Explosion** (compteur de 3 de tes tours, inchangé) : tu gagnes une Prime **et** Zeta inflige **500 dégâts à tous les monstres adverses**.

**Supports de protection** :
- **Firewall de Surcharge .sys (128)**, nouvelle ligne Zeta : à la pose de l'équipement sur Zeta, il ne peut pas être désinfecté (attaqué) jusqu'au début de ton prochain tour. L'effet ne se renouvelle pas chaque tour : il se déclenche une fois, à la pose.
- **Module Bluetooth .v2 (127)**, nouvelle ligne Zeta : équipé sur Zeta, le malus passe à **−600 ATK**.
- Ces deux lignes supposent qu'on puisse équiper un monstre qu'on a posé chez l'adversaire. Si le moteur ne le permet pas, il faut l'ajouter (pour ces équipements au moins).
- **Mise à jour .patch** — nouvel éphémère, coût 0, rareté rare, archétype `pixelman`, set SquareWorld : remet le compteur de ton Zeta à 3.

## Decks des IA de l'aventure

Les decks des 15 IA sont en base, et `adventure.seeder.ts` ne recrée pas les mondes existants : sans migration, les nouvelles cartes n'atteignent aucune IA. Décidé avec le joueur :
- Une migration ajoute les nouvelles cartes aux decks Drakon et Pixelman, **de plus en plus fournis à mesure que le niveau monte**. C'est le levier principal pour que les niveaux Drakon montent en difficulté.
- Repères : Mont Drakon et Appel des ancêtres à partir du niveau 3 de Drakon ; le Zeta virus et ses supports (Firewall de Surcharge, Module Bluetooth, Mise à jour .patch) dans le deck de Noyau Zeta (Pixelman niveau 3) ; Restauration .bak et DuplicateX dans les niveaux hauts et le boss Pixelman. Le dosage exact est laissé au constructeur.
- Seuls les decks des IA changent : la progression des joueurs n'est pas touchée. La migration s'applique aussi en production.

## IA

- Doit utiliser le Mont Drakon (choisir deck ou cimetière de façon sensée) et faire évoluer un monstre sorti d'un œuf le tour même quand c'est rentable.
- Doit savoir poser Zeta chez l'adversaire, protéger Zeta avec ses supports, jouer DuplicateX, Restauration .bak, Formatage .exe et Mise à jour .patch.
- Côté hôte de Zeta : savoir le désinfecter quand le virus coûte plus cher que l'attaque perdue.

## Vérification

- Tests unitaires du moteur pour chaque nouvelle règle et chaque nouvelle action (pattern `fights/testing/scenario.ts`).
- **Simulation avant/après** : rejouer le tournoi IA contre IA (15 IA, chaque paire 10 fois, 5 de chaque côté) avant et après, et comparer les taux par archétype et par niveau. Le script qui a produit les chiffres ci-dessus n'est pas dans le dépôt : il faut le recréer (et le garder, par ex. sous `apps/backend/scripts/`).

### Critère de réussite (décidé avec le joueur)

- Chaque archétype gagne **entre 40 et 60 %** de ses parties contre les autres archétypes.
- Dans chaque monde, les taux de victoire **montent avec le niveau**, boss en tête.
- Si la simulation « après » rate ces cibles, le constructeur ajuste les valeurs chiffrées (PV des œufs et de Zeta, virus, explosion…) puis **montre au joueur les changements et les nouveaux résultats avant de livrer**.

## Laissé au constructeur

- Noms internes des nouvelles actions, conditions et champs d'état.
- Rédaction exacte des textes d'effet (fr/en/ko), dans le ton des cartes existantes.
- Images des nouvelles cartes : placeholder en attendant celles du joueur.
- Découpage en migrations.
