# Refonte mobile du HUD de combat : plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**Objectif :** jouer un tour entier de combat sur un téléphone en portrait, sans scroll et sans appuyer sur le mauvais bouton.

**Architecture :** la logique de décision (phases accessibles, bilan d'énergie, contenu des confirmations, résumé d'effet) vit dans des modules purs testés unitairement. `FightBoard.tsx` reste l'orchestrateur : il garde une seule « action en attente » et ouvre une feuille de confirmation commune au lieu d'agir directement. La mise en page passe d'une page qui scrolle à une grille en `100dvh` avec un dock fixé en bas. Toutes les modales réutilisent `components/BottomSheet.tsx`.

**Stack :** React 18, TypeScript strict, react-i18next (fr/en/ko), Vitest + Testing Library, CSS par composant.

**Spec :** `docs/superpowers/specs/2026-11-01-fight-hud-mobile-design.md`

## Contraintes globales

- Frontend uniquement. Aucun changement dans `@pipou/shared` ni dans le backend. La valeur d'enum `end` est conservée, seuls les libellés changent.
- Icônes en SVG uniquement (`components/Icons.tsx`), aucun emoji dans les libellés. Supprimer ⚡ ⬆️ ✨ ♻️ ⚠️ 🏳️ dans les écrans touchés.
- Tout nouveau texte passe par i18n, dans les trois fichiers `i18n/locales/{fr,en,ko}.json`.
- Libellés français imposés :
  - « Phase de contrôle »
  - « À toi de jouer ! »
  - « Défausse X cartes »
  - « [N] énergie en trop, gardée en réserve »
  - « Invoquer [carte] en recyclant [X] et [Y] ? »
  - « Recycler [X] ? »
- Aucun bouton ne disparaît d'un emplacement de la barre d'actions : il est grisé (`disabled`).
- Toute utilisation de carte passe par une confirmation. Cela couvre : invocation (gratuite ou payante), Zeta, support (Éphémère, Terrain, Équipement), évolution, transformation, recyclage et défausse.
- L'appui long est supprimé partout.
- Énergie : chaque carte recyclée rapporte 1 énergie, comme aujourd'hui (`SummonCostModal.tsx:70-71`). La réserve `recycleEnergy` est utilisée en premier, et le surplus reste en réserve (comportement serveur).
- Respecter `useAnimationPrefs().reduced`. Avec les animations réduites, la bannière de tour s'affiche sans mouvement.
- Commits sur `dev`.

## Points de vigilance pour la revue

1. **Double appui sur « Confirmer »** : l'action doit partir une seule fois. La feuille se ferme et l'action en attente est vidée avant l'envoi.
2. **État de jeu qui change pendant qu'une confirmation est ouverte** (fin du timer, tour adverse) : la confirmation se ferme et rien n'est envoyé.
3. **Petit écran (360×640) avec une main de 7 cartes ou plus** : rien ne déborde et la page n'a pas de scroll vertical. L'éventail se resserre, il ne passe pas à la ligne.
4. **« Finir le tour » depuis la phase principale avec une main au-dessus de `HAND_LIMIT`** : l'option est grisée avec « Défausse X cartes ». Aucune chaîne de `end_phase` ne doit atterrir bloquée en phase de contrôle.
5. **Retour sur la page de combat après la fin du match** (ou navigation vers une autre route) : l'en-tête et le pied de page de l'app réapparaissent.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| Créer `features/fight/phaseMenu.ts` | `phaseOptions()` : phases suivantes accessibles et nombre de `end_phase` à envoyer pour chacune |
| Créer `features/fight/PhaseMenu.tsx` + `.css` | Menu ouvert par la pastille de phase |
| Créer `features/fight/payment.ts` | `paymentBalance()` : énergie manquante et surplus |
| Créer `features/fight/pendingAction.ts` | Type `PendingAction` et `confirmText()` (texte de la confirmation) |
| Créer `features/fight/ConfirmActionSheet.tsx` + `.css` | Feuille de confirmation commune |
| Créer `features/fight/TurnBanner.tsx` + `.css` | Animation « À toi de jouer ! » |
| Créer `features/fight/EnergyCounter.tsx` + `.css` | Compteur d'énergie flottant |
| Créer `features/fight/CardDrawer.tsx` + `.css` | Tiroir d'info, ouvert par le « i » |
| Créer `features/fight/useHideAppChrome.ts` | Masque l'en-tête et le pied de page de l'app pendant le combat |
| Modifier `features/fight/effectText.ts` | Ajout de `effectSummary()` |
| Modifier `features/fight/InspectableCard.tsx` | Suppression de l'appui long, ajout du bouton « i » |
| Modifier `features/fight/FightHUD.tsx` + `.css` | Pastille colorée, menu des phases, icônes logs / cimetières / abandon |
| Modifier `features/fight/FightActionBar.tsx` + `.css` | Deux emplacements fixes |
| Modifier `features/fight/FightBoard.tsx` + `.css` | Grille sans scroll, action en attente, branchements |
| Modifier `features/fight/FightLog.tsx`, `GraveyardPile.tsx` | Contenu affiché dans un `BottomSheet` |
| Modifier `i18n/locales/{fr,en,ko}.json` | Libellés |
| Modifier `src/index.css` (ou la feuille globale qui porte `.cc-header`) | Règle `body.in-fight` |

Les tests unitaires vont dans `src/__tests__/fight/<module>.test.ts(x)`. Les tests de plateau existants sont dans `src/__tests__/components/FightBoard.test.tsx`, avec l'aide `renderBoard()` et `state()`.

---

### Tâche 1 : Menu des phases (logique et composant) et renommage

**Fichiers :**
- Créer : `features/fight/phaseMenu.ts`, `features/fight/PhaseMenu.tsx`, `features/fight/PhaseMenu.css`
- Modifier : `i18n/locales/{fr,en,ko}.json`
- Test : `src/__tests__/fight/phaseMenu.test.ts`, `src/__tests__/fight/PhaseMenu.test.tsx`

**Interfaces :**
- Produit :
  - `type PhaseTarget = "battle" | "end" | "endTurn"`
  - `interface PhaseOption { target: PhaseTarget; steps: number; disabledReason?: "discard" }`
  - `phaseOptions(phase: Phase, handSize: number): PhaseOption[]`
  - `<PhaseMenu options={PhaseOption[]} discardCount={number} onPick={(o: PhaseOption) => void} onClose={() => void} />`

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
it("main propose combat, contrôle et finir le tour", () => {
  expect(phaseOptions("main", 5)).toEqual([
    { target: "battle", steps: 1 },
    { target: "end", steps: 2 },
    { target: "endTurn", steps: 3 },
  ]);
});
it("battle ne propose jamais de revenir en arrière", () => {
  expect(phaseOptions("battle", 5).map((o) => o.target)).toEqual(["end", "endTurn"]);
});
it("end : finir le tour seulement", () => {
  expect(phaseOptions("end", 5)).toEqual([{ target: "endTurn", steps: 1 }]);
});
it("main avec main trop pleine : finir le tour grisé, contrôle autorisé", () => {
  const o = phaseOptions("main", HAND_LIMIT + 2);
  expect(o.find((x) => x.target === "endTurn")?.disabledReason).toBe("discard");
  expect(o.find((x) => x.target === "end")?.disabledReason).toBeUndefined();
});
it("waiting / mulligan / finished : aucune option", () => {
  expect(phaseOptions("mulligan", 5)).toEqual([]);
});
```

`PhaseMenu.test.tsx` :
- une option grisée affiche « Défausse 2 cartes » et ne déclenche pas `onPick` ;
- un clic sur « Combat » appelle `onPick` avec `{ target: "battle", steps: 1 }`.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Commande : `pnpm --filter @pipou/frontend test phaseMenu PhaseMenu`. Attendu : ÉCHEC, module introuvable.

- [ ] **Étape 3 : implémenter `phaseOptions` et `PhaseMenu`**

- `PhaseMenu` est un petit menu ancré sous la pastille, fermé par un appui à l'extérieur ou par Échap.
- i18n :
  - `fight.phase.end` devient « Phase de contrôle » (en : "Control phase", ko : "컨트롤 페이즈") ;
  - ajouter `fight.phaseMenu.{battle,end,endTurn,title}` : « Combat », « Phase de contrôle », « Finir le tour » ;
  - ajouter `fight.phaseMenu.discard` : « Défausse {{count}} cartes ».
  - Dans `fight.endPhase.battle`, remplacer « Fin de Tour » par « Phase de contrôle ». Cette clé disparaît à la tâche 6, mais elle doit rester cohérente d'ici là.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Même commande. Attendu : SUCCÈS.

- [ ] **Étape 5 : commit** `feat(fight): menu des phases et renommage en phase de contrôle`

---

### Tâche 2 : Bilan de paiement et texte des confirmations

**Fichiers :**
- Créer : `features/fight/payment.ts`, `features/fight/pendingAction.ts`
- Test : `src/__tests__/fight/payment.test.ts`, `src/__tests__/fight/pendingAction.test.ts`

**Interfaces :**
- Produit :
  - `paymentBalance(cost: number, reserve: number, recycledCount: number): { missing: number; surplus: number }`
  - Le type `PendingAction`, union discriminée sur `kind` :
    ```ts
    type PendingAction =
      | { kind: "summon"; handIndex: number; zoneIndex: number; payIndices: number[] }
      | { kind: "summonZeta"; handIndex: number; oppZoneIndex: number; payIndices: number[] }
      | { kind: "evolve"; handIndex: number; targetInstanceId: string; payIndices: number[] }
      | { kind: "playSupport"; handIndex: number; zoneIndex?: number; targetInstanceId?: string }
      | { kind: "transform"; handIndex: number }
      | { kind: "recycle"; handIndex: number }
      | { kind: "discard"; handIndex: number };
    ```
  - `interface ConfirmText { key: string; params: Record<string, string | number>; warning?: { key: string; params: Record<string, number> } }`
  - `confirmText(action: PendingAction, ctx: { handNames: string[]; targetName?: string; cost: number; reserve: number }): ConfirmText`. La fonction renvoie des clés i18n et non du texte traduit, ce qui la garde pure.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
it("la réserve paie en premier, puis les cartes recyclées", () => {
  expect(paymentBalance(3, 1, 2)).toEqual({ missing: 0, surplus: 0 });
});
it("manque d'énergie", () => {
  expect(paymentBalance(4, 1, 1)).toEqual({ missing: 2, surplus: 0 });
});
it("surplus : seule l'énergie des cartes recyclées compte", () => {
  expect(paymentBalance(2, 1, 3)).toEqual({ missing: 0, surplus: 2 });
});
it("coût 0 ou gratuit : tout recyclage est en surplus", () => {
  expect(paymentBalance(0, 0, 1)).toEqual({ missing: 0, surplus: 1 });
});
```

Cas couverts par `pendingAction.test.ts` :
- `summon` avec `payIndices` [1, 2] donne la clé `fight.confirm.summonRecycling` et les paramètres `{ card, recycled: "X et Y" }`. La liste est jointe par `Intl.ListFormat` dans la langue courante, que le test fixe à `fr`.
- `summon` sans recyclage donne `fight.confirm.summon`.
- Un surplus de 2 donne `warning` avec la clé `fight.confirm.surplus` et `{ count: 2 }`.
- `recycle` donne `fight.confirm.recycle`, avec `{ card }`.
- `evolve` donne `fight.confirm.evolve`, avec `{ card, target }`.
- `discard`, `transform` et `playSupport` ont chacun leur clé.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Commande : `pnpm --filter @pipou/frontend test payment pendingAction`. Attendu : ÉCHEC.

- [ ] **Étape 3 : implémenter les deux modules et ajouter les clés `fight.confirm.*` en fr/en/ko**

Textes français :
- `summonRecycling` : « Invoquer {{card}} en recyclant {{recycled}} ? »
- `summon` : « Invoquer {{card}} ? »
- `recycle` : « Recycler {{card}} ? »
- `evolve` : « Faire évoluer {{target}} en {{card}} ? »
- `transform` : « Transformer {{card}} ? »
- `play` : « Jouer {{card}} ? »
- `discard` : « Défausser {{card}} ? »
- `surplus` : « {{count}} énergie en trop, gardée en réserve »
- `missing` : « Il manque {{count}} énergie »
- `confirm` : « Confirmer »
- `cancel` : « Annuler »

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

- [ ] **Étape 5 : commit** `feat(fight): bilan de paiement et textes de confirmation`

---

### Tâche 3 : Feuille de confirmation

**Fichiers :**
- Créer : `features/fight/ConfirmActionSheet.tsx`, `features/fight/ConfirmActionSheet.css`
- Test : `src/__tests__/fight/ConfirmActionSheet.test.tsx`

**Interfaces :**
- Consomme : `ConfirmText` (tâche 2), `components/BottomSheet`
- Produit : `<ConfirmActionSheet text={ConfirmText} onConfirm={() => void} onCancel={() => void} />`

- [ ] **Étape 1 : écrire les tests qui échouent**
  - le message traduit s'affiche ;
  - si `warning` est présent, l'avertissement apparaît dans un élément `role="alert"` avec une icône d'alerte ;
  - deux clics rapides sur « Confirmer » n'appellent `onConfirm` qu'une seule fois (point de vigilance 1) ;
  - « Annuler » et Échap appellent `onCancel`.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

- [ ] **Étape 3 : implémenter**

Un garde-fou local (ref booléen) bloque le second clic. L'avertissement est en couleur d'alerte et bien visible (spec : « en mode attention »). « Confirmer » est le bouton principal, à droite. « Annuler » est à gauche.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

- [ ] **Étape 5 : commit** `feat(fight): feuille de confirmation des actions`

---

### Tâche 4 : Résumé d'effet et tiroir d'info, remplacement de l'appui long

**Fichiers :**
- Modifier : `features/fight/effectText.ts`, `features/fight/InspectableCard.tsx` + `.css`
- Créer : `features/fight/CardDrawer.tsx`, `features/fight/CardDrawer.css`
- Modifier les appelants de `onInspect` / `onInspectEnd` : `FightHand`, `Zonerow/ZoneRow`, `GraveyardPile`, `CardPickModal`, `MulliganPanel`
- Test : `src/__tests__/fight/effectSummary.test.ts`, `src/__tests__/fight/InspectableCard.test.tsx`

**Interfaces :**
- Produit :
  - `effectSummary(effects: CardEffect[] | undefined, t: TFunction): string` : une seule ligne, 90 caractères au plus, terminée par « … » si elle est tronquée, et chaîne vide sans effet. Elle reprend le texte du premier effet tel que le produit déjà `effectText.ts`. Les mots-clés passent en étiquettes à part et sont exclus du résumé.
  - `InspectableCard` : les props `onInspect` et `onInspectEnd` sont supprimées. Nouvelles props : `selected?: boolean` et `onInfo?: () => void`. Quand `selected && onInfo`, un bouton « i » (`aria-label={t("fight.info")}`) s'affiche dans un coin de la carte. Son clic appelle `onInfo` avec `stopPropagation`.
  - `<CardDrawer card={CardInstance | MonsterOnBoard} onClose={() => void} />` est un `BottomSheet` en deux états :
    - état replié : illustration, nom, stats, étiquettes de mots-clés (`KeywordIcon`) et `effectSummary` ;
    - état déplié : en plus, le texte complet via `CardEffectSheet` et `BuffDebuffSections`.

    On le déplie par un glissement vers le haut ou par le bouton « Voir tout », et on le ferme par un glissement vers le bas, le fond, la croix ou Échap.

- [ ] **Étape 1 : écrire les tests qui échouent**
  - `effectSummary` : un effet long donne une ligne de 90 caractères au plus finissant par « … » ; sans effet, le résultat est `""`.
  - `InspectableCard` : le bouton « i » est absent si la carte n'est pas sélectionnée et présent si elle l'est. Cliquer « i » appelle `onInfo` mais pas `onClick`. Un appui maintenu de 800 ms n'ouvre rien.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

- [ ] **Étape 3 : implémenter, puis brancher les appelants**

Chaque appelant garde un état local `drawerCard` et affiche `<CardDrawer>` à la place de `CardInspect`. La règle de sélection est la suivante :
- en main et sur le terrain du joueur, la sélection existante sert ;
- sur le terrain adverse, au cimetière et dans `CardPickModal`, un appui sélectionne localement la carte (bordure), sans autre effet.

Supprimer `useLongPress` des imports devenus inutiles, ainsi que le hook s'il n'a plus d'appelant (vérifier avec `Grep`).

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Commande : `pnpm --filter @pipou/frontend test`. Attendu : SUCCÈS, y compris pour les tests existants (adapter ceux qui simulaient un appui long).

- [ ] **Étape 5 : commit** `feat(fight): tiroir d'info via le bouton i, fin de l'appui long`

---

### Tâche 5 : HUD (pastille de tour, menu des phases, icônes et compteur d'énergie)

**Fichiers :**
- Modifier : `features/fight/FightHUD.tsx` + `.css`, `features/fight/FightLog.tsx`, `features/fight/GraveyardPile.tsx`
- Créer : `features/fight/EnergyCounter.tsx` + `.css`
- Test : `src/__tests__/fight/FightHUD.test.tsx`

**Interfaces :**
- Consomme : `phaseOptions`, `PhaseMenu` (tâche 1)
- Produit, nouvelles props de `FightHUD` :
  - `onPickPhase: (o: PhaseOption) => void`
  - `handSize: number`
  - `onOpenLog: () => void`
  - `onOpenGraveyard: (side: "me" | "opponent") => void`
  - `onSurrender?: () => void`
- Produit : `<EnergyCounter value={number} />`
- `FightLog` et `GraveyardPile` exposent leur contenu dans un `BottomSheet` : `<FightLogSheet entries onClose />` ; `GraveyardPile` reçoit `open` et `onClose` contrôlés depuis le HUD.

- [ ] **Étape 1 : écrire les tests qui échouent**
  - la pastille porte la classe `hud-phase-chip--mine` quand `isMyTurn`, et `--theirs` sinon ;
  - pendant le tour du joueur, un appui sur la pastille ouvre le menu des phases ; pendant le tour adverse, il ne fait rien ;
  - choisir « Finir le tour » appelle `onPickPhase` avec `{ target: "endTurn", steps: 3 }` depuis la phase principale ;
  - les boutons d'icône « Journal », « Cimetière » et « Abandonner » existent avec leur `aria-label` et appellent leurs callbacks.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

- [ ] **Étape 3 : implémenter**

- Couleurs de la pastille : vert pour le tour du joueur, gris pour le tour adverse, via des variables CSS existantes si elles existent, sinon nouvelles.
- `EnergyCounter` est en `position: fixed`, à gauche, au milieu de la hauteur, avec un `z-index` supérieur au plateau et inférieur aux feuilles. Il affiche une icône d'énergie SVG (en ajouter une dans `Icons.tsx` si elle manque) et la valeur.
- L'abandon garde le `window.confirm` existant de `FightPage.tsx:99`.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

- [ ] **Étape 5 : commit** `feat(fight): HUD avec pastille de tour, menu des phases, journal et cimetières en feuilles`

---

### Tâche 6 : Barre d'actions à deux emplacements fixes

**Fichiers :**
- Modifier : `features/fight/FightActionBar.tsx` + `.css`
- Test : `src/__tests__/fight/FightActionBar.test.tsx`

**Interfaces :**

Nouvelles props :
```ts
interface Props {
  phase: Phase | undefined;
  isMyTurn: boolean;
  selectedCard: HandCard | null;
  attackerSelected: boolean;
  transformUsed: boolean;
  playBlockedReason?: string;
  onRecycle: () => void;
  onMain: () => void;
}
```

Le bouton de phase, l'abandon et l'avertissement de défausse quittent la barre : ils sont désormais dans le HUD et le menu des phases.

Contenu de l'emplacement principal, défini par `mainSlot(props): { labelKey: string; enabled: boolean; hintKey?: string }`, exporté pour les tests :

| Contexte | Libellé | Actif |
|---|---|---|
| phase `main` et monstre sélectionné | « Transformer » | si `canTransform` et `!transformUsed`, sinon grisé avec l'indication « Touche une zone pour invoquer » |
| phase `main` et Éphémère sélectionné | « Jouer » | si aucune `playBlockedReason` |
| phase `main` et Terrain ou Équipement sélectionné | « Jouer » | grisé, indication « Touche une zone » ou « Touche un monstre » |
| phase `battle` et attaquant sélectionné | « Attaque directe » | oui |
| tour adverse ou rien de sélectionné | libellé de la dernière situation, sinon « Action » | grisé |

« Recycler » est actif seulement en phase `main` avec une carte sélectionnée, ou en phase `end` avec une main au-dessus de `HAND_LIMIT`. Dans ce cas, son libellé devient « Défausser ».

**Écart assumé par rapport à la spec :** l'invocation se déclenche en touchant une zone, puis en confirmant. L'emplacement principal ne contient donc jamais « Invoquer ». C'est ce qui libère la place pour « Transformer », qui n'a pas de cible.

- [ ] **Étape 1 : écrire les tests qui échouent**
  - pendant le tour adverse, la barre est rendue avec deux boutons, tous deux `disabled` ;
  - l'ordre dans le DOM est toujours Recycler puis Principal, quelle que soit la sélection ;
  - un monstre transformable en phase `main` donne « Transformer » actif ;
  - un monstre transformable avec `transformUsed` donne « Transformer » grisé ;
  - en phase `end` avec une main au-dessus de `HAND_LIMIT`, Recycler affiche « Défausser » et reste actif ;
  - aucun libellé de bouton ne contient d'emoji (test : `/\p{Extended_Pictographic}/u`).

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

- [ ] **Étape 3 : implémenter**

Supprimer les clés i18n `fight.endPhase.*` et `fight.bar.summon*` si plus rien ne les utilise.

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

- [ ] **Étape 5 : commit** `feat(fight): barre d'actions à emplacements fixes`

---

### Tâche 7 : Plateau (action en attente et confirmations partout)

**Fichiers :**
- Modifier : `features/fight/FightBoard.tsx`
- Test : `src/__tests__/components/FightBoard.test.tsx`, avec `renderBoard()` et `state()`

**Interfaces :**
- Consomme : `PendingAction`, `confirmText`, `paymentBalance`, `ConfirmActionSheet` (tâches 2 et 3), `FightActionBar` (tâche 6), `FightHUD` (tâche 5)
- Les props de `FightBoard` et `useBoardControls` restent inchangées.

**Comportement à câbler :**
- Nouvel état local `pending: PendingAction | null`. Tous les endroits qui appellent aujourd'hui directement `onSummon`, `onSummonZeta`, `onEvolve`, `onPlaySupport`, `onTransform`, `onRecycleSupport` ou `onDiscardCard` (`handleCardClick`, `handleZoneClick`, `handleOpponentZoneClick`, `handleSupportZoneClick`, ainsi que la barre) font désormais `setPending(...)`.
- La confirmation appelle le callback correspondant, puis `clearSelection`.
- Recyclage rapide : `handleCardClick` fait déjà le principe (première carte sélectionnée, les suivantes vont dans `payIndices`), on le garde. Seul changement : un appui sur la carte « à invoquer » annule toute la sélection, ce qui est déjà le cas, à vérifier par un test. Les cartes de `payIndices` reçoivent une marque visuelle distincte de la sélection.
- Appui sur une zone vide avec un monstre sélectionné : calculer `paymentBalance(cost, recycleEnergy, payIndices.length)`. Le coût vaut 0 pour une carte présente dans `freeSummonInstanceIds`.
  - Si `missing > 0` : pas de confirmation. Afficher un message court « Il manque N énergie » au-dessus du dock pendant 2 s (toast local `role="status"`).
  - Sinon : `setPending({ kind: "summon", ... })`. `confirmText` ajoute l'avertissement de surplus.
- L'évolution suit la même logique avec `evolutionCost()`. Le Zeta aussi.
- `SummonCostModal` n'est conservée que pour la Relève, qui demande de choisir des alliés. Le chemin `setShowSummonModal` hors Relève est supprimé.
- Une confirmation ouverte se ferme sans rien envoyer si `gs.isMyTurn` passe à `false` ou si `gs.phase` change (point de vigilance 2). Cela se dérive au rendu : on n'affiche la feuille que si `pending` existe et que la phase et le tour sont ceux mémorisés à l'ouverture.
- `onPickPhase(o)` appelle `onEndPhase()` `o.steps` fois. Il est refusé si `o.disabledReason` est défini.

- [ ] **Étape 1 : écrire les tests qui échouent dans `FightBoard.test.tsx`**
  - Monstre de coût 2, réserve 0, deux cartes recyclées, appui sur une zone vide : la feuille affiche « Invoquer … en recyclant … et … ? ». « Confirmer » envoie `onSummon` avec `[1, 2]`.
  - Même cas avec trois cartes recyclées : la feuille affiche « 1 énergie en trop, gardée en réserve ».
  - Coût 3, réserve 0, une carte recyclée : pas de feuille, le message « Il manque 2 énergie » s'affiche et `onSummon` n'est pas appelé.
  - Carte gratuite : appui sur la zone, puis une feuille s'affiche. `onSummon` n'est appelé qu'après « Confirmer ».
  - « Recycler » dans la barre : la feuille « Recycler X ? » s'affiche, et « Annuler » n'envoie rien.
  - Évolution : sélection du Jeune, appui sur le Bébé allié, puis la feuille « Faire évoluer … ». Cela remplace le test existant qui ouvrait `SummonCostModal`.
  - Feuille ouverte puis `rerender` avec `isMyTurn: false` : la feuille disparaît et aucun callback n'est appelé.
  - Menu des phases en `main`, choix de « Finir le tour » : `onEndPhase` est appelé 3 fois.

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

- [ ] **Étape 3 : implémenter**

- [ ] **Étape 4 : lancer la suite frontend et le typecheck**

Commandes : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck`. Attendu : SUCCÈS.

- [ ] **Étape 5 : commit** `feat(fight): confirmation de toute action de carte et recyclage rapide`

---

### Tâche 8 : Mise en page sans scroll, chrome masqué et bannière de tour

**Fichiers :**
- Modifier : `features/fight/FightBoard.tsx` + `.css`, `features/fight/FightHand.css`
- Créer : `features/fight/useHideAppChrome.ts`, `features/fight/TurnBanner.tsx` + `.css`
- Modifier : la feuille globale de `.cc-header` et `.cc-footer`
- Test : `src/__tests__/fight/useHideAppChrome.test.tsx`, `src/__tests__/fight/TurnBanner.test.tsx`

**Interfaces :**
- Produit :
  - `useHideAppChrome(): void` : ajoute la classe `in-fight` à `document.body` au montage et la retire au démontage.
  - `<TurnBanner isMyTurn={boolean} turnNumber={number} />` : s'affiche environ 1,2 s quand `isMyTurn` passe de `false` à `true`, ou au premier rendu si `isMyTurn` est vrai et `turnNumber > 0`.

**Mise en page :**
- `.fb-wrap` devient une grille en `height: 100dvh` sans scroll, avec les rangées `auto` (HUD) / `1fr` (plateau) / `auto` (dock).
- Le plateau contient la rangée de supports adverses, celle des monstres adverses, une séparation, la rangée de monstres du joueur et celle de ses supports. Les cartes et les zones sont dimensionnées en `min()` / `clamp()` à partir de la hauteur disponible, avec les deux terrains à la même taille.
- Le dock contient `FightHand` (éventail, `z-index` au-dessus du plateau) et `FightActionBar`.
- Les piles de cimetière quittent le plateau, puisqu'on y accède depuis le HUD.
- Le journal n'est plus affiché en bas de page.
- Le bouton « Attaque directe » quitte le milieu du plateau, puisqu'il est dans l'emplacement principal (tâche 6).
- Règle globale : `body.in-fight .cc-header, body.in-fight .cc-footer { display: none; }`.
- Brancher `useHideAppChrome()` dans `FightBoard`, qui couvre à la fois le duel, l'aventure et le sandbox.

- [ ] **Étape 1 : écrire les tests qui échouent**
  - `useHideAppChrome` : la classe est posée au montage et retirée au démontage (point de vigilance 5).
  - `TurnBanner` :
    - le texte « À toi de jouer ! » apparaît après un `rerender` de `false` à `true` ;
    - il n'apparaît pas lors d'un passage de `true` à `false` ;
    - il disparaît après 1,2 s (`vi.useFakeTimers`).

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

- [ ] **Étape 3 : implémenter**

`TurnBanner` affiche un fond assombri plein écran qui ne capte pas les appuis (`pointer-events: none`) et un texte centré animé. Si `reduced` est actif, le texte s'affiche sans animation.

- [ ] **Étape 4 : lancer les tests, le typecheck et le lint**

Commande : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`. Attendu : SUCCÈS.

- [ ] **Étape 5 : vérification visuelle**

Lancer `pnpm dev` et ouvrir un combat contre l'IA en émulation mobile 360×640 puis 390×844. Vérifier :
- aucun scroll vertical ;
- la main est visible ;
- avec 7 cartes, l'éventail se resserre sans passer à la ligne (point de vigilance 3) ;
- le compteur d'énergie ne recouvre aucune zone utile ;
- l'en-tête et le pied de page de l'app réapparaissent après le match.

- [ ] **Étape 6 : commit** `feat(fight): écran de combat sans scroll, dock fixe et bannière de tour`
