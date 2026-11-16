# Secrètes : butin de boss et conditions d'invocation — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer les secrètes des boosters, les faire tomber du boss de niveau 5, renforcer Maître Magouille et Noyau Delta avec une condition d'invocation chacun (Delta via la nouvelle Charge « Protocole Delta .core »), et dorer la secrète sur l'écran de victoire.

**Architecture:** Quatre nouvelles actions d'effet dans `@pipou/shared` (`SUMMON_IF_GRAVEYARD_COUNT`, `SUMMON_ONLY_BY_EFFECT`, `CHARGE_ON_EQUIPMENT`, `SUMMON_NAMED`) et des helpers de règles purs, réutilisés par le moteur, l'IA et le front. Les effets sont stockés en JSON dans `card.effects`, donc aucune migration d'enum SQL : une seule migration TypeORM patche les cartes, insère la Charge et met à jour les boss existants.

**Tech Stack:** pnpm monorepo, NestJS 11 + TypeORM (MySQL), Jest (backend), Vitest (shared, frontend), React 18.

**Spec:** `docs/superpowers/specs/2026-11-16-secretes-boss-design.md`

## Global Constraints

- Branche `feat/secretes-boss`, partie de `origin/dev`, dans le worktree `../PipouTCG-secretes`. Ne jamais commiter sur `BETTER-AI`.
- Tout type/enum échangé front/back vit dans `@pipou/shared` ; après modification : `pnpm build:shared`.
- Ne jamais toucher Aiven : le `.env` local pointe la prod. Migrations testées uniquement sur la base Docker `cardcollect_dev` avec `ENV_FILE=.env.dev.local` (voir mémoire « Local test env »).
- 3 zones monstre par joueur (`monsterZones.length === 3`).
- Taux : booster LEGENDARY = 1.0, SECRET = 0 ; butin de boss secret = `ORIGINES_FARM_PCT` (1 %).
- Magouille : 1200 / 3500, coût 4. Delta : 1800 / 2500, coût 4. Protocole Delta .core : Charge pixelman epic, `chargeMax` 4, ONE_SHOT.
- Icônes UI : SVG de `Icons.tsx`, jamais d'emoji.
- Textes visibles en fr, en, ko.
- Commits : Conventional Commits en français (`feat(secretes): …`).

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/enums/effect.ts` | +4 `ActionType` |
| `packages/shared/src/game/effect-schema.ts` | schéma des 4 actions |
| `packages/shared/src/game/summon-conditions.ts` (créé) | helpers purs : condition cimetière, invocation par effet seulement |
| `packages/shared/src/game/rules.ts` | `canSummonFromHand` / `isSpecialSummon` tiennent compte des nouvelles conditions |
| `packages/shared/src/game/state.ts` | résolution `sacrifice_for_summon`, prompt keys |
| `apps/backend/src/boosters/boosters.service.ts` | taux, exclusion des secrètes |
| `apps/backend/src/adventure/farm-card.ts` | butin du boss secret |
| `apps/backend/src/adventure/deck-generator.ts` | decks des boss Magouille/Delta jouables |
| `apps/backend/src/database/secretes-2026-11-patches.ts` (créé) | patchs Magouille/Delta + nouvelle carte |
| `apps/backend/src/database/migrations/1791000000032-SecretesBoss.ts` (créé) | applique patchs, insère la Charge, met à jour les boss existants |
| `apps/backend/src/fights/services/summon.service.ts` | refus d'invocation depuis la main |
| `apps/backend/src/fights/services/support.service.ts` | +1 compteur aux Charges `CHARGE_ON_EQUIPMENT` quand un équipement est posé |
| `apps/backend/src/fights/services/phase.service.ts` | ces Charges ne gagnent pas le compteur de début de tour |
| `apps/backend/src/fights/effects/effect-actions.applier.ts` | action `SUMMON_NAMED` |
| `apps/backend/src/fights/services/pick.service.ts` | résolutions `summon_to_zone` (source main) et `sacrifice_for_summon` |
| `apps/backend/src/fights/engine/supported-effects.ts` | déclare les nouvelles actions |
| `apps/backend/src/fights/ai/candidate-actions.ts` | n'invoque que ce qui est permis |
| `apps/frontend/src/features/fight/effectText.ts`, `FightBoard.tsx`, `CardPickModal.tsx` | texte, main grisée, modale de choix |
| `apps/frontend/src/features/adventure/AdventureResult.tsx` | cadre doré secrète |
| `apps/frontend/src/i18n/locales/{fr,en,ko}.json` | libellés |

---

### Task 1: Actions et helpers partagés

**Files:**
- Modify: `packages/shared/src/enums/effect.ts` (fin de `ActionType`, après `REQUIRES_CARD_ON_BOARD`)
- Modify: `packages/shared/src/game/effect-schema.ts:119`
- Create: `packages/shared/src/game/summon-conditions.ts`
- Modify: `packages/shared/src/game/rules.ts:210-212` et `:279-287`
- Modify: `packages/shared/src/index.ts` (ou le barrel de `game/`) pour exporter le nouveau module
- Modify: `packages/shared/src/enums/enums.test.ts:82` (liste des actions attendues)
- Test: `packages/shared/src/game/summon-conditions.test.ts`

**Interfaces:**
- Produces:
  - `ActionType.SUMMON_IF_GRAVEYARD_COUNT`, `SUMMON_ONLY_BY_EFFECT`, `CHARGE_ON_EQUIPMENT`, `SUMMON_NAMED`
  - `graveyardCountRequirement(effects): { value: number; filter?: EffectFilter } | null`
  - `meetsGraveyardCount(effects, graveyard: { type: CardType; archetype: Archetype | null; rarity: Rarity; name: string }[]): boolean`
  - `summonOnlyByEffect(effects): boolean`
  - `chargesOnEquipment(effects): boolean`
  - `canSummonFromHand(card: { stage; effects? }): boolean` (refuse aussi `SUMMON_ONLY_BY_EFFECT`)
  - `isSpecialSummon` renvoie aussi `true` pour une carte à `SUMMON_IF_GRAVEYARD_COUNT`

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/game/summon-conditions.test.ts
import { describe, expect, it } from "vitest";
import {
  chargesOnEquipment,
  graveyardCountRequirement,
  meetsGraveyardCount,
  summonOnlyByEffect,
} from "./summon-conditions";
import { canSummonFromHand, isSpecialSummon } from "./rules";

const MAGOUILLE = [
  {
    trigger: "PASSIVE",
    condition: null,
    actions: [
      {
        type: "SUMMON_IF_GRAVEYARD_COUNT",
        target: "SELF",
        value: 4,
        filter: { archetype: "pipou", type: "monster", rarities: ["epic", "legendary"] },
      },
    ],
  },
] as never;
const DELTA = [
  { trigger: "PASSIVE", condition: null, actions: [{ type: "SUMMON_ONLY_BY_EFFECT", target: "SELF" }] },
] as never;
const card = (rarity: string, archetype = "pipou", type = "monster") =>
  ({ rarity, archetype, type, name: "x" }) as never;

describe("graveyardCountRequirement", () => {
  it("lit valeur et filtre", () => {
    expect(graveyardCountRequirement(MAGOUILLE)).toEqual({
      value: 4,
      filter: { archetype: "pipou", type: "monster", rarities: ["epic", "legendary"] },
    });
  });
  it("null sans la condition", () => {
    expect(graveyardCountRequirement(DELTA)).toBeNull();
  });
});

describe("meetsGraveyardCount", () => {
  it("faux avec 3 épiques/légendaires pipou", () => {
    expect(meetsGraveyardCount(MAGOUILLE, [card("epic"), card("legendary"), card("epic"), card("rare")])).toBe(false);
  });
  it("vrai avec 4, les autres archétypes et les supports ne comptent pas", () => {
    expect(
      meetsGraveyardCount(MAGOUILLE, [
        card("epic"), card("epic"), card("legendary"), card("legendary"),
        card("epic", "pixelman"), card("epic", "pipou", "support"),
      ]),
    ).toBe(true);
  });
  it("vrai sans condition", () => {
    expect(meetsGraveyardCount(DELTA, [])).toBe(true);
  });
});

describe("conditions d'invocation", () => {
  it("Delta n'est jamais invocable depuis la main", () => {
    expect(summonOnlyByEffect(DELTA)).toBe(true);
    expect(canSummonFromHand({ stage: null, effects: DELTA })).toBe(false);
  });
  it("Magouille est une invocation spéciale (autorisée en phase de contrôle)", () => {
    expect(canSummonFromHand({ stage: null, effects: MAGOUILLE })).toBe(true);
    expect(isSpecialSummon({ effects: MAGOUILLE })).toBe(true);
  });
  it("chargesOnEquipment", () => {
    const fx = [{ trigger: "PASSIVE", condition: null, actions: [{ type: "CHARGE_ON_EQUIPMENT", target: "SELF" }] }] as never;
    expect(chargesOnEquipment(fx)).toBe(true);
    expect(chargesOnEquipment(DELTA)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pipou/shared test summon-conditions`
Expected: FAIL, module `./summon-conditions` introuvable.

- [ ] **Step 3: Implement**

`effect.ts`, après `REQUIRES_CARD_ON_BOARD` :

```ts
  SUMMON_IF_GRAVEYARD_COUNT: "SUMMON_IF_GRAVEYARD_COUNT",
  SUMMON_ONLY_BY_EFFECT: "SUMMON_ONLY_BY_EFFECT",
  CHARGE_ON_EQUIPMENT: "CHARGE_ON_EQUIPMENT",
  SUMMON_NAMED: "SUMMON_NAMED",
```

`effect-schema.ts`, après `REQUIRES_CARD_ON_BOARD` :

```ts
  [A.SUMMON_IF_GRAVEYARD_COUNT]: s(SELF_ONLY, "value", "filter"),
  [A.SUMMON_ONLY_BY_EFFECT]: s(SELF_ONLY),
  [A.CHARGE_ON_EQUIPMENT]: s(SELF_ONLY),
  [A.SUMMON_NAMED]: s(PLAYER_ONLY, "filter"),
```

`summon-conditions.ts` :

```ts
import { ActionType, EffectTrigger } from "../enums/effect";
import type { CardEffect, EffectFilter } from "./effect";

type Effects = CardEffect[] | null | undefined;

function passiveAction(effects: Effects, type: ActionType) {
  for (const e of effects ?? [])
    if (e.trigger === EffectTrigger.PASSIVE)
      for (const a of e.actions) if (a.type === type) return a;
  return undefined;
}

/** Condition « N cartes du filtre au cimetière » (Maître Magouille), ou null. */
export function graveyardCountRequirement(
  effects: Effects,
): { value: number; filter?: EffectFilter } | null {
  const a = passiveAction(effects, ActionType.SUMMON_IF_GRAVEYARD_COUNT);
  return a ? { value: a.value ?? 0, filter: a.filter } : null;
}

type GraveCard = {
  type: string;
  archetype: string | null;
  rarity: string;
  name: string;
};

function matches(c: GraveCard, f: EffectFilter | undefined): boolean {
  if (!f) return true;
  if (f.archetype && c.archetype !== f.archetype) return false;
  if (f.type && c.type !== f.type) return false;
  if (f.rarities && !f.rarities.includes(c.rarity as never)) return false;
  return true;
}

/** Vrai si la carte n'a pas de condition de cimetière, ou si elle est remplie. */
export function meetsGraveyardCount(effects: Effects, graveyard: GraveCard[]): boolean {
  const req = graveyardCountRequirement(effects);
  if (!req) return true;
  return graveyard.filter((c) => matches(c, req.filter)).length >= req.value;
}

/** Carte qui n'arrive en jeu que par un effet (Noyau Delta). */
export function summonOnlyByEffect(effects: Effects): boolean {
  return !!passiveAction(effects, ActionType.SUMMON_ONLY_BY_EFFECT);
}

/** Charge qui avance quand son propriétaire pose un équipement, pas au début du tour. */
export function chargesOnEquipment(effects: Effects): boolean {
  return !!passiveAction(effects, ActionType.CHARGE_ON_EQUIPMENT);
}
```

`rules.ts` : remplacer `canSummonFromHand` et compléter `isSpecialSummon` :

```ts
export function canSummonFromHand(card: {
  stage: DrakonStage | null;
  effects?: CardEffect[] | null;
}): boolean {
  return !isEvolutionStage(card.stage) && !summonOnlyByEffect(card.effects);
}
```

```ts
  return (
    (releveInstanceIds?.length ?? 0) > 0 ||
    requiresAllElements(card.effects) ||
    graveyardCountRequirement(card.effects) !== null
  );
```

(importer `summonOnlyByEffect`, `graveyardCountRequirement` depuis `./summon-conditions`). Exporter le module dans le barrel. Ajouter les 4 noms à la liste de `enums.test.ts:82`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @pipou/shared test && pnpm build:shared && pnpm typecheck`
Expected: PASS. Corriger tout appel de `canSummonFromHand` qui casse le typecheck (le champ `effects` est optionnel, aucun ne devrait casser).

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(secretes): actions d'invocation conditionnelle partagées"
```

---

### Task 2: Boosters sans secrète

**Files:**
- Modify: `apps/backend/src/boosters/boosters.service.ts:23-30`, `:129-136`, `:210-217`
- Test: `apps/backend/src/boosters/boosters.service.spec.ts`

**Interfaces:** aucune nouvelle.

- [ ] **Step 1: Write the failing test** (ajouter au `describe` du tirage existant, en réutilisant ses fabriques de cartes / mocks de repository)

```ts
it('ne donne jamais de secrète, même si le set en contient', async () => {
  // set : 1 commune + 1 secrète ; 200 ouvertures
  const cards = await openManyWithSet([common(1), secret(2)], 200);
  expect(cards.every((c) => c.rarity !== Rarity.SECRET)).toBe(true);
});

it('la légendaire pèse 1 %', () => {
  expect(RARITY_WEIGHTS[Rarity.LEGENDARY]).toBe(1);
  expect(RARITY_WEIGHTS[Rarity.SECRET]).toBe(0);
});
```

Adapter `openManyWithSet` aux helpers déjà présents dans le spec. Exporter `RARITY_WEIGHTS` depuis le service pour le test.

- [ ] **Step 2: Run** — `pnpm --filter @pipou/backend test boosters.service` → FAIL.

- [ ] **Step 3: Implement**

```ts
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  [Rarity.COMMON]: 60,
  [Rarity.UNCOMMON]: 25,
  [Rarity.RARE]: 10,
  [Rarity.EPIC]: 4,
  [Rarity.LEGENDARY]: 1,
  [Rarity.SECRET]: 0,
};
```

Retirer `Rarity.SECRET` de `rarityOrder` dans `drawCardOfRarity`. Remplacer le filtre de chargement :

```ts
    // Les secrètes (Drakon des Origines, Magouille, Delta) ne tombent que des boss d'aventure
    ).filter((c) => c.rarity !== Rarity.SECRET);
```

Retirer l'import `requiresAllElements` s'il n'est plus utilisé.

- [ ] **Step 4: Run** — même commande → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(secretes): plus de secrète dans les boosters, légendaire à 1 %"`

---

### Task 3: Butin du boss secret

**Files:**
- Modify: `apps/backend/src/adventure/farm-card.ts`
- Test: `apps/backend/src/adventure/farm-card.spec.ts`

**Interfaces:**
- Produces: `farmCardFor(setCards, signature, level)` renvoie la signature à `ORIGINES_FARM_PCT` dès qu'elle est `secret` au niveau 5.

- [ ] **Step 1: Write the failing test** (suivre les fabriques du spec existant)

```ts
it('boss niveau 5 à signature secrète sans condition d’éléments : sa carte à 1 %', () => {
  const magouille = card({ id: 10, name: 'Maître Magouille', rarity: 'secret', archetype: 'pipou' });
  expect(farmCardFor([magouille], { archetype: 'pipou', cardName: 'Maître Magouille' }, 5))
    .toEqual({ farmCardId: 10, farmCardPct: ORIGINES_FARM_PCT });
});

it('niveau 4 à signature secrète : pas de butin de boss', () => {
  const delta = card({ id: 7, name: 'Noyau Delta', rarity: 'secret', archetype: 'pixelman' });
  expect(farmCardFor([delta], { archetype: 'pixelman', cardName: 'Noyau Delta' }, 4).farmCardPct)
    .not.toBe(ORIGINES_FARM_PCT);
});
```

- [ ] **Step 2: Run** — `pnpm --filter @pipou/backend test farm-card` → FAIL.

- [ ] **Step 3: Implement** — remplacer la condition :

```ts
  if (level === 5 && sig?.rarity === Rarity.SECRET)
    return { farmCardId: sig.id, farmCardPct: ORIGINES_FARM_PCT };
```

Importer `Rarity` depuis `@pipou/shared`, retirer `requiresAllElements`. Mettre à jour la JSDoc (« carte signature secrète du boss »).

- [ ] **Step 4: Run** → PASS (les tests Drakon existants restent verts : le Drakon est secret).

- [ ] **Step 5: Commit** — `git commit -am "feat(secretes): le boss de niveau 5 fait tomber sa secrète"`

---

### Task 4: Données des cartes et migration

**Files:**
- Create: `apps/backend/src/database/secretes-2026-11-patches.ts`
- Create: `apps/backend/src/database/secretes-2026-11-patches.spec.ts`
- Create: `apps/backend/src/database/migrations/1791000000032-SecretesBoss.ts`
- Modify: `apps/backend/src/fights/testing/real-cards.ts` (ajouter la nouvelle carte et les patchs, comme pour `CHARGE_NEW_CARDS`)

**Interfaces:**
- Consumes: `tweak`, `fx`, `a`, `BalancePatch` (`balance-2026-10-patches.ts`), `applyBalancePatches`, `ChargeNewCard` (`cartes-2026-11-patches.ts`).
- Produces: `SECRETES_PATCHES: BalancePatch[]`, `PROTOCOLE_DELTA: ChargeNewCard`, `MAGOUILLE_EFFECTS`, `DELTA_EFFECTS`.

- [ ] **Step 1: Lire l'état actuel en base** des deux cartes (dump local uniquement) pour écrire des `before` exacts :

```bash
docker exec -i <conteneur-mysql> mysql -uroot -p cardcollect_dev \
  -e "SELECT name, atk, hp, cost, effects, description FROM card WHERE name IN ('Maître Magouille','Noyau Delta')"
```

Recopier ces valeurs dans les `before` du patch (ne pas se fier au snapshot de test, possiblement ancien).

- [ ] **Step 2: Write the failing test**

```ts
// secretes-2026-11-patches.spec.ts
import { validateEffects } from '@pipou/shared'; // validateur utilisé par cartes-2026-11-patches.spec.ts
import { MAGOUILLE_EFFECTS, DELTA_EFFECTS, PROTOCOLE_DELTA, SECRETES_PATCHES } from './secretes-2026-11-patches';

describe('patch secrètes 2026-11', () => {
  it('Magouille 1200/3500 coût 4, Delta 1800/2500 coût 4', () => {
    const after = Object.fromEntries(SECRETES_PATCHES.map((p) => [p.cardName, p.after]));
    expect(after['Maître Magouille']).toMatchObject({ atk: 1200, hp: 3500, cost: 4 });
    expect(after['Noyau Delta']).toMatchObject({ atk: 1800, hp: 2500, cost: 4 });
  });
  it('effets valides au schéma', () => {
    for (const fx of [MAGOUILLE_EFFECTS, DELTA_EFFECTS, PROTOCOLE_DELTA.effects])
      expect(validateEffects(fx)).toEqual([]);
  });
  it('Protocole Delta : Charge pixelman epic à 4 compteurs', () => {
    expect(PROTOCOLE_DELTA).toMatchObject({ rarity: 'epic', archetype: 'pixelman', chargeMax: 4, chargeMode: 'ONE_SHOT', setOf: 'Noyau Alpha' });
  });
});
```

Reprendre exactement le nom du validateur et la forme de `BalancePatch` utilisés par `cartes-2026-11-patches.spec.ts`.

- [ ] **Step 3: Run** — `pnpm --filter @pipou/backend test secretes-2026-11` → FAIL.

- [ ] **Step 4: Implement** `secretes-2026-11-patches.ts`

```ts
import type { CardEffect } from '@pipou/shared';
import { a, fx, tweak } from './balance-2026-10-patches';
import type { BalancePatch } from './balance-2026-10-patches';
import type { ChargeNewCard } from './cartes-2026-11-patches';

/** Patch 2026-11 : Magouille et Delta au niveau du Drakon des Origines, avec condition d'invocation. */

// Immunités : reprendre telles quelles les actions d'immunité actuelles de Magouille
// (relevées à l'étape 1, issues de immunities-2026-10-patches.ts : ALL_EFFECT_IMMUNITIES)
export const MAGOUILLE_EFFECTS: CardEffect[] = [
  fx('PASSIVE', [
    a('SUMMON_IF_GRAVEYARD_COUNT', 'SELF', {
      value: 4,
      filter: { archetype: 'pipou', type: 'monster', rarities: ['epic', 'legendary'] },
    }),
  ]),
  /* ...effets d'immunité actuels de Magouille, inchangés... */
  fx('ON_SUMMON', [
    a('HEAL', 'ALL_ALLIES', { value: 500 }),
    a('BUFF_ATK_TEMP', 'ALL_ALLIES', { value: 300 }),
  ]),
];

export const DELTA_EFFECTS: CardEffect[] = [
  fx('PASSIVE', [a('SUMMON_ONLY_BY_EFFECT', 'SELF')]),
  fx('ON_SUMMON', [a('SET_PIERCING', 'SELF', { value: 1 })]),
  /* ...mêmes actions d'immunité que Magouille (insensible aux effets adverses)... */
  fx('PASSIVE', [a('SET_ATTACKS_PER_TURN', 'SELF', { value: 2 })]),
];
```

Le commentaire `/* ... */` ci-dessus désigne des actions **à recopier depuis la base** (étape 1), pas à inventer : c'est la seule façon d'obtenir les immunités exactes. Pour le +300 ATK jusqu'à la fin du tour, utiliser l'action de buff temporaire déjà employée par « Surcharge Overclock » (lire ses effets en base à l'étape 1 et reprendre le même `type`).

```ts
export const SECRETES_PATCHES: BalancePatch[] = [
  tweak(
    { name: 'Maître Magouille', description: '<description actuelle>', atk: 500, hp: 2000, cost: 3, effects: /* effets actuels */ [] },
    {
      atk: 1200, hp: 3500, cost: 4, effects: MAGOUILLE_EFFECTS,
      description:
        "Membre fondateur de la PipouSquad. Invocable seulement avec 4 monstres Pipou Épiques ou Légendaires dans ton cimetière. Insensible à tous les effets adverses ; à son arrivée, soigne tes monstres de 500 PV et leur donne +300 ATK ce tour.",
    },
  ),
  tweak(
    { name: 'Noyau Delta', description: '<description actuelle>', atk: 1300, hp: 800, cost: 3, effects: /* effets actuels */ [] },
    {
      atk: 1800, hp: 2500, cost: 4, effects: DELTA_EFFECTS,
      description:
        'Le noyau ultime. Ne s’invoque que par Protocole Delta .core. Attaque Perçante, attaque deux fois par tour, insensible aux effets adverses.',
    },
  ),
];

export const PROTOCOLE_DELTA: ChargeNewCard = {
  name: 'Protocole Delta .core',
  rarity: 'epic',
  archetype: 'pixelman',
  setOf: 'Noyau Alpha',
  chargeMax: 4,
  chargeMode: 'ONE_SHOT',
  description:
    'Compilation du noyau ultime. +1 compteur à chaque équipement que tu poses. À 4 : invoque Noyau Delta depuis ta main ou ton deck ; si ton terrain est plein, envoie d’abord un de tes monstres au cimetière.',
  effects: [
    fx('PASSIVE', [a('CHARGE_ON_EQUIPMENT', 'SELF')]),
    fx('ON_CHARGED', [a('SUMMON_NAMED', 'PLAYER', { filter: { name: 'Noyau Delta' } })]),
  ],
};
```

Les `before` (`<description actuelle>`, `effects` actuels, stats) sont remplis avec les valeurs exactes lues à l'étape 1 : `applyBalancePatches` vérifie l'état avant d'écrire.

Migration `1791000000032-SecretesBoss.ts` : calquée sur `1791000000023-ChargeCardsNovember.ts`.
- `up` :
  1. `applyBalancePatches(queryRunner, SECRETES_PATCHES, 'up', logger)` ;
  2. insérer `PROTOCOLE_DELTA` (même requête `INSERT` que 023, idempotente par nom) ;
  3. boss existants : pour chaque `adventure_opponent` de niveau 5 dont la carte signature est de rareté `secret` et `farm_card_id IS NULL`, régler `farm_card_id` = id de la signature, `farm_card_pct` = 1 (lire les noms exacts des colonnes dans la migration qui a créé `adventure_opponent`) ;
  4. pour chaque boss à signature Noyau Delta, ajouter `Protocole Delta .core` ×2 à `adventure_opponent_card` s'il n'y est pas.
- `down` : retirer les lignes ajoutées en 4, remettre à NULL/0 celles de 3 (mêmes critères), supprimer la carte si non référencée (même garde que 023), puis `applyBalancePatches(..., 'down', ...)`.

- [ ] **Step 5: Run** — `pnpm --filter @pipou/backend test secretes-2026-11` → PASS.

- [ ] **Step 6: Migration sur la base locale uniquement**

```bash
cd apps/backend
ENV_FILE=.env.dev.local pnpm migration:run
ENV_FILE=.env.dev.local pnpm migration:revert
ENV_FILE=.env.dev.local pnpm migration:run
```

Vérifier avant la première commande que `.env.dev.local` pointe `cardcollect_dev` en local, jamais Aiven. Expected : up, down, up sans erreur ; `SELECT` des deux cartes et de la Charge cohérent.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/database apps/backend/src/fights/testing/real-cards.ts
git commit -m "feat(secretes): Magouille et Delta renforcés, Protocole Delta .core"
```

---

### Task 5: Moteur — conditions d'invocation depuis la main

**Files:**
- Modify: `apps/backend/src/fights/services/summon.service.ts:160-181`
- Modify: `apps/backend/src/fights/engine/supported-effects.ts:80-92`
- Test: `apps/backend/src/fights/engine/secretes.spec.ts` (créé ; suivre `origins.spec.ts` pour monter une partie)

**Interfaces:**
- Consumes: `canSummonFromHand`, `meetsGraveyardCount` (Task 1).

- [ ] **Step 1: Write the failing tests**

```ts
describe('invocation des secrètes', () => {
  it('Magouille refusé avec 3 Pipou épiques/légendaires au cimetière', () => {
    const { game, summon } = setupWithHand(['Maître Magouille'], { graveyard: pipouHigh(3) });
    expect(summonFromHand(game, summon, 'Maître Magouille').error)
      .toBe('Il faut 4 monstres Pipou Épiques ou Légendaires au cimetière');
  });
  it('Magouille accepté avec 4', () => {
    const { game, summon } = setupWithHand(['Maître Magouille'], { graveyard: pipouHigh(4) });
    expect(summonFromHand(game, summon, 'Maître Magouille').error).toBeUndefined();
  });
  it('Delta toujours refusé depuis la main', () => {
    const { game, summon } = setupWithHand(['Noyau Delta']);
    expect(summonFromHand(game, summon, 'Noyau Delta').error)
      .toBe('Noyau Delta ne peut arriver en jeu que par un effet');
  });
});
```

`setupWithHand`, `pipouHigh` et `summonFromHand` : écrire ces aides en haut du fichier à partir de celles d'`origins.spec.ts` (mêmes fabriques de `GameState`, cartes réelles via `real-cards.ts`).

- [ ] **Step 2: Run** — `pnpm --filter @pipou/backend test secretes.spec` → FAIL.

- [ ] **Step 3: Implement** dans `summon.service.ts`, remplacer le test `canSummonFromHand` et ajouter après le contrôle des éléments :

```ts
    if (!canSummonFromHand(card.baseCard))
      return {
        error: summonOnlyByEffect(card.baseCard.effects)
          ? `${card.baseCard.name} ne peut arriver en jeu que par un effet`
          : `${card.baseCard.name} ne peut arriver en jeu que par évolution`,
      };
```

```ts
    if (
      !meetsGraveyardCount(
        card.baseCard.effects,
        player.graveyard.map((c) => c.baseCard),
      )
    )
      return {
        error: 'Il faut 4 monstres Pipou Épiques ou Légendaires au cimetière',
      };
```

Le message reste fixe : Magouille est la seule carte avec cette condition. Ajouter les 4 actions à `supported-effects.ts`.

- [ ] **Step 4: Run** — même commande, puis `pnpm --filter @pipou/backend test effects-coverage` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(secretes): le moteur applique les conditions d'invocation"`

---

### Task 6: Moteur — Protocole Delta .core

**Files:**
- Modify: `apps/backend/src/fights/services/phase.service.ts:141-149`
- Modify: `apps/backend/src/fights/services/support.service.ts:180-187` (cas `EQUIPMENT`, après `target.equipments.push(support)`)
- Modify: `apps/backend/src/fights/effects/effect-actions.applier.ts` (nouveau `case`, à côté de `SUMMON_FROM_DECK`)
- Modify: `apps/backend/src/fights/services/pick.service.ts:69-89`
- Modify: `packages/shared/src/game/state.ts:25-40` (`"sacrifice_for_summon"`, prompt keys `"delta_summon"`, `"delta_sacrifice"`) puis `pnpm build:shared`
- Modify: `packages/shared/src/game/state.ts` `PendingChoice` : champ optionnel `summonInstanceId?: string`
- Test: `apps/backend/src/fights/engine/secretes.spec.ts`

**Interfaces:**
- Consumes: `chargesOnEquipment` (Task 1), `PROTOCOLE_DELTA` (Task 4, via `real-cards.ts`).
- Produces: résolution `sacrifice_for_summon` (candidats : monstres du joueur ; `summonInstanceId` : la carte Delta à invoquer, en main ou dans le deck).

- [ ] **Step 1: Write the failing tests**

```ts
describe('Protocole Delta .core', () => {
  it('ne gagne pas de compteur au début du tour', () => {
    const g = setupWithCharge('Protocole Delta .core');
    startTurn(g);
    expect(chargeOf(g).chargeCounters).toBe(0);
  });
  it('+1 compteur par équipement posé', () => {
    const g = setupWithCharge('Protocole Delta .core', { hand: ['Firewall .sys'], board: ['Noyau Alpha'] });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    expect(chargeOf(g).chargeCounters).toBe(1);
  });
  it('à 4 : invoque Delta depuis la main en priorité', () => {
    const g = setupWithCharge('Protocole Delta .core', { counters: 3, hand: ['Noyau Delta', 'Firewall .sys'], deck: ['Noyau Delta'], board: ['Noyau Alpha'] });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    confirmPick(g); // choix skippable, un seul candidat
    expect(boardNames(g)).toContain('Noyau Delta');
    expect(handNames(g)).not.toContain('Noyau Delta');
    expect(deckNames(g)).toContain('Noyau Delta');
    expect(supportNames(g)).not.toContain('Protocole Delta .core');
  });
  it('à 4 sans Delta en main : le prend dans le deck', () => {
    const g = setupWithCharge('Protocole Delta .core', { counters: 3, hand: ['Firewall .sys'], deck: ['Noyau Delta'], board: ['Noyau Alpha'] });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    confirmPick(g);
    expect(boardNames(g)).toContain('Noyau Delta');
  });
  it('terrain plein (3 monstres) : sacrifie le monstre choisi puis invoque Delta à sa place', () => {
    const g = setupWithCharge('Protocole Delta .core', { counters: 3, hand: ['Firewall .sys'], deck: ['Noyau Delta'], board: ['Noyau Alpha', 'Noyau Beta', 'Noyau Zeta'] });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    expect(g.pendingChoices[0].resolution).toBe('sacrifice_for_summon');
    pickByName(g, 'Noyau Beta');
    expect(boardNames(g)).toEqual(['Noyau Alpha', 'Noyau Delta', 'Noyau Zeta']);
    expect(graveyardNames(g)).toContain('Noyau Beta');
  });
  it('sans Delta en main ni dans le deck : sans effet, la Charge part au cimetière', () => {
    const g = setupWithCharge('Protocole Delta .core', { counters: 3, hand: ['Firewall .sys'], board: ['Noyau Alpha'] });
    equip(g, 'Firewall .sys', 'Noyau Alpha');
    expect(g.pendingChoices).toHaveLength(0);
    expect(graveyardNames(g)).toContain('Protocole Delta .core');
  });
});
```

Écrire les aides (`setupWithCharge`, `equip`, `startTurn`, `confirmPick`, `pickByName`, `*Names`) en appelant les vrais `SupportService.playSupport`, `PhaseService` et `PickService.resolve`, comme dans `card-rework-cards.spec.ts`.

- [ ] **Step 2: Run** — `pnpm --filter @pipou/backend test secretes.spec` → FAIL.

- [ ] **Step 3: Implement**

`phase.service.ts` : exclure ces Charges du compteur de début de tour.

```ts
    for (const charge of chargesOf(player).filter(
      (c) => !chargesOnEquipment(c.baseCard.effects),
    ))
```

`support.service.ts`, cas `EQUIPMENT`, juste après l'`effectsResolver.resolve(... ON_PLAY ...)` :

```ts
        for (const charge of chargesOf(player).filter((c) =>
          chargesOnEquipment(c.baseCard.effects),
        ))
          addChargeCounters(
            game,
            player,
            charge,
            1,
            (card) => this.effectsResolver.resolveCharged(card, game, userId, log),
            log,
          );
```

`effect-actions.applier.ts`, nouveau `case` :

```ts
      // Protocole Delta .core : invoque la carte nommée, main d'abord puis deck
      case ActionType.SUMMON_NAMED:
        for (const p of targets.players) {
          const inHand = p.hand.find((c) => matchesFilter(c, action.filter));
          const inDeck = p.deck.find((c) => matchesFilter(c, action.filter));
          const found = inHand ?? inDeck;
          if (!found) {
            ctx.log.push(`💨 ${card.baseCard.name} — aucune carte à invoquer`);
            fizzle();
            continue;
          }
          const source = inHand ? ('hand' as const) : ('deck' as const);
          const full = p.monsterZones.every((z) => z !== null);
          queueChoice(ctx.game, {
            ...chargeChoice,
            forUserId: p.userId,
            candidates: full
              ? p.monsterZones
                  .filter((m): m is MonsterOnBoard => !!m && !isImplanted(m, p.userId))
                  .map((m) => ({ instanceId: m.instanceId, baseCard: m.card.baseCard, source: 'board' as const }))
              : [{ instanceId: found.instanceId, baseCard: found.baseCard, source }],
            count: 1,
            prompt: full ? 'Choisis le monstre à envoyer au cimetière' : 'Invoque la carte',
            promptKey: full ? 'delta_sacrifice' : 'delta_summon',
            resolution: full ? 'sacrifice_for_summon' : 'summon_to_zone',
            summonInstanceId: full ? found.instanceId : undefined,
          });
        }
        break;
```

Les logs du moteur gardent leurs emoji (`💨` existe déjà dans `pick.service.ts`) : la règle « SVG seulement » ne vise que l'UI.

`pick.service.ts` :
1. `summon_to_zone` : choisir la pile selon la source, `hand` inclus :

```ts
        const pile =
          candidate.source === 'graveyard'
            ? player.graveyard
            : candidate.source === 'hand'
              ? player.hand
              : player.deck;
```

2. nouvelle branche :

```ts
    } else if (choice.resolution === 'sacrifice_for_summon') {
      const zone = player.monsterZones.findIndex((m) => m?.instanceId === picked[0]);
      const pile = player.hand.some((c) => c.instanceId === choice.summonInstanceId)
        ? player.hand
        : player.deck;
      const idx = pile.findIndex((c) => c.instanceId === choice.summonInstanceId);
      if (zone !== -1 && idx !== -1) {
        const log: string[] = [];
        this.effectsResolver.destroyMonster(game, player, picked[0], log, {
          draw: false,
          cause: DestroyCause.SACRIFICE,
        });
        log.forEach((l) => addLog(game, l));
        const [card] = pile.splice(idx, 1);
        this.summon.summonFromDeck(game, player, card, zone);
        if (pile === player.deck) shuffle(player.deck);
      }
```

Injecter `EffectsResolver` dans `PickService` s'il n'y est pas (suivre l'injection de `SummonService`). `summonFromDeck` contourne déjà `canSummonFromHand` : Delta peut donc arriver par cet effet.

Côté shared : ajouter `"sacrifice_for_summon"` à `PendingChoiceResolution`, `"delta_summon" | "delta_sacrifice"` à `ChoicePromptKey`, `summonInstanceId?: string` à `PendingChoice`. Puis `pnpm build:shared`.

- [ ] **Step 4: Run** — `pnpm --filter @pipou/backend test fights` → PASS (toute la suite moteur).

- [ ] **Step 5: Commit** — `git commit -am "feat(secretes): Protocole Delta .core invoque Noyau Delta"`

---

### Task 7: IA et decks des boss

**Files:**
- Modify: `apps/backend/src/fights/ai/candidate-actions.ts:198`, `:386-392`
- Modify: `apps/backend/src/adventure/deck-generator.ts:83-94`, `:115-137`
- Test: `apps/backend/src/fights/ai/candidate-actions.spec.ts`, `apps/backend/src/adventure/deck-generator.spec.ts`

**Interfaces:**
- Consumes: `canSummonFromHand`, `meetsGraveyardCount` (Task 1).

- [ ] **Step 1: Write the failing tests**

```ts
// candidate-actions.spec.ts
it("ne propose pas Magouille sans 4 Pipou épiques/légendaires au cimetière", () => {
  const actions = candidatesFor(stateWithHand(['Maître Magouille'], { graveyard: pipouHigh(3) }));
  expect(actions.some((a) => a.type === 'summon' && a.cardName === 'Maître Magouille')).toBe(false);
});
it('ne propose jamais Noyau Delta depuis la main', () => {
  const actions = candidatesFor(stateWithHand(['Noyau Delta']));
  expect(actions.some((a) => a.type === 'summon' && a.cardName === 'Noyau Delta')).toBe(false);
});
it('propose de poser Protocole Delta .core', () => {
  const actions = candidatesFor(stateWithHand(['Protocole Delta .core']));
  expect(actions.some((a) => a.type === 'support' && a.cardName === 'Protocole Delta .core')).toBe(true);
});
```

```ts
// deck-generator.spec.ts
it('boss Noyau Delta : 2 Protocole Delta .core', () => {
  const deck = generateDeck(pixelmanSet, { archetype: 'pixelman', cardName: 'Noyau Delta' }, 5, seeded(1));
  expect(qty(deck, 'Protocole Delta .core')).toBe(2);
});
it('boss Maître Magouille : au moins 6 monstres Pipou épiques ou légendaires', () => {
  const deck = generateDeck(pipouSet, { archetype: 'pipou', cardName: 'Maître Magouille' }, 5, seeded(1));
  expect(highPipouCount(deck)).toBeGreaterThanOrEqual(6);
});
```

Adapter les noms d'aides (`candidatesFor`, forme des actions) à ceux du spec existant.

- [ ] **Step 2: Run** — `pnpm --filter @pipou/backend test candidate-actions deck-generator` → FAIL.

- [ ] **Step 3: Implement**

`candidate-actions.ts:198` :

```ts
      const summonable =
        canSummonFromHand(card) &&
        elementsReady(me, card) &&
        meetsGraveyardCount(card.effects, me.graveyard.map((c) => c.baseCard));
```

Vérifier dans `candidate-actions.ts` que les choix en attente (`pendingChoices`) sont résolus de façon générique (premier candidat ou évaluation) : si un `switch` sur `resolution` existe, y ajouter `sacrifice_for_summon` en choisissant le monstre allié de plus faible ATK.

`deck-generator.ts` :
- `pixelmanPlan` : `if (normalizeCardName(sig.name) === normalizeCardName('Noyau Delta')) forceByName(forced, set, 'Protocole Delta .core', 2);`
- `pipouPlan` : si `graveyardCountRequirement(sig.effects)`, forcer chaque monstre Pipou épique ou légendaire du set (hors signature) à 2 exemplaires, dans la limite de 6 cartes ajoutées, en commençant par l'id le plus bas.

- [ ] **Step 4: Run** — même commande → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(secretes): l'IA et les decks de boss suivent les conditions"`

---

### Task 8: Front — combat

**Files:**
- Modify: `apps/frontend/src/features/fight/effectText.ts:282-287` (+ rendu des 4 actions)
- Modify: `apps/frontend/src/features/fight/FightBoard.tsx:383-389`
- Modify: `apps/frontend/src/features/fight/CardPickModal.tsx:45-86` (entrées `sacrifice_for_summon`)
- Modify: `apps/frontend/src/i18n/locales/{fr,en,ko}.json` (textes d'effet, `delta_summon`, `delta_sacrifice`, libellé de bouton)
- Test: `apps/frontend/src/__tests__/unit/effectText.test.ts`, `apps/frontend/src/__tests__/components/FightBoard.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
// effectText.test.ts
it('décrit la condition de Magouille', () => {
  expect(describeEffects(MAGOUILLE_EFFECTS, 'fr')).toContain(
    'Invocable seulement avec 4 monstres Pipou Épiques ou Légendaires dans ton cimetière',
  );
});
it('décrit Protocole Delta', () => {
  const text = describeEffects(PROTOCOLE_DELTA_EFFECTS, 'fr');
  expect(text).toContain('+1 compteur à chaque équipement posé');
  expect(text).toContain('invoque Noyau Delta');
});
```

```tsx
// FightBoard.test.tsx
it('Noyau Delta en main ne peut pas être posé sur une zone monstre', () => {
  renderBoard(stateWithHand(['Noyau Delta']));
  selectHandCard('Noyau Delta');
  expect(screen.queryAllByTestId('monster-zone-target')).toHaveLength(0);
});
```

Utiliser le nom réel de la fonction exportée par `effectText.ts` et les aides de `FightBoard.test.tsx`.

- [ ] **Step 2: Run** — `pnpm --filter @pipou/frontend test effectText FightBoard` → FAIL.

- [ ] **Step 3: Implement**
- `effectText.ts` : entrées `SUMMON_IF_GRAVEYARD_COUNT`, `SUMMON_ONLY_BY_EFFECT`, `CHARGE_ON_EQUIPMENT` (`tone: "neutral", subject: "card"`), `SUMMON_NAMED` (`tone: "buff", subject: "player"`), et leurs phrases i18n.
- `FightBoard.tsx` : `canSummonFromHand(selectedInstance.baseCard)` couvre déjà Delta (Task 1) ; ajouter `meetsGraveyardCount(...)` à côté de `originsReady` pour griser Magouille quand la condition manque, et l'autoriser en phase de contrôle comme les Origines.
- `CardPickModal.tsx` : entrées `sacrifice_for_summon` dans les 5 tables (comme `force_evolve`), libellé de bouton « Sacrifier ».

- [ ] **Step 4: Run** — même commande → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(secretes): textes et choix des secrètes en combat"`

---

### Task 9: Front — écran de victoire

**Files:**
- Modify: `apps/frontend/src/features/adventure/AdventureResult.tsx:102-115`
- Modify: `apps/frontend/src/i18n/locales/{fr,en,ko}.json` (`adventure.result.secret`)
- Test: `apps/frontend/src/__tests__/components/AdventureResult.test.tsx` (créer si absent, sur le modèle des autres tests de composants)

- [ ] **Step 1: Write the failing test**

```tsx
it('une secrète obtenue a le cadre doré et le libellé Secrète', () => {
  renderResult({ loot: { gold: 0, xp: 0, boosters: [], capped: false,
    cards: [{ cardId: 1, name: 'Noyau Delta', rarity: Rarity.SECRET, imageUrl: '/d.png' }] } });
  const tile = screen.getByText('Secrète : Noyau Delta').closest('li')!;
  expect(tile).toHaveClass('adv-loot__tile--legend');
});
```

- [ ] **Step 2: Run** — `pnpm --filter @pipou/frontend test AdventureResult` → FAIL.

- [ ] **Step 3: Implement**

```tsx
          {loot?.cards.map((c) => {
            const precious = c.rarity === Rarity.LEGENDARY || c.rarity === Rarity.SECRET;
            return (
              <li
                key={`c${c.cardId}`}
                className={`adv-loot__tile${precious ? " adv-loot__tile--legend" : ""}`}
              >
                {c.imageUrl ? (
                  <img className="adv-loot__card" src={c.imageUrl} alt="" />
                ) : (
                  <IconStar size={26} />
                )}
                {c.rarity === Rarity.SECRET
                  ? t("adventure.result.secret", { name: c.name })
                  : c.rarity === Rarity.LEGENDARY
                    ? t("adventure.result.legendary", { name: c.name })
                    : c.name}
              </li>
            );
          })}
```

i18n : fr `"secret": "Secrète : {{name}}"`, en `"secret": "Secret: {{name}}"`, ko `"secret": "시크릿: {{name}}"`.

Vérifier aussi pourquoi le Drakon des Origines s'affichait en petit avec une étoile : si `imageUrl` est vide pour cette carte, l'étoile vient de là. Vérifier en base locale que la carte a une image (`card.image_id`) ; si non, le signaler à l'utilisateur, qui doit fournir l'image.

- [ ] **Step 4: Run** — même commande → PASS.

- [ ] **Step 5: Capture visuelle** (mémoire « Front visual check ») : lancer back + front sur la base locale, gagner un combat avec butin secret forcé (`farm_card_pct` = 100 sur un boss local), capture Playwright en shell 430px clair. Remettre `farm_card_pct` à 1 ensuite.

- [ ] **Step 6: Commit** — `git commit -am "feat(secretes): cadre doré pour une secrète obtenue"`

---

### Task 10: Équilibrage et vérification finale

**Files:**
- Modify (si besoin) : `apps/backend/src/database/secretes-2026-11-patches.ts` (stats)

- [ ] **Step 1: Auto-jeu** — lancer le script d'auto-jeu existant (`apps/backend/src/fights/ai/selfplay-data.cli.ts` ou le script `evaluate` de `package.json`) sur trois matchups en miroir de decks de boss : Magouille, Delta, Drakon des Origines, 200 parties chacun.
Expected : taux de victoire de Magouille et de Delta à moins de 5 points de celui du Drakon. Sinon, ajuster ATK/PV par pas de 100/250, relancer, puis recommiter le patch (et rejouer la migration en local : revert puis run).

- [ ] **Step 2: Vérification complète**

```bash
pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test
```

Expected : tout vert.

- [ ] **Step 3: Commit** — `git commit -am "chore(secretes): équilibrage après auto-jeu"` (seulement si des stats ont changé).
