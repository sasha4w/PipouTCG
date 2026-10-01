# Système de boutons — Liste de vérification

À parcourir dans l'appli (`pnpm dev`) : coche chaque ligne après avoir vérifié le bouton (couleur, survol, appui, état désactivé, état actif s'il y en a un).

Rappel des variantes :
- fond clair : `primary` (bordeaux plein), `ghost-bordeaux` (bordeaux léger, plein si actif), `danger` (rose, texte rose soutenu) ;
- fond foncé : `primary-inverse` (crème, texte bordeaux), `ghost-gold` (transparent, doré si actif), `danger-inverse` (rose, texte rose vif).

| ✓ | Écran (chemin dans l'appli) | Bouton | Ancienne classe | Variante / taille | Fichier |
|---|---|---|---|---|---|

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

## Quêtes et récompenses

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
