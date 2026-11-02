# Rework du formulaire de carte — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Permettre de créer et modifier une carte de A à Z dans le panneau admin, effets, immunités et supports compris, avec upload SVG converti en WebP.

**Architecture :** Un schéma d'effets déclaratif dans `@pipou/shared` (champs et cibles permis par action, déclencheurs par type de carte) pilote un éditeur « phrase à trous » qui réutilise les gabarits i18n `effects.action.*`. `CardManager.tsx` est découpé : la liste reste, le formulaire part dans `features/cards/card-form/` en 5 étapes. Le back ne change pas.

**Tech Stack :** React 18 + TS strict, TanStack Query, i18next, Vitest + Testing Library ; `@pipou/shared` (zéro dépendance runtime) ; NestJS + Jest pour le test de couverture des cartes seed.

**Spec :** `docs/superpowers/specs/2026-11-02-card-form-rework-design.md`

## Global Constraints
- Tout type ou enum échangé front/back vit dans `@pipou/shared` ; jamais redéfini dans une app.
- `@pipou/shared` : aucune dépendance runtime. Après modification : `pnpm build:shared`.
- Front : pas de `any`, pas de composant déclaré dans un composant, état dérivé plutôt que synchronisé, erreurs via `apiErrorMessage`.
- Icônes SVG (`Icons.tsx`), jamais d'emoji.
- Charge `CYCLIC` : visible mais grisé « bientôt ».
- Le back n'est pas modifié (types acceptés à l'upload : `image/png|jpeg|webp`).
- Commits sur `dev`, jamais `main`.
- Textes d'interface en français via i18n (`fr.json`, et clés ajoutées aussi dans `en.json` et `ko.json`, en copiant le français si pas de traduction).

## Review Focus
1. **Carte existante avec un champ que l'éditeur n'affiche pas** (ex. `filter.excludeName`, `archetype` d'action, `valueIf`) : ouvrir puis enregistrer sans rien toucher doit renvoyer des `effects` identiques. Test : Task 4, `round-trips effects untouched`.
2. **Changement de type d'action** dans une ligne déjà remplie : les champs devenus interdits sont retirés, la cible est remise à la première cible permise si l'ancienne ne l'est plus. Test : Task 3, `drops fields not allowed by new action type`.
3. **Changement de type de carte** (Monstre → Support Charge) avec des effets déjà saisis : les effets dont le déclencheur n'est plus permis sont signalés en erreur, pas supprimés en silence. Test : Task 4, `flags effects whose trigger no longer fits`.
4. **SVG sans `width`/`height`** (seulement `viewBox`) ou SVG invalide : le premier est rasterisé à la taille cible, le second affiche une erreur claire au lieu d'envoyer. Test : Task 2.
5. **Nouvelle valeur d'enum ajoutée au moteur** : TypeScript échoue tant que le schéma ne la couvre pas (`Record<ActionType, …>` exhaustif), et l'UI affiche le nom technique si le libellé i18n manque. Test : Task 1 (exhaustivité) et Task 3 (fallback).

---

### Task 1 : Schéma d'effets partagé

**Files :**
- Create : `packages/shared/src/game/effect-schema.ts`
- Modify : `packages/shared/src/game/index.ts` (export)
- Test : `packages/shared/src/game/effect-schema.test.ts`
- Test : `apps/backend/src/database/effect-schema-coverage.spec.ts`

**Interfaces :**
- Produces :
  ```ts
  export type ActionField = "value" | "duration" | "archetype" | "filter" | "valueIf";
  export interface ActionSchema { fields: readonly ActionField[]; targets: readonly EffectTarget[] }
  export const ACTION_SCHEMA: Record<ActionType, ActionSchema>;
  export type CardKind = "monster" | SupportType;          // EPHEMERAL | EQUIPMENT | PERSISTENT | CHARGE
  export function cardKindOf(c: { type: CardType; supportType: SupportType | null | undefined }): CardKind;
  export const TRIGGERS_BY_KIND: Record<CardKind, readonly EffectTrigger[]>;
  export const CONDITION_FIELDS: Record<EffectConditionType, readonly ("value" | "match" | "element" | "stage")[]>;
  export type EffectIssue = { effect: number; action?: number; code: "trigger_not_allowed" | "target_not_allowed" | "field_not_allowed" | "value_required" | "no_actions" };
  export function validateEffects(kind: CardKind, effects: readonly CardEffect[]): EffectIssue[];
  ```
- Le contenu des tables se déduit du moteur (`apps/backend/src/fights/engine/`) et des cartes seed ; `DEAL_DAMAGE` exclut `PLAYER` et `OPPONENT` (miroir de `DamageTargetsMonsters`). `ON_CHARGED` seulement pour `CHARGE`.

- [ ] **Step 1 : Tests shared**
  - `ACTION_SCHEMA covers every ActionType` : `Object.keys(ACTION_SCHEMA).sort()` égal à `Object.values(ActionType).sort()`.
  - `DEAL_DAMAGE never targets players` : `ACTION_SCHEMA.DEAL_DAMAGE.targets` ne contient ni `PLAYER` ni `OPPONENT`.
  - `ON_CHARGED only for charge` : présent dans `TRIGGERS_BY_KIND.CHARGE`, absent de toutes les autres.
  - `validateEffects` : `[{trigger: ON_SUMMON, actions: []}]` pour `"monster"` → `[{effect:0, code:"no_actions"}]` ; action `DEAL_DAMAGE` cible `PLAYER` → `target_not_allowed` ; `ON_CHARGED` sur `"monster"` → `trigger_not_allowed`.
- [ ] **Step 2 :** `pnpm --filter @pipou/shared test effect-schema` → FAIL (module absent).
- [ ] **Step 3 :** Implémenter `effect-schema.ts`, exporter depuis `game/index.ts`.
- [ ] **Step 4 : Test de couverture back** `effect-schema-coverage.spec.ts` : pour toutes les cartes des seeds/patches (`DRAKON_ORIGINES_CARDS`, cartes de `apps/backend/src/fights/testing/real-cards.ts`, patches `*-patches.ts` qui portent des `effects`), `validateEffects(cardKindOf(card), card.effects ?? [])` renvoie `[]`. Un échec veut dire que la table est trop stricte : corriger la table, pas la carte.
- [ ] **Step 5 :** `pnpm build:shared && pnpm --filter @pipou/shared test && pnpm --filter @pipou/backend test effect-schema-coverage` → PASS.
- [ ] **Step 6 :** Commit `feat(shared): schéma déclaratif des effets (champs, cibles, déclencheurs)`.

### Task 2 : Conversion SVG → WebP

**Files :**
- Create : `apps/frontend/src/features/cards/card-form/svgToWebp.ts`
- Test : `apps/frontend/src/__tests__/unit/svgToWebp.test.ts`

**Interfaces :**
- Produces : `export async function prepareCardImage(file: File): Promise<File>` — renvoie le fichier tel quel si `png|jpeg|webp` ; si `image/svg+xml`, renvoie un `File` `image/webp` nommé `<base>.webp` ; sinon rejette `new Error("unsupported_image")`. SVG illisible → rejette `new Error("invalid_svg")`.
- Taille cible : la plus grande dimension des images de carte existantes (vérifier sur une image ImgBB d'une carte seed ; à défaut 750 px de large), ratio du `viewBox` respecté quand `width`/`height` manquent. Qualité WebP 0.9.

- [ ] **Step 1 : Tests** (canvas et `Image` mockés dans le test : `HTMLCanvasElement.prototype.toBlob` renvoie un `Blob` `image/webp`) :
  - `passes png through` : même instance renvoyée.
  - `converts svg to webp` : `type === "image/webp"`, `name === "logo.webp"`.
  - `uses viewBox when no width/height` : SVG `viewBox="0 0 100 200"` → canvas de ratio 1:2.
  - `rejects invalid svg` : `"<svg"` → `invalid_svg`.
  - `rejects gif` → `unsupported_image`.
- [ ] **Step 2 :** `pnpm --filter @pipou/frontend test svgToWebp` → FAIL.
- [ ] **Step 3 :** Implémenter (DOMParser pour lire `width`/`height`/`viewBox`, `Image` sur un blob URL, `canvas.toBlob(cb, "image/webp", 0.9)`).
- [ ] **Step 4 :** Test → PASS.
- [ ] **Step 5 :** Commit `feat(front): conversion des SVG en WebP avant upload`.

### Task 3 : Éditeur d'effets « phrase à trous »

**Files :**
- Create : `apps/frontend/src/features/cards/card-form/effect-editor/EffectEditor.tsx` (liste d'effets, + effet)
- Create : `.../effect-editor/EffectSentence.tsx` (Quand / si / actions)
- Create : `.../effect-editor/ActionSentence.tsx` (une ligne)
- Create : `.../effect-editor/Hole.tsx` (trou cliquable : popover avec select / nombre / filtre)
- Create : `.../effect-editor/effectDraft.ts` (fonctions pures)
- Create : `.../effect-editor/EffectEditor.css`
- Modify : `apps/frontend/src/i18n/locales/{fr,en,ko}.json` (clés `admin.effectEditor.*`)
- Test : `apps/frontend/src/__tests__/unit/effectDraft.test.ts`, `apps/frontend/src/__tests__/components/EffectEditor.test.tsx`

**Interfaces :**
- Consumes : Task 1 (`ACTION_SCHEMA`, `TRIGGERS_BY_KIND`, `CONDITION_FIELDS`, `validateEffects`, `CardKind`).
- Produces :
  ```ts
  // effectDraft.ts
  export function newEffect(kind: CardKind): CardEffect;                 // 1er trigger permis, 1 action DEAL_DAMAGE ou la 1re permise
  export function setActionType(a: EffectAction, type: ActionType): EffectAction; // retire champs interdits, recadre la cible
  export function setTrigger(e: CardEffect, t: EffectTrigger): CardEffect;
  // EffectEditor.tsx
  export default function EffectEditor(props: { kind: CardKind; value: CardEffect[]; onChange(v: CardEffect[]): void }): JSX.Element;
  ```
- Rendu d'une action : partir du gabarit `t("effects.action.<TYPE>")` brut (sans interpolation) et le découper sur les `{{placeholder}}` ; chaque `{{target}}`, `{{value}}`, `{{signed}}`, `{{duration}}`… devient un `Hole`. Le type d'action lui-même est un trou en tête de ligne. Champs du schéma absents du gabarit (`filter`, `valueIf`, `archetype`) : trous ajoutés en fin de ligne (« parmi [filtre] », « ou [3] si [condition] »). Libellé manquant (`i18n.exists` faux) → nom technique.
- Les champs présents dans l'action mais absents de `ACTION_SCHEMA[type].fields` ne sont **pas** affichés et sont conservés tels quels (badge « champ avancé conservé »).
- Les `EffectIssue` de `validateEffects` s'affichent sur la ligne concernée.

- [ ] **Step 1 : Tests `effectDraft`**
  - `drops fields not allowed by new action type` : action `BUFF_ATK_TEMP` avec `value:2, duration:1` → `setActionType(…, SET_TAUNT)` ne garde que les champs de `ACTION_SCHEMA.SET_TAUNT.fields`.
  - `retargets when target no longer allowed` : `HEAL` cible `PLAYER` → `DEAL_DAMAGE` : cible = `ACTION_SCHEMA.DEAL_DAMAGE.targets[0]`.
  - `newEffect(CHARGE)` a un trigger de `TRIGGERS_BY_KIND.CHARGE`.
- [ ] **Step 2 : Tests composant**
  - `renders sentence from i18n template` : effet `ON_SUMMON` + `DEAL_DAMAGE` `value 2` cible `STRONGEST_ENEMY` → texte contient le libellé FR du trigger et un trou affichant `2`.
  - `editing a hole calls onChange` : clic sur le trou valeur, saisie `3` → `onChange` reçoit `actions[0].value === 3`.
  - `falls back to technical name` : action dont la clé i18n n'existe pas (mock `i18n.exists`) → affiche `SET_HATCH_COUNTER`.
  - `shows issue on line` : `DEAL_DAMAGE` cible `PLAYER` passé en `value` → message d'erreur visible sur la ligne.
  - `adds and removes action/effect`.
- [ ] **Step 3 :** `pnpm --filter @pipou/frontend test effectDraft EffectEditor` → FAIL.
- [ ] **Step 4 :** Implémenter `effectDraft.ts`, puis les composants.
- [ ] **Step 5 :** Tests → PASS ; `pnpm --filter @pipou/frontend typecheck` → OK.
- [ ] **Step 6 :** Commit `feat(admin): éditeur d'effets en phrase à trous`.

### Task 4 : Formulaire en 5 étapes, aperçu en direct

**Files :**
- Create : `apps/frontend/src/features/cards/card-form/CardForm.tsx` (étapes, état, soumission)
- Create : `.../card-form/steps/TypeStep.tsx`, `BaseStep.tsx`, `TypeFieldsStep.tsx`, `EffectsStep.tsx`, `ImageStep.tsx`
- Create : `.../card-form/CardPreview.tsx` (`CardFace` + `describeCardEffects`)
- Create : `.../card-form/cardPayload.ts` (déplace `toCardPayload` et `emptyForm` de `CardManager.tsx`)
- Modify : `apps/frontend/src/features/cards/CardManager.tsx` (vue `edit` → `<CardForm card={editing} onDone=… />` ; supprime l'ancien formulaire, `STEPS`, états de formulaire)
- Test : `apps/frontend/src/__tests__/components/CardForm.test.tsx`, `apps/frontend/src/__tests__/unit/cardPayload.test.ts`

**Interfaces :**
- Consumes : Task 1 (`cardKindOf`, `validateEffects`), Task 2 (`prepareCardImage`), Task 3 (`EffectEditor`), `card.service.ts` (create/update existants), `describeCardEffects` (`features/fight/effectText.ts`), `CardFace`.
- Produces : `export default function CardForm(props: { card: Card | null; onDone(): void }): JSX.Element`.
- Étapes : 1 Type (Monstre / Support + sous-type) · 2 Base (nom, set, rareté, coût, archétype, élément, stade, lignée) · 3 Champs du type (Monstre : ATK/PV ; Équipement : emplacement ; Persistant : Terrain ; Charge : max + mode, `CYCLIC` grisé « bientôt » ; Éphémère : rien, étape sautée) · 4 Effets (`EffectEditor`, `kind = cardKindOf(form)`) · 5 Image + lore (`description`), image existante ou nouvelle via `prepareCardImage`, `accept="image/png,image/jpeg,image/webp,image/svg+xml"`.
- `CardPreview` visible à côté du formulaire à toutes les étapes (dessous en mobile 430 px).
- Bouton « Enregistrer » désactivé tant que `validateEffects` renvoie des issues ou qu'un champ requis manque ; la liste des problèmes est affichée.
- Erreur serveur : `apiErrorMessage(error)` affiché, formulaire conservé.

- [ ] **Step 1 : Tests `cardPayload`** — reprendre les cas existants de `toCardPayload` (monstre sans champs support, chaque sous-type ne garde que ses champs) ; `round-trips effects untouched` : carte avec `filter.excludeName` et `valueIf` → `toCardPayload(fromCard(card)).effects` deep-equal `card.effects`. Ajouter `export function fromCard(c: Card): CreateCardData` (logique actuelle de pré-remplissage, `CardManager.tsx:220-235`).
- [ ] **Step 2 : Tests `CardForm`** (service mocké)
  - `creates a monster` : étapes remplies → `createCard` appelé avec `type: MONSTER`, `atk`, `hp`, sans `supportType`.
  - `creates a charge support with ON_CHARGED effect` : payload `supportType: CHARGE`, `chargeMax`, `effects[0].trigger === ON_CHARGED`.
  - `skips type fields for ephemeral`.
  - `flags effects whose trigger no longer fits` : effet `ON_ATTACK` saisi, type changé en Support Persistant → issue visible, effet toujours présent, « Enregistrer » désactivé.
  - `edits keep lore` : `card.description = "Lore"` → payload `description === "Lore"`.
  - `converts svg on submit` : fichier SVG choisi → `createCard` reçoit un `File` `image/webp`.
  - `cyclic mode is disabled`.
- [ ] **Step 3 :** `pnpm --filter @pipou/frontend test CardForm cardPayload` → FAIL.
- [ ] **Step 4 :** Implémenter `cardPayload.ts`, les étapes, `CardPreview`, `CardForm`, brancher dans `CardManager.tsx`.
- [ ] **Step 5 :** `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint` → PASS.
- [ ] **Step 6 :** Vérif manuelle (`pnpm dev`, compte admin local) : créer un monstre avec immunité aux statuts, une Charge `ON_CHARGED`, un Équipement avec image SVG ; rouvrir une carte seed et l'enregistrer sans changement (effets identiques en base). Capture à 430 px.
- [ ] **Step 7 :** Commit `feat(admin): formulaire de carte en 5 étapes avec aperçu`.

### Task 5 : Vérification seed vs panneau

**Files :** aucun fichier produit attendu ; éventuellement une note dans la spec.

- [ ] **Step 1 :** Lire comment `*-cards.ts` et `*-patches.ts` sont appliqués (`apps/backend/src/database/migrations/`, `apply-balance-patches.ts`, `synchronize.ts`). Confirmer qu'ils ne s'exécutent qu'une fois et n'écrasent pas une carte modifiée dans le panneau.
- [ ] **Step 2 :** Si un script réapplique les patches à chaque démarrage ou déploiement : s'arrêter et le signaler à l'utilisateur, ne pas modifier.
- [ ] **Step 3 :** Ajouter le constat à la section « Précisions après relecture » de la spec ; commit `docs(spec): constat seed vs panneau`.
