# Rework du formulaire de création de carte — design

## Intention
L'admin veut créer une carte **de A à Z** depuis le panneau (`apps/frontend/src/features/cards/CardManager.tsx`), sans passer par les fichiers seed (`apps/backend/src/database/*-cards.ts`). Aujourd'hui c'est impossible :
- **Aucun éditeur d'effets** : `effects` est chargé à l'édition et renvoyé tel quel, mais rien ne permet de le saisir. Immunités et statuts sont des actions d'effet (`SET_*_IMMUNITY`, `SET_TAUNT`, …) : ils manquent donc aussi.
- **SVG refusé** : le back n'accepte que `image/png|jpeg|webp` (`cards.controller.ts`) et ImgBB ne prend pas le SVG.
- Les champs Support (emplacement, Terrain, Charge) existent déjà (commit `1633ed0`) mais doivent s'intégrer au nouveau déroulé.

Le formulaire doit refléter le moteur : tout ce que le DTO `CreateCardDto` / `CardEffectDto` accepte doit être saisissable, et rien de ce qu'il refuse.

## Objectifs
1. Éditeur d'effets complet couvrant `CardEffect` : `trigger`, `condition?`, `actions[]` (chaque action : `type`, `target`, `value?`, `duration?`, `archetype?`, `filter?`, `valueIf?`).
2. Déroulé guidé, type d'abord puis effet.
3. Upload SVG accepté via conversion en **WebP** côté navigateur.
4. Même formulaire pour création et édition (pré-rempli).

## Non-objectifs
- Pas de changement du moteur ni de nouvelles actions/triggers.
- Pas de changement du stockage des images (ImgBB reste).
- Mode Charge `CYCLIC` : reste grisé « bientôt » (cf. `2026-11-02-support-rework-design.md`).

## Anti-objectifs
- Un formulaire qui laisse soumettre une combinaison que le back refuse (ex. `DEAL_DAMAGE` sur `PLAYER`/`OPPONENT`, champ de support hors de son sous-type).
- Des listes redéfinies à la main dans le front : les valeurs viennent des enums de `@pipou/shared` (règle du monorepo).
- Emoji dans l'UI : icônes SVG (`Icons.tsx`).

## Déroulé (décidé)
1. **Type** : Monstre / Support, puis sous-type de support (Éphémère, Équipement, Persistant, Charge).
2. **Base** : nom, set, rareté, coût ; archétype, élément, stade, lignée.
3. **Champs propres au type** — seuls ceux qui s'appliquent sont affichés :
   - Monstre : ATK, PV.
   - Équipement : emplacement.
   - Persistant : case Terrain.
   - Charge : charge max, mode (Cyclique grisé).
4. **Effets** (éditeur phrase à trous, ci-dessous).
5. **Image + lore**, avec aperçu de la carte en direct.

## Éditeur d'effets — phrase à trous (décidé)
- La carte a 0..n effets. Chaque effet se lit comme le texte de carte :
  « **Quand** [déclencheur], **si** [condition] : » puis une ligne par action, ex. « inflige [2] dégâts à [l'ennemi le plus fort] », « donne [immunité aux statuts] à [soi-même] pendant [1] tour ».
- Condition facultative.
- Chaque trou est cliquable et ouvre le choix correspondant. Une action n'affiche que les trous pertinents pour son type (valeur, cible, durée, archétype, filtre, `valueIf`).
- Ajout / suppression d'action et d'effet.
- Validation en direct alignée sur le DTO : cibles interdites non proposées, champs requis signalés avant soumission.

## Image (décidé)
- Fichier SVG choisi → rasterisé dans le navigateur (canvas) → envoyé en **WebP**. PNG/JPEG/WebP passent tels quels.
- `accept` du champ fichier inclut `image/svg+xml`. Le back n'est pas modifié (il reçoit du WebP).

## Descriptions
- **Texte d'effet** : déjà généré à l'affichage à partir de `effects` par `describeCardEffects` (`apps/frontend/src/features/fight/effectText.ts`). Le formulaire le montre en direct sous l'éditeur et dans l'aperçu, en réutilisant cette fonction ; il n'est pas stocké.
- **Lore** : la colonne `description` existante, saisie à la main, jamais régénérée. À l'édition, elle est conservée telle quelle.

## Laissé au builder
- Les libellés français de chaque valeur d'enum et le gabarit de phrase par `ActionType` (via un `Record<ActionType, …>` exhaustif, pour que TypeScript signale toute nouvelle valeur ; à défaut d'un libellé, afficher le nom technique).
- Quels triggers proposer par type de carte (ex. `ON_CHARGED` pour une Charge seulement, pas `ON_ATTACK` pour un Persistant) : déduire des usages dans le moteur et les cartes seed ; en cas de doute, proposer.
- Quels champs chaque `ActionType` utilise : déduire du moteur (`apps/backend/src/fights/`) et des cartes seed.
- Résolution de rasterisation des SVG (dimensions des images de carte existantes) et qualité WebP.
- Découpage de `CardManager.tsx` (914 lignes) en composants.
- Tests : unitaires sur la sérialisation des effets et la conversion SVG→WebP, test de création par type.

## Précisions après relecture
- **Source des règles** : le DTO refuse déjà `DEAL_DAMAGE` sur joueur (`DamageTargetsMonsters`) et les champs support hors sous-type (`SupportFieldsMatchType`). La table « action → cibles / champs autorisés » est créée dans `@pipou/shared` (sans dépendance runtime) et utilisée par le front ; le DTO peut s'y brancher sans changer ce qu'il accepte aujourd'hui. *Choix de Claude.*
- **Condition** : `EffectCondition` est plate (`type`, `value?`, `match?`, `element?`, `stage?`), pas d'imbrication. `valueIf` = une condition + une valeur, éditable comme trou d'action. Tout est éditable.
- **Cartes existantes non représentables** : à l'édition, tout champ que l'éditeur ne sait pas afficher est conservé tel quel et signalé (« champ avancé conservé ») ; jamais perdu à la sauvegarde. *Choix de Claude.*
- **Seed** : les fichiers `*-patches.ts` / `*-cards.ts` passent par des migrations jouées une seule fois ; ils n'écrasent pas les cartes créées ou modifiées dans le panneau.
  *Vérifié (2026-11-02)* : ces patches ne sont appelés que depuis `apps/backend/src/database/migrations/` (jouées une seule fois) ; `applyBalancePatches` ne modifie pas une carte dont le contenu diffère de l'attendu (elle logue un avertissement). Aucun script de seed ne tourne au démarrage. Une carte créée ou modifiée dans le panneau n'est donc pas écrasée.

## Choix faits par Claude (à vérifier)
- Les listes viennent des enums partagés avec un libellé FR, fallback nom technique.
- Le formulaire bloque d'avance les combinaisons refusées par le back.
- Aperçu de carte en direct.
- Triggers filtrés par type de carte.
