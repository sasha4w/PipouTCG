# Rework de l'ouverture de boosters et méga booster — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'ouverture actuelle par une déchirure sonore, une attente par paliers et un défilé gradué selon la rareté, et permettre d'ouvrir 5 ou 10 boosters en une fois.

**Architecture:** Le backend étend `POST /boosters/:id/open` avec une quantité, dans une seule transaction. Le frontend isole toute la logique de rythme dans des fonctions pures (`openingPlan.ts`), puis `OpeningModal` orchestre trois composants : déchirure et attente, révélation, récapitulatif.

**Tech Stack:** NestJS 11, TypeORM, React 18, framer-motion, Howler, Web Audio, Vitest, Jest.

**Spec:** `docs/superpowers/specs/2026-11-05-ouverture-boosters-design.md`. Référence de rythme : `.superpowers/brainstorm/52-1793903356/content/dechirure-v4.html` (ne pas copier le code).

## Global Constraints

- Travailler sur `dev`, jamais sur `main`.
- Quantités acceptées : 1, 5, 10.
- Types échangés dans `@pipou/shared`, puis `pnpm build:shared`.
- Icônes SVG de `components/Icons.tsx`, jamais d'emoji, y compris dans les écrans d'ouverture modifiés.
- Textes en i18n fr, en, ko.
- Pas de `any`, pas de composant déclaré dans un composant, clés de requêtes via `QUERY_KEYS`, erreurs via `apiErrorMessage`.
- Cartes affichées avec `CardDisplay`.
- Avec `reduced` : pas de tremblement, flash, rayons ni éclats.

## Review Focus

- Double clic ou double déchirure : une seule requête d'ouverture part.
- Échec réseau après la déchirure : message d'erreur, booster non consommé, retour à l'état initial.
- Stock insuffisant, ou stock passé sous 5 pendant que la modale est ouverte : refus 400, rien de consommé.
- Fermeture de la modale pendant le défilé automatique : aucun timer ni son ne continue.
- Son coupé dans les réglages : les sons synthétiques restent silencieux.

---

### Task 1: Ouverture multiple atomique (shared + backend)

**Files:**
- Modify: `packages/shared/src/api/requests.ts`
- Modify: `apps/backend/src/boosters/boosters.service.ts:195-301`
- Modify: `apps/backend/src/boosters/boosters.controller.ts:49-56`
- Modify: `apps/backend/src/users/users.service.ts:583-612`
- Test: `apps/backend/src/boosters/boosters.service.spec.ts`, `boosters.controller.spec.ts`

**Interfaces:**
- Produces (shared): `OPEN_BOOSTER_QUANTITIES = [1, 5, 10] as const`, `type OpenBoosterQuantity`, `interface OpenBoosterRequest { quantity?: OpenBoosterQuantity }`.
- Produces (API): `POST /boosters/:id/open`, corps optionnel `{ quantity }`, défaut 1. Réponse `{ historyIds: number[], booster: string, cards: (Card & { isNew: boolean })[] }`. Le champ `historyId` reste présent et vaut `historyIds[0]`.
- Produces: `openBooster(boosterId, userId, quantity = 1)`, `removeBoosterFromUser(userId, boosterId, manager?, quantity = 1)`, `updatePostOpeningStats(userId, xpAmount, count = 1)`.

- [ ] **Step 1: Écrire les tests en échec**

Dans `boosters.service.spec.ts` :
- `openBooster(id, user, 10)` sur un booster de 10 cartes renvoie 100 cartes et 10 `historyIds`, et contient au moins 10 Épiques.
- `removeBoosterFromUser` est appelé une fois avec la quantité 10.
- `updatePostOpeningStats` est appelé avec `(userId, 500, 10)`.
- `booster.opened` est émis une seule fois avec `amount: 10` et 100 `rarities`.
- Une carte non possédée tirée 3 fois a `isNew: true` sur une seule occurrence.
- `openBooster(id, user, 3)` rejette `BadRequestException`.
- Si `removeBoosterFromUser` rejette, aucune carte n'est ajoutée.

Dans `boosters.controller.spec.ts` : sans corps, le service reçoit la quantité 1.

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/backend test -- boosters`
Expected: FAIL sur les nouveaux tests.

- [ ] **Step 3: Implémenter**

Ajouter les types shared et lancer `pnpm build:shared`. Extraire `drawBoosterCards(totalCards, guarantees, cardsByRarity): Card[]` et l'appeler `quantity` fois. Garder le filtre `requiresAllElements`. Dans une seule transaction : un retrait de stock, puis une `BoosterOpenHistory` et ses `BoosterOpenCard` par booster. `removeBoosterFromUser` refuse si `ub.quantity < quantity`. Une seule notification découle de l'unique événement.

- [ ] **Step 4: Vérifier le succès**

Run: `pnpm --filter @pipou/backend test -- boosters` puis `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/backend/src/boosters apps/backend/src/users/users.service.ts
git commit -m "feat(boosters): ouverture multiple atomique"
```

### Task 2: Logique de rythme pure et service d'ouverture

**Files:**
- Create: `apps/frontend/src/features/opening/openingPlan.ts`
- Test: `apps/frontend/src/features/opening/openingPlan.test.ts`
- Modify: `apps/frontend/src/services/opening.service.ts`

**Interfaces:**
- Consumes: `OpenBoosterQuantity`, `Rarity` de `@pipou/shared`.
- Produces: `openingService.openBooster(id: number, quantity?: OpenBoosterQuantity)`.
- Produces: `rarityRank(r: string): number` (common 0 à secret 5), `bestRarity(cards): string`, `sortForParade(cards): OpenedCard[]` (croissant), `sortForSummary(cards): OpenedCard[]` (décroissant, nouvelles d'abord à rareté égale).
- Produces: `type RevealStep = { card: OpenedCard; ritual: "none" | "short" | "full"; blackoutMs: number; holdForClick: boolean; autoAdvanceMs: number | null }` et `buildReveal(cards: OpenedCard[], mega: boolean): RevealStep[]`.

- [ ] **Step 1: Écrire les tests en échec**

```ts
// simple : chaque carte attend un clic
expect(buildReveal([common], false)[0]).toMatchObject({ ritual: "none", holdForClick: true, autoAdvanceMs: null });
expect(buildReveal([epic], false)[0]).toMatchObject({ ritual: "full", blackoutMs: 400 });
expect(buildReveal([legendary], false)[0].blackoutMs).toBe(600);
expect(buildReveal([secret], false)[0].blackoutMs).toBe(900);
// méga
const m = buildReveal([common, rare, epicA, epicB], true);
expect(m[0]).toMatchObject({ holdForClick: false, autoAdvanceMs: 110 });
expect(m[1]).toMatchObject({ holdForClick: false, autoAdvanceMs: 480 });
expect(m[2]).toMatchObject({ ritual: "short", blackoutMs: 0, holdForClick: true });
expect(m[3]).toMatchObject({ ritual: "full", blackoutMs: 400 }); // dernière Épique, aucune Légendaire
// avec Légendaire, toutes les Épiques restent courtes
expect(buildReveal([epicA, legendary], true)[0].ritual).toBe("short");
// nouvelles
expect(buildReveal([{ ...common, isNew: true }], true)[0]).toMatchObject({ holdForClick: false, autoAdvanceMs: 400 });
expect(buildReveal([{ ...rare, isNew: true }], true)[0].holdForClick).toBe(true);
```

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- openingPlan`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter `openingPlan.ts` et le paramètre `quantity`**

`openBooster` envoie `{ quantity }` et mappe la réponse comme aujourd'hui. `buildReveal` trie avec `sortForParade`.

- [ ] **Step 4: Vérifier le succès**

Run: `pnpm --filter @pipou/frontend test -- openingPlan`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/opening apps/frontend/src/services/opening.service.ts
git commit -m "feat(opening): logique de rythme du défilé"
```

### Task 3: Sons synthétiques

**Files:**
- Create: `apps/frontend/src/features/opening/openingAudio.ts`
- Test: `apps/frontend/src/features/opening/openingAudio.test.ts`
- Modify: `apps/frontend/src/services/sound.service.ts`

**Interfaces:**
- Produces: `soundService.sfxVolume01(): number`, publique, renvoie le volume effectif (0 si coupé).
- Produces: `openingAudio.tear(speed: number)`, `.stepNote(step: number)`, `.rumble()`, `.bass()`, `.dispose()`. `speed` est entre 0 et 1, `step` entre 0 et 5.
- Produces: `playRaritySound(rarity: string)` qui joue via `soundService` : `rarityCommon` pour common et uncommon, `rarityRare`, `rarityEpic`, `rarityLegendary` pour legendary et secret.

- [ ] **Step 1: Écrire les tests en échec**

Avec un `AudioContext` factice : si `sfxVolume01()` vaut 0, aucun oscillateur ni source n'est créé. Sinon le gain est multiplié par ce volume. `playRaritySound("secret")` appelle `soundService.play("rarityLegendary")`.

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- openingAudio`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

Reprendre les réglages de la v4 : déchirure en bruit filtré à 2200 + speed × 2500 Hz, notes 262, 330, 392, 523, 659, 784 Hz, grondement 45 Hz, basse 58 Hz. Créer l'`AudioContext` au premier geste seulement.

- [ ] **Step 4: Vérifier le succès**

Run: `pnpm --filter @pipou/frontend test -- openingAudio`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/opening apps/frontend/src/services/sound.service.ts
git commit -m "feat(opening): sons synthétiques de déchirure et de paliers"
```

### Task 4: Déchirure et attente par paliers

**Files:**
- Create: `apps/frontend/src/features/opening/PackTear.tsx`, `PackTear.css`
- Test: `apps/frontend/src/features/opening/PackTear.test.tsx`

**Interfaces:**
- Consumes: `openingAudio`.
- Produces: `<PackTear name quantity bestRarity onTorn onWaitDone />`, avec `bestRarity: string | null`. `onTorn()` est appelé une seule fois à 96 % du geste. L'attente joue les paliers quand `bestRarity` est connu, puis appelle `onWaitDone()`.

- [ ] **Step 1: Écrire les tests en échec**

- Un glissement à 50 % n'appelle pas `onTorn`, à 96 % il l'appelle, dans les deux sens.
- Un second glissement n'appelle pas `onTorn` une seconde fois.
- Avec des timers factices, `bestRarity="epic"` joue 4 notes (`stepNote` 0 à 3), puis `onWaitDone`.
- `quantity={10}` affiche ×10.

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- PackTear`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

Utiliser les pointer events avec capture. Durées par palier : 520 ms jusqu'à Rare, 760 ms au-delà, puis pause finale de 350 ms ou 850 ms dès la Légendaire. Si `bestRarity` n'est pas encore connu, le paquet reste au palier 0 avec une légère pulsation. Nettoyer tous les timers au démontage.

- [ ] **Step 4: Vérifier le succès**

Run: `pnpm --filter @pipou/frontend test -- PackTear`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/opening
git commit -m "feat(opening): déchirure du booster et attente par paliers"
```

### Task 5: Révélation et effets de rareté

**Files:**
- Create: `apps/frontend/src/features/opening/CardReveal.tsx`, `CardReveal.css`
- Test: `apps/frontend/src/features/opening/CardReveal.test.tsx`

**Interfaces:**
- Consumes: `RevealStep`, `buildReveal`, `openingAudio`, `playRaritySound`, `useAnimationPrefs`.
- Produces: `<CardReveal steps onDone onSkip />`. `onDone()` suit la dernière carte, `onSkip()` le bouton Skip.

- [ ] **Step 1: Écrire les tests en échec**

- Un clic passe à l'étape suivante si `holdForClick`, et un clic pendant `blackoutMs` est ignoré.
- `autoAdvanceMs: 110` avance seul avec des timers factices.
- Le démontage annule le timer : aucun son après.
- Avec `reduced`, les classes de tremblement, flash, rayons et éclats sont absentes.
- `ritual: "short"` n'a ni noir ni grondement.
- Skip appelle `onSkip`.

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- CardReveal`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

Appliquer le tableau d'effets de la spec avec les valeurs de la v4. Classe `opening-fx--<rarity>` et variables CSS, en réutilisant les couleurs `RARITY_GLOW`. Déplacer `toCard` et `RARITY_GLOW` dans `openingPlan.ts`. Les éclats sont limités à 14, 56 et 126 pour Épique, Légendaire et Secrète, et absents sur les Épiques courtes. Inclinaison de la carte au pointeur.

- [ ] **Step 4: Vérifier le succès**

Run: `pnpm --filter @pipou/frontend test -- CardReveal`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/opening
git commit -m "feat(opening): révélation graduée selon la rareté"
```

### Task 6: Assemblage, choix de quantité et récapitulatif

**Files:**
- Create: `apps/frontend/src/features/opening/OpeningSummary.tsx`
- Modify: `apps/frontend/src/features/opening/OpeningModal.tsx`, `OpeningModal.css`
- Modify: `apps/frontend/src/features/opening/OpeningQuickAccess.tsx`, `apps/frontend/src/features/profile/CollectionPanel.tsx`, `apps/frontend/src/features/boosters/OwnerBoosterList.tsx`
- Modify: `apps/frontend/src/i18n/locales/fr.json`, `en.json`, `ko.json`
- Test: `apps/frontend/src/features/opening/OpeningModal.test.tsx`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: `OpeningTarget` gagne `quantity?: OpenBoosterQuantity`, et `available?: number` pour afficher ×5 et ×10.
- Produces: `<OpeningSummary cards boosters onClose />` et clés i18n sous `opening.*`.

- [ ] **Step 1: Écrire les tests en échec**

- `onTorn` déclenche une seule requête avec la quantité choisie.
- Échec API : message affiché, retour à l'état initial, aucun défilé.
- Succès : invalidation de `quests`, `profile`, `inventory`.
- Skip mène au récapitulatif, avec les meilleures cartes en premier.
- ×5 est absent avec 4 boosters, ×10 absent avec 9.
- Un bundle n'affiche aucun choix de quantité et garde son écran de contenu.

- [ ] **Step 2: Vérifier l'échec**

Run: `pnpm --filter @pipou/frontend test -- OpeningModal`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

Phases : `tear`, `wait`, `reveal` ou `bundle-reveal`, `results`. Lancer l'appel API à `onTorn`, pour que l'attente recouvre le temps réseau. Retirer `RARITY_FLASH`, la cascade de flash, le fake-out et les emojis. Les bundles passent par `PackTear`, puis leur écran actuel. La grille du récapitulatif défile pour 100 cartes et utilise `CardDisplay` en taille `sm`.

- [ ] **Step 4: Vérifier le succès complet**

Run: `pnpm typecheck; pnpm test; pnpm lint; pnpm build`
Expected: tout passe.

- [ ] **Step 5: Essai réel**

Avec le skill `run`, ouvrir ×1, ×5 et ×10 dans l'app, à la souris et en largeur mobile, puis vérifier le son et le mode animations réduites.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(opening): nouvelle ouverture et méga booster"
```
