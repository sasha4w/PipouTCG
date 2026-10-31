# Immunités de monstre — design

Date : 2026-10-30. Branche : `feat/fight-status-fx` (suite des VFX de statut).

## Objectif

Remplacer l'immunité unique « tout effet adverse » (`isImmuneToDebuffs`) et les deux immunités isolées (`combatImmune`, `supportDestroyImmune`) par **six immunités cumulables**, visibles en combat.

## Les six immunités

Enum `Immunity` dans `@pipou/shared` (`packages/shared/src/game/`) :

| Valeur | Règle moteur |
|---|---|
| `COMBAT_DAMAGE` | aucun dégât de combat (ex-`combatImmune`) |
| `COMBAT_DESTRUCTION` | prend les dégâts de combat mais ses PV ne descendent pas sous 1 en combat. Un effet peut toujours le détruire s'il n'en est pas immunisé |
| `SUPPORT_DESTRUCTION` | un support adverse ne peut pas le détruire (ex-`supportDestroyImmune`) |
| `SUPPORT_DEBUFF` | aucune action négative d'un **support adverse** : gel, verrou de position, attaque forcée, dégâts, malus d'ATK, virus |
| `MONSTER_DEBUFF` | aucune action négative d'un **monstre adverse**, dégâts d'effet (`DEAL_DAMAGE`) et virus compris |
| `MONSTER_STATUS` | quand il attaque, ignore la provocation adverse et ne subit pas le renvoi de dégâts. Le virus d'un Zeta implanté ne l'affecte pas |

« Adverse » = la carte source appartient à l'autre joueur. Les effets alliés passent toujours.

## Modèle de données

- `MonsterOnBoard.immunities: Immunity[]` (état client, recalculé à chaque état par `buffs-calculator` = permanentes ∪ du tour ∪ passives).
- `perm.immunities: Immunity[]` pour la part permanente (ON_SUMMON / ON_PLAY), à la place de `perm.debuffImmune`.
- `turnImmunities: Immunity[]` pour `SET_COMBAT_IMMUNITY` (Bouclier de Fortune, Firewall sur Alpha) : vidé au début du tour du propriétaire, comme `combatImmune` aujourd'hui (`phase.service.ts:100`).
- Les champs `isImmuneToDebuffs`, `combatImmune`, `supportDestroyImmune` sont retirés de `MonsterOnBoard` ; tout le code passe par un helper `hasImmunity(monster, Immunity.X)` dans `@pipou/shared`.

## Actions

Une action par immunité (l'admin et le texte des effets travaillent par type d'action + valeur, pas par liste) :

| Action | Immunité |
|---|---|
| `SET_COMBAT_IMMUNITY` (existante) | `COMBAT_DAMAGE`, jusqu'au prochain tour du propriétaire |
| `SET_COMBAT_DESTRUCTION_IMMUNITY` (nouvelle) | `COMBAT_DESTRUCTION` |
| `SET_SUPPORT_DESTROY_IMMUNITY` (existante) | `SUPPORT_DESTRUCTION` |
| `SET_SUPPORT_DEBUFF_IMMUNITY` (nouvelle) | `SUPPORT_DEBUFF` |
| `SET_MONSTER_DEBUFF_IMMUNITY` (nouvelle) | `MONSTER_DEBUFF` |
| `SET_MONSTER_STATUS_IMMUNITY` (nouvelle) | `MONSTER_STATUS` |
| `SET_DEBUFF_IMMUNITY` (existante, « insensible aux effets adverses ») | les quatre immunités d'effets |

Une base pas encore migrée garde donc les mêmes règles. Table de correspondance : `IMMUNITIES_BY_ACTION` dans `@pipou/shared`.

## Application dans le moteur

- **Ciblage** (`effect-targets.resolver.ts`, `rules.ts`) : une action qui vise un monstre adverse est toujours négative (aucune carte ne buffe l'ennemi). `blocksEnemyAction(monster, sourceKind, actionType)` dans `@pipou/shared` : source support → `DESTROY_MONSTER` bloqué par `SUPPORT_DESTRUCTION`, toute autre action par `SUPPORT_DEBUFF` ; source monstre → bloqué par `MONSTER_DEBUFF`. La source est `support` si la carte qui porte l'effet est un Support (équipement compris), sinon `monster`.
- **Malus de valeur négative sur soi-même** (`BUFF_ATK_TEMP` négatif, applier l. 101) : bloqué par `SUPPORT_DEBUFF` ou `MONSTER_DEBUFF` selon la source, s'il vient de l'adversaire.
- **Combat** (`battle.service.ts`) : `COMBAT_DAMAGE` → 0 dégât ; `COMBAT_DESTRUCTION` → `currentHp = max(1, currentHp - dmg)` ; `MONSTER_STATUS` de l'attaquant → saute le filtre de provocation (l. 131) et le renvoi (l. 42).
- **Virus aura** (`buffs-calculator.service.ts:137`) : bloqué par `MONSTER_DEBUFF` si la source est un monstre (Zeta), `SUPPORT_DEBUFF` si support (Module Bluetooth).
- **IA** (`ai/evaluate.ts`) : lit `hasImmunity` à la place de `combatImmune`.
- **Sandbox** (`sandbox-setup.ts`) : le patch `debuffImmune` devient `immunities`.

## Répartition des cartes (migration de données)

| Carte | Immunités |
|---|---|
| Maître Magouille | `SUPPORT_DESTRUCTION`, `SUPPORT_DEBUFF`, `MONSTER_DEBUFF`, `MONSTER_STATUS` (destructible en combat) |
| Adulte Teros | `SUPPORT_DEBUFF`, `MONSTER_DEBUFF` |
| Ancestral Teros | `SUPPORT_DEBUFF`, `MONSTER_DEBUFF`, `SUPPORT_DESTRUCTION` |
| Drakon des Origines | les quatre immunités d'effets |
| Écaille de Dragon | `SUPPORT_DEBUFF`, `MONSTER_DEBUFF` sur le monstre équipé |
| Bouclier de Fortune | `COMBAT_DAMAGE` jusqu'au prochain tour (inchangé) |
| Firewall de Surcharge .sys | Alpha : `COMBAT_DAMAGE` jusqu'au prochain tour ; Beta : `SUPPORT_DESTRUCTION` passif (inchangé) |

Migration `1791000000017-Immunities.ts` : réécrit `card.effects` de ces cartes par nom (comme les patchs précédents, via `planPatch`), et met à jour les fichiers source des patchs (`card-rework-patches.ts`, `garde-2026-10-patches.ts`, `drakon-origines-cards.ts`, `drakon-set-patches.ts`, `balance-2026-10-patches.ts`) pour qu'un seed neuf donne le même résultat. Descriptions des cartes mises à jour (fr). `down` restaure les effets précédents.

## Front

- `statusFx.ts` : un `StatusFxId` par immunité, palette par famille — combat bleu (`combatShield`, `combatEndure`), support vert menthe (`supportDestroyImmune`, `supportDebuffImmune`), monstre doré (`monsterDebuffImmune`, `monsterStatusImmune`). Les quatre immunités d'effets réunies → une seule aura `immuneAll` (doré + vert) à la place des quatre.
- Fiche d'inspection (`zoneRow.effects.tsx`) : un mot-clé par immunité, traduit fr/en/ko.
- Texte des quatre nouvelles actions dans `effectText.ts` + i18n fr/en/ko ; l'admin les propose automatiquement (liste tirée de `ActionType`).
- SFX : toutes les immunités jouent `fight-immune.mp3`, sauf combat → `fight-shield.mp3`.

## Tests

- `@pipou/shared` : `hasImmunity`, `IMMUNITIES_BY_ACTION`, `blocksEnemyAction`.
- Backend (specs moteur existantes `card-rework-mechanics.spec.ts`, `origins-real-cards.spec.ts`) : chaque immunité bloque ce qu'elle doit et seulement ça (source monstre vs support, allié vs adverse) ; `COMBAT_DESTRUCTION` laisse à 1 PV ; Magouille meurt en combat mais pas par support ni par `DEAL_DAMAGE` d'un monstre ; Ancestral Teros encaisse `Formatage .exe` sans mourir.
- Migration : up/down sur la base de test e2e (jamais Aiven).
- Front : `statusFx.test.ts` (flags par immunité, `immuneAll`).

## Hors périmètre

Nouvelle carte avec `COMBAT_DESTRUCTION` ; équilibrage ; nouveaux sons.
