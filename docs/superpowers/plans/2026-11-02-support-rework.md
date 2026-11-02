# Rework des cartes Support — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer les Terrains par des Persistants (avec une sous-famille Terrain exclusive), limiter les équipements à des emplacements (Offensif 1 / Défensif 1 / Accessoire 2), ajouter le type de support Charge et réparer puis étendre l'admin de création de cartes.

**Architecture :** les enums et règles pures (`canEquip`, `terrainToReplace`) vivent dans `@pipou/shared` et sont partagés par le moteur (validation) et le front (surbrillance, confirmation). Le moteur garde `monster.equipments[]` sous forme de liste : l'emplacement se lit sur `baseCard.equipmentSlot`. Une seule migration TypeORM ajoute les colonnes et convertit les données.

**Tech Stack :** pnpm workspaces, Node 22, NestJS 11 + TypeORM (MySQL), Socket.io, React 18 + Vite, Vitest (shared, front), Jest (back).

**Spec :** `docs/superpowers/specs/2026-11-02-support-rework-design.md`

## Global Constraints

- Tout type ou enum échangé front ↔ back vit dans `@pipou/shared` ; ne jamais le redéfinir dans une app. Après modification de `packages/shared` : `pnpm build:shared`.
- `@pipou/shared` n'a aucune dépendance runtime.
- **Ne jamais toucher Aiven** : le `.env` local pointe la prod. Migrations et clic-tests uniquement sur la base Docker `cardcollect_dev` avec `ENV_FILE=.env.dev.local`.
- Déploiement uniquement via la CI sur `main`. On travaille sur `dev`.
- Nouvelle UI : icônes SVG de `apps/frontend/src/components/Icons.tsx` uniquement, jamais d'emoji.
- Front : TanStack Query pour les données serveur, pas de `any`, erreurs d'API lues avec `apiErrorMessage(error)`.
- Toute chaîne visible passe par l'i18n (`fr.json`, `en.json`, `ko.json`).
- Capacités : `OFFENSIVE` 1, `DEFENSIVE` 1, `ACCESSORY` 2 (pas deux fois la même carte accessoire sur un monstre).
- Répartition des cartes : Offensif = Processeur de Calcul .bin, Canon à Particules .vxd, Module Bluetooth .v2 ; Défensif = Firewall .sys, Firewall de Surcharge .sys, Écaille de Dragon ; Accessoire = Module de Réparation .exe. Terrains = Tactique Gang Gang, Mont Drakon.
- Charge : seul `ONE_SHOT` est implémenté ; `CYCLIC` est refusé par le moteur avec l'erreur `'Mode de charge cyclique pas encore disponible'`.
- Commits courts au format Conventional Commits, en français, comme l'historique (`feat(fight): …`).

## Point ouvert à signaler

La spec dit que les Charges sont « destructibles par les effets de destruction de support existants ». **Aucun effet de ce type n'existe dans le moteur** (aucune action ne retire une carte de `supportZones`). Ce plan n'en ajoute pas : c'est à valider avec Sasha avant la tâche 7. Si une action `DESTROY_SUPPORT` est voulue, elle fera l'objet d'une tâche supplémentaire.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/enums/card.ts` | `SupportType` (+`PERSISTENT`, `CHARGE`, −`TERRAIN`), `EquipmentSlot`, `ChargeMode`, `EQUIP_SLOT_CAPACITY` |
| `packages/shared/src/enums/effect.ts` | `EffectTrigger.ON_CHARGED`, `ActionType.ADD_CHARGE_COUNTERS` |
| `packages/shared/src/game/card.ts` | champs de `ClientCard` |
| `packages/shared/src/game/instance.ts` | `CardInstance.chargeCounters` |
| `packages/shared/src/game/support-rules.ts` (nouveau) | `canEquip`, `terrainToReplace`, `canPlaceInSupportZone` |
| `packages/shared/src/game/events.ts` | `support_placed`, `charge_progress`, `charge_triggered` |
| `packages/shared/src/game/action.ts`, `socket/fight.ts` | `replaceInstanceId` |
| `packages/shared/src/api/requests.ts` | champs admin |
| `apps/backend/src/cards/card.entity.ts`, `dto/create-card.dto.ts` | colonnes et validation |
| `apps/backend/src/database/migrations/1791000000022-SupportRework.ts` (nouveau) | migration |
| `apps/backend/src/fights/services/support.service.ts` | règles de pose |
| `apps/backend/src/fights/helpers/charges.ts` (nouveau) | tic et déclenchement des Charges |
| `apps/backend/src/fights/services/phase.service.ts` | appel du tic au début de tour |
| `apps/backend/src/fights/effects/effect-actions.applier.ts` | `ADD_CHARGE_COUNTERS` |
| `apps/frontend/src/features/fight/Zonerow/EquipmentPips.tsx` (nouveau) | pastilles d'équipement |
| `apps/frontend/src/features/fight/Zonerow/ChargeFrame.tsx` (nouveau) | contour de charge |
| `apps/frontend/src/features/fight/ReplaceSupportDialog.tsx` (nouveau) | confirmation de remplacement |
| `apps/frontend/src/features/cards/CardManager.tsx` | admin |

---

### Task 1 : réparer la soumission de carte dans l'admin

Le bug est connu mais pas diagnostiqué. **REQUIRED SUB-SKILL : superpowers:systematic-debugging.** Ne rien corriger avant d'avoir la cause racine.

**Files :**
- Modify : `apps/frontend/src/features/cards/CardManager.tsx` (`openEdit` l.185-204, `handleSubmit` l.234-255)
- Possiblement : `apps/backend/src/cards/dto/create-card.dto.ts`, `apps/backend/src/cards/cards.service.ts`
- Test : `apps/backend/src/cards/dto/create-card.dto.spec.ts`, `apps/frontend/src/__tests__/components/CardManager.test.tsx` (à créer si absent)

**Pistes déjà repérées (à vérifier, pas à appliquer à l'aveugle) :**
1. `handleSubmit` remplace toute erreur par `"Erreur lors de la sauvegarde"` : le message réel du serveur est perdu. Première étape, quelle que soit la cause.
2. Le `ValidationPipe` global a `whitelist: true, forbidNonWhitelisted: true` (`apps/backend/src/main.ts:41-42`) : tout champ du `form` absent du DTO fait échouer la requête en 400.
3. `openEdit` ne recopie ni `supportType`, ni `archetype`, ni `effects` : éditer une carte support peut envoyer un état incohérent.

- [ ] **Step 1 : afficher l'erreur réelle**

```tsx
// CardManager.tsx — import en tête de fichier
import { apiErrorMessage } from "../../utils/errors";

// dans handleSubmit, remplacer le catch
} catch (err) {
  console.error(err);
  setError(apiErrorMessage(err) || "Erreur lors de la sauvegarde");
}
```

- [ ] **Step 2 : reproduire en local**

Lancer la base locale et l'app (voir la mémoire « Local test env ») :
```bash
ENV_FILE=.env.dev.local pnpm dev
```
Se connecter avec le compte admin local, créer une carte Monstre puis une carte Support Éphémère avec un effet, puis éditer une carte existante. Noter le message et le corps de la requête (onglet Réseau).

- [ ] **Step 3 : écrire le test qui reproduit l'échec**

Si la cause est côté DTO, ajouter dans `create-card.dto.spec.ts` un cas qui reproduit le payload envoyé par le front :
```ts
it('accepte le payload envoyé par le formulaire admin', async () => {
  const dto = plainToInstance(CreateCardDto, PAYLOAD_CAPTURÉ_AU_STEP_2);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  expect(errors).toEqual([]);
});
```
Si la cause est côté front (champ en trop, mauvais type), écrire un test Vitest sur la fonction qui construit `data` : l'extraire en `toCardPayload(form, image)` dans `apps/frontend/src/features/cards/cardPayload.ts` et tester qu'elle ne produit que des clés de `CreateCardRequest`.

- [ ] **Step 4 : vérifier que le test échoue**

Run : `pnpm --filter @pipou/backend test -- create-card.dto` (ou `pnpm --filter @pipou/frontend test -- cardPayload`)
Expected : FAIL, avec le même message qu'au Step 2.

- [ ] **Step 5 : corriger la cause racine, et `openEdit`**

Corriger ce que le Step 2 a montré. Dans tous les cas, `openEdit` doit recopier tous les champs éditables :
```tsx
setForm({
  name: c.name,
  description: c.description ?? "",
  rarity: c.rarity,
  type: c.type,
  atk: c.atk,
  hp: c.hp,
  cost: c.cost,
  cardSetId: c.cardSet.id,
  supportType: c.supportType ?? undefined,
  archetype: c.archetype ?? undefined,
  element: c.element ?? undefined,
  lineage: c.lineage ?? undefined,
  stage: c.stage ?? undefined,
  effects: c.effects ?? [],
});
```

- [ ] **Step 6 : relancer les tests et le clic-test du Step 2**

Run : `pnpm --filter @pipou/backend test -- cards` puis `pnpm --filter @pipou/frontend test`
Expected : PASS. Création Monstre, création Support et édition fonctionnent en local.

- [ ] **Step 7 : commit**

```bash
git add apps/frontend/src/features/cards apps/backend/src/cards
git commit -m "fix(admin): soumission de carte (cause : <cause trouvée>) et message d'erreur du serveur affiché"
```

---

### Task 2 : enums, types et règles partagés

**Files :**
- Modify : `packages/shared/src/enums/card.ts`, `packages/shared/src/enums/effect.ts`, `packages/shared/src/game/card.ts`, `packages/shared/src/game/instance.ts`, `packages/shared/src/game/events.ts`, `packages/shared/src/game/action.ts`, `packages/shared/src/socket/fight.ts`, `packages/shared/src/api/requests.ts`, `packages/shared/src/index.ts` (ou le barrel `game/index.ts` qui réexporte `rules.ts`)
- Create : `packages/shared/src/game/support-rules.ts`
- Test : `packages/shared/src/enums/enums.test.ts`, `packages/shared/src/game/support-rules.test.ts`, `packages/shared/src/game/events.test-d.ts`, `packages/shared/src/socket/fight.test-d.ts`

**Interfaces :**
- Produces :
  - `SupportType = { EPHEMERAL, EQUIPMENT, PERSISTENT, CHARGE }`
  - `EquipmentSlot = { OFFENSIVE: "OFFENSIVE", DEFENSIVE: "DEFENSIVE", ACCESSORY: "ACCESSORY" }`
  - `ChargeMode = { ONE_SHOT: "ONE_SHOT", CYCLIC: "CYCLIC" }`
  - `EQUIP_SLOT_CAPACITY: Record<EquipmentSlot, number>`
  - `EffectTrigger.ON_CHARGED`, `ActionType.ADD_CHARGE_COUNTERS`
  - `ClientCard.equipmentSlot / isTerrain / chargeMax / chargeMode`
  - `CardInstance.chargeCounters?: number`
  - `canEquip(equipments, card): EquipCheck`
  - `terrainToReplace(supportZones, card): number | null`
  - `canPlaceInSupportZone(supportZones, card): SupportPlacement`
  - `PlaySupportPayload.replaceInstanceId?`, `GameAction play_support.replaceInstanceId?`
  - événements `support_placed`, `charge_progress`, `charge_triggered`

- [ ] **Step 1 : mettre à jour le test des enums (il doit échouer)**

Dans `enums.test.ts`, remplacer la ligne `SupportType` et ajouter :
```ts
["SupportType", SupportType, ["EPHEMERAL", "EQUIPMENT", "PERSISTENT", "CHARGE"]],
["EquipmentSlot", EquipmentSlot, ["OFFENSIVE", "DEFENSIVE", "ACCESSORY"]],
["ChargeMode", ChargeMode, ["ONE_SHOT", "CYCLIC"]],
```
Ajouter `"ON_CHARGED"` à la fin de la liste attendue d'`EffectTrigger` et `"ADD_CHARGE_COUNTERS"` à la fin de celle d'`ActionType`. Importer `EquipmentSlot` et `ChargeMode`.

- [ ] **Step 2 : écrire le test des règles**

`packages/shared/src/game/support-rules.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { EquipmentSlot, SupportType } from "../enums/card";
import { canEquip, canPlaceInSupportZone, terrainToReplace } from "./support-rules";

type C = { name: string; supportType: SupportType | null; equipmentSlot: EquipmentSlot | null; isTerrain: boolean };
const eq = (name: string, equipmentSlot: EquipmentSlot): C => ({
  name, supportType: SupportType.EQUIPMENT, equipmentSlot, isTerrain: false,
});
const inst = (c: C, id = c.name) => ({ instanceId: id, baseCard: c });
const persistent = (name: string, isTerrain = false): C => ({
  name, supportType: SupportType.PERSISTENT, equipmentSlot: null, isTerrain,
});

describe("canEquip", () => {
  const canon = eq("Canon", EquipmentSlot.OFFENSIVE);
  const proc = eq("Processeur", EquipmentSlot.OFFENSIVE);
  const repa = eq("Réparation", EquipmentSlot.ACCESSORY);
  const autre = eq("Autre", EquipmentSlot.ACCESSORY);

  it("emplacement libre", () => {
    expect(canEquip([], canon)).toEqual({ kind: "ok" });
  });
  it("offensif plein : propose de remplacer l'occupant", () => {
    expect(canEquip([inst(proc, "p1")], canon)).toEqual({
      kind: "slot_full", replaceable: ["p1"],
    });
  });
  it("deux accessoires différents tiennent", () => {
    expect(canEquip([inst(autre)], repa)).toEqual({ kind: "ok" });
  });
  it("accessoire en double refusé", () => {
    expect(canEquip([inst(repa)], repa)).toEqual({ kind: "duplicate" });
  });
  it("accessoires pleins : les deux sont remplaçables", () => {
    const third = eq("Troisième", EquipmentSlot.ACCESSORY);
    expect(canEquip([inst(repa, "a"), inst(autre, "b")], third)).toEqual({
      kind: "slot_full", replaceable: ["a", "b"],
    });
  });
  it("équipement sans emplacement : refusé", () => {
    expect(canEquip([], { ...canon, equipmentSlot: null })).toEqual({ kind: "no_slot" });
  });
});

describe("terrainToReplace", () => {
  it("renvoie la case du Terrain en place", () => {
    const zones = [null, inst(persistent("Mont Drakon", true)), null];
    expect(terrainToReplace(zones, persistent("Tactique", true))).toBe(1);
  });
  it("null si la carte n'est pas un Terrain", () => {
    const zones = [inst(persistent("Mont Drakon", true)), null, null];
    expect(terrainToReplace(zones, persistent("Bannière"))).toBeNull();
  });
  it("null si aucun Terrain n'est posé", () => {
    expect(terrainToReplace([null, null, null], persistent("Tactique", true))).toBeNull();
  });
});

describe("canPlaceInSupportZone", () => {
  it("doublon refusé", () => {
    const b = persistent("Bannière");
    expect(canPlaceInSupportZone([inst(b), null, null], b)).toEqual({ kind: "duplicate" });
  });
  it("zones pleines refusé", () => {
    const zones = [inst(persistent("A")), inst(persistent("B")), inst(persistent("C"))];
    expect(canPlaceInSupportZone(zones, persistent("D"))).toEqual({ kind: "full" });
  });
  it("zones pleines mais Terrain à remplacer : ok", () => {
    const zones = [inst(persistent("Mont", true)), inst(persistent("B")), inst(persistent("C"))];
    expect(canPlaceInSupportZone(zones, persistent("Tactique", true))).toEqual({
      kind: "replace_terrain", zoneIndex: 0,
    });
  });
  it("case libre", () => {
    expect(canPlaceInSupportZone([null, null, null], persistent("A"))).toEqual({ kind: "ok" });
  });
});
```

- [ ] **Step 3 : vérifier l'échec**

Run : `pnpm --filter @pipou/shared test`
Expected : FAIL (`EquipmentSlot` et `support-rules` introuvables).

- [ ] **Step 4 : enums**

`packages/shared/src/enums/card.ts`, remplacer `SupportType` et ajouter :
```ts
export const SupportType = {
  EPHEMERAL: "EPHEMERAL",
  EQUIPMENT: "EQUIPMENT",
  PERSISTENT: "PERSISTENT",
  CHARGE: "CHARGE",
} as const;
export type SupportType = (typeof SupportType)[keyof typeof SupportType];

export const EquipmentSlot = {
  OFFENSIVE: "OFFENSIVE",
  DEFENSIVE: "DEFENSIVE",
  ACCESSORY: "ACCESSORY",
} as const;
export type EquipmentSlot = (typeof EquipmentSlot)[keyof typeof EquipmentSlot];

/** Équipements portables par monstre, par emplacement. */
export const EQUIP_SLOT_CAPACITY: Record<EquipmentSlot, number> = {
  [EquipmentSlot.OFFENSIVE]: 1,
  [EquipmentSlot.DEFENSIVE]: 1,
  [EquipmentSlot.ACCESSORY]: 2,
};

/** ONE_SHOT : se déclenche une fois puis part au cimetière. CYCLIC : pas encore géré. */
export const ChargeMode = {
  ONE_SHOT: "ONE_SHOT",
  CYCLIC: "CYCLIC",
} as const;
export type ChargeMode = (typeof ChargeMode)[keyof typeof ChargeMode];
```
`packages/shared/src/enums/effect.ts` : ajouter `ON_CHARGED: "ON_CHARGED",` à la fin d'`EffectTrigger` et `ADD_CHARGE_COUNTERS: "ADD_CHARGE_COUNTERS",` à la fin d'`ActionType`.

- [ ] **Step 5 : types**

`game/card.ts`, dans `ClientCard` après `supportType` (importer `EquipmentSlot`, `ChargeMode`) :
```ts
  /** Équipement uniquement. */
  equipmentSlot: EquipmentSlot | null;
  /** Persistant uniquement : un seul Terrain à la fois par joueur. */
  isTerrain: boolean;
  /** Charge uniquement : compteurs nécessaires au déclenchement. */
  chargeMax: number | null;
  chargeMode: ChargeMode | null;
```
`game/instance.ts`, dans `CardInstance`, remplacer le commentaire de `placedSeq` par `/** Ordre de pose en zone Support (croissant sur la partie). */` et ajouter :
```ts
  /** Charge posée : compteurs accumulés. */
  chargeCounters?: number;
```
`game/events.ts` : renommer `"terrain_played"` en `"support_placed"` et ajouter :
```ts
  | {
      kind: "charge_progress";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
      counters: number;
      max: number;
    }
  | {
      kind: "charge_triggered";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
    }
```
`game/action.ts`, variante `play_support`, et `socket/fight.ts`, `PlaySupportPayload` : ajouter
```ts
  /** Équipement ou Terrain remplacé (confirmé par le joueur). */
  replaceInstanceId?: string;
```
`api/requests.ts`, `CreateCardRequest` (importer les enums) :
```ts
  equipmentSlot?: EquipmentSlot;
  isTerrain?: boolean;
  chargeMax?: number;
  chargeMode?: ChargeMode;
```
Mettre à jour `events.test-d.ts` (union attendue) et `fight.test-d.ts` (ajouter `replaceInstanceId?: string`).

- [ ] **Step 6 : règles**

`packages/shared/src/game/support-rules.ts` :
```ts
import { EQUIP_SLOT_CAPACITY, EquipmentSlot, SupportType } from "../enums/card";

interface SupportCardLike {
  name: string;
  supportType: SupportType | null;
  equipmentSlot: EquipmentSlot | null;
  isTerrain: boolean;
}
interface InstanceLike {
  instanceId: string;
  baseCard: SupportCardLike;
}

export type EquipCheck =
  | { kind: "ok" }
  | { kind: "no_slot" }
  | { kind: "duplicate" }
  | { kind: "slot_full"; replaceable: string[] };

/** L'équipement `card` peut-il aller sur un monstre qui porte déjà `equipments` ? */
export function canEquip(
  equipments: readonly InstanceLike[],
  card: SupportCardLike,
): EquipCheck {
  const slot = card.equipmentSlot;
  if (!slot) return { kind: "no_slot" };
  const sameSlot = equipments.filter((e) => e.baseCard.equipmentSlot === slot);
  if (
    slot === EquipmentSlot.ACCESSORY &&
    sameSlot.some((e) => e.baseCard.name === card.name)
  )
    return { kind: "duplicate" };
  if (sameSlot.length < EQUIP_SLOT_CAPACITY[slot]) return { kind: "ok" };
  return { kind: "slot_full", replaceable: sameSlot.map((e) => e.instanceId) };
}

/** Case du Terrain que `card` remplacerait, ou null. */
export function terrainToReplace(
  supportZones: readonly (InstanceLike | null)[],
  card: SupportCardLike,
): number | null {
  if (!card.isTerrain) return null;
  const idx = supportZones.findIndex((z) => !!z?.baseCard.isTerrain);
  return idx === -1 ? null : idx;
}

export type SupportPlacement =
  | { kind: "ok" }
  | { kind: "duplicate" }
  | { kind: "full" }
  | { kind: "replace_terrain"; zoneIndex: number };

/** Un Persistant ou une Charge peut-il être posé ? */
export function canPlaceInSupportZone(
  supportZones: readonly (InstanceLike | null)[],
  card: SupportCardLike,
): SupportPlacement {
  if (supportZones.some((z) => z?.baseCard.name === card.name))
    return { kind: "duplicate" };
  const terrainIdx = terrainToReplace(supportZones, card);
  if (terrainIdx !== null) return { kind: "replace_terrain", zoneIndex: terrainIdx };
  if (supportZones.every((z) => z !== null)) return { kind: "full" };
  return { kind: "ok" };
}
```
Réexporter depuis le barrel qui exporte déjà `rules.ts` : `export * from "./support-rules";`.

- [ ] **Step 7 : tests et build**

Run : `pnpm --filter @pipou/shared test && pnpm build:shared`
Expected : PASS. `pnpm typecheck` va désormais échouer dans les apps (références à `SupportType.TERRAIN`) : c'est normal, les tâches suivantes les corrigent.

- [ ] **Step 8 : commit**

```bash
git add packages/shared
git commit -m "feat(shared): types Persistant/Charge, emplacements d'équipement et règles de pose"
```

---

### Task 3 : entité, migration et DTO

**Files :**
- Modify : `apps/backend/src/cards/card.entity.ts`, `apps/backend/src/cards/dto/create-card.dto.ts`, `apps/backend/src/fights/testing/cards.ts`
- Create : `apps/backend/src/database/migrations/1791000000022-SupportRework.ts`
- Test : `apps/backend/src/cards/dto/create-card.dto.spec.ts`

**Interfaces :**
- Consumes : enums de la tâche 2.
- Produces : `Card.equipmentSlot`, `Card.isTerrain`, `Card.chargeMax`, `Card.chargeMode` ; helpers de test `persistentCard(name, effects, overrides)`, `terrainCard(name, effects, overrides)` (Persistant avec `isTerrain: true`), `chargeCard(name, chargeMax, effects, overrides)`, `equipmentCard(name, effects, { equipmentSlot })` avec `OFFENSIVE` par défaut.

- [ ] **Step 1 : tests DTO (doivent échouer)**

Dans `create-card.dto.spec.ts` :
```ts
const base = { name: 'Test', rarity: 'common', type: 'support', atk: 0, hp: 0, cardSetId: 1 };
const errorsOf = async (extra: object) =>
  validate(plainToInstance(CreateCardDto, { ...base, ...extra }));

it('équipement sans emplacement refusé', async () => {
  expect(await errorsOf({ supportType: 'EQUIPMENT' })).not.toHaveLength(0);
});
it('équipement avec emplacement accepté', async () => {
  expect(await errorsOf({ supportType: 'EQUIPMENT', equipmentSlot: 'ACCESSORY' })).toHaveLength(0);
});
it('emplacement interdit hors équipement', async () => {
  expect(await errorsOf({ supportType: 'EPHEMERAL', equipmentSlot: 'OFFENSIVE' })).not.toHaveLength(0);
});
it('charge : chargeMax ≥ 1 obligatoire', async () => {
  expect(await errorsOf({ supportType: 'CHARGE' })).not.toHaveLength(0);
  expect(await errorsOf({ supportType: 'CHARGE', chargeMax: 0 })).not.toHaveLength(0);
  expect(await errorsOf({ supportType: 'CHARGE', chargeMax: 3, chargeMode: 'ONE_SHOT' })).toHaveLength(0);
});
it('Terrain : uniquement sur un Persistant', async () => {
  expect(await errorsOf({ supportType: 'PERSISTENT', isTerrain: true })).toHaveLength(0);
  expect(await errorsOf({ supportType: 'EQUIPMENT', equipmentSlot: 'OFFENSIVE', isTerrain: true })).not.toHaveLength(0);
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- create-card.dto`
Expected : FAIL.

- [ ] **Step 3 : DTO**

Ajouter `ValidateIf`, `IsBoolean`, `Validate`, `ValidatorConstraint`, `ValidatorConstraintInterface` et `ValidationArguments` aux imports de `class-validator`, et `EquipmentSlot`, `ChargeMode` à ceux de `@pipou/shared`. Contrainte croisée :
```ts
/** Champs propres à un sous-type : interdits ailleurs. */
@ValidatorConstraint({ name: 'supportFieldsMatchType' })
class SupportFieldsMatchType implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateCardDto;
    if (o.equipmentSlot !== undefined && o.supportType !== SupportType.EQUIPMENT) return false;
    if (o.isTerrain && o.supportType !== SupportType.PERSISTENT) return false;
    if ((o.chargeMax !== undefined || o.chargeMode !== undefined) && o.supportType !== SupportType.CHARGE)
      return false;
    return true;
  }
  defaultMessage(): string {
    return 'Champ incompatible avec ce type de support';
  }
}
```
et, dans `CreateCardDto` :
```ts
  @IsOptional()
  @IsEnum(SupportType)
  @Validate(SupportFieldsMatchType)
  supportType?: SupportType;

  @ValidateIf((o: CreateCardDto) => o.supportType === SupportType.EQUIPMENT || o.equipmentSlot !== undefined)
  @IsEnum(EquipmentSlot)
  equipmentSlot?: EquipmentSlot;

  @IsOptional()
  @IsBoolean()
  isTerrain?: boolean;

  @ValidateIf((o: CreateCardDto) => o.supportType === SupportType.CHARGE || o.chargeMax !== undefined)
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  chargeMax?: number;

  @IsOptional()
  @IsEnum(ChargeMode)
  chargeMode?: ChargeMode;
```
Attention : `@Validate` sur `supportType` ne s'exécute que si `supportType` est fourni ; pour un `type: 'monster'` sans `supportType` mais avec `equipmentSlot`, `@ValidateIf` sur `equipmentSlot` reste vrai et `IsEnum` passe. Ajouter donc le même `@Validate(SupportFieldsMatchType)` sur `equipmentSlot`.

`UpdateCardDto` hérite déjà (`PartialType`) : vérifier qu'il n'y a rien à ajouter.

- [ ] **Step 4 : entité**

`card.entity.ts`, après `supportType` :
```ts
  @Column({ type: 'enum', enum: EquipmentSlot, nullable: true, default: null })
  equipmentSlot!: EquipmentSlot | null;

  @Column({ type: 'boolean', default: false })
  isTerrain!: boolean;

  @Column({ type: 'int', nullable: true, default: null })
  chargeMax!: number | null;

  @Column({ type: 'enum', enum: ChargeMode, nullable: true, default: null })
  chargeMode!: ChargeMode | null;
```
Les colonnes sont nommées en snake_case par la stratégie de nommage existante (`support_type` dans InitSchema) : `equipment_slot`, `is_terrain`, `charge_max`, `charge_mode`. Vérifier que `cards.service` `create`/`update` copie bien tout le DTO (sinon ajouter les 4 champs).

- [ ] **Step 5 : migration**

`apps/backend/src/database/migrations/1791000000022-SupportRework.ts` :
```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

const SLOTS: [string, 'OFFENSIVE' | 'DEFENSIVE' | 'ACCESSORY'][] = [
  ['Processeur de Calcul .bin', 'OFFENSIVE'],
  ['Canon à Particules .vxd', 'OFFENSIVE'],
  ['Module Bluetooth .v2', 'OFFENSIVE'],
  ['Firewall .sys', 'DEFENSIVE'],
  ['Firewall de Surcharge .sys', 'DEFENSIVE'],
  ['Écaille de Dragon', 'DEFENSIVE'],
  ['Module de Réparation .exe', 'ACCESSORY'],
];

/** Terrains → Persistants, emplacements d'équipement, type Charge. */
export class SupportRework1791000000022 implements MigrationInterface {
  name = 'SupportRework1791000000022';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','TERRAIN','PERSISTENT','CHARGE') NULL",
    );
    await q.query(
      "ALTER TABLE `card` ADD `equipment_slot` enum ('OFFENSIVE','DEFENSIVE','ACCESSORY') NULL DEFAULT NULL, ADD `is_terrain` tinyint NOT NULL DEFAULT 0, ADD `charge_max` int NULL DEFAULT NULL, ADD `charge_mode` enum ('ONE_SHOT','CYCLIC') NULL DEFAULT NULL",
    );
    await q.query(
      "UPDATE `card` SET `support_type` = 'PERSISTENT', `is_terrain` = 1 WHERE `support_type` = 'TERRAIN'",
    );
    for (const [name, slot] of SLOTS)
      await q.query(
        "UPDATE `card` SET `equipment_slot` = ? WHERE TRIM(`name`) = ? AND `support_type` = 'EQUIPMENT'",
        [slot, name],
      );
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','PERSISTENT','CHARGE') NULL",
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','TERRAIN','PERSISTENT','CHARGE') NULL",
    );
    await q.query(
      "UPDATE `card` SET `support_type` = 'TERRAIN' WHERE `support_type` = 'PERSISTENT'",
    );
    await q.query("DELETE FROM `card` WHERE `support_type` = 'CHARGE'");
    await q.query(
      "ALTER TABLE `card` DROP COLUMN `charge_mode`, DROP COLUMN `charge_max`, DROP COLUMN `is_terrain`, DROP COLUMN `equipment_slot`",
    );
    await q.query(
      "ALTER TABLE `card` MODIFY `support_type` enum ('EPHEMERAL','EQUIPMENT','TERRAIN') NULL",
    );
  }
}
```
Avant d'écrire `DELETE … CHARGE` dans `down` : vérifier si des tables référencent `card` en cascade (`user_card`, `deck_card`…). S'il y a des FK, remplacer le `DELETE` par une levée d'erreur explicite quand des Charges existent :
```ts
const [{ n }] = await q.query("SELECT COUNT(*) AS n FROM `card` WHERE `support_type` = 'CHARGE'");
if (Number(n) > 0) throw new Error('Des cartes Charge existent : rollback manuel requis');
```
Enregistrer la migration là où les autres le sont (chercher `TerosNerf1791000000021` dans `apps/backend/src` : data-source ou liste explicite).

- [ ] **Step 6 : helpers de test du moteur**

`apps/backend/src/fights/testing/cards.ts` : vérifier comment `supportCard` construit la carte, puis s'assurer qu'elle pose `equipmentSlot: null, isTerrain: false, chargeMax: null, chargeMode: null` par défaut. Remplacer `terrainCard` et ajouter :
```ts
export const equipmentCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) =>
  supportCard(name, SupportType.EQUIPMENT, effects, {
    equipmentSlot: EquipmentSlot.OFFENSIVE,
    ...overrides,
  });

export const persistentCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => supportCard(name, SupportType.PERSISTENT, effects, overrides);

/** Persistant de la famille Terrain (un seul à la fois). */
export const terrainCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => persistentCard(name, effects, { isTerrain: true, ...overrides });

export const chargeCard = (
  name: string,
  chargeMax: number,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) =>
  supportCard(name, SupportType.CHARGE, effects, {
    chargeMax,
    chargeMode: ChargeMode.ONE_SHOT,
    ...overrides,
  });
```

- [ ] **Step 7 : tests**

Run : `pnpm --filter @pipou/backend test -- create-card.dto`
Expected : PASS.

- [ ] **Step 8 : migration sur la base locale uniquement**

Vérifier d'abord que `.env.dev.local` pointe la base Docker `cardcollect_dev` (**jamais Aiven**). Puis lancer `up`, `down` et de nouveau `up` avec le script de migration du backend (`pnpm --filter @pipou/backend run` pour voir le nom exact, par exemple `migration:run` / `migration:revert`), avec `ENV_FILE=.env.dev.local`. Contrôler le résultat :
```sql
SELECT name, support_type, is_terrain, equipment_slot FROM card WHERE type = 'support' AND support_type <> 'EPHEMERAL';
```
Expected : 2 Persistants avec `is_terrain = 1` et 7 équipements avec leur emplacement. Écaille de Dragon (archétype dragon) est incluse. Si un équipement reste à `NULL`, comparer les noms exacts (espaces, points).

- [ ] **Step 9 : commit**

```bash
git add apps/backend/src/cards apps/backend/src/database/migrations apps/backend/src/fights/testing/cards.ts
git commit -m "feat(cards): colonnes emplacement, terrain et charge, migration Terrain → Persistant"
```

---

### Task 4 : Persistants et Terrains dans le moteur

**Files :**
- Modify : `apps/backend/src/fights/services/support.service.ts` (case `TERRAIN` l.151-188), `apps/backend/src/fights/buffs-calculator.service.ts:72-74`, `apps/backend/src/fights/engine/game-engine.ts:228-235`, `apps/backend/src/fights/fights.gateway.ts:211-222`
- Rename : `apps/backend/src/fights/engine/terrain-unique.spec.ts` → `persistents.spec.ts`
- Test : `persistents.spec.ts`, `fight-events.spec.ts`, `client-state.builder.spec.ts`

**Interfaces :**
- Consumes : `canPlaceInSupportZone`, `terrainToReplace` (tâche 2), `terrainCard` et `persistentCard` (tâche 3).
- Produces : `playSupport(game, userId, handIndex, zoneIndex, targetInstanceId, replaceInstanceId?)`. Erreurs : `'Cette carte est déjà en jeu'`, `'Zones support pleines'`, `'Zone de support occupée'`, `'Confirme le remplacement de ton Terrain'`. Événement `support_placed`.

- [ ] **Step 1 : tests (doivent échouer)**

Remplacer le contenu du spec renommé :
```ts
import { createEngine } from '../testing/engine';
import { persistentCard, terrainCard } from '../testing/cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();
const play = (
  game: ReturnType<typeof scenario>,
  handIndex: number,
  zoneIndex: number,
  replaceInstanceId?: string,
) =>
  engine.dispatch(game, 'p1', {
    type: 'play_support',
    handIndex,
    zoneIndex,
    ...(replaceInstanceId && { replaceInstanceId }),
  });

describe('Persistants', () => {
  it('refuse un second exemplaire de la même carte', () => {
    const b = persistentCard('Bannière', []);
    const game = scenario({ p1: { hand: [b, b] } });
    expect(play(game, 0, 0).error).toBeUndefined();
    expect(play(game, 0, 1).error).toBe('Cette carte est déjà en jeu');
  });

  it('cumule des Persistants différents', () => {
    const game = scenario({
      p1: { hand: [persistentCard('A', []), persistentCard('B', [])] },
    });
    expect(play(game, 0, 0).error).toBeUndefined();
    expect(play(game, 0, 1).error).toBeUndefined();
  });

  it('refuse un 4e support quand les 3 cases sont pleines', () => {
    const game = scenario({
      p1: {
        hand: [persistentCard('D', [])],
        supports: [persistentCard('A', []), persistentCard('B', []), persistentCard('C', [])],
      },
    });
    expect(play(game, 0, 0).error).toBe('Zones support pleines');
  });

  it('accepte le même Persistant que l’adversaire', () => {
    const t = terrainCard('Tactique', []);
    const game = scenario({ p1: { hand: [t] }, p2: { supports: [t] } });
    expect(play(game, 0, 0).error).toBeUndefined();
  });
});

describe('Terrains', () => {
  it('un second Terrain sans confirmation est refusé', () => {
    const game = scenario({
      p1: { hand: [terrainCard('Tactique', [])], supports: [terrainCard('Mont', [])] },
    });
    expect(play(game, 0, 1).error).toBe('Confirme le remplacement de ton Terrain');
    expect(game.player1.hand).toHaveLength(1);
  });

  it('remplace le Terrain en place, dans sa case', () => {
    const game = scenario({
      p1: {
        hand: [terrainCard('Tactique', [])],
        supports: [null, terrainCard('Mont', []), null],
      },
    });
    const old = game.player1.supportZones[1]!;
    expect(play(game, 0, 0, old.instanceId).error).toBeUndefined();
    expect(game.player1.supportZones[1]?.baseCard.name).toBe('Tactique');
    expect(game.player1.supportZones[0]).toBeNull();
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain('Mont');
  });

  it('un Terrain et des Persistants cohabitent', () => {
    const game = scenario({
      p1: { hand: [terrainCard('Tactique', [])], supports: [persistentCard('Bannière', [])] },
    });
    expect(play(game, 0, 1).error).toBeUndefined();
  });
});
```
Dans `fight-events.spec.ts` (l.209-240), `client-state.builder.spec.ts:126` et `sandbox.service.spec.ts:228` : `terrain_played` devient `support_placed`.

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- persistents fight-events`
Expected : FAIL.

- [ ] **Step 3 : faire passer `replaceInstanceId` jusqu'au service**

`fights.gateway.ts`, dans `playSupport` :
```ts
      targetInstanceId: data.targetInstanceId,
      replaceInstanceId: data.replaceInstanceId,
```
`game-engine.ts`, `case 'play_support'` : ajouter `action.replaceInstanceId` comme 6e argument. Dans `support.service.ts`, ajouter le paramètre `replaceInstanceId: string | undefined` à `playSupport`.

- [ ] **Step 4 : remplacer la branche TERRAIN**

Dans `support.service.ts` (importer `canPlaceInSupportZone` et `sendToGraveyard` depuis l'endroit où `effects-resolver.service.ts` l'importe), remplacer `case SupportType.TERRAIN: { … }` par :
```ts
      case SupportType.PERSISTENT:
      case SupportType.CHARGE: {
        const placement = canPlaceInSupportZone(player.supportZones, support.baseCard);
        const undo = (error: string) => {
          player.hand.splice(handIndex, 0, support);
          return { error };
        };
        if (placement.kind === 'duplicate') return undo('Cette carte est déjà en jeu');
        if (placement.kind === 'full') return undo('Zones support pleines');
        if (
          support.baseCard.supportType === SupportType.CHARGE &&
          support.baseCard.chargeMode === ChargeMode.CYCLIC
        )
          return undo('Mode de charge cyclique pas encore disponible');

        let zone: number;
        if (placement.kind === 'replace_terrain') {
          const old = player.supportZones[placement.zoneIndex]!;
          if (replaceInstanceId !== old.instanceId)
            return undo('Confirme le remplacement de ton Terrain');
          player.supportZones[placement.zoneIndex] = null;
          sendToGraveyard(player, old);
          addLog(game, `${player.username} remplace ${old.baseCard.name}`);
          zone = placement.zoneIndex;
        } else {
          if (zoneIndex === undefined || zoneIndex < 0 || zoneIndex > 2)
            return undo('Zone invalide (0-2)');
          if (player.supportZones[zoneIndex]) return undo('Zone de support occupée');
          zone = zoneIndex;
        }

        support.placedSeq = ++game.terrainSeq;
        if (support.baseCard.supportType === SupportType.CHARGE)
          support.chargeCounters = 0;
        player.supportZones[zone] = support;
        game.pendingEvents.push({
          kind: 'support_placed',
          ownerId: player.userId,
          zoneIndex: zone,
          instanceId: support.instanceId,
        });
        addLog(game, `${player.username} pose ${support.baseCard.name} en zone ${zone}`);
        this.effectsResolver.resolve(support, EffectTrigger.ON_PLAY, {
          game,
          ownerUserId: userId,
          log,
        });
        break;
      }
```
Vérifier que `sendToGraveyard` ignore les `token` comme pour les monstres ; sinon pousser simplement `player.graveyard.push(old)`. Renommer `terrainSeq` en `supportSeq` dans `game-state.interface.ts` et `game-factory.ts` (et les specs qui l'utilisent).

- [ ] **Step 5 : buffs**

`buffs-calculator.service.ts:72-74` :
```ts
    // 2. Persistants : uniquement les monstres de leur propriétaire
    for (const persistent of player.supportZones) {
      if (!persistent || persistent.baseCard.supportType !== SupportType.PERSISTENT)
        continue;
```
Renommer `terrain` en `persistent` dans la boucle. `terrainTargets` peut garder son nom.

- [ ] **Step 6 : tests**

Run : `pnpm --filter @pipou/backend test -- persistents fight-events client-state buffs`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add apps/backend/src/fights
git commit -m "feat(fight): Persistants cumulables, un seul Terrain qui remplace l'ancien"
```

---

### Task 5 : emplacements d'équipement dans le moteur

**Files :**
- Modify : `apps/backend/src/fights/services/support.service.ts` (case `EQUIPMENT` l.120-148)
- Create : `apps/backend/src/fights/engine/equipment-slots.spec.ts`

**Interfaces :**
- Consumes : `canEquip` (tâche 2), `equipmentCard` avec un `equipmentSlot` passé en override (tâche 3), paramètre `replaceInstanceId` (tâche 4).
- Produces : erreurs `'Ce monstre porte déjà cet accessoire'`, `'Emplacement plein : confirme le remplacement'`, `'Équipement sans emplacement'`, `'Équipement à remplacer introuvable'`.

- [ ] **Step 1 : tests (doivent échouer)**

```ts
import { EquipmentSlot } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { equipmentCard, monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();
const off = (n: string) => equipmentCard(n, [], { equipmentSlot: EquipmentSlot.OFFENSIVE });
const acc = (n: string) => equipmentCard(n, [], { equipmentSlot: EquipmentSlot.ACCESSORY });

const setup = (hand: ReturnType<typeof off>[], equipments: ReturnType<typeof off>[] = []) => {
  const game = scenario({
    p1: { hand, monsters: [{ card: monsterCard('Alpha', { atk: 100, hp: 1000 }), equipments }] },
  });
  const host = game.player1.monsterZones[0]!;
  const equip = (handIndex: number, replaceInstanceId?: string) =>
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex,
      targetInstanceId: host.instanceId,
      ...(replaceInstanceId && { replaceInstanceId }),
    });
  return { game, host, equip };
};

describe('emplacements d’équipement', () => {
  it('équipe dans un emplacement libre', () => {
    const { host, equip } = setup([off('Canon')]);
    expect(equip(0).error).toBeUndefined();
    expect(host.equipments.map((e) => e.baseCard.name)).toEqual(['Canon']);
  });

  it('emplacement plein sans confirmation : refusé, carte rendue', () => {
    const { game, equip } = setup([off('Canon')], [off('Processeur')]);
    expect(equip(0).error).toBe('Emplacement plein : confirme le remplacement');
    expect(game.player1.hand).toHaveLength(1);
  });

  it('remplacement : l’ancien part au cimetière', () => {
    const { game, host, equip } = setup([off('Canon')], [off('Processeur')]);
    const old = host.equipments[0].instanceId;
    expect(equip(0, old).error).toBeUndefined();
    expect(host.equipments.map((e) => e.baseCard.name)).toEqual(['Canon']);
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain('Processeur');
  });

  it('remplacement d’un équipement d’un autre emplacement : refusé', () => {
    const { equip, host } = setup([off('Canon')], [off('Processeur'), acc('Module')]);
    const wrong = host.equipments[1].instanceId;
    expect(equip(0, wrong).error).toBe('Équipement à remplacer introuvable');
  });

  it('deux accessoires différents, pas de doublon', () => {
    const { equip } = setup([acc('Module'), acc('Module'), acc('Autre')]);
    expect(equip(0).error).toBeUndefined();
    expect(equip(0).error).toBe('Ce monstre porte déjà cet accessoire');
    expect(equip(1).error).toBeUndefined();
  });

  it('les bonus de l’équipement remplacé disparaissent', () => {
    // Processeur : +100 ATK en PASSIVE SELF ; Canon : +250
    const buff = (v: number) => [
      { trigger: 'PASSIVE', condition: null, actions: [{ type: 'BUFF_ATK', target: 'SELF', value: v }] },
    ] as never;
    const proc = equipmentCard('Processeur', buff(100), { equipmentSlot: EquipmentSlot.OFFENSIVE });
    const canon = equipmentCard('Canon', buff(250), { equipmentSlot: EquipmentSlot.OFFENSIVE });
    const { game, host, equip } = setup([canon], [proc]);
    engine.dispatch(game, 'p1', { type: 'end_phase' }); // force un recalcul ? sinon appeler le recalcul utilisé par les autres specs de buffs
    expect(equip(0, host.equipments[0].instanceId).error).toBeUndefined();
    // lire l'ATK effective comme dans buffs.spec.ts
  });
});
```
Pour le dernier test, recopier la façon dont `engine/buffs.spec.ts` lit l'ATK effective après une action, et retirer la ligne `end_phase` si le recalcul se fait déjà après chaque `dispatch`. Expected final : ATK de base + 250, et non + 350.

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- equipment-slots`
Expected : FAIL (aujourd'hui, tout s'empile).

- [ ] **Step 3 : implémenter**

Dans `case SupportType.EQUIPMENT`, remplacer `target.equipments.push(support);` par :
```ts
        const check = canEquip(target.equipments, support.baseCard);
        const undo = (error: string) => {
          player.hand.splice(handIndex, 0, support);
          return { error };
        };
        if (check.kind === 'no_slot') return undo('Équipement sans emplacement');
        if (check.kind === 'duplicate') return undo('Ce monstre porte déjà cet accessoire');
        if (check.kind === 'slot_full') {
          if (!replaceInstanceId) return undo('Emplacement plein : confirme le remplacement');
          if (!check.replaceable.includes(replaceInstanceId))
            return undo('Équipement à remplacer introuvable');
          const idx = target.equipments.findIndex((e) => e.instanceId === replaceInstanceId);
          const [old] = target.equipments.splice(idx, 1);
          sendToGraveyard(player, old);
          addLog(game, `${old.baseCard.name} est remplacé`);
        }
        target.equipments.push(support);
```
Attention : si l'équipement remplacé est posé sur un Zeta implanté chez l'adversaire, `sendToGraveyard` doit cibler le cimetière du **propriétaire de la carte** (`player`), ce qui est le cas ici puisque seul le poseur peut équiper.

- [ ] **Step 4 : tests**

Run : `pnpm --filter @pipou/backend test -- equipment-slots supports`
Expected : PASS. Les specs existantes qui empilent plusieurs équipements sur un monstre (`supports.spec.ts`, `card-rework-cards.spec.ts`, `real-cards.spec.ts`) peuvent échouer : leur passer les bons emplacements (`equipmentSlot`) ou, pour les vraies cartes, attendre la tâche 8.

- [ ] **Step 5 : commit**

```bash
git add apps/backend/src/fights
git commit -m "feat(fight): emplacements d'équipement (1 offensif, 1 défensif, 2 accessoires) avec remplacement"
```

---

### Task 6 : Charges dans le moteur

**Files :**
- Create : `apps/backend/src/fights/helpers/charges.ts`, `apps/backend/src/fights/engine/charges.spec.ts`
- Modify : `apps/backend/src/fights/services/phase.service.ts` (`startTurn` l.97-158, `resolveForBoard` l.228-235), `apps/backend/src/fights/effects/effect-actions.applier.ts` (switch des actions, près de `GAIN_RECYCLE_ENERGY` l.363), `apps/backend/src/fights/engine/supported-effects.ts`

**Interfaces :**
- Consumes : `chargeCard` (tâche 3), branche `CHARGE` de `playSupport` (tâche 4).
- Produces : `addChargeCounters(game, player, charge, amount, resolve)`, où `resolve(card)` exécute `ON_CHARGED` ; événements `charge_progress` et `charge_triggered`.

- [ ] **Step 1 : tests (doivent échouer)**

```ts
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, chargeCard, effect, ephemeralCard } from '../testing/cards';
import { scenario } from '../testing/scenario';

const engine = createEngine();
const draw2 = effect(EffectTrigger.ON_CHARGED, [act(ActionType.DRAW, EffectTarget.PLAYER, { value: 2 })]);
const passTurns = (game: ReturnType<typeof scenario>, n: number) => {
  for (let i = 0; i < n; i++) {
    // fin de tour p1 puis fin de tour p2 : recopier la séquence de turn-cycle.spec.ts
  }
};

describe('Charges', () => {
  it('posée avec 0 compteur', () => {
    const game = scenario({ p1: { hand: [chargeCard('Rituel', 2, [draw2])] } });
    expect(engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, zoneIndex: 0 }).error).toBeUndefined();
    expect(game.player1.supportZones[0]?.chargeCounters).toBe(0);
  });

  it('+1 au début de chaque tour de son propriétaire, puis déclenchement et cimetière', () => {
    const game = scenario({ p1: { supports: [chargeCard('Rituel', 2, [draw2])] } });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(game.player1.supportZones[0]?.chargeCounters).toBe(1);
    const handBefore = game.player1.hand.length;
    passTurns(game, 1);
    expect(game.player1.supportZones[0]).toBeNull();
    expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain('Rituel');
    expect(game.player1.hand.length).toBe(handBefore + 1 + 2); // pioche du tour + DRAW 2
    expect(game.pendingEvents.some((e) => e.kind === 'charge_triggered')).toBe(true);
  });

  it('ADD_CHARGE_COUNTERS accélère la charge', () => {
    const boost = ephemeralCard('Surcharge', [
      effect(EffectTrigger.ON_PLAY, [act(ActionType.ADD_CHARGE_COUNTERS, EffectTarget.PLAYER, { value: 2 })]),
    ]);
    const game = scenario({ p1: { hand: [boost], supports: [chargeCard('Rituel', 3, [draw2])] } });
    game.player1.supportZones[0]!.chargeCounters = 1;
    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
    expect(game.player1.supportZones[0]).toBeNull(); // 1 + 2 = 3 → déclenchée
  });

  it('mode cyclique refusé', () => {
    const game = scenario({
      p1: { hand: [chargeCard('Cycle', 2, [], { chargeMode: 'CYCLIC' as never })] },
    });
    expect(engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, zoneIndex: 0 }).error)
      .toBe('Mode de charge cyclique pas encore disponible');
  });

  it('les charges adverses ne bougent pas pendant mon tour', () => {
    const game = scenario({ p2: { supports: [chargeCard('Rituel', 5, [])] } });
    game.player2.supportZones[0]!.chargeCounters = 0;
    // début de tour de p1 seulement : appeler phaseService.startTurn(game, game.player1) comme turn-cycle.spec.ts
    expect(game.player2.supportZones[0]?.chargeCounters).toBe(0);
  });
});
```
Avant d'écrire `passTurns`, lire `engine/turn-cycle.spec.ts` et recopier la façon dont il fait avancer un tour complet (`end_phase` répété jusqu'au tour suivant de p1). Si l'éphémère sans cible exige une validation `unplayableReason`, vérifier que `ADD_CHARGE_COUNTERS` sur `PLAYER` est jouable via `canResolveAction` (`effects/effect-resolvability.ts`) et l'y déclarer.

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- charges effects-coverage`
Expected : FAIL (`effects-coverage` échoue aussi tant que `ON_CHARGED` et `ADD_CHARGE_COUNTERS` ne sont pas déclarés).

- [ ] **Step 3 : helper**

`apps/backend/src/fights/helpers/charges.ts` :
```ts
import { SupportType } from '@pipou/shared';
import type { CardInstance, GameState, PlayerGameState } from '../interfaces/game-state.interface';
import { sendToGraveyard } from './<module qui exporte sendToGraveyard>';

/**
 * Ajoute des compteurs à une Charge posée par `player`. À `chargeMax`,
 * `resolveCharged` exécute ON_CHARGED puis la carte part au cimetière (ONE_SHOT).
 */
export function addChargeCounters(
  game: GameState,
  player: PlayerGameState,
  charge: CardInstance,
  amount: number,
  resolveCharged: (card: CardInstance) => void,
  log: string[],
): void {
  const zoneIndex = player.supportZones.indexOf(charge);
  const max = charge.baseCard.chargeMax ?? 1;
  if (zoneIndex === -1 || charge.baseCard.supportType !== SupportType.CHARGE) return;
  charge.chargeCounters = Math.min(max, (charge.chargeCounters ?? 0) + amount);
  game.pendingEvents.push({
    kind: 'charge_progress',
    ownerId: player.userId,
    zoneIndex,
    instanceId: charge.instanceId,
    counters: charge.chargeCounters,
    max,
  });
  if (charge.chargeCounters < max) return;
  log.push(`⚡ ${charge.baseCard.name} est chargée !`);
  game.pendingEvents.push({
    kind: 'charge_triggered',
    ownerId: player.userId,
    zoneIndex,
    instanceId: charge.instanceId,
  });
  player.supportZones[zoneIndex] = null;
  resolveCharged(charge);
  sendToGraveyard(player, charge);
}

export function chargesOf(player: PlayerGameState): CardInstance[] {
  return player.supportZones.filter(
    (z): z is CardInstance => !!z && z.baseCard.supportType === SupportType.CHARGE,
  );
}
```
La carte est retirée de sa case **avant** `ON_CHARGED`, pour qu'un effet qui pose un support puisse utiliser la case libérée et qu'elle ne se déclenche pas deux fois. Remplacer `<module qui exporte sendToGraveyard>` par le chemin réel (voir l'import dans `effects-resolver.service.ts`). Le log `⚡` suit le style existant des logs de partie (`♻️`, `🛡️`) : ce sont des journaux texte, pas de l'UI.

- [ ] **Step 4 : tic au début de tour**

`phase.service.ts`, dans `startTurn`, juste avant `this.resolveForBoard(game, player, EffectTrigger.ON_TURN_START, log);` :
```ts
    for (const charge of chargesOf(player))
      addChargeCounters(game, player, charge, 1, (card) =>
        this.effectsResolver.resolve(card, EffectTrigger.ON_CHARGED, {
          game,
          ownerUserId: player.userId,
          log,
        }), log);
```
Dans `resolveForBoard` (l.228), la boucle `for (const terrain of player.supportZones)` résout `ON_TURN_START`/`ON_TURN_END` de toutes les cartes en zone : la garder, en renommant `terrain` en `support`.

- [ ] **Step 5 : action ADD_CHARGE_COUNTERS**

`effect-actions.applier.ts`, après `GAIN_RECYCLE_ENERGY` :
```ts
      case ActionType.ADD_CHARGE_COUNTERS:
        for (const p of targets.players)
          for (const charge of chargesOf(p))
            addChargeCounters(ctx.game, p, charge, action.value ?? 1, (card) =>
              resolveTrigger(card, EffectTrigger.ON_CHARGED, p.userId), ctx.log);
        break;
```
`resolveTrigger` n'existe pas dans l'applier : regarder comment l'applier déclenche déjà des effets d'une autre carte (par exemple `hatchEgg` ou la résolution d'`ON_DEATH`) et réutiliser ce mécanisme (callback de résolution passé dans `ctx`, ou appel à `EffectsResolverService`). Ne pas créer de dépendance circulaire entre services : si l'applier ne peut pas appeler le resolver, ajouter un champ optionnel `resolve?: (card, trigger, ownerUserId) => void` au contexte, que `EffectsResolverService` renseigne avec lui-même.

`supported-effects.ts` : ajouter `EffectTrigger.ON_CHARGED` à `SUPPORTED_TRIGGERS` et `ActionType.ADD_CHARGE_COUNTERS` à `SUPPORTED_ACTIONS`.

- [ ] **Step 6 : tests**

Run : `pnpm --filter @pipou/backend test -- charges effects-coverage turn-cycle`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add apps/backend/src/fights
git commit -m "feat(fight): type de support Charge (+1 par tour, ADD_CHARGE_COUNTERS, ON_CHARGED à usage unique)"
```

---

### Task 7 : sandbox, vraies cartes et données d'e2e

**Files :**
- Modify : `apps/backend/src/sandbox/sandbox-setup.ts:100-180`, `apps/backend/src/sandbox/sandbox.service.spec.ts`, `apps/backend/.e2e/cards-2026-10-30.json`, `apps/backend/src/fights/engine/real-cards.spec.ts`, `apps/backend/src/fights/engine/card-rework-cards.spec.ts`, `apps/backend/src/fights/engine/supports.spec.ts`, ainsi que les specs qui utilisent `SupportType.TERRAIN` ou `terrainCard`
- Modify : `apps/backend/src/fights/ai/telemetry.ts:161`, `apps/backend/src/fights/ai/candidate-actions.ts:227` (renommage minimal pour compiler ; la vraie logique d'IA est à la tâche 8)

**Interfaces :**
- Consumes : `canEquip`, `canPlaceInSupportZone`.

- [ ] **Step 1 : faire compiler le backend**

Run : `pnpm --filter @pipou/backend typecheck`
Corriger chaque `SupportType.TERRAIN` : remplacer par `SupportType.PERSISTENT` (et, pour la télémétrie, compter aussi `CHARGE`). Dans `sandbox-setup.ts:131`, la pose en zone support accepte `PERSISTENT` et `CHARGE` et passe par `canPlaceInSupportZone`. La pose d'un équipement en sandbox (`zone: "equipment"`) passe par `canEquip` : la sandbox **refuse** au lieu de remplacer, avec le même message d'erreur que le moteur.

- [ ] **Step 2 : données d'e2e**

Dans `apps/backend/.e2e/cards-2026-10-30.json` : passer les 2 terrains en `"supportType": "PERSISTENT", "isTerrain": true`, ajouter `equipmentSlot` aux 7 équipements selon les Global Constraints, et `"isTerrain": false, "equipmentSlot": null, "chargeMax": null, "chargeMode": null` aux autres cartes si le chargeur de ce fichier l'exige (sinon, laisser `supportCard` donner les valeurs par défaut).

- [ ] **Step 3 : specs des vraies cartes**

Lancer `pnpm --filter @pipou/backend test`. Pour chaque spec qui empile deux équipements du même emplacement (par exemple Canon + Processeur, ou Firewall + Firewall de Surcharge), **ne pas** contourner la règle : réécrire le scénario pour utiliser un seul équipement de cet emplacement, ou remplacer explicitement avec `replaceInstanceId`. Ajouter dans `real-cards.spec.ts` :
```ts
it('les vrais équipements ont tous un emplacement', () => {
  const missing = REAL_CARDS.filter(
    (c) => c.supportType === SupportType.EQUIPMENT && !c.equipmentSlot,
  );
  expect(missing.map((c) => c.name)).toEqual([]);
});
```
(Adapter `REAL_CARDS` au nom réel de la liste chargée dans ce fichier.)

- [ ] **Step 4 : tests**

Run : `pnpm --filter @pipou/backend test`
Expected : PASS (hors IA, voir tâche 8 si `ai/*.spec.ts` échoue sur des scénarios d'équipement).

- [ ] **Step 5 : commit**

```bash
git add apps/backend
git commit -m "test(fight): vraies cartes, sandbox et données e2e alignées sur les emplacements et les Persistants"
```

---

### Task 8 : IA

**Files :**
- Modify : `apps/backend/src/fights/ai/candidate-actions.ts` (~l.200-260), `apps/backend/src/fights/ai/evaluate.ts` (l.33, l.409-410), `apps/backend/src/fights/ai/archetype-profiles.ts`, `apps/backend/src/adventure/deck-generator.ts` (`pixelmanPlan` l.111-140)
- Test : `apps/backend/src/fights/ai/*.spec.ts` (le spec des candidats existant), `apps/backend/src/adventure/deck-generator.spec.ts`

**Interfaces :**
- Consumes : `canEquip`, `canPlaceInSupportZone`, `replaceInstanceId`.

- [ ] **Step 1 : tests (doivent échouer)**

Dans le spec des candidats (trouver le fichier qui teste `candidate-actions`) :
```ts
it("ne propose pas d'équiper un accessoire déjà porté", () => {
  // monstre allié portant 'Module' (ACCESSORY), main : 'Module'
  // expect(candidates.filter(c => c.type === 'play_support')).toHaveLength(0)
});
it('propose un remplacement quand l’emplacement est plein', () => {
  // monstre portant Processeur (OFFENSIVE +100), main : Canon (OFFENSIVE +250)
  // expect(candidates).toContainEqual(expect.objectContaining({ type: 'play_support', replaceInstanceId: <id Processeur> }))
});
it('pose une Charge sur une case libre', () => {
  // expect(candidates).toContainEqual(expect.objectContaining({ type: 'play_support', zoneIndex: 0 }))
});
it('propose de remplacer le Terrain en place', () => {
  // expect(...replaceInstanceId: <id du Terrain>)
});
```
Écrire ces tests en recopiant la construction de scénario utilisée dans le fichier (même helpers `scenario` et `equipmentCard(..., { equipmentSlot })`).

Dans `evaluate` :
```ts
it('une Charge presque pleine vaut plus qu’une Charge vide', () => {
  // même état, chargeCounters 0 vs chargeMax - 1 : evaluate(full) > evaluate(empty)
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- ai`
Expected : FAIL.

- [ ] **Step 3 : candidats**

Dans `candidate-actions.ts`, pour chaque équipement en main et chaque cible valide :
```ts
const check = canEquip(target.equipments, card.baseCard);
if (check.kind === 'ok')
  out.push({ type: 'play_support', handIndex, targetInstanceId: target.instanceId });
else if (check.kind === 'slot_full')
  for (const replaceInstanceId of check.replaceable)
    out.push({ type: 'play_support', handIndex, targetInstanceId: target.instanceId, replaceInstanceId });
```
Pour `PERSISTENT` et `CHARGE` (remplace la branche `TERRAIN` l.227) :
```ts
const placement = canPlaceInSupportZone(me.supportZones, card.baseCard);
if (placement.kind === 'replace_terrain')
  out.push({
    type: 'play_support',
    handIndex,
    zoneIndex: placement.zoneIndex,
    replaceInstanceId: me.supportZones[placement.zoneIndex]!.instanceId,
  });
else if (placement.kind === 'ok') {
  const zoneIndex = me.supportZones.findIndex((z) => z === null);
  out.push({ type: 'play_support', handIndex, zoneIndex });
}
```
Le planner simule chaque candidat et garde le meilleur selon `evaluate` : un remplacement n'est donc choisi que s'il améliore l'état. Ne pas ajouter d'heuristique en plus.

- [ ] **Step 4 : évaluation**

`evaluate.ts` : renommer `TERRAIN_VALUE` en `PERSISTENT_VALUE`, ne compter que les `PERSISTENT`, et ajouter :
```ts
const CHARGE_VALUE = 120;
const chargeValue = (p: PlayerGameState) =>
  chargesOf(p).reduce((sum, c) => {
    const max = c.baseCard.chargeMax ?? 1;
    return sum + CHARGE_VALUE * (1 + (c.chargeCounters ?? 0) / max);
  }, 0);
add('charges', chargeValue(me));
add('charges', -chargeValue(opp));
```
(`chargesOf` vient de `../helpers/charges`. Si `evaluate` travaille sur un type d'état client plutôt que `PlayerGameState`, filtrer `supportZones` sur `supportType === CHARGE` directement.)

- [ ] **Step 5 : profils et générateur de decks**

`archetype-profiles.ts` : remplacer toute mention de `TERRAIN`. `deck-generator.ts` (`pixelmanPlan`) : le commentaire « tous les équipements » reste vrai (7 cartes), mais limiter chaque équipement d'un emplacement saturé à 2 exemplaires si le plan en met davantage ; mettre à jour le test `'Pixelman : au moins 50 % de supports, tous les équipements'` uniquement si son attente change.

- [ ] **Step 6 : tests**

Run : `pnpm --filter @pipou/backend test`
Expected : PASS (tout le backend).

- [ ] **Step 7 : commit**

```bash
git add apps/backend/src/fights/ai apps/backend/src/adventure
git commit -m "feat(ai): équipements par emplacement, remplacement de Terrain, valeur des Charges"
```

---

### Task 9 : front — libellés et types

**Files :**
- Modify : `apps/frontend/src/i18n/locales/fr.json`, `en.json`, `ko.json` ; `apps/frontend/src/features/cards/CardFace.tsx`, `features/fight/effectText.ts`, `features/fight/FightBoard.tsx`, `features/fight/FightRules.tsx`, `features/fight/mainSlot.ts`, `features/fight/terrainSelection.ts`, `features/fight/fightEvents.ts:86`, `features/glossary/cardCatalog.ts`, `features/sandbox/SandboxSetup.tsx`, `features/deck/DeckBuilder.tsx`, plus les fichiers trouvés par le grep du Step 1
- Test : `apps/frontend/src/__tests__/unit/effectText.test.ts` et les tests touchés

- [ ] **Step 1 : lister les occurrences**

Run : `pnpm --filter @pipou/frontend typecheck`, puis chercher `"TERRAIN"`, `terrain_played`, `isTerrain` et `supportType ===` dans `apps/frontend/src`.

- [ ] **Step 2 : clés i18n**

Dans `fr.json`, sous l'objet qui contient `"TERRAIN": "Terrain"` (l.1229), remplacer par :
```json
"PERSISTENT": "Persistant",
"CHARGE": "Charge",
```
et ajouter, au même niveau que ce bloc, un bloc `equipmentSlot` et des libellés :
```json
"equipmentSlot": {
  "OFFENSIVE": "Offensif",
  "DEFENSIVE": "Défensif",
  "ACCESSORY": "Accessoire"
},
"terrainTag": "Terrain",
"charge": { "progress": "{{n}}/{{max}}" }
```
Remplacer `ON_PLAY_terrain` / `PASSIVE_terrain` par `ON_PLAY_persistent` (« Quand tu poses ce Persistant ») et `PASSIVE_persistent` (« Tant que ce Persistant est en jeu »), et ajouter `ON_CHARGED` : « Quand cette Charge est pleine ». Mettre à jour `rules.board2` (« 3 Zones Support pour les Persistants et les Charges »), `rules.terrain` (renommer la clé en `rules.persistent` et ajouter `rules.charge` : « Gagne un compteur à chaque début de ton tour ; son effet se déclenche une fois plein. ») et `terrainHint`. Faire de même en anglais (`Persistent`, `Charge`, `Offensive`, `Defensive`, `Accessory`) et en coréen (`지속`, `충전`, `공격`, `방어`, `장신구`). Ajouter dans les trois langues les messages des modales (tâche 11) :
```json
"fight": { "confirm": {
  "replaceEquipment": "Remplacer {{old}} par {{card}} ?",
  "replaceTerrain": "Remplacer {{old}} par {{card}} ?",
  "chooseAccessory": "Quel accessoire remplacer ?"
}, "unplayable": {
  "supportZonesFull": "Zones support pleines",
  "alreadyInPlay": "Déjà en jeu",
  "noEquipTarget": "Aucun monstre ne peut porter cet équipement"
}}
```
(À fusionner dans les objets `fight.confirm` et, s'il existe, `fight.unplayable`, sans écraser les clés existantes.)

- [ ] **Step 3 : code**

Remplacer chaque test `supportType === "TERRAIN"` : par `"PERSISTENT"` quand il s'agit de la zone support, et par `supportType === "PERSISTENT" || supportType === "CHARGE"` pour « peut aller en zone support ». Par exemple, dans `FightBoard.tsx:231` :
```ts
  const isZoneSupport =
    selectedCardData?.type === "support" &&
    (selectedCardData.supportType === SupportType.PERSISTENT ||
      selectedCardData.supportType === SupportType.CHARGE);
```
(renommer `isTerrain` en `isZoneSupport` partout dans le fichier). `fightEvents.ts:86` : `case "support_placed":`. Utiliser les constantes `SupportType.*` de `@pipou/shared` plutôt que des chaînes.

- [ ] **Step 4 : tests et typecheck**

Run : `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend test`
Expected : PASS (mettre à jour `effectText.test.ts` pour les nouveaux libellés).

- [ ] **Step 5 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): libellés Persistant, Charge et emplacements d'équipement"
```

---

### Task 10 : front — pastilles d'équipement et contour de charge

**Files :**
- Create : `apps/frontend/src/features/fight/Zonerow/EquipmentPips.tsx`, `apps/frontend/src/features/fight/Zonerow/ChargeFrame.tsx`, `apps/frontend/src/__tests__/components/EquipmentPips.test.tsx`, `apps/frontend/src/__tests__/components/ChargeFrame.test.tsx`
- Modify : `apps/frontend/src/features/fight/Zonerow/MonsterZoneContent.tsx:47-66`, `apps/frontend/src/features/fight/Zonerow/ZoneRow.tsx` (rendu des zones support), `apps/frontend/src/features/fight/CardInspect.tsx`, `apps/frontend/src/components/Icons.tsx`, la feuille de style des `zr-*` (chercher `zr-equipment-chip`)

**Interfaces :**
- Produces : `<EquipmentPips equipments={CardInstance[]} />`, `<ChargeFrame counters={number} max={number}>{children}</ChargeFrame>`, `IconTerrain` dans `Icons.tsx`.

- [ ] **Step 1 : tests (doivent échouer)**

`EquipmentPips.test.tsx` :
```tsx
import { render, screen } from "@testing-library/react";
import { EquipmentPips } from "../../features/fight/Zonerow/EquipmentPips";

const eq = (name: string, equipmentSlot: string) =>
  ({ instanceId: name, baseCard: { name, equipmentSlot } }) as never;

it("une pastille par équipement, dans l'ordre Offensif, Défensif, Accessoire", () => {
  render(<EquipmentPips equipments={[eq("Module", "ACCESSORY"), eq("Canon", "OFFENSIVE")]} />);
  const pips = screen.getAllByRole("img");
  expect(pips.map((p) => p.getAttribute("data-slot"))).toEqual(["OFFENSIVE", "ACCESSORY"]);
  expect(pips[0]).toHaveAccessibleName(/Canon/);
});

it("rien si aucun équipement", () => {
  const { container } = render(<EquipmentPips equipments={[]} />);
  expect(container).toBeEmptyDOMElement();
});
```
`ChargeFrame.test.tsx` :
```tsx
import { render, screen } from "@testing-library/react";
import { ChargeFrame } from "../../features/fight/Zonerow/ChargeFrame";

it("affiche n/max et la progression", () => {
  render(<ChargeFrame counters={2} max={4}><span>art</span></ChargeFrame>);
  expect(screen.getByText("2/4")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
});
```
Si les tests de composants du dépôt enveloppent le rendu dans un provider i18n, recopier ce wrapper (voir `CardInspect.test.tsx`).

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- EquipmentPips ChargeFrame`
Expected : FAIL.

- [ ] **Step 3 : EquipmentPips**

```tsx
import { EquipmentSlot } from "@pipou/shared";
import type { CardInstance } from "@pipou/shared";
import { useTranslation } from "react-i18next";

const ORDER: EquipmentSlot[] = [EquipmentSlot.OFFENSIVE, EquipmentSlot.DEFENSIVE, EquipmentSlot.ACCESSORY];

/** Colonne de pastilles collée au bord droit de la carte : une par équipement porté. */
export function EquipmentPips({ equipments }: { equipments: CardInstance[] }) {
  const { t } = useTranslation();
  if (equipments.length === 0) return null;
  const sorted = [...equipments].sort(
    (a, b) =>
      ORDER.indexOf(a.baseCard.equipmentSlot ?? EquipmentSlot.ACCESSORY) -
      ORDER.indexOf(b.baseCard.equipmentSlot ?? EquipmentSlot.ACCESSORY),
  );
  return (
    <div className="zr-equip-pips">
      {sorted.map((eq) => {
        const slot = eq.baseCard.equipmentSlot ?? EquipmentSlot.ACCESSORY;
        return (
          <span
            key={eq.instanceId}
            role="img"
            data-slot={slot}
            className={`zr-equip-pip zr-equip-pip--${slot.toLowerCase()}`}
            aria-label={`${t(`equipmentSlot.${slot}`)} : ${eq.baseCard.name}`}
            title={`${t(`equipmentSlot.${slot}`)} : ${eq.baseCard.name}`}
          />
        );
      })}
    </div>
  );
}
```
Adapter le préfixe de clé i18n (`equipmentSlot.*`) à l'endroit où le bloc a été placé à la tâche 9. CSS, dans la feuille qui définit `zr-equipment-chip` (remplacer les règles `zr-equipment-list` et `zr-equipment-chip`) :
```css
.zr-equip-pips { position: absolute; right: -6px; top: 8px; display: flex; flex-direction: column; gap: 3px; z-index: 2; }
.zr-equip-pip { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 1px 2px rgba(0,0,0,.35); }
.zr-equip-pip--offensive { background: #c4462f; }
.zr-equip-pip--defensive { background: #3a6fb0; }
.zr-equip-pip--accessory { background: #6b8f3a; }
```
Le conteneur de la carte monstre doit être `position: relative` (le vérifier). Dans `MonsterZoneContent.tsx`, remplacer le bloc l.47-66 par `<EquipmentPips equipments={zone.equipments ?? []} />`. Si `equipmentSummary` n'est plus utilisé ici, le garder pour `CardInspect`.

- [ ] **Step 4 : ChargeFrame**

```tsx
import type { ReactNode } from "react";

/** Contour de l'illustration qui se remplit avec la charge, « n/max » en dessous. */
export function ChargeFrame({ counters, max, children }: { counters: number; max: number; children: ReactNode }) {
  const pct = Math.min(100, Math.round((counters / Math.max(1, max)) * 100));
  return (
    <div className="zr-charge">
      <div
        className="zr-charge__frame"
        style={{ "--charge": `${pct}%` } as React.CSSProperties}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={counters}
      >
        {children}
      </div>
      <span className="zr-charge__count">{counters}/{max}</span>
    </div>
  );
}
```
CSS : contour tracé par un pseudo-élément avec un `conic-gradient` masqué en anneau, pour que rien ne recouvre l'image :
```css
.zr-charge__frame { position: relative; border-radius: 6px; }
.zr-charge__frame::after {
  content: ""; position: absolute; inset: -3px; border-radius: 8px; pointer-events: none;
  background: conic-gradient(#ffb43a var(--charge), rgba(255,255,255,.35) 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; padding: 3px;
  transition: background .4s ease;
}
.zr-charge__count { display: block; text-align: center; font: 700 9px/1 inherit; margin-top: 2px; }
```
Dans `ZoneRow.tsx`, là où une carte de zone support est rendue : si `card.baseCard.supportType === SupportType.CHARGE`, envelopper l'illustration dans `<ChargeFrame counters={card.chargeCounters ?? 0} max={card.baseCard.chargeMax ?? 1}>`. Si `card.baseCard.isTerrain`, afficher `<IconTerrain size={12} />` en coin.

- [ ] **Step 5 : IconTerrain et CardInspect**

Ajouter à `Icons.tsx`, dans le style des autres icônes (même signature `{ size }`), une icône montagne :
```tsx
export function IconTerrain({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20h18L14 7l-4 7-2-3z" />
    </svg>
  );
}
```
(Recopier exactement la signature des icônes voisines si elle diffère.) Dans `CardInspect.tsx`, remplacer la liste des équipements par 4 lignes : Offensif, Défensif, Accessoire, Accessoire. Une ligne vide affiche « — ». Mettre à jour `CardInspect.test.tsx`.

- [ ] **Step 6 : tests**

Run : `pnpm --filter @pipou/frontend test`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(fight): pastilles d'équipement, contour de charge, icône Terrain"
```

---

### Task 11 : front — jouer un équipement, un Terrain ou une Charge

**Files :**
- Create : `apps/frontend/src/features/fight/ReplaceSupportDialog.tsx`, `apps/frontend/src/features/fight/supportPlay.ts`, `apps/frontend/src/__tests__/unit/supportPlay.test.ts`, `apps/frontend/src/__tests__/components/ReplaceSupportDialog.test.tsx`
- Modify : `apps/frontend/src/features/fight/pendingAction.ts` (l.23-28 et l.97-98), `features/fight/FightBoard.tsx` (l.460-560, l.619), `features/fight/emitGameAction.ts:37-45`, `features/fight/useBoardControls.ts:~105`, la surbrillance des cibles (chercher où `isEquipment` décide des zones mises en avant)

**Interfaces :**
- Consumes : `canEquip`, `canPlaceInSupportZone` (shared), clés i18n de la tâche 9.
- Produces :
  - `equipIntent(monster, card): { kind: "play" } | { kind: "confirm"; replaceable: string[] } | { kind: "blocked" }`
  - `zoneIntent(supportZones, card): { kind: "play" } | { kind: "confirm_terrain"; zoneIndex: number; old: string } | { kind: "blocked"; reason: "full" | "duplicate" }`
  - `PendingAction` `playSupport` avec `replaceInstanceId?`

- [ ] **Step 1 : tests de la logique (doivent échouer)**

`supportPlay.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { equipIntent, zoneIntent } from "../../features/fight/supportPlay";

const inst = (name: string, extra: object = {}) =>
  ({ instanceId: name, baseCard: { name, supportType: "EQUIPMENT", equipmentSlot: "OFFENSIVE", isTerrain: false, ...extra } }) as never;

describe("equipIntent", () => {
  it("joue directement si l'emplacement est libre", () => {
    expect(equipIntent({ equipments: [] } as never, inst("Canon").baseCard)).toEqual({ kind: "play" });
  });
  it("demande confirmation si plein", () => {
    expect(equipIntent({ equipments: [inst("Proc")] } as never, inst("Canon").baseCard)).toEqual({
      kind: "confirm", replaceable: ["Proc"],
    });
  });
  it("bloque un doublon d'accessoire", () => {
    const m = inst("Module", { equipmentSlot: "ACCESSORY" });
    expect(equipIntent({ equipments: [m] } as never, m.baseCard)).toEqual({ kind: "blocked" });
  });
});

describe("zoneIntent", () => {
  it("demande confirmation pour remplacer un Terrain", () => {
    const old = inst("Mont", { supportType: "PERSISTENT", isTerrain: true });
    const card = inst("Tactique", { supportType: "PERSISTENT", isTerrain: true }).baseCard;
    expect(zoneIntent([null, old, null], card)).toEqual({ kind: "confirm_terrain", zoneIndex: 1, old: "Mont" });
  });
  it("bloque si les 3 cases sont pleines", () => {
    const p = (n: string) => inst(n, { supportType: "PERSISTENT" });
    expect(zoneIntent([p("A"), p("B"), p("C")], p("D").baseCard)).toEqual({ kind: "blocked", reason: "full" });
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- supportPlay`
Expected : FAIL.

- [ ] **Step 3 : supportPlay.ts**

```ts
import { canEquip, canPlaceInSupportZone } from "@pipou/shared";
import type { CardInstance, ClientCard, MonsterOnBoard } from "@pipou/shared";

export type EquipIntent =
  | { kind: "play" }
  | { kind: "confirm"; replaceable: string[] }
  | { kind: "blocked" };

export function equipIntent(monster: Pick<MonsterOnBoard, "equipments">, card: ClientCard): EquipIntent {
  const check = canEquip(monster.equipments, card);
  if (check.kind === "ok") return { kind: "play" };
  if (check.kind === "slot_full") return { kind: "confirm", replaceable: check.replaceable };
  return { kind: "blocked" };
}

export type ZoneIntent =
  | { kind: "play" }
  | { kind: "confirm_terrain"; zoneIndex: number; old: string }
  | { kind: "blocked"; reason: "full" | "duplicate" };

export function zoneIntent(supportZones: readonly (CardInstance | null)[], card: ClientCard): ZoneIntent {
  const p = canPlaceInSupportZone(supportZones, card);
  if (p.kind === "ok") return { kind: "play" };
  if (p.kind === "replace_terrain")
    return { kind: "confirm_terrain", zoneIndex: p.zoneIndex, old: supportZones[p.zoneIndex]!.instanceId };
  return { kind: "blocked", reason: p.kind };
}
```

- [ ] **Step 4 : test de la modale (doit échouer)**

`ReplaceSupportDialog.test.tsx` :
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { ReplaceSupportDialog } from "../../features/fight/ReplaceSupportDialog";

const c = (id: string, name: string) => ({ instanceId: id, baseCard: { name } }) as never;

it("un seul candidat : bouton Remplacer", () => {
  const onConfirm = vi.fn();
  render(<ReplaceSupportDialog card="Canon" candidates={[c("p", "Processeur")]} onConfirm={onConfirm} onCancel={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /remplacer/i }));
  expect(onConfirm).toHaveBeenCalledWith("p");
});

it("deux accessoires : le joueur choisit lequel", () => {
  const onConfirm = vi.fn();
  render(<ReplaceSupportDialog card="Module" candidates={[c("a", "Réparation"), c("b", "Autre")]} onConfirm={onConfirm} onCancel={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Autre/ }));
  expect(onConfirm).toHaveBeenCalledWith("b");
});
```
(Ajouter le wrapper i18n utilisé par les autres tests de composants, et adapter la regex `/remplacer/i` au libellé du bouton existant de `fight.confirm`.)

- [ ] **Step 5 : ReplaceSupportDialog**

Réutiliser la modale de confirmation existante du combat (celle qui affiche `ConfirmText` de `pendingAction.ts`, style beige du menu). Chercher son composant (`fight.confirm.play` est rendu quelque part) et le composer :
```tsx
interface Props {
  card: string;
  candidates: CardInstance[];
  onConfirm: (replaceInstanceId: string) => void;
  onCancel: () => void;
}

/** Confirme le remplacement d'un équipement ou d'un Terrain ; choix si deux accessoires. */
export function ReplaceSupportDialog({ card, candidates, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const single = candidates.length === 1 ? candidates[0] : null;
  return (
    <ConfirmModalExistante
      title={single ? t("fight.confirm.replaceEquipment", { old: single.baseCard.name, card }) : t("fight.confirm.chooseAccessory")}
      onCancel={onCancel}
      {...(single && { onConfirm: () => onConfirm(single.instanceId) })}
    >
      {!single && candidates.map((c) => (
        <button key={c.instanceId} type="button" className="fight-confirm-choice" onClick={() => onConfirm(c.instanceId)}>
          {c.baseCard.name}
        </button>
      ))}
    </ConfirmModalExistante>
  );
}
```
Remplacer `ConfirmModalExistante` par le vrai composant et ses vraies props. S'il n'accepte pas d'enfants, ajouter une prop `children?: ReactNode` (rendue sous le titre) et cacher le bouton OK quand `onConfirm` est absent. Utiliser `fight.confirm.replaceTerrain` quand la carte est un Terrain (prop `kind: "equipment" | "terrain"`).

- [ ] **Step 6 : brancher dans FightBoard**

1. `pendingAction.ts` : ajouter `replaceInstanceId?: string` à `playSupport`. Dans `confirmText`, si `replaceInstanceId` est présent, renvoyer `{ key: "fight.confirm.replaceEquipment", params: { card, old } }` (ajouter `old` au contexte), ou ne pas passer par `confirmText` puisque la modale de remplacement remplace la confirmation simple.
2. `emitGameAction.ts` et `useBoardControls.ts` : transmettre `replaceInstanceId` comme `targetInstanceId`.
3. `FightBoard.tsx`, clic sur un monstre allié avec un équipement sélectionné (l.462-471) et sur un Zeta implanté (l.500-508) :
```tsx
const intent = equipIntent(occupant, card);
if (intent.kind === "blocked") return;
if (intent.kind === "confirm") {
  setReplacing({
    handIndex: selectedCard,
    targetInstanceId: occupant.instanceId,
    candidates: occupant.equipments.filter((e) => intent.replaceable.includes(e.instanceId)),
  });
  return;
}
openPending({ kind: "playSupport", handIndex: selectedCard, targetInstanceId: occupant.instanceId });
```
`setReplacing` est un nouvel état local `useState<ReplacingState | null>(null)`. Il est rendu en `<ReplaceSupportDialog … onConfirm={(id) => { setReplacing(null); onPlaySupport(r.handIndex, undefined, r.targetInstanceId, id); }} />`. Ajouter le 4e paramètre `replaceInstanceId` à `onPlaySupport` jusqu'à l'émission.
4. `handleSupportZoneClick` (l.529-535) :
```tsx
const handleSupportZoneClick = (idx: number) => {
  if (!gs.isMyTurn || phase !== "main" || selectedCard === null || !isZoneSupport) return;
  const intent = zoneIntent(gs.me.supportZones, mappedHand[selectedCard]);
  if (intent.kind === "blocked") return;
  if (intent.kind === "confirm_terrain") {
    setReplacing({
      handIndex: selectedCard,
      zoneIndex: intent.zoneIndex,
      candidates: [gs.me.supportZones[intent.zoneIndex]!],
      kind: "terrain",
    });
    return;
  }
  if (gs.me.supportZones[idx]) return;
  openPending({ kind: "playSupport", handIndex: selectedCard, zoneIndex: idx });
};
```
Un Terrain qui remplace se pose dans la case de l'ancien, quelle que soit la case cliquée : surligner toutes les cases pour un Terrain quand un Terrain est en place.
5. Surbrillance : un monstre n'est mis en avant pour un équipement que si `equipIntent(m, card).kind !== "blocked"`. Une case support n'est mise en avant que si `zoneIntent(...)` n'est pas `blocked` et que la case est vide (ou porte le Terrain à remplacer).
6. Carte grisée en main : si `zoneIntent` renvoie `blocked`, ou si aucun monstre ne donne autre chose que `blocked` pour un équipement, réutiliser le mécanisme actuel des cartes injouables (chercher où une raison d'injouabilité est affichée) avec `fight.unplayable.supportZonesFull`, `fight.unplayable.alreadyInPlay` ou `fight.unplayable.noEquipTarget`.

- [ ] **Step 7 : tests**

Run : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck`
Expected : PASS.

- [ ] **Step 8 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(fight): confirmation de remplacement d'équipement et de Terrain, cibles valides seulement"
```

---

### Task 12 : front — animations de Charge

**Files :**
- Modify : `apps/frontend/src/features/fight/fightEvents.ts`, le composant qui joue les animations d'événements (chercher qui consomme `fightEvents.ts`), la CSS de `zr-charge`

- [ ] **Step 1 : test (doit échouer)**

Dans le test existant de `fightEvents` (le trouver), ajouter : un événement `charge_progress` produit une animation `pulse` sur `instanceId`, et `charge_triggered` produit une animation `burst`. Recopier la forme des cas `monster_healed` déjà testés.

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- fightEvents`
Expected : FAIL.

- [ ] **Step 3 : implémenter**

Dans `fightEvents.ts`, ajouter `case "charge_progress":` et `case "charge_triggered":` sur le modèle de `monster_healed`. CSS :
```css
@keyframes zr-charge-pulse { 50% { filter: drop-shadow(0 0 6px #ffb43a); } }
@keyframes zr-charge-burst { to { transform: scale(1.15); opacity: 0; } }
.zr-charge--pulse .zr-charge__frame { animation: zr-charge-pulse .5s ease; }
.zr-charge--burst { animation: zr-charge-burst .45s ease forwards; }
@media (prefers-reduced-motion: reduce) { .zr-charge--pulse .zr-charge__frame, .zr-charge--burst { animation: none; } }
```

- [ ] **Step 4 : tests**

Run : `pnpm --filter @pipou/frontend test`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(fight): animations de gain de compteur et de déclenchement des Charges"
```

---

### Task 13 : admin — champs selon le type de support

**Files :**
- Modify : `apps/frontend/src/features/cards/CardManager.tsx` (sélecteur `supportType` l.645-655 et étape de validation), `apps/frontend/src/services/cardService` (type `CreateCardData`, s'il redéclare des champs), `cardPayload.ts` s'il a été créé à la tâche 1
- Test : `apps/frontend/src/__tests__/components/CardManager.test.tsx`, test e2e backend de création (`apps/backend/test/*.e2e-spec.ts`, ou équivalent : chercher un e2e existant sur `/cards`)

- [ ] **Step 1 : tests (doivent échouer)**

`CardManager.test.tsx` (recopier le rendu et les mocks de service d'un test de page admin existant) :
```tsx
it("Équipement : le choix de l'emplacement apparaît et est envoyé", async () => {
  // choisir type support, sous-type EQUIPMENT, emplacement ACCESSORY, soumettre
  // expect(cardService.create).toHaveBeenCalledWith(expect.objectContaining({ supportType: "EQUIPMENT", equipmentSlot: "ACCESSORY" }))
});
it("Persistant : case Terrain", async () => {
  // expect(...objectContaining({ supportType: "PERSISTENT", isTerrain: true }))
});
it("Charge : charge max requise, cyclique désactivé", async () => {
  // expect(screen.getByRole("option", { name: /cyclique/i })).toBeDisabled()
  // expect(...objectContaining({ supportType: "CHARGE", chargeMax: 3, chargeMode: "ONE_SHOT" }))
});
it("changer de sous-type retire les champs de l'ancien", async () => {
  // EQUIPMENT + ACCESSORY puis passage en EPHEMERAL → equipmentSlot absent du payload
});
it("édition : recharge les champs support", async () => {
  // openEdit d'une carte EQUIPMENT/DEFENSIVE → le select emplacement affiche Défensif
});
```
Écrire chaque test complètement, avec les interactions `userEvent` / `fireEvent` réelles et les sélecteurs du formulaire.

Côté backend, un e2e par type, en recopiant la mise en place des e2e existants :
```ts
it.each([
  { supportType: 'EPHEMERAL' },
  { supportType: 'EQUIPMENT', equipmentSlot: 'OFFENSIVE' },
  { supportType: 'PERSISTENT', isTerrain: true },
  { supportType: 'CHARGE', chargeMax: 3, chargeMode: 'ONE_SHOT' },
])('crée un support %o', async (extra) => {
  await request(app.getHttpServer()).post('/cards').set(adminAuth)
    .send({ name: `T ${extra.supportType}`, rarity: 'common', type: 'support', atk: 0, hp: 0, cardSetId, ...extra })
    .expect(201);
});
it('crée un monstre', async () => { /* type monster, atk/hp, archetype */ });
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- CardManager` puis le script e2e du backend (`pnpm --filter @pipou/backend run` pour voir son nom). L'e2e se lance **uniquement contre la base locale**.
Expected : FAIL.

- [ ] **Step 3 : formulaire**

Sous le `<select>` `supportType` (l.645), ajouter les options `PERSISTENT` et `CHARGE` (libellés i18n de la tâche 9) et, en fonction du sous-type :
```tsx
{form.supportType === SupportType.EQUIPMENT && (
  <label>
    {t("equipmentSlot.label")}
    <select value={form.equipmentSlot ?? ""} onChange={(e) => setField("equipmentSlot", e.target.value as EquipmentSlot)} required>
      <option value="" disabled>—</option>
      {Object.values(EquipmentSlot).map((s) => (
        <option key={s} value={s}>{t(`equipmentSlot.${s}`)}</option>
      ))}
    </select>
  </label>
)}
{form.supportType === SupportType.PERSISTENT && (
  <label>
    <input type="checkbox" checked={!!form.isTerrain} onChange={(e) => setField("isTerrain", e.target.checked)} />
    {t("terrainTag")}
  </label>
)}
{form.supportType === SupportType.CHARGE && (
  <>
    <label>
      {t("admin.chargeMax")}
      <input type="number" min={1} max={10} value={form.chargeMax ?? 3} onChange={(e) => setField("chargeMax", Number(e.target.value))} />
    </label>
    <label>
      {t("admin.chargeMode")}
      <select value={form.chargeMode ?? ChargeMode.ONE_SHOT} onChange={(e) => setField("chargeMode", e.target.value as ChargeMode)}>
        <option value={ChargeMode.ONE_SHOT}>{t("admin.chargeOneShot")}</option>
        <option value={ChargeMode.CYCLIC} disabled>{t("admin.chargeCyclicSoon")}</option>
      </select>
    </label>
  </>
)}
```
Ajouter les clés `equipmentSlot.label` (« Emplacement »), `admin.chargeMax` (« Charge max »), `admin.chargeMode` (« Mode »), `admin.chargeOneShot` (« Usage unique ») et `admin.chargeCyclicSoon` (« Cyclique (bientôt) ») dans les 3 langues, à côté des clés admin existantes. Si `CardManager` n'utilise pas l'i18n aujourd'hui (textes en dur en français), suivre la convention du fichier.

Au changement de `supportType`, effacer les champs des autres sous-types :
```tsx
const setSupportType = (st: SupportType) =>
  setForm((f) => ({
    ...f,
    supportType: st,
    equipmentSlot: st === SupportType.EQUIPMENT ? f.equipmentSlot : undefined,
    isTerrain: st === SupportType.PERSISTENT ? f.isTerrain : undefined,
    chargeMax: st === SupportType.CHARGE ? (f.chargeMax ?? 3) : undefined,
    chargeMode: st === SupportType.CHARGE ? ChargeMode.ONE_SHOT : undefined,
  }));
```
Pour une carte Monstre, ne jamais envoyer `supportType` ni ces champs (filtrer dans `handleSubmit` ou `toCardPayload`). `openEdit` recopie `equipmentSlot`, `isTerrain`, `chargeMax` et `chargeMode`. `validateStep` : un Équipement exige un emplacement (« Choisis un emplacement »).

- [ ] **Step 4 : tests**

Run : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck`, puis l'e2e backend sur la base locale.
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/frontend/src apps/backend/test
git commit -m "feat(admin): création et édition des supports Équipement, Persistant et Charge"
```

---

### Task 14 : vérification finale

**REQUIRED SUB-SKILL : superpowers:verification-before-completion.**

- [ ] **Step 1 : tout le dépôt**

Run : `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test`
Expected : tout passe. Recopier la sortie en cas d'échec, ne rien déclarer « fait » sans elle.

- [ ] **Step 2 : migration**

Sur `cardcollect_dev` uniquement : `up`, `down`, `up` (comme à la tâche 3), puis la requête de contrôle.

- [ ] **Step 3 : clic-test local**

`ENV_FILE=.env.dev.local pnpm dev`, partie contre l'IA avec un deck Pixelman :
- équiper Canon puis Processeur sur le même monstre → la modale de remplacement s'affiche, et l'ancien part au cimetière ;
- deux accessoires différents → 2 pastilles vertes ; le même accessoire deux fois → monstre non surligné ;
- poser Mont Drakon, puis Tactique Gang Gang → modale « Remplacer Mont Drakon ? » ;
- créer une Charge dans l'admin (`chargeMax` 2, ON_CHARGED : piocher 2), la jouer, la voir progresser puis se déclencher.

- [ ] **Step 4 : captures**

Prendre avec Playwright, en 430 px de large (coquille claire, voir la mémoire « Front visual check »), une capture du plateau avec les pastilles, une de la Charge en cours, une de la modale de remplacement et une du formulaire admin pour une Charge. Les montrer avant la livraison.

- [ ] **Step 5 : commit éventuel**

```bash
git add -A
git commit -m "chore: ajustements de la vérification finale du rework des supports"
```
(Seulement s'il y a eu des corrections ; ne pas pousser sur `main` : le déploiement passe par la CI.)
