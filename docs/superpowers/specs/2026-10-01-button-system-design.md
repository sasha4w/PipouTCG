# Système de boutons du frontend — Design

Date : 2026-10-01
Statut : validé en brainstorming, en attente de relecture
Branche : `feat/button-system`

## Objectif

Remplacer la centaine de styles de boutons du frontend par un composant unique `<Button>` à 6 variantes choisies selon le fond, pour garder une cohérence visuelle durable.

## Contexte actuel

- ~190 `<button>` dans ~50 fichiers, ~100 classes CSS différentes.
- Le même bouton bordeaux `#7a1c3b` est réécrit au moins dix fois (`manager-form__submit`, `login-btn`, `marketplace-buy-btn`, `lobby-btn-big`, `scm-btn-confirm`…) avec des arrondis (8 à 99px), des espacements et des polices (Comfortaa / Lilita One) différents.
- Aucune variable de couleur globale.
- Le style `button` global de `index.css` donne un fond doré `#eebc77` à tout bouton sans classe.
- Le doré plein (`inv-row__open-btn` « Ouvrir » de la collection, `quest-item__claim-btn`, `qi__claim-all`, récompense quotidienne) n'est plus voulu.
- Les boutons icône d'admin utilisent des emojis (✏, 🗑) ; les fermetures utilisent ✕ en texte.

## Variables CSS

Ajoutées dans `:root` de `apps/frontend/src/index.css`. Seul le système de boutons les utilise dans ce chantier ; les autres CSS ne sont pas modifiés.

```css
--color-bordeaux: #7a1c3b;
--color-bordeaux-hover: #9b2349;
--color-bordeaux-dark: #3d1020;
--color-cream: #fdf6f0;
--color-cream-hover: #f5efe0;
--color-gold: #eebc77;
--color-pink: #f27aaa;
--color-pink-text: #b03060;
```

## Variantes

| `variant` | Fond d'usage | Rôle | Repos | Survol | Actif (`active`) |
|---|---|---|---|---|---|
| `primary` (défaut) | clair (blanc, crème) | action principale | fond bordeaux, texte blanc | fond `--color-bordeaux-hover` | — |
| `primary-inverse` | foncé | action principale | fond crème, texte bordeaux | fond `--color-cream-hover` | — |
| `ghost-gold` | foncé | onglet, filtre, sélection ; action secondaire (fermer, « Max », lien) | transparent, bordure `rgba(255,255,255,.15)`, texte `rgba(255,255,255,.6)` | fond `rgba(255,255,255,.08)`, texte `rgba(255,255,255,.85)` | fond or 20 %, bordure or 50 %, texte or |
| `ghost-bordeaux` | clair | onglet, filtre, sélection ; action secondaire (retour, modifier, pagination, fermer) | fond bordeaux 8 %, texte bordeaux | fond bordeaux 14 % | fond bordeaux plein, texte blanc |
| `danger` | clair | supprimer, annuler | fond rose 15 %, bordure rose 25 %, texte `--color-pink-text` | fond rose 25 %, bordure rose 45 % | — |
| `danger-inverse` | foncé | supprimer, annuler | fond rose 15 %, bordure rose 25 %, texte `--color-pink` | fond rose 25 %, bordure rose 45 % | — |

Le doré plein disparaît : ses usages passent en `primary` sur fond clair et en `primary-inverse` sur fond foncé.

## Tailles

| `size` | Espacement | Texte | Arrondi | Usage |
|---|---|---|---|---|
| `sm` | 3px 10px | 0.75rem | 8px | filtres, onglets de quêtes, « Récupérer » |
| `md` (défaut) | 0.55rem 1rem | 0.85rem | 12px | la plupart des actions |
| `lg` | 0.85rem 1.5rem | 1rem | 14px | grosse action de page (connexion, « Lancer le combat », ouvrir un booster) |
| `icon` | carré 30×30px | icône 16px | 8px | crayon, poubelle, +/−, ✕ |

Police : Comfortaa 700 pour toutes les tailles. Lilita One reste réservée aux titres. Plus de forme pilule (20, 50, 99px).

## API du composant

Fichiers : `apps/frontend/src/components/Button.tsx` et `Button.css`.

```ts
type ButtonVariant =
  | "primary"
  | "primary-inverse"
  | "ghost-gold"
  | "ghost-bordeaux"
  | "danger"
  | "danger-inverse";
type ButtonTextSize = "sm" | "md" | "lg";

type NativeProps = Omit<ComponentPropsWithoutRef<"button">, "type">;

type ButtonProps = NativeProps & {
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset"; // "button" par défaut
} & (
    | { variant: "ghost-gold" | "ghost-bordeaux"; active?: boolean }
    | {
        variant?: "primary" | "primary-inverse" | "danger" | "danger-inverse"; // "primary" par défaut
        active?: never;
      }
  ) & (
    | { size?: ButtonTextSize }
    | { size: "icon"; "aria-label": string }
  );
```

- `active` n'existe que pour les variantes fantôme. Quand il est fourni, il pose `aria-pressed` ; quand il est absent, pas d'`aria-pressed`.
- `size="icon"` exige un `aria-label` (pas de texte visible).
- `ref` transmise via `forwardRef` vers le `<button>`.
- `className` est ajoutée après les classes du composant ; elle ne sert qu'au placement (marge, `flex`, largeur), jamais aux couleurs ni à la forme. Exception : les onglets en tuile (icône au-dessus du texte, `Profile` et `Admin`) gardent aussi `flex-direction`, `gap` et `padding`.
- Classes générées : `btn btn--<variant> btn--<size>`, plus `btn--full` et `btn--active`.
- Une icône placée dans `children` à côté du texte est espacée par `gap`.

## Comportements communs

- **Survol** : changement de couleur uniquement, pas de `translateY`.
- **Appui** : `transform: scale(0.96)`.
- **Désactivé** : `opacity: 0.4`, `cursor: not-allowed`, aucun effet de survol ni d'appui. Les états désactivés maison des boutons migrés (`lobby-btn-big--disabled`…) disparaissent.
- **Focus clavier** : contour `:focus-visible`, doré pour les variantes de fond foncé (`primary-inverse`, `ghost-gold`, `danger-inverse`), bordeaux pour les autres.
- **Pas de propriété `loading`** : les écrans gardent leur texte d'attente et passent `disabled`.

## Style `button` global

Dans `index.css`, la règle `button` ne garde que `font-family: inherit`, `font-size: 1em`, `font-weight: 500` et `cursor: pointer`. Le fond doré, la bordure, le padding, l'arrondi et la transition sont supprimés, ainsi que les règles `button:hover` (bordure rose) et `button:focus` (outline). La couleur du texte n'est pas touchée (valeur du navigateur, comme aujourd'hui).

Tous les boutons de jeu ont une classe. Un contrôle de leurs propriétés montre que trois d'entre eux héritaient d'une valeur supprimée ; elle est recopiée dans leur règle pour garder leur rendu :

- `.bm-stepper__dot` (`components/manager.css`) : `padding: 0.6em 1.2em` ;
- `.ftb-tab` (`features/fight/FightTabBar.css`) : `border-radius: 8px` ;
- `.gp-close` (`features/fight/GraveyardPile.css`) : `border-radius: 8px`.

Seul effet visible accepté : la bordure rose au survol, qui venait du style global, disparaît sur les boutons de jeu qui avaient une bordure.

Les sélecteurs CSS qui visent l'élément `button` dans un conteneur (`.marketplace-modal-actions button[...]`, `.tx-history__pagination button`) sont supprimés : ils l'emporteraient sur les classes du composant.

## Nouvelles icônes

Ajoutées dans `apps/frontend/src/components/Icons.tsx`, au même format que les existantes (`IconProps`, `viewBox 0 0 24 24`, trait 2, bouts arrondis, `currentColor`) : `IconPencil`, `IconTrash`, `IconClose`, `IconPlus`, `IconMinus`, `IconPause`, `IconPlay`.

Elles remplacent les emojis ✏, 🗑, ⏸ et ▶ des gestionnaires admin, les ✕ des boutons de fermeture et les +/− texte des sélecteurs de quantité.

## Périmètre

### Migré

Tous les boutons d'action et de sélection classiques, boutons icône compris.

### Non migré (éléments de jeu)

Restent avec leur style actuel, sans changement visuel :

- plateau de combat : `FightBoard`, `FightActionBar`, `FightHand`, `FightTabBar`, `ZoneRow`, `MonsterZoneContent`, `GraveyardPile`, `BuffDebuffList` ;
- vignettes cliquables : `marketplace-card-pick`, `marketplace-item-pick`, `opening-selector__thumb`, `fh-card` (cartes du hub de combat) ;
- indicateurs d'étapes : `bm-stepper__dot`, `fr-bc-step`, `fr-bc-dot` ;
- options de récompense : `drm-rescue-option` ;
- navigation du pied de page : `cc-footer__item` ;
- confirmation de `CardPickModal` (`cpm-btn-confirm`) : sa couleur change selon l'effet de jeu résolu (`RESOLUTION_BTN_BG`) ;
- bascule d'affichage du mot de passe (`login-password-toggle`) : icône intégrée au champ de saisie.

Les modales de combat hors plateau (`SummonCostModal`, `CardPickModal`), le lobby et les règles sont migrés pour leurs boutons d'action (confirmer, annuler, fermer, navigation).

`listing-edit__step` n'est pas un indicateur d'étape mais le sélecteur −/+ de quantité de l'édition d'annonce : il est migré.

## `FilterPanel`

`FilterPanel` est utilisé sur fond clair (`BuyTab`, `OwnCardList`, `CardManager`) et sur fond foncé (`CreateListingModal`). Il reçoit une propriété `tone?: "light" | "dark"` (`"light"` par défaut) : ses filtres sont des `ghost-bordeaux` en clair et des `ghost-gold` en foncé. Les surcharges `.marketplace-picker-filters .filter-panel__*` de `CreateListingModal.css` sont supprimées.

## Ordre de migration

Un commit par étape ; typecheck, lint et tests verts à chaque étape. Le CSS devenu inutile est supprimé à chaque étape ; seules les règles de placement restent.

1. **Socle** : variables CSS, `Button.tsx`, `Button.css`, nouvelles icônes, remise à zéro du `button` global, `Button.test.tsx`, création du fichier de vérification.
2. **Marché** : `MarketplaceTabs`, `BuyTab`, `SellTab`, `CreateListingModal`, `ListingEditForm`, `TransactionHistory`, `FilterPanel`.
3. **Collection** : `OwnerBoosterList`, `OwnerBundleList` (fin du doré), `OwnCardList`, `CardList`.
4. **Quêtes et récompenses** : `QuestsPanel`, `QuestInboxWidget`, `DailyRewardModal`.
5. **Boutique et ouverture** : `ShopSection`, `BannerCard`, `BannerCarousel`, `OpeningModal`, `OpeningQuickAccess`.
6. **Combat hors plateau** : `FightLobby`, `FightRules`, `SummonCostModal`, `CardPickModal` (bouton Annuler).
7. **Profil, réglages, connexion, deck, en-tête** : `Profile`, `Settings`, `Login`, `ResetPassword`, `PrivacyButton`, `SoundButton`, `SoundSettings`, `Header`, `DeckWidget`, `DeckBuilder`.
8. **Admin** : `Admin`, `BoosterManager`, `BundleManager`, `CardManager`, `CardSetManager`, `BannerManager`, `QuestManager`, `manager.css`.
9. **Composants transverses** : `Searchbar`, `ErrorBoundary` (fin du dégradé violet), `ToastContainer`.

## Tests

- `apps/frontend/src/__tests__/components/Button.test.tsx` vérifie :
  - les classes de chaque variante et de chaque taille ;
  - `type="button"` par défaut et `type="submit"` quand il est demandé ;
  - `active` pose `aria-pressed` (vrai/faux) et son absence n'en pose pas ;
  - `disabled` bloque `onClick` ;
  - la `ref` atteint l'élément `<button>` ;
  - `className` s'ajoute aux classes du composant.
- `__tests__/pages/Login.test.tsx` cible aujourd'hui « le bouton dont `pressed` vaut `false` ». Les boutons de langue devenant des `ghost` avec `aria-pressed`, ce test cible désormais le bouton d'affichage du mot de passe par son nom accessible.
- Les autres tests existants ciblent les boutons par rôle et nom et ne changent pas.

## Vérification finale par l'utilisateur

Le fichier `docs/superpowers/specs/2026-10-01-button-system-checklist.md` est créé à l'étape 1 et complété à chaque étape. Une ligne par bouton migré :

| ✓ | Écran (chemin dans l'appli) | Bouton | Ancienne classe | Variante / taille | Fichier |
|---|---|---|---|---|---|

Une section séparée liste les boutons de jeu laissés tels quels et les boutons de jeu qui ont reçu une classe locale pour conserver leur rendu.

## Hors périmètre

- Remplacer les couleurs en dur des autres CSS par les variables.
- Une propriété `loading` ou un indicateur de chargement.
- Storybook.
