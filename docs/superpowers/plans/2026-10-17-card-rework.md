# Retravail des cartes PipouSquad / SquareWorld — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** corriger et compléter les effets des sets PipouSquad et SquareWorld (immunité de Maître Magouille, quantité
conditionnelle, 3 nouvelles mécaniques d'équipement, 6 cartes Pipou dotées d'effets, textes nettoyés) et les livrer en
prod par une migration de données.

**Architecture :** mécaniques génériques dans le moteur (`@pipou/shared` pour le contrat, `apps/backend/src/fights`
pour la résolution), puis données de cartes appliquées par une migration TypeORM qui retrouve chaque carte par son nom
et ne la modifie que si elle est dans l'état attendu. Le front rédige les effets depuis les données : il suit avec de
nouvelles traductions et quelques statuts.

**Tech Stack :** NestJS 11 + TypeORM + Jest (backend), React 18 + Vitest (frontend), `@pipou/shared` (tsup).

**Spec :** `docs/superpowers/specs/2026-10-17-card-rework-design.md`

## Global Constraints

- Tout type ou enum échangé front/back vit dans `@pipou/shared` ; après modification : `pnpm build:shared`.
- Enums partagés au format `const X = {...} as const` (voir `packages/shared/src/enums/effect.ts`).
- Aucune logique propre à une carte dans le moteur : uniquement des actions, cibles et conditions génériques.
- `effects-coverage.spec.ts` exige que chaque valeur d'`ActionType` soit dans `SUPPORTED_ACTIONS`.
- Les tests d'i18n du front (`__tests__/unit/effectText.test.ts`) exigent un texte pour chaque action × cible ×
  contexte et un nom + une définition pour chaque mot-clé, dans fr, en et ko.
- Jamais de connexion à Aiven (le `.env` du backend pointe la prod). Base locale uniquement : Docker `cardcollect_dev`
  via `apps/backend/.env.dev.local`. Ne jamais lancer `migration:run` sur la base locale (schéma issu de
  `synchronize`, table `migrations` incomplète).
- Branche `card-rework` (déjà créée). Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/enums/effect.ts` | 3 nouvelles `ActionType` |
| `packages/shared/src/game/effect.ts` | `EffectValueIf`, `EffectAction.valueIf` |
| `packages/shared/src/game/instance.ts` | `combatImmune?`, `supportDestroyImmune?`, `ignoresTaunt?` sur `MonsterOnBoard` |
| `packages/shared/src/game/rules.ts` | `isTargetableByEnemyEffects` |
| `apps/backend/src/cards/dto/create-card.dto.ts` | validation de `valueIf` |
| `apps/backend/src/fights/engine/supported-effects.ts` | déclaration des 3 actions |
| `apps/backend/src/fights/effects/effect-conditions.ts` | `conditionMet`, `withConditionalValue` |
| `apps/backend/src/fights/effects/effect-targets.resolver.ts` | immunité aux effets adverses |
| `apps/backend/src/fights/effects/effect-actions.applier.ts` | `valueIf`, `SET_COMBAT_IMMUNITY`, nature de la destruction |
| `apps/backend/src/fights/effects-resolver.service.ts` | résistance aux destructions par Support |
| `apps/backend/src/fights/buffs-calculator.service.ts` | passifs `SET_SUPPORT_DESTROY_IMMUNITY`, `IGNORE_TAUNT` |
| `apps/backend/src/fights/services/{battle,phase,support}.service.ts` | combat, fin d'immunité, cibles d'Éphémère |
| `apps/backend/src/database/card-rework-patches.ts` (créé) | données avant/après des 20 cartes + `planCardRework` |
| `apps/backend/src/database/migrations/1791000000004-CardRework.ts` (créé) | migration |
| `apps/backend/src/fights/testing/real-cards.ts` | applique aussi les patchs de rework |
| `apps/frontend/src/features/fight/effectText.ts`, `Zonerow/zoneRow.effects.ts`, `FightBoard.tsx` | textes, statuts, cibles |
| `apps/frontend/src/i18n/locales/{fr,en,ko}.json` | traductions |

---

### Task 1 : Contrat partagé et quantité conditionnelle (`valueIf`)

**Files :**
- Modify : `packages/shared/src/enums/effect.ts`, `packages/shared/src/game/effect.ts`,
  `packages/shared/src/game/instance.ts`, `packages/shared/src/game/rules.ts`
- Modify : `apps/backend/src/cards/dto/create-card.dto.ts`, `apps/backend/src/fights/engine/supported-effects.ts`,
  `apps/backend/src/fights/effects/effect-conditions.ts`, `apps/backend/src/fights/effects/effect-actions.applier.ts`
- Test : `apps/backend/src/cards/dto/create-card.dto.spec.ts`,
  `apps/backend/src/fights/engine/card-rework-mechanics.spec.ts` (créé)

**Interfaces :**
- Produces : `ActionType.SET_COMBAT_IMMUNITY | SET_SUPPORT_DESTROY_IMMUNITY | IGNORE_TAUNT` ;
  `interface EffectValueIf { condition: EffectCondition; value: number }` ; `EffectAction.valueIf?: EffectValueIf` ;
  `MonsterOnBoard.combatImmune?: boolean`, `supportDestroyImmune?: boolean`, `ignoresTaunt?: boolean` ;
  `isTargetableByEnemyEffects(m: { isImmuneToDebuffs: boolean }): boolean` (shared) ;
  `conditionMet(condition, ctx): boolean`, `withConditionalValue(action, ctx): EffectAction` (backend).

- [ ] **Step 1 : tests (échouent)**

Ajouter à `apps/backend/src/cards/dto/create-card.dto.spec.ts`, dans le `describe` existant :

```ts
  it('accepte une quantité conditionnelle (valueIf)', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [
          {
            type: 'RETURN_FROM_GRAVEYARD',
            target: 'PLAYER',
            value: 2,
            valueIf: {
              condition: {
                type: 'SPECIFIC_CARD_ON_BOARD',
                value: 'Capitaine',
                match: 'contains',
              },
              value: 3,
            },
          },
        ],
      },
    ]);
    expect(errors).toEqual([]);
  });

  it('refuse un valueIf sans valeur numérique', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [
          {
            type: 'DRAW',
            target: 'PLAYER',
            valueIf: { condition: { type: 'HAND_SIZE_MIN', value: 1 } },
          },
        ],
      },
    ]);
    expect(errors).not.toEqual([]);
  });
```

Créer `apps/backend/src/fights/engine/card-rework-mechanics.spec.ts` :

```ts
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { scenario } from '../testing/scenario';

describe('mécaniques du retravail des cartes', () => {
  const engine = createEngine();

  describe('valueIf (quantité conditionnelle)', () => {
    const rappel = () =>
      ephemeralCard('Rappel', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.RETURN_FROM_GRAVEYARD, EffectTarget.PLAYER, {
            value: 2,
            valueIf: {
              condition: {
                type: 'SPECIFIC_CARD_ON_BOARD',
                value: 'Capitaine',
                match: 'contains',
              },
              value: 3,
            },
          }),
        ]),
      ]);
    const graveyard = ['A', 'B', 'C', 'D'].map((n) => monsterCard(n));

    it('condition fausse : la valeur de base', () => {
      const game = scenario({ p1: { hand: [rappel()], graveyard } });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.pendingChoices[0].count).toBe(2);
    });

    it('condition vraie : la valeur conditionnelle', () => {
      const game = scenario({
        p1: {
          hand: [rappel()],
          graveyard,
          monsters: [monsterCard('Vice Capitaine Patouille')],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.pendingChoices[0].count).toBe(3);
    });
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- create-card.dto card-rework-mechanics`
Expected : FAIL (`valueIf` refusé par la whitelist ; count 2 au lieu de 3).

- [ ] **Step 3 : contrat partagé**

`packages/shared/src/enums/effect.ts`, dans `ActionType` après `SUMMONABLE_ON_ENEMY_SIDE` :

```ts
  SET_COMBAT_IMMUNITY: "SET_COMBAT_IMMUNITY",
  SET_SUPPORT_DESTROY_IMMUNITY: "SET_SUPPORT_DESTROY_IMMUNITY",
  IGNORE_TAUNT: "IGNORE_TAUNT",
```

`packages/shared/src/game/effect.ts` : avant `EffectAction`, ajouter

```ts
/** Valeur de remplacement quand la condition est remplie (ex. 2 cartes, 3 si Capitaine). */
export interface EffectValueIf {
  condition: EffectCondition;
  value: number;
}
```

et dans `EffectAction` : `valueIf?: EffectValueIf;`.

`packages/shared/src/game/instance.ts`, dans `MonsterOnBoard` après `guardLocked?: boolean;` :

```ts
  /** Aucun dégât de combat jusqu'au début du prochain tour de son propriétaire. */
  combatImmune?: boolean;
  /** Une destruction directe venant d'une carte Support n'a pas d'effet (passif). */
  supportDestroyImmune?: boolean;
  /** Peut attaquer n'importe quel monstre malgré une Provocation (passif). */
  ignoresTaunt?: boolean;
```

`packages/shared/src/game/rules.ts`, à la fin :

```ts
/** Un effet adverse peut-il viser ce monstre ? (Maître Magouille : non.) */
export function isTargetableByEnemyEffects(monster: {
  isImmuneToDebuffs: boolean;
}): boolean {
  return !monster.isImmuneToDebuffs;
}
```

Puis `pnpm build:shared`.

- [ ] **Step 4 : backend**

`apps/backend/src/fights/engine/supported-effects.ts`, dans `SUPPORTED_ACTIONS` :

```ts
  ActionType.SET_COMBAT_IMMUNITY,
  ActionType.SET_SUPPORT_DESTROY_IMMUNITY,
  ActionType.IGNORE_TAUNT,
```

`apps/backend/src/cards/dto/create-card.dto.ts` : importer le type `EffectValueIf` depuis `@pipou/shared`, ajouter
après `EffectFilterDto` :

```ts
export class EffectValueIfDto implements EffectValueIf {
  @ValidateNested()
  @Type(() => EffectConditionDto)
  condition!: EffectConditionDto;

  @IsNumber()
  value!: number;
}
```

et dans `EffectActionDto`, après `filter` :

```ts
  @IsOptional()
  @ValidateNested()
  @Type(() => EffectValueIfDto)
  valueIf?: EffectValueIfDto;
```

`apps/backend/src/fights/effects/effect-conditions.ts` : renommer le corps actuel en `conditionMet` et garder
`checkCondition` comme enveloppe, puis ajouter `withConditionalValue` :

```ts
import {
  CardEffect,
  EffectConditionType as ConditionType,
  SupportType,
} from '@pipou/shared';
import type { EffectAction, EffectCondition } from '@pipou/shared';
// … imports existants inchangés

/** Vrai si la condition de l'effet est remplie (ou absente). */
export function checkCondition(
  effect: CardEffect,
  ctx: EffectContext,
): boolean {
  return conditionMet(effect.condition, ctx);
}

/** Vrai si la condition est remplie (ou absente). */
export function conditionMet(
  condition: EffectCondition | null | undefined,
  ctx: EffectContext,
): boolean {
  if (!condition) return true;
  // … reste du corps actuel de checkCondition, inchangé
}

/** L'action avec sa valeur conditionnelle appliquée si la condition est remplie. */
export function withConditionalValue(
  action: EffectAction,
  ctx: EffectContext,
): EffectAction {
  return action.valueIf && conditionMet(action.valueIf.condition, ctx)
    ? { ...action, value: action.valueIf.value }
    : action;
}
```

`apps/backend/src/fights/effects/effect-actions.applier.ts` : importer `withConditionalValue` depuis
`./effect-conditions` et remplacer l'en-tête de boucle :

```ts
  for (const rawAction of effect.actions) {
    const action = withConditionalValue(rawAction, ctx);
    const targets = resolveTargets(action.target, ctx);
```

- [ ] **Step 5 : vérifier**

Run : `pnpm --filter @pipou/backend test -- create-card.dto card-rework-mechanics effects-coverage && pnpm --filter @pipou/backend typecheck`
Expected : PASS (la couverture voit les 3 actions déclarées).

- [ ] **Step 6 : commit**

```bash
git add packages/shared apps/backend/src
git commit -m "feat(shared,fights): conditional action value and new rework action types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Immunité aux effets adverses (Maître Magouille)

**Files :**
- Modify : `apps/backend/src/fights/effects/effect-targets.resolver.ts`,
  `apps/backend/src/fights/services/support.service.ts:46-70`
- Test : `apps/backend/src/fights/engine/card-rework-mechanics.spec.ts`

**Interfaces :**
- Consumes : `isTargetableByEnemyEffects` (Task 1).
- Produces : erreurs de `play_support` — `'Aucune cible valide pour cette carte'` (aucun adverse visable) et
  `'Ce monstre est insensible aux effets adverses'` (cible immunisée choisie).

- [ ] **Step 1 : tests (échouent)**

Ajouter dans `card-rework-mechanics.spec.ts` (imports à compléter : `attackWith`, `monsterNamed` depuis
`../testing/scenario`) :

```ts
  describe('immunité aux effets adverses (SET_DEBUFF_IMMUNITY)', () => {
    const IMMUNE = {
      perm: {
        atk: 0,
        hp: 0,
        taunt: false,
        piercing: false,
        debuffImmune: true,
        attacksPerTurn: 1,
      },
      isImmuneToDebuffs: true,
    };
    const magouille = () => ({
      card: monsterCard('Magouille', { atk: 0, hp: 2000 }),
      patch: IMMUNE,
    });
    const destruction = () =>
      ephemeralCard('Destruction', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER),
        ]),
      ]);

    it('un Éphémère ciblé ne peut pas le choisir', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: { monsters: [magouille(), monsterCard('Lutin')] },
      });
      const result = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Magouille').instanceId,
      });
      expect(result.error).toBe('Ce monstre est insensible aux effets adverses');
    });

    it('seul monstre adverse : la carte ciblée est injouable', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: { monsters: [magouille()] },
      });
      const result = engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Magouille').instanceId,
      });
      expect(result.error).toBe('Aucune cible valide pour cette carte');
    });

    it('les effets de zone adverses l’épargnent', () => {
      const meteore = ephemeralCard('Météore', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 300 }),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [meteore] },
        p2: { monsters: [magouille(), monsterCard('Lutin', { hp: 500 })] },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(monsterNamed(game, 'p2', 'Magouille').currentHp).toBe(2000);
      expect(monsterNamed(game, 'p2', 'Lutin').currentHp).toBe(200);
    });

    it('le combat le blesse normalement', () => {
      const game = scenario({
        phase: 'battle',
        p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 3000 })] },
        p2: { monsters: [magouille()] },
      });
      attackWith(engine, game, 'p1', 'Ogre', 'Magouille');
      expect(monsterNamed(game, 'p2', 'Magouille').currentHp).toBe(1400);
    });

    it('les effets de son propre camp s’appliquent', () => {
      const soin = ephemeralCard('Soin', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.HEAL, EffectTarget.TARGET_ALLY, { value: 500 }),
        ]),
      ]);
      const game = scenario({
        p1: {
          hand: [soin],
          monsters: [{ ...magouille(), currentHp: 1000 }],
        },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Magouille').instanceId,
      });
      expect(monsterNamed(game, 'p1', 'Magouille').currentHp).toBe(1500);
    });
  });
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- card-rework-mechanics`
Expected : FAIL (Magouille ciblé et blessé par le Météore).

- [ ] **Step 3 : implémenter**

`effects/effect-targets.resolver.ts` : importer `isTargetableByEnemyEffects` depuis `@pipou/shared` et remplacer la
définition de `enemies` :

```ts
  // Les monstres insensibles aux effets adverses ne sont jamais visés
  const enemies = opponent.monsterZones.filter(
    (m): m is MonsterOnBoard => m !== null && isTargetableByEnemyEffects(m),
  );
```

`services/support.service.ts` : importer `isTargetableByEnemyEffects` et remplacer le bloc `if (side) { … }` du
contrôle des Éphémères :

```ts
      if (side) {
        const pool = (
          side === 'ally'
            ? player.monsterZones
            : getOpponentState(game, userId).monsterZones
        ).filter((m): m is MonsterOnBoard => m !== null);
        const targetable =
          side === 'ally' ? pool : pool.filter(isTargetableByEnemyEffects);
        if (targetable.length === 0)
          return { error: 'Aucune cible valide pour cette carte' };
        const chosen = pool.find((m) => m.instanceId === targetInstanceId);
        if (chosen && !targetable.includes(chosen))
          return { error: 'Ce monstre est insensible aux effets adverses' };
        targetMonster = chosen;
        if (!targetMonster)
          return {
            error:
              side === 'ally'
                ? 'Choisis un de tes monstres comme cible'
                : 'Choisis un monstre adverse comme cible',
          };
      }
```

- [ ] **Step 4 : vérifier**

Run : `pnpm --filter @pipou/backend test`
Expected : PASS (toutes les specs, dont `supports.spec.ts` et `effects-coverage.spec.ts`).

- [ ] **Step 5 : commit**

```bash
git add apps/backend/src
git commit -m "feat(fights): debuff immunity now blocks every enemy effect

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Immunité au combat, résistance aux destructions par Support, ignorer la Provocation

**Files :**
- Modify : `apps/backend/src/fights/effects/effect-actions.applier.ts`,
  `apps/backend/src/fights/effects-resolver.service.ts`, `apps/backend/src/fights/buffs-calculator.service.ts`,
  `apps/backend/src/fights/services/battle.service.ts`, `apps/backend/src/fights/services/phase.service.ts`
- Test : `apps/backend/src/fights/engine/card-rework-mechanics.spec.ts`

**Interfaces :**
- Consumes : `ActionType.SET_COMBAT_IMMUNITY | SET_SUPPORT_DESTROY_IMMUNITY | IGNORE_TAUNT`, drapeaux de
  `MonsterOnBoard` (Task 1).
- Produces : rappel de destruction `destroy(host, instanceId, kind: 'destroy' | 'damage')` dans `applyActions`.

- [ ] **Step 1 : tests (échouent)**

Ajouter dans `card-rework-mechanics.spec.ts` (imports à compléter : `equipmentCard` depuis `../testing/cards`,
`passTurn`, `graveyardNames` depuis `../testing/scenario`) :

```ts
  describe('SET_COMBAT_IMMUNITY', () => {
    const pareFeu = () =>
      equipmentCard('Pare-feu', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.SET_COMBAT_IMMUNITY, EffectTarget.SELF),
        ]),
      ]);

    it('aucun dégât de combat jusqu’au début de son prochain tour', () => {
      const game = scenario({
        p1: {
          hand: [pareFeu()],
          monsters: [monsterCard('Mur', { atk: 100, hp: 500 })],
        },
        p2: { monsters: [monsterCard('Ogre', { atk: 900, hp: 3000 })] },
      });
      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p1', 'Mur').instanceId,
      });
      engine.dispatch(game, 'p1', { type: 'end_phase' });
      attackWith(engine, game, 'p1', 'Mur', 'Ogre');
      expect(monsterNamed(game, 'p1', 'Mur').currentHp).toBe(500);

      passTurn(engine, game);
      engine.dispatch(game, 'p2', { type: 'end_phase' });
      attackWith(engine, game, 'p2', 'Ogre', 'Mur');
      expect(monsterNamed(game, 'p1', 'Mur').currentHp).toBe(500);

      passTurn(engine, game);
      expect(monsterNamed(game, 'p1', 'Mur').combatImmune).toBeFalsy();
    });
  });

  describe('SET_SUPPORT_DESTROY_IMMUNITY', () => {
    const blindage = () =>
      equipmentCard('Blindage', [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.SET_SUPPORT_DESTROY_IMMUNITY, EffectTarget.SELF),
        ]),
      ]);
    const destruction = () =>
      ephemeralCard('Destruction', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.ENEMY_MONSTER),
        ]),
      ]);

    it('le passif est recalculé et une destruction directe par Support échoue', () => {
      const game = scenario({
        p1: { hand: [destruction()] },
        p2: {
          monsters: [{ card: monsterCard('Beta'), equipments: [blindage()] }],
        },
      });
      engine.settle(game); // recalcul des passifs
      expect(monsterNamed(game, 'p2', 'Beta').supportDestroyImmune).toBe(true);

      engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId: monsterNamed(game, 'p2', 'Beta').instanceId,
      });
      expect(monsterNamed(game, 'p2', 'Beta')).toBeDefined();
      expect(graveyardNames(game, 'p1')).toEqual(['Destruction']);
    });

    it('des dégâts mortels venant d’un Support le détruisent', () => {
      const meteore = ephemeralCard('Météore', [
        effect(EffectTrigger.ON_PLAY, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 5000 }),
        ]),
      ]);
      const game = scenario({
        p1: { hand: [meteore] },
        p2: {
          monsters: [
            {
              card: monsterCard('Beta'),
              equipments: [blindage()],
              patch: { supportDestroyImmune: true },
            },
          ],
        },
      });
      engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
      expect(game.player2.monsterZones[0]).toBeNull();
    });
  });

  describe('IGNORE_TAUNT', () => {
    const TAUNT = {
      perm: {
        atk: 0,
        hp: 0,
        taunt: true,
        piercing: false,
        debuffImmune: false,
        attacksPerTurn: 1,
      },
      hasTaunt: true,
    };
    const viseur = () =>
      equipmentCard('Viseur', [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.IGNORE_TAUNT, EffectTarget.SELF),
        ]),
      ]);
    const defense = () => [
      { card: monsterCard('Gardien', { hp: 3000 }), patch: TAUNT },
      monsterCard('Cible', { hp: 3000 }),
    ];

    it('sans le passif, la Provocation s’impose', () => {
      const game = scenario({
        p1: { monsters: [monsterCard('Delta', { atk: 500 })] },
        p2: { monsters: defense() },
      });
      engine.dispatch(game, 'p1', { type: 'end_phase' });
      expect(attackWith(engine, game, 'p1', 'Delta', 'Cible').error).toBe(
        '⚠️ Vous devez attaquer le monstre avec Provocation !',
      );
    });

    it('avec le passif, il attaque la cible de son choix', () => {
      const game = scenario({
        p1: {
          monsters: [
            { card: monsterCard('Delta', { atk: 500 }), equipments: [viseur()] },
          ],
        },
        p2: { monsters: defense() },
      });
      engine.dispatch(game, 'p1', { type: 'end_phase' });
      expect(attackWith(engine, game, 'p1', 'Delta', 'Cible')).toEqual({});
      expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(2500);
    });
  });
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- card-rework-mechanics`
Expected : FAIL sur les 3 nouveaux `describe`.

- [ ] **Step 3 : nature de la destruction et résistance**

`effects/effect-actions.applier.ts` : changer la signature du rappel et ses deux appels.

```ts
export type DestroyKind = 'destroy' | 'damage';

export function applyActions(
  effect: CardEffect,
  card: CardInstance,
  ctx: EffectContext,
  destroy: (
    host: PlayerGameState,
    instanceId: string,
    kind: DestroyKind,
  ) => void,
): void {
```

Dans `DEAL_DAMAGE` : `destroy(targets.ownerOfMonster(target), target.instanceId, 'damage');`
Dans `DESTROY_MONSTER` : `destroy(targets.ownerOfMonster(target), target.instanceId, 'destroy');`

Ajouter le cas `SET_COMBAT_IMMUNITY` (après `CANNOT_ATTACK_ON_SUMMON_TURN`) :

```ts
      case ActionType.SET_COMBAT_IMMUNITY:
        for (const m of targets.monsters) {
          m.combatImmune = true;
          ctx.log.push(
            `🌀 ${m.card.baseCard.name} est insensible aux dégâts de combat jusqu'à son prochain tour`,
          );
        }
        break;
```

`effects-resolver.service.ts` : importer `CardType` depuis `@pipou/shared`, puis remplacer le rappel passé à
`applyActions` :

```ts
      applyActions(effect, card, effectCtx, (host, instanceId, kind) => {
        const target = host.monsterZones.find(
          (m) => m?.instanceId === instanceId,
        );
        if (
          kind === 'destroy' &&
          card.baseCard.type === CardType.SUPPORT &&
          target?.supportDestroyImmune
        ) {
          ctx.log.push(`🧱 ${target.card.baseCard.name} résiste à la destruction`);
          return;
        }
        // Son propre monstre détruit par son propre effet : sacrifice, sans pioche
        const sacrifice = host.userId === ctx.ownerUserId;
        this.destroyMonster(ctx.game, host, instanceId, ctx.log, {
          draw: !sacrifice,
          cause: sacrifice ? DestroyCause.SACRIFICE : DestroyCause.EFFECT,
        });
      });
```

- [ ] **Step 4 : passifs**

`buffs-calculator.service.ts` : dans l'étape « 1. Socle » ajouter

```ts
      m.supportDestroyImmune = false;
      m.ignoresTaunt = false;
```

et dans `applyPassive` :

```ts
    case ActionType.SET_SUPPORT_DESTROY_IMMUNITY:
      m.supportDestroyImmune = true;
      break;
    case ActionType.IGNORE_TAUNT:
      m.ignoresTaunt = true;
      break;
```

- [ ] **Step 5 : combat et fin d'immunité**

`services/battle.service.ts` :
- contrôle de Provocation : remplacer `if (tauntMonsters.length > 0 && …` par
  `if (!attacker.ignoresTaunt && tauntMonsters.length > 0 && …` (reste inchangé) ;
- ajouter en haut du fichier, après les imports :

```ts
/** Dégâts de combat : rien sur un monstre insensible au combat. */
function combatDamage(
  target: MonsterOnBoard,
  dmg: number,
  opts: { ignoreReduction?: boolean },
): void {
  if (target.combatImmune) return;
  applyDamage(target, dmg, opts);
}
```

- remplacer les trois appels `applyDamage(...)` de la résolution du combat par `combatDamage(...)` (mêmes arguments).

`services/phase.service.ts`, dans `startTurn`, avant `this.processTurnCounters(...)` :

```ts
    // L'immunité au combat dure jusqu'au début du tour de son propriétaire
    for (const m of player.monsterZones) if (m) m.combatImmune = false;
```

- [ ] **Step 6 : vérifier**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add apps/backend/src
git commit -m "feat(fights): combat immunity, support-destroy immunity and taunt bypass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Données des cartes et migration `CardRework`

**Files :**
- Create : `apps/backend/src/database/card-rework-patches.ts`,
  `apps/backend/src/database/migrations/1791000000004-CardRework.ts`,
  `apps/backend/src/database/card-rework-patches.spec.ts`,
  `apps/backend/src/fights/engine/card-rework-cards.spec.ts`
- Modify : `apps/backend/src/fights/testing/real-cards.ts`

**Interfaces :**
- Consumes : actions et `valueIf` (Tasks 1–3), `canonicalEffects` (`database/card-effect-patches.ts`).
- Produces : `CARD_REWORK_PATCHES: CardReworkPatch[]`,
  `planCardRework(current: CardFields | undefined, patch, direction: 'up' | 'down'): PatchDecision`,
  `interface CardFields { name: string; description: string | null; effects: CardEffect[] | null }`.

- [ ] **Step 1 : données**

Créer `apps/backend/src/database/card-rework-patches.ts` :

```ts
import type { CardEffect } from '@pipou/shared';
import { canonicalEffects, type PatchDecision } from './card-effect-patches';

/** Champs d'une carte touchés par le retravail. */
export interface CardFields {
  name: string;
  description: string | null;
  effects: CardEffect[] | null;
}

/** État attendu en prod (export du 2026-10-17) → nouvel état. */
export interface CardReworkPatch {
  before: CardFields;
  after: CardFields;
}

const onBoard = (value: string) =>
  ({ type: 'SPECIFIC_CARD_ON_BOARD', value }) as const;
const equippedOn = (value: string) => ({ type: 'EQUIPPED_ON', value }) as const;

const withDescription = (
  fields: CardFields,
  description: string,
): CardReworkPatch => ({ before: fields, after: { ...fields, description } });

const QUENOUILLE_EFFECTS: CardEffect[] = [
  {
    actions: [
      { type: 'CANNOT_ATTACK_ON_SUMMON_TURN', target: 'SELF' },
      { type: 'SET_DELAY_DOUBLE_ATK', value: 1, target: 'SELF' },
    ],
    trigger: 'ON_SUMMON',
    condition: null,
  },
];

export const CARD_REWORK_PATCHES: CardReworkPatch[] = [
  withDescription(
    {
      name: 'Capitaine Gribouille',
      description:
        "Leader de le Brigade Ouille reconnu pour c'est attention noble de protèger son prochain.",
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
    'Leader de la Brigade Ouille, reconnu pour sa noble manie de protéger son prochain.',
  ),
  withDescription(
    {
      name: 'Lieutenant Fripouille',
      description:
        'Rival de Bidouille leur entrée dans la pipoSquad ils sont comme chienn et chat',
      effects: [
        {
          actions: [
            { type: 'BUFF_ATK', value: 150, target: 'SELF' },
            { type: 'BUFF_HP', value: 150, target: 'SELF' },
          ],
          trigger: 'PASSIVE',
          condition: onBoard('Lieutenant Bidouille'),
        },
      ],
    },
    'Rival de Bidouille depuis leur entrée dans la PipouSquad : ils sont comme chien et chat.',
  ),
  withDescription(
    {
      name: 'Commandant Quenouille',
      description:
        'Paresseux, à son poste malgré lui mais jamais en avance et jamais en retard. Si on en vraiment besoin il vient.',
      effects: QUENOUILLE_EFFECTS,
    },
    'Paresseux, à son poste malgré lui : jamais en avance, jamais en retard. Si on a vraiment besoin de lui, il vient.',
  ),
  withDescription(
    {
      name: 'Maître Magouille',
      description:
        "Membre fondateur de la PipouSquad, ne se présente qu'à de rares occasions.",
      effects: [
        {
          actions: [{ type: 'SET_DEBUFF_IMMUNITY', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
    "Membre fondateur de la PipouSquad, ne se présente qu'en de rares occasions. Insensible aux effets des cartes adverses.",
  ),
  withDescription(
    {
      name: 'Médecin Citrouille',
      description:
        'Un peu fou sur les bords, il sait exploiter le maximum du potentiel de la médecine végétale ',
      effects: [
        {
          actions: [{ type: 'HEAL', value: 200, target: 'ALLIES_EXCEPT_SELF' }],
          trigger: 'ON_TURN_START',
          condition: null,
        },
      ],
    },
    'Un peu fou sur les bords, il sait exploiter tout le potentiel de la médecine végétale.',
  ),
  withDescription(
    {
      name: "Soin d'urgence",
      description:
        'Soin de 30% des points de vie max ou 60% si un pipouman médecin est sur le terrain',
      effects: [
        {
          actions: [{ type: 'HEAL', value: 600, target: 'TARGET_ALLY' }],
          trigger: 'ON_PLAY',
          condition: null,
        },
        {
          actions: [{ type: 'HEAL', value: 200, target: 'TARGET_ALLY' }],
          trigger: 'ON_PLAY',
          condition: onBoard('Médecin Citrouille'),
        },
      ],
    },
    'Soigne un de vos monstres de 600 PV, ou de 800 PV si Médecin Citrouille est sur le terrain.',
  ),
  {
    before: {
      name: 'Ouille au rapport',
      description:
        "Permet de récupérer un ouille commun ou non commun. Si Capitaine présent sur le terrain il peut l'invoquer sans utilisé de cost",
      effects: [
        {
          actions: [
            {
              type: 'RETURN_FROM_GRAVEYARD',
              value: 3,
              filter: { rarities: ['common', 'uncommon'], archetype: 'pipou' },
              target: 'PLAYER',
            },
          ],
          trigger: 'ON_PLAY',
          condition: null,
        },
      ],
    },
    after: {
      name: 'Ouille au rapport',
      description:
        "Récupère jusqu'à 2 Ouilles communs ou peu communs de votre cimetière, ou 3 si un Capitaine est sur le terrain.",
      effects: [
        {
          actions: [
            {
              type: 'RETURN_FROM_GRAVEYARD',
              value: 2,
              filter: { rarities: ['common', 'uncommon'], archetype: 'pipou' },
              target: 'PLAYER',
              valueIf: {
                condition: {
                  type: 'SPECIFIC_CARD_ON_BOARD',
                  value: 'Capitaine',
                  match: 'contains',
                },
                value: 3,
              },
            },
          ],
          trigger: 'ON_PLAY',
          condition: null,
        },
      ],
    },
  },
  withDescription(
    {
      name: 'Vice Capitaine Patouille',
      description: null,
      effects: [
        {
          actions: [
            {
              type: 'RETURN_FROM_GRAVEYARD_OR_DECK',
              value: 1,
              filter: { name: 'Capitaine Gribouille' },
              target: 'PLAYER',
            },
          ],
          trigger: 'ON_DEATH',
          condition: null,
        },
      ],
    },
    'Fidèle second du Capitaine. À sa destruction, récupère Capitaine Gribouille depuis votre cimetière ou votre deck.',
  ),
  withDescription(
    {
      name: 'Tactique Gang Gang',
      description: '',
      effects: [
        {
          actions: [{ type: 'BUFF_ATK', value: 300, target: 'ALL_ALLIES' }],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    },
    'La stratégie de groupe signée Ouille. Tous vos monstres gagnent +300 ATK.',
  ),
  {
    before: {
      name: 'Recrue Andouille',
      description:
        'Tête brulée de la brigade Ouille, semble plus préoccupé par son allure et que sa santé.',
      effects: null,
    },
    after: {
      name: 'Recrue Andouille',
      description:
        'Tête brûlée de la Brigade Ouille, plus préoccupé par son allure que par sa santé. Toujours en mode Attaque, +200 ATK au début de chaque phase de combat.',
      effects: [
        {
          actions: [{ type: 'FORCE_ATTACK_MODE', target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
        {
          actions: [{ type: 'BUFF_ATK_TEMP', value: 200, target: 'SELF' }],
          trigger: 'ON_BATTLE_PHASE_START',
          condition: null,
        },
      ],
    },
  },
  {
    before: {
      name: 'Éclaireur Nouille',
      description:
        "Son esprit de curiosité la pousser à s'engager dans la Brigade Ouille.",
      effects: null,
    },
    after: {
      name: 'Éclaireur Nouille',
      description:
        "Sa curiosité l'a poussé à s'engager dans la Brigade Ouille. À son arrivée, pioche une carte.",
      effects: [
        {
          actions: [{ type: 'DRAW', value: 1, target: 'PLAYER' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
  },
  {
    before: { name: 'Guerrier Bafouille', description: null, effects: null },
    after: {
      name: 'Guerrier Bafouille',
      description: 'Fonce dans la mêlée sans réfléchir. +100 ATK quand il attaque.',
      effects: [
        {
          actions: [{ type: 'BUFF_ATK_TEMP', value: 100, target: 'SELF' }],
          trigger: 'ON_ATTACK',
          condition: null,
        },
      ],
    },
  },
  {
    before: { name: 'Canouille le Bleu', description: null, effects: null },
    after: {
      name: 'Canouille le Bleu',
      description:
        "L'artilleur de la brigade. À son arrivée, inflige 100 dégâts à tous les monstres adverses.",
      effects: [
        {
          actions: [{ type: 'DEAL_DAMAGE', value: 100, target: 'ALL_ENEMIES' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
  },
  {
    before: { name: 'Sentinelle Gargouille', description: null, effects: null },
    after: {
      name: 'Sentinelle Gargouille',
      description: 'Veille sur la brigade sans jamais ciller. Provocation.',
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    },
  },
  {
    before: {
      name: 'Caporal Gazouille',
      description: 'Expert en communication de la brigade.',
      effects: null,
    },
    after: {
      name: 'Caporal Gazouille',
      description:
        'Expert en communication de la brigade. Donne +100 ATK aux alliés adjacents.',
      effects: [
        {
          actions: [{ type: 'BUFF_ATK', value: 100, target: 'ADJACENT_ALLIES' }],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    },
  },
  withDescription(
    {
      name: 'Noyau Omega',
      description:
        'Le cerveau du réseau. Booste en permanence tous les Noyaux alliés.',
      effects: [
        {
          actions: [
            { type: 'BUFF_ATK', value: 300, target: 'ARCHETYPE_ALLIES' },
            { type: 'BUFF_HP', value: 300, target: 'ARCHETYPE_ALLIES' },
          ],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    },
    'Le cerveau du réseau. Donne en permanence +300 ATK et +300 PV à tous les Pixelman alliés.',
  ),
  {
    before: {
      name: "Module d'Extension .v2",
      description:
        'Sur Alpha : Provocation. Sur Beta : Burn +400 sur tous les ennemis/tour. Sur Delta : +600 ATK.',
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'DEAL_DAMAGE', value: 400, target: 'ALL_ENEMIES' }],
          trigger: 'ON_TURN_START',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'BUFF_ATK', value: 600, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
    after: {
      name: 'Module Bluetooth .v2',
      description:
        'Sur Alpha : attaque 2 fois par tour. Sur Beta : à l’équipement, inflige 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK.',
      effects: [
        {
          actions: [{ type: 'SET_ATTACKS_PER_TURN', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'DEAL_DAMAGE', value: 600, target: 'ALL_ENEMIES' }],
          trigger: 'ON_PLAY',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'BUFF_ATK', value: 600, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
  },
  {
    before: {
      name: 'Firewall de Surcharge .sys',
      description:
        'Sur Alpha : Réduction dégâts ×2. Sur Beta : +300 HP/tour. Sur Delta : Double attaque.',
      effects: [
        {
          actions: [{ type: 'SET_DAMAGE_REDUCTION', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'HEAL', value: 300, target: 'SELF' }],
          trigger: 'ON_TURN_START',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'SET_ATTACKS_PER_TURN', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
    after: {
      name: 'Firewall de Surcharge .sys',
      description:
        'Sur Alpha : à l’équipement, insensible aux dégâts de combat jusqu’à votre prochain tour. Sur Beta : ne peut pas être détruit par une carte Support. Sur Delta : ignore la Provocation.',
      effects: [
        {
          actions: [{ type: 'SET_COMBAT_IMMUNITY', target: 'SELF' }],
          trigger: 'ON_PLAY',
          condition: equippedOn('Noyau Alpha'),
        },
        {
          actions: [{ type: 'SET_SUPPORT_DESTROY_IMMUNITY', target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Beta'),
        },
        {
          actions: [{ type: 'IGNORE_TAUNT', target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: equippedOn('Noyau Delta'),
        },
      ],
    },
  },
  (() => {
    const alpha: CardFields = {
      name: 'Noyau Alpha ',
      description:
        'Noyau de défense absolu. Provocation permanente, encaisse tout en mode Garde.',
      effects: [
        {
          actions: [{ type: 'SET_TAUNT', value: 1, target: 'SELF' }],
          trigger: 'ON_SUMMON',
          condition: null,
        },
        {
          actions: [{ type: 'SET_DAMAGE_REDUCTION', value: 2, target: 'SELF' }],
          trigger: 'PASSIVE',
          condition: null,
        },
      ],
    };
    return { before: alpha, after: { ...alpha, name: 'Noyau Alpha' } };
  })(),
  (() => {
    const sorcier: CardFields = {
      name: 'Sorcier Ratatouille ',
      description: "Pluie d'encre.",
      effects: [
        {
          actions: [
            {
              type: 'SEARCH_DECK',
              value: 1,
              filter: { type: 'support', archetype: 'pipou' },
              target: 'PLAYER',
            },
          ],
          trigger: 'ON_SUMMON',
          condition: null,
        },
      ],
    };
    return { before: sorcier, after: { ...sorcier, name: 'Sorcier Ratatouille' } };
  })(),
];

/** Empreinte comparable d'une carte (clés triées, effets JSON brut ou parsé). */
function fingerprint(fields: {
  name: string;
  description: string | null;
  effects: unknown;
}): string {
  return JSON.stringify([
    fields.name,
    fields.description ?? null,
    canonicalEffects(fields.effects ?? null),
  ]);
}

/**
 * Que faire d'une carte (retrouvée par nom) selon son état actuel.
 * `up` : before → after ; `down` : after → before.
 */
export function planCardRework(
  current:
    | { name: string; description: string | null; effects: unknown }
    | undefined,
  patch: CardReworkPatch,
  direction: 'up' | 'down',
): PatchDecision {
  if (!current) return 'skip-diverged';
  const [from, to] =
    direction === 'up' ? [patch.before, patch.after] : [patch.after, patch.before];
  const actual = fingerprint(current);
  if (actual === fingerprint(to)) return 'already-done';
  if (actual === fingerprint(from)) return 'apply';
  return 'skip-diverged';
}
```

- [ ] **Step 2 : tests des patchs (échouent)**

Créer `apps/backend/src/database/card-rework-patches.spec.ts` :

```ts
import { CARD_REWORK_PATCHES, planCardRework } from './card-rework-patches';
import { canonicalEffects } from './card-effect-patches';
import { allRealCardsBeforeRework } from '../fights/testing/real-cards';

describe('card-rework-patches', () => {
  it('chaque « before » correspond à la carte de l’instantané (après GenericCardEffects)', () => {
    const cards = allRealCardsBeforeRework();
    for (const patch of CARD_REWORK_PATCHES) {
      const card = cards.find((c) => c.name === patch.before.name);
      expect({
        name: patch.before.name,
        description: card?.description ?? null,
        effects: canonicalEffects(card?.effects ?? null),
      }).toEqual({
        name: patch.before.name,
        description: patch.before.description,
        effects: canonicalEffects(patch.before.effects),
      });
    }
  });

  const ouille = CARD_REWORK_PATCHES.find(
    (p) => p.before.name === 'Ouille au rapport',
  )!;

  it('applique quand la carte vaut « before »', () => {
    expect(planCardRework(ouille.before, ouille, 'up')).toBe('apply');
  });

  it('ne refait rien si déjà appliqué', () => {
    expect(planCardRework(ouille.after, ouille, 'up')).toBe('already-done');
  });

  it("ignore une carte modifiée depuis l'export", () => {
    expect(
      planCardRework(
        { ...ouille.before, description: 'Modifiée dans l’admin' },
        ouille,
        'up',
      ),
    ).toBe('skip-diverged');
  });

  it('down restaure « before »', () => {
    expect(planCardRework(ouille.after, ouille, 'down')).toBe('apply');
  });

  it('accepte des effets JSON bruts (colonne MySQL)', () => {
    expect(
      planCardRework(
        { ...ouille.before, effects: JSON.stringify(ouille.before.effects) },
        ouille,
        'up',
      ),
    ).toBe('apply');
  });
});
```

Note : la description de l'instantané pour Vice Capitaine Patouille, Guerrier Bafouille, Canouille le Bleu et
Sentinelle Gargouille est `null` (champ absent ou `null`) : le test normalise avec `?? null`.

- [ ] **Step 3 : vraies cartes post-rework**

`apps/backend/src/fights/testing/real-cards.ts` :

```ts
import { CARD_REWORK_PATCHES } from '../../database/card-rework-patches';

/** Cartes après GenericCardEffects, avant le retravail (état de prod au 2026-10-17). */
export function allRealCardsBeforeRework(): Card[] {
  return rawSnapshotCards().map((c) => {
    const patch = CARD_EFFECT_PATCHES.find((p) => p.cardId === c.id);
    return patch ? { ...c, effects: patch.after } : c;
  });
}

/** Cartes avec les effets attendus après toutes les migrations de cartes. */
export function allRealCards(): Card[] {
  return allRealCardsBeforeRework().map((c) => {
    const patch = CARD_REWORK_PATCHES.find((p) => p.before.name === c.name);
    return patch
      ? {
          ...c,
          name: patch.after.name,
          description: patch.after.description,
          effects: patch.after.effects,
        }
      : c;
  });
}
```

(remplacer l'ancienne `allRealCards` ; `realCard` reste inchangée et utilise `allRealCards`. Si le type `Card`
déclare `description` non nullable, caster avec `as Card` sur l'objet retourné.)

- [ ] **Step 4 : migration**

Créer `apps/backend/src/database/migrations/1791000000004-CardRework.ts` :

```ts
import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { CARD_REWORK_PATCHES, planCardRework } from '../card-rework-patches';

/**
 * Retravail des cartes PipouSquad / SquareWorld (spec 2026-10-17-card-rework) :
 * effets, noms et descriptions. Chaque carte est retrouvée par son nom et
 * n'est modifiée que si elle est dans l'état de l'export de prod.
 */
export class CardRework1791000000004 implements MigrationInterface {
  name = 'CardRework1791000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyRework(queryRunner, 'up');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyRework(queryRunner, 'down');
  }
}

async function applyRework(
  queryRunner: QueryRunner,
  direction: 'up' | 'down',
): Promise<void> {
  const logger = new Logger('CardRework');
  for (const patch of CARD_REWORK_PATCHES) {
    const [from, to] =
      direction === 'up'
        ? [patch.before, patch.after]
        : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `id`, `name`, `description`, `effects` FROM `card` WHERE `name` IN (?, ?)',
      [from.name, to.name],
    )) as {
      id: number;
      name: string;
      description: string | null;
      effects: unknown;
    }[];
    const current = rows[0];
    const decision = planCardRework(current, patch, direction);
    if (decision === 'apply') {
      await queryRunner.query(
        'UPDATE `card` SET `name` = ?, `description` = ?, `effects` = ? WHERE `id` = ?',
        [
          to.name,
          to.description,
          to.effects === null ? null : JSON.stringify(to.effects),
          current.id,
        ],
      );
    } else if (decision === 'skip-diverged') {
      logger.warn(
        `Carte « ${from.name} » : absente ou différente de l'attendu, non modifiée — à corriger via l'admin`,
      );
    }
  }
}
```

- [ ] **Step 5 : tests des vraies cartes (échouent puis passent)**

Créer `apps/backend/src/fights/engine/card-rework-cards.spec.ts` :

```ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  attackWith,
  handNames,
  monsterNamed,
  scenario,
} from '../testing/scenario';

describe('cartes retravaillées', () => {
  const engine = createEngine();
  const summon = (game: ReturnType<typeof scenario>, zoneIndex = 1) =>
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex,
      paymentHandIndices: [],
    });

  it('Ouille au rapport : 2 cartes, 3 avec un Capitaine', () => {
    const graveyard = ['Recrue Andouille', 'Éclaireur Nouille', 'Guerrier Bafouille', 'Canouille le Bleu'].map(realCard);
    const sans = scenario({ p1: { hand: [realCard('Ouille au rapport')], graveyard } });
    engine.dispatch(sans, 'p1', { type: 'play_support', handIndex: 0 });
    expect(sans.pendingChoices[0].count).toBe(2);

    const avec = scenario({
      p1: {
        hand: [realCard('Ouille au rapport')],
        graveyard,
        monsters: [realCard('Capitaine Gribouille')],
      },
    });
    engine.dispatch(avec, 'p1', { type: 'play_support', handIndex: 0 });
    expect(avec.pendingChoices[0].count).toBe(3);
  });

  it('Module Bluetooth .v2 sur Beta : 600 à tous les ennemis à l’équipement', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Module Bluetooth .v2')],
        monsters: [realCard('Noyau Beta')],
      },
      p2: { monsters: [monsterCard('Lutin', { hp: 1000 })] },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Beta').instanceId,
    });
    expect(monsterNamed(game, 'p2', 'Lutin').currentHp).toBe(400);
  });

  it('Module Bluetooth .v2 sur Alpha : 2 attaques par tour', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Module Bluetooth .v2')],
        monsters: [realCard('Noyau Alpha')],
      },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Alpha').instanceId,
    });
    expect(monsterNamed(game, 'p1', 'Noyau Alpha').attacksPerTurn).toBe(2);
  });

  it('Firewall de Surcharge .sys sur Delta : ignore la Provocation', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Firewall de Surcharge .sys')],
        monsters: [realCard('Noyau Delta')],
      },
      p2: {
        monsters: [
          {
            card: realCard('Sentinelle Gargouille'),
            // Posée sans invocation : Provocation fournie directement
            patch: {
              perm: {
                atk: 0,
                hp: 0,
                taunt: true,
                piercing: false,
                debuffImmune: false,
                attacksPerTurn: 1,
              },
            },
          },
          monsterCard('Cible', { hp: 5000 }),
        ],
      },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Delta').instanceId,
    });
    engine.dispatch(game, 'p1', { type: 'end_phase' });
    expect(attackWith(engine, game, 'p1', 'Noyau Delta', 'Cible')).toEqual({});
  });

  it('Éclaireur Nouille : pioche une carte à l’invocation', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Éclaireur Nouille')],
        deck: [monsterCard('Pioche')],
        recycleEnergy: 3,
      },
    });
    summon(game);
    expect(handNames(game, 'p1')).toEqual(['Pioche']);
  });

  it('Canouille le Bleu : 100 dégâts à tous les ennemis', () => {
    const game = scenario({
      p1: { hand: [realCard('Canouille le Bleu')], recycleEnergy: 3 },
      p2: { monsters: [monsterCard('A', { hp: 500 }), monsterCard('B', { hp: 500 })] },
    });
    summon(game);
    expect(monsterNamed(game, 'p2', 'A').currentHp).toBe(400);
    expect(monsterNamed(game, 'p2', 'B').currentHp).toBe(400);
  });

  it('Sentinelle Gargouille : Provocation', () => {
    const game = scenario({
      p1: { hand: [realCard('Sentinelle Gargouille')], recycleEnergy: 3 },
    });
    summon(game);
    expect(monsterNamed(game, 'p1', 'Sentinelle Gargouille').hasTaunt).toBe(true);
  });

  it('Recrue Andouille : mode Attaque forcé, +200 ATK en phase de combat', () => {
    const game = scenario({
      p1: { hand: [realCard('Recrue Andouille')], recycleEnergy: 3 },
    });
    summon(game);
    const recrue = monsterNamed(game, 'p1', 'Recrue Andouille');
    expect(recrue.forcedAttackMode).toBe(true);
    engine.dispatch(game, 'p1', { type: 'end_phase' });
    expect(recrue.tempAtkBuff).toBe(200);
  });

  it('Guerrier Bafouille : +100 ATK quand il attaque', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [realCard('Guerrier Bafouille')] },
      p2: { monsters: [monsterCard('Cible', { atk: 0, hp: 1000 })] },
    });
    attackWith(engine, game, 'p1', 'Guerrier Bafouille', 'Cible');
    expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(700);
  });

  it('Caporal Gazouille : +100 ATK aux alliés adjacents', () => {
    const game = scenario({
      p1: {
        hand: [realCard('Caporal Gazouille')],
        monsters: [monsterCard('Gauche'), null, monsterCard('Droite')],
        recycleEnergy: 3,
      },
    });
    summon(game, 1);
    expect(monsterNamed(game, 'p1', 'Gauche').atkBuff).toBe(100);
    expect(monsterNamed(game, 'p1', 'Droite').atkBuff).toBe(100);
  });
});
```

(Les cartes Pipou coûtent 1 : `recycleEnergy: 3` paie l'invocation sans défausse.)

Mettre à jour `apps/backend/src/fights/engine/real-cards.spec.ts`, qui teste les anciens bonus d'équipement :
- supprimer `Noyau Alpha + Module .v2 + Firewall .sys : Provocation et dégâts divisés par 2`,
  `Noyau Beta + Module .v2 : 300 + 400 dégâts à chaque début de tour` et
  `Noyau Delta + Firewall .sys : deux attaques par tour dès l'équipement` (comportements remplacés, couverts par
  `card-rework-cards.spec.ts` et `card-rework-mechanics.spec.ts`) ;
- dans `Noyau Delta + Module .v2 : +600 ATK`, remplacer `realCard("Module d'Extension .v2")` par
  `realCard('Module Bluetooth .v2')` ;
- partout ailleurs dans ce fichier, `monsterNamed(game, …, 'Noyau Alpha ')` devient `'Noyau Alpha'`.

Run : `pnpm --filter @pipou/backend test -- card-rework real-cards`
Expected : PASS (les patchs, la migration et les vraies cartes sont cohérents). Si un « before » échoue, comparer avec
l'instantané `fights/testing/fixtures/cards.snapshot.json` et l'export de prod cité dans la spec — ne jamais modifier
l'instantané.

- [ ] **Step 6 : vérifier l'ensemble**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend lint`
Expected : PASS (dont `effects-coverage.spec.ts` : chaque vraie carte se joue sans erreur).

- [ ] **Step 7 : commit**

```bash
git add apps/backend/src
git commit -m "feat(db): CardRework migration for PipouSquad and SquareWorld cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Front — textes d'effets, statuts et cibles

**Files :**
- Modify : `apps/frontend/src/features/fight/effectText.ts`,
  `apps/frontend/src/features/fight/Zonerow/zoneRow.effects.ts`, `apps/frontend/src/features/fight/FightBoard.tsx`,
  `apps/frontend/src/i18n/locales/{fr,en,ko}.json`
- Test : `apps/frontend/src/__tests__/unit/effectText.test.ts`, `apps/frontend/src/__tests__/unit/zoneRow.effects.test.ts`
  (créé)

**Interfaces :**
- Consumes : nouvelles `ActionType`, `valueIf`, drapeaux `MonsterOnBoard`, `isTargetableByEnemyEffects` (Task 1).
- Produces : mots-clés `combatImmunity`, `supportShield`, `ignoreTaunt` dans `KEYWORD_ICON`.

- [ ] **Step 1 : tests (échouent)**

Ajouter dans `__tests__/unit/effectText.test.ts`, dans `describe("describeCardEffects (fr)")` :

```ts
  it("valueIf : la quantité conditionnelle est rédigée", () => {
    const text = describeCardEffects(
      support("EPHEMERAL", [
        {
          trigger: "ON_PLAY",
          condition: null,
          actions: [
            {
              type: "RETURN_FROM_GRAVEYARD",
              target: "PLAYER",
              value: 2,
              valueIf: {
                condition: {
                  type: "SPECIFIC_CARD_ON_BOARD",
                  value: "Capitaine",
                  match: "contains",
                },
                value: 3,
              },
            },
          ],
        },
      ]),
      t,
    );
    expect(text.rules[0].lines[0].text).toBe(
      "Tu récupères jusqu'à 2 cartes de ton cimetière. (3 si une carte dont le nom contient « Capitaine » est sur ton terrain)",
    );
  });

  it("équipement : les trois nouvelles protections sont rédigées avec leur mot-clé", () => {
    const text = describeCardEffects(
      support("EQUIPMENT", [
        {
          trigger: "ON_PLAY",
          condition: null,
          actions: [{ type: "SET_COMBAT_IMMUNITY", target: "SELF" }],
        },
        {
          trigger: "PASSIVE",
          condition: null,
          actions: [
            { type: "SET_SUPPORT_DESTROY_IMMUNITY", target: "SELF" },
            { type: "IGNORE_TAUNT", target: "SELF" },
          ],
        },
      ]),
      t,
    );
    expect(text.keywords).toEqual(["combatImmunity", "supportShield", "ignoreTaunt"]);
  });
```

Créer `__tests__/unit/zoneRow.effects.test.ts` :

```ts
import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type TFunction } from "i18next";
import fr from "../../i18n/locales/fr.json";
import { getMonsterStatusEntries } from "../../features/fight/Zonerow/zoneRow.effects";
import { monster } from "../fixtures/monster";

describe("getMonsterStatusEntries — nouvelles protections", () => {
  let t: TFunction;
  beforeAll(async () => {
    const i = i18next.createInstance();
    await i.init({ lng: "fr", resources: { fr: { translation: fr } }, fallbackLng: false });
    t = i.t;
  });

  it("affiche les trois drapeaux", () => {
    const labels = getMonsterStatusEntries(
      monster({ combatImmune: true, supportDestroyImmune: true, ignoresTaunt: true }),
      t,
    ).map((e) => e.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        fr.keywords.combatImmunity.name,
        fr.keywords.supportShield.name,
        fr.keywords.ignoreTaunt.name,
      ]),
    );
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test effectText zoneRow.effects`
Expected : FAIL (mots-clés et textes absents ; les tests d'exhaustivité i18n échouent aussi sur les 3 actions).

- [ ] **Step 3 : `effectText.ts`**

Dans `KEYWORD_ICON`, ajouter :

```ts
  combatImmunity: "🌀",
  supportShield: "🧱",
  ignoreTaunt: "🎯",
```

Dans `ACTIONS`, ajouter :

```ts
  SET_COMBAT_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "combatImmunity",
  },
  SET_SUPPORT_DESTROY_IMMUNITY: {
    tone: "buff",
    subject: "monster",
    keyword: "supportShield",
  },
  IGNORE_TAUNT: { tone: "buff", subject: "monster", keyword: "ignoreTaunt" },
```

Dans `describeAction`, juste avant le `const negative = …`, compléter le texte avec la quantité conditionnelle :

```ts
  const conditional = action.valueIf
    ? t("effects.valueIf", {
        value: action.valueIf.value,
        condition: lowerFirst(
          describeCondition(t, action.valueIf.condition) ?? "",
        ),
      })
    : "";
  const fullText = conditional ? `${text} ${conditional}` : text;
```

et utiliser `capitalize(fullText)` à la place de `capitalize(text)`. Ajouter près de `capitalize` :

```ts
/** Minuscule à la première lettre (condition insérée dans une parenthèse). */
function lowerFirst(s: string): string {
  return s.replace(/^\p{L}/u, (letter) => letter.toLowerCase());
}
```

- [ ] **Step 4 : traductions**

Dans chaque fichier de langue, ajouter :

1. Sous `effects` : la clé `valueIf`
   - fr : `"valueIf": "({{value}} {{condition}})"`
   - en : `"valueIf": "({{value}} {{condition}})"`
   - ko : `"valueIf": "({{condition}} {{value}})"`
2. Sous `effects.action` (même structure que `SET_TAUNT` / `SET_TAUNT_many` de chaque langue) :
   - fr :
     `"SET_COMBAT_IMMUNITY": "{{target}} gagne **{{kw}}** jusqu'à ton prochain tour."`,
     `"SET_COMBAT_IMMUNITY_many": "{{target}} gagnent **{{kw}}** jusqu'à ton prochain tour."`,
     `"SET_SUPPORT_DESTROY_IMMUNITY": "{{target}} gagne **{{kw}}**."`,
     `"SET_SUPPORT_DESTROY_IMMUNITY_many": "{{target}} gagnent **{{kw}}**."`,
     `"IGNORE_TAUNT": "{{target}} gagne **{{kw}}**."`, `"IGNORE_TAUNT_many": "{{target}} gagnent **{{kw}}**."`
   - en :
     `"SET_COMBAT_IMMUNITY": "{{target}} gains **{{kw}}** until your next turn."`,
     `"SET_COMBAT_IMMUNITY_many": "{{target}} gain **{{kw}}** until your next turn."`,
     `"SET_SUPPORT_DESTROY_IMMUNITY": "{{target}} gains **{{kw}}**."`,
     `"SET_SUPPORT_DESTROY_IMMUNITY_many": "{{target}} gain **{{kw}}**."`,
     `"IGNORE_TAUNT": "{{target}} gains **{{kw}}**."`, `"IGNORE_TAUNT_many": "{{target}} gain **{{kw}}**."`
   - ko (une seule forme, comme `SET_TAUNT` en ko) :
     `"SET_COMBAT_IMMUNITY": "{{target}}에게 다음 턴까지 **{{kw}}** 부여."`,
     `"SET_SUPPORT_DESTROY_IMMUNITY": "{{target}}에게 **{{kw}}** 부여."`,
     `"IGNORE_TAUNT": "{{target}}에게 **{{kw}}** 부여."`
3. Sous `keywords` :
   - fr : `"combatImmunity": { "name": "Insensible au combat", "desc": "Ne subit aucun dégât de combat, ni en attaquant ni en étant attaqué." }`,
     `"supportShield": { "name": "Blindage", "desc": "Ne peut pas être détruit directement par une carte Support (les dégâts passent)." }`,
     `"ignoreTaunt": { "name": "Contournement", "desc": "Peut attaquer n'importe quel monstre malgré la Provocation." }`,
     et remplacer `debuffImmunity` par `{ "name": "Insensible aux effets adverses", "desc": "Aucun effet d'une carte adverse ne peut viser ce monstre. Le combat le blesse normalement." }`
   - en : `"combatImmunity": { "name": "Combat immunity", "desc": "Takes no combat damage, whether attacking or being attacked." }`,
     `"supportShield": { "name": "Shielded", "desc": "Cannot be destroyed directly by a Support card (damage still applies)." }`,
     `"ignoreTaunt": { "name": "Bypass", "desc": "Can attack any monster despite Taunt." }`,
     et `debuffImmunity` → `{ "name": "Immune to enemy effects", "desc": "No enemy card effect can target this monster. Combat still damages it." }`
   - ko : `"combatImmunity": { "name": "전투 면역", "desc": "공격하거나 공격받을 때 전투 피해를 받지 않습니다." }`,
     `"supportShield": { "name": "장갑", "desc": "서포트 카드로 직접 파괴되지 않습니다 (피해는 받습니다)." }`,
     `"ignoreTaunt": { "name": "우회", "desc": "도발을 무시하고 아무 몬스터나 공격할 수 있습니다." }`,
     et `debuffImmunity` → `{ "name": "적 효과 면역", "desc": "상대 카드의 효과가 이 몬스터를 대상으로 할 수 없습니다. 전투 피해는 받습니다." }`

Si les tests d'exhaustivité (`chaque action × cible × valeur a un texte, dans chaque contexte`) réclament une forme
supplémentaire (par ex. un contexte d'équipement), l'ajouter sur le modèle exact de `SET_TAUNT` dans la même langue.

- [ ] **Step 5 : statuts et cibles**

`Zonerow/zoneRow.effects.ts`, après `if (zone.isImmuneToDebuffs) keyword("debuffImmunity", "buff");` :

```ts
  if (zone.combatImmune) keyword("combatImmunity", "buff");
  if (zone.supportDestroyImmune) keyword("supportShield", "buff");
  if (zone.ignoresTaunt) keyword("ignoreTaunt", "buff");
```

`FightBoard.tsx` : importer `isTargetableByEnemyEffects` depuis `@pipou/shared` et définir, avant `openTargetPick` :

```tsx
  /** Monstres qu'un Éphémère peut viser dans ce camp (immunisés exclus côté adverse). */
  const targetableZones = (side: "ally" | "enemy") =>
    side === "ally"
      ? gs.me.monsterZones.filter((z) => z !== null)
      : gs.opponent.monsterZones.filter(
          (z) => z !== null && isTargetableByEnemyEffects(z),
        );
```

Dans `openTargetPick`, remplacer le calcul de `zones` et le `.filter(...)` qui suit par
`const candidates: ClientChoiceCandidate[] = targetableZones(targetSide).map((z) => ({ … }))` (le corps du `map`
inchangé, `z` étant non nul). Dans `playBlockedReason`, remplacer l'expression `(selectedTargetSide === "ally" ?
gs.me.monsterZones : gs.opponent.monsterZones).some(Boolean)` par `targetableZones(selectedTargetSide).length > 0`.

- [ ] **Step 6 : vérifier**

Run : `pnpm build:shared && pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend typecheck`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): texts, statuses and targeting for reworked card mechanics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Base locale, vérification complète et visuelle

**Files :** aucun fichier versionné, sauf retouches éventuelles.

- [ ] **Step 1 : monorepo**

Run : `pnpm build:shared && pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected : tout PASS.

- [ ] **Step 2 : appliquer le retravail à la base locale (jamais Aiven)**

Avec la BDD Docker démarrée (`docker compose up -d db`), écrire un script hors dépôt (dossier scratch) qui lit
`apps/backend/.env.dev.local`, **refuse** de continuer si `DB_HOST` n'est pas `127.0.0.1`/`localhost` ou si
`DB_NAME` n'est pas `cardcollect_dev`, puis, pour chaque `CARD_REWORK_PATCHES`, reproduit exactement la logique de
`applyRework(…, 'up')` de la migration (même `SELECT … WHERE name IN (?, ?)`, `planCardRework`, `UPDATE`). Le
lancer depuis `apps/backend` avec `npx ts-node -P tsconfig.json --transpile-only <script> "$(pwd)"`. Attendu : une
ligne `apply` (ou `already-done`) par carte, aucune `skip-diverged` hors cartes absentes de la base locale.

- [ ] **Step 3 : vérification visuelle**

Backend `ENV_FILE=.env.dev.local npx nest start` (depuis `apps/backend`), front `pnpm --filter @pipou/frontend dev:local`,
admin local `admin@local.test` / `PipouAdmin123!`, sandbox `/admin/sandbox`, Playwright 430 px (`channel: 'chrome'`).
Capturer : la fiche d'effets (appui long) de Module Bluetooth .v2, Firewall de Surcharge .sys, Ouille au rapport,
Maître Magouille ; Magouille absent de la liste de cibles de Force Delta ; statuts « Insensible au combat »,
« Blindage », « Contournement » sur un Noyau équipé. Arrêter les serveurs et `docker compose stop db` à la fin.
