# Set Drakon — design

Date : 2026-10-17 · Branche : `drakon-set` (depuis `dev`)

## Objectif

Rendre jouable le set **Drakon, les légendes primaires** (set 3) autour d'une idée : **sortir un Drakon Adulte prend
du temps, mais c'est un très gros monstre**. Les Drakons évoluent sur le terrain (Bébé → Jeune → Adulte), naissent
d'Œufs à protéger, et chaque élément a sa spécialité. On peut jouer mono-élément ou combiner deux éléments.

## Hors périmètre

- Nouveaux éléments et nouvelles formes de Drakon (prévus dans de futurs sets : le modèle de données les accueille).
- Illustrations des cartes.
- Équilibrage des sets PipouSquad / SquareWorld.
- Filtre « élément » dans la collection ou le deck builder.

## Décisions

| Sujet | Choix |
|---|---|
| Évolution | Posée sur le terrain, sur un monstre de la même lignée au stade précédent |
| Coût d'évolution | Différence de coût entre le nouveau stade et le monstre de base (min. 0), payée comme une invocation |
| Délai | Le monstre de base doit être en jeu depuis au moins un de tes tours (sauf accélérateur) |
| Conservé à l'évolution | Équipements et mode ; PV remis au maximum du nouveau stade ; bonus temporaires et malus effacés |
| Monstre de base | Part au cimetière |
| Invocation directe | Jeunes et Adultes **ne s'invoquent jamais depuis la main** : uniquement par évolution, ou par l'effet d'un Œuf (éclosion, Dualité détruit). Bébés et Œufs s'invoquent normalement (règle partagée `canSummonFromHand`) |
| Œufs | Genèse (joker + éclosion Bébé en 2 tours), Dualité (Jeune si détruit, Bébé si éclot en 2 tours), Céleste (Adulte en 4 tours) |
| Éléments | Terre = PV et immunité · Feu = dégâts · Vent = vitesse d'évolution · Eau = soin et cimetière |
| Lignées | Teros = Terre · Feros = Feu · Tempestu = Vent · Ackos = Eau |
| Modèle de données | Nouvelles colonnes de carte `element`, `lineage`, `stage` (nullables) |

## Modèle de données

### Partagé (`@pipou/shared`, `enums/card.ts`)

```ts
export const DrakonElement = { EARTH: "earth", FIRE: "fire", WIND: "wind", WATER: "water" } as const;
export const DrakonStage = { EGG: "egg", BABY: "baby", YOUNG: "young", ADULT: "adult" } as const;
```

- `ClientCard` gagne `element: DrakonElement | null`, `lineage: string | null`, `stage: DrakonStage | null`.
- `CreateCardRequest` / DTO admin : les trois champs, optionnels (enums validés ; `lineage` chaîne ≤ 50).
- Ordre des stades : `baby → young → adult` (l'œuf est hors chaîne, voir Joker).

### Backend

- Entité `Card` : colonnes `element` (enum, nullable), `lineage` (varchar 50, nullable), `stage` (enum, nullable).
- Migration de **schéma** (ajout des colonnes, `down` les retire) puis migration de **données** (cartes Drakon), en
  respectant la règle « entités = schéma de prod, zéro écart » (mémoire `aiven-safety`).
- Les cartes non Drakon gardent `null` partout.

## Règles de jeu

### Évolution (nouvelle action `evolve`)

`GameAction` gagne `{ type: "evolve"; handIndex: number; targetInstanceId: string; paymentHandIndices: number[] }`
(événement Socket `fight:evolve`, et équivalent sandbox).

Une évolution est valide si :
1. c'est ta phase principale, la carte en main est un monstre avec `stage` ∈ {young, adult} ;
2. la cible est **ton** monstre et :
   - même `lineage` **et** stade immédiatement précédent (young ← baby, adult ← young), **ou**
   - la cible a le passif **Joker d'évolution** et la carte est un `young` ;
3. **délai** : la cible n'a pas été posée ce tour (`summonedThisTurn` faux), sauf si elle a **Évolution immédiate**
   (passif) ou **Peut évoluer ce tour** (drapeau posé par un effet) ;
4. **coût** : `max(0, coût(carte) − coût(cible))`, payé comme une invocation (énergie de recyclage puis défausse).

Résolution :
- la carte de base de la cible (et non ses équipements) part au cimetière ; le nouveau monstre prend la même zone avec
  un **nouvel `instanceId`** (c'est un nouveau monstre pour les animations et les cibles) ;
- conservés : `equipments`, `mode` ; PV = PV max du nouveau stade ; `perm` remis à zéro ; drapeaux temporaires
  effacés (gel, verrou, forçage, compteurs) ;
- l'attaque : `attacksUsedThisTurn` et `hasAttackedThisTurn` sont **reportés** (pas de double attaque par
  évolution) ; `summonedThisTurn` = **vrai** : le monstre évolué compte comme posé ce tour, il ne peut donc pas
  réévoluer avant ton prochain tour (du Bébé à l'Adulte : au moins 2 tours, sauf accélérateur). Cela ne l'empêche pas
  d'attaquer (seul `cannotAttackOnSummonTurn` bloque l'attaque le tour de pose) ;
- l'effet `ON_SUMMON` du nouveau stade se déclenche, puis `ON_ALLY_SUMMON` comme une invocation ;
- événement `monster_summoned` (animation par rareté) ; journal « X évolue en Y ».

### Œufs et éclosion

- Les monstres de `stage = egg` **ne peuvent pas attaquer** (refus « Un Œuf ne peut pas attaquer »).
- Nouvelle action `SET_HATCH_COUNTER` (valeur = tours, `filter.stage` = stade visé) : pose `hatchCounter` et
  `hatchStage` sur l'œuf.
- Au **début du tour de son propriétaire**, `hatchCounter` −1 (avant les effets de début de tour, comme les compteurs
  existants). À 0 : l'œuf **quitte le terrain sans être détruit** (pas d'`ON_DEATH`, pas de pioche, pas de Prime) et
  va au cimetière ; s'il existe dans le deck des cartes au stade visé, un **choix** est proposé au propriétaire et la
  carte choisie est **invoquée dans la zone de l'œuf** (gratuitement, effets d'invocation inclus) ; sinon rien.
- Nouvelle action `ADVANCE_HATCH` (valeur) : retire des tours au compteur ; à 0, éclosion immédiate.
- Nouvelle action `SUMMON_FROM_DECK` (`filter`) : met en file un choix dans le deck en mémorisant la **zone du monstre
  source**. Le choix se résout après la destruction (la zone est alors libre) : invocation gratuite dans cette zone si
  elle est libre, sinon dans la première zone libre ; aucune zone libre ou aucun candidat : rien.
- Nouvelle résolution de choix `summon_to_zone` (`PendingChoice.zoneIndex`) pour ces deux cas.

### Accélérateurs

- `EVOLUTION_JOKER` (passif) : le monstre accepte un Jeune de n'importe quelle lignée.
- `INSTANT_EVOLUTION` (passif) : le monstre peut évoluer le tour où il est posé.
- `ALLOW_EVOLUTION_THIS_TURN` : drapeau `canEvolveThisTurn` jusqu'à la fin du tour en cours.

### Conditions, filtres, cibles

- `EffectCondition` gagne `element?` et `stage?`. Nouvelle condition `DRAKON_ON_BOARD` : un de tes monstres a l'élément
  et/ou le stade demandés. `EQUIPPED_ON` accepte aussi `element` / `stage` (sans `value`, il ne compare pas le nom).
- `EffectFilter` gagne `element?` et `stage?` (recherches dans le deck, le cimetière, invocations depuis le deck).
- Nouvelle cible `STRONGEST_ENEMY` : le monstre adverse visable de plus grande ATK effective (premier en zone si
  égalité) ; respecte l'immunité aux effets adverses.
- `ARCHETYPE_ALLIES` dans le résolveur de cibles : utilise `action.archetype`, sinon l'archétype du monstre source,
  sinon celui de la carte source (nécessaire pour un Éphémère comme Souffle Primordial).

## Cartes

Notation : `TRIGGER → ACTION valeur CIBLE [condition]`. Toutes les cartes : `archetype = dragon`, set 3. Les stats
des cartes existantes ne changent pas, sauf l'Œuf de la Genèse.

### Œufs

| Carte | Rareté · coût · stats | Élément / lignée / stade | Effets |
|---|---|---|---|
| Œuf de la Genèse (renommé depuis « Œuf de la Gènese ») | rare · 1 · 0/300 | — / — / egg | `ON_SUMMON → SET_HATCH_COUNTER 2 SELF` filtre {stage baby} · `PASSIVE → EVOLUTION_JOKER SELF` |
| **Œuf de la Dualité** (nouvelle carte) | epic · 1 · 0/300 | — / — / egg | `ON_SUMMON → SET_HATCH_COUNTER 2 SELF` filtre {stage baby} · `ON_DEATH → SUMMON_FROM_DECK PLAYER` filtre {stage young} |
| **Œuf Céleste** (nouvelle carte) | legendary · 2 · 0/600 | — / — / egg | `ON_SUMMON → SET_HATCH_COUNTER 4 SELF` filtre {stage adult} |

### Lignées

| Carte | Stats | Élément · lignée · stade | Effets |
|---|---|---|---|
| Bébé Teros | 100/1000 | earth · teros · baby | `ON_SUMMON → SET_TAUNT SELF` |
| Jeune Teros | 300/1800 | earth · teros · young | `ON_SUMMON → SET_TAUNT SELF` · `PASSIVE → SET_DAMAGE_REDUCTION 2 SELF` |
| Adulte Teros | 600/3000 | earth · teros · adult | `ON_SUMMON → SET_TAUNT SELF`, `SET_DEBUFF_IMMUNITY SELF` · `PASSIVE → SET_DAMAGE_REDUCTION 2 SELF` |
| Bébé Feros | 400/400 | fire · feros · baby | `ON_SUMMON → DEAL_DAMAGE 100 ALL_ENEMIES` |
| Jeune Feros | 800/900 | fire · feros · young | `ON_SUMMON → SET_PIERCING SELF` |
| Adulte Feros | 1600/1400 | fire · feros · adult | `ON_SUMMON → SET_PIERCING SELF`, `DEAL_DAMAGE 400 ALL_ENEMIES` |
| Bébé Tempestu | 300/500 | wind · tempestu · baby | `PASSIVE → INSTANT_EVOLUTION SELF` |
| Jeune Tempestu | 500/1000 | wind · tempestu · young | `PASSIVE → INSTANT_EVOLUTION SELF` · `ON_SUMMON → ALLOW_EVOLUTION_THIS_TURN ALLIES_EXCEPT_SELF` |
| Adulte Tempestu | 1000/1600 | wind · tempestu · adult | `PASSIVE → SET_ATTACKS_PER_TURN 2 SELF` · `ON_SUMMON → RETURN_TO_HAND STRONGEST_ENEMY` |
| Bébé Ackos | 200/600 | water · ackos · baby | `ON_TURN_START → HEAL 100 ALLIES_EXCEPT_SELF` |
| Jeune Ackos | 400/1200 | water · ackos · young | `ON_SUMMON → RETURN_FROM_GRAVEYARD 1 PLAYER` filtre {archetype dragon} |
| Adulte Ackos | 800/2200 | water · ackos · adult | `ON_TURN_START → HEAL 300 ALLIES_EXCEPT_SELF` · `ON_SUMMON → RETURN_FROM_GRAVEYARD 2 PLAYER` |

### Supports

| Carte | Type · coût | Effets |
|---|---|---|
| Incubation Rapide | Éphémère · 1 | `ON_PLAY → ADVANCE_HATCH 2 TARGET_ALLY`, `ALLOW_EVOLUTION_THIS_TURN TARGET_ALLY` |
| Écaille de Dragon | Équipement · 1 | `PASSIVE → SET_DAMAGE_REDUCTION 2 SELF` · `PASSIVE → SET_DEBUFF_IMMUNITY SELF [EQUIPPED_ON stage egg]` |
| Bouclier de Fortune | Éphémère · 0 | `ON_PLAY → SET_COMBAT_IMMUNITY TARGET_ALLY` |
| Potion de Lucidité | Éphémère · 0 | `ON_PLAY → SEARCH_DECK PLAYER` filtre {archetype dragon} |
| Souffle Primordial | Éphémère · 2 | `ON_PLAY → BUFF_ATK_TEMP 300 ARCHETYPE_ALLIES` (archetype dragon), `valueIf { DRAKON_ON_BOARD stage adult → 600 }` |
| Frappe Préventive | Éphémère · 0 | `ON_PLAY → DEAL_DAMAGE 300 ENEMY_MONSTER`, `valueIf { DRAKON_ON_BOARD element fire → 600 }` |

### Descriptions

| Carte | Description |
|---|---|
| Œuf de la Genèse | Un œuf ancestral. Un Jeune Drakon de n'importe quel élément peut éclore directement de lui ; sinon, après 2 tours, il donne naissance au Bébé Drakon de ton choix. |
| Œuf de la Dualité | Deux destins dans une coquille. S'il est détruit, un Jeune Drakon de ton choix surgit ; s'il survit 2 tours, il éclot en Bébé Drakon. |
| Œuf Céleste | Couvé par les étoiles. Après 4 tours, il éclot directement en Drakon Adulte de ton choix. À protéger à tout prix. |
| Bébé Teros | Petit mur de pierre. Provocation. |
| Jeune Teros | Rocaille résistante. Provocation, dégâts reçus divisés par 2. |
| Adulte Teros | La montagne vivante. Provocation, dégâts reçus divisés par 2, insensible aux effets adverses. |
| Bébé Feros | Petite braise. À son arrivée, inflige 100 dégâts à tous les monstres adverses. |
| Jeune Feros | Flamme vive. Attaque Perçante. |
| Adulte Feros | Incendie dévastateur. Attaque Perçante ; à son arrivée, inflige 400 dégâts à tous les monstres adverses. |
| Bébé Tempestu | Brise légère. Peut évoluer dès le tour où il est posé. |
| Jeune Tempestu | Tourbillon gênant. Peut évoluer dès son arrivée ; tes autres monstres peuvent évoluer sans attendre ce tour. |
| Adulte Tempestu | Ouragan de contrôle. Attaque 2 fois par tour ; à son arrivée, renvoie en main le monstre adverse le plus fort. |
| Bébé Ackos | Goutte de vie. Au début de ton tour, soigne tes autres monstres de 100 PV. |
| Jeune Ackos | Source pure. À son arrivée, récupère un Drakon de ton cimetière. |
| Adulte Ackos | Océan de soin. Au début de ton tour, soigne tes autres monstres de 300 PV ; à son arrivée, récupère 2 cartes de ton cimetière. |
| Incubation Rapide | Accélère l'éclosion d'un de tes Œufs de 2 tours, ou permet à un de tes Drakons d'évoluer ce tour. |
| Écaille de Dragon | Protection naturelle. Dégâts reçus divisés par 2 ; sur un Œuf, il devient insensible aux effets adverses. |
| Bouclier de Fortune | Un de tes monstres est insensible aux dégâts de combat jusqu'à ton prochain tour. |
| Potion de Lucidité | Cherche un Drakon ou un Œuf dans ton deck. |
| Souffle Primordial | Tes Drakons gagnent +300 ATK ce tour, +600 si tu contrôles un Drakon Adulte. |
| Frappe Préventive | Inflige 300 dégâts à un monstre adverse, 600 si tu contrôles un Drakon de Feu. |

## Migrations

- `DrakonColumns` (schéma) : ajoute `element`, `lineage`, `stage` à `card`.
- `DrakonSet` (données) : met à jour les 19 cartes Drakon existantes par **nom** (nom, description, effets, élément,
  lignée, stade ; PV de l'Œuf de la Genèse), uniquement si leur état est celui de l'export de prod du 2026-10-17
  (même garde que `CardRework`, `down` réversible) ; **insère** l'Œuf de la Dualité et l'Œuf Céleste dans le set 3
  s'ils n'existent pas (`down` les supprime s'ils ne sont référencés par aucune collection, aucun deck ni booster).

## Front

- **Évolution** : sélection d'un Drakon Jeune/Adulte en main → les monstres alliés éligibles s'allument (règle
  partagée `canEvolveOnto(card, monster)` dans `@pipou/shared`, utilisée aussi par le moteur) → clic → fenêtre de
  paiement si le coût restant > 0 → `fight:evolve`. Bouton « Évoluer » dans la barre d'action.
- **Icônes : aucun emoji, uniquement des icônes SVG**, ajoutées à `apps/frontend/src/components/Icons.tsx` dans le
  même format que les icônes existantes (`IconProps` : `size`, `color`, `className`, `style` ; `viewBox 0 0 24 24`,
  trait `currentColor`). Nouvelles icônes : `IconEarth`, `IconWind`, `IconWater` (`IconFire` existe déjà),
  `IconEgg` (éclosion), `IconEvolve` (évolution / peut évoluer), `IconJoker` (joker d'évolution).
- **Statuts** : « Éclot dans N tours », « Peut évoluer », « Joker d'évolution », « Évolution immédiate », chacun avec
  son icône SVG. Le type `BuffEntry.icon` (aujourd'hui une chaîne emoji) accepte aussi un `ReactNode` pour ces
  statuts.
- **Carte** : pastille d'élément (icône SVG de l'élément, couleur par élément) sur `CardFace` quand `element` est
  renseigné.
- **Textes d'effets** fr/en/ko : nouvelles actions, cible, condition et filtres.
- **Admin** (`CardManager`) : champs élément, lignée, stade.
- **Choix** : la fenêtre de choix existante (`CardPickModal`) sert aux éclosions et invocations depuis le deck.

## Tests

- **Partagé** : `canEvolveOnto` (même lignée/stade suivant, joker, refus d'un autre stade ou d'une autre lignée).
- **Moteur** (Jest) :
  - évolution : coût en différence, délai (refus le tour de pose ; accepté avec Évolution immédiate et Peut évoluer),
    conservation des équipements et du mode, PV pleins, base au cimetière, `ON_SUMMON` du nouveau stade, pas de
    seconde attaque gagnée, refus lignée/stade incorrects, joker de la Genèse ;
  - éclosion : Genèse et Dualité à 2 tours (choix d'un Bébé), Céleste à 4 tours (Adulte), deck sans candidat,
    `ADVANCE_HATCH` jusqu'à 0, œuf qui éclot ne déclenche pas `ON_DEATH` ;
  - Dualité détruite (combat, effet adverse, sacrifice) → choix d'un Jeune invoqué dans sa zone ;
  - un œuf ne peut pas attaquer ;
  - `STRONGEST_ENEMY`, `DRAKON_ON_BOARD`, filtres élément/stade, `ARCHETYPE_ALLIES` depuis un Éphémère ;
  - chaque carte du set via `realCard` (effets attendus).
- **Couverture** : `effects-coverage.spec.ts` (nouvelles valeurs déclarées et gérées, chaque vraie carte jouable).
- **Migrations** : garde « état attendu », insertion idempotente des 2 œufs, `down`.
- **Front** (Vitest) : textes d'effets, statuts, pastille d'élément, cibles d'évolution surlignées.
- **Visuel** : sandbox local, captures 430 px d'une évolution complète, d'une éclosion et des fiches de cartes.
