# Visuel des cartes en duel — design

Date : 2026-10-16 · Branche : `duel-card-visuals`

## Objectif

Afficher en duel le même visuel de carte que dans la collection (`CardDisplay` : palette de rareté, en-tête nom + coût,
illustration, badges ATK/HP), adapté au combat : stats courantes, états (buffs, blessures, garde, a attaqué, statuts),
et lisible dans la coque mobile de 430px. Référence d'ambiance : Yu-Gi-Oh Duel Links (cartes illustrées sur le terrain
et en main, infos de duel superposées).

## Périmètre

Main du joueur, terrain des deux camps (monstres, supports, animation de destruction), modale de choix
(`CardPickModal`), cimetière (`GraveyardPile`), mulligan (`MulliganPanel`).

## Hors périmètre

- Main adverse (reste cachée, seul le nombre est affiché).
- Nouvelles animations de combat (les animations de zone existantes sont conservées telles quelles).
- Refonte de `CardDisplay` au-delà de l'extraction de `CardFace`.

## Décisions

| Sujet | Choix |
|---|---|
| Style | Carte actuelle conservée (en-tête, illustration encadrée, badges ATK/HP), sans description en petit |
| Mode Garde | Carte droite + voile bleu sur l'illustration + bouclier 🛡️ centré + bordure bleue |
| Stats | ATK/PV courants ; vert si supérieurs à la base, rouge si inférieurs (PV blessés) |
| A attaqué | Carte désaturée + pastille « a attaqué » |
| Main | Éventail : rotation ±15° au total, chevauchement calculé pour tenir en largeur |
| Inspection | Appui long (400 ms) → grande carte + effets actifs ; le bouton « i » disparaît |
| Architecture | Extraction d'un composant de présentation `CardFace` partagé par `CardDisplay` et le duel |

## Composants

### `CardFace` (`apps/frontend/src/features/cards/CardFace.tsx` + `CardFace.css`)

Recto de la carte, purement visuel : aucun état, aucun gestionnaire d'événement.

```ts
/** Forme minimale : satisfaite par Card (card.service) et par ClientCard (@pipou/shared). */
type CardFaceCard = Pick<ClientCard, "id" | "name" | "rarity" | "type" | "atk" | "hp"> & {
  /** Optionnel : Card (service) le déclare `supportType?`, ClientCard `supportType`. */
  supportType?: SupportType | null;
  cost?: number;
  description?: string | null;
  image?: { url: string } | null;
};

type StatState = "up" | "down";

interface CardFaceProps {
  card: CardFaceCard;
  /** xs = taille duel (main, terrain), sans pied de carte. */
  size: "xs" | "sm" | "md" | "lg";
  /** Pied de carte avec description. Ignoré en xs/sm. */
  showDescription?: boolean;
  /** Stats courantes ; absent = stats de base de la carte. */
  stats?: { atk: number; hp: number; atkState?: StatState; hpState?: StatState };
  guard?: boolean;
  spent?: boolean;
  /** Pastilles d'état, posées en haut à gauche de l'illustration. */
  badges?: ReactNode;
}
```

- Palettes de rareté (`data-rarity`), en-tête, coût, illustration, badges ATK/HP, badge de type support et pied de
  carte déménagent de `CardDisplay.css` vers `CardFace.css`.
- `atkState`/`hpState` → classes `--up` (vert `#1e8f4e`) / `--down` (rouge `#d63031`) ; variantes claires pour la
  rareté `secret` (fond sombre).
- `guard` → voile `rgba(60,120,220,.35)` sur l'illustration, 🛡️ centré, bordure `#3c78dc`.
- `spent` → `filter: grayscale(.7) brightness(.85)` + pastille « a attaqué ».
- Sans image : placeholder ✦ actuel. Image en `loading="lazy"` `decoding="async"`.
- Le nom accessible (nom + ATK/PV courants) est porté par l'élément interactif qui l'entoure en duel
  (`InspectableCard`, `role="button"`), pas par `CardFace` elle-même.

### `CardDisplay`

Rend `<CardFace>` dans son rotator. Garde la 3D, le flip, l'appui long d'inspection, le shine et le glare
(couches d'interaction, restent dans `CardDisplay.css`). Comportement et rendu inchangés pour la collection, le deck
builder, le marketplace et l'ouverture de boosters.

### Hook `useLongPress` (`apps/frontend/src/hooks/useLongPress.ts`)

- Pointer events (tactile et souris), seuil 400 ms, annulé si déplacement > 8px.
- Un appui long déclenché supprime le click qui suit.
- Renvoie les props à étaler sur l'élément (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`,
  `onClickCapture`, `onContextMenu`).

### `CardInspect` (`apps/frontend/src/features/fight/CardInspect.tsx`)

Overlay plein écran : `CardFace lg` avec description et stats courantes, puis la liste des effets actifs. Se ferme au
relâchement de l'appui long, au tap hors carte ou sur Échap.

### `BuffDebuffList`

Le rendu des sections (récap + sections) est extrait dans `BuffDebuffSections`, affiché en ligne par `CardInspect`.
Le tooltip ancré (`anchorRect`) et les boutons « i » de la main et des zones sont supprimés.

## Intégration en duel

| Composant | Rendu |
|---|---|
| `FightHand` | Éventail de `CardFace xs`. La carte sélectionnée se redresse, monte et passe au premier plan. Contours colorés conservés pour sélectionnée / paiement / gratuite / défausse ; pastilles ✓ et 💰 sur la carte. Tap inchangé (sélection, paiement, défausse). |
| `MonsterZoneContent` | `CardFace xs` avec stats calculées (ATK + `atkBuff` + `tempAtkBuff`, PV courants), `guard` si `mode === "guard"`, `spent` si `hasAttackedThisTurn && attacksUsedThisTurn >= attacksPerTurn`
(condition actuelle de « attaqué »), badges existants (🛡 🗡 ✨ 💤 ⚡ ×n ⏳ 🧊 🔒) via `badges`. Boutons ⚔️/🛡️ et puces d'équipement sous la carte. |
| `SupportZoneContent` | `CardFace xs`. |
| Destruction (`ZoneRow`) | `CardFace xs` de la carte mourante, PV à 0. |
| `CardPickModal`, `GraveyardPile`, `MulliganPanel` | Grille de `CardFace sm`. Sélection et source affichées autour de la carte. |
| `ZoneRow` | Zones agrandies pour une carte xs (~100×150, ratio 2/3) + boutons dessous. Animations existantes conservées. |

Calcul de l'éventail pour `n` cartes et une largeur `W` : angle `θᵢ = -15° + 30° · i/(n-1)` (0° si n = 1), décalage
vertical proportionnel à `|θᵢ|`, chevauchement `max(0, (n·w − W) / (n−1))` avec `w` la largeur d'une carte.
Fonction pure `fanLayout(n, W, w)` dans `features/fight/fanLayout.ts`.

`HandCard` (`features/fight/handCard.ts`) gagne `image` ; `toHandCard` le recopie.

## Contrat partagé et backend

`packages/shared/src/game/state.ts` : `ClientChoiceCandidate.baseCard` passe à

```ts
Pick<ClientCard, "id" | "name" | "type" | "atk" | "hp" | "rarity" | "supportType" | "cost" | "image" | "description">
```

`apps/backend/src/fights/helpers/client-state.builder.ts` recopie `cost`, `image` et `description` dans les candidats.
`Card.image` est déjà chargée en `eager`, aucune requête supplémentaire. C'est la seule modification backend : la main
et les zones transportent déjà la carte complète.

## Accessibilité

Cartes focusables ; Entrée = click (jouer / sélectionner) ; touche menu contextuel = inspection ; Échap ferme
l'inspection. `touch-action: none` uniquement sur la main (plus de défilement, pas de conflit avec l'appui long).

## Tests

- `CardFace` : `data-rarity`, classes `--up`/`--down`, `guard`, `spent`, placeholder sans image, description seulement
  avec `showDescription` en md/lg.
- `useLongPress` (fake timers) : appui long → callback ; pas de click après un appui long ; déplacement > 8px annule ;
  tap court → click.
- `fanLayout` : 1, 5, 10 cartes — angles symétriques, tient dans `W`.
- `FightHand` : tap sélectionne ; appui long ouvre `CardInspect` sans sélectionner.
- `MulliganPanel.test.tsx` mis à jour ; nouveau test `CardPickModal`.
- Backend : test de `client-state.builder` — les candidats contiennent `image`, `cost`, `description`.
- Vérification visuelle : captures Playwright d'un duel en mode sandbox dans la coque 430px.
