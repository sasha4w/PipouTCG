# Animations de duel — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** invocation animée selon la rareté (4 paliers), destruction animée selon la cause (5 causes), image du terrain
actif en fond de la moitié de plateau du poseur, et réglage « Animations : auto / complètes / réduites ».

**Architecture :** le backend accumule des `FightEvent` publics (`game.pendingEvents`) pendant la résolution d'une
action ; `buildClientState` les recopie dans `ClientGameState.events`, `emitGameState` vide le tampon après l'envoi aux
deux joueurs. Le front dérive de ces événements (fonction pure + `useMemo`) une carte d'effets par zone, que
`useZoneAnimations` combine à la comparaison d'états existante (qui reste le secours). Le fond de terrain est calculé
depuis l'état (`placedSeq`), pas depuis les événements.

**Tech Stack :** NestJS 11 + Jest (backend), React 18 + Vitest + Testing Library (frontend), `@pipou/shared`
(tsup, vitest `--typecheck`), keyframes CSS.

**Spec :** `docs/superpowers/specs/2026-10-17-duel-animations-design.md`

## Global Constraints

- Tout type ou enum échangé front/back vit dans `@pipou/shared` ; jamais redéfini dans une app. `@pipou/shared` n'a
  aucune dépendance runtime.
- Enums partagés au format `const X = {...} as const; type X = (typeof X)[keyof typeof X]` (comme `enums/card.ts`).
- Après modification de `packages/shared` : `pnpm build:shared` avant de lancer back ou front.
- Aucune nouvelle dépendance npm ; animations en keyframes CSS.
- Animations non bloquantes : l'état reçu est appliqué immédiatement.
- Frontend : pas de `any`, pas de composant déclaré dans un composant, état dérivé plutôt que synchronisé
  (`apps/frontend/CLAUDE.md`).
- `localStorage` toujours lu/écrit dans un `try/catch`.
- Ne jamais se connecter à Aiven (le `.env` local pointe la BDD de prod) ; vérification visuelle uniquement avec la BDD
  Docker locale (`ENV_FILE=.env.dev.local`).
- Travail sur une branche `duel-animations` créée depuis `dev`.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Durées (référence unique, utilisées par les tâches 4 à 6)

| Animation | Durée |
|---|---|
| Invocation palier 1 / 2 / 3 / 4 | 500 / 800 / 1200 / 1500 ms |
| Destruction COMBAT / EFFECT / SACRIFICE / SELF_DESTRUCT / HP_DEPLETED | 900 / 900 / 800 / 1000 / 800 ms |
| Toute animation en mode réduit | 250 ms |
| Transition de fond de terrain (vague) / fondu sans vague | 700 / 300 ms |

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `packages/shared/src/enums/fight.ts` (créé) | `DestroyCause` |
| `packages/shared/src/game/events.ts` (créé) | `FightEvent` |
| `packages/shared/src/game/state.ts` | `ClientGameState.events` |
| `packages/shared/src/game/instance.ts` | `CardInstance.placedSeq?` |
| `apps/backend/src/fights/interfaces/game-state.interface.ts` | `GameState.pendingEvents`, `terrainSeq` |
| `apps/backend/src/fights/helpers/client-state.builder.ts` | recopie + vidage du tampon |
| `apps/backend/src/sandbox/sandbox.service.ts`, `scenario-serializer.ts` | vidage sandbox, anciennes sauvegardes |
| `apps/backend/src/fights/effects-resolver.service.ts` | `destroyMonster(..., { draw, cause })` + événement |
| `apps/backend/src/fights/services/{battle,phase,summon,support}.service.ts`, `engine/game-engine.ts` | causes, invocation, terrain |
| `apps/frontend/src/contexts/animation-context.ts`, `AnimationContext.tsx`, `useAnimationPrefs.ts` (créés) | préférence animations |
| `apps/frontend/src/components/AnimationSettings.tsx` + `.css` (créés) | sélecteur dans Réglages |
| `apps/frontend/src/features/fight/fightEvents.ts` (créé) | paliers, durées, `boardFxFromEvents` (pur) |
| `apps/frontend/src/features/fight/Zonerow/useZoneAnimations.ts`, `ZoneRow.tsx`, `ZoneRow.css` | paliers et causes par zone |
| `apps/frontend/src/features/fight/FightFxLayer.tsx` + `.css` (créés) | flash plein plateau |
| `apps/frontend/src/features/fight/terrainBackground.ts` (créé) | `pickActiveTerrain`, `terrainWaveZone` (purs) |
| `apps/frontend/src/features/fight/TerrainBackground.tsx` + `.css` (créés) | calque de fond + transitions |
| `apps/frontend/src/features/fight/FightBoard.tsx` + `.css` | branchement de l'ensemble |

---

### Task 1 : Contrat partagé et transport des événements

**Files :**
- Create : `packages/shared/src/enums/fight.ts`, `packages/shared/src/game/events.ts`,
  `packages/shared/src/game/events.test-d.ts`
- Modify : `packages/shared/src/enums/index.ts`, `packages/shared/src/game/index.ts`,
  `packages/shared/src/game/state.ts:78-91`, `packages/shared/src/game/instance.ts:4-12`
- Modify : `apps/backend/src/fights/interfaces/game-state.interface.ts:63-75`,
  `apps/backend/src/fights/helpers/game-factory.ts:49-50`, `apps/backend/src/fights/testing/scenario.ts:123-124`,
  `apps/backend/src/fights/helpers/client-state.builder.ts`, `apps/backend/src/sandbox/sandbox.service.ts:285-288`,
  `apps/backend/src/sandbox/scenario-serializer.ts:60-68`
- Test : `apps/backend/src/fights/helpers/client-state.builder.spec.ts`,
  `apps/backend/src/sandbox/scenario-serializer.spec.ts`

**Interfaces :**
- Produces : `DestroyCause` (valeurs `combat | effect | sacrifice | self_destruct | hp_depleted`), `FightEvent`,
  `ClientGameState.events: FightEvent[]`, `CardInstance.placedSeq?: number`, `GameState.pendingEvents: FightEvent[]`,
  `GameState.terrainSeq: number`.

- [ ] **Step 1 : créer la branche**

```bash
git checkout dev && git pull && git checkout -b duel-animations
```

- [ ] **Step 2 : écrire le test de types partagé (échoue)**

`packages/shared/src/game/events.test-d.ts` :

```ts
import { describe, expectTypeOf, it } from "vitest";
import { DestroyCause } from "../index";
import type { CardInstance, ClientGameState, FightEvent } from "../index";

describe("fight events", () => {
  it("expose les causes de destruction", () => {
    expectTypeOf(DestroyCause.COMBAT).toEqualTypeOf<"combat">();
    expectTypeOf<DestroyCause>().toEqualTypeOf<
      "combat" | "effect" | "sacrifice" | "self_destruct" | "hp_depleted"
    >();
  });

  it("joint les événements à l'état client", () => {
    expectTypeOf<ClientGameState["events"]>().toEqualTypeOf<FightEvent[]>();
    expectTypeOf<FightEvent["kind"]>().toEqualTypeOf<
      "monster_summoned" | "monster_destroyed" | "terrain_played"
    >();
  });

  it("numérote la pose des terrains", () => {
    expectTypeOf<CardInstance["placedSeq"]>().toEqualTypeOf<number | undefined>();
  });
});
```

- [ ] **Step 3 : vérifier l'échec**

Run : `pnpm --filter @pipou/shared test`
Expected : FAIL (`DestroyCause` / `FightEvent` introuvables).

- [ ] **Step 4 : implémenter le contrat partagé**

`packages/shared/src/enums/fight.ts` :

```ts
/** Cause d'une destruction de monstre en duel, transmise au client pour l'animation. */
export const DestroyCause = {
  COMBAT: "combat",
  EFFECT: "effect",
  SACRIFICE: "sacrifice",
  SELF_DESTRUCT: "self_destruct",
  HP_DEPLETED: "hp_depleted",
} as const;
export type DestroyCause = (typeof DestroyCause)[keyof typeof DestroyCause];
```

`packages/shared/src/enums/index.ts` : ajouter `export * from "./fight";`.

`packages/shared/src/game/events.ts` :

```ts
import type { Rarity } from "../enums/card";
import type { DestroyCause } from "../enums/fight";

/**
 * Événement public de duel, produit pendant la résolution d'une action et envoyé
 * avec l'état qui suit (`ClientGameState.events`). Sert uniquement aux animations.
 * `ownerId` : userId du joueur dont la zone est concernée.
 */
export type FightEvent =
  | {
      kind: "monster_summoned";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
      rarity: Rarity;
    }
  | {
      kind: "monster_destroyed";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
      cause: DestroyCause;
    }
  | {
      kind: "terrain_played";
      ownerId: number;
      zoneIndex: number;
      instanceId: string;
    };
```

`packages/shared/src/game/index.ts` : ajouter `export * from "./events";`.

`packages/shared/src/game/state.ts`, dans `ClientGameState`, après `log: string[];` :

```ts
  /** Événements produits par la dernière action (vide à la reconnexion). */
  events: FightEvent[];
```

et en tête : `import type { FightEvent } from "./events";`.

`packages/shared/src/game/instance.ts`, dans `CardInstance`, après `status?: string[];` :

```ts
  /** Ordre de pose d'un terrain en zone Support (croissant sur la partie). */
  placedSeq?: number;
```

- [ ] **Step 5 : vérifier le partagé et le construire**

Run : `pnpm --filter @pipou/shared test && pnpm build:shared`
Expected : PASS, build OK.

- [ ] **Step 6 : écrire les tests backend (échouent)**

Ajouter à `apps/backend/src/fights/helpers/client-state.builder.spec.ts` (imports à compléter en tête :
`import type { ClientGameState, FightEvent } from '@pipou/shared';`,
`import { buildClientState, emitGameState } from './client-state.builder';`,
`import { fakeServer } from '../testing/fake-server';`) :

```ts
describe('buildClientState / emitGameState — événements', () => {
  const ev: FightEvent = {
    kind: 'terrain_played',
    ownerId: P1_ID,
    zoneIndex: 0,
    instanceId: 't1',
  };

  it('recopie les événements en attente', () => {
    const game = scenario();
    game.pendingEvents.push(ev);

    expect(buildClientState(game, P1_ID).events).toEqual([ev]);
  });

  it('envoie les mêmes événements aux deux joueurs puis vide le tampon', () => {
    const game = scenario();
    game.pendingEvents.push(ev);
    const { server, emitted } = fakeServer();

    emitGameState(game, server);
    emitGameState(game, server);

    const events = emitted.map((e) => (e.payload as ClientGameState).events);
    expect(events).toEqual([[ev], [ev], [], []]);
    expect(game.pendingEvents).toEqual([]);
  });
});
```

Ajouter à `apps/backend/src/sandbox/scenario-serializer.spec.ts` (imports :
`import type { GameState } from '../fights/interfaces/game-state.interface';`) :

```ts
const cardsOf = (game: GameState): Map<number, Card> => {
  const cards = new Map<number, Card>();
  JSON.stringify(game, (key, value: unknown) => {
    if (key === 'baseCard') {
      const card = value as Card;
      cards.set(card.id, card);
    }
    return value;
  });
  return cards;
};

it('initialise événements et compteur de terrains pour une ancienne sauvegarde', () => {
  const game = savedGame();
  const state = serializeGame(game);
  delete state.pendingEvents;
  delete state.terrainSeq;

  const restored = deserializeGame(state, cardsOf(game), {
    matchId: -2,
    p1: { userId: 40, username: 'A', socketId: 's' },
    p2: { userId: -40, username: 'B', socketId: 's' },
  });

  expect(restored.pendingEvents).toEqual([]);
  expect(restored.terrainSeq).toBe(0);
});
```

(placer ce `it` dans le `describe('scenario-serializer', …)` existant et `cardsOf` au niveau module.)

- [ ] **Step 7 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- client-state.builder scenario-serializer`
Expected : FAIL (erreurs TS sur `pendingEvents` / `events`).

- [ ] **Step 8 : implémenter le transport**

`apps/backend/src/fights/interfaces/game-state.interface.ts` : ajouter `FightEvent` à l'import de type depuis
`@pipou/shared`, puis dans `GameState` après `pendingChoices` :

```ts
  /** Événements de la dernière action, vidés après chaque envoi d'état. */
  pendingEvents: FightEvent[];
  /** Dernier numéro d'ordre attribué à un terrain posé. */
  terrainSeq: number;
```

`helpers/game-factory.ts` et `testing/scenario.ts` (`scenario()`) : après `pendingChoices: [],` ajouter

```ts
    pendingEvents: [],
    terrainSeq: 0,
```

`helpers/client-state.builder.ts` : dans l'objet retourné par `buildClientState`, après `log: game.log.slice(-20),` :

```ts
    events: [...game.pendingEvents],
```

et remplacer `emitGameState` par :

```ts
export function emitGameState(game: GameState, server: FightServer): void {
  server
    .to(game.player1.socketId)
    .emit('fight:state', buildClientState(game, game.player1.userId));
  server
    .to(game.player2.socketId)
    .emit('fight:state', buildClientState(game, game.player2.userId));
  // Joués une seule fois : une reconnexion reçoit l'état sans événements
  game.pendingEvents = [];
}
```

`sandbox/sandbox.service.ts`, méthode `publish` :

```ts
  private publish(sb: Sandbox, server: SandboxServer): void {
    server.to(sb.admin.socketId).emit('sandbox:state', buildSandboxState(sb));
    sb.game.pendingEvents = [];
    this.scheduleTimer(sb, server);
  }
```

`sandbox/scenario-serializer.ts`, dans `deserializeGame`, après `game.matchId = seats.matchId;` :

```ts
  // Sauvegardes antérieures aux animations : champs absents
  game.pendingEvents = [];
  game.terrainSeq ??= 0;
```

- [ ] **Step 9 : vérifier**

Run : `pnpm --filter @pipou/backend test -- client-state.builder scenario-serializer && pnpm typecheck`
Expected : PASS. Si `pnpm typecheck` signale le frontend (aucun objet `ClientGameState` n'y est construit à la main
aujourd'hui), corriger l'endroit indiqué en ajoutant `events: []`.

- [ ] **Step 10 : commit**

```bash
git add packages/shared apps/backend/src
git commit -m "feat(shared,fights): fight events transported with each state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Production des événements côté moteur

**Files :**
- Modify : `apps/backend/src/fights/effects-resolver.service.ts:24-77`,
  `apps/backend/src/fights/services/battle.service.ts:93-96`, `apps/backend/src/fights/engine/game-engine.ts:136-138`,
  `apps/backend/src/fights/services/phase.service.ts:198-200`, `apps/backend/src/fights/services/summon.service.ts:108-110`,
  `apps/backend/src/fights/services/support.service.ts:115-136`
- Test : `apps/backend/src/fights/engine/fight-events.spec.ts` (créé)

**Interfaces :**
- Consumes : `GameState.pendingEvents`, `GameState.terrainSeq`, `DestroyCause`, `FightEvent` (Task 1).
- Produces : `destroyMonster(game, host, instanceId, log, opts: { draw: boolean; cause: DestroyCause })`.

Règle des causes (SACRIFICE = monstre de son propre camp détruit par son propre effet, la même règle que l'absence
de pioche existante) :

| Appelant | Cause |
|---|---|
| `battle.service` | `COMBAT` |
| `game-engine` `reapDeadMonsters` (0 PV constaté après coup : perte de bonus…) | `HP_DEPLETED` |
| `phase.service` (compteur Zeta) | `SELF_DESTRUCT` |
| action `DESTROY_MONSTER` ou dégâts mortels `DEAL_DAMAGE`, hôte ≠ propriétaire de l'effet | `EFFECT` |
| action `DESTROY_MONSTER` ou dégâts mortels `DEAL_DAMAGE`, hôte = propriétaire de l'effet | `SACRIFICE` |

(Les deux actions passent par le même rappel `destroy` de `applyActions`.)

- [ ] **Step 1 : écrire les tests (échouent)**

`apps/backend/src/fights/engine/fight-events.spec.ts` :

```ts
import {
  ActionType,
  DestroyCause,
  EffectTarget,
  EffectTrigger,
  Rarity,
} from '@pipou/shared';
import type { GameState } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  monsterCard,
  terrainCard,
} from '../testing/cards';
import {
  attackWith,
  monsterNamed,
  P1_ID,
  P2_ID,
  scenario,
} from '../testing/scenario';

const destroyed = (game: GameState) =>
  game.pendingEvents.filter((e) => e.kind === 'monster_destroyed');

describe('GameEngine — événements de duel', () => {
  const engine = createEngine();

  it('combat : COMBAT sur la zone de la victime', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: { monsters: [null, monsterCard('Lutin', { atk: 0, hp: 300 })] },
    });
    const lutinId = monsterNamed(game, 'p2', 'Lutin').instanceId;

    attackWith(engine, game, 'p1', 'Ogre', 'Lutin');

    expect(destroyed(game)).toEqual([
      {
        kind: 'monster_destroyed',
        ownerId: P2_ID,
        zoneIndex: 1,
        instanceId: lutinId,
        cause: DestroyCause.COMBAT,
      },
    ]);
  });

  it("destruction par l'effet adverse : EFFECT", () => {
    const foudre = ephemeralCard('Foudre', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ENEMIES),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [foudre] },
      p2: { monsters: [monsterCard('Lutin')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 0, cause: DestroyCause.EFFECT },
    ]);
  });

  it('destruction de son propre monstre par son effet : SACRIFICE', () => {
    const sacrifice = ephemeralCard('Sacrifice', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ALLIES),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [sacrifice], monsters: [monsterCard('Pion')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P1_ID, zoneIndex: 0, cause: DestroyCause.SACRIFICE },
    ]);
  });

  it('dégâts mortels d’un effet : EFFECT (destruction immédiate par l’applier)', () => {
    const meteore = ephemeralCard('Météore', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 1000 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [meteore] },
      p2: { monsters: [monsterCard('Lutin')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 0, cause: DestroyCause.EFFECT },
    ]);
  });

  it('monstre à 0 PV ramassé par le moteur (perte de bonus) : HP_DEPLETED', () => {
    const game = scenario({
      p2: {
        monsters: [null, { card: monsterCard('Affaibli'), currentHp: 0 }],
      },
    });

    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 1, cause: DestroyCause.HP_DEPLETED },
    ]);
  });

  it('compteur de tour expiré : SELF_DESTRUCT sur la zone de l’hôte', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p2: {
        monsters: [
          {
            card: monsterCard('Virus', { atk: 0, hp: 400 }),
            patch: { turnCounter: 1, ownerUserId: P1_ID },
          },
        ],
      },
    });

    engine.dispatch(game, 'p2', { type: 'end_phase' });

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, zoneIndex: 0, cause: DestroyCause.SELF_DESTRUCT },
    ]);
  });

  it('mort en chaîne via ON_DEATH : événements dans l’ordre de résolution', () => {
    const kamikaze = monsterCard('Kamikaze', {
      atk: 0,
      hp: 300,
      effects: [
        effect(EffectTrigger.ON_DEATH, [
          act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ENEMIES),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: { monsters: [kamikaze] },
    });

    attackWith(engine, game, 'p1', 'Ogre', 'Kamikaze');

    expect(destroyed(game)).toMatchObject([
      { ownerId: P2_ID, cause: DestroyCause.COMBAT },
      { ownerId: P1_ID, cause: DestroyCause.EFFECT },
    ]);
  });

  it('invocation : monster_summoned avec la rareté, côté de la zone occupée', () => {
    const dragon = monsterCard('Dragon', { rarity: Rarity.LEGENDARY });
    const game = scenario({ p1: { hand: [dragon] } });

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 2,
      paymentHandIndices: [],
    });

    expect(game.pendingEvents).toEqual([
      {
        kind: 'monster_summoned',
        ownerId: P1_ID,
        zoneIndex: 2,
        instanceId: monsterNamed(game, 'p1', 'Dragon').instanceId,
        rarity: Rarity.LEGENDARY,
      },
    ]);
  });

  it('invocation sur le terrain adverse (Zeta) : ownerId = joueur de la zone', () => {
    const zeta = monsterCard('Zeta', {
      effects: [
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.SUMMONABLE_ON_ENEMY_SIDE, EffectTarget.SELF),
        ]),
      ],
    });
    const game = scenario({ p1: { hand: [zeta] } });

    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 1,
      paymentHandIndices: [],
      onOpponentSide: true,
    });

    expect(game.pendingEvents).toMatchObject([
      { kind: 'monster_summoned', ownerId: P2_ID, zoneIndex: 1 },
    ]);
  });

  it('pose de terrains : terrain_played et placedSeq croissant', () => {
    const game = scenario({
      p1: { hand: [terrainCard('Forêt', []), terrainCard('Volcan', [])] },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      zoneIndex: 2,
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      zoneIndex: 0,
    });

    const [volcan, , foret] = game.player1.supportZones;
    expect(foret?.placedSeq).toBe(1);
    expect(volcan?.placedSeq).toBe(2);
    expect(game.pendingEvents).toEqual([
      {
        kind: 'terrain_played',
        ownerId: P1_ID,
        zoneIndex: 2,
        instanceId: foret?.instanceId,
      },
      {
        kind: 'terrain_played',
        ownerId: P1_ID,
        zoneIndex: 0,
        instanceId: volcan?.instanceId,
      },
    ]);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/backend test -- fight-events`
Expected : FAIL (`pendingEvents` vide).

- [ ] **Step 3 : `destroyMonster` avec cause**

`apps/backend/src/fights/effects-resolver.service.ts` : importer `DestroyCause` depuis `@pipou/shared`
(`import { DestroyCause, EffectTrigger } from '@pipou/shared';`). Dans `resolve`, remplacer le rappel passé à
`applyActions` :

```ts
      applyActions(effect, card, effectCtx, (host, instanceId) => {
        // Son propre monstre détruit par son propre effet : sacrifice, sans pioche
        const sacrifice = host.userId === ctx.ownerUserId;
        this.destroyMonster(ctx.game, host, instanceId, ctx.log, {
          draw: !sacrifice,
          cause: sacrifice ? DestroyCause.SACRIFICE : DestroyCause.EFFECT,
        });
      });
```

Remplacer `destroyMonster` :

```ts
  /**
   * Détruit un monstre : événement de destruction, ON_DEATH (monstre encore en
   * jeu), puis monstre et équipements au cimetière de l'hôte, puis pioche de
   * l'hôte si demandée.
   */
  destroyMonster(
    game: GameState,
    host: PlayerGameState,
    instanceId: string,
    log: string[],
    opts: { draw: boolean; cause: DestroyCause },
  ): MonsterOnBoard | null {
    const zoneIndex = host.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    const monster = host.monsterZones[zoneIndex];
    if (!monster) return null;

    // Avant ON_DEATH : les morts en chaîne suivent dans l'ordre
    game.pendingEvents.push({
      kind: 'monster_destroyed',
      ownerId: host.userId,
      zoneIndex,
      instanceId,
      cause: opts.cause,
    });

    this.resolve(monster.card, EffectTrigger.ON_DEATH, {
      game,
      ownerUserId: host.userId,
      sourceMonster: monster,
      log,
    });

    const idx = host.monsterZones.findIndex(
      (m) => m?.instanceId === instanceId,
    );
    if (idx !== -1) host.monsterZones[idx] = null;
    host.graveyard.push(...monster.equipments, monster.card);
    if (opts.draw) drawCard(game, host.userId);
    return monster;
  }
```

(`host.monsterZones[-1]` vaut `undefined` : le `if (!monster)` couvre le monstre introuvable.)

- [ ] **Step 4 : passer la cause chez chaque appelant**

Importer `DestroyCause` depuis `@pipou/shared` dans chacun des trois fichiers.

`services/battle.service.ts` (fermeture `destroy`) :

```ts
      this.effectsResolver.destroyMonster(game, host, m.instanceId, log, {
        draw: true,
        cause: DestroyCause.COMBAT,
      });
```

`engine/game-engine.ts` (`reapDeadMonsters`) :

```ts
          this.effects.destroyMonster(game, player, m.instanceId, log, {
            draw: true,
            cause: DestroyCause.HP_DEPLETED,
          });
```

`services/phase.service.ts` (compteur) :

```ts
        this.effectsResolver.destroyMonster(game, host, zone.instanceId, log, {
          draw: false,
          cause: DestroyCause.SELF_DESTRUCT,
        });
```

- [ ] **Step 5 : événement d'invocation**

`services/summon.service.ts`, juste après `target.monsterZones[zoneIndex] = instance;` :

```ts
    game.pendingEvents.push({
      kind: 'monster_summoned',
      ownerId: target.userId,
      zoneIndex,
      instanceId: instance.instanceId,
      rarity: monster.baseCard.rarity,
    });
```

- [ ] **Step 6 : terrain numéroté et événement**

`services/support.service.ts`, cas `SupportType.TERRAIN`, remplacer `player.supportZones[zoneIndex] = support;` par :

```ts
        support.placedSeq = ++game.terrainSeq;
        player.supportZones[zoneIndex] = support;
        game.pendingEvents.push({
          kind: 'terrain_played',
          ownerId: player.userId,
          zoneIndex,
          instanceId: support.instanceId,
        });
```

- [ ] **Step 7 : vérifier**

Run : `pnpm --filter @pipou/backend test && pnpm --filter @pipou/backend typecheck`
Expected : PASS (nouvelle spec et toutes les specs existantes, dont `destruction.spec.ts` et `effects-coverage.spec.ts`).

- [ ] **Step 8 : commit**

```bash
git add apps/backend/src/fights
git commit -m "feat(fights): emit summon, destruction-cause and terrain events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Préférence animations et réglage

**Files :**
- Create : `apps/frontend/src/contexts/animation-context.ts`, `apps/frontend/src/contexts/AnimationContext.tsx`,
  `apps/frontend/src/contexts/useAnimationPrefs.ts`, `apps/frontend/src/components/AnimationSettings.tsx`,
  `apps/frontend/src/components/AnimationSettings.css`
- Modify : `apps/frontend/src/App.tsx:86-118`, `apps/frontend/src/pages/Settings.tsx:82-86`,
  `apps/frontend/src/i18n/locales/{fr,en,ko}.json` (bloc `settings`)
- Test : `apps/frontend/src/__tests__/unit/AnimationContext.test.tsx` (créé)

**Interfaces :**
- Produces : `type AnimationPreference = "auto" | "full" | "reduced"`,
  `useAnimationPrefs(): { preference: AnimationPreference; setPreference(p: AnimationPreference): void; reduced: boolean }`,
  `<AnimationProvider>`. Sans provider, `useAnimationPrefs()` renvoie `{ preference: "auto", reduced: false }`
  (les tests de composants existants n'ont pas besoin de provider).

- [ ] **Step 1 : écrire les tests (échouent)**

`apps/frontend/src/__tests__/unit/AnimationContext.test.tsx` :

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AnimationProvider } from "../../contexts/AnimationContext";
import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";
import AnimationSettings from "../../components/AnimationSettings";

const originalMatchMedia = window.matchMedia;

function mockSystemReduced(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Probe() {
  const { preference, reduced } = useAnimationPrefs();
  return <span data-testid="prefs">{`${preference}:${reduced}`}</span>;
}

const renderWithProvider = () =>
  render(
    <AnimationProvider>
      <Probe />
      <AnimationSettings />
    </AnimationProvider>,
  );

describe("AnimationContext", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("auto suit prefers-reduced-motion", () => {
    mockSystemReduced(true);
    renderWithProvider();
    expect(screen.getByTestId("prefs")).toHaveTextContent("auto:true");
  });

  it("« complètes » ignore la préférence système", () => {
    mockSystemReduced(true);
    localStorage.setItem("pipou_animations", "full");
    renderWithProvider();
    expect(screen.getByTestId("prefs")).toHaveTextContent("full:false");
  });

  it("le sélecteur enregistre le choix", () => {
    mockSystemReduced(false);
    renderWithProvider();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "reduced" },
    });

    expect(screen.getByTestId("prefs")).toHaveTextContent("reduced:true");
    expect(localStorage.getItem("pipou_animations")).toBe("reduced");
  });

  it("stockage inaccessible : auto, sans planter", () => {
    mockSystemReduced(false);
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    renderWithProvider();
    expect(screen.getByTestId("prefs")).toHaveTextContent("auto:false");
  });

  it("sans provider : valeurs par défaut", () => {
    render(<Probe />);
    expect(screen.getByTestId("prefs")).toHaveTextContent("auto:false");
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- AnimationContext`
Expected : FAIL (modules introuvables).

- [ ] **Step 3 : implémenter le contexte**

`apps/frontend/src/contexts/animation-context.ts` :

```ts
import { createContext } from "react";

export type AnimationPreference = "auto" | "full" | "reduced";

export interface AnimationContextType {
  preference: AnimationPreference;
  setPreference: (p: AnimationPreference) => void;
  /** Animations réduites : choix explicite, ou « auto » + préférence système. */
  reduced: boolean;
}

export const AnimationContext = createContext<AnimationContextType>({
  preference: "auto",
  setPreference: () => {},
  reduced: false,
});
```

`apps/frontend/src/contexts/AnimationContext.tsx` :

```tsx
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { AnimationContext, type AnimationPreference } from "./animation-context";

const LS_ANIMATIONS = "pipou_animations";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function readPreference(): AnimationPreference {
  try {
    const stored = localStorage.getItem(LS_ANIMATIONS);
    return stored === "full" || stored === "reduced" ? stored : "auto";
  } catch {
    return "auto";
  }
}

function subscribeSystem(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const systemPrefersReduced = () => window.matchMedia(REDUCED_QUERY).matches;

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readPreference);
  const systemReduced = useSyncExternalStore(
    subscribeSystem,
    systemPrefersReduced,
    () => false,
  );

  const setPreference = useCallback((p: AnimationPreference) => {
    try {
      localStorage.setItem(LS_ANIMATIONS, p);
    } catch {
      // Stockage indisponible : le choix vaut pour la session
    }
    setPreferenceState(p);
  }, []);

  const reduced =
    preference === "reduced" || (preference === "auto" && systemReduced);

  const value = useMemo(
    () => ({ preference, setPreference, reduced }),
    [preference, setPreference, reduced],
  );

  return (
    <AnimationContext.Provider value={value}>{children}</AnimationContext.Provider>
  );
}
```

`apps/frontend/src/contexts/useAnimationPrefs.ts` :

```ts
import { useContext } from "react";
import { AnimationContext } from "./animation-context";

export function useAnimationPrefs() {
  return useContext(AnimationContext);
}
```

- [ ] **Step 4 : sélecteur et traductions**

`apps/frontend/src/components/AnimationSettings.tsx` :

```tsx
import { useTranslation } from "react-i18next";
import { useAnimationPrefs } from "../contexts/useAnimationPrefs";
import type { AnimationPreference } from "../contexts/animation-context";
import "./AnimationSettings.css";

const OPTIONS: AnimationPreference[] = ["auto", "full", "reduced"];

const isPreference = (v: string): v is AnimationPreference =>
  (OPTIONS as string[]).includes(v);

export default function AnimationSettings() {
  const { t } = useTranslation();
  const { preference, setPreference } = useAnimationPrefs();

  return (
    <label className="anim-settings">
      <span className="anim-settings__label">
        {t("settings.animations_label")}
      </span>
      <select
        className="anim-settings__select"
        value={preference}
        onChange={(e) => {
          if (isPreference(e.target.value)) setPreference(e.target.value);
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {t(`settings.animations_${o}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
```

`apps/frontend/src/components/AnimationSettings.css` (reprend le style du sélecteur de langue) :

```css
.anim-settings {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.anim-settings__label {
  font-size: 0.85rem;
  font-weight: 700;
  color: #491021;
}
.anim-settings__select {
  font-family: "Comfortaa", system-ui, sans-serif;
  font-size: 0.85rem;
  font-weight: 700;
  color: #491021;
  background: #fdfbf6;
  border: 1.5px solid rgba(61, 16, 32, 0.15);
  border-radius: 10px;
  padding: 6px 10px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}
.anim-settings__select:focus {
  border-color: #f27aaa;
}
```

Clés i18n, dans le bloc `"settings"` de chaque fichier (après `"notif_news"`) :

- `fr.json` : `"animations": "Animations", "animations_label": "Animations de duel", "animations_auto": "Auto (système)", "animations_full": "Complètes", "animations_reduced": "Réduites"`
- `en.json` : `"animations": "Animations", "animations_label": "Duel animations", "animations_auto": "Auto (system)", "animations_full": "Full", "animations_reduced": "Reduced"`
- `ko.json` : `"animations": "애니메이션", "animations_label": "대결 애니메이션", "animations_auto": "자동 (시스템)", "animations_full": "전체", "animations_reduced": "줄이기"`

- [ ] **Step 5 : brancher provider et page**

`apps/frontend/src/App.tsx` : `import { AnimationProvider } from "./contexts/AnimationContext";` et envelopper
`<BrowserRouter>…</BrowserRouter>` dans `<AnimationProvider>` (à l'intérieur de `<SoundProvider>`).

`apps/frontend/src/pages/Settings.tsx` : `import AnimationSettings from "../components/AnimationSettings";` et, juste
après la section Audio :

```tsx
      <Section label={t("settings.animations")}>
        <AnimationSettings />
      </Section>
```

- [ ] **Step 6 : vérifier**

Run : `pnpm --filter @pipou/frontend test -- AnimationContext && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend typecheck`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): animation preference (auto/full/reduced) in settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Dérivation des effets de zone depuis les événements

**Files :**
- Create : `apps/frontend/src/features/fight/fightEvents.ts`
- Test : `apps/frontend/src/__tests__/unit/fightEvents.test.ts` (créé)

**Interfaces :**
- Consumes : `FightEvent`, `DestroyCause`, `Rarity` (`@pipou/shared`).
- Produces :
  - `type SummonTier = 1 | 2 | 3 | 4`, `summonTier(rarity: Rarity): SummonTier`
  - `SUMMON_MS: Record<SummonTier, number>`, `DESTROY_MS: Record<DestroyCause, number>`, `REDUCED_MS = 250`
  - `interface ZoneFx { summonTier?: SummonTier; destroyCause?: DestroyCause; terrainPlayed?: boolean }`
  - `type ZoneFxMap = ReadonlyMap<number, ZoneFx>`, `EMPTY_ZONE_FX: ZoneFxMap`
  - `interface SideFx { monsters: ZoneFxMap; supports: ZoneFxMap }`
  - `interface BoardFx { me: SideFx; opponent: SideFx; topSummon: { tier: SummonTier; rarity: Rarity } | null }`
  - `boardFxFromEvents(events: readonly FightEvent[], myUserId: number): BoardFx`

- [ ] **Step 1 : écrire les tests (échouent)**

`apps/frontend/src/__tests__/unit/fightEvents.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import type { FightEvent } from "@pipou/shared";
import { boardFxFromEvents, summonTier } from "../../features/fight/fightEvents";

const ME = 1;
const OPP = 2;

describe("summonTier", () => {
  it.each([
    ["common", 1],
    ["uncommon", 1],
    ["rare", 2],
    ["epic", 2],
    ["legendary", 3],
    ["secret", 4],
  ] as const)("%s → palier %i", (rarity, tier) => {
    expect(summonTier(rarity)).toBe(tier);
  });
});

describe("boardFxFromEvents", () => {
  it("range chaque événement par côté et par zone", () => {
    const events: FightEvent[] = [
      { kind: "monster_summoned", ownerId: ME, zoneIndex: 1, instanceId: "a", rarity: "epic" },
      { kind: "monster_destroyed", ownerId: OPP, zoneIndex: 0, instanceId: "b", cause: "sacrifice" },
      { kind: "terrain_played", ownerId: OPP, zoneIndex: 2, instanceId: "t" },
    ];

    const fx = boardFxFromEvents(events, ME);

    expect(fx.me.monsters.get(1)).toEqual({ summonTier: 2 });
    expect(fx.opponent.monsters.get(0)).toEqual({ destroyCause: "sacrifice" });
    expect(fx.opponent.supports.get(2)).toEqual({ terrainPlayed: true });
    expect(fx.me.supports.size).toBe(0);
  });

  it("fusionne destruction et invocation sur la même zone", () => {
    const fx = boardFxFromEvents(
      [
        { kind: "monster_destroyed", ownerId: ME, zoneIndex: 0, instanceId: "a", cause: "combat" },
        { kind: "monster_summoned", ownerId: ME, zoneIndex: 0, instanceId: "b", rarity: "rare" },
      ],
      ME,
    );
    expect(fx.me.monsters.get(0)).toEqual({ destroyCause: "combat", summonTier: 2 });
  });

  it("retient l'invocation la plus forte de l'action", () => {
    const fx = boardFxFromEvents(
      [
        { kind: "monster_summoned", ownerId: ME, zoneIndex: 0, instanceId: "a", rarity: "legendary" },
        { kind: "monster_summoned", ownerId: OPP, zoneIndex: 0, instanceId: "b", rarity: "secret" },
        { kind: "monster_summoned", ownerId: ME, zoneIndex: 1, instanceId: "c", rarity: "common" },
      ],
      ME,
    );
    expect(fx.topSummon).toEqual({ tier: 4, rarity: "secret" });
  });

  it("aucun événement : cartes vides, pas d'invocation", () => {
    const fx = boardFxFromEvents([], ME);
    expect(fx.me.monsters.size).toBe(0);
    expect(fx.topSummon).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- fightEvents`
Expected : FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

`apps/frontend/src/features/fight/fightEvents.ts` :

```ts
import type { DestroyCause, FightEvent, Rarity } from "@pipou/shared";

/** Intensité de l'animation d'invocation, selon la rareté. */
export type SummonTier = 1 | 2 | 3 | 4;

const TIER_BY_RARITY: Record<Rarity, SummonTier> = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 2,
  legendary: 3,
  secret: 4,
};

export const summonTier = (rarity: Rarity): SummonTier =>
  TIER_BY_RARITY[rarity] ?? 1;

export const SUMMON_MS: Record<SummonTier, number> = {
  1: 500,
  2: 800,
  3: 1200,
  4: 1500,
};

export const DESTROY_MS: Record<DestroyCause, number> = {
  combat: 900,
  effect: 900,
  sacrifice: 800,
  self_destruct: 1000,
  hp_depleted: 800,
};

/** Durée de toute animation en mode réduit. */
export const REDUCED_MS = 250;

export interface ZoneFx {
  summonTier?: SummonTier;
  destroyCause?: DestroyCause;
  terrainPlayed?: boolean;
}

export type ZoneFxMap = ReadonlyMap<number, ZoneFx>;

export const EMPTY_ZONE_FX: ZoneFxMap = new Map();

export interface SideFx {
  monsters: ZoneFxMap;
  supports: ZoneFxMap;
}

export interface BoardFx {
  me: SideFx;
  opponent: SideFx;
  /** Invocation la plus forte de l'action (flash, secousse). */
  topSummon: { tier: SummonTier; rarity: Rarity } | null;
}

function merge(map: Map<number, ZoneFx>, zoneIndex: number, patch: ZoneFx) {
  map.set(zoneIndex, { ...map.get(zoneIndex), ...patch });
}

/** Effets à jouer par zone pour les événements d'un état reçu. */
export function boardFxFromEvents(
  events: readonly FightEvent[],
  myUserId: number,
): BoardFx {
  const sides = {
    me: { monsters: new Map<number, ZoneFx>(), supports: new Map<number, ZoneFx>() },
    opponent: { monsters: new Map<number, ZoneFx>(), supports: new Map<number, ZoneFx>() },
  };
  let topSummon: BoardFx["topSummon"] = null;

  for (const e of events) {
    const side = e.ownerId === myUserId ? sides.me : sides.opponent;
    switch (e.kind) {
      case "monster_summoned": {
        const tier = summonTier(e.rarity);
        merge(side.monsters, e.zoneIndex, { summonTier: tier });
        if (!topSummon || tier > topSummon.tier)
          topSummon = { tier, rarity: e.rarity };
        break;
      }
      case "monster_destroyed":
        merge(side.monsters, e.zoneIndex, { destroyCause: e.cause });
        break;
      case "terrain_played":
        merge(side.supports, e.zoneIndex, { terrainPlayed: true });
        break;
    }
  }
  return { ...sides, topSummon };
}
```

- [ ] **Step 4 : vérifier**

Run : `pnpm --filter @pipou/frontend test -- fightEvents && pnpm --filter @pipou/frontend lint`
Expected : PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/frontend/src/features/fight/fightEvents.ts apps/frontend/src/__tests__/unit/fightEvents.test.ts
git commit -m "feat(front): derive per-zone animation fx from fight events

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Invocation par paliers, flash et branchement du plateau

**Files :**
- Create : `apps/frontend/src/features/fight/FightFxLayer.tsx`, `apps/frontend/src/features/fight/FightFxLayer.css`
- Modify : `apps/frontend/src/features/fight/Zonerow/useZoneAnimations.ts` (réécrit),
  `apps/frontend/src/features/fight/Zonerow/ZoneRow.tsx`, `apps/frontend/src/features/fight/Zonerow/ZoneRow.css`
  (section Summon + nouvelle section Mode réduit), `apps/frontend/src/features/fight/FightBoard.tsx`,
  `apps/frontend/src/features/fight/FightBoard.css`
- Test : `apps/frontend/src/__tests__/components/ZoneRow.test.tsx`

**Interfaces :**
- Consumes : `boardFxFromEvents`, `summonTier`, `SUMMON_MS`, `DESTROY_MS`, `REDUCED_MS`, `ZoneFxMap`,
  `EMPTY_ZONE_FX` (Task 4) ; `useAnimationPrefs` (Task 3) ; `ClientGameState.events` (Task 1).
- Produces :
  - `useZoneAnimations(zones, isSupport, fx?: ZoneFxMap, reduced?: boolean)` →
    `{ summoningZones: ReadonlyMap<number, SummonTier>; flippingZones: Set<number>; dyingZones: ReadonlyMap<number, { zone: BoardZone; cause: DestroyCause }> }`
  - `ZoneRow` prop `fx?: ZoneFxMap` ; classes de zone `zr-zone--summon-t{1..4}`,
    `zr-zone--destroy-{combat|effect|sacrifice|self-destruct|hp-depleted}` (utilisées en Task 6) ; classe de rangée
    `zr-wrap--opponent` quand `isOpponent`.
  - `FightBoard` : classe `fb--reduced-motion` sur `.fb-wrap` en mode réduit.

- [ ] **Step 1 : écrire les tests (échouent)**

Ajouter à `apps/frontend/src/__tests__/components/ZoneRow.test.tsx` (imports à compléter : `vi`, `afterEach` depuis
`vitest`, `act` depuis `@testing-library/react`) :

```tsx
describe("ZoneRow animations", () => {
  afterEach(() => vi.useRealTimers());

  const zoneEl = (container: HTMLElement) =>
    container.querySelector(".zr-zone") as HTMLElement;

  it("invocation : palier tiré de l'événement", () => {
    const { container, rerender } = render(
      <ZoneRow label="M" zones={[null]} />,
    );
    rerender(
      <ZoneRow
        label="M"
        zones={[monster()]}
        fx={new Map([[0, { summonTier: 3 }]])}
      />,
    );
    expect(zoneEl(container)).toHaveClass("zr-zone--summon-in", "zr-zone--summon-t3");
  });

  it("invocation sans événement : palier de la rareté de la carte", () => {
    const secret = monster();
    secret.card.baseCard.rarity = "secret";
    const { container, rerender } = render(<ZoneRow label="M" zones={[null]} />);
    rerender(<ZoneRow label="M" zones={[secret]} />);
    expect(zoneEl(container)).toHaveClass("zr-zone--summon-t4");
  });

  it("le palier disparaît après sa durée", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ZoneRow label="M" zones={[null]} />);
    rerender(
      <ZoneRow label="M" zones={[monster()]} fx={new Map([[0, { summonTier: 2 }]])} />,
    );
    act(() => vi.advanceTimersByTime(799));
    expect(zoneEl(container)).toHaveClass("zr-zone--summon-t2");
    act(() => vi.advanceTimersByTime(1));
    expect(zoneEl(container)).not.toHaveClass("zr-zone--summon-t2");
  });

  it("destruction : classe de la cause, combat par défaut", () => {
    const { container, rerender } = render(
      <ZoneRow label="M" zones={[monster(), monster({ instanceId: "m2" })]} />,
    );
    rerender(
      <ZoneRow
        label="M"
        zones={[null, null]}
        fx={new Map([[0, { destroyCause: "self_destruct" }]])}
      />,
    );
    const [first, second] = container.querySelectorAll(".zr-zone");
    expect(first).toHaveClass("zr-zone--shattering", "zr-zone--destroy-self-destruct");
    expect(second).toHaveClass("zr-zone--shattering", "zr-zone--destroy-combat");
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- ZoneRow`
Expected : FAIL (prop `fx` inconnue, classes absentes).

- [ ] **Step 3 : réécrire `useZoneAnimations`**

`apps/frontend/src/features/fight/Zonerow/useZoneAnimations.ts` :

```ts
import { useEffect, useRef, useState } from "react";
import type { DestroyCause } from "@pipou/shared";
import { isMonsterZone, type BoardZone } from "../fight.types";
import {
  DESTROY_MS,
  EMPTY_ZONE_FX,
  REDUCED_MS,
  SUMMON_MS,
  summonTier,
  type SummonTier,
  type ZoneFxMap,
} from "../fightEvents";

const modeOf = (zone: BoardZone | null) =>
  zone && isMonsterZone(zone) ? zone.mode : undefined;

export interface DyingZone {
  zone: BoardZone;
  cause: DestroyCause;
}

function without<V>(map: ReadonlyMap<number, V>, key: number) {
  const next = new Map(map);
  next.delete(key);
  return next;
}

/**
 * Animations par zone, déduites de la comparaison avec l'état précédent.
 * `fx` (événements serveur) précise le palier d'invocation et la cause de
 * destruction ; sans événement : palier de la rareté, destruction « combat ».
 */
export function useZoneAnimations(
  zones: (BoardZone | null)[],
  isSupport: boolean,
  fx: ZoneFxMap = EMPTY_ZONE_FX,
  reduced = false,
) {
  const prevZonesRef = useRef<(BoardZone | null)[]>(zones.map(() => null));
  const prevModesRef = useRef<(string | undefined)[]>(zones.map(modeOf));
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [summoningZones, setSummoningZones] = useState<
    ReadonlyMap<number, SummonTier>
  >(new Map());
  const [flippingZones, setFlippingZones] = useState<Set<number>>(new Set());
  const [dyingZones, setDyingZones] = useState<ReadonlyMap<number, DyingZone>>(
    new Map(),
  );

  useEffect(() => {
    const prevZones = prevZonesRef.current;
    const prevModes = prevModesRef.current;
    const later = (ms: number, fn: () => void) =>
      timersRef.current.push(setTimeout(fn, ms));

    const newFlipping = new Set<number>();

    zones.forEach((zone, idx) => {
      const prev = prevZones[idx];

      if (!prev && zone) {
        const tier: SummonTier = isSupport
          ? 1
          : (fx.get(idx)?.summonTier ??
            (isMonsterZone(zone) ? summonTier(zone.card.baseCard.rarity) : 1));
        setSummoningZones((m) => new Map(m).set(idx, tier));
        later(reduced ? REDUCED_MS : SUMMON_MS[tier], () =>
          setSummoningZones((m) => without(m, idx)),
        );
      }

      if (prev && !zone) {
        const cause = fx.get(idx)?.destroyCause ?? "combat";
        setDyingZones((m) => new Map(m).set(idx, { zone: prev, cause }));
        later(reduced ? REDUCED_MS : DESTROY_MS[cause], () =>
          setDyingZones((m) => without(m, idx)),
        );
      }

      if (!isSupport && prev && zone) {
        const prevMode = prevModes[idx];
        const curMode = modeOf(zone);
        if (prevMode && curMode && prevMode !== curMode) newFlipping.add(idx);
      }
    });

    if (newFlipping.size > 0) {
      setFlippingZones(newFlipping);
      later(450, () => setFlippingZones(new Set()));
    }
    // fx et reduced accompagnent le même état que zones
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  useEffect(() => {
    prevZonesRef.current = [...zones];
    prevModesRef.current = zones.map(modeOf);
  });

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  return { summoningZones, flippingZones, dyingZones };
}
```

- [ ] **Step 4 : mettre à jour `ZoneRow`**

`apps/frontend/src/features/fight/Zonerow/ZoneRow.tsx` :

1. Imports : `import type React from "react";` (si absent), `import { useAnimationPrefs } from "../../../contexts/useAnimationPrefs";`,
   `import type { ZoneFxMap } from "../fightEvents";`.
2. `Props` : ajouter `/** Effets serveur de l'état courant, par index de zone. */ fx?: ZoneFxMap;` et le
   déstructurer (`fx,`).
3. Remplacer l'appel du hook :

```tsx
  const { reduced } = useAnimationPrefs();
  const { summoningZones, flippingZones, dyingZones } = useZoneAnimations(
    zones,
    isSupport,
    fx,
    reduced,
  );
```

4. Racine : `<div className={`zr-wrap${isOpponent ? " zr-wrap--opponent" : ""}`}>`.
5. Dans la boucle, remplacer les deux premières lignes et les classes concernées :

```tsx
          const dying = !zone ? dyingZones.get(idx) : undefined;
          const isShattering = !!dying;
          const dyingData = dying?.zone;
          const summonTier = summoningZones.get(idx);
```

   et dans `zoneClasses`, remplacer `summoningZones.has(idx) ? "zr-zone--summon-in" : "",` par :

```tsx
            summonTier ? `zr-zone--summon-in zr-zone--summon-t${summonTier}` : "",
            dying ? `zr-zone--destroy-${dying.cause.replace(/_/g, "-")}` : "",
```

6. Style de zone (variable de couleur pour les paliers) :

```tsx
              style={
                rarityColor
                  ? ({
                      borderColor: rarityColor,
                      "--rarity-color": rarityColor,
                    } as React.CSSProperties)
                  : undefined
              }
```

7. Effets superposés des paliers 2+ : juste après la balise ouvrante de la zone (`<div key={idx} …>`), avant le
   contenu :

```tsx
              {summonTier && summonTier >= 2 && (
                <span className="zr-summon-fx" aria-hidden />
              )}
              {summonTier && summonTier >= 3 && (
                <span className="zr-summon-beam" aria-hidden />
              )}
```

- [ ] **Step 5 : CSS des paliers et du mode réduit**

Dans `ZoneRow.css`, à la fin de la section « Summon » (après `@keyframes zr-summon-glow`) :

```css
/* Palier 1+ : lueur à la couleur de rareté */
.zr-zone--summon-in::after {
  box-shadow:
    0 0 0 3px var(--rarity-color, rgba(200, 220, 255, 0.6)),
    0 0 20px var(--rarity-color, rgba(180, 210, 255, 0.35));
}

/* Palier 2+ : cercle d'énergie au sol + particules montantes */
.zr-summon-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}
.zr-summon-fx::before {
  content: "";
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 6px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--rarity-color, #4a90d9);
  box-shadow: 0 0 12px var(--rarity-color, #4a90d9);
  animation: zr-ring 0.8s ease-out forwards;
}
.zr-summon-fx::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 14px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--rarity-color, #4a90d9);
  box-shadow:
    -34px 0 0 0 var(--rarity-color, #4a90d9),
    -22px 6px 0 1px var(--rarity-color, #4a90d9),
    -10px -4px 0 0 #fff,
    12px 4px 0 1px var(--rarity-color, #4a90d9),
    24px -2px 0 0 #fff,
    34px 6px 0 1px var(--rarity-color, #4a90d9),
    -28px -10px 0 0 var(--rarity-color, #4a90d9),
    6px -12px 0 1px var(--rarity-color, #4a90d9),
    28px -14px 0 0 #fff,
    -4px 8px 0 0 var(--rarity-color, #4a90d9);
  animation: zr-rise 0.8s ease-out forwards;
}
@keyframes zr-ring {
  0% {
    transform: scale(0.3);
    opacity: 1;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}
@keyframes zr-rise {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-90px);
    opacity: 0;
  }
}

/* Palier 3+ : faisceau vertical */
.zr-summon-beam {
  position: absolute;
  left: 30%;
  right: 30%;
  top: -40px;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(
    to top,
    var(--rarity-color, #f39c12),
    rgba(255, 255, 255, 0.8) 40%,
    transparent
  );
  filter: blur(6px);
  transform-origin: bottom;
  animation: zr-beam 1.2s ease-out forwards;
}
@keyframes zr-beam {
  0% {
    transform: scaleY(0);
    opacity: 0;
  }
  25% {
    transform: scaleY(1);
    opacity: 0.9;
  }
  100% {
    transform: scaleY(1);
    opacity: 0;
  }
}

/* Palier 4 : bordure arc-en-ciel + balayage holographique prolongé */
.zr-zone--summon-t4 {
  animation:
    zr-summon 0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    zr-rainbow 1.5s linear;
}
.zr-zone--summon-t4::before {
  animation: zr-holo-sweep 0.7s 0.1s ease-out 2 forwards;
}
@keyframes zr-rainbow {
  0%,
  100% {
    outline: 3px solid #e74c3c;
  }
  20% {
    outline: 3px solid #f39c12;
  }
  40% {
    outline: 3px solid #2ecc71;
  }
  60% {
    outline: 3px solid #3498db;
  }
  80% {
    outline: 3px solid #9b59b6;
  }
}
```

À la fin de `ZoneRow.css`, nouvelle section :

```css
/* ── Mode réduit (classe posée par FightBoard) ────────────────────────────── */
.fb--reduced-motion .zr-zone--summon-in {
  animation: zr-reduced-in 0.25s ease-out;
}
.fb--reduced-motion .zr-zone--shattering {
  animation: zr-reduced-out 0.25s ease-out forwards;
}
.fb--reduced-motion .zr-zone--summon-in::before,
.fb--reduced-motion .zr-zone--summon-in::after,
.fb--reduced-motion .zr-zone--shattering::before,
.fb--reduced-motion .zr-zone--shattering::after,
.fb--reduced-motion .zr-summon-fx,
.fb--reduced-motion .zr-summon-beam {
  display: none;
}
@keyframes zr-reduced-in {
  0% {
    opacity: 0;
    box-shadow: 0 0 0 3px var(--rarity-color, #a8a8a8);
  }
  100% {
    opacity: 1;
  }
}
@keyframes zr-reduced-out {
  0% {
    opacity: 1;
    box-shadow: 0 0 0 3px var(--destroy-color, #e74c3c);
  }
  100% {
    opacity: 0;
  }
}
```

- [ ] **Step 6 : `FightFxLayer`**

`apps/frontend/src/features/fight/FightFxLayer.tsx` :

```tsx
import type React from "react";
import "./FightFxLayer.css";

interface Props {
  /** Nouveau `key` à chaque flash : l'animation CSS rejoue au montage. */
  flash: { key: number; color: string } | null;
}

/** Effets plein plateau, au-dessus des zones et sans capter les clics. */
export default function FightFxLayer({ flash }: Props) {
  return (
    <div className="ffx-layer" aria-hidden>
      {flash && (
        <div
          key={flash.key}
          className="ffx-flash"
          style={{ "--ffx-color": flash.color } as React.CSSProperties}
        />
      )}
    </div>
  );
}
```

`apps/frontend/src/features/fight/FightFxLayer.css` :

```css
.ffx-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
  overflow: hidden;
  border-radius: inherit;
}
.ffx-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(255, 255, 255, 0.9),
    var(--ffx-color) 45%,
    transparent 75%
  );
  opacity: 0;
  animation: ffx-flash 0.6s ease-out forwards;
}
@keyframes ffx-flash {
  0% {
    opacity: 0;
  }
  15% {
    opacity: 0.75;
  }
  100% {
    opacity: 0;
  }
}
```

- [ ] **Step 7 : brancher `FightBoard`**

`apps/frontend/src/features/fight/FightBoard.tsx` :

1. Imports : `useMemo` dans l'import React ; `import FightFxLayer from "./FightFxLayer";`,
   `import { boardFxFromEvents } from "./fightEvents";`, `import { RARITY_COLOR } from "./fight.types";`,
   `import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";`.
2. Après `const phase = gs.phase;` :

```tsx
  const { reduced } = useAnimationPrefs();
  const fx = useMemo(
    // `?? []` : état envoyé par un backend pas encore redéployé
    () => boardFxFromEvents(gs.events ?? [], gs.me.userId),
    [gs.events, gs.me.userId],
  );

  // ── Invocation légendaire / secrète : flash + secousse ───────────────────
  const [flash, setFlash] = useState<{ key: number; color: string } | null>(
    null,
  );
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    const top = fx.topSummon;
    if (reduced || !top || top.tier < 3) return;
    setFlash((f) => ({ key: (f?.key ?? 0) + 1, color: RARITY_COLOR[top.rarity] }));
    setShaking(true);
    const t = setTimeout(() => setShaking(false), 400);
    return () => clearTimeout(t);
  }, [fx, reduced]);
```

3. Racine du rendu :

```tsx
    <div
      className={[
        "fb-wrap",
        reduced ? "fb--reduced-motion" : "",
        shaking ? "fb-wrap--shake" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <FightFxLayer flash={flash} />
```

4. Passer `fx` aux quatre `ZoneRow` : `fx={fx.opponent.supports}` (« Adversaire — Supports »),
   `fx={fx.opponent.monsters}` (« Adversaire — Monstres »), `fx={fx.me.monsters}` (« Mes Monstres »),
   `fx={fx.me.supports}` (« Mes Supports »).

`apps/frontend/src/features/fight/FightBoard.css`, dans `.fb-wrap` ajouter `position: relative;`, puis à la fin :

```css
.fb-wrap--shake {
  animation: fb-shake 0.4s ease-in-out;
}
@keyframes fb-shake {
  0%,
  100% {
    transform: translate(0, 0);
  }
  20% {
    transform: translate(-4px, 2px);
  }
  40% {
    transform: translate(4px, -2px);
  }
  60% {
    transform: translate(-3px, -1px);
  }
  80% {
    transform: translate(2px, 1px);
  }
}
```

- [ ] **Step 8 : vérifier**

Run : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend typecheck`
Expected : PASS (nouveaux tests ZoneRow et tous les tests existants).

- [ ] **Step 9 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): rarity-tiered summon animations and board flash

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Variantes de destruction selon la cause

**Files :**
- Modify : `apps/frontend/src/features/fight/Zonerow/ZoneRow.css` (section « Destruction / shatter »)

**Interfaces :**
- Consumes : classes `zr-zone--shattering` + `zr-zone--destroy-{combat|effect|sacrifice|self-destruct|hp-depleted}`,
  `zr-wrap--opponent` (Task 5) ; durées du tableau des contraintes globales.

Pas de test automatisé (CSS pur, déjà couvert côté classes par Task 5) : vérification visuelle en Task 8.

- [ ] **Step 1 : séparer la base et la variante combat**

Dans `ZoneRow.css`, remplacer la règle `.zr-zone--shattering { … }` par une base commune, et renommer les sélecteurs
`.zr-zone--shattering::before` / `.zr-zone--shattering::after` en `.zr-zone--destroy-combat::before` /
`.zr-zone--destroy-combat::after` (contenu inchangé) :

```css
.zr-zone--shattering {
  pointer-events: none;
  z-index: 10;
  background: #fdf6f0;
  border: 2px solid var(--destroy-color, #e74c3c);
  overflow: hidden;
}

/* Combat : éclatement (animation historique) */
.zr-zone--destroy-combat {
  --destroy-color: #e74c3c;
  animation: zr-shatter 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}
```

- [ ] **Step 2 : ajouter les quatre autres causes**

À la suite de la section (après `@keyframes zr-shatter`) :

```css
/* Effet : dissolution violette vers le haut */
.zr-zone--destroy-effect {
  --destroy-color: #8e44ad;
  animation: zr-dissolve 0.9s ease-in forwards;
}
.zr-zone--destroy-effect::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 60%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c39bd3;
  box-shadow:
    -30px 10px 0 1px #8e44ad,
    -16px -6px 0 0 #d7bde2,
    14px 8px 0 1px #8e44ad,
    28px -4px 0 0 #d7bde2,
    -6px 18px 0 1px #a569bd,
    22px 20px 0 0 #8e44ad;
  animation: zr-rise 0.9s ease-out forwards;
  pointer-events: none;
}
@keyframes zr-dissolve {
  0% {
    opacity: 1;
    filter: none;
    transform: translateY(0);
    box-shadow: 0 0 0 transparent;
  }
  30% {
    opacity: 0.9;
    filter: saturate(0.6) brightness(1.2);
    box-shadow: 0 0 18px #8e44ad;
  }
  100% {
    opacity: 0;
    filter: blur(4px) saturate(0);
    transform: translateY(-18px);
    box-shadow: 0 0 0 transparent;
  }
}

/* Sacrifice : lueur dorée puis repli vers le cimetière du propriétaire */
.zr-zone--destroy-sacrifice {
  --destroy-color: #f1c40f;
  --grave-dx: 140px;
  animation: zr-sacrifice 0.8s ease-in forwards;
}
.zr-wrap--opponent .zr-zone--destroy-sacrifice {
  --grave-dx: -140px;
}
@keyframes zr-sacrifice {
  0% {
    transform: none;
    opacity: 1;
    box-shadow: 0 0 0 transparent;
  }
  35% {
    transform: scale(1.04);
    filter: brightness(1.4);
    box-shadow: 0 0 24px #f1c40f;
  }
  100% {
    transform: translateX(var(--grave-dx)) scale(0.2) rotate(-12deg);
    opacity: 0;
    filter: brightness(1);
  }
}

/* Autodestruction (compteur) : clignotement accéléré puis onde de choc */
.zr-zone--destroy-self-destruct {
  --destroy-color: #e74c3c;
  animation: zr-countdown-blow 1s ease-in forwards;
}
.zr-zone--destroy-self-destruct::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  border: 3px solid #f39c12;
  opacity: 0;
  animation: zr-shockwave 1s ease-out forwards;
  pointer-events: none;
}
@keyframes zr-countdown-blow {
  0%,
  20%,
  36%,
  48%,
  56% {
    filter: none;
    transform: none;
    opacity: 1;
  }
  10%,
  28%,
  42%,
  52%,
  60% {
    filter: brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4);
  }
  70% {
    transform: scale(1.1);
    filter: brightness(2.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.3);
    filter: brightness(0.3);
    opacity: 0;
  }
}
@keyframes zr-shockwave {
  0%,
  60% {
    transform: scale(0);
    opacity: 0;
  }
  65% {
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

/* PV épuisés : désaturation puis effondrement */
.zr-zone--destroy-hp-depleted {
  --destroy-color: #7f8c8d;
  transform-origin: bottom center;
  animation: zr-collapse 0.8s ease-in forwards;
}
@keyframes zr-collapse {
  0% {
    filter: none;
    transform: none;
    opacity: 1;
  }
  40% {
    filter: grayscale(1) brightness(0.8);
    transform: none;
    opacity: 1;
  }
  100% {
    filter: grayscale(1) brightness(0.6);
    transform: translateY(24px) scaleY(0.2);
    opacity: 0;
  }
}
```

- [ ] **Step 3 : vérifier**

Run : `pnpm --filter @pipou/frontend test -- ZoneRow && pnpm --filter @pipou/frontend build`
Expected : PASS, build OK.

- [ ] **Step 4 : commit**

```bash
git add apps/frontend/src/features/fight/Zonerow/ZoneRow.css
git commit -m "feat(front): cause-specific monster destruction animations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Fond de terrain

**Files :**
- Create : `apps/frontend/src/features/fight/terrainBackground.ts`, `apps/frontend/src/features/fight/TerrainBackground.tsx`,
  `apps/frontend/src/features/fight/TerrainBackground.css`
- Modify : `apps/frontend/src/features/fight/FightBoard.tsx` (les deux `.fb-side-row`),
  `apps/frontend/src/features/fight/FightBoard.css` (`.fb-side-row`)
- Test : `apps/frontend/src/__tests__/unit/terrainBackground.test.ts`,
  `apps/frontend/src/__tests__/components/TerrainBackground.test.tsx` (créés)

**Interfaces :**
- Consumes : `CardInstance.placedSeq` (Task 1), `ZoneFxMap` (Task 4), `fx.me.supports` / `fx.opponent.supports`,
  `reduced` (Tasks 3, 5).
- Produces : `pickActiveTerrain(zones: readonly (CardInstance | null)[]): CardInstance | null`,
  `terrainWaveZone(terrain: CardInstance | null, zones: readonly (CardInstance | null)[], fx: ZoneFxMap): number | null`,
  `<TerrainBackground terrain side waveFromZone reduced />`.

- [ ] **Step 1 : écrire les tests (échouent)**

`apps/frontend/src/__tests__/unit/terrainBackground.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import type { CardInstance } from "@pipou/shared";
import {
  pickActiveTerrain,
  terrainWaveZone,
} from "../../features/fight/terrainBackground";

const terrain = (instanceId: string, placedSeq?: number): CardInstance => ({
  instanceId,
  ownerId: 1,
  placedSeq,
  baseCard: {
    id: 1,
    name: instanceId,
    rarity: "rare",
    type: "support",
    atk: 0,
    hp: 0,
    cost: 0,
    supportType: "TERRAIN",
    archetype: null,
    effects: null,
    description: null,
    image: null,
  },
});

describe("pickActiveTerrain", () => {
  it("prend le dernier terrain posé", () => {
    expect(
      pickActiveTerrain([terrain("a", 3), null, terrain("b", 5)])?.instanceId,
    ).toBe("b");
  });

  it("revient au précédent quand le dernier part", () => {
    expect(pickActiveTerrain([terrain("a", 3), null, null])?.instanceId).toBe("a");
  });

  it("un terrain sans numéro passe après les autres", () => {
    expect(
      pickActiveTerrain([terrain("x"), terrain("a", 1), null])?.instanceId,
    ).toBe("a");
  });

  it("aucun terrain : null", () => {
    expect(pickActiveTerrain([null, null, null])).toBeNull();
  });
});

describe("terrainWaveZone", () => {
  it("zone du terrain actif quand il vient d'être posé", () => {
    const zones = [null, terrain("a", 1), null];
    expect(
      terrainWaveZone(zones[1], zones, new Map([[1, { terrainPlayed: true }]])),
    ).toBe(1);
  });

  it("null sans pose dans l'action", () => {
    const zones = [null, terrain("a", 1), null];
    expect(terrainWaveZone(zones[1], zones, new Map())).toBeNull();
  });
});
```

`apps/frontend/src/__tests__/components/TerrainBackground.test.tsx` :

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { CardInstance } from "@pipou/shared";
import TerrainBackground from "../../features/fight/TerrainBackground";

const terrain = (instanceId: string, url: string | null): CardInstance => ({
  instanceId,
  ownerId: 1,
  placedSeq: 1,
  baseCard: {
    id: 1,
    name: instanceId,
    rarity: "epic",
    type: "support",
    atk: 0,
    hp: 0,
    cost: 0,
    supportType: "TERRAIN",
    archetype: null,
    effects: null,
    description: null,
    image: url ? { url } : null,
  },
});

describe("TerrainBackground", () => {
  afterEach(() => vi.useRealTimers());

  it("affiche l'image du terrain avec la vague depuis sa zone", () => {
    const { container } = render(
      <TerrainBackground
        terrain={terrain("a", "https://cdn.test/foret.png")}
        side="me"
        waveFromZone={2}
        reduced={false}
      />,
    );
    const layer = container.querySelector(".tbg__layer") as HTMLElement;
    expect(layer).toHaveClass("tbg__layer--wave");
    expect(layer.style.backgroundImage).toContain("https://cdn.test/foret.png");
  });

  it("garde l'ancien fond le temps de la transition", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <TerrainBackground terrain={terrain("a", null)} side="me" waveFromZone={null} reduced={false} />,
    );
    rerender(
      <TerrainBackground terrain={terrain("b", null)} side="me" waveFromZone={0} reduced={false} />,
    );
    expect(container.querySelectorAll(".tbg__layer")).toHaveLength(2);
    expect(container.querySelector(".tbg__layer--out")).not.toBeNull();

    act(() => vi.advanceTimersByTime(700));
    expect(container.querySelectorAll(".tbg__layer")).toHaveLength(1);
  });

  it("ne rejoue pas la vague quand l'état suivant arrive", () => {
    const t = terrain("a", null);
    const { container, rerender } = render(
      <TerrainBackground terrain={t} side="me" waveFromZone={1} reduced={false} />,
    );
    rerender(
      <TerrainBackground terrain={{ ...t }} side="me" waveFromZone={null} reduced={false} />,
    );
    expect(container.querySelector(".tbg__layer")).toHaveClass("tbg__layer--wave");
  });

  it("aucun terrain : aucun calque", () => {
    const { container } = render(
      <TerrainBackground terrain={null} side="opponent" waveFromZone={null} reduced={false} />,
    );
    expect(container.querySelector(".tbg__layer")).toBeNull();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run : `pnpm --filter @pipou/frontend test -- terrainBackground TerrainBackground`
Expected : FAIL (modules introuvables).

- [ ] **Step 3 : fonctions pures**

`apps/frontend/src/features/fight/terrainBackground.ts` :

```ts
import { SupportType, type CardInstance } from "@pipou/shared";
import type { ZoneFxMap } from "./fightEvents";

/** Terrain affiché en fond : le dernier posé encore en jeu. */
export function pickActiveTerrain(
  zones: readonly (CardInstance | null)[],
): CardInstance | null {
  let best: CardInstance | null = null;
  for (const zone of zones) {
    if (zone?.baseCard.supportType !== SupportType.TERRAIN) continue;
    if (!best || (zone.placedSeq ?? -1) > (best.placedSeq ?? -1)) best = zone;
  }
  return best;
}

/** Zone d'où part la vague : celle du terrain actif s'il vient d'être posé. */
export function terrainWaveZone(
  terrain: CardInstance | null,
  zones: readonly (CardInstance | null)[],
  fx: ZoneFxMap,
): number | null {
  if (!terrain) return null;
  const idx = zones.findIndex((z) => z?.instanceId === terrain.instanceId);
  return idx !== -1 && fx.get(idx)?.terrainPlayed ? idx : null;
}
```

- [ ] **Step 4 : composant**

`apps/frontend/src/features/fight/TerrainBackground.tsx` :

```tsx
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { CardInstance } from "@pipou/shared";
import { RARITY_COLOR } from "./fight.types";
import "./TerrainBackground.css";

/** Durée pendant laquelle l'ancien fond reste sous le nouveau. */
const TRANSITION_MS = 700;

type Side = "me" | "opponent";

interface Props {
  terrain: CardInstance | null;
  side: Side;
  /** Zone Support du terrain qui vient d'être posé (vague), sinon null (fondu). */
  waveFromZone: number | null;
  reduced: boolean;
}

/** Origine approximative de la vague : la zone Support dans la rangée du joueur. */
function waveOrigin(side: Side, zone: number): React.CSSProperties {
  const x = side === "me" ? 15 + zone * 30 : 25 + zone * 30;
  const y = side === "me" ? 82 : 18;
  return { "--wave-x": `${x}%`, "--wave-y": `${y}%` } as React.CSSProperties;
}

function layerStyle(terrain: CardInstance): React.CSSProperties {
  const url = terrain.baseCard.image?.url;
  if (url) return { backgroundImage: `url("${url}")` };
  const color = RARITY_COLOR[terrain.baseCard.rarity] ?? "#a8a8a8";
  return { backgroundImage: `linear-gradient(135deg, ${color}, transparent)` };
}

interface LayerProps {
  terrain: CardInstance;
  side: Side;
  waveFromZone: number | null;
}

/** Calque entrant : le mode d'entrée est figé au montage (un par terrain). */
function EnteringLayer({ terrain, side, waveFromZone }: LayerProps) {
  const [wave] = useState(waveFromZone);
  return (
    <div
      className={`tbg__layer ${wave !== null ? "tbg__layer--wave" : "tbg__layer--fade"}`}
      style={{
        ...layerStyle(terrain),
        ...(wave !== null ? waveOrigin(side, wave) : {}),
      }}
    />
  );
}

export default function TerrainBackground({
  terrain,
  side,
  waveFromZone,
  reduced,
}: Props) {
  const id = terrain?.instanceId ?? null;
  const lastRef = useRef<CardInstance | null>(terrain);
  const [leaving, setLeaving] = useState<CardInstance | null>(null);

  useEffect(() => {
    const last = lastRef.current;
    lastRef.current = terrain;
    if ((last?.instanceId ?? null) === id) return;
    setLeaving(last);
    const t = setTimeout(() => setLeaving(null), TRANSITION_MS);
    return () => clearTimeout(t);
    // Seul un changement de terrain (id) déclenche la transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div
      className={`tbg tbg--${side}${reduced ? " tbg--reduced" : ""}`}
      aria-hidden
    >
      {leaving && (
        <div
          key={`out-${leaving.instanceId}`}
          className="tbg__layer tbg__layer--out"
          style={layerStyle(leaving)}
        />
      )}
      {terrain && (
        <EnteringLayer
          key={terrain.instanceId}
          terrain={terrain}
          side={side}
          waveFromZone={waveFromZone}
        />
      )}
    </div>
  );
}
```

`apps/frontend/src/features/fight/TerrainBackground.css` :

```css
.tbg {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.tbg__layer {
  position: absolute;
  inset: -12px;
  background-size: cover;
  background-position: center;
  filter: blur(6px) brightness(0.45);
  opacity: 0.55;
}
.tbg--me .tbg__layer {
  mask-image: linear-gradient(to top, #000 55%, transparent);
}
.tbg--opponent .tbg__layer {
  mask-image: linear-gradient(to bottom, #000 55%, transparent);
}
.tbg__layer--fade {
  animation: tbg-fade-in 0.3s ease-out both;
}
.tbg__layer--wave {
  animation: tbg-wave 0.7s ease-out both;
}
.tbg__layer--out {
  animation: tbg-fade-out 0.3s ease-out forwards;
}
.tbg--reduced .tbg__layer--wave,
.tbg--reduced .tbg__layer--fade {
  animation: tbg-fade-in 0.25s ease-out both;
}
.tbg--reduced .tbg__layer--out {
  animation-duration: 0.25s;
}
@keyframes tbg-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.55;
  }
}
@keyframes tbg-fade-out {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 0;
  }
}
@keyframes tbg-wave {
  from {
    clip-path: circle(0% at var(--wave-x, 50%) var(--wave-y, 50%));
  }
  to {
    clip-path: circle(150% at var(--wave-x, 50%) var(--wave-y, 50%));
  }
}
```

- [ ] **Step 5 : brancher dans `FightBoard`**

`apps/frontend/src/features/fight/FightBoard.tsx` : imports
`import TerrainBackground from "./TerrainBackground";` et
`import { pickActiveTerrain, terrainWaveZone } from "./terrainBackground";`. Après le calcul de `fx` :

```tsx
  const myTerrain = pickActiveTerrain(gs.me.supportZones);
  const oppTerrain = pickActiveTerrain(gs.opponent.supportZones);
```

Premier `<div className="fb-side-row">` (adversaire) : y insérer en premier enfant

```tsx
        <TerrainBackground
          terrain={oppTerrain}
          side="opponent"
          waveFromZone={terrainWaveZone(oppTerrain, gs.opponent.supportZones, fx.opponent.supports)}
          reduced={reduced}
        />
```

Second `<div className="fb-side-row">` (moi) : y insérer en premier enfant

```tsx
        <TerrainBackground
          terrain={myTerrain}
          side="me"
          waveFromZone={terrainWaveZone(myTerrain, gs.me.supportZones, fx.me.supports)}
          reduced={reduced}
        />
```

`apps/frontend/src/features/fight/FightBoard.css`, règle `.fb-side-row` : ajouter

```css
  position: relative;
  isolation: isolate;
  border-radius: 14px;
```

- [ ] **Step 6 : vérifier**

Run : `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend lint && pnpm --filter @pipou/frontend typecheck`
Expected : PASS.

- [ ] **Step 7 : commit**

```bash
git add apps/frontend/src
git commit -m "feat(front): active terrain image as board-half background

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Vérification complète et visuelle

**Files :** aucun nouveau fichier ; retouches CSS éventuelles dans `ZoneRow.css`, `TerrainBackground.css`,
`FightFxLayer.css`.

- [ ] **Step 1 : vérifications du monorepo**

Run : `pnpm build:shared && pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected : tout PASS.

- [ ] **Step 2 : lancer l'environnement local (jamais Aiven)**

BDD Docker `cardcollect_dev` démarrée, backend avec `ENV_FILE=.env.dev.local`, front `pnpm --filter @pipou/frontend dev`,
compte admin local. Ouvrir le sandbox admin (`/admin/sandbox`), qui donne la main sur les deux sièges.

- [ ] **Step 3 : scénarios à capturer (Playwright, coque claire 430 px)**

Pour chacun, capture pendant l'animation (≈ 40 % de sa durée) :
1. Invocation common, rare, legendary (flash + secousse), secret (arc-en-ciel).
2. Destruction : combat (attaque), effect (éphémère `DESTROY_MONSTER`), sacrifice (destruction de son propre monstre),
   hp_depleted (dégâts d'effet), self_destruct (Zeta en fin de compteur).
3. Pose d'un terrain de chaque côté (vague), puis second terrain (bascule), puis recyclage du dernier (retour au
   précédent).
4. Réglages → Animations « Réduites » : rejouer une invocation legendary et une destruction (fondu court, ni flash ni
   secousse).

- [ ] **Step 4 : ajuster si besoin**

Lisibilité des cartes sur le fond (opacité/luminosité de `.tbg__layer`, voile des zones vides), position de la vague
(`waveOrigin`), intensité du flash. Toute retouche : relancer `pnpm --filter @pipou/frontend test` puis commit

```bash
git add apps/frontend/src
git commit -m "style(front): tune duel animation visuals after visual check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5 : passer la main**

Présenter les captures, puis suivre superpowers:finishing-a-development-branch (PR `duel-animations` → `dev`).
