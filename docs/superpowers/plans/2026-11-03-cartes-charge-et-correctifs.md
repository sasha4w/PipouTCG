# Correctifs de cartes et nouvelles cartes Charge — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger l'éclosion de l'Œuf Céleste, clarifier le texte du Module Bluetooth .v2, afficher la durée des dégâts divisés, vérifier la double destruction des Champions, puis ajouter trois cartes Charge (Alerte générale, Extraction de données, Méditation céleste).

**Architecture:** Moteur de duel NestJS pur (`apps/backend/src/fights`), effets décrits en JSON (`@pipou/shared`), cartes modifiées en base par des migrations de patch idempotentes. Les choix sur le terrain réutilisent la file `pendingChoices` existante avec la source `board` (déjà gérée par `CardPickModal`). L'évolution « sans carte » s'appuie sur un catalogue d'évolutions chargé au démarrage.

**Tech Stack:** TypeScript, NestJS 11, TypeORM (MySQL), Jest (backend), React 18 + Vitest (frontend), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-11-03-cartes-charge-et-correctifs-design.md`

## Global Constraints

- Tout type ou enum échangé front/back vit dans `@pipou/shared` ; après modification : `pnpm build:shared`.
- `@pipou/shared` n'a aucune dépendance runtime.
- Migrations jouées uniquement en local (`cardcollect_dev`, `ENV_FILE=.env.dev.local`), jamais sur Aiven. La prod les reçoit via la CI sur `main`.
- Une migration de patch n'écrase jamais une carte modifiée à la main (`planBalancePatch`).
- Les 3 nouvelles cartes sont des supports de coût 0, sans image.
- Nouvelle UI : icônes SVG de `components/Icons.tsx`, jamais d'emoji.
- Textes de jeu en français ; i18n front en fr, en, ko.
- Commits uniquement sur demande de l'utilisateur ; chaque tâche se termine par un commit proposé.
- Ordre de livraison : Partie A (correctifs) avant Partie B (nouvelles cartes).

## Écarts au spec, validés avec l'utilisateur

- Gel : pas de bug moteur. La réduction ÷2 des Teros et de l'Écaille ne dure que 2 tours depuis le nerf du 31/10 ; on affiche les tours restants (Task 3).
- Mise à jour .patch : comportement voulu, rien à faire.
- Module Bluetooth .v2 : texte seulement (Task 2).
- DuplicateX : cause probable = aura « +300 PV par allié adjacent » du Champion Ouille-Ouille. Task 4 la confirme par test puis s'arrête pour décision.
- Cibles des Charges : choisies à la fin de la charge, dans la fenêtre de choix existante.

## Fichiers

| Fichier | Rôle |
|---|---|
| `apps/backend/src/fights/helpers/hatching.ts` | Éclosion : deck, puis cimetière, puis stades inférieurs |
| `apps/backend/src/fights/services/pick.service.ts` | Résolution des choix (summon depuis le cimetière, nouvelles résolutions) |
| `apps/backend/src/database/cartes-2026-11-patches.ts` (créé) | Patch Bluetooth + 3 nouvelles cartes |
| `apps/backend/src/database/migrations/1791000000023-ChargeCardsNovember.ts` (créé) | Migration du patch et des cartes |
| `apps/backend/src/fights/testing/real-cards.ts` | Applique le nouveau patch aux vraies cartes de test |
| `apps/frontend/src/features/fight/statusBadges.ts`, `Zonerow/StatusBadges.tsx`, `Zonerow/zoneRow.effects.tsx` | Tours restants de réduction |
| `packages/shared/src/enums/effect.ts`, `game/effect-schema.ts`, `game/state.ts` | Nouvelles actions, résolutions, consignes |
| `apps/backend/src/fights/helpers/charges.ts`, `services/support.service.ts` | Charge cyclique |
| `apps/backend/src/fights/helpers/support-requirements.ts` (créé) | Supports qui exigent une carte en jeu |
| `apps/backend/src/fights/helpers/evolution-catalog.ts` (créé) | Cartes d'évolution disponibles sans les posséder |
| `apps/backend/src/fights/helpers/evolution.ts` (créé) | Évolution sur place, partagée par la main et FORCE_EVOLVE |
| `apps/backend/src/fights/effects/effect-actions.applier.ts` | Nouvelles actions |
| `apps/backend/src/fights/engine/game-engine.ts` | Nettoyage des supports orphelins dans `settle` |
| `apps/frontend/src/features/fight/CardPickModal.tsx`, `i18n/locales/*.json` | Nouvelles résolutions de choix |

---

# Partie A — Correctifs

### Task 1: Œuf Céleste — éclosion avec repli

**Files:**
- Modify: `apps/backend/src/fights/helpers/hatching.ts`
- Modify: `apps/backend/src/fights/services/pick.service.ts:51-68`
- Test: `apps/backend/src/fights/engine/hatching-fallback.spec.ts` (créé)

**Interfaces:**
- Produces: `hatchEgg(game, owner, egg, log)` (signature inchangée). Les candidats `summon_to_zone` peuvent venir de `'graveyard'`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/backend/src/fights/engine/hatching-fallback.spec.ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { monsterNamed, passTurn, scenario, seatState } from '../testing/scenario';

const engine = createEngine();
const egg = () => ({ card: realCard('Œuf Céleste'), patch: { hatchCounter: 1, hatchStage: 'adult' as const } });
const fillers = () => Array.from({ length: 10 }, () => monsterCard('Filler'));

/** Fin du tour de p1 puis de p2 : l'œuf éclot au début du tour suivant de p1. */
function hatch(game: ReturnType<typeof scenario>) {
  passTurn(engine, game);
  passTurn(engine, game);
}

describe('Œuf Céleste : éclosion avec repli', () => {
  it('propose un Adulte du cimetière quand le deck n’en a plus', () => {
    const game = scenario({
      p1: { monsters: [egg()], deck: fillers(), graveyard: [realCard('Adulte Feros')] },
    });
    hatch(game);
    const choice = game.pendingChoices[0];
    expect(choice.candidates.map((c) => [c.baseCard.name, c.source])).toEqual([
      ['Adulte Feros', 'graveyard'],
    ]);
    expect(
      engine.dispatch(game, 'p1', { type: 'pick', instanceIds: [choice.candidates[0].instanceId] }).error,
    ).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Adulte Feros')).toBeDefined();
    expect(seatState(game, 'p1').graveyard.map((c) => c.baseCard.name)).not.toContain('Adulte Feros');
  });

  it('prend un Jeune quand aucun Adulte n’est disponible', () => {
    const game = scenario({
      p1: { monsters: [egg()], deck: [realCard('Jeune Ackos'), ...fillers()] },
    });
    hatch(game);
    expect(game.pendingChoices[0].candidates.map((c) => c.baseCard.name)).toEqual(['Jeune Ackos']);
  });

  it('prend un Bébé en dernier recours', () => {
    const game = scenario({
      p1: { monsters: [egg()], graveyard: [realCard('Bébé Teros')], deck: fillers() },
    });
    hatch(game);
    expect(game.pendingChoices[0].candidates.map((c) => c.baseCard.name)).toEqual(['Bébé Teros']);
  });
});
```

Avant d'écrire le test, vérifier le nom exact de l'action de choix dans `packages/shared/src/socket/fight.ts` (`type: 'pick'` et le champ des identifiants) et l'adapter.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pipou/backend test -- hatching-fallback`
Expected: FAIL, `game.pendingChoices[0]` undefined (aucun candidat hors deck).

- [ ] **Step 3: Implement the fallback in `hatching.ts`**

Remplacer la recherche de candidats (lignes 25-38) par :

```ts
/** Stade visé, puis les stades inférieurs : un œuf ne se perd jamais pour rien. */
const FALLBACK: Partial<Record<DrakonStage, DrakonStage[]>> = {
  adult: ['adult', 'young', 'baby'],
  young: ['young', 'baby'],
  baby: ['baby'],
};

function hatchCandidates(owner: PlayerGameState, stage: DrakonStage | undefined) {
  const of = (pile: CardInstance[], source: 'deck' | 'graveyard', s: DrakonStage) =>
    pile
      .filter((c) => c.baseCard.type === CardType.MONSTER && c.baseCard.stage === s)
      .map((c) => ({ instanceId: c.instanceId, baseCard: c.baseCard, source }));
  for (const s of stage ? (FALLBACK[stage] ?? [stage]) : []) {
    const found = [...of(owner.deck, 'deck', s), ...of(owner.graveyard, 'graveyard', s)];
    if (found.length > 0) return found;
  }
  return [];
}
```

Puis dans `hatchEgg` : `const candidates = hatchCandidates(owner, egg.hatchStage);`. Importer `CardInstance` depuis `../interfaces/game-state.interface`. L'œuf part au cimetière **après** le calcul des candidats, pour ne pas se proposer lui-même : déplacer `sendToGraveyard(owner, ...egg.equipments, egg.card)` sous l'appel à `hatchCandidates`.

- [ ] **Step 4: Accept graveyard candidates in `pick.service.ts`**

Remplacer la branche `summon_to_zone` (lignes 51-68) par :

```ts
} else if (choice.resolution === 'summon_to_zone') {
  for (const id of picked) {
    const candidate = candidates.find((c) => c.instanceId === id)!;
    const pile = candidate.source === 'graveyard' ? player.graveyard : player.deck;
    const idx = pile.findIndex((c) => c.instanceId === id);
    if (idx === -1) continue;
    const [card] = pile.splice(idx, 1);
    if (
      !this.summon.summonFromDeck(game, player, card, choice.zoneIndex, {
        fromEgg: choice.fromEgg,
      })
    ) {
      pile.push(card);
      addLog(game, `💨 Aucune zone libre : ${card.baseCard.name} reste en place`);
    }
  }
  shuffle(player.deck);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @pipou/backend test -- hatching-fallback garde-real-cards drakon`
Expected: PASS.

- [ ] **Step 6: Update the card text** — dans `cartes-2026-11-patches.ts` (créé en Task 2), ajouter le patch de description de l'Œuf Céleste : « Couvé par les étoiles. Après 3 tours, il éclot en Drakon Adulte de ton choix (deck ou cimetière ; à défaut un Jeune, puis un Bébé). En attendant, soigne tes Drakons de 200 PV au début de chacun de tes tours. » Si Task 2 n'est pas encore faite, l'ajouter à ce moment-là.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/fights/helpers/hatching.ts apps/backend/src/fights/services/pick.service.ts apps/backend/src/fights/engine/hatching-fallback.spec.ts
git commit -m "fix(fights): l'Œuf Céleste éclot depuis le cimetière ou en stade inférieur"
```

---

### Task 2: Patch de textes (Module Bluetooth .v2, Œuf Céleste) et migration

**Files:**
- Create: `apps/backend/src/database/cartes-2026-11-patches.ts`
- Create: `apps/backend/src/database/migrations/1791000000023-ChargeCardsNovember.ts`
- Create: `apps/backend/src/database/cartes-2026-11-patches.spec.ts`
- Modify: `apps/backend/src/fights/testing/real-cards.ts:150-169`

**Interfaces:**
- Produces: `NOVEMBER_PATCHES: BalancePatch[]`, `CHARGE_NEW_CARDS: ChargeNewCard[]` (vide ici, rempli en Task 9), migration `ChargeCardsNovember1791000000023`.

- [ ] **Step 1: Write the failing spec**

```ts
// apps/backend/src/database/cartes-2026-11-patches.spec.ts
import { realCard } from '../fights/testing/real-cards';
import { NOVEMBER_PATCHES } from './cartes-2026-11-patches';

describe('patch de textes 2026-11', () => {
  it('chaque `before` correspond à la carte actuelle', () => {
    // realCard applique déjà le patch : on compare les effets, inchangés par un patch de texte
    for (const p of NOVEMBER_PATCHES)
      expect(realCard(p.after.name).effects).toEqual(p.before.effects);
  });

  it('Bluetooth : le texte précise « une seule fois » sur Beta', () => {
    expect(realCard('Module Bluetooth .v2').description).toContain(
      "Sur Beta : à l'équipement, inflige une seule fois 600 dégâts à tous les monstres adverses",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/backend test -- cartes-2026-11-patches`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Create the patch module**

```ts
// apps/backend/src/database/cartes-2026-11-patches.ts
import type { CardEffect, Rarity } from '@pipou/shared';
import { BALANCE_PATCHES, tweak } from './balance-2026-10-patches';
import type { BalanceFields, BalancePatch } from './balance-2026-10-patches';
import { GARDE_PATCHES } from './garde-2026-10-patches';

/**
 * Patch 2026-11 : textes clarifiés (Module Bluetooth .v2, Œuf Céleste) et
 * cartes Charge (Alerte générale, Extraction de données, Méditation céleste).
 */

const balanceAfter = (name: string): BalanceFields => {
  const patch = BALANCE_PATCHES.find((p) => p.after.name === name);
  if (!patch) throw new Error(`Patch d'équilibrage « ${name} » introuvable`);
  return patch.after;
};
const gardeAfter = (name: string): BalanceFields => {
  const patch = GARDE_PATCHES.find((p) => p.after.name === name);
  if (!patch) throw new Error(`Patch Garde « ${name} » introuvable`);
  return patch.after;
};

export const NOVEMBER_PATCHES: BalancePatch[] = [
  tweak(balanceAfter('Module Bluetooth .v2'), {
    description:
      "Sur Alpha : attaque 2 fois par tour. Sur Beta : à l'équipement, inflige une seule fois 600 dégâts à tous les monstres adverses. Sur Delta : +600 ATK. Sur Zeta : le virus retire 600 ATK aux monstres de l'hôte.",
  }),
  tweak(gardeAfter('Œuf Céleste'), {
    description:
      'Couvé par les étoiles. Après 3 tours, il éclot en Drakon Adulte de ton choix (deck ou cimetière ; à défaut un Jeune, puis un Bébé). En attendant, soigne tes Drakons de 200 PV au début de chacun de tes tours.',
  }),
];

export interface ChargeNewCard {
  name: string;
  rarity: Rarity;
  archetype: 'pipou' | 'pixelman' | 'dragon';
  /** Nom d'une carte du set visé : la nouvelle carte rejoint son set. */
  setOf: string;
  chargeMax: number;
  chargeMode: 'ONE_SHOT' | 'CYCLIC';
  description: string;
  effects: CardEffect[];
}

/** Rempli en Task 9. */
export const CHARGE_NEW_CARDS: ChargeNewCard[] = [];
```

Si `gardeAfter('Œuf Céleste')` ou `balanceAfter('Module Bluetooth .v2')` ne correspondent pas aux effets actuels (le spec du Step 1 échoue sur `before`), remonter la chaîne de patchs (`IMMUNITY_PATCHES`, `TEROS_PATCHES`, `ANCETRES_PATCHES`) pour trouver le dernier `after` de la carte et l'utiliser.

- [ ] **Step 4: Apply the patch in `real-cards.ts`**

Dans `allRealCards()`, envelopper le résultat final :

```ts
return withNovember(
  withSupportRework(withTeros([...withAncetres(cards), ...extensionCards(cards)])),
);
```

et ajouter :

```ts
/** Patch 2026-11 : textes clarifiés, puis cartes Charge. */
function withNovember(cards: Card[]): Card[] {
  const patched = cards.map((c) => {
    const patch = NOVEMBER_PATCHES.find((p) => p.before.name === c.name);
    return patch ? ({ ...c, description: patch.after.description, effects: patch.after.effects } as Card) : c;
  });
  const created = CHARGE_NEW_CARDS.map(
    (c, i) =>
      ({
        id: 93_001 + i,
        name: c.name,
        rarity: c.rarity,
        type: 'support',
        atk: 0,
        hp: 0,
        cost: 0,
        supportType: SupportType.CHARGE,
        equipmentSlot: null,
        isTerrain: false,
        chargeMax: c.chargeMax,
        chargeMode: c.chargeMode,
        archetype: c.archetype,
        effects: c.effects,
        description: c.description,
        element: null,
        lineage: null,
        stage: null,
        image: null,
        cardSet: patched.find((x) => x.name === c.setOf)?.cardSet,
      }) as Card,
  );
  return [...patched, ...created];
}
```

Importer `NOVEMBER_PATCHES` et `CHARGE_NEW_CARDS` depuis `../../database/cartes-2026-11-patches`.

- [ ] **Step 5: Create the migration**

```ts
// apps/backend/src/database/migrations/1791000000023-ChargeCardsNovember.ts
import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { applyBalancePatches } from '../apply-balance-patches';
import { CHARGE_NEW_CARDS, NOVEMBER_PATCHES } from '../cartes-2026-11-patches';

/** Textes clarifiés (Bluetooth, Œuf Céleste) et cartes Charge de novembre. */
export class ChargeCardsNovember1791000000023 implements MigrationInterface {
  name = 'ChargeCardsNovember1791000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('ChargeCardsNovember');
    await applyBalancePatches(queryRunner, NOVEMBER_PATCHES, 'up', logger);
    for (const c of CHARGE_NEW_CARDS) {
      const exists = (await queryRunner.query('SELECT `id` FROM `card` WHERE `name` = ?', [c.name])) as unknown[];
      if (exists.length > 0) continue;
      const [ref] = (await queryRunner.query('SELECT `card_set_id` FROM `card` WHERE `name` = ?', [c.setOf])) as {
        card_set_id: number;
      }[];
      if (!ref) {
        logger.warn(`${c.setOf} introuvable : « ${c.name} » non créée`);
        continue;
      }
      await queryRunner.query(
        'INSERT INTO `card` (`name`, `rarity`, `type`, `atk`, `hp`, `cost`, `support_type`, `charge_max`, `charge_mode`, `archetype`, `effects`, `description`, `card_set_id`) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?)',
        [c.name, c.rarity, 'support', 'CHARGE', c.chargeMax, c.chargeMode, c.archetype, JSON.stringify(c.effects), c.description, ref.card_set_id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('ChargeCardsNovember');
    for (const c of CHARGE_NEW_CARDS) {
      const rows = (await queryRunner.query('SELECT `id` FROM `card` WHERE `name` = ?', [c.name])) as { id: number }[];
      for (const { id } of rows) {
        const [{ used }] = (await queryRunner.query(
          'SELECT (SELECT COUNT(*) FROM `user_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `booster_open_card` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `bundle_content` WHERE `card_id` = ?) + (SELECT COUNT(*) FROM `adventure_opponent_card` WHERE `card_id` = ?) AS used',
          [id, id, id, id],
        )) as { used: number | string }[];
        if (Number(used) > 0) {
          logger.warn(`« ${c.name} » est référencée : non supprimée`);
          continue;
        }
        await queryRunner.query('DELETE FROM `card` WHERE `id` = ?', [id]);
      }
    }
    await applyBalancePatches(queryRunner, NOVEMBER_PATCHES, 'down', logger);
  }
}
```

Vérifier les noms de colonnes `charge_max` / `charge_mode` dans `1791000000022-SupportRework.ts` avant d'exécuter.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @pipou/backend test -- cartes-2026-11-patches migrations-columns real-cards`
Expected: PASS.

- [ ] **Step 7: Run the migration locally (base de dev uniquement)**

Run: `ENV_FILE=.env.dev.local pnpm --filter @pipou/backend migration:run` (vérifier le nom exact du script dans `apps/backend/package.json`). Ne jamais lancer sans `ENV_FILE=.env.dev.local`.
Expected: log sans avertissement « non modifiée ».

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/database/cartes-2026-11-patches.ts apps/backend/src/database/cartes-2026-11-patches.spec.ts apps/backend/src/database/migrations/1791000000023-ChargeCardsNovember.ts apps/backend/src/fights/testing/real-cards.ts
git commit -m "fix(cards): textes du Module Bluetooth .v2 et de l'Œuf Céleste clarifiés"
```

---

### Task 3: Afficher les tours restants des dégâts divisés

**Files:**
- Modify: `apps/frontend/src/features/fight/statusBadges.ts:67`
- Modify: `apps/frontend/src/features/fight/Zonerow/StatusBadges.tsx:71-74`
- Modify: `apps/frontend/src/features/fight/Zonerow/zoneRow.effects.tsx:82-88`
- Modify: `apps/frontend/src/i18n/locales/{fr,en,ko}.json` (clé `effects.status`)
- Test: `apps/frontend/src/__tests__/unit/statusBadges.test.ts`

**Interfaces:**
- Consumes: `MonsterOnBoard.reductionTurns?: number` (déjà dans `@pipou/shared`). Vérifier dans `apps/backend/src/fights/helpers/client-state.builder.ts` que le champ est bien envoyé au client ; sinon l'ajouter.

- [ ] **Step 1: Write the failing test** (ajouter dans `statusBadges.test.ts`, en suivant la fixture existante ligne 32)

```ts
it('le badge de réduction porte les tours restants', () => {
  const badges = monsterBadges(makeMonster({ damageReduction: 2, reductionTurns: 1 }));
  expect(badges.find((b) => b.id === 'reduce')?.count).toBe(1);
});
```

(`makeMonster` : utiliser le constructeur de fixture déjà employé dans ce fichier.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/frontend test -- statusBadges`
Expected: FAIL, `count` undefined.

- [ ] **Step 3: Implement**

`statusBadges.ts` ligne 67 :

```ts
if ((monster.damageReduction ?? 0) > 1)
  badges.push({ id: "reduce", count: monster.reductionTurns });
```

`StatusBadges.tsx`, cas `"reduce"` :

```tsx
case "reduce":
  return monster.reductionTurns
    ? t("effects.status.damageReductionTurns", {
        value: monster.damageReduction,
        count: monster.reductionTurns,
      })
    : t("effects.status.damageReduction", { value: monster.damageReduction });
```

Même logique pour le libellé dans `zoneRow.effects.tsx` lignes 85-87.

i18n, à côté de `damageReduction` dans `effects.status` :
- fr : `"damageReductionTurns_one": "Dégâts reçus ÷{{value}} (encore {{count}} tour)"`, `"damageReductionTurns_other": "Dégâts reçus ÷{{value}} (encore {{count}} tours)"`
- en : `"damageReductionTurns_one": "Damage taken ÷{{value}} ({{count}} turn left)"`, `"damageReductionTurns_other": "Damage taken ÷{{value}} ({{count}} turns left)"`
- ko : `"damageReductionTurns_other": "받는 피해 ÷{{value}} ({{count}}턴 남음)"`

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @pipou/frontend test -- statusBadges statusFx && pnpm --filter @pipou/frontend typecheck`
Expected: PASS.

- [ ] **Step 5: Visual check** — capture Playwright du plateau (shell clair 430 px) avec un Jeune Teros posé, selon la mémoire « Front visual check ». Le badge bouclier affiche « 2 », puis « 1 » au tour suivant.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/fight apps/frontend/src/i18n/locales apps/frontend/src/__tests__/unit/statusBadges.test.ts
git commit -m "feat(fight): tours restants des dégâts divisés sur le badge"
```

---

### Task 4: Double destruction — confirmer la cause (point d'arrêt)

**Files:**
- Test: `apps/backend/src/fights/engine/adjacent-hp-loss.spec.ts` (créé)

- [ ] **Step 1: Write the characterization test**

```ts
// apps/backend/src/fights/engine/adjacent-hp-loss.spec.ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { attackWith, scenario, seatState } from '../testing/scenario';

const engine = createEngine();

describe('Champion Ouille-Ouille : perte du bonus d’adjacence', () => {
  it('un Champion à 300 PV meurt quand son voisin Champion est détruit', () => {
    const champion = realCard('Champion Ouille-Ouille');
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Brute', { atk: 5000, hp: 9000 })] },
      p2: { monsters: [champion, champion] },
    });
    // Premier recalcul : chacun gagne +300 PV max grâce à l'autre
    engine.dispatch(game, 'p1', { type: 'end_phase' }); // battle → end : déclenche settle
    const [first, second] = seatState(game, 'p2').monsterZones;
    second!.currentHp = 300;
    game.phase = 'battle';
    expect(attackWith(engine, game, 'p1', 'Brute', 'Champion Ouille-Ouille').error).toBeUndefined();
    expect(first && seatState(game, 'p2').monsterZones.includes(first)).toBe(false);
    expect(seatState(game, 'p2').monsterZones.every((m) => m === null)).toBe(true);
  });
});
```

Si la mise en place de phase ne convient pas au moteur (erreur « Phase de combat uniquement »), partir de `phase: 'main'` et passer en combat avec un `end_phase`, comme dans `combat.spec.ts`.

- [ ] **Step 2: Run it**

Run: `pnpm --filter @pipou/backend test -- adjacent-hp-loss`
Expected: PASS, cause confirmée. Si FAIL (le second Champion survit), l'hypothèse est fausse : retour à l'investigation (superpowers:systematic-debugging) avant tout correctif.

- [ ] **Step 3: STOP — demander la décision à l'utilisateur**

Présenter le résultat et les deux options : (a) garder la règle actuelle (le test reste comme documentation) ; (b) une perte de bonus de PV ne fait jamais tomber sous 1 PV (changer l'étape 5 de `buffs-calculator.service.ts:159-166` en `Math.max(1, …)` quand `m.currentHp > 0` avant le recalcul, et inverser l'attente du test). Ne rien coder avant la réponse.

- [ ] **Step 4: Commit** (après décision)

```bash
git add apps/backend/src/fights/engine/adjacent-hp-loss.spec.ts
git commit -m "test(fights): perte du bonus d'adjacence du Champion Ouille-Ouille"
```

---

# Partie B — Moteur et nouvelles cartes

### Task 5: Charge cyclique

**Files:**
- Modify: `apps/backend/src/fights/helpers/charges.ts:35-45`
- Modify: `apps/backend/src/fights/services/support.service.ts:190-194`
- Test: `apps/backend/src/fights/engine/charges.spec.ts:77-90`

**Interfaces:**
- Produces: une Charge `CYCLIC` reste sur sa case, compteur remis à 0 après `ON_CHARGED`.

- [ ] **Step 1: Replace the « refusé » test with behaviour tests**

Remplacer le test `'mode cyclique refusé'` par :

```ts
it('cyclique : posable', () => {
  const game = scenario({ p1: { hand: [chargeCard('Cycle', 2, [draw2], { chargeMode: ChargeMode.CYCLIC })] } });
  expect(engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, zoneIndex: 0 }).error).toBeUndefined();
});

it('cyclique : se déclenche, reste en place et repart de 0', () => {
  const game = scenario({ p1: { supports: [chargeCard('Cycle', 2, [draw2], { chargeMode: ChargeMode.CYCLIC })] } });
  game.player1.supportZones[0]!.chargeCounters = 1;
  const handBefore = game.player1.hand.length;
  passTurns(game, 1);
  expect(game.player1.supportZones[0]?.baseCard.name).toBe('Cycle');
  expect(game.player1.supportZones[0]?.chargeCounters).toBe(0);
  expect(game.player1.hand.length).toBe(handBefore + 1 + 2);
  passTurns(game, 2);
  expect(game.player1.hand.length).toBe(handBefore + 1 + 2 + 2 + 2);
});
```

Importer `ChargeMode` depuis `@pipou/shared`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/backend test -- charges`
Expected: FAIL, « Mode de charge cyclique pas encore disponible ».

- [ ] **Step 3: Implement**

`support.service.ts` : supprimer le bloc lignes 190-194 (refus du cyclique) et l'import de `ChargeMode` s'il devient inutile.

`charges.ts`, remplacer la fin de `addChargeCounters` (à partir de `player.supportZones[zoneIndex] = null;`) :

```ts
  if (charge.baseCard.chargeMode === ChargeMode.CYCLIC) {
    // Cyclique : l'effet se joue, la carte reste et recommence à 0
    charge.chargeCounters = 0;
    resolveCharged(charge);
    return;
  }
  player.supportZones[zoneIndex] = null;
  resolveCharged(charge);
  sendToGraveyard(player, charge);
}
```

Mettre à jour le commentaire d'en-tête : « (ONE_SHOT) ; une Charge CYCLIC reste en place et repart de 0 ». Importer `ChargeMode`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @pipou/backend test -- charges support-placement`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/fights/helpers/charges.ts apps/backend/src/fights/services/support.service.ts apps/backend/src/fights/engine/charges.spec.ts
git commit -m "feat(fights): charges cycliques"
```

---

### Task 6: Types partagés — actions, résolutions de choix, consignes

**Files:**
- Modify: `packages/shared/src/enums/effect.ts:80`
- Modify: `packages/shared/src/game/effect-schema.ts:115`
- Modify: `packages/shared/src/game/state.ts:21-38`
- Modify: `apps/backend/src/fights/engine/supported-effects.ts`
- Modify: `apps/backend/src/fights/interfaces/game-state.interface.ts:65-80`
- Test: `packages/shared/src/game/effect-schema.test.ts`, `packages/shared/src/enums/enums.test.ts`

**Interfaces:**
- Produces:
  - `ActionType.GRANT_EXTRA_ATTACK` (`"GRANT_EXTRA_ATTACK"`), schéma `s(ALLIES, "value")`.
  - `ActionType.TRANSFER_HALF_ATK` (`"TRANSFER_HALF_ATK"`), schéma `s(PLAYER_ONLY, "filter")` : `filter` décrit le receveur (Noyau Pixelman).
  - `ActionType.FORCE_EVOLVE` (`"FORCE_EVOLVE"`), schéma `s(PLAYER_ONLY, "filter")` : `filter` restreint les monstres éligibles (archétype dragon).
  - `ActionType.REQUIRES_CARD_ON_BOARD` (`"REQUIRES_CARD_ON_BOARD"`), schéma `s(SELF_ONLY, "filter")`.
  - `PendingChoiceResolution` += `"transfer_atk_source" | "transfer_atk_target" | "force_evolve"`.
  - `ChoicePromptKey` += `"extract_source" | "extract_target" | "meditate"`.
  - `PendingChoice` (backend) += `amount?: number` (ATK à transférer) et `filter?: EffectFilter` (receveurs).

- [ ] **Step 1: Write the failing test** (dans `effect-schema.test.ts`)

```ts
it('nouvelles actions des cartes Charge', () => {
  expect(ACTION_SCHEMA[ActionType.GRANT_EXTRA_ATTACK].targets).toContain(EffectTarget.ALL_ALLIES);
  expect(ACTION_SCHEMA[ActionType.TRANSFER_HALF_ATK].targets).toEqual([EffectTarget.PLAYER]);
  expect(ACTION_SCHEMA[ActionType.FORCE_EVOLVE].fields).toContain('filter');
  expect(ACTION_SCHEMA[ActionType.REQUIRES_CARD_ON_BOARD].targets).toEqual([EffectTarget.SELF]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/shared test -- effect-schema`
Expected: FAIL (propriétés inconnues).

- [ ] **Step 3: Implement**

`enums/effect.ts`, après `ADD_CHARGE_COUNTERS` :

```ts
  GRANT_EXTRA_ATTACK: "GRANT_EXTRA_ATTACK",
  TRANSFER_HALF_ATK: "TRANSFER_HALF_ATK",
  FORCE_EVOLVE: "FORCE_EVOLVE",
  REQUIRES_CARD_ON_BOARD: "REQUIRES_CARD_ON_BOARD",
```

`effect-schema.ts`, après `ADD_CHARGE_COUNTERS` :

```ts
  [A.GRANT_EXTRA_ATTACK]: s(ALLIES, "value"),
  [A.TRANSFER_HALF_ATK]: s(PLAYER_ONLY, "filter"),
  [A.FORCE_EVOLVE]: s(PLAYER_ONLY, "filter"),
  [A.REQUIRES_CARD_ON_BOARD]: s(SELF_ONLY, "filter"),
```

`state.ts` :

```ts
/**
 * - 'pick_to_hand'        : récupère depuis le cimetière ou le deck
 * - 'discard'             : défausse depuis la main
 * - 'transfer_atk_source' : monstre dont la moitié de l'ATK est prise
 * - 'transfer_atk_target' : Noyau allié qui la reçoit
 * - 'force_evolve'        : Drakon allié qui évolue sans carte
 */
export type PendingChoiceResolution =
  | "pick_to_hand"
  | "discard"
  | "summon_to_zone"
  | "copy_effects"
  | "transfer_atk_source"
  | "transfer_atk_target"
  | "force_evolve";
```

et ajouter `| "extract_source" | "extract_target" | "meditate"` à `ChoicePromptKey`.

`game-state.interface.ts`, dans `PendingChoice` :

```ts
  /** transfer_atk_target : ATK prise au monstre source. */
  amount?: number;
  /** transfer_atk_target : monstre qui perd l'ATK. */
  fromInstanceId?: string;
  /** transfer_atk_source : filtre des receveurs (Noyaux). */
  filter?: EffectFilter;
```

(importer `EffectFilter` depuis `@pipou/shared`).

`supported-effects.ts` : ajouter les 4 nouveaux `ActionType` à la liste des actions supportées.

- [ ] **Step 4: Build shared and typecheck**

Run: `pnpm build:shared && pnpm --filter @pipou/shared test && pnpm typecheck`
Expected: le typecheck front échoue sur les `Record<PendingChoiceResolution, string>` de `CardPickModal.tsx` : normal, corrigé en Task 10. Le reste passe.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src apps/backend/src/fights/engine/supported-effects.ts apps/backend/src/fights/interfaces/game-state.interface.ts
git commit -m "feat(shared): actions et choix des cartes Charge"
```

---

### Task 7: Choix sur le terrain — attaque supplémentaire et transfert d'ATK

**Files:**
- Modify: `apps/backend/src/fights/effects/effect-actions.applier.ts`
- Modify: `apps/backend/src/fights/services/pick.service.ts`
- Modify: `apps/backend/src/fights/helpers/game-state.helper.ts:66-67`
- Modify: `apps/backend/src/fights/services/phase.service.ts:155-159`
- Test: `apps/backend/src/fights/engine/charge-actions.spec.ts` (créé)

**Interfaces:**
- Consumes: `ActionType.GRANT_EXTRA_ATTACK`, `ActionType.TRANSFER_HALF_ATK`, résolutions `transfer_atk_source` / `transfer_atk_target`, `PendingChoice.amount` / `fromInstanceId` / `filter` (Task 6).
- Produces: choix `board` couvrant les deux camps dans `freshCandidates`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/backend/src/fights/engine/charge-actions.spec.ts
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { act, chargeCard, effect, monsterCard } from '../testing/cards';
import { createEngine } from '../testing/engine';
import { effectiveAtk } from '../helpers/game-state.helper';
import { monsterNamed, passTurn, scenario } from '../testing/scenario';

const engine = createEngine();
const passTurns = (game: ReturnType<typeof scenario>, n: number) => {
  for (let i = 0; i < n; i++) {
    passTurn(engine, game);
    passTurn(engine, game);
  }
};
const pick = (game: ReturnType<typeof scenario>, name: string) => {
  const c = game.pendingChoices[0].candidates.find((x) => x.baseCard.name === name)!;
  return engine.dispatch(game, 'p1', { type: 'pick', instanceIds: [c.instanceId] });
};

describe('actions des cartes Charge', () => {
  it('GRANT_EXTRA_ATTACK : une attaque de plus ce tour', () => {
    const charge = chargeCard('Alerte', 1, [
      effect(EffectTrigger.ON_CHARGED, [act(ActionType.GRANT_EXTRA_ATTACK, EffectTarget.ALL_ALLIES, { value: 1 })]),
    ]);
    const game = scenario({ p1: { supports: [charge], monsters: [monsterCard('Soldat')] } });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(monsterNamed(game, 'p1', 'Soldat').extraAttacksThisTurn).toBe(1);
  });

  it('TRANSFER_HALF_ATK : la moitié de l’ATK d’un monstre passe à un Noyau ce tour', () => {
    const charge = chargeCard('Extraction', 1, [
      effect(EffectTrigger.ON_CHARGED, [
        act(ActionType.TRANSFER_HALF_ATK, EffectTarget.PLAYER, { filter: { name: 'Noyau', archetype: 'pixelman' } }),
      ]),
    ]);
    const game = scenario({
      p1: { supports: [charge], monsters: [monsterCard('Noyau Alpha', { atk: 500, archetype: 'pixelman' })] },
      p2: { monsters: [monsterCard('Colosse', { atk: 1000 })] },
    });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(game.pendingChoices[0].candidates.map((c) => c.baseCard.name).sort()).toEqual(['Colosse', 'Noyau Alpha']);
    expect(pick(game, 'Colosse').error).toBeUndefined();
    expect(pick(game, 'Noyau Alpha').error).toBeUndefined();
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Colosse'))).toBe(500);
    expect(effectiveAtk(monsterNamed(game, 'p1', 'Noyau Alpha'))).toBe(1000);
    passTurn(engine, game);
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Colosse'))).toBe(1000);
  });

  it('TRANSFER_HALF_ATK : rien sans Noyau allié', () => {
    const charge = chargeCard('Extraction', 1, [
      effect(EffectTrigger.ON_CHARGED, [
        act(ActionType.TRANSFER_HALF_ATK, EffectTarget.PLAYER, { filter: { name: 'Noyau', archetype: 'pixelman' } }),
      ]),
    ]);
    const game = scenario({ p1: { supports: [charge] }, p2: { monsters: [monsterCard('Colosse', { atk: 1000 })] } });
    game.player1.supportZones[0]!.chargeCounters = 0;
    passTurns(game, 1);
    expect(game.pendingChoices).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/backend test -- charge-actions`
Expected: FAIL.

- [ ] **Step 3: `freshCandidates` covers both sides**

`game-state.helper.ts`, cas `'board'` :

```ts
      case 'board':
        // Les choix sur le terrain peuvent viser les deux camps (ex. Extraction)
        return [game.player1, game.player2].flatMap((p) =>
          p.monsterZones.flatMap((m) => (m ? [m.instanceId] : [])),
        );
```

- [ ] **Step 4: Applier cases**

Dans `effect-actions.applier.ts`, avant `// ── Interactive picks`, ajouter :

```ts
      case ActionType.GRANT_EXTRA_ATTACK:
        for (const m of targets.monsters) {
          m.extraAttacksThisTurn += action.value ?? 1;
          ctx.log.push(`🏹 ${m.card.baseCard.name} peut attaquer une fois de plus ce tour`);
        }
        break;

      // Extraction de données : choisir le monstre ponctionné, puis le Noyau receveur
      case ActionType.TRANSFER_HALF_ATK:
        for (const p of targets.players) {
          const receivers = p.monsterZones.filter(
            (m): m is MonsterOnBoard =>
              !!m && !isImplanted(m, p.userId) && matchesFilter(m.card, action.filter),
          );
          if (receivers.length === 0) {
            ctx.log.push(`📡 ${card.baseCard.name} — aucun receveur en jeu`);
            continue;
          }
          const opponent = getOpponentState(ctx.game, p.userId);
          const sources = [
            ...p.monsterZones.filter((m): m is MonsterOnBoard => !!m && !isImplanted(m, p.userId)),
            ...opponent.monsterZones.filter(
              (m): m is MonsterOnBoard =>
                !!m && !isPlantedBy(m, p.userId) && isTargetableByEnemyEffects(m, 'support', action.type),
            ),
          ].filter((m) => effectiveAtk(m) > 1);
          if (sources.length === 0) continue;
          queueChoice(ctx.game, {
            forUserId: p.userId,
            candidates: sources.map((m) => ({ instanceId: m.instanceId, baseCard: m.card.baseCard, source: 'board' as const })),
            count: 1,
            prompt: "Choisis le monstre dont tu extrais la moitié de l'ATK",
            promptKey: 'extract_source',
            resolution: 'transfer_atk_source',
            filter: action.filter,
          });
        }
        break;
```

Imports à ajouter : `isTargetableByEnemyEffects` (`@pipou/shared`), `effectiveAtk` (`../helpers/game-state.helper`), `matchesFilter` (`./pick-candidates`). `PendingChoice.filter` vient de la Task 6.

- [ ] **Step 5: Pick resolutions**

Dans `pick.service.ts`, avant le `else` final, ajouter :

```ts
    } else if (choice.resolution === 'transfer_atk_source') {
      const source = boardMonster(game, picked[0]);
      if (source) {
        const amount = Math.floor(effectiveAtk(source) / 2);
        const receivers = player.monsterZones.filter(
          (m): m is MonsterOnBoard =>
            !!m && m !== source && !isImplanted(m, userId) && matchesFilter(m.card, choice.filter),
        );
        if (receivers.length > 0)
          game.pendingChoices.splice(1, 0, {
            forUserId: userId,
            candidates: receivers.map((m) => ({ instanceId: m.instanceId, baseCard: m.card.baseCard, source: 'board' as const })),
            count: 1,
            prompt: `Choisis le Noyau qui reçoit ${amount} ATK`,
            promptKey: 'extract_target',
            promptParams: { amount },
            resolution: 'transfer_atk_target',
            amount,
            fromInstanceId: source.instanceId,
          });
      }
    } else if (choice.resolution === 'transfer_atk_target') {
      const source = choice.fromInstanceId ? boardMonster(game, choice.fromInstanceId) : undefined;
      const target = boardMonster(game, picked[0]);
      if (source && target && choice.amount) {
        source.tempAtkBuff = (source.tempAtkBuff ?? 0) - choice.amount;
        target.tempAtkBuff = (target.tempAtkBuff ?? 0) + choice.amount;
        addLog(game, `📡 ${target.card.baseCard.name} extrait ${choice.amount} ATK de ${source.card.baseCard.name} ce tour`);
      }
```

et dans `game-state.helper.ts` :

```ts
/** Monstre en jeu, dans l'un ou l'autre camp. */
export function boardMonster(game: GameState, instanceId: string): MonsterOnBoard | undefined {
  for (const p of [game.player1, game.player2])
    for (const m of p.monsterZones) if (m?.instanceId === instanceId) return m;
  return undefined;
}
```

`tempAtkBuff` est remis à 0 pour les deux camps à la fin de chaque tour (`phase.service.ts:181-183`) : l'effet dure bien « ce tour ».

- [ ] **Step 6: Double attaque différée cumulable**

`phase.service.ts:157` : remplacer `m.extraAttacksThisTurn = 1;` par `m.extraAttacksThisTurn += 1;`, pour qu'une attaque gagnée par une Charge au début du tour ne soit pas écrasée.

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @pipou/backend test -- charge-actions charges choices combat turn-cycle`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/fights
git commit -m "feat(fights): attaque supplémentaire et extraction d'ATK"
```

---

### Task 8: Évolution sans carte (FORCE_EVOLVE) et support exigeant une carte

**Files:**
- Create: `apps/backend/src/fights/helpers/evolution-catalog.ts`
- Create: `apps/backend/src/fights/helpers/evolution.ts`
- Create: `apps/backend/src/fights/helpers/support-requirements.ts`
- Create: `apps/backend/src/fights/services/evolution-catalog.loader.ts`
- Modify: `apps/backend/src/fights/services/evolution.service.ts:94-136`
- Modify: `apps/backend/src/fights/fights.module.ts` (provider du loader)
- Modify: `apps/backend/src/fights/effects/effect-actions.applier.ts`
- Modify: `apps/backend/src/fights/services/pick.service.ts`
- Modify: `apps/backend/src/fights/services/support.service.ts:177-190`
- Modify: `apps/backend/src/fights/engine/game-engine.ts:137-149`
- Modify: `apps/backend/src/fights/testing/engine.ts` (catalogue de test)
- Test: `apps/backend/src/fights/engine/charge-actions.spec.ts`

**Interfaces:**
- Produces:
  - `setEvolutionCatalog(cards: Card[]): void`, `nextStageCard(base: MonsterOnBoard): Card | undefined`.
  - `evolveInPlace(game, player, zoneIndex, evolvedCard: CardInstance, resolveSummon: (m: MonsterOnBoard) => void, log: string[]): MonsterOnBoard`.
  - `missingRequirement(card: CardInstance, owner: PlayerGameState): string | null` (nom de la carte manquante).

- [ ] **Step 1: Write the failing tests** (ajouter à `charge-actions.spec.ts`)

```ts
import { realCard } from '../testing/real-cards';
import { persistentCard } from '../testing/cards';

it('FORCE_EVOLVE : un Drakon choisi évolue sans carte en main ni dans le deck', () => {
  const charge = chargeCard('Méditation', 1, [
    effect(EffectTrigger.ON_CHARGED, [act(ActionType.FORCE_EVOLVE, EffectTarget.PLAYER, { filter: { archetype: 'dragon' } })]),
  ]);
  const game = scenario({ p1: { supports: [charge], monsters: [realCard('Adulte Teros')] } });
  game.player1.supportZones[0]!.chargeCounters = 0;
  passTurns(game, 1);
  expect(pick(game, 'Adulte Teros').error).toBeUndefined();
  expect(monsterNamed(game, 'p1', 'Ancestral Teros')).toBeDefined();
  expect(game.player1.hand.map((c) => c.baseCard.name)).not.toContain('Ancestral Teros');
});

it('FORCE_EVOLVE : un Ancestral ne fait pas partie des choix', () => {
  const charge = chargeCard('Méditation', 1, [
    effect(EffectTrigger.ON_CHARGED, [act(ActionType.FORCE_EVOLVE, EffectTarget.PLAYER, { filter: { archetype: 'dragon' } })]),
  ]);
  const game = scenario({ p1: { supports: [charge], monsters: [realCard('Ancestral Teros')] } });
  game.player1.supportZones[0]!.chargeCounters = 0;
  passTurns(game, 1);
  expect(game.pendingChoices).toEqual([]);
});

it('REQUIRES_CARD_ON_BOARD : refusé sans la carte, détruit quand elle part', () => {
  const alerte = chargeCard('Alerte', 3, [
    effect(EffectTrigger.PASSIVE, [act(ActionType.REQUIRES_CARD_ON_BOARD, EffectTarget.SELF, { filter: { name: 'Général Chatouille' } })]),
  ]);
  const seul = scenario({ p1: { hand: [alerte] } });
  expect(engine.dispatch(seul, 'p1', { type: 'play_support', handIndex: 0, zoneIndex: 0 }).error).toBe(
    'Il faut Général Chatouille sur le terrain',
  );

  const game = scenario({ p1: { hand: [alerte], monsters: [monsterCard('Général Chatouille')] } });
  expect(engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, zoneIndex: 0 }).error).toBeUndefined();
  game.player1.monsterZones[0]!.currentHp = 0;
  engine.dispatch(game, 'p1', { type: 'end_phase' }); // settle : le Général succombe, l'Alerte suit
  expect(game.player1.supportZones[0]).toBeNull();
  expect(game.player1.graveyard.map((c) => c.baseCard.name)).toContain('Alerte');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/backend test -- charge-actions`
Expected: FAIL.

- [ ] **Step 3: Evolution catalog**

```ts
// apps/backend/src/fights/helpers/evolution-catalog.ts
import { canEvolveOnto } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import type { MonsterOnBoard } from '../interfaces/game-state.interface';

/**
 * Cartes d'évolution utilisables sans les posséder (Méditation céleste).
 * Chargé au démarrage par EvolutionCatalogLoader ; vide dans un outil hors Nest.
 */
let catalog: Card[] = [];

export function setEvolutionCatalog(cards: Card[]): void {
  catalog = cards.filter((c) => c.stage && c.lineage);
}

/** Stade suivant de la lignée du monstre, s'il existe. */
export function nextStageCard(base: MonsterOnBoard): Card | undefined {
  return catalog.find((c) => canEvolveOnto(c, { ...base, evolutionJoker: false }));
}
```

```ts
// apps/backend/src/fights/services/evolution-catalog.loader.ts
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DrakonStage } from '@pipou/shared';
import { Card } from '../../cards/card.entity';
import { setEvolutionCatalog } from '../helpers/evolution-catalog';

/** Charge les Jeunes, Adultes et Ancestraux pour l'évolution sans carte. */
@Injectable()
export class EvolutionCatalogLoader implements OnApplicationBootstrap {
  constructor(@InjectRepository(Card) private cards: Repository<Card>) {}

  async onApplicationBootstrap(): Promise<void> {
    setEvolutionCatalog(
      await this.cards.find({
        where: { stage: In([DrakonStage.YOUNG, DrakonStage.ADULT, DrakonStage.ANCESTRAL]) },
      }),
    );
  }
}
```

L'enregistrer dans `providers` de `fights.module.ts` (vérifier que `TypeOrmModule.forFeature([Card, …])` y est déjà, sinon l'ajouter). Une carte d'évolution modifiée par l'admin n'est prise en compte qu'au redémarrage : à signaler dans la PR.

Dans `apps/backend/src/fights/testing/engine.ts`, appeler `setEvolutionCatalog(allRealCards())` dans `createEngine()`.

- [ ] **Step 4: Extract `evolveInPlace`**

```ts
// apps/backend/src/fights/helpers/evolution.ts
import type { CardInstance, GameState, MonsterOnBoard, PlayerGameState } from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from './monster.factory';
import { boardCard, sendToGraveyard } from './game-state.helper';
import { evolvedHp } from '../services/evolution.service';

/** Remplace le monstre de la zone par son évolution, en gardant équipements, Garde et attaques du tour. */
export function evolveInPlace(
  game: GameState,
  player: PlayerGameState,
  zoneIndex: number,
  evolvedCard: CardInstance,
  log: string[],
): MonsterOnBoard {
  const base = player.monsterZones[zoneIndex]!;
  const evolved = createMonsterOnBoard(evolvedCard, { ownerUserId: base.ownerUserId });
  evolved.equipments = base.equipments;
  evolved.currentHp = evolvedHp(base, evolvedCard.baseCard.hp);
  evolved.mode = base.mode;
  evolved.guardTurns = base.guardTurns;
  evolved.guardLocked = base.guardLocked;
  evolved.guardCooldown = base.guardCooldown;
  evolved.summonedThisTurn = true;
  evolved.attacksUsedThisTurn = base.attacksUsedThisTurn;
  evolved.hasAttackedThisTurn = base.hasAttackedThisTurn;
  sendToGraveyard(player, boardCard(base));
  player.monsterZones[zoneIndex] = evolved;
  game.pendingEvents.push({
    kind: 'monster_summoned',
    ownerId: player.userId,
    zoneIndex,
    instanceId: evolved.instanceId,
    rarity: evolvedCard.baseCard.rarity,
  });
  log.push(`🧬 ${base.card.baseCard.name} évolue en ${evolvedCard.baseCard.name}`);
  return evolved;
}
```

Si `evolvedHp` importé depuis le service crée un cycle d'import, déplacer `evolvedHp` et `EVOLUTION_MIN_HP_RATIO` dans `helpers/evolution.ts` et les réexporter depuis `evolution.service.ts`.

Dans `EvolutionService.evolve`, remplacer les lignes 94-121 par :

```ts
    const log: string[] = [];
    const evolved = evolveInPlace(game, player, zoneIndex, evolvedCard, log);
```

et garder la suite (résolution `ON_SUMMON` et `ON_ALLY_SUMMON` sur `evolved`, puis `log.forEach(addLog)`). Lancer `pnpm --filter @pipou/backend test -- evolution drakon ancestral` : tout doit rester vert.

- [ ] **Step 5: FORCE_EVOLVE in the applier**

```ts
      // Méditation céleste : un Drakon allié choisi évolue, sans carte
      case ActionType.FORCE_EVOLVE:
        for (const p of targets.players) {
          const eligible = p.monsterZones.filter(
            (m): m is MonsterOnBoard =>
              !!m && !isImplanted(m, p.userId) && matchesFilter(m.card, action.filter) && !!nextStageCard(m),
          );
          if (eligible.length === 0) {
            ctx.log.push(`🧘 ${card.baseCard.name} — aucun Drakon ne peut évoluer`);
            continue;
          }
          queueChoice(ctx.game, {
            forUserId: p.userId,
            candidates: eligible.map((m) => ({ instanceId: m.instanceId, baseCard: m.card.baseCard, source: 'board' as const })),
            count: 1,
            prompt: 'Choisis le Drakon qui évolue',
            promptKey: 'meditate',
            resolution: 'force_evolve',
          });
        }
        break;
```

Résolution dans `pick.service.ts` :

```ts
    } else if (choice.resolution === 'force_evolve') {
      const zoneIndex = player.monsterZones.findIndex((m) => m?.instanceId === picked[0]);
      const base = player.monsterZones[zoneIndex];
      const next = base ? nextStageCard(base) : undefined;
      if (base && next) {
        // Carte créée de rien : jeton, elle ne rejoint ni la main ni le cimetière
        const card = { instanceId: uuidv4(), baseCard: next, ownerId: userId, token: true };
        const log: string[] = [];
        const evolved = evolveInPlace(game, player, zoneIndex, card, log);
        this.summon.resolveSummoned(game, player, evolved, log);
        log.forEach((l) => addLog(game, l));
      }
```

`this.summon.resolveSummoned` : réutiliser la méthode de `SummonService` qui déclenche `ON_SUMMON` puis `ON_ALLY_SUMMON` (lire `summon.service.ts` pour son nom exact ; si elle n'existe pas, l'extraire de `summonFromDeck` dans ce même step).

- [ ] **Step 6: Supports exigeant une carte**

```ts
// apps/backend/src/fights/helpers/support-requirements.ts
import { ActionType, EffectTrigger, isImplanted } from '@pipou/shared';
import type { CardInstance, PlayerGameState } from '../interfaces/game-state.interface';
import { matchesFilter } from '../effects/pick-candidates';

/** Nom de la carte exigée par le support et absente du terrain de son propriétaire, sinon null. */
export function missingRequirement(card: CardInstance, owner: PlayerGameState): string | null {
  for (const e of card.baseCard.effects ?? []) {
    if (e.trigger !== EffectTrigger.PASSIVE) continue;
    for (const a of e.actions) {
      if (a.type !== ActionType.REQUIRES_CARD_ON_BOARD) continue;
      const present = owner.monsterZones.some(
        (m) => !!m && !isImplanted(m, owner.userId) && matchesFilter(m.card, a.filter),
      );
      if (!present) return a.filter?.name ?? 'une carte précise';
    }
  }
  return null;
}
```

`support.service.ts`, branche `PERSISTENT` / `CHARGE`, après le test `placement.kind === 'full'` :

```ts
        const missing = missingRequirement(support, player);
        if (missing) return undo(`Il faut ${missing} sur le terrain`);
```

`game-engine.ts`, dans `settle`, après `this.reapDeadMonsters(game);` :

```ts
    this.reapOrphanSupports(game);
```

et :

```ts
  /** Un support qui exige une carte en jeu part au cimetière quand elle disparaît. */
  private reapOrphanSupports(game: GameState): void {
    for (const player of [game.player1, game.player2])
      player.supportZones.forEach((s, i) => {
        if (!s || !missingRequirement(s, player)) return;
        player.supportZones[i] = null;
        sendToGraveyard(player, s);
        addLog(game, `💨 ${s.baseCard.name} se dissipe`);
      });
  }
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @pipou/backend test -- charge-actions evolution drakon ancestral support-placement persistents`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/fights
git commit -m "feat(fights): évolution sans carte et supports liés à une carte en jeu"
```

---

### Task 9: Les trois cartes Charge

**Files:**
- Modify: `apps/backend/src/database/cartes-2026-11-patches.ts` (`CHARGE_NEW_CARDS`)
- Modify: `apps/backend/src/database/cartes-2026-11-patches.spec.ts`
- Test: `apps/backend/src/fights/engine/charge-real-cards.spec.ts` (créé)

**Interfaces:**
- Consumes: Tasks 5 à 8.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/backend/src/fights/engine/charge-real-cards.spec.ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import { effectiveAtk } from '../helpers/game-state.helper';
import { monsterNamed, passTurn, scenario } from '../testing/scenario';

const engine = createEngine();
const passTurns = (game: ReturnType<typeof scenario>, n: number) => {
  for (let i = 0; i < n; i++) {
    passTurn(engine, game);
    passTurn(engine, game);
  }
};
const pick = (game: ReturnType<typeof scenario>, name: string) => {
  const c = game.pendingChoices[0].candidates.find((x) => x.baseCard.name === name)!;
  return engine.dispatch(game, 'p1', { type: 'pick', instanceIds: [c.instanceId] });
};

describe('cartes Charge de novembre', () => {
  it('Alerte générale : après 3 tours, chaque allié attaque une fois de plus, puis cimetière', () => {
    const game = scenario({ p1: { hand: [realCard('Alerte générale')], monsters: [realCard('Général Chatouille')] } });
    expect(engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, zoneIndex: 0 }).error).toBeUndefined();
    passTurns(game, 3);
    expect(monsterNamed(game, 'p1', 'Général Chatouille').extraAttacksThisTurn).toBe(1);
    expect(game.player1.supportZones[0]).toBeNull();
  });

  it('Extraction de données : cyclique toutes les 2 charges', () => {
    const game = scenario({
      p1: { supports: [realCard('Extraction de données')], monsters: [realCard('Noyau Alpha')] },
      p2: { monsters: [monsterCard('Colosse', { atk: 1000 })] },
    });
    game.player1.supportZones[0]!.chargeCounters = 1;
    passTurns(game, 1);
    expect(pick(game, 'Colosse').error).toBeUndefined();
    expect(pick(game, 'Noyau Alpha').error).toBeUndefined();
    expect(effectiveAtk(monsterNamed(game, 'p2', 'Colosse'))).toBe(500);
    expect(game.player1.supportZones[0]?.chargeCounters).toBe(0);
  });

  it('Méditation céleste : un Adulte devient Ancestral', () => {
    const game = scenario({ p1: { supports: [realCard('Méditation céleste')], monsters: [realCard('Adulte Feros')] } });
    game.player1.supportZones[0]!.chargeCounters = 2;
    passTurns(game, 1);
    expect(pick(game, 'Adulte Feros').error).toBeUndefined();
    expect(monsterNamed(game, 'p1', 'Ancestral Feros')).toBeDefined();
    expect(game.player1.supportZones[0]).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/backend test -- charge-real-cards`
Expected: FAIL, « Carte « Alerte générale » absente de l'instantané ».

- [ ] **Step 3: Define the cards**

Dans `cartes-2026-11-patches.ts`, remplacer `CHARGE_NEW_CARDS` (importer `a`, `fx` depuis `./balance-2026-10-patches`) :

```ts
export const CHARGE_NEW_CARDS: ChargeNewCard[] = [
  {
    name: 'Alerte générale',
    rarity: 'legendary',
    archetype: 'pipou',
    setOf: 'Général Chatouille',
    chargeMax: 3,
    chargeMode: 'ONE_SHOT',
    description:
      'Le Général sonne le rassemblement. Se pose seulement avec Général Chatouille sur le terrain et se dissipe s’il le quitte. Après 3 tours : tes monstres attaquent une fois de plus ce tour.',
    effects: [
      fx('PASSIVE', [a('REQUIRES_CARD_ON_BOARD', 'SELF', { filter: { name: 'Général Chatouille' } })]),
      fx('ON_CHARGED', [a('GRANT_EXTRA_ATTACK', 'ALL_ALLIES', { value: 1 })]),
    ],
  },
  {
    name: 'Extraction de données',
    rarity: 'epic',
    archetype: 'pixelman',
    setOf: 'Noyau Alpha',
    chargeMax: 2,
    chargeMode: 'CYCLIC',
    description:
      "Siphon réseau. Tous les 2 tours : prends la moitié de l'ATK d'un monstre de ton choix et donne-la à un de tes Noyaux pour ce tour.",
    effects: [
      fx('ON_CHARGED', [a('TRANSFER_HALF_ATK', 'PLAYER', { filter: { name: 'Noyau', archetype: 'pixelman' } })]),
    ],
  },
  {
    name: 'Méditation céleste',
    rarity: 'epic',
    archetype: 'dragon',
    setOf: 'Bébé Teros',
    chargeMax: 3,
    chargeMode: 'ONE_SHOT',
    description:
      "L'esprit précède les écailles. Après 3 tours : un de tes Drakons évolue au stade suivant, sans avoir besoin de la carte.",
    effects: [fx('ON_CHARGED', [a('FORCE_EVOLVE', 'PLAYER', { filter: { archetype: 'dragon' } })])],
  },
];
```

Vérifier que `fx('ON_CHARGED', …)` est accepté par le type de `fx` (déclencheur `CardEffect['trigger']`).

- [ ] **Step 4: Validate schema in the patch spec**

Ajouter à `cartes-2026-11-patches.spec.ts` :

```ts
import { SupportType, validateEffects } from '@pipou/shared';
import { CHARGE_NEW_CARDS } from './cartes-2026-11-patches';

it('cartes Charge valides pour le schéma d’effets', () => {
  for (const c of CHARGE_NEW_CARDS) expect(validateEffects(SupportType.CHARGE, c.effects)).toEqual([]);
});
```

- [ ] **Step 5: Run the whole backend suite**

Run: `pnpm --filter @pipou/backend test`
Expected: PASS. `effects-coverage.spec.ts` et `effect-schema-coverage.spec.ts` couvrent automatiquement les nouvelles cartes : adapter leurs mises en place si une carte exige un Général Chatouille (même modèle que l'exception « Mise à jour .patch » ligne 105 d'`effects-coverage.spec.ts`).

- [ ] **Step 6: Run the migration locally** (base de dev uniquement)

Run: `ENV_FILE=.env.dev.local pnpm --filter @pipou/backend migration:run`
Expected: 3 cartes créées. En cas d'échec, `migration:revert` puis correction.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/database apps/backend/src/fights/engine/charge-real-cards.spec.ts apps/backend/src/fights/engine/effects-coverage.spec.ts
git commit -m "feat(cards): Alerte générale, Extraction de données, Méditation céleste"
```

---

### Task 10: Front — choix sur le terrain et textes d'effets

**Files:**
- Modify: `apps/frontend/src/features/fight/CardPickModal.tsx:27-61`
- Modify: `apps/frontend/src/i18n/locales/{fr,en,ko}.json` (`fight.pick.prompt`, `fight.pick.confirm`)
- Modify: `apps/frontend/src/features/fight/effectText.ts` (si les actions y sont décrites)
- Test: `apps/frontend/src/__tests__/components/CardPickModal.test.tsx`

- [ ] **Step 1: Write the failing test** (dans `CardPickModal.test.tsx`, sur le modèle du cas `promptKey: "discard"` ligne 76)

```tsx
it("consigne d'extraction traduite, avec le montant", () => {
  renderModal({
    candidates: [boardCandidate("Colosse")],
    count: 1,
    prompt: "fallback",
    promptKey: "extract_target",
    promptParams: { amount: 500 },
    resolution: "transfer_atk_target",
  });
  expect(screen.getByText(/500/)).toBeInTheDocument();
});
```

(`renderModal` / `boardCandidate` : helpers du fichier ; en créer un pour une carte `source: "board"` si absent.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @pipou/frontend test -- CardPickModal`
Expected: FAIL (typecheck des `Record` ou texte absent).

- [ ] **Step 3: Implement**

Dans chaque `Record<PendingChoiceResolution, string>` de `CardPickModal.tsx`, ajouter :

```ts
  transfer_atk_source: "",
  transfer_atk_target: "",
  force_evolve: "",
```

(icônes vides : pas d'emoji dans la nouvelle UI) ; couleurs : `#e8f4fb` / `#1c5a7a` pour les deux `transfer_atk_*`, `#f3faf5` / `#1f6b3a` pour `force_evolve`, sur les quatre tables de couleur.

i18n `fight.pick.prompt` :
- fr : `"extract_source": "Choisis le monstre dont tu extrais la moitié de l'ATK"`, `"extract_target": "Choisis le Noyau qui reçoit {{amount}} ATK"`, `"meditate": "Choisis le Drakon qui évolue"`
- en : `"extract_source": "Choose the monster to drain half its ATK"`, `"extract_target": "Choose the Core that gains {{amount}} ATK"`, `"meditate": "Choose the Drakon that evolves"`
- ko : `"extract_source": "공격력 절반을 빼앗을 몬스터를 선택하세요"`, `"extract_target": "공격력 {{amount}}을 받을 코어를 선택하세요"`, `"meditate": "진화할 드라콘을 선택하세요"`

i18n `fight.pick.confirm` : fr `"transfer_atk_source": "Extraire"`, `"transfer_atk_target": "Transférer"`, `"force_evolve": "Évoluer"` ; en `"Drain"`, `"Transfer"`, `"Evolve"` ; ko `"추출"`, `"전송"`, `"진화"`.

Si `effectText.ts` décrit les actions par type (lire le fichier), ajouter une phrase pour les 4 nouvelles actions (fr/en/ko), en suivant le format des entrées voisines.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `pnpm --filter @pipou/frontend test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Visual check** — environnement de test local (mémoire « Local test env ») : poser Extraction de données en sandbox, attendre la charge, vérifier la fenêtre de choix (deux étapes) et l'ATK affichée. Capture Playwright 430 px.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(fight): choix d'extraction et de méditation"
```

---

### Task 11: IA et vérification finale

**Files:**
- Modify (si nécessaire): `apps/backend/src/fights/ai/ai-player.ts`, `apps/backend/src/fights/ai/generated-entries.spec.ts`

- [ ] **Step 1: Check the AI resolves the new choices**

Run: `pnpm --filter @pipou/backend test -- ai`
Expected: PASS. Ajouter un test dans `ai-player.spec.ts` : partie avec Extraction de données chargée et un Noyau allié ; l'IA doit produire une action `pick` valide (et non bloquer). Si l'IA ne sait pas répondre à un choix `board`, la faire choisir le candidat d'ATK la plus haute pour `transfer_atk_source` et le premier candidat sinon.

- [ ] **Step 2: Full verification**

Run: `pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected: tout passe. Noter le résultat exact dans le rapport.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/fights/ai
git commit -m "feat(ai): l'IA résout les choix des cartes Charge"
```

---

## Couverture du spec

| Exigence | Tâche |
|---|---|
| Œuf Céleste : deck, cimetière, repli | 1 (+ texte en 2) |
| Bluetooth : texte | 2 |
| Gel : durée visible (décision utilisateur) | 3 |
| DuplicateX : test puis décision | 4 |
| Charge cyclique | 5 |
| Nouvelles actions et choix | 6, 7, 8 |
| Condition Général Chatouille | 8 |
| 3 cartes, coût 0, migration | 2, 9 |
| UI des choix | 10 |
| IA | 11 |
| Vérification complète, migration locale seulement | 2, 9, 11 |
