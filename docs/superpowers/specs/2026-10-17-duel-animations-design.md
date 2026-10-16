# Animations de duel — design

Date : 2026-10-17 · Branche : `dev` (branche de feature à créer : `duel-animations`)

## Objectif

Rendre le duel plus vivant avec trois familles d'animations :

1. **Invocation** : effet différent selon la rareté du monstre invoqué (montée en intensité par paliers).
2. **Destruction** : effet différent selon la **cause** de la destruction (combat, effet, sacrifice, autodestruction,
   PV épuisés).
3. **Pose de terrain** : l'image du terrain passe en fond de la moitié de plateau du joueur qui l'a posé.

Plus un réglage « Animations : auto / complètes / réduites ».

## Périmètre

- Partagé : événements de duel structurés (`FightEvent`), cause de destruction (`DestroyCause`), ordre de pose des
  terrains (`placedSeq`).
- Backend : production des événements pendant la résolution d'une action, envoi avec `fight:state`.
- Frontend : lecture des événements, animations d'invocation et de destruction, fond de terrain, réglage animations.

## Hors périmètre

- Animations de sorts éphémères, d'équipement, de pioche, d'attaque directe (le format d'événement le permettra plus
  tard, rien n'est ajouté maintenant).
- Animations bloquantes : aucune action n'est gelée pendant une animation.
- Sons associés aux animations.
- Refonte des animations existantes hors destruction/invocation (flip de mode, dégâts, attaque restent telles quelles).

## Décisions

| Sujet | Choix |
|---|---|
| Destruction « selon la résolution » | Selon la **cause** : COMBAT, EFFECT, SACRIFICE, SELF_DESTRUCT, HP_DEPLETED |
| Invocation selon la rareté | 4 paliers : common/uncommon · rare/epic · legendary · secret |
| Plusieurs terrains en jeu | Le **dernier posé** sert de fond ; s'il part, on revient au précédent encore en jeu |
| Rythme | Non bloquant ; état appliqué immédiatement |
| Accessibilité | `prefers-reduced-motion` respecté + réglage in-app (auto / complètes / réduites) |
| Transport de la cause | Champ `events: FightEvent[]` dans `ClientGameState` (pas d'événement Socket séparé) |
| Technique d'animation | Keyframes CSS (comme l'existant), aucune nouvelle dépendance |

## Architecture et flux de données

### Partagé — `packages/shared/src/game/events.ts`

```ts
import type { Rarity } from "../enums/card";

export enum DestroyCause {
  COMBAT = "combat",
  EFFECT = "effect",
  SACRIFICE = "sacrifice",
  SELF_DESTRUCT = "self_destruct",
  HP_DEPLETED = "hp_depleted",
}

/** Événement public de duel, produit pendant la résolution d'une action. */
export type FightEvent =
  | { kind: "monster_summoned"; ownerId: number; zoneIndex: number; instanceId: string; rarity: Rarity }
  | { kind: "monster_destroyed"; ownerId: number; zoneIndex: number; instanceId: string; cause: DestroyCause }
  | { kind: "terrain_played"; ownerId: number; zoneIndex: number; instanceId: string };
```

- `ownerId` est le `userId` du propriétaire ; le front le compare à `me.userId` pour savoir de quel côté jouer
  l'animation.
- Exporté depuis `packages/shared/src/game/index.ts`.
- `ClientGameState` gagne `events: FightEvent[]` (toujours présent, éventuellement vide).
- `CardInstance` gagne `placedSeq?: number` : numéro d'ordre de pose, renseigné uniquement pour un terrain posé en zone
  Support.
- Aucune donnée cachée : les trois événements ne décrivent que des faits visibles par les deux joueurs.

### Backend — `apps/backend/src/fights/`

- `GameState` gagne `pendingEvents: FightEvent[]` (initialisé à `[]`) et `terrainSeq: number` (initialisé à `0`).
- Production des événements :
  - `services/summon.service.ts` : après placement du monstre → `monster_summoned` (rareté = `baseCard.rarity`).
  - `services/support.service.ts`, cas `TERRAIN` : `placedSeq = ++game.terrainSeq` sur l'instance posée, puis
    `terrain_played`.
  - `effects-resolver.service.ts` `destroyMonster(game, host, instanceId, log, { draw, cause })` : `cause` devient
    obligatoire ; l'événement `monster_destroyed` est poussé **avant** la résolution de ON_DEATH, pour que l'ordre des
    événements suive l'ordre des morts en chaîne. `zoneIndex` = index de la zone vidée.
- Cause passée par chaque appelant :

  | Appelant | Cause |
  |---|---|
  | `services/battle.service.ts` (combat) | `COMBAT` |
  | `engine/game-engine.ts` `reapDeadMonsters` (0 PV constaté après coup, ex. perte de bonus) | `HP_DEPLETED` |
  | `services/phase.service.ts` (compteur Zeta) | `SELF_DESTRUCT` |
  | rappel `destroy` des effets (`DESTROY_MONSTER`, dégâts mortels `DEAL_DAMAGE`), hôte ≠ propriétaire de l'effet | `EFFECT` |
  | même rappel, hôte = propriétaire de l'effet (son propre monstre ; déjà sans pioche) | `SACRIFICE` |

- Envoi : `helpers/client-state.builder.ts`
  - `buildClientState` recopie `game.pendingEvents` dans `events`.
  - `emitGameState` envoie aux deux joueurs **puis** vide `game.pendingEvents`. Les deux joueurs reçoivent donc
    exactement les mêmes événements.
  - Tout autre envoi d'état (reconnexion, resynchronisation) part avec le tampon déjà vidé → `events: []`, aucune
    animation rejouée.
  - Sandbox admin : `publish` vide aussi le tampon après `sandbox:state` ; `deserializeGame` initialise
    `pendingEvents = []` et `terrainSeq` pour les scénarios sauvegardés avant cette évolution.

### Frontend — `apps/frontend/src/features/fight/`

- `FightPage.tsx` reçoit l'état (`fight:state`) et le passe tel quel au plateau.
- Fonction pure `boardFxFromEvents(events, myUserId)` (`fight/fightEvents.ts`), appelée dans `FightBoard` via
  `useMemo` (état dérivé) : effets par côté (`me` / `opponent`), par rangée et par `zoneIndex` (`summonTier`,
  `destroyCause`, `terrainPlayed`), plus l'invocation la plus forte de l'action (flash/secousse).
- `Zonerow/useZoneAnimations.ts` consomme ces animations :
  - invocation : classe `zr-zone--summon-t{1..4}` selon le palier ;
  - destruction : l'instantané du monstre est conservé (comme aujourd'hui) et reçoit
    `zr-zone--destroy-{cause}` ; durée de conservation alignée sur la durée de la variante.
  - **Secours** : la comparaison d'états actuelle reste active. Un monstre apparu sans événement → palier de sa rareté ; un
    monstre disparu sans événement → éclatement par défaut (variante COMBAT).
- Nouvelle couche `FightFxLayer.tsx` : position absolue au-dessus du plateau, `pointer-events: none`, pour les effets
  qui débordent d'une zone (flash, secousse du plateau).

## Animations

Couleur de rareté passée via la variable CSS `--rarity-color` (déjà dérivée de `RARITY_COLOR`). Les keyframes vivent
dans `Zonerow/ZoneRow.css` (zones) et `FightFxLayer.css` (plein écran).

### Invocation par paliers

| Palier | Raretés | Effet | Durée |
|---|---|---|---|
| 1 | common, uncommon | Apparition actuelle (`zr-summon` : échelle + fondu) + lueur à la couleur de rareté | ~500 ms |
| 2 | rare, epic | Palier 1 + cercle d'énergie au sol + 8 à 12 particules montantes (pseudo-éléments) | ~800 ms |
| 3 | legendary | Palier 2 + faisceau vertical + flash bref sur `FightFxLayer` + légère secousse du plateau | ~1,2 s |
| 4 | secret | Palier 3 + bordure arc-en-ciel animée + balayage holographique prolongé (`zr-holo-sweep`) | ~1,5 s |

### Destruction selon la cause

| Cause | Effet | Durée |
|---|---|---|
| COMBAT | Éclatement actuel (`zr-shards` / `zr-shatter`) + impact rouge | ~900 ms |
| EFFECT | Dissolution violette : particules, flou et fondu vers le haut | ~900 ms |
| SACRIFICE | Lueur dorée puis repli de la carte vers le cimetière du propriétaire | ~800 ms |
| SELF_DESTRUCT | Clignotement rouge accéléré puis explosion (onde de choc circulaire) | ~1 s |
| HP_DEPLETED | Désaturation en gris puis effondrement (la carte s'affaisse et disparaît) | ~800 ms |

### Mode réduit

Plateau avec la classe `fb--reduced-motion` : pas de secousse, flash, particules ni balayage. Chaque animation devient
un fondu court (~250 ms) teinté de la couleur de rareté (invocation) ou de la cause (destruction), pour garder
l'information.

## Fond de terrain

- **Source** : calculé depuis l'**état**, pas depuis les événements, pour survivre à une reconnexion.
  `terrain_played` ne sert qu'à déclencher la transition.
- **Choix du terrain affiché** : fonction pure `pickActiveTerrain(supportZones)` (dans `fight/terrainBackground.ts`)
  → le terrain en jeu de plus grand `placedSeq`, ou `null` s'il n'y en a aucun. Un terrain sans `placedSeq` (cas
  impossible en pratique) passe après ceux qui en ont un.
- **Mise en page** : dans `FightBoard.tsx`, les deux rangées de chaque joueur (Monstres + Supports) sont enveloppées
  dans un conteneur `.fb-half` (`.fb-half--me` / `.fb-half--opponent`) avec un calque de fond `.fb-half__bg`
  positionné derrière les zones. Les cimetières restent à leur place actuelle.
- **Rendu du fond** : image `card.image.url` en `background-size: cover`, `filter: blur(6px) brightness(.45)`,
  opacité ~55 %, dégradé de fondu vers le centre du plateau. Sans image : dégradé à la couleur de rareté du terrain.
- **Transition de pose** : vague circulaire (`clip-path: circle()` animé, ~700 ms) dont le centre est la zone Support
  où le terrain a été posé ; l'ancien fond s'efface en fondu dessous. Changement de fond sans `terrain_played`
  (départ du terrain, reconnexion) : fondu croisé simple de 300 ms.
- **Mode réduit** : fondu croisé de 250 ms dans tous les cas.

## Réglage animations

- `apps/frontend/src/contexts/AnimationContext.tsx` (provider) + `animation-context.ts` (type et `createContext`),
  calqué sur le découpage `SoundContext.tsx` / `sound-context.ts` :
  - préférence `"auto" | "full" | "reduced"`, défaut `"auto"`, stockée en `localStorage` (clé `pipou_animations`, comme les clés `pipou_*` du son),
    lecture et écriture dans un `try/catch` (valeur par défaut si l'accès échoue) ;
  - expose `preference`, `setPreference` et `reduced: boolean` (`auto` → suit `prefers-reduced-motion`, écouté via
    `matchMedia` pour réagir à un changement système).
- Sélecteur à trois choix dans `pages/Settings.tsx`, à côté de `SoundSettings` ; libellés traduits fr/en/ko comme le
  reste de l'i18n.
- `FightBoard` lit `reduced` et pose `fb--reduced-motion`.

## Tests

### Backend (Jest, à côté des specs existantes de `fights/`)

- `destroyMonster` pousse `monster_destroyed` avec la bonne cause pour chaque appelant : combat, reap,
  compteur Zeta, effet sur un monstre adverse (EFFECT), effet sur son propre monstre (SACRIFICE).
- Plusieurs morts dans une même action (dont une mort déclenchée par ON_DEATH) → événements dans l'ordre de résolution.
- Invocation → `monster_summoned` avec la rareté de la carte.
- Pose de deux terrains → `terrain_played` ×2 et `placedSeq` strictement croissant.
- `emitGameState` envoie les mêmes `events` aux deux joueurs puis vide le tampon ; un envoi suivant sans action donne
  `events: []`.

### Frontend (Vitest)

- `boardFxFromEvents` : mappe correctement les événements vers côté + zone + variante (palier par rareté, cause).
- Secours de `useZoneAnimations` : disparition sans événement → variante COMBAT ; apparition sans événement → palier de la rareté.
- `pickActiveTerrain` : plus grand `placedSeq`, retour au précédent quand le dernier part, `null` si aucun terrain.
- `AnimationContext` : `auto` suit `matchMedia`, `full` / `reduced` forcent, `localStorage` qui lève une exception →
  défaut `auto` sans planter.

### Vérification visuelle

Captures Playwright du plateau (coque claire 430 px) avec environnement local (BDD Docker, jamais Aiven) : invocation
de chaque palier, au moins deux causes de destruction, fond de terrain des deux côtés, mode réduit.

## Découpage

1. Partagé + backend : `FightEvent`, `DestroyCause`, `placedSeq`, tampon d'événements, causes dans `destroyMonster`,
   tests Jest. `pnpm build:shared`.
2. Front — socle : `AnimationContext` + réglage, `boardFxFromEvents`, `FightFxLayer`, branchement dans
   `useZoneAnimations` avec le secours.
3. Front — paliers d'invocation.
4. Front — variantes de destruction.
5. Front — fond de terrain et transitions.
