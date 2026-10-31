# Immunités de monstre — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six immunités cumulables (combat, destruction au combat, destruction par support, débuff support, débuff monstre, statut monstre), appliquées par le moteur, migrées sur les cartes existantes et visibles en combat.

**Architecture:** `@pipou/shared` porte l'enum `Immunity`, la table action → immunités et les règles pures (`hasImmunity`, `blocksEnemyAction`). Le moteur remplace `isImmuneToDebuffs` / `combatImmune` / `supportDestroyImmune` par `immunities: Immunity[]` (recalculé par `buffs-calculator` depuis `perm.immunities`, `turnImmunities` et les passifs). Une migration de données réécrit les effets de 5 cartes. Le front affiche un overlay par immunité (branche `feat/fight-status-fx` déjà en cours).

**Tech Stack:** TypeScript, NestJS 11 + TypeORM (MySQL), Jest (back), Vitest (shared, front), React 18.

**Spec:** `docs/superpowers/specs/2026-10-30-immunites-design.md`

## Global Constraints

- Tout type ou enum échangé front/back vit dans `@pipou/shared` ; jamais redéfini dans une app. `@pipou/shared` n'a aucune dépendance runtime.
- Après modification de `packages/shared` : `pnpm build:shared` avant typecheck/test des apps.
- Ne jamais lancer de migration, d'e2e ni d'écriture contre Aiven (`apps/backend/.env`). Migrations testées seulement sur la base docker locale.
- Ne pas commiter `apps/backend/.e2e/` (dump, données joueurs).
- UI : icônes SVG de `components/Icons.tsx`, jamais d'emoji.
- Textes visibles traduits fr/en/ko (`apps/frontend/src/i18n/locales/*.json`).
- Commits en français, style Conventional Commits du repo (`feat(back): …`, `feat(front): …`), sans ligne d'attribution.

## Fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/enums/effect.ts` | `Immunity` + 4 nouveaux `ActionType` |
| `packages/shared/src/game/immunity.ts` (créé) | `IMMUNITIES_BY_ACTION`, `EFFECT_IMMUNITIES`, `hasImmunity`, `blocksEnemyAction`, `SourceKind` |
| `packages/shared/src/game/instance.ts` | `immunities`, `turnImmunities`, `perm.immunities` ; retrait des 3 anciens champs |
| `packages/shared/src/game/rules.ts` | `isTargetableByEnemyEffects` / `isTargetableByEphemeral` par immunité |
| `packages/shared/src/socket/sandbox.ts` | patch `immunities` à la place de `debuffImmune` |
| `apps/backend/src/fights/helpers/monster.factory.ts` | valeurs initiales |
| `apps/backend/src/fights/buffs-calculator.service.ts` | recalcul de `immunities`, virus |
| `apps/backend/src/fights/effects/effect-actions.applier.ts` | actions d'immunité, malus temp |
| `apps/backend/src/fights/effects/effect-targets.resolver.ts` | filtre des ennemis par action et source |
| `apps/backend/src/fights/effects-resolver.service.ts` | destruction par support |
| `apps/backend/src/fights/services/support.service.ts` | messages d'erreur de cible |
| `apps/backend/src/fights/services/battle.service.ts` | combat, 1 PV, provocation, renvoi |
| `apps/backend/src/fights/services/phase.service.ts` | vidage de `turnImmunities` |
| `apps/backend/src/fights/ai/evaluate.ts`, `engine/supported-effects.ts`, `sandbox/sandbox-setup.ts` | lecture des immunités |
| `apps/backend/src/fights/engine/immunities.spec.ts` (créé) | règles moteur |
| `apps/backend/src/database/immunities-2026-10-patches.ts` (créé) + `.spec.ts` | patchs des 5 cartes |
| `apps/backend/src/database/migrations/1791000000017-Immunities.ts` (créé) | migration |
| `apps/frontend/src/features/fight/statusFx.ts`, `Zonerow/ZoneRow.css`, `useFightSfx.ts` | overlays |
| `apps/frontend/src/features/fight/Zonerow/zoneRow.effects.tsx`, `MonsterZoneContent.tsx`, `effectText.ts` | fiche et textes |
| `apps/frontend/src/i18n/locales/{fr,en,ko}.json` | traductions |

---

### Task 1: Contrat partagé des immunités

**Files:**
- Modify: `packages/shared/src/enums/effect.ts`
- Create: `packages/shared/src/game/immunity.ts`, `packages/shared/src/game/immunity.test.ts`
- Modify: `packages/shared/src/game/index.ts` (export), `packages/shared/src/enums/enums.test.ts` (snapshot ActionType)

**Interfaces:**
- Produces:
  - `Immunity` (const-objet + type, même style que `ActionType`) : `COMBAT_DAMAGE`, `COMBAT_DESTRUCTION`, `SUPPORT_DESTRUCTION`, `SUPPORT_DEBUFF`, `MONSTER_DEBUFF`, `MONSTER_STATUS`
  - `ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY`, `SET_SUPPORT_DEBUFF_IMMUNITY`, `SET_MONSTER_DEBUFF_IMMUNITY`, `SET_MONSTER_STATUS_IMMUNITY`
  - `EFFECT_IMMUNITIES: readonly Immunity[]` (les 4 d'effets)
  - `IMMUNITIES_BY_ACTION: Partial<Record<ActionType, readonly Immunity[]>>`
  - `type SourceKind = "monster" | "support"`
  - `hasImmunity(m: { immunities?: readonly Immunity[] }, i: Immunity): boolean`
  - `blocksEnemyAction(m, source: SourceKind, action: ActionType): boolean`

- [ ] **Step 1: Écrire le test qui échoue** — `packages/shared/src/game/immunity.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { ActionType, Immunity } from "../enums/effect";
import {
  EFFECT_IMMUNITIES,
  IMMUNITIES_BY_ACTION,
  blocksEnemyAction,
  hasImmunity,
} from "./immunity";

const m = (...immunities: Immunity[]) => ({ immunities });

describe("immunités", () => {
  it("l'ancienne immunité aux effets adverses vaut les quatre immunités d'effets", () => {
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_DEBUFF_IMMUNITY]).toEqual(
      EFFECT_IMMUNITIES,
    );
    expect(EFFECT_IMMUNITIES).toEqual([
      Immunity.SUPPORT_DESTRUCTION,
      Immunity.SUPPORT_DEBUFF,
      Immunity.MONSTER_DEBUFF,
      Immunity.MONSTER_STATUS,
    ]);
  });

  it("chaque action d'immunité donne son immunité", () => {
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_COMBAT_IMMUNITY]).toEqual([Immunity.COMBAT_DAMAGE]);
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY]).toEqual([Immunity.COMBAT_DESTRUCTION]);
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_SUPPORT_DESTROY_IMMUNITY]).toEqual([Immunity.SUPPORT_DESTRUCTION]);
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_SUPPORT_DEBUFF_IMMUNITY]).toEqual([Immunity.SUPPORT_DEBUFF]);
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_MONSTER_DEBUFF_IMMUNITY]).toEqual([Immunity.MONSTER_DEBUFF]);
    expect(IMMUNITIES_BY_ACTION[ActionType.SET_MONSTER_STATUS_IMMUNITY]).toEqual([Immunity.MONSTER_STATUS]);
  });

  it("hasImmunity tolère un monstre sans liste", () => {
    expect(hasImmunity({}, Immunity.MONSTER_DEBUFF)).toBe(false);
    expect(hasImmunity(m(Immunity.MONSTER_DEBUFF), Immunity.MONSTER_DEBUFF)).toBe(true);
  });

  it("support : la destruction dépend de SUPPORT_DESTRUCTION, le reste de SUPPORT_DEBUFF", () => {
    const debuffOnly = m(Immunity.SUPPORT_DEBUFF);
    expect(blocksEnemyAction(debuffOnly, "support", ActionType.BLOCK_ATTACK)).toBe(true);
    expect(blocksEnemyAction(debuffOnly, "support", ActionType.DESTROY_MONSTER)).toBe(false);
    const destroyOnly = m(Immunity.SUPPORT_DESTRUCTION);
    expect(blocksEnemyAction(destroyOnly, "support", ActionType.DESTROY_MONSTER)).toBe(true);
    expect(blocksEnemyAction(destroyOnly, "support", ActionType.BLOCK_ATTACK)).toBe(false);
  });

  it("monstre : tout est bloqué par MONSTER_DEBUFF, dégâts compris", () => {
    expect(blocksEnemyAction(m(Immunity.MONSTER_DEBUFF), "monster", ActionType.DEAL_DAMAGE)).toBe(true);
    expect(blocksEnemyAction(m(Immunity.SUPPORT_DEBUFF), "monster", ActionType.DEAL_DAMAGE)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test** — `pnpm --filter @pipou/shared exec vitest run immunity` → FAIL (module introuvable).

- [ ] **Step 3: Implémenter.** Dans `packages/shared/src/enums/effect.ts`, ajouter à `ActionType` (après `SET_SUPPORT_DESTROY_IMMUNITY`) :

```ts
  SET_COMBAT_DESTRUCTION_IMMUNITY: "SET_COMBAT_DESTRUCTION_IMMUNITY",
  SET_SUPPORT_DEBUFF_IMMUNITY: "SET_SUPPORT_DEBUFF_IMMUNITY",
  SET_MONSTER_DEBUFF_IMMUNITY: "SET_MONSTER_DEBUFF_IMMUNITY",
  SET_MONSTER_STATUS_IMMUNITY: "SET_MONSTER_STATUS_IMMUNITY",
```

et, à la suite du fichier, en suivant le même motif const-objet + type que `ActionType` :

```ts
export const Immunity = {
  /** Aucun dégât de combat. */
  COMBAT_DAMAGE: "COMBAT_DAMAGE",
  /** Dégâts de combat subis, mais jamais sous 1 PV en combat. */
  COMBAT_DESTRUCTION: "COMBAT_DESTRUCTION",
  SUPPORT_DESTRUCTION: "SUPPORT_DESTRUCTION",
  SUPPORT_DEBUFF: "SUPPORT_DEBUFF",
  MONSTER_DEBUFF: "MONSTER_DEBUFF",
  /** Ignore la Provocation et le renvoi de dégâts adverses. */
  MONSTER_STATUS: "MONSTER_STATUS",
} as const;
export type Immunity = (typeof Immunity)[keyof typeof Immunity];
```

Créer `packages/shared/src/game/immunity.ts` :

```ts
import { ActionType, Immunity } from "../enums/effect";

export type SourceKind = "monster" | "support";

/** Les quatre immunités d'effets (« insensible aux effets adverses »). */
export const EFFECT_IMMUNITIES: readonly Immunity[] = [
  Immunity.SUPPORT_DESTRUCTION,
  Immunity.SUPPORT_DEBUFF,
  Immunity.MONSTER_DEBUFF,
  Immunity.MONSTER_STATUS,
];

export const IMMUNITIES_BY_ACTION: Partial<Record<ActionType, readonly Immunity[]>> = {
  [ActionType.SET_COMBAT_IMMUNITY]: [Immunity.COMBAT_DAMAGE],
  [ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY]: [Immunity.COMBAT_DESTRUCTION],
  [ActionType.SET_SUPPORT_DESTROY_IMMUNITY]: [Immunity.SUPPORT_DESTRUCTION],
  [ActionType.SET_SUPPORT_DEBUFF_IMMUNITY]: [Immunity.SUPPORT_DEBUFF],
  [ActionType.SET_MONSTER_DEBUFF_IMMUNITY]: [Immunity.MONSTER_DEBUFF],
  [ActionType.SET_MONSTER_STATUS_IMMUNITY]: [Immunity.MONSTER_STATUS],
  [ActionType.SET_DEBUFF_IMMUNITY]: EFFECT_IMMUNITIES,
};

export function hasImmunity(
  monster: { immunities?: readonly Immunity[] },
  immunity: Immunity,
): boolean {
  return monster.immunities?.includes(immunity) ?? false;
}

/** Une action adverse (toujours négative) est-elle sans effet sur ce monstre ? */
export function blocksEnemyAction(
  monster: { immunities?: readonly Immunity[] },
  source: SourceKind,
  action: ActionType,
): boolean {
  if (source === "monster") return hasImmunity(monster, Immunity.MONSTER_DEBUFF);
  return hasImmunity(
    monster,
    action === ActionType.DESTROY_MONSTER
      ? Immunity.SUPPORT_DESTRUCTION
      : Immunity.SUPPORT_DEBUFF,
  );
}
```

Exporter depuis `packages/shared/src/game/index.ts` (`export * from "./immunity";`) et vérifier que `Immunity` sort bien de l'index des enums. Mettre à jour le snapshot d'`ActionType` dans `enums/enums.test.ts` avec les 4 nouvelles valeurs (même ordre que l'enum).

- [ ] **Step 4: Lancer** — `pnpm --filter @pipou/shared test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/enums packages/shared/src/game/immunity.ts packages/shared/src/game/immunity.test.ts packages/shared/src/game/index.ts
git commit -m "feat(shared): six immunités et leurs actions"
```

---

### Task 2: État du monstre et règles de ciblage partagées

**Files:**
- Modify: `packages/shared/src/game/instance.ts:21-75`, `packages/shared/src/game/rules.ts:74-150`, `packages/shared/src/game/rules.test.ts`, `packages/shared/src/socket/sandbox.ts:46`

**Interfaces:**
- Consumes: Task 1 (`Immunity`, `blocksEnemyAction`, `SourceKind`, `hasImmunity`)
- Produces:
  - `MonsterPermanentStats.immunities: Immunity[]` (remplace `debuffImmune`)
  - `MonsterOnBoard.immunities: Immunity[]`, `MonsterOnBoard.turnImmunities?: Immunity[]` ; **supprimés** : `isImmuneToDebuffs`, `combatImmune`, `supportDestroyImmune`
  - `isTargetableByEnemyEffects(m: { immunities?: readonly Immunity[] }, source: SourceKind, action: ActionType): boolean`
  - `isTargetableByEphemeral(m, side, effects)` inchangé en signature ; interne : source = `"support"`
  - Sandbox : `immunities?: Immunity[]` à la place de `debuffImmune?: boolean`

- [ ] **Step 1: Test qui échoue** — dans `rules.test.ts`, remplacer les fixtures `isImmuneToDebuffs: true` par `immunities: [...]` et ajouter :

```ts
it("un Éphémère de gel ne vise pas un monstre immunisé aux débuffs de support, mais peut le détruire", () => {
  const freeze = [ { trigger: EffectTrigger.ON_PLAY, actions: [ { type: ActionType.BLOCK_ATTACK, target: EffectTarget.ENEMY_MONSTER, value: 1 } ] } ];
  const destroy = [ { trigger: EffectTrigger.ON_PLAY, actions: [ { type: ActionType.DESTROY_MONSTER, target: EffectTarget.ENEMY_MONSTER } ] } ];
  const teros = { immunities: [Immunity.SUPPORT_DEBUFF, Immunity.MONSTER_DEBUFF] };
  expect(isTargetableByEphemeral(teros, "enemy", freeze)).toBe(false);
  expect(isTargetableByEphemeral(teros, "enemy", destroy)).toBe(true);
  const ancestral = { immunities: [...teros.immunities, Immunity.SUPPORT_DESTRUCTION] };
  expect(isTargetableByEphemeral(ancestral, "enemy", destroy)).toBe(false);
});
```

- [ ] **Step 2: Lancer** — `pnpm --filter @pipou/shared exec vitest run rules` → FAIL (types).

- [ ] **Step 3: Implémenter.**

`instance.ts` : dans `MonsterPermanentStats`, remplacer `debuffImmune: boolean;` par `immunities: Immunity[];`. Dans `MonsterOnBoard`, supprimer `isImmuneToDebuffs`, `combatImmune`, `supportDestroyImmune` et ajouter :

```ts
  /** Immunités actives (permanentes ∪ du tour ∪ passives), recalculées à chaque état. */
  immunities: Immunity[];
  /** Immunités jusqu'au début du prochain tour du propriétaire (Bouclier de Fortune). */
  turnImmunities?: Immunity[];
```

`rules.ts` : remplacer `isTargetableByEnemyEffects` et l'interface `EphemeralTarget` :

```ts
/** Un effet adverse de cette source peut-il viser ce monstre ? */
export function isTargetableByEnemyEffects(
  monster: { immunities?: readonly Immunity[] },
  source: SourceKind,
  action: ActionType,
): boolean {
  return !blocksEnemyAction(monster, source, action);
}

interface EphemeralTarget {
  immunities?: readonly Immunity[];
  hatchCounter?: number;
  summonedThisTurn?: boolean;
  instantEvolution?: boolean;
  canEvolveThisTurn?: boolean;
  card?: { baseCard: { stage?: DrakonStage | null } };
}
```

et dans `isTargetableByEphemeral`, remplacer les deux premiers `if` par :

```ts
  const chosenActions = (effects ?? [])
    .filter((e) => e.trigger === EffectTrigger.ON_PLAY)
    .flatMap((e) => e.actions)
    .filter((a) => CHOSEN_TARGETS.has(a.target));
  if (
    side === "enemy" &&
    chosenActions.some((a) => blocksEnemyAction(monster, "support", a.type))
  )
    return false;
  return (
    chosenActions.length === 0 ||
    chosenActions.some((a) => actionBenefits(a.type, monster))
  );
```

(`ephemeralDestroysChosenTarget` reste exporté : `support.service` s'en sert pour le message.)

`socket/sandbox.ts:46` : `debuffImmune?: boolean;` → `immunities?: Immunity[];`.

- [ ] **Step 4: Lancer** — `pnpm --filter @pipou/shared test && pnpm build:shared` → PASS. (Le typecheck des apps casse jusqu'aux Tasks 3 et 6 : normal.)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): liste d'immunités sur le monstre et ciblage par source"
```

---

### Task 3: Moteur — immunités posées, recalculées et filtrées

**Files:**
- Modify: `apps/backend/src/fights/helpers/monster.factory.ts:21-35`, `buffs-calculator.service.ts:48-62,135-140,195-250`, `effects/effect-actions.applier.ts:41-45,99-103,210-245`, `effects/effect-targets.resolver.ts:20-46`, `effects-resolver.service.ts:48-60`, `services/support.service.ts:80-92`, `services/phase.service.ts:100`, `ai/evaluate.ts:82`, `engine/supported-effects.ts:49-68`, `sandbox/sandbox-setup.ts:200`
- Create: `apps/backend/src/fights/engine/immunities.spec.ts`
- Modify (fixtures) : specs qui lisent les anciens champs — `auras.spec.ts`, `card-rework-cards.spec.ts`, `card-rework-mechanics.spec.ts`, `drakon-mechanics.spec.ts`, `origins-real-cards.spec.ts`, `reflect.spec.ts`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: `sourceKindOf(ctx: EffectContext): SourceKind` (dans `effect-targets.resolver.ts`, exporté) ; `resolveTargets(target, ctx, archetype?, actionType?)`.

- [ ] **Step 1: Tests qui échouent** — `apps/backend/src/fights/engine/immunities.spec.ts` (motif de `card-rework-mechanics.spec.ts`) :

```ts
import { ActionType, EffectTarget, EffectTrigger, Immunity } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { monsterNamed, scenario } from '../testing/scenario';

const engine = createEngine();
const passive = (...types: ActionType[]) =>
  effect(EffectTrigger.PASSIVE, types.map((t) => act(t, EffectTarget.SELF)));
const play = (game, targetName: string) =>
  engine.dispatch(game, 'p1', {
    type: 'play_support',
    handIndex: 0,
    targetInstanceId: monsterNamed(game, 'p2', targetName).instanceId,
  });
const gel = () =>
  ephemeralCard('Gel', [effect(EffectTrigger.ON_PLAY, [act(ActionType.BLOCK_ATTACK, EffectTarget.ENEMY_MONSTER, { value: 1 })])]);
const formatage = () =>
  ephemeralCard('Formatage', [effect(EffectTrigger.ON_PLAY, [act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER)])]);

describe('immunités', () => {
  it('SET_DEBUFF_IMMUNITY donne les quatre immunités d\'effets', () => {
    const game = scenario({ p2: { monsters: [{ card: monsterCard('Mag', { effects: [passive(ActionType.SET_DEBUFF_IMMUNITY)] }) }] } });
    engine.settle(game);
    expect(monsterNamed(game, 'p2', 'Mag').immunities).toEqual(
      expect.arrayContaining([Immunity.SUPPORT_DESTRUCTION, Immunity.SUPPORT_DEBUFF, Immunity.MONSTER_DEBUFF, Immunity.MONSTER_STATUS]),
    );
  });

  it('SUPPORT_DEBUFF bloque le gel mais pas la destruction par support', () => {
    const card = monsterCard('Teros', { effects: [passive(ActionType.SET_SUPPORT_DEBUFF_IMMUNITY)] });
    const g1 = scenario({ p1: { hand: [gel()] }, p2: { monsters: [{ card }] } });
    engine.settle(g1);
    expect(play(g1, 'Teros').error).toBeDefined();
    const g2 = scenario({ p1: { hand: [formatage()] }, p2: { monsters: [{ card }] } });
    engine.settle(g2);
    expect(play(g2, 'Teros').error).toBeUndefined();
    expect(g2.player2.monsterZones.some((m) => m?.card.baseCard.name === 'Teros')).toBe(false);
  });

  it('SUPPORT_DESTRUCTION seul : la destruction échoue, le gel passe', () => {
    const card = monsterCard('Beta', { effects: [passive(ActionType.SET_SUPPORT_DESTROY_IMMUNITY)] });
    const g1 = scenario({ p1: { hand: [formatage()] }, p2: { monsters: [{ card }] } });
    engine.settle(g1);
    expect(play(g1, 'Beta').error).toBeDefined();
    const g2 = scenario({ p1: { hand: [gel()] }, p2: { monsters: [{ card }] } });
    engine.settle(g2);
    expect(play(g2, 'Beta').error).toBeUndefined();
    expect(monsterNamed(g2, 'p2', 'Beta').blockAttackTurns).toBeGreaterThan(0);
  });
});
```

Ajouter dans le même fichier les cas combat (motif `duel()` de `reflect.spec.ts`, à recopier dans le fichier) :
- `COMBAT_DESTRUCTION` : défenseur 500 PV `passive(SET_COMBAT_DESTRUCTION_IMMUNITY)` attaqué par 2000 ATK → toujours sur le terrain, `currentHp === 1`.
- `COMBAT_DAMAGE` via `monsterCard('Bouclé', { ... })` + `patch: { turnImmunities: [Immunity.COMBAT_DAMAGE] }` → `currentHp` inchangé ; après `passTurn` deux fois (retour au tour de p2 puis p1), `turnImmunities` vide.
- `MONSTER_STATUS` attaquant : défenseur `REFLECT_DAMAGE 50` → l'attaquant ne perd aucun PV ; cible non-provocatrice choisie alors qu'un autre monstre adverse a `SET_TAUNT` → pas d'erreur.
- `MONSTER_DEBUFF` : un monstre allié de p1 avec `ON_SUMMON DEAL_DAMAGE ENEMY_MONSTER/ALL_ENEMIES 500` invoqué face à un défenseur `passive(SET_MONSTER_DEBUFF_IMMUNITY)` → PV intacts ; face à `passive(SET_SUPPORT_DEBUFF_IMMUNITY)` → PV baissent.

- [ ] **Step 2: Lancer** — `pnpm --filter @pipou/backend exec jest src/fights/engine/immunities.spec.ts` → FAIL (compilation).

- [ ] **Step 3: Implémenter.**

`monster.factory.ts` : `perm.debuffImmune: false` → `immunities: []` ; `isImmuneToDebuffs: false` → `immunities: []`.

`effect-targets.resolver.ts` :

```ts
import { ActionType, CardType, EffectTarget, SourceKind, isImplanted, isPlantedBy, isTargetableByEnemyEffects } from '@pipou/shared';

/** Un effet porté par une carte Support (équipement compris) vient d'un support. */
export function sourceKindOf(ctx: EffectContext): SourceKind {
  return ctx.sourceCard?.baseCard.type === CardType.SUPPORT ? 'support' : 'monster';
}

export function resolveTargets(target: EffectTarget, ctx: EffectContext, archetype?: string, actionType?: ActionType): ResolvedTargets {
  …
  const source = sourceKindOf(ctx);
  const enemies = opponent.monsterZones.filter(
    (m): m is MonsterOnBoard =>
      m !== null &&
      (!actionType || isTargetableByEnemyEffects(m, source, actionType)) &&
      !isPlantedBy(m, owner.userId),
  );
```

`effect-actions.applier.ts:43` : `resolveTargets(action.target, ctx, action.archetype, action.type)`.
`applier.ts:101` (BUFF_ATK_TEMP négatif) : `if ((action.value ?? 0) < 0 && targets.ownerOfMonster(target).userId !== ctx.ownerUserId && blocksEnemyAction(target, sourceKindOf(ctx), action.type)) continue;`
`applier.ts:210-245` : remplacer les cases `SET_DEBUFF_IMMUNITY` et `SET_COMBAT_IMMUNITY` par un case commun à toutes les actions d'immunité :

```ts
      case ActionType.SET_DEBUFF_IMMUNITY:
      case ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY:
      case ActionType.SET_SUPPORT_DESTROY_IMMUNITY:
      case ActionType.SET_SUPPORT_DEBUFF_IMMUNITY:
      case ActionType.SET_MONSTER_DEBUFF_IMMUNITY:
      case ActionType.SET_MONSTER_STATUS_IMMUNITY:
        for (const m of targets.monsters) {
          grantImmunities(m.perm.immunities, IMMUNITIES_BY_ACTION[action.type]!);
          grantImmunities(m.immunities, IMMUNITIES_BY_ACTION[action.type]!);
          ctx.log.push(`🛡️ ${m.card.baseCard.name} gagne une immunité`);
        }
        break;

      case ActionType.SET_COMBAT_IMMUNITY:
        for (const m of targets.monsters) {
          m.turnImmunities = m.turnImmunities ?? [];
          grantImmunities(m.turnImmunities, [Immunity.COMBAT_DAMAGE]);
          grantImmunities(m.immunities, [Immunity.COMBAT_DAMAGE]);
          ctx.log.push(`🌀 ${m.card.baseCard.name} est insensible aux dégâts de combat jusqu'à son prochain tour`);
        }
        break;
```

avec, en bas du fichier : `function grantImmunities(list: Immunity[], add: readonly Immunity[]) { for (const i of add) if (!list.includes(i)) list.push(i); }` (l'exporter : `buffs-calculator` s'en sert).

`buffs-calculator.service.ts` — socle (l. 48-62) : remplacer `m.isImmuneToDebuffs = m.perm.debuffImmune;` et `m.supportDestroyImmune = false;` par `m.immunities = [...m.perm.immunities, ...(m.turnImmunities ?? [])];`. `applyPassive` : remplacer les cases `SET_SUPPORT_DESTROY_IMMUNITY` et `SET_DEBUFF_IMMUNITY` par les 6 actions de `IMMUNITIES_BY_ACTION` sauf `SET_COMBAT_IMMUNITY` → `grantImmunities(m.immunities, IMMUNITIES_BY_ACTION[action.type]!)`. Virus (l. 137) : la source est le Zeta implanté (monstre) ou son équipement (support) — mémoriser le `SourceKind` du virus retenu (`card.baseCard.type === CardType.SUPPORT ? 'support' : 'monster'`) et remplacer `!m.isImmuneToDebuffs` par `!blocksEnemyAction(m, virusSource, ActionType.VIRUS_ATK_DEBUFF)`.

`effects-resolver.service.ts:54` : `target?.supportDestroyImmune` → `target && hasImmunity(target, Immunity.SUPPORT_DESTRUCTION)` (garder la condition `card.baseCard.type === CardType.SUPPORT`).

`support.service.ts:84-87` : message d'erreur

```ts
          error:
            side === 'enemy' && ephemeralDestroysChosenTarget(card.baseCard.effects) && hasImmunity(chosen, Immunity.SUPPORT_DESTRUCTION)
              ? 'Ce monstre ne peut pas être détruit par une carte Support'
              : side === 'enemy' && hasImmunity(chosen, Immunity.SUPPORT_DEBUFF)
                ? 'Ce monstre est insensible aux effets des cartes Support adverses'
                : "Cette carte n'aurait aucun effet sur ce monstre",
```

`phase.service.ts:100` : `m.combatImmune = false` → `m.turnImmunities = []`.
`ai/evaluate.ts:82` : `target.combatImmune` → `hasImmunity(target, Immunity.COMBAT_DAMAGE)`.
`engine/supported-effects.ts` : ajouter les 4 nouvelles actions à la liste.
`sandbox/sandbox-setup.ts:200` : `if (patch.immunities !== undefined) m.perm.immunities = [...patch.immunities];`

`battle.service.ts` :

```ts
/** Dégâts de combat : rien si insensible au combat ; jamais sous 1 PV si indestructible au combat. */
function combatDamage(target: MonsterOnBoard, dmg: number, opts: { ignoreReduction?: boolean }): number {
  if (hasImmunity(target, Immunity.COMBAT_DAMAGE)) return 0;
  const taken = applyDamage(target, dmg, opts);
  if (hasImmunity(target, Immunity.COMBAT_DESTRUCTION) && target.currentHp < 1) target.currentHp = 1;
  return taken;
}

function reflectDamage(defender: MonsterOnBoard, attacker: MonsterOnBoard, taken: number): void {
  if (!defender.reflectPercent || taken <= 0) return;
  if (hasImmunity(attacker, Immunity.MONSTER_STATUS)) return;
  …
}
```

et l. 133 : `!attacker.ignoresTaunt && !hasImmunity(attacker, Immunity.MONSTER_STATUS) && …`.

Specs existantes : remplacer chaque lecture `isImmuneToDebuffs` / `combatImmune` / `supportDestroyImmune` par `hasImmunity(m, Immunity.X)` (`X` = `MONSTER_DEBUFF` pour l'ancien « insensible », `COMBAT_DAMAGE`, `SUPPORT_DESTRUCTION`) et chaque `patch: { combatImmune: true }` par `patch: { turnImmunities: [Immunity.COMBAT_DAMAGE] }`.

- [ ] **Step 4: Lancer** — `pnpm --filter @pipou/backend exec jest src/fights` puis `pnpm --filter @pipou/backend typecheck` → PASS. Si un test historique échoue, vérifier qu'il testait un comportement que la spec conserve (l'ancien `SET_DEBUFF_IMMUNITY` = 4 immunités d'effets) avant de le modifier.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/fights apps/backend/src/sandbox
git commit -m "feat(back): six immunités appliquées par le moteur"
```

---

### Task 4: Patchs des cartes et migration

**Files:**
- Create: `apps/backend/src/database/immunities-2026-10-patches.ts`, `immunities-2026-10-patches.spec.ts`, `migrations/1791000000017-Immunities.ts`
- Modify: `card-rework-patches.ts:87`, `garde-2026-10-patches.ts:112`, `drakon-origines-cards.ts:62,121`, `drakon-set-patches.ts:121,237`, `balance-2026-10-patches.ts:211` (sources des seeds), `migrations-columns.spec.ts` si elle liste les migrations

**Interfaces:**
- Consumes: `CardEffectPatch` et `planPatch` de `card-effect-patches.ts` ; actions de la Task 1.
- Produces: `IMMUNITY_PATCHES: CardEffectPatch[]`.

`before` = effets actuels en prod (dump du 30/10). `after` = mêmes effets, `SET_DEBUFF_IMMUNITY` remplacé :

| id | Carte | Remplacement de `SET_DEBUFF_IMMUNITY` | Description fr (`after`) |
|---|---|---|---|
| 10 | Maître Magouille | `SET_SUPPORT_DESTROY_IMMUNITY`, `SET_SUPPORT_DEBUFF_IMMUNITY`, `SET_MONSTER_DEBUFF_IMMUNITY`, `SET_MONSTER_STATUS_IMMUNITY` (ON_SUMMON, SELF) | « …Insensible à tous les effets adverses, mais destructible en combat. » |
| 105 | Adulte Teros | `SET_SUPPORT_DEBUFF_IMMUNITY`, `SET_MONSTER_DEBUFF_IMMUNITY` | « …insensible aux malus adverses… » |
| 116 | Écaille de Dragon | idem Adulte Teros (PASSIVE, condition `EQUIPPED_ON stage egg` inchangée) | « …sur un Œuf, il devient insensible aux malus adverses. » |
| 141 | Ancestral Teros | Adulte Teros + `SET_SUPPORT_DESTROY_IMMUNITY` | « …insensible aux malus adverses et à la destruction par Support… » |
| 145 | Drakon des Origines | comme Maître Magouille | « …Insensible à tous les effets adverses… » |

Effets actuels exacts (copier tels quels dans `before`) :

```json
10:  [{"actions":[{"type":"SET_DEBUFF_IMMUNITY","value":1,"target":"SELF"}],"trigger":"ON_SUMMON","condition":null}]
105: [{"actions":[{"type":"SET_TAUNT","target":"SELF"},{"type":"SET_DEBUFF_IMMUNITY","target":"SELF"}],"trigger":"ON_SUMMON","condition":null},{"actions":[{"type":"SET_DAMAGE_REDUCTION","value":2,"target":"SELF"}],"trigger":"PASSIVE","condition":null},{"actions":[{"type":"REFLECT_DAMAGE","value":50,"target":"SELF"}],"trigger":"PASSIVE","condition":null},{"actions":[{"type":"DRAW","value":1,"target":"PLAYER"}],"trigger":"ON_DEATH","condition":null}]
116: [{"actions":[{"type":"SET_DAMAGE_REDUCTION","value":2,"target":"SELF"}],"trigger":"PASSIVE","condition":null},{"actions":[{"type":"SET_DEBUFF_IMMUNITY","target":"SELF"}],"trigger":"PASSIVE","condition":{"type":"EQUIPPED_ON","stage":"egg"}}]
141: (comme 105 avec REFLECT_DAMAGE 60)
145: [{"actions":[{"type":"SUMMON_IF_ALL_ELEMENTS","target":"SELF"}],"trigger":"PASSIVE","condition":null},{"actions":[{"type":"SET_DEBUFF_IMMUNITY","value":1,"target":"SELF"}],"trigger":"ON_SUMMON","condition":null},{"actions":[{"type":"COPY_GRAVEYARD_EFFECTS","target":"PLAYER"}],"trigger":"ON_SUMMON","condition":null}]
```

- [ ] **Step 1: Test qui échoue** — `immunities-2026-10-patches.spec.ts` :

```ts
import { ActionType } from '@pipou/shared';
import { planPatch } from './card-effect-patches';
import { IMMUNITY_PATCHES } from './immunities-2026-10-patches';

const types = (effects) => effects.flatMap((e) => e.actions.map((a) => a.type));

describe('patchs d\'immunités', () => {
  it('couvre les cinq cartes', () => {
    expect(IMMUNITY_PATCHES.map((p) => p.cardId)).toEqual([10, 105, 116, 141, 145]);
  });
  it.each(IMMUNITY_PATCHES)('$cardName : plus aucune ancienne immunité globale', (p) => {
    expect(types(p.after)).not.toContain(ActionType.SET_DEBUFF_IMMUNITY);
    expect(planPatch(p.before, p.before, p.after)).toBe('apply');
  });
  it('Maître Magouille reste destructible en combat', () => {
    const t = types(IMMUNITY_PATCHES[0].after);
    expect(t).toContain(ActionType.SET_MONSTER_STATUS_IMMUNITY);
    expect(t).not.toContain(ActionType.SET_COMBAT_DESTRUCTION_IMMUNITY);
    expect(t).not.toContain(ActionType.SET_COMBAT_IMMUNITY);
  });
});
```

- [ ] **Step 2: Lancer** — `pnpm --filter @pipou/backend exec jest src/database/immunities` → FAIL.

- [ ] **Step 3: Implémenter** le fichier de patchs (même forme que `CARD_EFFECT_PATCHES`, plus `description` si `CardEffectPatch` le porte — sinon mettre la description à jour dans la migration par un `UPDATE card SET description = ? WHERE id = ? AND description = ?`), puis la migration en recopiant `1791000000001-GenericCardEffects.ts` (classe `Immunities1791000000017`, logger `'Immunities'`, boucle sur `IMMUNITY_PATCHES`). Mettre à jour les fichiers source des seeds listés plus haut avec les mêmes remplacements, pour qu'une base neuve soit identique.

- [ ] **Step 4: Lancer** — `pnpm --filter @pipou/backend exec jest src/database` → PASS. Puis, sur la base docker locale uniquement (`docker compose up -d db`, base `cardcollect`, jamais `.env`) : appliquer la migration selon le mode e2e du repo et vérifier `SELECT id, effects FROM card WHERE id IN (10,105,116,141,145)` ; `down` restaure. Si la base locale n'a pas ces cartes, s'en tenir aux tests unitaires et le noter.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/database
git commit -m "feat(back): migration des immunités des cartes"
```

---

### Task 5: Textes des effets et fiche d'inspection

**Files:**
- Modify: `apps/frontend/src/features/fight/effectText.ts:125-140`, `Zonerow/zoneRow.effects.tsx:66-68`, `Zonerow/MonsterZoneContent.tsx:50-56`, `i18n/locales/{fr,en,ko}.json`, `__tests__/fixtures/monster.ts`, `__tests__/unit/{effectText,zoneRow.effects}.test.ts`, `__tests__/components/SetupDrawer.test.tsx`
- Modify (admin sandbox) : composant qui édite `debuffImmune` dans `SetupDrawer` → case à cocher par immunité

**Interfaces:**
- Consumes: Tasks 1-2 (`Immunity`, `hasImmunity`, `EFFECT_IMMUNITIES`).
- Produces: `KeywordId` += `combatEndure`, `supportDebuffImmunity`, `monsterDebuffImmunity`, `monsterStatusImmunity` (les existants `combatImmunity`, `supportShield`, `debuffImmunity` gardent leur sens : bouclier, destruction par support, toutes les immunités d'effets).

- [ ] **Step 1: Test qui échoue** — dans `zoneRow.effects.test.ts` :

```ts
it("liste une entrée par immunité, et une seule pour les quatre d'effets", () => {
  const teros = monster({ immunities: [Immunity.SUPPORT_DEBUFF, Immunity.MONSTER_DEBUFF] });
  const labels = getMonsterStatusEntries(teros, t).map((e) => e.label);
  expect(labels).toEqual(expect.arrayContaining(["keywords.supportDebuffImmunity.name", "keywords.monsterDebuffImmunity.name"]));
  const mag = monster({ immunities: [...EFFECT_IMMUNITIES] });
  const magLabels = getMonsterStatusEntries(mag, t).map((e) => e.label);
  expect(magLabels).toContain("keywords.debuffImmunity.name");
  expect(magLabels).not.toContain("keywords.monsterDebuffImmunity.name");
});
```

et dans `effectText.test.ts`, pour chacune des 4 nouvelles actions : `describeCardEffects` produit une ligne non vide qui ne contient pas la clé brute.

- [ ] **Step 2: Lancer** — `pnpm --filter @pipou/frontend exec vitest run zoneRow.effects effectText` → FAIL.

- [ ] **Step 3: Implémenter.** `zoneRow.effects.tsx` :

```ts
  const im = (i: Immunity) => hasImmunity(zone, i);
  if (EFFECT_IMMUNITIES.every(im)) keyword("debuffImmunity", "buff");
  else {
    if (im(Immunity.SUPPORT_DESTRUCTION)) keyword("supportShield", "buff");
    if (im(Immunity.SUPPORT_DEBUFF)) keyword("supportDebuffImmunity", "buff");
    if (im(Immunity.MONSTER_DEBUFF)) keyword("monsterDebuffImmunity", "buff");
    if (im(Immunity.MONSTER_STATUS)) keyword("monsterStatusImmunity", "buff");
  }
  if (im(Immunity.COMBAT_DAMAGE)) keyword("combatImmunity", "buff");
  if (im(Immunity.COMBAT_DESTRUCTION)) keyword("combatEndure", "buff");
```

`MonsterZoneContent.tsx:50` : le badge s'affiche si `EFFECT_IMMUNITIES.some((i) => hasImmunity(zone, i))`, titre `keywords.debuffImmunity.name` si toutes, sinon le premier mot-clé présent.
`effectText.ts` : ajouter à `ACTIONS` les 4 actions (`{ tone: "buff", subject: "monster", keyword: "<KeywordId>" }`), ajouter les 4 `KeywordId` et leurs icônes dans `KEYWORD_ICON` (SVG existants de `Icons.tsx` : bouclier pour combat, cadenas/bouclier pour support, étoile/aura pour monstre — réutiliser les icônes déjà utilisées par `combatImmunity`, `supportShield`, `debuffImmunity`).
i18n : sous `keywords`, ajouter `combatEndure`, `supportDebuffImmunity`, `monsterDebuffImmunity`, `monsterStatusImmunity` avec `name` et `description` (même forme que `combatImmunity`), en fr, en, ko ; et les textes d'action correspondants sous `effects.actions` (même forme que `SET_COMBAT_IMMUNITY`). FR :
- `combatEndure` : « Increvable » / « Les combats ne le font pas descendre sous 1 PV. »
- `supportDebuffImmunity` : « Anti-support » / « Insensible aux malus des cartes Support adverses. »
- `monsterDebuffImmunity` : « Anti-monstre » / « Insensible aux effets des monstres adverses, dégâts compris. »
- `monsterStatusImmunity` : « Imperturbable » / « Ignore la Provocation et le renvoi de dégâts adverses. »
Fixture `__tests__/fixtures/monster.ts` : `immunities: []`, retrait des anciens champs. `SetupDrawer` : une case par `Immunity`, envoyée dans `immunities`.

- [ ] **Step 4: Lancer** — `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend exec vitest run zoneRow effectText SetupDrawer` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): textes et fiche des six immunités"
```

---

### Task 6: Overlays de combat par immunité

**Files:**
- Modify: `apps/frontend/src/features/fight/statusFx.ts`, `useFightSfx.ts`, `Zonerow/ZoneRow.css`, `__tests__/unit/statusFx.test.ts`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: `StatusFxId` : retire `immune`, `supportImmune` ; ajoute `combatEndure`, `supportDestroyImmune`, `supportDebuffImmune`, `monsterDebuffImmune`, `monsterStatusImmune` ; garde `combatShield`, `immuneAll`, `reflect`.

- [ ] **Step 1: Test qui échoue** — remplacer le test d'immunités de `statusFx.test.ts` par :

```ts
it("un overlay par immunité, aura totale pour les quatre d'effets", () => {
  const f = (...immunities: Immunity[]) => statusFlags(monster({ immunities }));
  expect([...f(Immunity.COMBAT_DAMAGE)]).toContain("combatShield");
  expect([...f(Immunity.COMBAT_DESTRUCTION)]).toContain("combatEndure");
  expect([...f(Immunity.SUPPORT_DESTRUCTION)]).toContain("supportDestroyImmune");
  expect([...f(Immunity.SUPPORT_DEBUFF, Immunity.MONSTER_DEBUFF)]).toEqual(
    expect.arrayContaining(["supportDebuffImmune", "monsterDebuffImmune"]),
  );
  const all = f(...EFFECT_IMMUNITIES);
  expect(all.has("immuneAll")).toBe(true);
  expect(all.has("monsterDebuffImmune")).toBe(false);
});
```

- [ ] **Step 2: Lancer** — `pnpm --filter @pipou/frontend exec vitest run statusFx` → FAIL.

- [ ] **Step 3: Implémenter.** `statusFx.ts`, à la place du bloc d'immunités :

```ts
  const im = (i: Immunity) => hasImmunity(monster, i);
  if (EFFECT_IMMUNITIES.every(im)) flags.add("immuneAll");
  else {
    if (im(Immunity.SUPPORT_DESTRUCTION)) flags.add("supportDestroyImmune");
    if (im(Immunity.SUPPORT_DEBUFF)) flags.add("supportDebuffImmune");
    if (im(Immunity.MONSTER_DEBUFF)) flags.add("monsterDebuffImmune");
    if (im(Immunity.MONSTER_STATUS)) flags.add("monsterStatusImmune");
  }
  if (im(Immunity.COMBAT_DAMAGE)) flags.add("combatShield");
  if (im(Immunity.COMBAT_DESTRUCTION)) flags.add("combatEndure");
```

`STATUS_FX_IDS` mis à jour en conséquence. `useFightSfx.ts` : `combatShield` et `combatEndure` → `fightShield` ; les quatre d'effets et `immuneAll` → `fightImmune`.
`ZoneRow.css` : renommer `.zr-status-fx--immune` → `--monsterDebuffImmune` (doré), `--supportImmune` → `--supportDebuffImmune` (vert menthe) ; ajouter `--supportDestroyImmune` (vert menthe, bordure en pointillés : `outline: 2px dashed rgba(90, 220, 170, 0.8); outline-offset: -3px;`), `--monsterStatusImmune` (doré, bordure en pointillés), `--combatEndure` (bleu, `box-shadow: inset 0 -10px 12px -6px rgba(120, 190, 255, 0.7)` : socle qui tient). Bursts : une règle `.zr-status-burst--<id>` par nouvel id, même `zr-status-burst-flash`, couleur de la famille. Les règles `.fb--reduced-motion` existantes couvrent déjà les nouvelles classes (sélecteurs génériques `.zr-status-fx`, `.zr-status-burst`).

- [ ] **Step 4: Lancer** — `pnpm --filter @pipou/frontend exec vitest run statusFx && pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint` → PASS.

- [ ] **Step 5: Commit** (inclut le travail statuts déjà présent sur la branche)

```bash
git add apps/frontend/src/features/fight apps/frontend/src/services/sound.service.ts apps/frontend/src/__tests__/unit/statusFx.test.ts
git commit -m "feat(front): effets visuels et sonores des statuts et immunités en combat"
```

---

### Task 7: Vérification finale

- [ ] **Step 1:** `pnpm build:shared && pnpm typecheck && pnpm lint` → aucune erreur.
- [ ] **Step 2:** `pnpm test` → tout passe, sauf les 2 tests `ForgeDialog.test.tsx` déjà en échec avant cette branche (vérifier avec `git stash` que l'échec préexiste ; ne pas les corriger ici).
- [ ] **Step 3:** Contrôle visuel (mémoire « Front visual check » / « Local test env ») : backend local `ENV_FILE=.env.dev.local`, front `pnpm --filter @pipou/frontend dev:local`, sandbox admin `/admin/sandbox` ; poser sur des monstres chaque immunité via le tiroir de setup, capture Playwright à 430 px de chaque overlay, puis en mode d'animation réduit. Arrêter les serveurs et `docker compose stop db` à la fin.
- [ ] **Step 4:** Rapport à l'utilisateur : commits, captures, sons attendus (`fight-*.mp3` du plan statuts + `fight-shield.mp3`, `fight-reflect.mp3`), rappel que la migration passera en prod au merge sur `main`.
