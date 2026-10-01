# Système de boutons — Liste de vérification

À parcourir dans l'appli (`pnpm dev`) : coche chaque ligne après avoir vérifié le bouton (couleur, survol, appui, état désactivé, état actif s'il y en a un).

Rappel des variantes :
- fond clair : `primary` (bordeaux plein), `ghost-bordeaux` (bordeaux léger, plein si actif), `danger` (rose, texte rose soutenu) ;
- fond foncé : `primary-inverse` (crème, texte bordeaux), `ghost-gold` (transparent, doré si actif), `danger-inverse` (rose, texte rose vif).

## Marché

| ✓ | Écran | Bouton | Ancienne classe | Variante / taille | Fichier |
|---|---|---|---|---|---|
| [ ] | Marché (`/marketplace`) | Onglet Achat | `marketplace-tab` (+ `--active`) | `ghost-bordeaux` / md | `features/marketplace/MarketplaceTabs.tsx` |
| [ ] | Marché | Onglet Vente | `marketplace-tab` (+ `--active`) | `ghost-bordeaux` / md | `features/marketplace/MarketplaceTabs.tsx` |
| [ ] | Marché → Achat → carte d'annonce (haut foncé) | − quantité | `marketplace-qty-btn` | `ghost-gold` / icon | `features/marketplace/BuyTab.tsx` |
| [ ] | Marché → Achat → carte d'annonce | + quantité | `marketplace-qty-btn` | `ghost-gold` / icon | `features/marketplace/BuyTab.tsx` |
| [ ] | Marché → Achat → carte d'annonce | Max | `marketplace-qty-max` | `ghost-gold` / sm | `features/marketplace/BuyTab.tsx` |
| [ ] | Marché → Achat → carte d'annonce (bas blanc) | Acheter | `marketplace-buy-btn` | `primary` / md | `features/marketplace/BuyTab.tsx` |
| [ ] | Marché → Achat | Filtres | `filter-panel__btn`, `filter-panel__reset` | `ghost-bordeaux` / sm | `components/FilterPanel.tsx` |
| [ ] | Marché → Vente | Mettre en vente | `marketplace-create-listing-btn` | `primary` / md | `features/marketplace/SellTab.tsx` |
| [ ] | Marché → Vente → carte d'annonce (bas blanc) | Modifier | `marketplace-edit-btn` | `ghost-bordeaux` / md | `features/marketplace/SellTab.tsx` |
| [ ] | Marché → Vente → carte d'annonce | Annuler l'annonce | `marketplace-cancel-btn` | `danger` / md | `features/marketplace/SellTab.tsx` |
| [ ] | Marché → Vente → Mettre en vente (modale foncée) | ✕ fermer | `marketplace-modal-close` | `ghost-gold` / icon | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Mettre en vente | Type Carte / Booster / Bundle | `marketplace-type-btn` (+ `--active`) | `ghost-gold` / md | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Mettre en vente | Filtres | `.marketplace-picker-filters .filter-panel__*` | `ghost-gold` / sm (`tone="dark"`) | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Mettre en vente | − quantité | `marketplace-qty-btn` | `ghost-gold` / icon | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Mettre en vente | + quantité | `marketplace-qty-btn` | `ghost-gold` / icon | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Mettre en vente | Max | `marketplace-qty-max` | `ghost-gold` / sm | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Mettre en vente | Annuler | `.marketplace-modal-actions button[type="button"]` | `danger-inverse` / md | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Mettre en vente | Mettre en vente (envoi) | `.marketplace-modal-actions button[type="submit"]` | `primary-inverse` / md | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Marché → Vente → Modifier une annonce (foncé) | − quantité | `listing-edit__step` | `ghost-gold` / icon | `features/marketplace/ListingEditForm.tsx` |
| [ ] | Marché → Modifier une annonce | + quantité | `listing-edit__step` | `ghost-gold` / icon | `features/marketplace/ListingEditForm.tsx` |
| [ ] | Marché → Modifier une annonce | Max | `listing-edit__max` | `ghost-gold` / sm | `features/marketplace/ListingEditForm.tsx` |
| [ ] | Marché → Modifier une annonce | Enregistrer | `listing-edit__save` | `primary-inverse` / md | `features/marketplace/ListingEditForm.tsx` |
| [ ] | Marché → Modifier une annonce | Annuler | `marketplace-cancel-btn` | `danger-inverse` / md | `features/marketplace/ListingEditForm.tsx` |
| [ ] | Marché → Achat / Vente → historique | ← page | `.tx-history__pagination button` | `ghost-bordeaux` / icon | `features/marketplace/TransactionHistory.tsx` |
| [ ] | Marché → historique | → page | `.tx-history__pagination button` | `ghost-bordeaux` / icon | `features/marketplace/TransactionHistory.tsx` |
| [ ] | Profil → Collection → cartes → filtres | Filtres (options, Réinitialiser) | `filter-panel__btn`, `filter-panel__reset` | `ghost-bordeaux` / sm | `components/FilterPanel.tsx` (utilisé par `features/profile/OwnCardList.tsx`) |
| [ ] | Admin → Cartes → filtres | Filtres (options, Réinitialiser) | `filter-panel__btn`, `filter-panel__reset` | `ghost-bordeaux` / sm | `components/FilterPanel.tsx` (utilisé par `features/cards/CardManager.tsx`) |

## Collection

| ✓ | Écran | Bouton | Ancienne classe | Variante / taille | Fichier |
|---|---|---|---|---|---|
| [ ] | Profil (`/profile`) → Collection → boosters | Ouvrir | `inv-row__open-btn` | `primary` / sm | `features/boosters/OwnerBoosterList.tsx` |
| [ ] | Profil → Collection → bundles | Ouvrir | `inv-row__open-btn` | `primary` / sm | `features/bundles/OwnerBundleList.tsx` |
| [ ] | Profil → Collection → cartes | ← page | `own-cardlist__pagination-btn` | `ghost-bordeaux` / icon | `features/profile/OwnCardList.tsx` |
| [ ] | Profil → Collection → cartes | → page | `own-cardlist__pagination-btn` | `ghost-bordeaux` / icon | `features/profile/OwnCardList.tsx` |
| [ ] | Accueil (`/`) → un set de cartes | Retour | `cardlist__back` | `ghost-bordeaux` / icon | `features/cards/CardList.tsx` |
| [ ] | Accueil → un set de cartes | ← page | `cardlist__pagination-btn` | `ghost-bordeaux` / icon | `features/cards/CardList.tsx` |
| [ ] | Accueil → un set de cartes | → page | `cardlist__pagination-btn` | `ghost-bordeaux` / icon | `features/cards/CardList.tsx` |

## Quêtes et récompenses

| ✓ | Écran | Bouton | Ancienne classe | Variante / taille | Fichier |
|---|---|---|---|---|---|
| [ ] | Profil → Quêtes | Onglets Jour / Semaine / … | `quests-panel__tab` (+ `--active`) | `ghost-gold` / sm | `features/profile/QuestsPanel.tsx` |
| [ ] | Profil → Quêtes | Tout récupérer | `quests-panel__claim-all` | `primary-inverse` / sm | `features/profile/QuestsPanel.tsx` |
| [ ] | Profil → Quêtes → une quête | Récupérer | `quest-item__claim-btn` | `primary-inverse` / sm | `features/profile/QuestsPanel.tsx` |
| [ ] | En-tête (toutes les pages) | Trophée des quêtes | `qi__btn` | `ghost-bordeaux` / icon | `features/quests/QuestInboxWidget.tsx` |
| [ ] | En-tête → menu des quêtes | Tout récupérer | `qi__claim-all` | `primary-inverse` / sm | `features/quests/QuestInboxWidget.tsx` |
| [ ] | En-tête → menu des quêtes | Récupérer (une quête) | `qi__item-claim` | `primary-inverse` / sm | `features/quests/QuestInboxWidget.tsx` |
| [ ] | En-tête → menu des quêtes | Voir tout → | `qi__footer-link` | `ghost-gold` / sm | `features/quests/QuestInboxWidget.tsx` |
| [ ] | Récompense quotidienne (à la connexion) | ✕ fermer | `drm-close` | `ghost-gold` / icon | `components/DailyRewardModal.tsx` |
| [ ] | Récompense quotidienne | Réclamer ma récompense | `drm-claim-btn` | `primary-inverse` / lg, fullWidth | `components/DailyRewardModal.tsx` |
| [ ] | Récompense quotidienne → série perdue | Racheter | `drm-rescue-btn` | `primary-inverse` / md | `components/DailyRewardModal.tsx` |
| [ ] | Récompense quotidienne → série perdue | Recommencer à J1 | `drm-reset-btn` | `danger-inverse` / md | `components/DailyRewardModal.tsx` |
| [ ] | Récompense quotidienne → résultat | Super, merci ! | `drm-close-btn` | `primary-inverse` / md | `components/DailyRewardModal.tsx` |

## Boutique et ouverture

## Combat hors plateau

## Profil, réglages, connexion, deck, en-tête

## Admin

## Composants transverses

## Boutons de jeu laissés tels quels

Vérifier qu'ils n'ont **pas** changé d'apparence (seule la bordure rose au survol, qui venait du style global, a disparu).

| ✓ | Écran | Bouton | Classe | Fichier |
|---|---|---|---|---|
| [ ] | Combat → plateau | Invoquer / Jouer / Recycler | `fab-btn` | `features/fight/FightActionBar.tsx` |
| [ ] | Combat → plateau | Fin de phase | `fab-btn-phase` | `features/fight/FightActionBar.tsx` |
| [ ] | Combat → plateau | Abandonner | `fab-btn-surrender` | `features/fight/FightActionBar.tsx` |
| [ ] | Combat → plateau | Attaque directe | `fb-btn-direct-atk` | `features/fight/FightBoard.tsx` |
| [ ] | Combat → plateau | « i » des effets (main et zones) | `bdl-trigger` | `features/fight/FightHand.tsx`, `features/fight/Zonerow/ZoneRow.tsx` |
| [ ] | Combat → plateau | Mode attaque / garde | `zr-mode-btn` | `features/fight/Zonerow/MonsterZoneContent.tsx` |
| [ ] | Combat → plateau | Sections buffs / debuffs | `bdl-section-header` | `features/fight/BuffDebuffList.tsx` |
| [ ] | Combat → plateau | Cimetière (pile et ✕) | `gp-pile`, `gp-close` (arrondi recopié) | `features/fight/GraveyardPile.tsx` |
| [ ] | Combat → onglets du bas | Onglets | `ftb-tab` (arrondi recopié) | `features/fight/FightTabBar.tsx` |
| [ ] | Combat → choix de carte | Confirmer (couleur selon l'effet) | `cpm-btn-confirm` | `features/fight/CardPickModal.tsx` |
| [ ] | Arène (`/arena`) | Cartes Deck Builder / Combat | `fh-card` | `pages/FightHub.tsx` |
| [ ] | Règles du combat | Étapes du fil d'Ariane | `fr-bc-step` | `features/fight/FightRules.tsx` |
| [ ] | Admin → assistants | Points d'étapes | `bm-stepper__dot` (padding recopié) | `features/*/…Manager.tsx` |
| [ ] | Marché → Mettre en vente | Vignettes de cartes / objets | `marketplace-card-pick`, `marketplace-item-pick` | `features/marketplace/CreateListingModal.tsx` |
| [ ] | Accueil → ouverture rapide | Vignettes de boosters | `opening-selector__thumb` | `features/opening/OpeningQuickAccess.tsx` |
| [ ] | Récompense quotidienne | Options de rachat (jours) | `drm-rescue-option` | `components/DailyRewardModal.tsx` |
| [ ] | Toutes les pages | Navigation du pied de page | `cc-footer__item` | `components/Footer.tsx` |
| [ ] | Connexion (`/login`) | Œil du mot de passe | `login-password-toggle` | `pages/Login.tsx` |
