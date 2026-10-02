# Moteur de duel : audit, tests et corrections — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le moteur de duel testable et conforme aux règles validées : façade `GameEngine` sans Socket.io, ~18 bugs corrigés, cartes codées en dur remplacées par des effets génériques, migrations de données, et frontend aligné.

**Architecture:** Les services de règles existants (`apps/backend/src/fights/services/*`) deviennent synchrones et ne connaissent plus Socket.io. Une façade `GameEngine.dispatch(game, seat, action)` les orchestre et « stabilise » l'état après chaque action (recalcul des buffs, monstres morts, victoire). `FightsService` traduit l'utilisateur en siège, émet l'état, gère le timer, la reconnexion et la persistance. Toute la logique est couverte par des tests Jest qui construisent des parties avec un `ScenarioBuilder`.

**Tech Stack:** NestJS 11, TypeORM 0.3 (MySQL), Socket.io, Jest 30 + ts-jest (backend), Vitest (shared, frontend), React 18, pnpm workspaces, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-02-duel-engine-audit-design.md`

## Global Constraints

- Tout type, enum ou constante échangé entre front et back vit dans `@pipou/shared` (`packages/shared/src`). Après toute modification de `packages/shared` : `pnpm build:shared`.
- `@pipou/shared` n'a aucune dépendance runtime (des fonctions pures sont permises).
- **Ne jamais exécuter `migration:run`, `migration:revert` ni aucun script utilisant `apps/backend/.env`** : ce fichier pointe sur la base de production Aiven. Les migrations se testent uniquement en local avec `.env.e2e` (scripts `*:local` ajoutés en Task 4).
- Les données de joueurs du dump `apps/backend/.e2e/aiven-dump.sql` ne doivent jamais être commitées ni copiées ailleurs. Seule la table `card` (données de jeu) peut être extraite (Task 14).
- Tests backend : `pnpm --filter @pipou/backend exec jest <motif>` (le `rootDir` Jest est `src`).
- Tests shared : `pnpm --filter @pipou/shared test`. Tests front : `pnpm --filter @pipou/frontend test`.
- Typecheck global : `pnpm typecheck`. Le lint a une baseline en erreur (non bloquant en CI), mais les fichiers créés ou modifiés doivent passer `pnpm --filter <app> exec eslint <fichiers>` sans nouvelle erreur.
- Commentaires et messages de jeu en français, comme le code existant.
- Un commit par tâche, message conventionnel, terminé par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Branche : `feat/duel-engine-audit` (déjà créée).

## Décisions d'implémentation (complètent la spec)

- **Pioche à la destruction** : en combat, le propriétaire pioche toujours. Pour une destruction par effet, il pioche seulement si l'effet vient de l'adversaire (`ctx.ownerUserId !== hôte`). À l'expiration d'un compteur de tour, il ne pioche pas. C'est le comportement actuel, désormais centralisé dans `EffectsResolverService.destroyMonster`.
- **`DRAW`** pioche `value ?? 1` cartes (aujourd'hui `value` est ignoré).
- **Cartes ciblées** : un Éphémère est « ciblé » si une action `ON_PLAY` vise `ENEMY_MONSTER` (cible ennemie) ou `ALLY_MONSTER` / `TARGET_ALLY` (cible alliée). C'est la fonction partagée `ephemeralTargetSide`. Les résolutions de choix `destroy_ally`, `return_to_hand`, `force_attack_enemy`, `block_attack_enemy` et `force_guard_enemy` disparaissent : il ne reste que `pick_to_hand` et `discard`.
- **Choix en attente** : `GameState.pendingChoice` devient `pendingChoices: PendingChoice[]` (une file).
- **Buffs permanents** : `MonsterOnBoard.perm` porte les bonus posés par les effets déclenchés. Le recalcul part de `perm`, puis applique les passifs.
- **Siège** : l'API du moteur prend un `Seat` (`'p1' | 'p2'`). En interne, les services continuent d'utiliser le `userId` du siège.

## Carte des fichiers

| Fichier | Responsabilité |
|---|---|
| `packages/shared/src/game/seat.ts` (créé) | Type `Seat`. |
| `packages/shared/src/game/action.ts` (créé) | Union `GameAction` des actions de jeu. |
| `packages/shared/src/game/rules.ts` (créé) | `DECK_RULES`, constantes de partie, `ephemeralTargetSide`, `canSummonOnEnemySide`. |
| `packages/shared/src/game/{effect,instance,state}.ts` | Types d'effets, de monstres et d'état client. |
| `packages/shared/src/enums/{effect,match}.ts` | Enums d'effets et de fin de match. |
| `packages/shared/src/socket/fight.ts` | Contrat Socket.io. |
| `apps/backend/src/fights/engine/game-engine.ts` (créé) | Façade : `dispatch`, `setupDeck`, `timeout`, `settle`. |
| `apps/backend/src/fights/engine/rng.ts` (créé) | Port `Rng` (mélange, pile ou face). |
| `apps/backend/src/fights/engine/supported-effects.ts` (créé) | Liste des déclencheurs, conditions, actions et cibles gérés. |
| `apps/backend/src/fights/helpers/monster.factory.ts` (créé) | Création d'un `MonsterOnBoard`. |
| `apps/backend/src/fights/helpers/game-end.helper.ts` (créé) | `finishGame`. |
| `apps/backend/src/fights/helpers/game-state.helper.ts` | Accès aux joueurs, pioche, dégâts, Primes, choix, victoire. |
| `apps/backend/src/fights/effects/card-name.ts` (créé) | Normalisation et comparaison de noms de cartes. |
| `apps/backend/src/fights/effects/*`, `effects-resolver.service.ts`, `buffs-calculator.service.ts` | Résolution des effets, destruction, buffs. |
| `apps/backend/src/fights/services/*.service.ts` | Règles par domaine (phase, invocation, support, combat, choix), persistance, timer. |
| `apps/backend/src/fights/fights.service.ts`, `fights.gateway.ts` | Orchestration Socket.io, verrou par match, reconnexion. |
| `apps/backend/src/fights/testing/*` (créé) | Kit de test : cartes, scénarios, moteur, faux serveur, vraies cartes. |
| `apps/backend/src/decks/deck-rules.ts` (créé) | Validation d'un deck au lancement d'un match. |
| `apps/backend/src/database/card-effect-patches.ts` (créé) | Effets avant/après des cartes migrées (partagé entre migration et tests). |
| `apps/backend/src/database/migrations/*` (créés) | `MatchDoubleKo`, `GenericCardEffects`. |
| `apps/backend/scripts/extract-cards-snapshot.mjs` (créé) | Extraction de la table `card` du dump. |
| `apps/backend/Dockerfile` | Migrations au démarrage. |
| `apps/frontend/src/features/fight/*` | Plateau, mulligan, ciblage, reconnexion, règles, libellés. |
| `apps/frontend/src/features/deck/DeckBuilder.tsx` | Règles de deck partagées. |
| `docs/duel-cards-audit.md` (créé) | Rapport d'écarts carte par carte. |

---

### Task 1: Kit de test (scénarios et cartes de test)

**Files:**
- Create: `packages/shared/src/game/seat.ts`
- Modify: `packages/shared/src/game/index.ts`
- Create: `apps/backend/src/fights/helpers/monster.factory.ts`
- Modify: `apps/backend/src/fights/services/summon.service.ts` (construction du monstre, lignes ~131-153)
- Create: `apps/backend/src/fights/testing/cards.ts`
- Create: `apps/backend/src/fights/testing/scenario.ts`
- Test: `apps/backend/src/fights/testing/scenario.spec.ts`

**Interfaces:**
- Produces: `Seat` (`@pipou/shared`) ; `createMonsterOnBoard(card: CardInstance, opts?: { ownerUserId?: number; instanceId?: string }): MonsterOnBoard` ; `monsterCard(name, overrides?)`, `ephemeralCard(name, effects, overrides?)`, `equipmentCard(name, effects, overrides?)`, `terrainCard(name, effects, overrides?)`, `fillerCard(name?)`, `effect(trigger, actions, condition?)`, `act(type, target, extra?)` ; `scenario(spec?: ScenarioSpec): GameState`, `P1_ID = 1`, `P2_ID = 2`, `seatState(game, seat)`, `monsterNamed(game, seat, name)`, `handNames(game, seat)`, `graveyardNames(game, seat)`, `instanceOf(card, ownerId)`.

- [ ] **Step 1: Ajouter le type `Seat` dans shared**

`packages/shared/src/game/seat.ts` :

```ts
/** Siège d'un joueur dans une partie : player1 ou player2. */
export type Seat = "p1" | "p2";
```

Dans `packages/shared/src/game/index.ts`, ajouter la ligne :

```ts
export * from "./seat";
```

Run: `pnpm build:shared`
Expected: build OK.

- [ ] **Step 2: Extraire la fabrique de monstre**

`apps/backend/src/fights/helpers/monster.factory.ts` :

```ts
import { v4 as uuidv4 } from 'uuid';
import {
  CardInstance,
  MonsterOnBoard,
} from '../interfaces/game-state.interface';

/** Monstre fraîchement posé sur le terrain, sans aucun effet appliqué. */
export function createMonsterOnBoard(
  card: CardInstance,
  opts: { ownerUserId?: number; instanceId?: string } = {},
): MonsterOnBoard {
  return {
    instanceId: opts.instanceId ?? uuidv4(),
    card,
    currentHp: card.baseCard.hp,
    mode: 'attack',
    equipments: [],
    atkBuff: 0,
    hpBuff: 0,
    tempAtkBuff: 0,
    hasAttackedThisTurn: false,
    attacksPerTurn: 1,
    attacksUsedThisTurn: 0,
    hasTaunt: false,
    hasPiercing: false,
    isImmuneToDebuffs: false,
    forcedAttackMode: false,
    summonedThisTurn: true,
    doubleAtkNextTurn: false,
    turnCounter: undefined,
    ownerUserId: opts.ownerUserId,
  };
}
```

Dans `summon.service.ts`, remplacer le littéral `const instance: MonsterOnBoard = { instanceId: uuidv4(), ... ownerUserId: onOpponentZone ? userId : undefined, };` par :

```ts
    const instance = createMonsterOnBoard(monster, {
      // Mémorise le poseur quand c'est une zone adverse (Zeta)
      ownerUserId: onOpponentZone ? userId : undefined,
    });
```

Ajouter `import { createMonsterOnBoard } from '../helpers/monster.factory';`, puis retirer les imports devenus inutiles (`uuidv4` et le type `MonsterOnBoard` s'ils ne servent plus).

- [ ] **Step 3: Écrire les fabriques de cartes de test**

`apps/backend/src/fights/testing/cards.ts` :

```ts
import { CardType, Rarity, SupportType } from '@pipou/shared';
import type {
  ActionType,
  CardEffect,
  EffectAction,
  EffectCondition,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import type { Card } from '../../cards/card.entity';

let nextCardId = 10_000;

type CardOverrides = Partial<Card>;

function baseCard(overrides: CardOverrides): Card {
  return {
    id: nextCardId++,
    name: 'Carte test',
    rarity: Rarity.COMMON,
    type: CardType.MONSTER,
    atk: 0,
    hp: 0,
    cost: 0,
    supportType: null,
    archetype: null,
    effects: null,
    description: '',
    image: null,
    ...overrides,
  } as Card;
}

/** Monstre de test : 100 ATK / 500 PV, coût 0, sans effet par défaut. */
export function monsterCard(name: string, overrides: CardOverrides = {}): Card {
  return baseCard({
    name,
    type: CardType.MONSTER,
    atk: 100,
    hp: 500,
    ...overrides,
  });
}

function supportCard(
  name: string,
  supportType: SupportType,
  effects: CardEffect[],
  overrides: CardOverrides,
): Card {
  return baseCard({
    name,
    type: CardType.SUPPORT,
    supportType,
    effects,
    ...overrides,
  });
}

export const ephemeralCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => supportCard(name, SupportType.EPHEMERAL, effects, overrides);

export const equipmentCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => supportCard(name, SupportType.EQUIPMENT, effects, overrides);

export const terrainCard = (
  name: string,
  effects: CardEffect[],
  overrides: CardOverrides = {},
) => supportCard(name, SupportType.TERRAIN, effects, overrides);

/** Carte sans effet, pour remplir decks et Primes. */
export function fillerCard(name = 'Remplissage'): Card {
  return monsterCard(name, { atk: 0, hp: 100 });
}

export function effect(
  trigger: EffectTrigger,
  actions: EffectAction[],
  condition: EffectCondition | null = null,
): CardEffect {
  return { trigger, condition, actions };
}

export function act(
  type: ActionType,
  target: EffectTarget,
  extra: Partial<EffectAction> = {},
): EffectAction {
  return { type, target, ...extra };
}
```

- [ ] **Step 4: Écrire le test du ScenarioBuilder (il échoue)**

`apps/backend/src/fights/testing/scenario.spec.ts` :

```ts
import { monsterCard, equipmentCard } from './cards';
import {
  scenario,
  monsterNamed,
  handNames,
  P1_ID,
  P2_ID,
  seatState,
} from './scenario';

describe('scenario', () => {
  it('construit deux joueurs prêts, 3 zones de chaque type et 6 Primes', () => {
    const game = scenario();

    for (const seat of ['p1', 'p2'] as const) {
      const p = seatState(game, seat);
      expect(p.monsterZones).toHaveLength(3);
      expect(p.supportZones).toHaveLength(3);
      expect(p.primes).toBe(6);
      expect(p.primeDeck).toHaveLength(6);
      expect(p.deck).toHaveLength(10);
    }
    expect(game.player1.userId).toBe(P1_ID);
    expect(game.player2.userId).toBe(P2_ID);
    expect(game.currentTurnUserId).toBe(P1_ID);
    expect(game.phase).toBe('main');
    expect(game.turnNumber).toBe(2);
  });

  it('pose les monstres comme déjà en jeu, avec leurs équipements', () => {
    const game = scenario({
      p2: {
        monsters: [
          null,
          {
            card: monsterCard('Golem', { hp: 900 }),
            mode: 'guard',
            equipments: [equipmentCard('Casque', [])],
          },
        ],
      },
      turn: 'p2',
    });

    const golem = monsterNamed(game, 'p2', 'Golem');
    expect(game.player2.monsterZones[1]).toBe(golem);
    expect(golem.summonedThisTurn).toBe(false);
    expect(golem.currentHp).toBe(900);
    expect(golem.mode).toBe('guard');
    expect(golem.equipments.map((e) => e.baseCard.name)).toEqual(['Casque']);
    expect(game.currentTurnUserId).toBe(P2_ID);
  });

  it("respecte l'ordre de la main et du deck", () => {
    const game = scenario({
      p1: {
        hand: [monsterCard('A'), monsterCard('B')],
        deck: [monsterCard('C')],
      },
    });

    expect(handNames(game, 'p1')).toEqual(['A', 'B']);
    expect(game.player1.deck.map((c) => c.baseCard.name)).toEqual(['C']);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/testing/scenario`
Expected: FAIL (`Cannot find module './scenario'`).

- [ ] **Step 5: Écrire le ScenarioBuilder**

`apps/backend/src/fights/testing/scenario.ts` :

```ts
import type { CombatMode, GamePhase, Seat } from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import type {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from '../interfaces/game-state.interface';
import { createMonsterOnBoard } from '../helpers/monster.factory';
import { fillerCard } from './cards';

export interface MonsterSpec {
  card: Card;
  mode?: CombatMode;
  currentHp?: number;
  equipments?: Card[];
  /** false par défaut : le monstre est en jeu depuis un tour précédent. */
  summonedThisTurn?: boolean;
  patch?: Partial<MonsterOnBoard>;
}

export interface PlayerSpec {
  hand?: Card[];
  /** Ordre de pioche : deck[0] est la prochaine carte piochée. 10 cartes neutres par défaut. */
  deck?: Card[];
  graveyard?: Card[];
  /** Primes restant à récupérer (6 par défaut). */
  primes?: number;
  monsters?: (MonsterSpec | Card | null)[];
  supports?: (Card | null)[];
  recycleEnergy?: number;
}

export interface ScenarioSpec {
  p1?: PlayerSpec;
  p2?: PlayerSpec;
  phase?: GamePhase;
  /** Joueur actif (p1 par défaut). */
  turn?: Seat;
  turnNumber?: number;
}

export const P1_ID = 1;
export const P2_ID = 2;

let nextInstance = 1;

export function instanceOf(card: Card, ownerId: number): CardInstance {
  return {
    instanceId: `${card.name}#${nextInstance++}`,
    baseCard: card,
    ownerId,
  };
}

function buildMonster(spec: MonsterSpec | Card, ownerId: number): MonsterOnBoard {
  const s: MonsterSpec = 'card' in spec ? spec : { card: spec };
  const monster = createMonsterOnBoard(instanceOf(s.card, ownerId), {
    instanceId: `${s.card.name}@board#${nextInstance++}`,
  });
  monster.mode = s.mode ?? 'attack';
  monster.summonedThisTurn = s.summonedThisTurn ?? false;
  monster.currentHp = s.currentHp ?? s.card.hp;
  monster.equipments = (s.equipments ?? []).map((e) => instanceOf(e, ownerId));
  Object.assign(monster, s.patch);
  return monster;
}

function padTo3<T>(items: (T | null)[]): (T | null)[] {
  const out = [...items];
  while (out.length < 3) out.push(null);
  return out;
}

function buildPlayer(
  spec: PlayerSpec = {},
  userId: number,
  username: string,
): PlayerGameState {
  const primes = spec.primes ?? 6;
  return {
    userId,
    username,
    socketId: `socket-${userId}`,
    primes,
    primeDeck: Array.from({ length: primes }, () =>
      instanceOf(fillerCard('Prime'), userId),
    ),
    hand: (spec.hand ?? []).map((c) => instanceOf(c, userId)),
    deck: (spec.deck ?? Array.from({ length: 10 }, () => fillerCard())).map(
      (c) => instanceOf(c, userId),
    ),
    graveyard: (spec.graveyard ?? []).map((c) => instanceOf(c, userId)),
    banished: [],
    monsterZones: padTo3(spec.monsters ?? []).map((m) =>
      m ? buildMonster(m, userId) : null,
    ),
    supportZones: padTo3(spec.supports ?? []).map((c) =>
      c ? instanceOf(c, userId) : null,
    ),
    recycleEnergy: spec.recycleEnergy ?? 0,
    hasDrawnThisTurn: false,
    handLimitEnforced: false,
    ready: true,
  };
}

/** Partie en cours, prête à recevoir des actions (phase main du tour 2 par défaut). */
export function scenario(spec: ScenarioSpec = {}): GameState {
  return {
    matchId: 1,
    player1: buildPlayer(spec.p1, P1_ID, 'Alice'),
    player2: buildPlayer(spec.p2, P2_ID, 'Bob'),
    currentTurnUserId: (spec.turn ?? 'p1') === 'p1' ? P1_ID : P2_ID,
    phase: spec.phase ?? 'main',
    turnNumber: spec.turnNumber ?? 2,
    log: [],
  };
}

export function seatState(game: GameState, seat: Seat): PlayerGameState {
  return seat === 'p1' ? game.player1 : game.player2;
}

export function monsterNamed(
  game: GameState,
  seat: Seat,
  name: string,
): MonsterOnBoard {
  const found = seatState(game, seat).monsterZones.find(
    (z) => z?.card.baseCard.name === name,
  );
  if (!found) throw new Error(`Aucun monstre « ${name} » chez ${seat}`);
  return found;
}

export const handNames = (game: GameState, seat: Seat): string[] =>
  seatState(game, seat).hand.map((c) => c.baseCard.name);

export const graveyardNames = (game: GameState, seat: Seat): string[] =>
  seatState(game, seat).graveyard.map((c) => c.baseCard.name);
```

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights/testing/scenario`
Expected: PASS (3 tests).

Run: `pnpm --filter @pipou/backend typecheck`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/game/seat.ts packages/shared/src/game/index.ts apps/backend/src/fights/helpers/monster.factory.ts apps/backend/src/fights/services/summon.service.ts apps/backend/src/fights/testing
git commit -m "test(fights): add scenario builder and test card factories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Façade `GameEngine` découplée de Socket.io

Refactor sans changement de règles, à deux exceptions près, qui sont déjà des corrections de la spec : le timer repart après chaque action réussie (défausse, choix et timeout compris), et le test match est supprimé.

**Files:**
- Create: `packages/shared/src/game/action.ts`
- Modify: `packages/shared/src/game/index.ts`, `packages/shared/src/socket/fight.ts`
- Create: `apps/backend/src/fights/engine/game-engine.ts`
- Create: `apps/backend/src/fights/helpers/game-end.helper.ts`
- Modify: `apps/backend/src/fights/helpers/game-state.helper.ts`
- Modify: `apps/backend/src/fights/services/{phase,summon,support,battle,pick,game-end,deck-submission,matchmaking,turn-timeout}.service.ts`
- Modify: `apps/backend/src/fights/services/turn-timeout.service.spec.ts`
- Modify: `apps/backend/src/fights/fights.service.ts`, `fights.gateway.ts`, `fights.module.ts`
- Create: `apps/backend/src/fights/testing/engine.ts`
- Test: `apps/backend/src/fights/engine/game-engine.spec.ts`

**Interfaces:**
- Consumes: `scenario`, cartes de test (Task 1).
- Produces:
  - `GameAction` (`@pipou/shared`).
  - `GameEngine.dispatch(game: GameState, seat: Seat, action: GameAction): EngineResult`, `GameEngine.timeout(game: GameState): void`, `GameEngine.settle(game: GameState): void` (public) ; `EngineResult = { error?: string }`.
  - `finishGame(game, winnerUserId: number | null, reason: GameEndReason): void`.
  - `seatPlayer(game, seat): PlayerGameState`.
  - `createEngine(): GameEngine` (testing).
  - `TurnTimeoutService.schedule(matchId, onTimeout: () => Promise<void> | void)`, `.clear(matchId)`, `.has(matchId)`.
  - `GameEndService.persistResult(game): Promise<void>`.
  - `FightsService.act(matchId, userId, action, server): { error?: string }`, `FightsService.adopt(game): void`.
  - Signatures synchrones des services :
    - `PhaseService.endPhase(game, userId)`, `.discard(game, userId, handIndex)` ;
    - `SummonService.summon(game, userId, handIndex, zoneIndex, paymentHandIndices, onOpponentSide)` ;
    - `SupportService.playSupport(game, userId, handIndex, zoneIndex?, targetInstanceId?)`, `.recycleFromHand(game, userId, handIndex)`, `.changeMode(game, userId, instanceId, mode)` ;
    - `BattleService.attack(game, userId, attackerInstanceId, targetInstanceId, direct)` ;
    - `PickService.pickCards(game, userId, instanceIds)` ;
    - toutes renvoient `{ error?: string }`.

- [ ] **Step 1: Ajouter `GameAction` dans shared et retirer le test match du contrat**

`packages/shared/src/game/action.ts` :

```ts
import type { CombatMode } from "./instance";

/** Action de jeu envoyée au moteur pour un siège donné. */
export type GameAction =
  | { type: "end_phase" }
  | {
      type: "summon";
      handIndex: number;
      zoneIndex: number;
      paymentHandIndices: number[];
      onOpponentSide?: boolean;
    }
  | {
      type: "play_support";
      handIndex: number;
      zoneIndex?: number;
      targetInstanceId?: string;
    }
  | { type: "recycle"; handIndex: number }
  | { type: "change_mode"; instanceId: string; mode: CombatMode }
  | {
      type: "attack";
      attackerInstanceId: string;
      targetInstanceId?: string;
      direct?: boolean;
    }
  | { type: "discard"; handIndex: number }
  | { type: "pick_cards"; instanceIds: string[] };
```

Dans `packages/shared/src/game/index.ts`, ajouter `export * from "./action";`.

Dans `packages/shared/src/socket/fight.ts`, supprimer :
- les lignes `"fight:test_match"` et `"fight:submit_deck_test_p2"` de `ClientToServerEvents` ;
- l'interface `TestMatchFoundPayload` ;
- la ligne `"fight:test_matched"` de `ServerToClientEvents`.

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: build OK, tests PASS.

- [ ] **Step 2: Écrire les tests de caractérisation du moteur (ils échouent)**

`apps/backend/src/fights/engine/game-engine.spec.ts` :

```ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { scenario, monsterNamed, handNames, P1_ID, P2_ID } from '../testing/scenario';

describe('GameEngine — actions de base', () => {
  const engine = createEngine();

  it('invoque un monstre de coût 0 sur une zone libre', () => {
    const game = scenario({ p1: { hand: [monsterCard('Gobelin')] } });

    const result = engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 1,
      paymentHandIndices: [],
    });

    expect(result).toEqual({});
    expect(game.player1.monsterZones[1]?.card.baseCard.name).toBe('Gobelin');
    expect(game.player1.hand).toHaveLength(0);
  });

  it("refuse une action hors de son tour", () => {
    const game = scenario({ p2: { hand: [monsterCard('Gobelin')] } });

    expect(
      engine.dispatch(game, 'p2', {
        type: 'summon',
        handIndex: 0,
        zoneIndex: 0,
        paymentHandIndices: [],
      }),
    ).toEqual({ error: "Ce n'est pas ton tour" });
  });

  it("ATK contre ATK : l'attaquant gagne une Prime, le propriétaire du détruit pioche", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: {
        monsters: [monsterCard('Lutin', { atk: 100, hp: 300 })],
        deck: [monsterCard('Pioché')],
      },
    });
    const ogre = monsterNamed(game, 'p1', 'Ogre');
    const lutin = monsterNamed(game, 'p2', 'Lutin');

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: ogre.instanceId,
      targetInstanceId: lutin.instanceId,
    });

    expect(game.player2.monsterZones[0]).toBeNull();
    expect(ogre.currentHp).toBe(800);
    expect(game.player1.primes).toBe(5);
    expect(handNames(game, 'p2')).toEqual(['Pioché']);
  });

  it('attaque directe : +1 Prime pour l’attaquant, le défenseur pioche', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre')] },
      p2: { deck: [monsterCard('Pioché')] },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      direct: true,
    });

    expect(game.player1.primes).toBe(5);
    expect(handNames(game, 'p2')).toEqual(['Pioché']);
  });

  it('fin de tour : main → battle → end, puis tour adverse qui pioche', () => {
    const game = scenario({ p2: { deck: [monsterCard('Carte du tour')] } });

    for (let i = 0; i < 3; i++) {
      expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({});
    }

    expect(game.currentTurnUserId).toBe(P2_ID);
    expect(game.turnNumber).toBe(3);
    expect(game.phase).toBe('main');
    expect(handNames(game, 'p2')).toEqual(['Carte du tour']);
  });

  it("termine la partie quand un joueur a récupéré toutes ses Primes", () => {
    const game = scenario({
      phase: 'battle',
      p1: { primes: 1, monsters: [monsterCard('Ogre')] },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      direct: true,
    });

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P1_ID);
    expect(game.endReason).toBe('primes_depleted');
  });

  it('refuse toute action sur une partie terminée', () => {
    const game = scenario();
    game.phase = 'finished';

    expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({
      error: 'La partie est terminée',
    });
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/engine/game-engine`
Expected: FAIL (`Cannot find module '../testing/engine'`).

- [ ] **Step 3: Ajouter `finishGame` et `seatPlayer`**

`apps/backend/src/fights/helpers/game-end.helper.ts` :

```ts
import type {
  GameEndReason,
  GameState,
} from '../interfaces/game-state.interface';

/**
 * Termine la partie. winnerUserId null = match nul.
 * Sans effet si la partie est déjà terminée (la première fin l'emporte).
 */
export function finishGame(
  game: GameState,
  winnerUserId: number | null,
  reason: GameEndReason,
): void {
  if (game.phase === 'finished') return;
  game.phase = 'finished';
  game.winner = winnerUserId ?? undefined;
  game.endReason = reason;
  game.pendingChoice = undefined;
}
```

Dans `helpers/game-state.helper.ts`, ajouter (avec `import type { Seat } from '@pipou/shared';`) :

```ts
export function seatPlayer(game: GameState, seat: Seat): PlayerGameState {
  return seat === 'p1' ? game.player1 : game.player2;
}
```

- [ ] **Step 4: Rendre les services synchrones et sans Socket.io**

Dans chaque fichier, retirer les imports `FightServer`, `emitGameState` et `GameEndReason` devenus inutiles.

`services/phase.service.ts` : remplacer `endPhase` et `discard` par ce qui suit (`triggerTurnStart` et `processTurnCounters` ne changent pas) :

```ts
  endPhase(game: GameState, userId: number): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);

    switch (game.phase) {
      case 'main':
        game.phase = 'battle';
        addLog(game, `${player.username} → phase de combat`);
        return {};

      case 'battle':
        game.phase = 'end';
        return {};

      case 'end': {
        const surplus = player.hand.length - HAND_LIMIT;
        if (surplus > 0) {
          return { error: `Défaussez ${surplus} carte(s) avant de terminer` };
        }
        for (const z of player.monsterZones) {
          if (!z) continue;
          z.hasAttackedThisTurn = false;
          z.attacksUsedThisTurn = 0;
          z.tempAtkBuff = 0;
          z.summonedThisTurn = false;
          if (z.doubleAtkNextTurn) {
            z.attacksPerTurn = 2;
            z.doubleAtkNextTurn = false;
          }
        }
        player.recycleEnergy = 0;
        player.hasDrawnThisTurn = false;

        game.currentTurnUserId = opponent.userId;
        game.turnNumber += 1;

        this.triggerTurnStart(game, opponent);

        const drawn = drawCard(game, opponent.userId);
        if (!drawn) {
          finishGame(game, userId, 'deck_empty');
          return {};
        }
        game.phase = 'main';
        addLog(game, `─── Tour ${game.turnNumber} — ${opponent.username} ───`);
        return {};
      }

      default:
        return { error: `Phase invalide : ${game.phase}` };
    }
  }

  discard(
    game: GameState,
    userId: number,
    handIndex: number,
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'end')
      return { error: 'Défausse en phase de fin uniquement' };

    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const [card] = player.hand.splice(handIndex, 1);
    player.graveyard.push(card);
    addLog(game, `${player.username} défausse ${card.baseCard.name}`);
    return {};
  }
```

Remplacer aussi `const HAND_LIMIT = 7;` par `export const HAND_LIMIT = 7;`, et ajouter `import { finishGame } from '../helpers/game-end.helper';`.

`services/summon.service.ts` : remplacer `summonMonster` et `summonZetaOnOpponent` par une seule méthode publique :

```ts
  /** Invoque un monstre de la main, sur son terrain ou (Zeta) sur une zone adverse. */
  summon(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    onOpponentSide: boolean,
  ): { error?: string } {
    if (onOpponentSide) {
      const player = getPlayerState(game, userId);
      if (handIndex < 0 || handIndex >= player.hand.length)
        return { error: 'Index main invalide' };
      if (player.hand[handIndex].baseCard.id !== ZETA_CARD_ID)
        return { error: 'Seul Noyau Zeta peut être posé sur le terrain adverse' };
    }
    return this.doSummon(
      game,
      userId,
      handIndex,
      zoneIndex,
      paymentHandIndices,
      onOpponentSide,
    );
  }
```

Dans `doSummon` : retirer le paramètre `server` et la ligne `emitGameState(game, server);`. La méthode reste privée et renvoie `{}` à la fin.

`services/support.service.ts` :
- `playSupport(game, userId, handIndex, zoneIndex, targetInstanceId): { error?: string }` : synchrone, sans paramètres `server` ni `checkWinAndEmit`. Supprimer la ligne `await checkWinAndEmit(game, server);` et terminer par `return {};` après `log.forEach(...)`.
- `recycleFromHand(game, userId, handIndex)` : retirer `server`, `emitState` et la ligne `emitState(game, server);`.
- `changeMode(game, userId, instanceId, mode)` : idem.

`services/battle.service.ts` : `attack(game, userId, attackerInstanceId, targetInstanceId, direct): { error?: string }`, synchrone. Retirer les paramètres `server` et `checkWinAndEmit`, ainsi que les deux lignes `await checkWinAndEmit(game, server);`. La fin de l'attaque directe devient :

```ts
    if (direct) {
      gainPrime(game, userId, attacker.card.baseCard.name);
      // FIX 2 : l'adversaire perd une prime → il pioche une carte
      drawCard(game, opponent.userId);
      return {};
    }
```

et la fin de la méthode `return {};`.

`services/pick.service.ts` : retirer `server` de `pickCards` et de chaque `resolve*`, ainsi que chaque ligne `emitGameState(game, server);`.

- [ ] **Step 5: Persistance, timer, matchmaking et soumission de deck**

`services/game-end.service.ts` : supprimer `endGame` et `checkWinAndEmit`, puis ajouter :

```ts
  /** Enregistre le résultat d'une partie terminée (statut, gagnant, stats, ELO). */
  async persistResult(game: GameState): Promise<void> {
    const winnerId = game.winner ?? null;
    await this.matchRepo.update(game.matchId, {
      status: MatchStatus.FINISHED,
      winnerId,
      endReason: game.endReason ?? null,
      totalTurns: game.turnNumber,
      endedAt: new Date(),
    });
    if (winnerId === null) return;
    const loserId =
      game.player1.userId === winnerId
        ? game.player2.userId
        : game.player1.userId;
    await this.updateStats(winnerId, loserId);
  }
```

Retirer les imports devenus inutiles (`FightServer`, `emitGameState`, `addLog`, `getPlayerState`, `checkWinCondition`, `MatchEndReason`).

`services/turn-timeout.service.ts` (fichier complet) :

```ts
import { Injectable, Logger } from '@nestjs/common';

export const TURN_TIMEOUT_MS = 90_000;

@Injectable()
export class TurnTimeoutService {
  private readonly logger = new Logger(TurnTimeoutService.name);
  private timeouts = new Map<number, NodeJS.Timeout>();

  /** (Re)lance le compte à rebours du match ; onTimeout est appelé s'il expire. */
  schedule(matchId: number, onTimeout: () => Promise<void> | void): void {
    this.clear(matchId);
    const handle = setTimeout(() => {
      this.timeouts.delete(matchId);
      // Rejet non géré dans un setTimeout = arrêt du processus Node : on le rattrape
      Promise.resolve()
        .then(onTimeout)
        .catch((err: unknown) =>
          this.logger.error(
            `Timeout du match ${matchId} en échec`,
            err instanceof Error ? err.stack : String(err),
          ),
        );
    }, TURN_TIMEOUT_MS);
    this.timeouts.set(matchId, handle);
  }

  clear(matchId: number): void {
    const existing = this.timeouts.get(matchId);
    if (existing) clearTimeout(existing);
    this.timeouts.delete(matchId);
  }

  has(matchId: number): boolean {
    return this.timeouts.has(matchId);
  }
}
```

`services/turn-timeout.service.spec.ts` (fichier complet) :

```ts
import { Logger } from '@nestjs/common';
import { TurnTimeoutService } from './turn-timeout.service';

describe('TurnTimeoutService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should call onTimeout after the turn delay', async () => {
    const onTimeout = jest.fn();
    const service = new TurnTimeoutService();
    service.schedule(7, onTimeout);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(service.has(7)).toBe(false);
  });

  it('should replace the previous countdown when rescheduled', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const service = new TurnTimeoutService();
    service.schedule(7, first);
    await jest.advanceTimersByTimeAsync(60_000);
    service.schedule(7, second);

    await jest.advanceTimersByTimeAsync(60_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(30_000);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('should log a failing onTimeout instead of leaving an unhandled rejection', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    new TurnTimeoutService().schedule(7, () =>
      Promise.reject(new Error('boom')),
    );

    await jest.advanceTimersByTimeAsync(90_000);

    expect(error).toHaveBeenCalledWith(
      'Timeout du match 7 en échec',
      expect.stringContaining('boom'),
    );
  });
});
```

`services/matchmaking.service.ts` : supprimer la méthode `createMatch` (elle n'était utilisée que par le test match).

`services/deck-submission.service.ts` (fichier complet) :

```ts
import { Injectable } from '@nestjs/common';
import { DecksService } from '../../decks/decks.service';
import { GameState } from '../interfaces/game-state.interface';
import { addLog, getPlayerState, shuffle } from '../helpers/game-state.helper';

const STARTING_PRIMES = 6;
const STARTING_HAND = 5;

@Injectable()
export class DeckSubmissionService {
  constructor(private decksService: DecksService) {}

  /** Charge et installe le deck du joueur ; démarre la partie si les deux sont prêts. */
  async submitDeck(
    game: GameState,
    userId: number,
    deckId: number,
  ): Promise<{ error?: string }> {
    if (game.phase !== 'waiting') return { error: 'Le match a déjà commencé' };

    const player = getPlayerState(game, userId);
    if (player.ready) return { error: 'Deck déjà soumis' };

    let cards;
    try {
      cards = await this.decksService.loadDeckCards(deckId, userId);
    } catch {
      return { error: 'Deck invalide ou inaccessible' };
    }

    if (cards.length < 20)
      return { error: 'Le deck doit contenir au moins 20 cartes' };

    const shuffled = shuffle(cards);
    player.primeDeck = shuffled.splice(0, STARTING_PRIMES);
    player.primes = STARTING_PRIMES;
    player.deck = shuffled;
    for (let i = 0; i < STARTING_HAND; i++) {
      const c = player.deck.shift();
      if (c) player.hand.push(c);
    }
    player.ready = true;

    if (game.player1.ready && game.player2.ready) {
      game.phase = 'main';
      game.turnNumber = 1;
      addLog(game, `⚔️ Combat ! Tour 1 — ${game.player1.username} commence`);
    }
    return {};
  }
}
```

- [ ] **Step 6: Écrire la façade `GameEngine` et sa fabrique de test**

`apps/backend/src/fights/engine/game-engine.ts` :

```ts
import { Injectable } from '@nestjs/common';
import type { GameAction, Seat } from '@pipou/shared';
import { GameState } from '../interfaces/game-state.interface';
import { HAND_LIMIT, PhaseService } from '../services/phase.service';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';
import { BattleService } from '../services/battle.service';
import { PickService } from '../services/pick.service';
import {
  addLog,
  checkWinCondition,
  getPlayerState,
  seatPlayer,
} from '../helpers/game-state.helper';
import { finishGame } from '../helpers/game-end.helper';

export interface EngineResult {
  error?: string;
}

/**
 * Point d'entrée unique des règles du duel. Applique une action à l'état de
 * partie sans connaître Socket.io ni la base : l'appelant émet l'état et
 * persiste la fin de partie (phase 'finished').
 */
@Injectable()
export class GameEngine {
  constructor(
    private phase: PhaseService,
    private summon: SummonService,
    private support: SupportService,
    private battle: BattleService,
    private pick: PickService,
  ) {}

  dispatch(game: GameState, seat: Seat, action: GameAction): EngineResult {
    if (game.phase === 'finished') return { error: 'La partie est terminée' };
    const userId = seatPlayer(game, seat).userId;
    const result = this.apply(game, userId, action);
    if (!result.error) this.settle(game);
    return result;
  }

  /** Temps écoulé pour le joueur actif : défausse auto, choix annulé, phase suivante. */
  timeout(game: GameState): void {
    if (game.phase === 'finished') return;
    const player = getPlayerState(game, game.currentTurnUserId);
    addLog(game, `⏱️ Timeout — passage de phase automatique`);
    if (game.phase === 'end') {
      while (player.hand.length > HAND_LIMIT) {
        player.graveyard.push(player.hand.pop()!);
      }
    }
    game.pendingChoice = undefined;
    this.phase.endPhase(game, player.userId);
    this.settle(game);
  }

  /** Stabilise l'état après un changement : contrôle de victoire. */
  settle(game: GameState): void {
    if (game.phase === 'finished') return;
    const winner = checkWinCondition(game);
    if (winner !== null) finishGame(game, winner, 'primes_depleted');
  }

  private apply(
    game: GameState,
    userId: number,
    action: GameAction,
  ): EngineResult {
    switch (action.type) {
      case 'end_phase':
        return this.phase.endPhase(game, userId);
      case 'summon':
        return this.summon.summon(
          game,
          userId,
          action.handIndex,
          action.zoneIndex,
          action.paymentHandIndices,
          action.onOpponentSide ?? false,
        );
      case 'play_support':
        return this.support.playSupport(
          game,
          userId,
          action.handIndex,
          action.zoneIndex,
          action.targetInstanceId,
        );
      case 'recycle':
        return this.support.recycleFromHand(game, userId, action.handIndex);
      case 'change_mode':
        return this.support.changeMode(
          game,
          userId,
          action.instanceId,
          action.mode,
        );
      case 'attack':
        return this.battle.attack(
          game,
          userId,
          action.attackerInstanceId,
          action.targetInstanceId,
          action.direct ?? false,
        );
      case 'discard':
        return this.phase.discard(game, userId, action.handIndex);
      case 'pick_cards':
        return this.pick.pickCards(game, userId, action.instanceIds);
    }
  }
}
```

`apps/backend/src/fights/testing/engine.ts` :

```ts
import { GameEngine } from '../engine/game-engine';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';
import { PhaseService } from '../services/phase.service';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';
import { BattleService } from '../services/battle.service';
import { PickService } from '../services/pick.service';

/** Moteur câblé à la main, comme le ferait Nest, pour les tests. */
export function createEngine(): GameEngine {
  const effects = new EffectsResolverService();
  const buffs = new BuffsCalculatorService();
  return new GameEngine(
    new PhaseService(effects, buffs),
    new SummonService(effects, buffs),
    new SupportService(effects, buffs),
    new BattleService(effects, buffs),
    new PickService(effects),
  );
}
```

Dans `fights.module.ts`, importer `GameEngine` depuis `./engine/game-engine` et l'ajouter à `providers` (section `// Engine`).

- [ ] **Step 7: Réécrire `FightsService` et le gateway**

`apps/backend/src/fights/fights.service.ts` (fichier complet) :

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { GameAction, Seat } from '@pipou/shared';
import type { FightServer } from './fight-socket.types';
import { GameState } from './interfaces/game-state.interface';
import { PlayerStats } from './entities/player-stats.entity';
import {
  MatchmakingService,
  MatchFoundInfo,
} from './services/matchmaking.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { GameEndService } from './services/game-end.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import { GameEngine } from './engine/game-engine';
import {
  addLog,
  getPlayerState,
  getOpponentState,
} from './helpers/game-state.helper';
import { finishGame } from './helpers/game-end.helper';
import { emitGameState } from './helpers/client-state.builder';

@Injectable()
export class FightsService {
  private readonly logger = new Logger(FightsService.name);
  private games = new Map<number, GameState>();
  private userToMatch = new Map<number, number>();

  constructor(
    private matchmaking: MatchmakingService,
    private deckSubmission: DeckSubmissionService,
    private engine: GameEngine,
    private gameEnd: GameEndService,
    private turnTimeout: TurnTimeoutService,
  ) {}

  // ── Matchmaking ──────────────────────────────────────────────────────────

  async joinQueue(
    userId: number,
    username: string,
    socketId: string,
  ): Promise<MatchFoundInfo | null> {
    const result = await this.matchmaking.joinQueue(
      userId,
      username,
      socketId,
      this.userToMatch.has(userId),
    );
    if (!result) return null;

    this.adopt(
      this.matchmaking.buildInitialGameState(
        result.matchId,
        result.p1,
        result.p2,
      ),
    );
    return result;
  }

  leaveQueue(userId: number): void {
    this.matchmaking.leaveQueue(userId);
  }

  /** Prend en charge une partie déjà construite (matchmaking, tests, sandbox). */
  adopt(game: GameState): void {
    this.games.set(game.matchId, game);
    this.userToMatch.set(game.player1.userId, game.matchId);
    this.userToMatch.set(game.player2.userId, game.matchId);
  }

  // ── Partie ───────────────────────────────────────────────────────────────

  async submitDeck(
    matchId: number,
    userId: number,
    deckId: number,
    server: FightServer,
  ): Promise<{ error?: string }> {
    const game = this.games.get(matchId);
    if (!game) return { error: 'Match introuvable' };

    const result = await this.deckSubmission.submitDeck(game, userId, deckId);
    if (result.error) return result;

    if (game.phase === 'waiting') {
      server
        .to(getPlayerState(game, userId).socketId)
        .emit('fight:deck_accepted', { matchId });
    } else {
      this.afterChange(game, server);
    }
    return {};
  }

  act(
    matchId: number,
    userId: number,
    action: GameAction,
    server: FightServer,
  ): { error?: string } {
    const game = this.games.get(matchId);
    if (!game) return { error: 'Match introuvable' };

    const seat: Seat = game.player1.userId === userId ? 'p1' : 'p2';
    const result = this.engine.dispatch(game, seat, action);
    if (!result.error) this.afterChange(game, server);
    return result;
  }

  surrender(matchId: number, userId: number, server: FightServer): void {
    const game = this.games.get(matchId);
    if (!game || game.phase === 'finished') return;

    addLog(game, `🏳️ ${getPlayerState(game, userId).username} abandonne`);
    finishGame(game, getOpponentState(game, userId).userId, 'surrender');
    this.afterChange(game, server);
  }

  handleDisconnect(userId: number, server: FightServer): void {
    this.leaveQueue(userId);
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return;

    const game = this.games.get(matchId);
    if (!game || game.phase === 'finished') return;

    addLog(game, `🔌 ${getPlayerState(game, userId).username} déconnecté`);
    finishGame(game, getOpponentState(game, userId).userId, 'disconnect');
    this.afterChange(game, server);
  }

  // ── REST ─────────────────────────────────────────────────────────────────

  async getMatchHistory(userId: number, page = 1, limit = 20) {
    return this.gameEnd.getMatchHistory(userId, page, limit);
  }

  async getLeaderboard(limit = 50): Promise<PlayerStats[]> {
    return this.gameEnd.getLeaderboard(limit);
  }

  async getMyStats(userId: number): Promise<PlayerStats> {
    return this.gameEnd.getMyStats(userId);
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  /** Après tout changement : fin de partie, ou émission de l'état + relance du timer. */
  private afterChange(game: GameState, server: FightServer): void {
    if (game.phase === 'finished') {
      void this.finish(game, server);
      return;
    }
    emitGameState(game, server);
    this.turnTimeout.schedule(game.matchId, () =>
      this.onTimeout(game.matchId, server),
    );
  }

  private onTimeout(matchId: number, server: FightServer): void {
    const game = this.games.get(matchId);
    if (!game) return;
    this.engine.timeout(game);
    this.afterChange(game, server);
  }

  private async finish(game: GameState, server: FightServer): Promise<void> {
    this.turnTimeout.clear(game.matchId);
    this.cleanupGame(game);
    try {
      await this.gameEnd.persistResult(game);
    } catch (err) {
      this.logger.error(
        `Enregistrement du match ${game.matchId} en échec`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    emitGameState(game, server);
    const payload = { winner: game.winner!, endReason: game.endReason! };
    server.to(game.player1.socketId).emit('fight:game_over', payload);
    server.to(game.player2.socketId).emit('fight:game_over', payload);
  }

  private cleanupGame(game: GameState): void {
    this.games.delete(game.matchId);
    this.userToMatch.delete(game.player1.userId);
    this.userToMatch.delete(game.player2.userId);
  }
}
```

`apps/backend/src/fights/fights.gateway.ts` :
- supprimer `createTestMatch` et `submitDeckTestP2` ;
- `handleDisconnect` devient synchrone : `this.fightsService.handleDisconnect(client.data.userId, this.server);` ;
- chaque handler d'action délègue à `act` via un helper `reply`. Remplacer les handlers de `fight:end_phase` à `fight:surrender` par :

```ts
  // ── Actions de jeu ─────────────────────────────────────────────────────────

  @SubscribeMessage('fight:end_phase')
  endPhase(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: MatchPayload,
  ): void {
    this.play(client, data.matchId, { type: 'end_phase' });
  }

  @SubscribeMessage('fight:summon')
  summonMonster(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: SummonPayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'summon',
      handIndex: data.handIndex,
      zoneIndex: data.zoneIndex,
      paymentHandIndices: data.paymentHandIndices ?? [],
    });
  }

  /** Invoque Noyau Zeta sur une zone adverse vide */
  @SubscribeMessage('fight:summon_opponent')
  summonZetaOnOpponent(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: SummonPayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'summon',
      handIndex: data.handIndex,
      zoneIndex: data.zoneIndex,
      paymentHandIndices: data.paymentHandIndices ?? [],
      onOpponentSide: true,
    });
  }

  @SubscribeMessage('fight:play_support')
  playSupport(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: PlaySupportPayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'play_support',
      handIndex: data.handIndex,
      zoneIndex: data.zoneIndex,
      targetInstanceId: data.targetInstanceId,
    });
  }

  @SubscribeMessage('fight:recycle_support')
  recycleFromHand(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: RecycleSupportPayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'recycle',
      handIndex: data.handIndex,
    });
  }

  @SubscribeMessage('fight:change_mode')
  changeMode(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: ChangeModePayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'change_mode',
      instanceId: data.instanceId,
      mode: data.mode,
    });
  }

  @SubscribeMessage('fight:attack')
  attack(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: AttackPayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'attack',
      attackerInstanceId: data.attackerInstanceId,
      targetInstanceId: data.targetInstanceId,
      direct: data.direct ?? false,
    });
  }

  @SubscribeMessage('fight:discard')
  discard(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: DiscardPayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'discard',
      handIndex: data.handIndex,
    });
  }

  @SubscribeMessage('fight:pick_cards')
  pickCards(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: PickCardsPayload,
  ): void {
    this.play(client, data.matchId, {
      type: 'pick_cards',
      instanceIds: data.instanceIds,
    });
  }

  @SubscribeMessage('fight:surrender')
  surrender(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: MatchPayload,
  ): void {
    this.fightsService.surrender(data.matchId, client.data.userId, this.server);
  }

  private play(client: FightSocket, matchId: number, action: GameAction): void {
    const result = this.fightsService.act(
      matchId,
      client.data.userId,
      action,
      this.server,
    );
    if (result.error) client.emit('fight:error', { message: result.error });
  }
```

Ajouter `GameAction` à l'import de types depuis `@pipou/shared`.

- [ ] **Step 8: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS (`game-engine.spec.ts`, `turn-timeout.service.spec.ts`, `scenario.spec.ts`).

Run: `pnpm typecheck`
Expected: aucune erreur (le frontend n'utilisait pas les événements de test match).

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src apps/backend/src/fights
git commit -m "refactor(fights): route game actions through a socket-free GameEngine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Appartenance au match et verrou par match

**Files:**
- Modify: `apps/backend/src/fights/helpers/game-state.helper.ts`
- Modify: `apps/backend/src/fights/fights.service.ts`, `fights.gateway.ts`
- Modify: `apps/backend/src/fights/testing/scenario.ts` (ajout de `waitingScenario`)
- Create: `apps/backend/src/fights/testing/fake-server.ts`
- Test: `apps/backend/src/fights/fights.service.spec.ts`

**Interfaces:**
- Consumes: `createEngine`, `FightsService.adopt`, `scenario`, `instanceOf`, `fillerCard`.
- Produces:
  - `seatOf(game, userId): Seat | null` ;
  - `getPlayerState` / `getOpponentState` lèvent une erreur pour un utilisateur étranger au match ;
  - `FightsService.act`, `FightsService.surrender`, `FightsService.submitDeck` et `FightsService.handleDisconnect` deviennent async et renvoient `Promise<{ error?: string }>` (`Promise<void>` pour `handleDisconnect`) ;
  - `waitingScenario(): GameState` ;
  - `fakeServer(): { server: FightServer; emitted: Emitted[] }`.

- [ ] **Step 1: Écrire les tests (ils échouent)**

`apps/backend/src/fights/testing/fake-server.ts` :

```ts
import type { FightServer } from '../fight-socket.types';

export interface Emitted {
  room: string;
  event: string;
  payload: unknown;
}

/** Serveur Socket.io factice qui enregistre les émissions. */
export function fakeServer(): { server: FightServer; emitted: Emitted[] } {
  const emitted: Emitted[] = [];
  const server = {
    to: (room: string) => ({
      emit: (event: string, payload?: unknown) => {
        emitted.push({ room, event, payload });
        return true;
      },
    }),
  } as unknown as FightServer;
  return { server, emitted };
}
```

Dans `testing/scenario.ts`, ajouter :

```ts
/** Match créé par le matchmaking, decks pas encore soumis. */
export function waitingScenario(): GameState {
  const game = scenario({ phase: 'waiting', turnNumber: 0 });
  for (const p of [game.player1, game.player2]) {
    p.ready = false;
    p.hand = [];
    p.deck = [];
    p.primeDeck = [];
    p.primes = 0;
  }
  return game;
}
```

`apps/backend/src/fights/fights.service.spec.ts` :

```ts
import { FightsService } from './fights.service';
import { DeckSubmissionService } from './services/deck-submission.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import type { MatchmakingService } from './services/matchmaking.service';
import type { GameEndService } from './services/game-end.service';
import type { DecksService } from '../decks/decks.service';
import type { GameState } from './interfaces/game-state.interface';
import { createEngine } from './testing/engine';
import { fakeServer } from './testing/fake-server';
import { fillerCard } from './testing/cards';
import {
  scenario,
  waitingScenario,
  instanceOf,
  P1_ID,
  P2_ID,
} from './testing/scenario';

const OUTSIDER = 99;

function setup(game: GameState = scenario()) {
  const { server, emitted } = fakeServer();
  const decks = { loadDeckCards: jest.fn() };
  const gameEnd = { persistResult: jest.fn().mockResolvedValue(undefined) };
  const matchmaking = { leaveQueue: jest.fn() };
  const timer = new TurnTimeoutService();
  const service = new FightsService(
    matchmaking as unknown as MatchmakingService,
    new DeckSubmissionService(decks as unknown as DecksService),
    createEngine(),
    gameEnd as unknown as GameEndService,
    timer,
  );
  service.adopt(game);
  return { service, server, emitted, decks, gameEnd, matchmaking, timer, game };
}

describe('FightsService', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("refuse les actions d'un utilisateur étranger au match", async () => {
    const { service, server, game } = setup();
    const before = JSON.stringify(game);

    await expect(
      service.act(game.matchId, OUTSIDER, { type: 'end_phase' }, server),
    ).resolves.toEqual({ error: 'Tu ne participes pas à ce match' });
    expect(JSON.stringify(game)).toBe(before);
  });

  it("refuse l'abandon d'un utilisateur étranger au match", async () => {
    const { service, server, game, gameEnd } = setup();

    await expect(
      service.surrender(game.matchId, OUTSIDER, server),
    ).resolves.toEqual({ error: 'Tu ne participes pas à ce match' });
    expect(game.phase).toBe('main');
    expect(gameEnd.persistResult).not.toHaveBeenCalled();
  });

  it("abandon : l'adversaire gagne, le résultat est enregistré et annoncé", async () => {
    const { service, server, emitted, game, gameEnd, timer } = setup();

    await service.surrender(game.matchId, P1_ID, server);

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P2_ID);
    expect(gameEnd.persistResult).toHaveBeenCalledWith(game);
    expect(emitted.filter((e) => e.event === 'fight:game_over')).toHaveLength(2);
    expect(timer.has(game.matchId)).toBe(false);
  });

  it("émet l'état et relance le timer après une action réussie", async () => {
    const { service, server, emitted, game, timer } = setup();

    await service.act(game.matchId, P1_ID, { type: 'end_phase' }, server);

    expect(emitted.filter((e) => e.event === 'fight:state')).toHaveLength(2);
    expect(timer.has(game.matchId)).toBe(true);
  });

  it('sérialise les soumissions de deck concurrentes', async () => {
    const { service, server, decks, game } = setup(waitingScenario());
    decks.loadDeckCards.mockImplementation(() =>
      Promise.resolve(
        Array.from({ length: 20 }, (_, i) =>
          instanceOf(fillerCard(`C${i}`), P1_ID),
        ),
      ),
    );

    const [first, second] = await Promise.all([
      service.submitDeck(game.matchId, P1_ID, 5, server),
      service.submitDeck(game.matchId, P1_ID, 5, server),
    ]);

    expect(first).toEqual({});
    expect(second).toEqual({ error: 'Deck déjà soumis' });
    expect(decks.loadDeckCards).toHaveBeenCalledTimes(1);
  });

  it("refuse la soumission de deck d'un utilisateur étranger au match", async () => {
    const { service, server, game } = setup(waitingScenario());

    await expect(
      service.submitDeck(game.matchId, OUTSIDER, 5, server),
    ).resolves.toEqual({ error: 'Tu ne participes pas à ce match' });
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/fights.service`
Expected: FAIL (`act` n'est pas async, pas de contrôle d'appartenance).

- [ ] **Step 2: Rendre les accès joueurs stricts**

Dans `helpers/game-state.helper.ts`, remplacer `getPlayerState` et `getOpponentState` par :

```ts
export function seatOf(game: GameState, userId: number): Seat | null {
  if (game.player1.userId === userId) return 'p1';
  if (game.player2.userId === userId) return 'p2';
  return null;
}

export function getPlayerState(
  game: GameState,
  userId: number,
): PlayerGameState {
  const seat = seatOf(game, userId);
  if (!seat)
    throw new Error(`Joueur ${userId} absent du match ${game.matchId}`);
  return seatPlayer(game, seat);
}

export function getOpponentState(
  game: GameState,
  userId: number,
): PlayerGameState {
  const seat = seatOf(game, userId);
  if (!seat)
    throw new Error(`Joueur ${userId} absent du match ${game.matchId}`);
  return seatPlayer(game, seat === 'p1' ? 'p2' : 'p1');
}
```

- [ ] **Step 3: Verrou par match et contrôle d'appartenance dans `FightsService`**

Dans `fights.service.ts` :

1. Ajouter la constante de module et le verrou :

```ts
const NOT_IN_MATCH = 'Tu ne participes pas à ce match';
```

```ts
  private locks = new Map<number, Promise<unknown>>();

  /** Exécute fn après les opérations déjà en cours sur ce match. */
  private withLock<T>(matchId: number, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.locks.get(matchId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(fn);
    this.locks.set(matchId, run);
    run
      .finally(() => {
        if (this.locks.get(matchId) === run) this.locks.delete(matchId);
      })
      .catch(() => undefined);
    return run;
  }
```

2. Importer `seatOf` depuis le helper, et retirer l'import du type `Seat`.

3. Remplacer `submitDeck`, `act`, `surrender`, `handleDisconnect`, `afterChange` et `onTimeout` par :

```ts
  submitDeck(
    matchId: number,
    userId: number,
    deckId: number,
    server: FightServer,
  ): Promise<{ error?: string }> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game) return { error: 'Match introuvable' };
      if (!seatOf(game, userId)) return { error: NOT_IN_MATCH };

      const result = await this.deckSubmission.submitDeck(game, userId, deckId);
      if (result.error) return result;

      if (game.phase === 'waiting') {
        server
          .to(getPlayerState(game, userId).socketId)
          .emit('fight:deck_accepted', { matchId });
      } else {
        await this.afterChange(game, server);
      }
      return {};
    });
  }

  act(
    matchId: number,
    userId: number,
    action: GameAction,
    server: FightServer,
  ): Promise<{ error?: string }> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game) return { error: 'Match introuvable' };
      const seat = seatOf(game, userId);
      if (!seat) return { error: NOT_IN_MATCH };

      const result = this.engine.dispatch(game, seat, action);
      if (!result.error) await this.afterChange(game, server);
      return result;
    });
  }

  surrender(
    matchId: number,
    userId: number,
    server: FightServer,
  ): Promise<{ error?: string }> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game || game.phase === 'finished')
        return { error: 'Match introuvable' };
      if (!seatOf(game, userId)) return { error: NOT_IN_MATCH };

      addLog(game, `🏳️ ${getPlayerState(game, userId).username} abandonne`);
      finishGame(game, getOpponentState(game, userId).userId, 'surrender');
      await this.afterChange(game, server);
      return {};
    });
  }

  handleDisconnect(userId: number, server: FightServer): Promise<void> {
    this.leaveQueue(userId);
    const matchId = this.userToMatch.get(userId);
    if (!matchId) return Promise.resolve();

    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game || game.phase === 'finished') return;
      addLog(game, `🔌 ${getPlayerState(game, userId).username} déconnecté`);
      finishGame(game, getOpponentState(game, userId).userId, 'disconnect');
      await this.afterChange(game, server);
    });
  }
```

```ts
  /** Après tout changement : fin de partie, ou émission de l'état et relance du timer. */
  private async afterChange(game: GameState, server: FightServer): Promise<void> {
    if (game.phase === 'finished') {
      await this.finish(game, server);
      return;
    }
    emitGameState(game, server);
    this.turnTimeout.schedule(game.matchId, () =>
      this.onTimeout(game.matchId, server),
    );
  }

  private onTimeout(matchId: number, server: FightServer): Promise<void> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game) return;
      this.engine.timeout(game);
      await this.afterChange(game, server);
    });
  }
```

4. Dans `fights.gateway.ts`, les handlers deviennent async et attendent le service :

```ts
  async handleDisconnect(client: FightSocket): Promise<void> {
    if (client.data.userId) {
      await this.fightsService.handleDisconnect(client.data.userId, this.server);
    }
  }
```

```ts
  @SubscribeMessage('fight:surrender')
  async surrender(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: MatchPayload,
  ): Promise<void> {
    this.reply(
      client,
      await this.fightsService.surrender(
        data.matchId,
        client.data.userId,
        this.server,
      ),
    );
  }

  private async play(
    client: FightSocket,
    matchId: number,
    action: GameAction,
  ): Promise<void> {
    this.reply(
      client,
      await this.fightsService.act(
        matchId,
        client.data.userId,
        action,
        this.server,
      ),
    );
  }

  private reply(client: FightSocket, result: { error?: string }): void {
    if (result.error) client.emit('fight:error', { message: result.error });
  }
```

Chaque handler d'action devient `async xxx(...): Promise<void> { await this.play(client, data.matchId, {...}); }`. Le handler `fight:submit_deck` devient `this.reply(client, await this.fightsService.submitDeck(data.matchId, client.data.userId, data.deckId, this.server));`.

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

Run: `pnpm --filter @pipou/backend typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/fights
git commit -m "fix(fights): reject actions from non-players and serialize match operations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Victoire vérifiée partout, match nul (double K.O.)

**Files:**
- Modify: `packages/shared/src/enums/match.ts`, `packages/shared/src/enums/enums.test.ts`, `packages/shared/src/socket/fight.ts`
- Modify: `apps/backend/src/fights/helpers/game-state.helper.ts` (`checkWinCondition`)
- Modify: `apps/backend/src/fights/engine/game-engine.ts` (`settle`)
- Modify: `apps/backend/src/fights/services/game-end.service.ts`
- Modify: `apps/backend/src/fights/fights.service.ts` (`finish`)
- Create: `apps/backend/src/database/migrations/1791000000000-MatchDoubleKo.ts`
- Modify: `apps/backend/package.json` (scripts `migration:run:local` et `migration:revert:local`)
- Modify: `apps/frontend/src/features/fight/FightPage.tsx`, `FightLobby.tsx`, `MatchHistory.tsx`
- Test: `apps/backend/src/fights/engine/game-end.spec.ts`, `apps/backend/src/fights/services/game-end.service.spec.ts`

**Interfaces:**
- Produces:
  - `MatchEndReason.DOUBLE_KO = "double_ko"` ;
  - `GameOverPayload.winner: number | null` ;
  - `checkWinCondition(game): { winnerUserId: number | null } | null` ;
  - `calcElo(eloA, eloB, scoreA): [number, number]`, exporté par `game-end.service.ts`.

- [ ] **Step 1: Tests moteur (ils échouent)**

`apps/backend/src/fights/engine/game-end.spec.ts` :

```ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { scenario, monsterNamed, P1_ID } from '../testing/scenario';

describe('GameEngine — fin de partie', () => {
  const engine = createEngine();

  it('double K.O. qui vide les deux compteurs de Primes : match nul', () => {
    const game = scenario({
      phase: 'battle',
      p1: { primes: 1, monsters: [monsterCard('Ogre', { atk: 500, hp: 500 })] },
      p2: { primes: 1, monsters: [monsterCard('Troll', { atk: 500, hp: 500 })] },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      targetInstanceId: monsterNamed(game, 'p2', 'Troll').instanceId,
    });

    expect(game.phase).toBe('finished');
    expect(game.winner).toBeUndefined();
    expect(game.endReason).toBe('double_ko');
  });

  it("la Prime d'un compteur de tour expiré peut faire gagner la partie", () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p1: { primes: 1 },
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

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P1_ID);
    expect(game.endReason).toBe('primes_depleted');
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/engine/game-end`
Expected: FAIL. Le premier test donne la victoire au joueur 1 avec la raison `primes_depleted`.

- [ ] **Step 2: Shared — fin de match nulle**

Dans `packages/shared/src/enums/match.ts`, ajouter `DOUBLE_KO: "double_ko",` à `MatchEndReason`.

Dans `enums.test.ts`, la ligne attendue devient :

```ts
    ["MatchEndReason", MatchEndReason, ["primes_depleted", "deck_empty", "surrender", "disconnect", "double_ko"]],
```

Dans `socket/fight.ts` :

```ts
export interface GameOverPayload {
  /** null = match nul. */
  winner: number | null;
  endReason: GameEndReason;
}
```

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: PASS.

- [ ] **Step 3: Victoire et nul dans le moteur**

Dans `helpers/game-state.helper.ts`, remplacer `checkWinCondition` :

```ts
/** Joueur ayant récupéré toutes ses Primes ; winnerUserId null si les deux (match nul). */
export function checkWinCondition(
  game: GameState,
): { winnerUserId: number | null } | null {
  const p1Done = game.player1.primes <= 0;
  const p2Done = game.player2.primes <= 0;
  if (p1Done && p2Done) return { winnerUserId: null };
  if (p1Done) return { winnerUserId: game.player1.userId };
  if (p2Done) return { winnerUserId: game.player2.userId };
  return null;
}
```

Dans `engine/game-engine.ts`, la fin de `settle` devient :

```ts
    const outcome = checkWinCondition(game);
    if (outcome)
      finishGame(
        game,
        outcome.winnerUserId,
        outcome.winnerUserId === null ? 'double_ko' : 'primes_depleted',
      );
```

Dans `fights.service.ts` (`finish`), l'objet émis devient : `const payload = { winner: game.winner ?? null, endReason: game.endReason! };`.

Run: `pnpm --filter @pipou/backend exec jest fights/engine`
Expected: PASS.

- [ ] **Step 4: Test de persistance (il échoue)**

`apps/backend/src/fights/services/game-end.service.spec.ts` :

```ts
import { GameEndService, calcElo } from './game-end.service';
import { scenario, P1_ID, P2_ID } from '../testing/scenario';

function setup() {
  const stats = new Map<number, Record<string, number>>();
  const matchRepo = { update: jest.fn().mockResolvedValue(undefined) };
  const statsRepo = {
    findOne: jest.fn(({ where }: { where: { userId: number } }) =>
      Promise.resolve(stats.get(where.userId) ?? null),
    ),
    create: jest.fn((s: { userId: number }) => {
      const row = { wins: 0, losses: 0, draws: 0, elo: 1000, ...s };
      stats.set(s.userId, row);
      return row;
    }),
    save: jest.fn((s: unknown) => Promise.resolve(s)),
  };
  const service = new GameEndService(matchRepo as never, statsRepo as never);
  return { service, matchRepo, stats };
}

describe('GameEndService.persistResult', () => {
  it('match nul : aucun gagnant, un nul pour chacun, ELO inchangé à niveau égal', async () => {
    const { service, matchRepo, stats } = setup();
    const game = scenario();
    game.phase = 'finished';
    game.endReason = 'double_ko';

    await service.persistResult(game);

    expect(matchRepo.update).toHaveBeenCalledWith(
      game.matchId,
      expect.objectContaining({ winnerId: null, endReason: 'double_ko' }),
    );
    expect(stats.get(P1_ID)).toMatchObject({ draws: 1, wins: 0, losses: 0, elo: 1000 });
    expect(stats.get(P2_ID)).toMatchObject({ draws: 1, wins: 0, losses: 0, elo: 1000 });
  });

  it('victoire : +1 victoire, +1 défaite et ±16 ELO à niveau égal', async () => {
    const { service, stats } = setup();
    const game = scenario();
    game.phase = 'finished';
    game.winner = P1_ID;
    game.endReason = 'surrender';

    await service.persistResult(game);

    expect(stats.get(P1_ID)).toMatchObject({ wins: 1, elo: 1016 });
    expect(stats.get(P2_ID)).toMatchObject({ losses: 1, elo: 984 });
  });
});

describe('calcElo', () => {
  it('ne descend jamais sous 100', () => {
    expect(calcElo(2000, 100, 1)[1]).toBe(100);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/services/game-end`
Expected: FAIL (`calcElo` n'est pas exporté, et un nul ne met rien à jour).

- [ ] **Step 5: Persistance du nul et ELO à 0,5**

Dans `services/game-end.service.ts`, remplacer `persistResult`, puis supprimer `updateStats` et la méthode privée `calcElo` :

```ts
  /** Enregistre le résultat d'une partie terminée (statut, gagnant, stats, ELO). */
  async persistResult(game: GameState): Promise<void> {
    const winnerId = game.winner ?? null;
    await this.matchRepo.update(game.matchId, {
      status: MatchStatus.FINISHED,
      winnerId,
      endReason: game.endReason ?? null,
      totalTurns: game.turnNumber,
      endedAt: new Date(),
    });

    const [s1, s2] = await Promise.all([
      this.getOrCreateStats(game.player1.userId),
      this.getOrCreateStats(game.player2.userId),
    ]);
    const score1 =
      winnerId === null ? 0.5 : winnerId === game.player1.userId ? 1 : 0;
    if (score1 === 1) {
      s1.wins += 1;
      s2.losses += 1;
    } else if (score1 === 0) {
      s1.losses += 1;
      s2.wins += 1;
    } else {
      s1.draws += 1;
      s2.draws += 1;
    }
    [s1.elo, s2.elo] = calcElo(s1.elo, s2.elo, score1);
    await this.statsRepo.save([s1, s2]);
  }
```

et, hors de la classe :

```ts
/** ELO après une partie ; scoreA = 1 (A gagne), 0,5 (nul) ou 0 (A perd). Plancher à 100. */
export function calcElo(
  eloA: number,
  eloB: number,
  scoreA: number,
): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
  const deltaA = ELO_K * (scoreA - expectedA);
  return [
    Math.max(100, Math.round(eloA + deltaA)),
    Math.max(100, Math.round(eloB - deltaA)),
  ];
}
```

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

- [ ] **Step 6: Migration de schéma et scripts locaux**

`apps/backend/src/database/migrations/1791000000000-MatchDoubleKo.ts` :

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ajoute la fin de match « double_ko » (match nul). */
export class MatchDoubleKo1791000000000 implements MigrationInterface {
  name = 'MatchDoubleKo1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `match` MODIFY `end_reason` enum('primes_depleted','deck_empty','surrender','disconnect','double_ko') NULL DEFAULT NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `match` SET `end_reason` = NULL WHERE `end_reason` = 'double_ko'",
    );
    await queryRunner.query(
      "ALTER TABLE `match` MODIFY `end_reason` enum('primes_depleted','deck_empty','surrender','disconnect') NULL DEFAULT NULL",
    );
  }
}
```

Dans `apps/backend/package.json`, ajouter après `migration:revert` :

```json
    "migration:run:local": "dotenv -e .env.e2e -- node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d src/database/data-source.ts migration:run",
    "migration:revert:local": "dotenv -e .env.e2e -- node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d src/database/data-source.ts migration:revert",
```

La migration sera exécutée en local en Task 15. Ne lancer **aucun** script `migration:*` sans le suffixe `:local`.

- [ ] **Step 7: Frontend — afficher le match nul**

Dans `apps/frontend/src/features/fight/FightPage.tsx`, le handler `fight:game_over` devient :

```tsx
    socket.on("fight:game_over", ({ winner, endReason }) => {
      setStatus("finished");
      if (timerRef.current) clearInterval(timerRef.current);
      if (winner === null) {
        showToast(`🤝 Match nul (${endReason})`, "ok");
      } else {
        showToast(
          winner === userId
            ? `🎉 Victoire ! (${endReason})`
            : `💀 Défaite… (${endReason})`,
          winner === userId ? "ok" : "err",
        );
      }
      setTimeout(() => refetchHistory(), 2000);
    });
```

Dans `FightLobby.tsx`, le bloc `status === "finished"` devient (avec `import { MatchEndReason } from "@pipou/shared";`) :

```tsx
  if (status === "finished") {
    const draw = endReason === MatchEndReason.DOUBLE_KO;
    const won = !draw && winner === userId;
    return (
      <div className="lobby-center">
        <div className="lobby-result-icon">{draw ? "🤝" : won ? "🏆" : "💀"}</div>
        <h2
          className={`lobby-hero-title ${draw ? "" : won ? "lobby-hero-title--win" : "lobby-hero-title--loss"}`}
        >
          {draw ? "Match nul" : won ? "Victoire !" : "Défaite"}
        </h2>
        <p className="lobby-muted">{endReason}</p>
        <Button size="lg" onClick={onReplay}>
          Rejouer
        </Button>
      </div>
    );
  }
```

Dans `MatchHistory.tsx` (avec `import { MatchEndReason } from "@pipou/shared";`), remplacer `const won = m.winner?.id === myUserId;` par :

```tsx
            const draw = m.endReason === MatchEndReason.DOUBLE_KO;
            const won = !draw && m.winner?.id === myUserId;
```

Remplacer ensuite :
- l'icône par `{draw ? "🤝" : won ? "🏆" : "💀"}` ;
- le libellé par `{draw ? "Nul" : won ? "Victoire" : "Défaite"}`.

Les classes `--win` / `--loss` restent inchangées : un nul s'affiche comme une ligne neutre « loss ».

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src apps/backend/src apps/backend/package.json apps/frontend/src/features/fight
git commit -m "feat(fights): check the win condition after every change and support draws

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Destruction de monstre centralisée

**Files:**
- Modify: `apps/backend/src/fights/effects-resolver.service.ts` (réécriture)
- Modify: `apps/backend/src/fights/effects/effect-actions.applier.ts`
- Modify: `apps/backend/src/fights/helpers/game-state.helper.ts` (suppression de `removeMonster`)
- Modify: `apps/backend/src/fights/services/battle.service.ts`, `phase.service.ts`, `pick.service.ts`
- Test: `apps/backend/src/fights/engine/destruction.spec.ts`

**Interfaces:**
- Produces:
  - `EffectsResolverService.destroyMonster(game, host: PlayerGameState, instanceId: string, log: string[], opts: { draw: boolean }): MonsterOnBoard | null` ;
  - `applyActions(effect, card, ctx, destroy: (host: PlayerGameState, instanceId: string) => void)`.

- [ ] **Step 1: Tests (ils échouent)**

`apps/backend/src/fights/engine/destruction.spec.ts` :

```ts
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  ephemeralCard,
  equipmentCard,
  monsterCard,
} from '../testing/cards';
import {
  graveyardNames,
  handNames,
  monsterNamed,
  scenario,
  P1_ID,
} from '../testing/scenario';

describe('GameEngine — destruction', () => {
  const engine = createEngine();

  it('combat : ON_DEATH, monstre et équipement au cimetière, le propriétaire pioche', () => {
    const lutin = monsterCard('Lutin', {
      atk: 0,
      hp: 300,
      effects: [
        effect(EffectTrigger.ON_DEATH, [act(ActionType.DRAW, EffectTarget.PLAYER)]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 600, hp: 900 })] },
      p2: {
        monsters: [{ card: lutin, equipments: [equipmentCard('Casque', [])] }],
        deck: [monsterCard('A'), monsterCard('B')],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'attack',
      attackerInstanceId: monsterNamed(game, 'p1', 'Ogre').instanceId,
      targetInstanceId: monsterNamed(game, 'p2', 'Lutin').instanceId,
    });

    expect(graveyardNames(game, 'p2')).toEqual(['Casque', 'Lutin']);
    expect(handNames(game, 'p2')).toEqual(['A', 'B']);
  });

  it("effet de l'adversaire : la victime pioche", () => {
    const meteore = ephemeralCard('Météore', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 1000 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [meteore] },
      p2: { monsters: [monsterCard('Lutin')], deck: [monsterCard('A')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(game.player2.monsterZones[0]).toBeNull();
    expect(handNames(game, 'p2')).toEqual(['A']);
  });

  it('sacrifice par son propre effet : pas de pioche', () => {
    const sacrifice = ephemeralCard('Sacrifice', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.DESTROY_MONSTER, EffectTarget.ALL_ALLIES),
      ]),
    ]);
    const game = scenario({
      p1: {
        hand: [sacrifice],
        monsters: [monsterCard('Pion')],
        deck: [monsterCard('A')],
      },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(game.player1.monsterZones[0]).toBeNull();
    expect(handNames(game, 'p1')).toEqual([]);
  });

  it("compteur de tour expiré : Prime pour le poseur, pas de pioche pour l'hôte", () => {
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

    expect(game.player1.primes).toBe(5);
    expect(graveyardNames(game, 'p2')).toEqual(['Virus']);
    expect(handNames(game, 'p2')).toEqual([]);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/engine/destruction`
Expected: FAIL (le sacrifice fait piocher).

- [ ] **Step 2: Point d'entrée unique `destroyMonster`**

`apps/backend/src/fights/effects-resolver.service.ts` (fichier complet) :

```ts
import { Injectable } from '@nestjs/common';
import { EffectTrigger } from '@pipou/shared';
import {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from './interfaces/game-state.interface';
import type { EffectContext } from './effects/effect-context.interface';
import { checkCondition } from './effects/effect-conditions';
import { applyActions } from './effects/effect-actions.applier';
import { drawCard } from './helpers/game-state.helper';

export type { EffectContext };

/**
 * EffectsResolverService — orchestrateur des effets de cartes.
 *
 * Conditions → effects/effect-conditions.ts
 * Cibles     → effects/effect-targets.resolver.ts (dans l'applier)
 * Actions    → effects/effect-actions.applier.ts
 */
@Injectable()
export class EffectsResolverService {
  resolve(
    card: CardInstance,
    trigger: EffectTrigger,
    ctx: EffectContext,
  ): boolean {
    const effects = card.baseCard.effects;
    if (!effects?.length) return false;

    let changed = false;
    for (const effect of effects) {
      if (effect.trigger !== trigger) continue;
      if (!checkCondition(effect, ctx)) continue;
      applyActions(effect, card, ctx, (host, instanceId) =>
        this.destroyMonster(ctx.game, host, instanceId, ctx.log, {
          // Sacrifice par son propre effet : pas de pioche
          draw: host.userId !== ctx.ownerUserId,
        }),
      );
      changed = true;
    }
    return changed;
  }

  /**
   * Détruit un monstre : ON_DEATH (monstre encore en jeu), puis monstre et
   * équipements au cimetière de l'hôte, puis pioche de l'hôte si demandée.
   */
  destroyMonster(
    game: GameState,
    host: PlayerGameState,
    instanceId: string,
    log: string[],
    opts: { draw: boolean },
  ): MonsterOnBoard | null {
    const monster = host.monsterZones.find((m) => m?.instanceId === instanceId);
    if (!monster) return null;

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
}
```

Dans `helpers/game-state.helper.ts`, supprimer `removeMonster` et les imports `EffectTrigger` et `EffectsResolverService`. Ces imports créaient une dépendance circulaire.

- [ ] **Step 3: Brancher l'applier, le combat, les compteurs et les choix**

`effects/effect-actions.applier.ts` :
- le 4ᵉ paramètre devient `destroy: (host: PlayerGameState, instanceId: string) => void` ;
- dans `DEAL_DAMAGE` et `DESTROY_MONSTER`, remplacer chaque `resolveOnDeath(target.instanceId, targets.ownerOfMonster(target), ctx)` par `destroy(targets.ownerOfMonster(target), target.instanceId)`.

`services/battle.service.ts` : remplacer tout le bloc `if (target.mode === 'attack') { ... } else { ... }` et ce qui suit jusqu'à la fin de la méthode par :

```ts
    const log: string[] = [];
    const destroy = (host: PlayerGameState, m: MonsterOnBoard) =>
      this.effectsResolver.destroyMonster(game, host, m.instanceId, log, {
        draw: true,
      });

    if (target.mode === 'attack') {
      applyDamage(attacker, targetAtk);
      applyDamage(target, attackerAtk);

      const aDied = attacker.currentHp <= 0;
      const tDied = target.currentHp <= 0;

      if (aDied && tDied) {
        addLog(
          game,
          `⚔️ Double KO ! ${attacker.card.baseCard.name} & ${target.card.baseCard.name} — chacun récupère une Prime`,
        );
        destroy(player, attacker);
        destroy(opponent, target);
        gainPrime(game, userId, attacker.card.baseCard.name);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
      } else if (tDied) {
        addLog(
          game,
          `⚔️ ${attacker.card.baseCard.name} détruit ${target.card.baseCard.name}`,
        );
        destroy(opponent, target);
        gainPrime(game, userId, attacker.card.baseCard.name);
      } else if (aDied) {
        addLog(
          game,
          `⚔️ ${target.card.baseCard.name} détruit ${attacker.card.baseCard.name}`,
        );
        destroy(player, attacker);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
      } else {
        addLog(
          game,
          `⚔️ Duel : ${attacker.card.baseCard.name} (${attacker.currentHp}HP) vs ${target.card.baseCard.name} (${target.currentHp}HP)`,
        );
      }
    } else {
      // ATK vs GUARD
      applyDamage(target, attackerAtk);

      if (target.currentHp <= 0) {
        destroy(opponent, target);
        if (attacker.hasPiercing) {
          gainPrime(game, userId, attacker.card.baseCard.name);
          addLog(
            game,
            `⚔️ Attaque Perçante ! ${attacker.card.baseCard.name} perce la Garde et gagne une Prime`,
          );
        } else {
          addLog(
            game,
            `🛡️ ${attacker.card.baseCard.name} brise la Garde de ${target.card.baseCard.name} — aucune Prime`,
          );
        }
      } else {
        addLog(
          game,
          `🛡️ ${attacker.card.baseCard.name} attaque ${target.card.baseCard.name} (${target.currentHp}HP) — Garde tient`,
        );
      }
    }

    log.forEach((l) => addLog(game, l));
    this.buffsCalc.recalculate(player);
    this.buffsCalc.recalculate(opponent);
    return {};
```

Ajuster les imports : retirer `removeMonster`, ajouter les types `MonsterOnBoard` et `PlayerGameState`.

`services/phase.service.ts`, dans `processTurnCounters` : remplacer tout ce qui suit la ligne `log.push(`💀 ${zone.card.baseCard.name} s'autodétruit !`);` jusqu'à `zones[idx] = null;` inclus par :

```ts
        // Prime pour le poseur (player = le joueur dont c'est le tour)
        gainPrime(game, player.userId, zone.card.baseCard.name);
        this.effectsResolver.destroyMonster(game, host, zone.instanceId, log, {
          draw: false,
        });
```

Importer `gainPrime` depuis le helper.

`services/pick.service.ts`, dans `resolveDestroyAlly` : remplacer la résolution d'ON_DEATH, le `push` au cimetière et la remise à `null` de la zone par :

```ts
    const log: string[] = [];
    this.effectsResolver.destroyMonster(game, player, instanceId, log, {
      draw: false,
    });
    log.forEach((l) => addLog(game, l));
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/fights
git commit -m "fix(fights): destroy monsters through a single entry point with a fixed order

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Buffs permanents, passifs conditionnels et recalcul global

**Files:**
- Modify: `packages/shared/src/game/instance.ts`
- Modify: `apps/backend/src/fights/helpers/monster.factory.ts`
- Modify: `apps/backend/src/fights/buffs-calculator.service.ts` (réécriture)
- Modify: `apps/backend/src/fights/effects/effect-actions.applier.ts`
- Modify: `apps/backend/src/fights/engine/game-engine.ts`, `apps/backend/src/fights/testing/engine.ts`
- Modify: `apps/backend/src/fights/services/{phase,summon,support,battle}.service.ts` (retrait de `BuffsCalculatorService`)
- Test: `apps/backend/src/fights/engine/buffs.spec.ts`

**Interfaces:**
- Produces:
  - `MonsterPermanentStats` et `MonsterOnBoard.perm` (shared) ;
  - `BuffsCalculatorService.recalculate(game: GameState): void` ;
  - constructeur `GameEngine(phase, summon, support, battle, pick, effects: EffectsResolverService, buffs: BuffsCalculatorService)` ;
  - les services `PhaseService`, `SummonService`, `SupportService` et `BattleService` ne prennent plus que `effectsResolver`.

- [ ] **Step 1: Tests (ils échouent)**

`apps/backend/src/fights/engine/buffs.spec.ts` :

```ts
import {
  ActionType,
  Archetype,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import {
  act,
  effect,
  equipmentCard,
  monsterCard,
  terrainCard,
} from '../testing/cards';
import { graveyardNames, monsterNamed, scenario } from '../testing/scenario';

const { PASSIVE, ON_SUMMON } = EffectTrigger;

/** Lieutenant à la Bidouille/Fripouille : +150/+150 si son binôme est sur le terrain. */
const lieutenant = (name: string, partner: string, hp: number) =>
  monsterCard(name, {
    atk: 300,
    hp,
    effects: [
      effect(
        PASSIVE,
        [
          act(ActionType.BUFF_ATK, EffectTarget.SELF, { value: 150 }),
          act(ActionType.BUFF_HP, EffectTarget.SELF, { value: 150 }),
        ],
        { type: EffectConditionType.SPECIFIC_CARD_ON_BOARD, value: partner },
      ),
    ],
  });

describe('GameEngine — buffs', () => {
  const engine = createEngine();

  it('un buff ON_SUMMON est permanent malgré les recalculs suivants', () => {
    const heraut = monsterCard('Héraut', {
      effects: [
        effect(ON_SUMMON, [
          act(ActionType.BUFF_ATK, EffectTarget.ALL_ALLIES, { value: 200 }),
        ]),
      ],
    });
    const game = scenario({
      p1: {
        monsters: [monsterCard('Allié')],
        hand: [heraut, monsterCard('Recrue')],
      },
    });

    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 1, paymentHandIndices: [] });
    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 2, paymentHandIndices: [] });

    expect(monsterNamed(game, 'p1', 'Allié').atkBuff).toBe(200);
    expect(monsterNamed(game, 'p1', 'Héraut').atkBuff).toBe(200);
    expect(monsterNamed(game, 'p1', 'Recrue').atkBuff).toBe(0);
  });

  it("un passif conditionnel ne s'applique que si sa condition est remplie", () => {
    const game = scenario({
      p1: {
        monsters: [lieutenant('Bidouille', 'Fripouille', 500)],
        hand: [lieutenant('Fripouille', 'Bidouille', 700)],
      },
    });

    engine.settle(game);
    expect(monsterNamed(game, 'p1', 'Bidouille').atkBuff).toBe(0);

    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 1, paymentHandIndices: [] });

    const bidouille = monsterNamed(game, 'p1', 'Bidouille');
    expect(bidouille.atkBuff).toBe(150);
    expect(bidouille.currentHp).toBe(650);
    expect(monsterNamed(game, 'p1', 'Fripouille').currentHp).toBe(850);
  });

  it('perdre un bonus de PV max plafonne les PV courants', () => {
    const game = scenario({
      p1: {
        monsters: [
          lieutenant('Bidouille', 'Fripouille', 500),
          lieutenant('Fripouille', 'Bidouille', 700),
        ],
      },
    });
    engine.settle(game);
    game.player1.monsterZones[1] = null;

    engine.settle(game);

    const bidouille = monsterNamed(game, 'p1', 'Bidouille');
    expect(bidouille.atkBuff).toBe(0);
    expect(bidouille.currentHp).toBe(500);
  });

  it('un monstre qui tombe à 0 PV en perdant un bonus est détruit', () => {
    const game = scenario({
      p1: {
        monsters: [
          lieutenant('Bidouille', 'Fripouille', 500),
          lieutenant('Fripouille', 'Bidouille', 700),
        ],
      },
    });
    engine.settle(game);
    monsterNamed(game, 'p1', 'Bidouille').currentHp = 100;
    game.player1.monsterZones[1] = null;

    engine.settle(game);

    expect(game.player1.monsterZones[0]).toBeNull();
    expect(graveyardNames(game, 'p1')).toContain('Bidouille');
  });

  it("un terrain ARCHETYPE_ALLIES ne buffe que l'archétype visé", () => {
    const terrain = terrainCard('Fanfare', [
      effect(PASSIVE, [
        act(ActionType.BUFF_ATK, EffectTarget.ARCHETYPE_ALLIES, {
          value: 300,
          archetype: Archetype.PIPOU,
        }),
      ]),
    ]);
    const game = scenario({
      p1: {
        supports: [terrain],
        monsters: [
          monsterCard('Pipou', { archetype: Archetype.PIPOU }),
          monsterCard('Dragon', { archetype: Archetype.DRAGON }),
        ],
      },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Pipou').atkBuff).toBe(300);
    expect(monsterNamed(game, 'p1', 'Dragon').atkBuff).toBe(0);
  });

  it('un passif ALL_ALLIES de monstre buffe tous les alliés', () => {
    const banniere = monsterCard('Bannière', {
      effects: [
        effect(PASSIVE, [
          act(ActionType.BUFF_ATK, EffectTarget.ALL_ALLIES, { value: 100 }),
        ]),
      ],
    });
    const game = scenario({
      p1: { monsters: [banniere, monsterCard('Soldat')] },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Bannière').atkBuff).toBe(100);
    expect(monsterNamed(game, 'p1', 'Soldat').atkBuff).toBe(100);
  });

  it("Provocation : celle d'un passif suit sa condition, celle d'ON_SUMMON reste", () => {
    const bouclier = equipmentCard('Bouclier', [
      effect(PASSIVE, [act(ActionType.SET_TAUNT, EffectTarget.SELF)], {
        type: EffectConditionType.SPECIFIC_CARD_ON_BOARD,
        value: 'Introuvable',
      }),
    ]);
    const gardien = monsterCard('Gardien', {
      effects: [
        effect(ON_SUMMON, [act(ActionType.SET_TAUNT, EffectTarget.SELF)]),
      ],
    });
    const game = scenario({
      p1: {
        monsters: [{ card: monsterCard('Porteur'), equipments: [bouclier] }],
        hand: [gardien],
      },
    });

    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 1, paymentHandIndices: [] });

    expect(monsterNamed(game, 'p1', 'Porteur').hasTaunt).toBe(false);
    expect(monsterNamed(game, 'p1', 'Gardien').hasTaunt).toBe(true);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/engine/buffs`
Expected: FAIL. `settle` n'existe pas encore avec recalcul, le buff d'invocation est effacé et la condition passive est ignorée.

- [ ] **Step 2: Shared — bonus permanents**

Dans `packages/shared/src/game/instance.ts`, ajouter avant `MonsterOnBoard` :

```ts
/** Bonus posés par des effets déclenchés : socle du recalcul des passifs. */
export interface MonsterPermanentStats {
  atk: number;
  hp: number;
  taunt: boolean;
  piercing: boolean;
  debuffImmune: boolean;
  damageReduction?: number;
  attacksPerTurn: number;
}
```

et dans `MonsterOnBoard`, après `tempAtkBuff: number;` :

```ts
  perm: MonsterPermanentStats;
```

Dans `helpers/monster.factory.ts`, ajouter au littéral renvoyé :

```ts
    perm: {
      atk: 0,
      hp: 0,
      taunt: false,
      piercing: false,
      debuffImmune: false,
      attacksPerTurn: 1,
    },
```

Run: `pnpm build:shared`

- [ ] **Step 3: Les actions déclenchées écrivent dans `perm`**

Dans `effects/effect-actions.applier.ts`, remplacer les `case` `BUFF_ATK`, `BUFF_HP`, `SET_TAUNT`, `SET_PIERCING`, `SET_ATTACKS_PER_TURN`, `SET_DEBUFF_IMMUNITY`, `FORCE_ATTACK_MODE`, `SET_DELAY_DOUBLE_ATK` et `SET_DAMAGE_REDUCTION` par :

```ts
      case ActionType.BUFF_ATK:
        for (const target of targets.monsters) {
          const v = action.value ?? 0;
          target.perm.atk += v;
          target.atkBuff += v;
        }
        break;

      case ActionType.BUFF_HP:
        for (const target of targets.monsters) {
          const v = action.value ?? 0;
          target.perm.hp += v;
          target.hpBuff += v;
          target.currentHp += v;
        }
        break;
```

```ts
      // ── Flags : permanents tant que le monstre reste en jeu ───────────────
      case ActionType.SET_TAUNT:
        for (const m of targets.monsters) {
          m.perm.taunt = true;
          m.hasTaunt = true;
          ctx.log.push(`🛡️ ${m.card.baseCard.name} gagne la Provocation`);
        }
        break;

      case ActionType.SET_PIERCING:
        for (const m of targets.monsters) {
          m.perm.piercing = true;
          m.hasPiercing = true;
          ctx.log.push(`⚔️ ${m.card.baseCard.name} gagne l'Attaque Perçante`);
        }
        break;

      case ActionType.SET_ATTACKS_PER_TURN:
        for (const m of targets.monsters) {
          const v = action.value ?? 1;
          m.perm.attacksPerTurn = v;
          m.attacksPerTurn = v;
          ctx.log.push(`🏹 ${m.card.baseCard.name} peut attaquer ${v} fois par tour`);
        }
        break;

      case ActionType.SET_DEBUFF_IMMUNITY:
        for (const m of targets.monsters) {
          m.perm.debuffImmune = true;
          m.isImmuneToDebuffs = true;
          ctx.log.push(`✨ ${m.card.baseCard.name} est immunisé aux débuffs`);
        }
        break;

      case ActionType.FORCE_ATTACK_MODE:
        for (const m of targets.monsters) {
          m.forcedAttackMode = true;
          m.mode = 'attack';
          ctx.log.push(`⚔️ ${m.card.baseCard.name} est forcé en mode Attaque`);
        }
        break;

      case ActionType.SET_DELAY_DOUBLE_ATK:
        for (const m of targets.monsters) {
          m.summonedThisTurn = true;
          m.doubleAtkNextTurn = true;
          ctx.log.push(`⏳ ${m.card.baseCard.name} prépare son double assaut`);
        }
        break;

      case ActionType.SET_DAMAGE_REDUCTION:
        for (const m of targets.monsters) {
          const v = action.value ?? 2;
          m.perm.damageReduction = Math.max(m.perm.damageReduction ?? 1, v);
          m.damageReduction = Math.max(m.damageReduction ?? 1, v);
          ctx.log.push(`🛡️ ${m.card.baseCard.name} divise les dégâts reçus par ${v}`);
        }
        break;
```

La cible `SELF` résout vers `ctx.sourceMonster`, comme le faisait l'ancien code. Les cartes existantes gardent donc leur comportement.

- [ ] **Step 4: Réécrire le calculateur de buffs**

`apps/backend/src/fights/buffs-calculator.service.ts` (fichier complet) :

```ts
import { Injectable } from '@nestjs/common';
import {
  ActionType,
  EffectTarget,
  EffectTrigger,
  SupportType,
} from '@pipou/shared';
import type { CardEffect, EffectAction } from '@pipou/shared';
import {
  CardInstance,
  GameState,
  MonsterOnBoard,
  PlayerGameState,
} from './interfaces/game-state.interface';
import type { EffectContext } from './effects/effect-context.interface';
import { checkCondition } from './effects/effect-conditions';

/**
 * Recalcule les valeurs effectives des monstres : on repart des bonus
 * permanents (effets déclenchés), puis on applique les passifs actifs
 * (terrains, équipements, monstres) dont la condition est remplie.
 */
@Injectable()
export class BuffsCalculatorService {
  recalculate(game: GameState): void {
    for (const player of [game.player1, game.player2]) {
      this.recalculatePlayer(game, player);
    }
  }

  private recalculatePlayer(game: GameState, player: PlayerGameState): void {
    const monsters = player.monsterZones.filter(
      (m): m is MonsterOnBoard => m !== null,
    );
    const previousMaxHp = new Map(monsters.map((m) => [m, maxHp(m)]));
    const ctx = (
      sourceCard: CardInstance,
      sourceMonster?: MonsterOnBoard,
    ): EffectContext => ({
      game,
      ownerUserId: player.userId,
      sourceCard,
      sourceMonster,
      log: [],
    });

    // 1. Socle : bonus permanents
    for (const m of monsters) {
      m.atkBuff = m.perm.atk;
      m.hpBuff = m.perm.hp;
      m.hasTaunt = m.perm.taunt;
      m.hasPiercing = m.perm.piercing;
      m.isImmuneToDebuffs = m.perm.debuffImmune;
      m.damageReduction = m.perm.damageReduction;
      m.attacksPerTurn = m.perm.attacksPerTurn;
    }

    // 2. Terrains : uniquement les monstres de leur propriétaire
    for (const terrain of player.supportZones) {
      if (!terrain || terrain.baseCard.supportType !== SupportType.TERRAIN)
        continue;
      for (const eff of passiveEffects(terrain)) {
        if (!checkCondition(eff, ctx(terrain))) continue;
        for (const action of eff.actions) {
          for (const m of terrainTargets(action, terrain, monsters))
            applyPassive(m, action);
        }
      }
    }

    // 3. Équipements : SELF = le porteur
    for (const host of monsters) {
      for (const equipment of host.equipments) {
        for (const eff of passiveEffects(equipment)) {
          if (!checkCondition(eff, ctx(equipment, host))) continue;
          for (const action of eff.actions) {
            if (action.target === EffectTarget.SELF) applyPassive(host, action);
          }
        }
      }
    }

    // 4. Passifs des monstres
    player.monsterZones.forEach((source, idx) => {
      if (!source) return;
      for (const eff of passiveEffects(source.card)) {
        if (!checkCondition(eff, ctx(source.card, source))) continue;
        for (const action of eff.actions) {
          if (action.type === ActionType.BUFF_HP_PER_ADJACENT_ALLY) {
            const adjacent = [
              player.monsterZones[idx - 1],
              player.monsterZones[idx + 1],
            ].filter(Boolean).length;
            source.hpBuff += (action.value ?? 0) * adjacent;
            continue;
          }
          for (const m of monsterTargets(action, source, monsters))
            applyPassive(m, action);
        }
      }
    });

    // 5. Les PV courants suivent la variation des PV max, sans les dépasser
    for (const m of monsters) {
      const after = maxHp(m);
      m.currentHp = Math.min(
        m.currentHp + (after - previousMaxHp.get(m)!),
        after,
      );
    }
  }
}

function maxHp(m: MonsterOnBoard): number {
  return m.card.baseCard.hp + m.hpBuff;
}

function passiveEffects(card: CardInstance): CardEffect[] {
  return (card.baseCard.effects ?? []).filter(
    (e) => e.trigger === EffectTrigger.PASSIVE,
  );
}

function terrainTargets(
  action: EffectAction,
  terrain: CardInstance,
  monsters: MonsterOnBoard[],
): MonsterOnBoard[] {
  switch (action.target) {
    case EffectTarget.ALL_ALLIES:
      return monsters;
    case EffectTarget.ARCHETYPE_ALLIES: {
      const arch = action.archetype ?? terrain.baseCard.archetype;
      return arch
        ? monsters.filter((m) => m.card.baseCard.archetype === arch)
        : [];
    }
    default:
      return [];
  }
}

function monsterTargets(
  action: EffectAction,
  source: MonsterOnBoard,
  monsters: MonsterOnBoard[],
): MonsterOnBoard[] {
  switch (action.target) {
    case EffectTarget.SELF:
      return [source];
    case EffectTarget.ALL_ALLIES:
      return monsters;
    case EffectTarget.ALLIES_EXCEPT_SELF:
      return monsters.filter((m) => m !== source);
    case EffectTarget.ARCHETYPE_ALLIES: {
      const arch = action.archetype ?? source.card.baseCard.archetype;
      return arch
        ? monsters.filter(
            (m) => m !== source && m.card.baseCard.archetype === arch,
          )
        : [];
    }
    default:
      return [];
  }
}

function applyPassive(m: MonsterOnBoard, action: EffectAction): void {
  switch (action.type) {
    case ActionType.BUFF_ATK:
      m.atkBuff += action.value ?? 0;
      break;
    case ActionType.BUFF_HP:
      m.hpBuff += action.value ?? 0;
      break;
    case ActionType.SET_TAUNT:
      m.hasTaunt = true;
      break;
    case ActionType.SET_PIERCING:
      m.hasPiercing = true;
      break;
    case ActionType.SET_DEBUFF_IMMUNITY:
      m.isImmuneToDebuffs = true;
      break;
    case ActionType.SET_DAMAGE_REDUCTION:
      m.damageReduction = Math.max(m.damageReduction ?? 1, action.value ?? 2);
      break;
    case ActionType.SET_ATTACKS_PER_TURN:
      m.attacksPerTurn = Math.max(m.attacksPerTurn, action.value ?? 1);
      break;
  }
}
```

Dans `effects/effect-context.interface.ts`, ajouter le champ optionnel suivant (il sert à `EQUIPPED_ON` en Task 7, et le calculateur le renseigne déjà) :

```ts
  /** Carte qui porte l'effet en cours de résolution. */
  sourceCard?: CardInstance;
```

(avec `CardInstance` ajouté à l'import).

- [ ] **Step 5: Le moteur stabilise l'état (recalcul et monstres morts)**

Dans `engine/game-engine.ts` :
- ajouter `private effects: EffectsResolverService, private buffs: BuffsCalculatorService` à la fin du constructeur, avec les imports ;
- remplacer `settle` par :

```ts
  /** Stabilise l'état après un changement : buffs, monstres à 0 PV, victoire. */
  settle(game: GameState): void {
    if (game.phase === 'finished') return;
    this.buffs.recalculate(game);
    this.reapDeadMonsters(game);

    const outcome = checkWinCondition(game);
    if (outcome)
      finishGame(
        game,
        outcome.winnerUserId,
        outcome.winnerUserId === null ? 'double_ko' : 'primes_depleted',
      );
  }

  /** Détruit les monstres à 0 PV (perte de bonus, dégâts), jusqu'à stabilité. */
  private reapDeadMonsters(game: GameState): void {
    for (let pass = 0; pass < 5; pass++) {
      const log: string[] = [];
      let died = false;
      for (const player of [game.player1, game.player2]) {
        for (const m of player.monsterZones) {
          if (!m || m.currentHp > 0) continue;
          log.push(`💀 ${m.card.baseCard.name} succombe`);
          this.effects.destroyMonster(game, player, m.instanceId, log, {
            draw: true,
          });
          died = true;
        }
      }
      log.forEach((l) => addLog(game, l));
      if (!died) return;
      this.buffs.recalculate(game);
    }
  }
```

Dans `services/phase.service.ts`, `summon.service.ts`, `support.service.ts` et `battle.service.ts` :
- supprimer le paramètre de constructeur `buffsCalc` ;
- supprimer tous les appels `this.buffsCalc.recalculate(...)` ;
- supprimer l'import de `BuffsCalculatorService`.

`settle` recalcule désormais après chaque action.

`testing/engine.ts` (fichier complet) :

```ts
import { GameEngine } from '../engine/game-engine';
import { EffectsResolverService } from '../effects-resolver.service';
import { BuffsCalculatorService } from '../buffs-calculator.service';
import { PhaseService } from '../services/phase.service';
import { SummonService } from '../services/summon.service';
import { SupportService } from '../services/support.service';
import { BattleService } from '../services/battle.service';
import { PickService } from '../services/pick.service';

/** Moteur câblé à la main, comme le ferait Nest, pour les tests. */
export function createEngine(): GameEngine {
  const effects = new EffectsResolverService();
  return new GameEngine(
    new PhaseService(effects),
    new SummonService(effects),
    new SupportService(effects),
    new BattleService(effects),
    new PickService(effects),
    effects,
    new BuffsCalculatorService(),
  );
}
```

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

Run: `pnpm typecheck`
Expected: aucune erreur. Le front lit `MonsterOnBoard` sans jamais le construire.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src apps/backend/src/fights
git commit -m "fix(fights): keep triggered buffs, evaluate passive conditions and recalc both boards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Conditions par nom normalisé, `EQUIPPED_ON`, DTO d'effets

**Files:**
- Modify: `packages/shared/src/enums/effect.ts`, `packages/shared/src/enums/enums.test.ts`, `packages/shared/src/game/effect.ts`
- Create: `apps/backend/src/fights/effects/card-name.ts`
- Modify: `apps/backend/src/fights/effects/effect-conditions.ts` (réécriture)
- Modify: `apps/backend/src/fights/effects-resolver.service.ts` (`resolve` transmet `sourceCard`)
- Modify: `apps/backend/src/cards/dto/create-card.dto.ts`
- Test: `apps/backend/src/fights/effects/card-name.spec.ts`, `apps/backend/src/fights/effects/effect-conditions.spec.ts`, `apps/backend/src/cards/dto/create-card.dto.spec.ts`

**Interfaces:**
- Produces:
  - `EffectConditionType.EQUIPPED_ON` ;
  - `CardNameMatch = "exact" | "contains"` ;
  - `EffectCondition.match?: CardNameMatch` ;
  - `normalizeCardName(name): string` ;
  - `cardNameMatches(actual, expected, mode?): boolean` ;
  - `EffectContext.sourceCard?: CardInstance`, déjà ajouté en Task 6 et désormais renseigné par `resolve`.

- [ ] **Step 1: Shared**

Dans `packages/shared/src/enums/effect.ts`, ajouter `EQUIPPED_ON: "EQUIPPED_ON",` à la fin de `EffectConditionType`. Dans `enums.test.ts`, la ligne attendue devient :

```ts
      ["ARCHETYPE_ON_BOARD", "HP_BELOW", "HAND_SIZE_MIN", "OPPONENT_HAS_NO_MONSTERS", "SPECIFIC_CARD_ON_BOARD", "EQUIPPED_ON"],
```

Dans `packages/shared/src/game/effect.ts` :

```ts
/** Comparaison de noms de cartes : égalité, ou « contient » pour viser une série. */
export type CardNameMatch = "exact" | "contains";

export interface EffectCondition {
  type: EffectConditionType;
  value?: number | string;
  /** Conditions portant sur un nom de carte uniquement ("exact" par défaut). */
  match?: CardNameMatch;
}
```

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: PASS.

- [ ] **Step 2: Tests (ils échouent)**

`apps/backend/src/fights/effects/card-name.spec.ts` :

```ts
import { cardNameMatches, normalizeCardName } from './card-name';

describe('noms de cartes', () => {
  it('normalise accents, casse et espaces', () => {
    expect(normalizeCardName('  Médecin   Citrouille ')).toBe('medecin citrouille');
  });

  it('compare à l’égalité par défaut', () => {
    expect(cardNameMatches('Noyau Alpha ', 'noyau alpha')).toBe(true);
    expect(cardNameMatches('Noyau Alpha X', 'Noyau Alpha')).toBe(false);
  });

  it("vise une série avec 'contains'", () => {
    expect(cardNameMatches('Roi de la Rose', 'de la rose', 'contains')).toBe(true);
    expect(cardNameMatches('Chevalier de la rose', 'de la rose', 'contains')).toBe(true);
    expect(cardNameMatches('Roi de la Rose', 'de la rose')).toBe(false);
  });
});
```

`apps/backend/src/fights/effects/effect-conditions.spec.ts` :

```ts
import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import type { EffectCondition } from '@pipou/shared';
import { checkCondition } from './effect-conditions';
import { createEngine } from '../testing/engine';
import { act, effect, equipmentCard, monsterCard } from '../testing/cards';
import { monsterNamed, scenario, P1_ID } from '../testing/scenario';

const onBoard = (value: string, match?: 'exact' | 'contains'): EffectCondition => ({
  type: EffectConditionType.SPECIFIC_CARD_ON_BOARD,
  value,
  match,
});
const cardEffect = (condition: EffectCondition) =>
  effect(EffectTrigger.PASSIVE, [], condition);

describe('checkCondition — noms de cartes', () => {
  it('SPECIFIC_CARD_ON_BOARD ignore casse, accents et espace final', () => {
    const game = scenario({
      p1: { monsters: [monsterCard('Noyau Alpha '), monsterCard('Médecin Citrouille')] },
    });
    const ctx = { game, ownerUserId: P1_ID, log: [] };

    expect(checkCondition(cardEffect(onBoard('noyau alpha')), ctx)).toBe(true);
    expect(checkCondition(cardEffect(onBoard('Medecin citrouille')), ctx)).toBe(true);
  });

  it("match 'contains' vise une série", () => {
    const game = scenario({ p1: { monsters: [monsterCard('Roi de la Rose')] } });
    const ctx = { game, ownerUserId: P1_ID, log: [] };

    expect(checkCondition(cardEffect(onBoard('de la rose', 'contains')), ctx)).toBe(true);
    expect(checkCondition(cardEffect(onBoard('de la rose')), ctx)).toBe(false);
  });

  it('ne regarde que le terrain du propriétaire', () => {
    const game = scenario({ p2: { monsters: [monsterCard('Noyau Alpha')] } });

    expect(
      checkCondition(cardEffect(onBoard('Noyau Alpha')), {
        game,
        ownerUserId: P1_ID,
        log: [],
      }),
    ).toBe(false);
  });

  it("EQUIPPED_ON : l'équipement n'agit que sur le monstre nommé", () => {
    const module = () =>
      equipmentCard('Module', [
        effect(EffectTrigger.PASSIVE, [act(ActionType.SET_TAUNT, EffectTarget.SELF)], {
          type: EffectConditionType.EQUIPPED_ON,
          value: 'Noyau Alpha',
        }),
      ]);
    const game = scenario({
      p1: {
        monsters: [
          { card: monsterCard('Noyau Alpha '), equipments: [module()] },
          { card: monsterCard('Noyau Beta'), equipments: [module()] },
        ],
      },
    });

    createEngine().settle(game);

    expect(monsterNamed(game, 'p1', 'Noyau Alpha ').hasTaunt).toBe(true);
    expect(monsterNamed(game, 'p1', 'Noyau Beta').hasTaunt).toBe(false);
  });
});
```

`apps/backend/src/cards/dto/create-card.dto.spec.ts` :

```ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCardDto } from './create-card.dto';

async function errorsFor(effects: unknown) {
  const dto = plainToInstance(CreateCardDto, {
    name: 'Carte test',
    rarity: 'common',
    type: 'support',
    atk: 0,
    hp: 0,
    cardSetId: 1,
    effects,
  });
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateCardDto — effets', () => {
  it("accepte un filtre d'action", async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_DEATH',
        actions: [
          {
            type: 'SEARCH_DECK',
            target: 'PLAYER',
            filter: { name: 'Noyau', archetype: 'pixelman', rarities: ['common'], type: 'monster' },
          },
        ],
      },
    ]);
    expect(errors).toEqual([]);
  });

  it("accepte EQUIPPED_ON avec match 'contains'", async () => {
    const errors = await errorsFor([
      {
        trigger: 'PASSIVE',
        condition: { type: 'EQUIPPED_ON', value: 'Noyau', match: 'contains' },
        actions: [{ type: 'SET_TAUNT', target: 'SELF' }],
      },
    ]);
    expect(errors).toEqual([]);
  });

  it('refuse un champ inconnu dans un filtre', async () => {
    const errors = await errorsFor([
      {
        trigger: 'ON_PLAY',
        actions: [{ type: 'SEARCH_DECK', target: 'PLAYER', filter: { foo: 1 } }],
      },
    ]);
    expect(errors).not.toEqual([]);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest card-name effect-conditions create-card.dto`
Expected: FAIL (`card-name` n'existe pas, `EQUIPPED_ON` n'est pas géré, `filter` est refusé).

- [ ] **Step 3: Implémenter**

`apps/backend/src/fights/effects/card-name.ts` :

```ts
import type { CardNameMatch } from '@pipou/shared';

/** Nom comparable : sans accents, en minuscules, espaces réduits. */
export function normalizeCardName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cardNameMatches(
  actual: string,
  expected: string,
  mode: CardNameMatch = 'exact',
): boolean {
  const a = normalizeCardName(actual);
  const e = normalizeCardName(expected);
  return mode === 'contains' ? a.includes(e) : a === e;
}
```

`apps/backend/src/fights/effects/effect-conditions.ts` (fichier complet) :

```ts
import {
  CardEffect,
  EffectConditionType as ConditionType,
  SupportType,
} from '@pipou/shared';
import { EffectContext } from './effect-context.interface';
import { cardNameMatches } from './card-name';

/** Vrai si la condition de l'effet est remplie (ou absente). */
export function checkCondition(
  effect: CardEffect,
  ctx: EffectContext,
): boolean {
  const condition = effect.condition;
  if (!condition) return true;

  const owner =
    ctx.game.player1.userId === ctx.ownerUserId
      ? ctx.game.player1
      : ctx.game.player2;
  const opponent =
    owner === ctx.game.player1 ? ctx.game.player2 : ctx.game.player1;
  const expectedName = String(condition.value ?? '');

  switch (condition.type) {
    case ConditionType.ARCHETYPE_ON_BOARD: {
      const arch = expectedName.toLowerCase();
      return owner.monsterZones.some(
        (m) => m?.card.baseCard.archetype?.toLowerCase() === arch,
      );
    }

    case ConditionType.HP_BELOW:
      return (
        !!ctx.sourceMonster &&
        ctx.sourceMonster.currentHp < Number(condition.value)
      );

    case ConditionType.HAND_SIZE_MIN:
      return owner.hand.length >= Number(condition.value);

    case ConditionType.OPPONENT_HAS_NO_MONSTERS:
      return opponent.monsterZones.every((z) => z === null);

    case ConditionType.SPECIFIC_CARD_ON_BOARD: {
      const matches = (name: string) =>
        cardNameMatches(name, expectedName, condition.match);
      return owner.monsterZones.some(
        (m) =>
          !!m &&
          (matches(m.card.baseCard.name) ||
            m.equipments.some((e) => matches(e.baseCard.name))),
      );
    }

    case ConditionType.EQUIPPED_ON:
      return (
        ctx.sourceCard?.baseCard.supportType === SupportType.EQUIPMENT &&
        !!ctx.sourceMonster &&
        cardNameMatches(
          ctx.sourceMonster.card.baseCard.name,
          expectedName,
          condition.match,
        )
      );

    default:
      return false;
  }
}
```

Dans `effects-resolver.service.ts` (`resolve`), la boucle devient :

```ts
    const effectCtx: EffectContext = { ...ctx, sourceCard: card };
    let changed = false;
    for (const effect of effects) {
      if (effect.trigger !== trigger) continue;
      if (!checkCondition(effect, effectCtx)) continue;
      applyActions(effect, card, effectCtx, (host, instanceId) =>
        this.destroyMonster(ctx.game, host, instanceId, ctx.log, {
          // Sacrifice par son propre effet : pas de pioche
          draw: host.userId !== ctx.ownerUserId,
        }),
      );
      changed = true;
    }
    return changed;
```

Dans `apps/backend/src/cards/dto/create-card.dto.ts` :
- ajouter `IsIn` aux imports de `class-validator` ;
- ajouter `CardNameMatch` et `EffectFilter` aux imports de types de `@pipou/shared` ;
- remplacer `EffectConditionDto` et `EffectActionDto`, puis ajouter `EffectFilterDto` :

```ts
export class EffectConditionDto implements EffectCondition {
  @IsEnum(ConditionType)
  type!: ConditionType;

  @IsOptional()
  value?: number | string;

  @IsOptional()
  @IsIn(['exact', 'contains'])
  match?: CardNameMatch;
}

export class EffectFilterDto implements EffectFilter {
  @IsOptional()
  @IsEnum(Archetype)
  archetype?: Archetype;

  @IsOptional()
  @IsArray()
  @IsEnum(Rarity, { each: true })
  rarities?: Rarity[];

  @IsOptional()
  @IsEnum(CardType)
  type?: CardType;

  @IsOptional()
  @IsString()
  name?: string;
}

export class EffectActionDto implements EffectAction {
  @IsEnum(ActionType)
  type!: ActionType;

  @IsEnum(EffectTarget)
  target!: EffectTarget;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsEnum(Archetype)
  archetype?: Archetype;

  @IsOptional()
  @ValidateNested()
  @Type(() => EffectFilterDto)
  filter?: EffectFilterDto;
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights cards`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src apps/backend/src
git commit -m "feat(fights): match card names loosely and add the EQUIPPED_ON condition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Mise en place — règles de deck, premier joueur aléatoire, mulligan, pioche au tour 1

**Files:**
- Create: `packages/shared/src/game/rules.ts`
- Modify: `packages/shared/src/game/{index,state,action}.ts`, `packages/shared/src/socket/fight.ts`
- Create: `apps/backend/src/fights/engine/rng.ts`, `apps/backend/src/fights/testing/fixed-rng.ts`
- Create: `apps/backend/src/decks/deck-rules.ts`
- Modify: `apps/backend/src/decks/decks.service.ts`
- Modify: `apps/backend/src/fights/interfaces/game-state.interface.ts`, `helpers/client-state.builder.ts`
- Modify: `apps/backend/src/fights/engine/game-engine.ts`, `services/phase.service.ts`, `services/deck-submission.service.ts`, `services/matchmaking.service.ts`
- Modify: `apps/backend/src/fights/fights.module.ts`, `fights.gateway.ts`, `testing/engine.ts`, `testing/scenario.ts`, `fights.service.spec.ts`
- Modify: `apps/frontend/src/features/fight/fight.types.ts`, `apps/frontend/src/features/deck/DeckBuilder.tsx`
- Test: `apps/backend/src/fights/engine/setup.spec.ts`, `apps/backend/src/decks/deck-rules.spec.ts`

**Interfaces:**
- Produces (shared) :
  - `DECK_RULES = { MIN_CARDS: 30, MAX_CARDS: 40, MAX_COPIES: 3 }`, `STARTING_PRIMES = 6`, `STARTING_HAND = 5`, `HAND_LIMIT = 7` ;
  - `GamePhase = "waiting" | "mulligan" | "main" | "battle" | "end" | "finished"` (la valeur `draw` est retirée) ;
  - `GameAction` gagne `{ type: "mulligan"; redraw: boolean }` ;
  - `MyClientState.mulliganDone` et `OpponentClientState.mulliganDone: boolean` ;
  - événement `"fight:mulligan"` avec `MulliganPayload { matchId: number; redraw: boolean }`.
- Produces (backend) :
  - `Rng { shuffle<T>(arr: T[]): T[]; coinFlip(): boolean }`, `RNG` (token), `mathRandomRng` ;
  - `fixedRng(opts?: { p1Starts?: boolean }): Rng` ;
  - `GameEngine.setupDeck(game, seat, cards: CardInstance[]): EngineResult` ;
  - `PhaseService.startTurn(game, player): void` ;
  - `PlayerGameState.mulliganDone: boolean` ;
  - `DecksService.loadDeckForMatch(deckId, userId): Promise<CardInstance[]>`, qui remplace `loadDeckCards` ;
  - `checkDeckForMatch(entries: DeckEntry[]): string | null` ;
  - `createEngine(rng?: Rng)` ;
  - `DeckSubmissionService(decksService, engine)`.

- [ ] **Step 1: Shared**

`packages/shared/src/game/rules.ts` :

```ts
/** Règles de construction d'un deck (création et lancement de match). */
export const DECK_RULES = { MIN_CARDS: 30, MAX_CARDS: 40, MAX_COPIES: 3 } as const;

/** Primes mises de côté en début de partie. */
export const STARTING_PRIMES = 6;

/** Taille de la main de départ. */
export const STARTING_HAND = 5;

/** Nombre maximum de cartes en main à la fin du tour. */
export const HAND_LIMIT = 7;
```

Dans `game/index.ts`, ajouter `export * from "./rules";`.

Dans `game/state.ts` :
- `export type GamePhase = "waiting" | "mulligan" | "main" | "battle" | "end" | "finished";` ;
- ajouter `mulliganDone: boolean;` à `MyClientState` et à `OpponentClientState`.

Dans `game/action.ts`, ajouter en tête de l'union :

```ts
  | { type: "mulligan"; redraw: boolean }
```

Dans `socket/fight.ts`, ajouter :

```ts
export interface MulliganPayload {
  matchId: number;
  /** true : la main est remélangée dans le deck et 5 cartes sont repiochées. */
  redraw: boolean;
}
```

et `"fight:mulligan": (payload: MulliganPayload) => void;` dans `ClientToServerEvents`.

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: PASS.

- [ ] **Step 2: Tests (ils échouent)**

`apps/backend/src/decks/deck-rules.spec.ts` :

```ts
import { checkDeckForMatch, DeckEntry } from './deck-rules';

const entry = (cardId: number, quantity: number, owned = 3): DeckEntry => ({
  cardId,
  cardName: `Carte ${cardId}`,
  quantity,
  owned,
});

/** 30 cartes valides : 10 cartes × 3 exemplaires. */
const validDeck = () => Array.from({ length: 10 }, (_, i) => entry(i + 1, 3));

describe('checkDeckForMatch', () => {
  it('accepte un deck de 30 cartes', () => {
    expect(checkDeckForMatch(validDeck())).toBeNull();
  });

  it('refuse moins de 30 ou plus de 40 cartes', () => {
    expect(checkDeckForMatch(validDeck().slice(1))).toContain('entre 30 et 40');
    expect(
      checkDeckForMatch([...validDeck(), ...validDeck().map((e) => ({ ...e, cardId: e.cardId + 100 }))]),
    ).toContain('entre 30 et 40');
  });

  it('refuse plus de 3 exemplaires d’une même carte', () => {
    const deck = validDeck();
    deck[0] = entry(1, 4, 4);
    deck[1] = entry(2, 2);
    expect(checkDeckForMatch(deck)).toContain('Maximum 3 exemplaires');
  });

  it('refuse un deck dont les cartes ne sont plus possédées', () => {
    const deck = validDeck();
    deck[0] = entry(1, 3, 1);
    expect(checkDeckForMatch(deck)).toContain('Carte 1');
  });
});
```

`apps/backend/src/fights/engine/setup.spec.ts` :

```ts
import type { CardInstance } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { fixedRng } from '../testing/fixed-rng';
import { monsterCard } from '../testing/cards';
import {
  handNames,
  instanceOf,
  waitingScenario,
  P1_ID,
  P2_ID,
} from '../testing/scenario';

const deckOf = (prefix: string, ownerId: number): CardInstance[] =>
  Array.from({ length: 36 }, (_, i) => instanceOf(monsterCard(`${prefix}${i}`), ownerId));
const names = (cards: CardInstance[]) => cards.map((c) => c.baseCard.name);
const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

function inMulligan(p1Starts = true) {
  const engine = createEngine(fixedRng({ p1Starts }));
  const game = waitingScenario();
  engine.setupDeck(game, 'p1', deckOf('A', P1_ID));
  engine.setupDeck(game, 'p2', deckOf('B', P2_ID));
  return { engine, game };
}

describe('GameEngine — mise en place', () => {
  it('installe Primes, main et deck dans l’ordre du mélange, puis passe au mulligan', () => {
    const engine = createEngine(fixedRng({ p1Starts: false }));
    const game = waitingScenario();

    expect(engine.setupDeck(game, 'p1', deckOf('A', P1_ID))).toEqual({});
    expect(game.phase).toBe('waiting');
    engine.setupDeck(game, 'p2', deckOf('B', P2_ID));

    expect(names(game.player1.primeDeck)).toEqual(range('A', 0, 5));
    expect(game.player1.primes).toBe(6);
    expect(handNames(game, 'p1')).toEqual(range('A', 6, 10));
    expect(game.player1.deck).toHaveLength(25);
    expect(game.phase).toBe('mulligan');
    expect(game.currentTurnUserId).toBe(P2_ID);
  });

  it('refuse un second deck pour le même joueur', () => {
    const engine = createEngine();
    const game = waitingScenario();
    engine.setupDeck(game, 'p1', deckOf('A', P1_ID));

    expect(engine.setupDeck(game, 'p1', deckOf('A', P1_ID))).toEqual({
      error: 'Deck déjà soumis',
    });
  });

  it('pendant le mulligan, seules les décisions de mulligan sont acceptées', () => {
    const { engine, game } = inMulligan();

    expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({
      error: 'Phase de mulligan en cours',
    });
  });

  it('quand les deux gardent leur main, le premier joueur commence et pioche', () => {
    const { engine, game } = inMulligan(true);

    engine.dispatch(game, 'p2', { type: 'mulligan', redraw: false });
    engine.dispatch(game, 'p1', { type: 'mulligan', redraw: false });

    expect(game.phase).toBe('main');
    expect(game.turnNumber).toBe(1);
    expect(game.currentTurnUserId).toBe(P1_ID);
    expect(handNames(game, 'p1')).toEqual(range('A', 6, 11));
    expect(handNames(game, 'p2')).toEqual(range('B', 6, 10));
  });

  it('un mulligan remet la main dans le deck et repioche 5 cartes', () => {
    const { engine, game } = inMulligan();

    engine.dispatch(game, 'p1', { type: 'mulligan', redraw: true });

    expect(handNames(game, 'p1')).toEqual(range('A', 11, 15));
    expect(game.player1.deck).toHaveLength(25);
    expect(game.player1.mulliganDone).toBe(true);
  });

  it('une seule décision de mulligan par joueur', () => {
    const { engine, game } = inMulligan();
    engine.dispatch(game, 'p1', { type: 'mulligan', redraw: false });

    expect(engine.dispatch(game, 'p1', { type: 'mulligan', redraw: true })).toEqual({
      error: 'Mulligan déjà décidé',
    });
  });

  it('un timeout pendant le mulligan garde les mains et lance la partie', () => {
    const { engine, game } = inMulligan();

    engine.timeout(game);

    expect(game.phase).toBe('main');
    expect(game.turnNumber).toBe(1);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest deck-rules fights/engine/setup`
Expected: FAIL (modules et méthodes manquants).

- [ ] **Step 3: Règles de deck**

`apps/backend/src/decks/deck-rules.ts` :

```ts
import { DECK_RULES } from '@pipou/shared';

export interface DeckEntry {
  cardId: number;
  cardName: string;
  quantity: number;
  /** Exemplaires possédés par le joueur au moment du lancement. */
  owned: number;
}

/** Message d'erreur si le deck ne peut pas être joué, sinon null. */
export function checkDeckForMatch(entries: DeckEntry[]): string | null {
  const total = entries.reduce((sum, e) => sum + e.quantity, 0);
  if (total < DECK_RULES.MIN_CARDS || total > DECK_RULES.MAX_CARDS)
    return `Un deck doit contenir entre ${DECK_RULES.MIN_CARDS} et ${DECK_RULES.MAX_CARDS} cartes (total actuel : ${total})`;

  const copies = new Map<number, { name: string; count: number }>();
  for (const e of entries) {
    const c = copies.get(e.cardId) ?? { name: e.cardName, count: 0 };
    c.count += e.quantity;
    copies.set(e.cardId, c);
  }
  for (const c of copies.values()) {
    if (c.count > DECK_RULES.MAX_COPIES)
      return `Maximum ${DECK_RULES.MAX_COPIES} exemplaires de « ${c.name} »`;
  }

  const missing = entries.find((e) => e.quantity > e.owned);
  if (missing)
    return `Tu ne possèdes plus assez d'exemplaires de « ${missing.cardName} »`;

  return null;
}
```

Dans `decks/decks.service.ts` :
- remplacer les constantes `MIN_DECK_SIZE`, `MAX_DECK_SIZE` et `MAX_COPIES` par `DECK_RULES` importé de `@pipou/shared`, dans `validateUserCards` (`DECK_RULES.MIN_CARDS`, `DECK_RULES.MAX_CARDS`, `DECK_RULES.MAX_COPIES`) ;
- remplacer `loadDeckCards` par :

```ts
  /**
   * Charge un deck pour un match, après avoir vérifié qu'il respecte les
   * règles et que le joueur possède toujours ses cartes.
   */
  async loadDeckForMatch(
    deckId: number,
    userId: number,
  ): Promise<CardInstance[]> {
    const deck = await this.deckRepo.findOne({
      where: { id: deckId, userId },
      relations: ['deckCards', 'deckCards.userCard', 'deckCards.userCard.card'],
    });
    if (!deck) throw new NotFoundException('Deck introuvable');

    const problem = checkDeckForMatch(
      deck.deckCards.map((dc) => ({
        cardId: dc.userCard.card.id,
        cardName: dc.userCard.card.name,
        quantity: dc.quantity,
        owned: dc.userCard.quantity,
      })),
    );
    if (problem) throw new BadRequestException(problem);

    const cards: CardInstance[] = [];
    for (const deckCard of deck.deckCards) {
      for (let i = 0; i < deckCard.quantity; i++) {
        cards.push({
          instanceId: uuidv4(),
          baseCard: deckCard.userCard.card,
          ownerId: userId,
        });
      }
    }
    return cards;
  }
```

(importer `checkDeckForMatch` depuis `./deck-rules`).

- [ ] **Step 4: RNG, mise en place et mulligan dans le moteur**

`apps/backend/src/fights/engine/rng.ts` :

```ts
/** Source de hasard du moteur, injectable pour des tests déterministes. */
export interface Rng {
  /** Mélange arr sur place et le renvoie. */
  shuffle<T>(arr: T[]): T[];
  /** true : player1 commence. */
  coinFlip(): boolean;
}

export const RNG = Symbol('RNG');

export const mathRandomRng: Rng = {
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },
  coinFlip: () => Math.random() < 0.5,
};
```

`apps/backend/src/fights/testing/fixed-rng.ts` :

```ts
import type { Rng } from '../engine/rng';

/** Hasard figé : aucun mélange ; p1 commence sauf indication contraire. */
export function fixedRng(opts: { p1Starts?: boolean } = {}): Rng {
  return {
    shuffle: <T>(arr: T[]) => arr,
    coinFlip: () => opts.p1Starts ?? true,
  };
}
```

`interfaces/game-state.interface.ts` : ajouter `mulliganDone: boolean;` à `PlayerGameState`. Dans `matchmaking.service.ts` (`createEmptyPlayerState`), ajouter `mulliganDone: false,`. Dans `testing/scenario.ts` (`buildPlayer`), ajouter `mulliganDone: true,`, et dans `waitingScenario`, ajouter `p.mulliganDone = false;`.

`helpers/client-state.builder.ts` : ajouter `mulliganDone: me.mulliganDone,` dans `me` et `mulliganDone: opp.mulliganDone,` dans `opponent`.

`services/phase.service.ts` :
- `HAND_LIMIT` vient désormais de `@pipou/shared` (supprimer la constante locale) ;
- ajouter la méthode publique suivante :

```ts
  /** Début de tour : compteurs, ON_TURN_START, pioche, phase principale. */
  startTurn(game: GameState, player: PlayerGameState): void {
    this.triggerTurnStart(game, player);
    const drawn = drawCard(game, player.userId);
    if (!drawn) {
      finishGame(game, getOpponentState(game, player.userId).userId, 'deck_empty');
      return;
    }
    game.phase = 'main';
    addLog(game, `─── Tour ${game.turnNumber} — ${player.username} ───`);
  }
```

Dans `endPhase` (`case 'end'`), remplacer tout ce qui suit `game.turnNumber += 1;` jusqu'au `return {};` par :

```ts
        this.startTurn(game, opponent);
        return {};
```

`engine/game-engine.ts` :
- importer `Inject` de `@nestjs/common`, `RNG` et le type `Rng` depuis `./rng`, `STARTING_HAND`, `STARTING_PRIMES` et `HAND_LIMIT` depuis `@pipou/shared` (au lieu de `HAND_LIMIT` de `phase.service`), et `CardInstance` ;
- ajouter `@Inject(RNG) private rng: Rng` à la fin du constructeur ;
- dans `dispatch`, après le test `finished`, ajouter :

```ts
    if (game.phase === 'waiting') return { error: "La partie n'a pas commencé" };
    if (game.phase === 'mulligan' && action.type !== 'mulligan')
      return { error: 'Phase de mulligan en cours' };
```

- dans `apply`, ajouter `case 'mulligan': return this.mulligan(game, userId, action.redraw);` ;
- ajouter les méthodes suivantes :

```ts
  /** Installe le deck d'un joueur ; lance le mulligan quand les deux sont prêts. */
  setupDeck(game: GameState, seat: Seat, cards: CardInstance[]): EngineResult {
    if (game.phase !== 'waiting') return { error: 'Le match a déjà commencé' };
    const player = seatPlayer(game, seat);
    if (player.ready) return { error: 'Deck déjà soumis' };

    const deck = this.rng.shuffle([...cards]);
    player.primeDeck = deck.splice(0, STARTING_PRIMES);
    player.primes = STARTING_PRIMES;
    player.hand = deck.splice(0, STARTING_HAND);
    player.deck = deck;
    player.ready = true;

    if (game.player1.ready && game.player2.ready) {
      game.phase = 'mulligan';
      const first = this.rng.coinFlip() ? game.player1 : game.player2;
      game.currentTurnUserId = first.userId;
      addLog(game, `🎲 ${first.username} commencera la partie`);
    }
    return {};
  }

  private mulligan(game: GameState, userId: number, redraw: boolean): EngineResult {
    if (game.phase !== 'mulligan') return { error: 'Le mulligan est terminé' };
    const player = getPlayerState(game, userId);
    if (player.mulliganDone) return { error: 'Mulligan déjà décidé' };

    if (redraw) {
      player.deck.push(...player.hand);
      this.rng.shuffle(player.deck);
      player.hand = player.deck.splice(0, STARTING_HAND);
      addLog(game, `🔄 ${player.username} refait sa main`);
    }
    player.mulliganDone = true;
    if (game.player1.mulliganDone && game.player2.mulliganDone)
      this.startMatch(game);
    return {};
  }

  private startMatch(game: GameState): void {
    game.turnNumber = 1;
    addLog(game, '⚔️ Combat ! Tour 1');
    this.phase.startTurn(game, getPlayerState(game, game.currentTurnUserId));
  }
```

- `timeout` gère le mulligan :

```ts
  /** Temps écoulé : mains gardées au mulligan, sinon défausse auto, choix annulé, phase suivante. */
  timeout(game: GameState): void {
    if (game.phase === 'finished' || game.phase === 'waiting') return;
    if (game.phase === 'mulligan') {
      game.player1.mulliganDone = true;
      game.player2.mulliganDone = true;
      addLog(game, '⏱️ Timeout — mains de départ conservées');
      this.startMatch(game);
      this.settle(game);
      return;
    }
    const player = getPlayerState(game, game.currentTurnUserId);
    addLog(game, `⏱️ Timeout — passage de phase automatique`);
    if (game.phase === 'end') {
      while (player.hand.length > HAND_LIMIT) {
        player.graveyard.push(player.hand.pop()!);
      }
    }
    game.pendingChoice = undefined;
    this.phase.endPhase(game, player.userId);
    this.settle(game);
  }
```

`services/deck-submission.service.ts` (fichier complet) :

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DecksService } from '../../decks/decks.service';
import { GameEngine } from '../engine/game-engine';
import { CardInstance, GameState } from '../interfaces/game-state.interface';
import { seatOf } from '../helpers/game-state.helper';

@Injectable()
export class DeckSubmissionService {
  constructor(
    private decksService: DecksService,
    private engine: GameEngine,
  ) {}

  /** Charge, valide et installe le deck du joueur. */
  async submitDeck(
    game: GameState,
    userId: number,
    deckId: number,
  ): Promise<{ error?: string }> {
    const seat = seatOf(game, userId);
    if (!seat) return { error: 'Tu ne participes pas à ce match' };
    if (game.phase !== 'waiting') return { error: 'Le match a déjà commencé' };
    const player = seat === 'p1' ? game.player1 : game.player2;
    if (player.ready) return { error: 'Deck déjà soumis' };

    let cards: CardInstance[];
    try {
      cards = await this.decksService.loadDeckForMatch(deckId, userId);
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException)
        return { error: err.message };
      return { error: 'Deck invalide ou inaccessible' };
    }
    return this.engine.setupDeck(game, seat, cards);
  }
}
```

`fights.module.ts` : importer `RNG` et `mathRandomRng`, puis ajouter `{ provide: RNG, useValue: mathRandomRng },` aux `providers`.

`fights.gateway.ts` : ajouter le handler suivant (avec `MulliganPayload` importé) :

```ts
  @SubscribeMessage('fight:mulligan')
  async mulligan(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: MulliganPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'mulligan',
      redraw: data.redraw,
    });
  }
```

`testing/engine.ts` : la fonction devient `createEngine(rng: Rng = fixedRng())` et passe `rng` en dernier argument du constructeur de `GameEngine` (importer `Rng` et `fixedRng`).

`fights.service.spec.ts` (Task 3) : dans `setup`, créer `const engine = createEngine();`, puis passer `new DeckSubmissionService(decks as unknown as DecksService, engine)` et `engine` au constructeur de `FightsService`. Renommer `loadDeckCards` en `loadDeckForMatch`, dans le faux `decks` et dans le test de concurrence.

- [ ] **Step 5: Frontend (compilation)**

Dans `apps/frontend/src/features/fight/fight.types.ts` :

```ts
export const PHASE_LABEL: Record<Phase, string> = {
  waiting: "Attente",
  mulligan: "Mulligan",
  main: "Principale",
  battle: "Combat",
  end: "Fin de tour",
  finished: "Terminé",
};

export const END_PHASE_LABEL: Record<string, string> = {
  main: "Phase de Combat →",
  battle: "Fin de Tour →",
  end: "Terminer le Tour →",
  waiting: "Continuer →",
  mulligan: "Continuer →",
  finished: "Continuer →",
};
```

Dans `apps/frontend/src/features/deck/DeckBuilder.tsx`, importer `DECK_RULES` depuis `@pipou/shared` et remplacer les nombres en dur :
- `totalCards >= 20 && totalCards <= 40` et `total >= 20 && total <= 40` → `>= DECK_RULES.MIN_CARDS && ... <= DECK_RULES.MAX_CARDS` ;
- chaque `40` → `DECK_RULES.MAX_CARDS` (lignes ~132, 190, 249, 290, 361, 443, 466, 468, y compris dans les textes `"Deck plein (40 cartes)"` → `` `Deck plein (${DECK_RULES.MAX_CARDS} cartes)` `` et `/ 40` → `/ {DECK_RULES.MAX_CARDS}`) ;
- `Math.min(3, ...)` → `Math.min(DECK_RULES.MAX_COPIES, ...)`.

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights decks`
Expected: PASS.

Run: `pnpm typecheck && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src apps/backend/src apps/frontend/src
git commit -m "feat(fights): 30-card decks, random first player, mulligan and turn-1 draw

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Déroulé du tour — ON_TURN_END, gel, double attaque différée, mal d'invocation par effet

**Files:**
- Modify: `packages/shared/src/game/instance.ts`, `packages/shared/src/enums/effect.ts`, `packages/shared/src/enums/enums.test.ts`
- Modify: `apps/backend/src/fights/helpers/monster.factory.ts`
- Modify: `apps/backend/src/fights/services/phase.service.ts` (réécriture)
- Modify: `apps/backend/src/fights/services/battle.service.ts`
- Modify: `apps/backend/src/fights/effects/effect-actions.applier.ts`
- Modify: `apps/backend/src/fights/testing/scenario.ts` (helpers `passTurn` et `attackWith`)
- Modify: `apps/frontend/src/features/fight/Zonerow/zoneRow.helpers.ts`, `apps/frontend/src/features/fight/fight.effects.ts`
- Test: `apps/backend/src/fights/engine/turn-cycle.spec.ts`

**Interfaces:**
- Produces :
  - `MonsterOnBoard.extraAttacksThisTurn: number` et `MonsterOnBoard.cannotAttackOnSummonTurn: boolean` ;
  - `ActionType.CANNOT_ATTACK_ON_SUMMON_TURN` ;
  - `passTurn(engine, game): void` ;
  - `attackWith(engine, game, seat, attacker: string, target?: string): EngineResult`.

- [ ] **Step 1: Shared**

Dans `game/instance.ts`, ajouter à `MonsterOnBoard` :

```ts
  /** Attaques supplémentaires ce tour-ci (double attaque différée). */
  extraAttacksThisTurn: number;
  /** Ne peut pas attaquer le tour de son invocation (effet de carte). */
  cannotAttackOnSummonTurn: boolean;
```

Dans `enums/effect.ts`, ajouter `CANNOT_ATTACK_ON_SUMMON_TURN: "CANNOT_ATTACK_ON_SUMMON_TURN",` en fin de `ActionType`. Dans `enums.test.ts`, ajouter `"CANNOT_ATTACK_ON_SUMMON_TURN"` en fin de la liste attendue de `ActionType`.

Dans `monster.factory.ts`, ajouter au littéral `extraAttacksThisTurn: 0,` et `cannotAttackOnSummonTurn: false,`.

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: PASS.

- [ ] **Step 2: Helpers de test et tests (ils échouent)**

Dans `testing/scenario.ts`, ajouter (avec `import type { GameEngine, EngineResult } from '../engine/game-engine';`) :

```ts
/** Termine le tour du joueur actif (jusqu'au début du tour suivant). */
export function passTurn(engine: GameEngine, game: GameState): void {
  const seat: Seat = game.currentTurnUserId === P1_ID ? 'p1' : 'p2';
  const turn = game.turnNumber;
  while (game.turnNumber === turn && game.phase !== 'finished') {
    const result = engine.dispatch(game, seat, { type: 'end_phase' });
    if (result.error) throw new Error(result.error);
  }
}

/** Attaque un monstre adverse par son nom, ou attaque directe sans cible. */
export function attackWith(
  engine: GameEngine,
  game: GameState,
  seat: Seat,
  attacker: string,
  target?: string,
): EngineResult {
  const other: Seat = seat === 'p1' ? 'p2' : 'p1';
  const attackerInstanceId = monsterNamed(game, seat, attacker).instanceId;
  return engine.dispatch(
    game,
    seat,
    target
      ? {
          type: 'attack',
          attackerInstanceId,
          targetInstanceId: monsterNamed(game, other, target).instanceId,
        }
      : { type: 'attack', attackerInstanceId, direct: true },
  );
}
```

`apps/backend/src/fights/engine/turn-cycle.spec.ts` :

```ts
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import {
  attackWith,
  handNames,
  monsterNamed,
  passTurn,
  scenario,
  P1_ID,
} from '../testing/scenario';

const toBattle = { type: 'end_phase' } as const;

describe('GameEngine — déroulé du tour', () => {
  const engine = createEngine();

  it('un joueur qui ne peut pas piocher en début de tour perd', () => {
    const game = scenario({ p2: { deck: [] } });

    passTurn(engine, game);

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe(P1_ID);
    expect(game.endReason).toBe('deck_empty');
  });

  it('ON_TURN_END se déclenche à la fin du tour de son propriétaire', () => {
    const horloger = monsterCard('Horloger', {
      effects: [
        effect(EffectTrigger.ON_TURN_END, [act(ActionType.DRAW, EffectTarget.PLAYER)]),
      ],
    });
    const game = scenario({
      p1: { monsters: [horloger], deck: [monsterCard('Pioche de fin')] },
    });

    passTurn(engine, game);

    expect(handNames(game, 'p1')).toEqual(['Pioche de fin']);
  });

  it("les bonus d'ATK temporaires expirent en fin de tour, pour les deux camps", () => {
    const game = scenario({
      p1: { monsters: [{ card: monsterCard('A'), patch: { tempAtkBuff: 200 } }] },
      p2: { monsters: [{ card: monsterCard('B'), patch: { tempAtkBuff: 300 } }] },
    });

    passTurn(engine, game);

    expect(monsterNamed(game, 'p1', 'A').tempAtkBuff).toBe(0);
    expect(monsterNamed(game, 'p2', 'B').tempAtkBuff).toBe(0);
  });

  it('un monstre sans effet particulier peut attaquer le tour de son invocation', () => {
    const game = scenario({ p1: { hand: [monsterCard('Fonceur')] } });
    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, paymentHandIndices: [] });
    engine.dispatch(game, 'p1', toBattle);

    expect(attackWith(engine, game, 'p1', 'Fonceur')).toEqual({});
  });

  it('Quenouille : attend un tour, attaque deux fois, puis une fois par tour', () => {
    const quenouille = monsterCard('Quenouille', {
      atk: 100,
      hp: 1300,
      effects: [
        effect(EffectTrigger.ON_SUMMON, [
          act(ActionType.CANNOT_ATTACK_ON_SUMMON_TURN, EffectTarget.SELF),
          act(ActionType.SET_DELAY_DOUBLE_ATK, EffectTarget.SELF, { value: 1 }),
        ]),
      ],
    });
    const game = scenario({
      p1: { hand: [quenouille] },
      p2: { monsters: [monsterCard('Mur', { atk: 0, hp: 99_999 })] },
    });

    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, paymentHandIndices: [] });
    engine.dispatch(game, 'p1', toBattle);
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur').error).toContain(
      'ne peut pas attaquer le tour de son invocation',
    );

    passTurn(engine, game);
    passTurn(engine, game);
    engine.dispatch(game, 'p1', toBattle);
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur').error).toContain(
      'toutes ses attaques',
    );

    passTurn(engine, game);
    passTurn(engine, game);
    engine.dispatch(game, 'p1', toBattle);
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Quenouille', 'Mur').error).toContain(
      'toutes ses attaques',
    );
  });

  it('gel de N tours : bloque exactement N tours du propriétaire du monstre', () => {
    const gel = ephemeralCard('Gel', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.BLOCK_ATTACK, EffectTarget.ENEMY_MONSTER, { value: 2 }),
      ]),
    ]);
    const game = scenario({
      p1: { hand: [gel] },
      p2: { monsters: [monsterCard('Cible')] },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p2', 'Cible').instanceId,
    });

    passTurn(engine, game); // fin du tour de p1 → tour de p2
    for (let blockedTurn = 0; blockedTurn < 2; blockedTurn++) {
      engine.dispatch(game, 'p2', toBattle);
      expect(attackWith(engine, game, 'p2', 'Cible').error).toContain('bloqué');
      passTurn(engine, game); // fin du tour de p2 (le gel décompte)
      passTurn(engine, game); // fin du tour de p1
    }

    engine.dispatch(game, 'p2', toBattle);
    expect(attackWith(engine, game, 'p2', 'Cible')).toEqual({});
  });
});
```

Les attaques de p2 sont directes, car p1 n'a aucun monstre. Elles sont refusées aux deux premiers tours de p2 qui suivent le gel, puis acceptées au troisième.

Run: `pnpm --filter @pipou/backend exec jest fights/engine/turn-cycle`
Expected: FAIL. `CANNOT_ATTACK_ON_SUMMON_TURN` n'existe pas, la double attaque devient permanente, le gel dure un tour de moins et `ON_TURN_END` ne se déclenche jamais.

- [ ] **Step 3: Réécrire `PhaseService`**

`apps/backend/src/fights/services/phase.service.ts` (fichier complet) :

```ts
import { Injectable } from '@nestjs/common';
import { EffectTrigger, HAND_LIMIT } from '@pipou/shared';
import { GameState, PlayerGameState } from '../interfaces/game-state.interface';
import {
  addLog,
  drawCard,
  gainPrime,
  getOpponentState,
  getPlayerState,
  isCurrentPlayer,
} from '../helpers/game-state.helper';
import { finishGame } from '../helpers/game-end.helper';
import { EffectsResolverService } from '../effects-resolver.service';

@Injectable()
export class PhaseService {
  constructor(private effectsResolver: EffectsResolverService) {}

  endPhase(game: GameState, userId: number): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);

    switch (game.phase) {
      case 'main':
        game.phase = 'battle';
        addLog(game, `${player.username} → phase de combat`);
        return {};

      case 'battle':
        game.phase = 'end';
        return {};

      case 'end': {
        const surplus = player.hand.length - HAND_LIMIT;
        if (surplus > 0)
          return { error: `Défaussez ${surplus} carte(s) avant de terminer` };

        this.endTurn(game, player);
        game.currentTurnUserId = opponent.userId;
        game.turnNumber += 1;
        this.startTurn(game, opponent);
        return {};
      }

      default:
        return { error: `Phase invalide : ${game.phase}` };
    }
  }

  discard(
    game: GameState,
    userId: number,
    handIndex: number,
  ): { error?: string } {
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'end')
      return { error: 'Défausse en phase de fin uniquement' };

    const player = getPlayerState(game, userId);
    if (handIndex < 0 || handIndex >= player.hand.length)
      return { error: 'Index main invalide' };

    const [card] = player.hand.splice(handIndex, 1);
    player.graveyard.push(card);
    addLog(game, `${player.username} défausse ${card.baseCard.name}`);
    return {};
  }

  /** Début de tour : compteurs, ON_TURN_START, double attaque différée, pioche. */
  startTurn(game: GameState, player: PlayerGameState): void {
    const log: string[] = [];
    // Compteurs en premier : un monstre détruit au compteur 0 ne déclenche
    // pas son ON_TURN_START ce même tour.
    this.processTurnCounters(game, player, log);
    this.resolveForBoard(game, player, EffectTrigger.ON_TURN_START, log);
    for (const m of player.monsterZones) {
      if (!m?.doubleAtkNextTurn) continue;
      m.extraAttacksThisTurn = 1;
      m.doubleAtkNextTurn = false;
    }
    log.forEach((l) => addLog(game, l));

    const drawn = drawCard(game, player.userId);
    if (!drawn) {
      finishGame(
        game,
        getOpponentState(game, player.userId).userId,
        'deck_empty',
      );
      return;
    }
    game.phase = 'main';
    addLog(game, `─── Tour ${game.turnNumber} — ${player.username} ───`);
  }

  /** Fin du tour du joueur actif : ON_TURN_END, remises à zéro, gel décompté. */
  private endTurn(game: GameState, player: PlayerGameState): void {
    const log: string[] = [];
    this.resolveForBoard(game, player, EffectTrigger.ON_TURN_END, log);

    // Les bonus d'ATK temporaires expirent pour les deux camps
    for (const p of [game.player1, game.player2]) {
      for (const m of p.monsterZones) if (m) m.tempAtkBuff = 0;
    }

    for (const m of player.monsterZones) {
      if (!m) continue;
      m.hasAttackedThisTurn = false;
      m.attacksUsedThisTurn = 0;
      m.extraAttacksThisTurn = 0;
      m.summonedThisTurn = false;
      // Le gel compte les tours du propriétaire du monstre gelé
      if (m.blockAttackTurns !== undefined) {
        m.blockAttackTurns -= 1;
        if (m.blockAttackTurns <= 0) {
          m.blockAttackTurns = undefined;
          log.push(`🧊 ${m.card.baseCard.name} pourra de nouveau attaquer`);
        }
      }
    }
    player.recycleEnergy = 0;
    log.forEach((l) => addLog(game, l));
  }

  /** Déclenche `trigger` pour les monstres, leurs équipements (SELF = porteur) et les terrains. */
  private resolveForBoard(
    game: GameState,
    player: PlayerGameState,
    trigger: EffectTrigger,
    log: string[],
  ): void {
    for (const zone of player.monsterZones) {
      if (!zone) continue;
      this.effectsResolver.resolve(zone.card, trigger, {
        game,
        ownerUserId: player.userId,
        sourceMonster: zone,
        log,
      });
      if (!player.monsterZones.includes(zone)) continue;
      for (const equipment of zone.equipments) {
        this.effectsResolver.resolve(equipment, trigger, {
          game,
          ownerUserId: player.userId,
          sourceMonster: zone,
          log,
        });
      }
    }
    for (const terrain of player.supportZones) {
      if (!terrain) continue;
      this.effectsResolver.resolve(terrain, trigger, {
        game,
        ownerUserId: player.userId,
        log,
      });
    }
  }

  /**
   * Décrémente le turnCounter des monstres posés par `player` (sur les deux
   * terrains : Zeta peut être posé chez l'adversaire). À 0 : le poseur gagne
   * une Prime et le monstre est détruit, sans pioche pour l'hôte.
   */
  private processTurnCounters(
    game: GameState,
    player: PlayerGameState,
    log: string[],
  ): void {
    const other = player === game.player1 ? game.player2 : game.player1;
    for (const host of [player, other]) {
      for (const zone of [...host.monsterZones]) {
        if (!zone || zone.turnCounter === undefined) continue;
        const poser = zone.ownerUserId ?? host.userId;
        if (poser !== player.userId) continue;

        zone.turnCounter -= 1;
        log.push(
          `⏳ ${zone.card.baseCard.name} — ${zone.turnCounter} tour(s) avant autodestruction`,
        );
        if (zone.turnCounter > 0) continue;

        log.push(`💀 ${zone.card.baseCard.name} s'autodétruit !`);
        gainPrime(game, player.userId, zone.card.baseCard.name);
        this.effectsResolver.destroyMonster(game, host, zone.instanceId, log, {
          draw: false,
        });
      }
    }
  }
}
```

- [ ] **Step 4: Combat et actions**

Dans `services/battle.service.ts` (`attack`), remplacer le test sur `baseCard.id === 9` et le calcul de `maxAttacks` par :

```ts
    if (attacker.summonedThisTurn && attacker.cannotAttackOnSummonTurn)
      return {
        error: `${attacker.card.baseCard.name} ne peut pas attaquer le tour de son invocation`,
      };

    const maxAttacks = attacker.attacksPerTurn + attacker.extraAttacksThisTurn;
    if (attacker.attacksUsedThisTurn >= maxAttacks)
      return { error: 'Ce monstre a déjà utilisé toutes ses attaques ce tour' };
```

et la mise à jour du compteur par :

```ts
    attacker.attacksUsedThisTurn += 1;
    attacker.hasAttackedThisTurn = attacker.attacksUsedThisTurn >= maxAttacks;
```

Dans `effects/effect-actions.applier.ts` :

```ts
      case ActionType.SET_DELAY_DOUBLE_ATK:
        for (const m of targets.monsters) {
          m.doubleAtkNextTurn = true;
          ctx.log.push(`⏳ ${m.card.baseCard.name} prépare son double assaut`);
        }
        break;

      case ActionType.CANNOT_ATTACK_ON_SUMMON_TURN:
        for (const m of targets.monsters) m.cannotAttackOnSummonTurn = true;
        break;
```

- [ ] **Step 5: Frontend**

Dans `Zonerow/zoneRow.helpers.ts` :

```ts
export function isBlockedFromAttacking(zone: MonsterOnBoard | null): boolean {
  if (!zone) return false;
  return (
    (zone.summonedThisTurn && zone.cannotAttackOnSummonTurn) ||
    (zone.blockAttackTurns ?? 0) > 0
  );
}
```

Retirer l'import de `QUENOUILLE_CARD_ID`, et supprimer cette constante de `fight.types.ts`.

Dans `fight.effects.ts`, ajouter à `ACTION_META` :

```ts
  CANNOT_ATTACK_ON_SUMMON_TURN: {
    icon: "💤",
    label: () => "N'attaque pas le tour de son invocation",
    type: "debuff",
  },
```

Le libellé de `SET_DELAY_DOUBLE_ATK` reste « Double attaque (prochain tour) ».

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

Run: `pnpm typecheck && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src apps/backend/src/fights apps/frontend/src/features/fight
git commit -m "fix(fights): fire ON_TURN_END, count freezes on owner turns, make delayed double attack one-shot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Combat — Perçant, ATK du défenseur après ON_DEFEND, cible disparue

**Files:**
- Modify: `apps/backend/src/fights/helpers/game-state.helper.ts` (`applyDamage`, `effectiveAtk`)
- Modify: `apps/backend/src/fights/services/battle.service.ts` (réécriture de `attack`)
- Test: `apps/backend/src/fights/engine/combat.spec.ts`

**Interfaces:**
- Produces :
  - `applyDamage(target, dmg, opts?: { ignoreReduction?: boolean }): number` ;
  - `effectiveAtk(m: MonsterOnBoard): number`.

- [ ] **Step 1: Tests (ils échouent)**

`apps/backend/src/fights/engine/combat.spec.ts` :

```ts
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, monsterCard } from '../testing/cards';
import { attackWith, graveyardNames, monsterNamed, scenario } from '../testing/scenario';

describe('GameEngine — combat', () => {
  const engine = createEngine();

  /** Monstre en Garde qui divise par 2 les dégâts reçus. */
  const rempart = () => ({
    card: monsterCard('Rempart', { atk: 0, hp: 900 }),
    mode: 'guard' as const,
    patch: { damageReduction: 2 },
  });

  it('Perçant ignore la réduction de dégâts et rapporte une Prime sur une Garde', () => {
    const game = scenario({
      phase: 'battle',
      p1: {
        monsters: [
          {
            card: monsterCard('Delta', { atk: 1000, hp: 800 }),
            patch: { hasPiercing: true },
          },
        ],
      },
      p2: { monsters: [rempart()] },
    });

    attackWith(engine, game, 'p1', 'Delta', 'Rempart');

    expect(graveyardNames(game, 'p2')).toContain('Rempart');
    expect(game.player1.primes).toBe(5);
  });

  it('sans Perçant, la réduction de dégâts s’applique', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Brute', { atk: 1000, hp: 800 })] },
      p2: { monsters: [rempart()] },
    });

    attackWith(engine, game, 'p1', 'Brute', 'Rempart');

    expect(monsterNamed(game, 'p2', 'Rempart').currentHp).toBe(400);
    expect(game.player1.primes).toBe(6);
  });

  it("l'ATK du défenseur est lue après ON_DEFEND, bonus temporaire compris", () => {
    const herisson = monsterCard('Hérisson', {
      atk: 100,
      hp: 2000,
      effects: [
        effect(EffectTrigger.ON_DEFEND, [
          act(ActionType.BUFF_ATK_TEMP, EffectTarget.SELF, { value: 500 }),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Imprudent', { atk: 100, hp: 550 })] },
      p2: { monsters: [herisson] },
    });

    attackWith(engine, game, 'p1', 'Imprudent', 'Hérisson');

    expect(graveyardNames(game, 'p1')).toContain('Imprudent');
  });

  it('si ON_ATTACK détruit la cible, l’attaque se perd sans erreur', () => {
    const artilleur = monsterCard('Artilleur', {
      atk: 100,
      hp: 500,
      effects: [
        effect(EffectTrigger.ON_ATTACK, [
          act(ActionType.DEAL_DAMAGE, EffectTarget.ALL_ENEMIES, { value: 1000 }),
        ]),
      ],
    });
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [artilleur] },
      p2: { monsters: [monsterCard('Lutin', { atk: 400, hp: 300 })] },
    });

    expect(attackWith(engine, game, 'p1', 'Artilleur', 'Lutin')).toEqual({});
    expect(graveyardNames(game, 'p2')).toContain('Lutin');
    expect(monsterNamed(game, 'p1', 'Artilleur').currentHp).toBe(500);
    expect(game.player1.primes).toBe(6);
  });
});
```

Les valeurs effectives posées par `patch` (`damageReduction`, `hasPiercing`) sont lues pendant l'attaque. Le recalcul de `settle` n'a lieu qu'après.

Run: `pnpm --filter @pipou/backend exec jest fights/engine/combat`
Expected: FAIL. Perçant subit la réduction, l'ATK du défenseur est lue avant ON_DEFEND, et le dernier test plante sur `target!`.

- [ ] **Step 2: Implémenter**

Dans `helpers/game-state.helper.ts` :

```ts
export function applyDamage(
  target: MonsterOnBoard,
  dmg: number,
  opts: { ignoreReduction?: boolean } = {},
): number {
  const reduced =
    target.damageReduction && !opts.ignoreReduction
      ? Math.ceil(dmg / target.damageReduction)
      : dmg;
  target.currentHp -= reduced;
  return reduced;
}

/** ATK effective : base + bonus (permanents et passifs) + bonus temporaire. */
export function effectiveAtk(m: MonsterOnBoard): number {
  return m.card.baseCard.atk + m.atkBuff + (m.tempAtkBuff ?? 0);
}
```

`services/battle.service.ts` : remplacer la méthode `attack` complète par :

```ts
  attack(
    game: GameState,
    userId: number,
    attackerInstanceId: string,
    targetInstanceId: string | undefined,
    direct: boolean,
  ): { error?: string } {
    // ── Validations communes ─────────────────────────────────────────────────
    if (!isCurrentPlayer(game, userId))
      return { error: "Ce n'est pas ton tour" };
    if (game.phase !== 'battle') return { error: 'Phase de combat uniquement' };

    const player = getPlayerState(game, userId);
    const opponent = getOpponentState(game, userId);

    const attacker = player.monsterZones.find(
      (m) => m?.instanceId === attackerInstanceId,
    );
    if (!attacker) return { error: 'Attaquant introuvable' };
    if (attacker.mode !== 'attack') return { error: 'Monstre en mode Garde' };

    if (attacker.summonedThisTurn && attacker.cannotAttackOnSummonTurn)
      return {
        error: `${attacker.card.baseCard.name} ne peut pas attaquer le tour de son invocation`,
      };

    const maxAttacks = attacker.attacksPerTurn + attacker.extraAttacksThisTurn;
    if (attacker.attacksUsedThisTurn >= maxAttacks)
      return { error: 'Ce monstre a déjà utilisé toutes ses attaques ce tour' };

    if (attacker.blockAttackTurns !== undefined && attacker.blockAttackTurns > 0)
      return {
        error: `${attacker.card.baseCard.name} ne peut pas attaquer (bloqué encore ${attacker.blockAttackTurns} tour(s))`,
      };

    // ── Validations spécifiques au mode ─────────────────────────────────────
    if (direct) {
      if (game.turnNumber === 1)
        return { error: 'Attaque directe interdite au premier tour' };
      if (opponent.monsterZones.some((z) => z !== null))
        return {
          error:
            "Attaque directe impossible : détruisez d'abord les monstres adverses",
        };
    } else {
      const tauntMonsters = opponent.monsterZones.filter((m) => m?.hasTaunt);
      if (
        tauntMonsters.length > 0 &&
        !tauntMonsters.find((m) => m?.instanceId === targetInstanceId)
      )
        return { error: '⚠️ Vous devez attaquer le monstre avec Provocation !' };

      if (!targetInstanceId) return { error: 'Cible requise' };
      if (!opponent.monsterZones.some((m) => m?.instanceId === targetInstanceId))
        return { error: 'Cible introuvable' };
    }

    attacker.attacksUsedThisTurn += 1;
    attacker.hasAttackedThisTurn = attacker.attacksUsedThisTurn >= maxAttacks;

    const log: string[] = [];
    const flush = () => log.splice(0).forEach((l) => addLog(game, l));
    const destroy = (host: PlayerGameState, m: MonsterOnBoard) =>
      this.effectsResolver.destroyMonster(game, host, m.instanceId, log, {
        draw: true,
      });

    // ── ON_ATTACK ────────────────────────────────────────────────────────────
    this.effectsResolver.resolve(attacker.card, EffectTrigger.ON_ATTACK, {
      game,
      ownerUserId: userId,
      sourceMonster: attacker,
      log,
    });
    flush();

    // ── Attaque directe ──────────────────────────────────────────────────────
    if (direct) {
      gainPrime(game, userId, attacker.card.baseCard.name);
      // L'adversaire perd une Prime : il pioche une carte
      drawCard(game, opponent.userId);
      return {};
    }

    // ── Monstre contre monstre ───────────────────────────────────────────────
    const target = opponent.monsterZones.find(
      (m) => m?.instanceId === targetInstanceId,
    );
    if (!target) {
      addLog(
        game,
        `💨 La cible a disparu : l'attaque de ${attacker.card.baseCard.name} se perd`,
      );
      return {};
    }

    if (target.guardLocked) {
      target.guardLocked = false;
      addLog(
        game,
        `🔓 ${target.card.baseCard.name} est libéré de son verrou de Garde`,
      );
    }

    this.effectsResolver.resolve(target.card, EffectTrigger.ON_DEFEND, {
      game,
      ownerUserId: opponent.userId,
      sourceMonster: target,
      targetMonster: attacker,
      log,
    });
    flush();
    if (
      !player.monsterZones.includes(attacker) ||
      !opponent.monsterZones.includes(target)
    )
      return {};

    // Lu après ON_DEFEND : les bonus de défense comptent
    const attackerAtk = effectiveAtk(attacker);
    const targetAtk = effectiveAtk(target);

    if (target.mode === 'attack') {
      applyDamage(attacker, targetAtk, { ignoreReduction: target.hasPiercing });
      applyDamage(target, attackerAtk, { ignoreReduction: attacker.hasPiercing });

      const aDied = attacker.currentHp <= 0;
      const tDied = target.currentHp <= 0;

      if (aDied && tDied) {
        addLog(
          game,
          `⚔️ Double KO ! ${attacker.card.baseCard.name} & ${target.card.baseCard.name} — chacun récupère une Prime`,
        );
        destroy(player, attacker);
        destroy(opponent, target);
        gainPrime(game, userId, attacker.card.baseCard.name);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
      } else if (tDied) {
        addLog(
          game,
          `⚔️ ${attacker.card.baseCard.name} détruit ${target.card.baseCard.name}`,
        );
        destroy(opponent, target);
        gainPrime(game, userId, attacker.card.baseCard.name);
      } else if (aDied) {
        addLog(
          game,
          `⚔️ ${target.card.baseCard.name} détruit ${attacker.card.baseCard.name}`,
        );
        destroy(player, attacker);
        gainPrime(game, opponent.userId, target.card.baseCard.name);
      } else {
        addLog(
          game,
          `⚔️ Duel : ${attacker.card.baseCard.name} (${attacker.currentHp}HP) vs ${target.card.baseCard.name} (${target.currentHp}HP)`,
        );
      }
    } else {
      // ATK contre Garde : pas de riposte
      applyDamage(target, attackerAtk, { ignoreReduction: attacker.hasPiercing });

      if (target.currentHp <= 0) {
        destroy(opponent, target);
        if (attacker.hasPiercing) {
          gainPrime(game, userId, attacker.card.baseCard.name);
          addLog(
            game,
            `⚔️ Attaque Perçante ! ${attacker.card.baseCard.name} perce la Garde et gagne une Prime`,
          );
        } else {
          addLog(
            game,
            `🛡️ ${attacker.card.baseCard.name} brise la Garde de ${target.card.baseCard.name} — aucune Prime`,
          );
        }
      } else {
        addLog(
          game,
          `🛡️ ${attacker.card.baseCard.name} attaque ${target.card.baseCard.name} (${target.currentHp}HP) — Garde tient`,
        );
      }
    }

    flush();
    return {};
  }
```

Imports : ajouter `effectiveAtk`.

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/fights
git commit -m "fix(fights): piercing ignores damage reduction, defender ATK read after ON_DEFEND

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Supports ciblés, file de choix et `DISCARD`

**Files:**
- Modify: `packages/shared/src/game/rules.ts` (+ test `packages/shared/src/game/rules.test.ts`), `packages/shared/src/game/state.ts`
- Modify: `apps/backend/src/fights/interfaces/game-state.interface.ts`, `helpers/game-state.helper.ts`, `helpers/game-end.helper.ts`, `helpers/client-state.builder.ts`
- Modify: `apps/backend/src/fights/effects/effect-targets.resolver.ts`, `effects/effect-actions.applier.ts`
- Modify: `apps/backend/src/fights/services/pick.service.ts` (réécriture), `support.service.ts`, `matchmaking.service.ts`
- Modify: `apps/backend/src/fights/engine/game-engine.ts`, `testing/engine.ts`, `testing/scenario.ts`
- Modify: `apps/frontend/src/features/fight/CardPickModal.tsx`, `FightBoard.tsx`, `FightActionBar.tsx`, `FightPage.tsx`, `FightPage.css`
- Test: `apps/backend/src/fights/engine/supports.spec.ts`, `apps/backend/src/fights/engine/choices.spec.ts`

**Interfaces:**
- Produces (shared) :
  - `ephemeralTargetSide(effects): "ally" | "enemy" | null` ;
  - `PendingChoiceResolution = "pick_to_hand" | "discard"` ;
  - `ChoiceSource` gagne `"hand"` ;
  - `ClientGameState.opponentChoosing: boolean`.
- Produces (backend) :
  - `GameState.pendingChoices: PendingChoice[]` remplace `pendingChoice` ;
  - `currentChoice(game)` et `queueChoice(game, choice)` ;
  - `PickService` n'a plus de dépendance (`new PickService()`).

- [ ] **Step 1: Shared**

Dans `packages/shared/src/game/rules.ts`, ajouter :

```ts
import { EffectTarget, EffectTrigger } from "../enums/effect";
import type { CardEffect } from "./effect";

/**
 * Camp de la cible à choisir avant de jouer un Éphémère (null : carte non
 * ciblée). Lu sur les actions ON_PLAY : ENEMY_MONSTER → adverse,
 * ALLY_MONSTER / TARGET_ALLY → alliée.
 */
export function ephemeralTargetSide(
  effects: readonly CardEffect[] | null | undefined,
): "ally" | "enemy" | null {
  for (const eff of effects ?? []) {
    if (eff.trigger !== EffectTrigger.ON_PLAY) continue;
    for (const action of eff.actions) {
      if (action.target === EffectTarget.ENEMY_MONSTER) return "enemy";
      if (
        action.target === EffectTarget.ALLY_MONSTER ||
        action.target === EffectTarget.TARGET_ALLY
      )
        return "ally";
    }
  }
  return null;
}
```

`packages/shared/src/game/rules.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { ephemeralTargetSide } from "./rules";

describe("ephemeralTargetSide", () => {
  it("détecte une cible adverse", () => {
    expect(
      ephemeralTargetSide([
        { trigger: "ON_PLAY", actions: [{ type: "DESTROY_MONSTER", target: "ENEMY_MONSTER" }] },
      ]),
    ).toBe("enemy");
  });

  it("détecte une cible alliée", () => {
    expect(
      ephemeralTargetSide([
        { trigger: "ON_PLAY", actions: [{ type: "HEAL", target: "TARGET_ALLY", value: 600 }] },
      ]),
    ).toBe("ally");
  });

  it("ignore les effets hors ON_PLAY et les cibles collectives", () => {
    expect(
      ephemeralTargetSide([
        { trigger: "PASSIVE", actions: [{ type: "HEAL", target: "TARGET_ALLY" }] },
        { trigger: "ON_PLAY", actions: [{ type: "BUFF_ATK_TEMP", target: "ALL_ALLIES" }] },
      ]),
    ).toBeNull();
  });
});
```

Dans `game/state.ts` :
- `export type PendingChoiceResolution = "pick_to_hand" | "discard";`, et mettre à jour le commentaire de doc : `pick_to_hand` récupère depuis le cimetière ou le deck, `discard` défausse depuis la main ;
- `export type ChoiceSource = "graveyard" | "deck" | "board" | "hand";` ;
- dans `ClientGameState`, ajouter :

```ts
  /** L'adversaire doit résoudre un choix avant que la partie continue. */
  opponentChoosing: boolean;
```

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: PASS.

- [ ] **Step 2: Tests (ils échouent)**

`apps/backend/src/fights/engine/supports.spec.ts` :

```ts
import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import type { Seat } from '@pipou/shared';
import type { GameState, MonsterOnBoard } from '../interfaces/game-state.interface';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, equipmentCard, monsterCard } from '../testing/cards';
import { graveyardNames, handNames, monsterNamed, scenario } from '../testing/scenario';

const { ON_PLAY } = EffectTrigger;
const T = EffectTarget;
const A = ActionType;

const forceDelta = () =>
  ephemeralCard('Force Delta', [effect(ON_PLAY, [act(A.DESTROY_MONSTER, T.ENEMY_MONSTER)])]);
const soinUrgence = () =>
  ephemeralCard("Soin d'urgence", [
    effect(ON_PLAY, [act(A.HEAL, T.TARGET_ALLY, { value: 600 })]),
    effect(ON_PLAY, [act(A.HEAL, T.TARGET_ALLY, { value: 200 })], {
      type: EffectConditionType.SPECIFIC_CARD_ON_BOARD,
      value: 'Médecin Citrouille',
    }),
  ]);
const formatage = () =>
  ephemeralCard('Formatage', [effect(ON_PLAY, [act(A.DESTROY_MONSTER, T.TARGET_ALLY)])]);
const recyclage = () =>
  ephemeralCard('Recyclage', [
    effect(ON_PLAY, [act(A.DESTROY_MONSTER, T.TARGET_ALLY), act(A.DRAW, T.PLAYER)]),
  ]);
const migration = () =>
  ephemeralCard('Migration', [effect(ON_PLAY, [act(A.RETURN_TO_HAND, T.TARGET_ALLY)])]);
const gel = () =>
  ephemeralCard('Gel', [effect(ON_PLAY, [act(A.BLOCK_ATTACK, T.ENEMY_MONSTER, { value: 3 })])]);
const verrou = () =>
  ephemeralCard('Verrou', [effect(ON_PLAY, [act(A.FORCE_GUARD_LOCK_ENEMY, T.ENEMY_MONSTER)])]);

describe('GameEngine — supports Éphémères ciblés', () => {
  const engine = createEngine();
  const play = (game: GameState, seat: Seat, target?: MonsterOnBoard) =>
    engine.dispatch(game, seat, {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: target?.instanceId,
    });

  it('Force Delta détruit le monstre adverse choisi et la victime pioche', () => {
    const game = scenario({
      p1: { hand: [forceDelta()] },
      p2: { monsters: [monsterCard('Lutin'), monsterCard('Golem')], deck: [monsterCard('A')] },
    });

    expect(play(game, 'p1', monsterNamed(game, 'p2', 'Golem'))).toEqual({});

    expect(graveyardNames(game, 'p2')).toEqual(['Golem']);
    expect(monsterNamed(game, 'p2', 'Lutin')).toBeDefined();
    expect(handNames(game, 'p2')).toEqual(['A']);
  });

  it('refuse une carte ciblée sans cible ou avec une cible du mauvais camp', () => {
    const game = scenario({
      p1: { hand: [forceDelta()], monsters: [monsterCard('Allié')] },
      p2: { monsters: [monsterCard('Lutin')] },
    });

    expect(play(game, 'p1').error).toBe('Choisis un monstre adverse comme cible');
    expect(play(game, 'p1', monsterNamed(game, 'p1', 'Allié')).error).toBe(
      'Choisis un monstre adverse comme cible',
    );
    expect(handNames(game, 'p1')).toEqual(['Force Delta']);
  });

  it("refuse une carte ciblée quand aucune cible n'existe", () => {
    const game = scenario({ p1: { hand: [forceDelta()] } });

    expect(play(game, 'p1').error).toBe('Aucune cible valide pour cette carte');
  });

  it("Soin d'urgence soigne l'allié choisi, davantage avec Médecin Citrouille", () => {
    const blesse = () => ({ card: monsterCard('Blessé', { hp: 1000 }), currentHp: 100 });
    const seul = scenario({ p1: { hand: [soinUrgence()], monsters: [blesse()] } });
    const avecMedecin = scenario({
      p1: {
        hand: [soinUrgence()],
        monsters: [blesse(), monsterCard('Médecin Citrouille', { hp: 1800 })],
      },
    });

    play(seul, 'p1', monsterNamed(seul, 'p1', 'Blessé'));
    play(avecMedecin, 'p1', monsterNamed(avecMedecin, 'p1', 'Blessé'));

    expect(monsterNamed(seul, 'p1', 'Blessé').currentHp).toBe(700);
    expect(monsterNamed(avecMedecin, 'p1', 'Blessé').currentHp).toBe(900);
  });

  it('Formatage détruit son propre monstre sans pioche', () => {
    const game = scenario({ p1: { hand: [formatage()], monsters: [monsterCard('Pion')] } });

    play(game, 'p1', monsterNamed(game, 'p1', 'Pion'));

    expect(graveyardNames(game, 'p1')).toEqual(['Formatage', 'Pion']);
    expect(handNames(game, 'p1')).toEqual([]);
  });

  it('Recyclage détruit son propre monstre et pioche exactement une carte', () => {
    const game = scenario({
      p1: { hand: [recyclage()], monsters: [monsterCard('Pion')], deck: [monsterCard('A'), monsterCard('B')] },
    });

    play(game, 'p1', monsterNamed(game, 'p1', 'Pion'));

    expect(handNames(game, 'p1')).toEqual(['A']);
  });

  it('Migration renvoie le monstre et ses équipements en main', () => {
    const game = scenario({
      p1: {
        hand: [migration()],
        monsters: [{ card: monsterCard('Pion'), equipments: [equipmentCard('Casque', [])] }],
      },
    });

    play(game, 'p1', monsterNamed(game, 'p1', 'Pion'));

    expect(handNames(game, 'p1')).toEqual(['Casque', 'Pion']);
    expect(game.player1.monsterZones[0]).toBeNull();
  });

  it('Gel et Verrou agissent sur le monstre adverse choisi', () => {
    const game = scenario({
      p1: { hand: [gel(), verrou()] },
      p2: { monsters: [monsterCard('Lutin'), monsterCard('Golem')] },
    });

    play(game, 'p1', monsterNamed(game, 'p2', 'Golem'));
    play(game, 'p1', monsterNamed(game, 'p2', 'Lutin'));

    expect(monsterNamed(game, 'p2', 'Golem').blockAttackTurns).toBe(3);
    expect(monsterNamed(game, 'p2', 'Lutin')).toMatchObject({ guardLocked: true, mode: 'guard' });
  });

  it("refuse un Éphémère dont aucun effet ON_PLAY n'a sa condition remplie", () => {
    const exigeant = ephemeralCard('Exigeant', [
      effect(ON_PLAY, [act(A.DRAW, T.PLAYER)], {
        type: EffectConditionType.HAND_SIZE_MIN,
        value: 5,
      }),
    ]);
    const game = scenario({ p1: { hand: [exigeant] } });

    expect(play(game, 'p1').error).toBe('Condition non remplie pour jouer cette carte');
  });
});
```

`apps/backend/src/fights/engine/choices.spec.ts` :

```ts
import { ActionType, CardType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import {
  attackWith,
  graveyardNames,
  handNames,
  scenario,
  P1_ID,
  P2_ID,
} from '../testing/scenario';

/** Monstre qui, détruit, cherche un « Noyau » dans le deck. */
const eclaireur = (name: string) =>
  monsterCard(name, {
    atk: 500,
    hp: 500,
    effects: [
      effect(EffectTrigger.ON_DEATH, [
        act(ActionType.SEARCH_DECK, EffectTarget.PLAYER, {
          filter: { name: 'Noyau', type: CardType.MONSTER },
        }),
      ]),
    ],
  });

describe('GameEngine — choix en attente', () => {
  const engine = createEngine();

  it("un choix de l'adversaire bloque la partie jusqu'à sa résolution", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 900, hp: 900 })] },
      p2: { monsters: [eclaireur('Éclaireur')], deck: [monsterCard('Autre'), monsterCard('Noyau Test')] },
    });
    attackWith(engine, game, 'p1', 'Ogre', 'Éclaireur');

    expect(engine.dispatch(game, 'p1', { type: 'end_phase' }).error).toBe(
      "L'adversaire doit d'abord faire son choix",
    );
    const choice = game.pendingChoices[0];
    expect(choice.forUserId).toBe(P2_ID);

    expect(
      engine.dispatch(game, 'p2', { type: 'pick_cards', instanceIds: [choice.candidates[0].instanceId] }),
    ).toEqual({});
    expect(handNames(game, 'p2')).toEqual(['Autre', 'Noyau Test']);
    expect(engine.dispatch(game, 'p1', { type: 'end_phase' })).toEqual({});
  });

  it("les choix s'enchaînent dans l'ordre au lieu de s'écraser", () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [eclaireur('Éclaireur A')], deck: [monsterCard('Bouche-trou'), monsterCard('Noyau 1')] },
      p2: { monsters: [eclaireur('Éclaireur B')], deck: [monsterCard('Bouche-trou'), monsterCard('Noyau 2')] },
    });

    attackWith(engine, game, 'p1', 'Éclaireur A', 'Éclaireur B');

    expect(game.pendingChoices.map((c) => c.forUserId)).toEqual([P1_ID, P2_ID]);
    const [first, second] = game.pendingChoices;
    expect(
      engine.dispatch(game, 'p2', { type: 'pick_cards', instanceIds: [second.candidates[0].instanceId] }).error,
    ).toBe("L'adversaire doit d'abord faire son choix");
    engine.dispatch(game, 'p1', { type: 'pick_cards', instanceIds: [first.candidates[0].instanceId] });
    engine.dispatch(game, 'p2', { type: 'pick_cards', instanceIds: [second.candidates[0].instanceId] });
    expect(game.pendingChoices).toEqual([]);
  });

  it("DISCARD : l'adversaire choisit les cartes défaussées", () => {
    const pillage = ephemeralCard('Pillage', [
      effect(EffectTrigger.ON_PLAY, [act(ActionType.DISCARD, EffectTarget.OPPONENT, { value: 2 })]),
    ]);
    const game = scenario({
      p1: { hand: [pillage] },
      p2: { hand: ['A', 'B', 'C', 'D'].map((n) => monsterCard(n)) },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
    const choice = game.pendingChoices[0];
    expect(choice).toMatchObject({ forUserId: P2_ID, count: 2, resolution: 'discard' });

    engine.dispatch(game, 'p2', {
      type: 'pick_cards',
      instanceIds: [game.player2.hand[1].instanceId, game.player2.hand[3].instanceId],
    });

    expect(handNames(game, 'p2')).toEqual(['A', 'C']);
    expect(graveyardNames(game, 'p2')).toEqual(['B', 'D']);
  });

  it('DISCARD sur une main trop petite défausse tout, sans choix', () => {
    const pillage = ephemeralCard('Pillage', [
      effect(EffectTrigger.ON_PLAY, [act(ActionType.DISCARD, EffectTarget.OPPONENT, { value: 2 })]),
    ]);
    const game = scenario({ p1: { hand: [pillage] }, p2: { hand: [monsterCard('Seule')] } });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });

    expect(game.pendingChoices).toEqual([]);
    expect(graveyardNames(game, 'p2')).toEqual(['Seule']);
  });

  it('le timeout vide la file de choix et fait avancer la partie', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 900, hp: 900 })] },
      p2: { monsters: [eclaireur('Éclaireur')], deck: [monsterCard('Autre'), monsterCard('Noyau Test')] },
    });
    attackWith(engine, game, 'p1', 'Ogre', 'Éclaireur');

    engine.timeout(game);

    expect(game.pendingChoices).toEqual([]);
    expect(game.phase).toBe('end');
  });
});
```

Dans le premier test, la destruction en combat fait piocher `Autre` à p2 (le deck est dans l'ordre), puis la recherche lui ajoute `Noyau Test`.

Run: `pnpm --filter @pipou/backend exec jest fights/engine/supports fights/engine/choices`
Expected: FAIL. La cible des Éphémères est ignorée, il n'existe pas de file de choix et `DISCARD` n'est pas implémenté.

- [ ] **Step 3: File de choix**

`interfaces/game-state.interface.ts` : dans `GameState`, remplacer `pendingChoice?: PendingChoice;` par :

```ts
  /** Choix à résoudre, dans l'ordre ; la partie attend tant qu'il en reste. */
  pendingChoices: PendingChoice[];
```

Dans `helpers/game-state.helper.ts` (importer `PendingChoice`) :

```ts
/** Choix à résoudre en premier, s'il y en a un. */
export function currentChoice(game: GameState): PendingChoice | undefined {
  return game.pendingChoices[0];
}

/** Range un choix derrière ceux déjà en attente. */
export function queueChoice(game: GameState, choice: PendingChoice): void {
  game.pendingChoices.push(choice);
}
```

Remplacer chaque `pendingChoice = undefined` par `pendingChoices = []` :
- `helpers/game-end.helper.ts` (`finishGame`) ;
- `engine/game-engine.ts` (`timeout`).

Initialiser `pendingChoices: []` dans `matchmaking.service.ts` (`buildInitialGameState`) et dans `testing/scenario.ts` (`scenario`).

`helpers/client-state.builder.ts` : remplacer le calcul de `pendingChoice` par :

```ts
  const choice = game.pendingChoices[0];
  const pendingChoice =
    choice?.forUserId === userId
      ? {
          candidates: choice.candidates.map((c) => ({
            instanceId: c.instanceId,
            baseCard: {
              id: c.baseCard.id,
              name: c.baseCard.name,
              type: c.baseCard.type,
              atk: c.baseCard.atk,
              hp: c.baseCard.hp,
              rarity: c.baseCard.rarity,
              supportType: c.baseCard.supportType,
            },
            source: c.source,
          })),
          count: choice.count,
          prompt: choice.prompt,
          resolution: choice.resolution,
        }
      : undefined;
```

et ajouter `opponentChoosing: !!choice && choice.forUserId !== userId,` dans l'objet renvoyé.

Dans `engine/game-engine.ts` (`dispatch`), après le contrôle du mulligan :

```ts
    const choice = currentChoice(game);
    if (choice && !(action.type === 'pick_cards' && choice.forUserId === userId))
      return {
        error:
          choice.forUserId === userId
            ? "Résous d'abord ton choix en attente"
            : "L'adversaire doit d'abord faire son choix",
      };
```

Pour cela, déplacer `const userId = seatPlayer(game, seat).userId;` avant les contrôles de phase.

`services/pick.service.ts` (fichier complet) :

```ts
import { Injectable } from '@nestjs/common';
import { GameState } from '../interfaces/game-state.interface';
import {
  addLog,
  currentChoice,
  getPlayerState,
  shuffle,
} from '../helpers/game-state.helper';

@Injectable()
export class PickService {
  /** Résout le premier choix en attente avec les cartes choisies. */
  pickCards(
    game: GameState,
    userId: number,
    instanceIds: string[],
  ): { error?: string } {
    const choice = currentChoice(game);
    if (!choice || choice.forUserId !== userId)
      return { error: 'Aucun choix de carte en attente' };

    const expected = Math.min(choice.count, choice.candidates.length);
    const picked = [...new Set(instanceIds)];
    if (picked.length !== expected)
      return { error: `Sélectionnez exactement ${expected} carte(s)` };
    if (picked.some((id) => !choice.candidates.some((c) => c.instanceId === id)))
      return { error: 'Carte introuvable dans les choix disponibles' };

    const player = getPlayerState(game, userId);

    if (choice.resolution === 'discard') {
      for (const id of picked) {
        const idx = player.hand.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = player.hand.splice(idx, 1);
        player.graveyard.push(card);
        addLog(game, `🗑️ ${player.username} défausse ${card.baseCard.name}`);
      }
    } else {
      let pickedFromDeck = false;
      for (const id of picked) {
        const candidate = choice.candidates.find((c) => c.instanceId === id)!;
        const pile =
          candidate.source === 'graveyard' ? player.graveyard : player.deck;
        const idx = pile.findIndex((c) => c.instanceId === id);
        if (idx === -1) continue;
        const [card] = pile.splice(idx, 1);
        player.hand.push(card);
        if (candidate.source === 'deck') pickedFromDeck = true;
        addLog(
          game,
          candidate.source === 'graveyard'
            ? `📥 ${player.username} récupère ${card.baseCard.name} depuis son cimetière`
            : `🔮 ${player.username} récupère ${card.baseCard.name} depuis son deck`,
        );
      }
      if (pickedFromDeck) shuffle(player.deck);
    }

    game.pendingChoices.shift();
    return {};
  }
}
```

`testing/engine.ts` : `new PickService()` (sans argument).

- [ ] **Step 4: Cibles, actions et supports**

`effects/effect-targets.resolver.ts` : remplacer les cas `ALLY_MONSTER`, `ENEMY_MONSTER` et `TARGET_ALLY` par :

```ts
    // Cible choisie : monstre visé par un Éphémère, ou attaquant (ON_DEFEND)
    case EffectTarget.ALLY_MONSTER:
    case EffectTarget.TARGET_ALLY:
      if (ctx.targetMonster && allies.includes(ctx.targetMonster)) {
        monsters = [ctx.targetMonster];
        register(monsters, owner);
      }
      break;

    case EffectTarget.ENEMY_MONSTER:
      if (ctx.targetMonster && enemies.includes(ctx.targetMonster)) {
        monsters = [ctx.targetMonster];
        register(monsters, opponent);
      }
      break;
```

`effects/effect-actions.applier.ts` (importer `queueChoice` depuis le helper) :
- dans `RETURN_FROM_GRAVEYARD`, `RETURN_FROM_GRAVEYARD_OR_DECK` et `SEARCH_DECK`, remplacer chaque `ctx.game.pendingChoice = { ... };` par `queueChoice(ctx.game, { ... });` ;
- remplacer les cas `DESTROY_MONSTER`, `RETURN_TO_HAND`, `FORCE_ATTACK_MODE_ENEMY`, `BLOCK_ATTACK` et `FORCE_GUARD_LOCK_ENEMY` par les versions ci-dessous, sans choix serveur : la cible est déjà résolue ;
- ajouter `DISCARD` :

```ts
      case ActionType.DESTROY_MONSTER:
        for (const target of targets.monsters)
          destroy(targets.ownerOfMonster(target), target.instanceId);
        break;

      case ActionType.RETURN_TO_HAND:
        for (const target of targets.monsters)
          returnMonsterToHand(target, targets.ownerOfMonster(target), ctx, card);
        break;

      case ActionType.FORCE_ATTACK_MODE_ENEMY:
        for (const m of targets.monsters) {
          m.forcedAttackMode = true;
          m.mode = 'attack';
          ctx.log.push(`🔒 ${card.baseCard.name} force ${m.card.baseCard.name} en mode Attaque`);
        }
        break;

      case ActionType.BLOCK_ATTACK:
        for (const m of targets.monsters) {
          const turns = action.value ?? 1;
          m.blockAttackTurns = turns;
          ctx.log.push(
            `🧊 ${card.baseCard.name} empêche ${m.card.baseCard.name} d'attaquer pendant ${turns} tour(s)`,
          );
        }
        break;

      case ActionType.FORCE_GUARD_LOCK_ENEMY:
        for (const m of targets.monsters) {
          m.guardLocked = true;
          m.mode = 'guard';
          ctx.log.push(`🔒 ${card.baseCard.name} verrouille ${m.card.baseCard.name} en mode Garde`);
        }
        break;

      case ActionType.DISCARD: {
        const count = action.value ?? 1;
        for (const p of targets.players) {
          if (p.hand.length <= count) {
            const discarded = p.hand.splice(0);
            p.graveyard.push(...discarded);
            if (discarded.length > 0)
              ctx.log.push(`🗑️ ${p.username} défausse toute sa main (${discarded.length})`);
            continue;
          }
          queueChoice(ctx.game, {
            forUserId: p.userId,
            candidates: p.hand.map((c) => ({
              instanceId: c.instanceId,
              baseCard: c.baseCard,
              source: 'hand' as const,
            })),
            count,
            prompt: `Choisissez ${count} carte(s) à défausser`,
            resolution: 'discard',
          });
          ctx.log.push(`🗑️ ${p.username} doit défausser ${count} carte(s)…`);
        }
        break;
      }
```

`services/support.service.ts` :
- importer `ephemeralTargetSide` depuis `@pipou/shared`, `checkCondition` depuis `../effects/effect-conditions`, `getOpponentState` depuis le helper et le type `MonsterOnBoard` ;
- retirer l'import de `EffectConditionType` ;
- dans `playSupport`, remplacer le bloc `if (card.baseCard.supportType === SupportType.EPHEMERAL) { ... }` par :

```ts
    let targetMonster: MonsterOnBoard | undefined;
    if (card.baseCard.supportType === SupportType.EPHEMERAL) {
      if (!this.isSupportPlayable(game, card, userId))
        return { error: 'Condition non remplie pour jouer cette carte' };

      const side = ephemeralTargetSide(card.baseCard.effects);
      if (side) {
        const pool =
          side === 'ally'
            ? player.monsterZones
            : getOpponentState(game, userId).monsterZones;
        if (!pool.some((m) => m !== null))
          return { error: 'Aucune cible valide pour cette carte' };
        targetMonster =
          pool.find((m) => m?.instanceId === targetInstanceId) ?? undefined;
        if (!targetMonster)
          return {
            error:
              side === 'ally'
                ? 'Choisis un de tes monstres comme cible'
                : 'Choisis un monstre adverse comme cible',
          };
      }
    }
```

- dans le `case SupportType.EPHEMERAL`, passer `targetMonster` au contexte : `{ game, ownerUserId: userId, targetMonster, log }` ;
- remplacer `isSupportPlayable` par :

```ts
  /** Jouable sans effet ON_PLAY, ou si au moins un effet ON_PLAY a sa condition remplie. */
  private isSupportPlayable(
    game: GameState,
    card: CardInstance,
    userId: number,
  ): boolean {
    const onPlay = (card.baseCard.effects ?? []).filter(
      (e) => e.trigger === EffectTrigger.ON_PLAY,
    );
    return (
      onPlay.length === 0 ||
      onPlay.some((e) =>
        checkCondition(e, { game, ownerUserId: userId, sourceCard: card, log: [] }),
      )
    );
  }
```

- [ ] **Step 5: Frontend**

`CardPickModal.tsx` : ne garder que deux résolutions, détecter les choix sur le plateau par leurs candidats, et accepter un libellé de confirmation.

```tsx
interface Props {
  choice: PendingChoice;
  onConfirm: (instanceIds: string[]) => void;
  /** Optionnel — affiché uniquement quand fourni (ex: modal de ciblage interne) */
  onCancel?: () => void;
  /** Remplace le libellé du bouton de confirmation (ex: ciblage d'un Éphémère). */
  confirmLabel?: string;
}

const RESOLUTION_ICON: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "🔮",
  discard: "🗑️",
};

const RESOLUTION_CONFIRM: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "✅ Récupérer",
  discard: "🗑️ Défausser",
};

const RESOLUTION_HEADER_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#fdf6f9",
  discard: "#fff5f5",
};

const RESOLUTION_HEADER_COLOR: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
};

const RESOLUTION_BTN_BG: Record<PendingChoiceResolution, string> = {
  pick_to_hand: "#7a1c3b",
  discard: "#c0392b",
};

function sourceLabel(source: ClientChoiceCandidate["source"]): string {
  if (source === "graveyard") return "🪦 Cimetière";
  if (source === "deck") return "📚 Deck";
  if (source === "hand") return "🖐 Main";
  return "🎴 Terrain";
}
```

Dans le composant :
- `const isBoardPick = choice.candidates.every((c) => c.source === "board");` ;
- `const confirmText = confirmLabel ?? RESOLUTION_CONFIRM[resolution];` ;
- la classe de carte devient `isBoardPick ? "cpm-card--board" : ""` ;
- l'appel devient `sourceLabel(c.source)` ;
- supprimer le bloc « indicateur visuel de l'action » (`cpm-action-hint`) ;
- utiliser `{confirmText}` à la place de `{confirmLabel}` dans le bouton.

`FightBoard.tsx` :
- importer `ephemeralTargetSide` depuis `@pipou/shared` ;
- supprimer `ephemeralNeedsMonsterTarget` ;
- dans `openTargetPick`, remplacer le paramètre `card: HandCard` par `cardName: string` et le cas « Aucune cible » par un simple `return` (la barre d'action désactive déjà le bouton) ;
- la résolution du choix local devient `"pick_to_hand"`.

Le handler `onPlaySupport` passé à `FightActionBar` devient :

```tsx
        onPlaySupport={(handIdx, zoneIndex, targetInstanceId) => {
          if (targetInstanceId !== undefined || zoneIndex !== undefined) {
            onPlaySupport(handIdx, zoneIndex, targetInstanceId);
            onSetSelectedCard(null);
            onSetSelectedZone(null);
            onSetPayIndices([]);
            return;
          }
          const instance = gs.me.hand[handIdx];
          const side = ephemeralTargetSide(instance?.baseCard.effects);
          if (instance && side) {
            openTargetPick(handIdx, instance.baseCard.name, side);
            return;
          }
          onPlaySupport(handIdx);
          onSetSelectedCard(null);
          onSetSelectedZone(null);
          onSetPayIndices([]);
        }}
        playBlockedReason={playBlockedReason}
```

avec, avant le `return` du composant :

```tsx
  const selectedTargetSide =
    selectedCard !== null
      ? ephemeralTargetSide(gs.me.hand[selectedCard]?.baseCard.effects)
      : null;
  const playBlockedReason =
    selectedTargetSide !== null &&
    !(selectedTargetSide === "ally"
      ? gs.me.monsterZones
      : gs.opponent.monsterZones
    ).some(Boolean)
      ? "Aucune cible valide"
      : undefined;
```

Le `CardPickModal` de ciblage reçoit `confirmLabel="🎯 Cibler"`.

`FightActionBar.tsx` :
- ajouter la prop `playBlockedReason?: string` ;
- le bouton Éphémère devient :

```tsx
          {card.type === "support" && card.supportType === "EPHEMERAL" && (
            <button
              onClick={() => onPlaySupport(selectedCard!)}
              className="fab-btn"
              disabled={playBlockedReason !== undefined}
              title={playBlockedReason}
            >
              ✨ Jouer{playBlockedReason ? ` — ${playBlockedReason}` : ""}
            </button>
          )}
```

`FightPage.tsx` : juste avant `<FightBoard`, ajouter :

```tsx
              {gameState.opponentChoosing && (
                <div className="fp-waiting-choice">
                  ⏳ {gameState.opponent.username} fait un choix…
                </div>
              )}
```

`FightPage.css` :

```css
.fp-waiting-choice {
  margin: 0 auto 8px;
  padding: 6px 14px;
  border-radius: 99px;
  background: var(--color-cream);
  color: var(--color-bordeaux);
  font-weight: 600;
  text-align: center;
  width: fit-content;
}
```

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

Run: `pnpm typecheck && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src apps/backend/src/fights apps/frontend/src/features/fight
git commit -m "fix(fights): use the client-chosen target for ephemerals, queue pending choices, add DISCARD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Effets génériques à la place des cartes codées en dur

**Files:**
- Modify: `packages/shared/src/enums/effect.ts`, `enums/enums.test.ts`, `game/rules.ts`, `game/rules.test.ts`, `game/state.ts`, `socket/fight.ts`
- Modify: `apps/backend/src/fights/interfaces/game-state.interface.ts`, `helpers/client-state.builder.ts`
- Modify: `apps/backend/src/fights/effects/effect-actions.applier.ts`
- Modify: `apps/backend/src/fights/services/summon.service.ts`, `support.service.ts`, `matchmaking.service.ts`
- Modify: `apps/backend/src/fights/fights.gateway.ts`, `testing/scenario.ts`
- Modify: `apps/backend/src/cards/dto/create-card.dto.ts` (+ spec)
- Modify: `apps/frontend/src/features/fight/{fight.types.ts,handCard.ts,FightBoard.tsx,FightActionBar.tsx,FightHand.tsx,FightPage.tsx,fight.effects.ts}`
- Test: `apps/backend/src/fights/engine/generic-cards.spec.ts`

**Interfaces:**
- Produces (shared) :
  - `EffectTrigger.ON_RECYCLE` ;
  - `ActionType.SUMMONABLE_ON_ENEMY_SIDE` ;
  - `ActionType.STEAL_PRIME` est supprimé ;
  - `canSummonOnEnemySide(effects): boolean` ;
  - `MyClientState.freeSummonInstanceIds: string[]` remplace `freeSummonAvailable` ;
  - `SummonPayload.onOpponentSide?: boolean` ;
  - l'événement `fight:summon_opponent` est supprimé.
- Produces (backend) : `PlayerGameState.freeSummonInstanceIds: string[]`.

- [ ] **Step 1: Shared**

Dans `enums/effect.ts` :
- ajouter `ON_RECYCLE: "ON_RECYCLE",` en fin de `EffectTrigger` ;
- supprimer `STEAL_PRIME` de `ActionType` ;
- ajouter `SUMMONABLE_ON_ENEMY_SIDE: "SUMMONABLE_ON_ENEMY_SIDE",` en fin de `ActionType`.

Dans `enums.test.ts` :
- la liste `EffectTrigger` se termine par `"PASSIVE", "ON_RECYCLE"` ;
- la liste `ActionType` n'a plus `"STEAL_PRIME"` et se termine par `"CANNOT_ATTACK_ON_SUMMON_TURN", "SUMMONABLE_ON_ENEMY_SIDE"`.

Dans `game/rules.ts` (importer aussi `ActionType`) :

```ts
/** La carte peut être invoquée sur une zone adverse libre (effet passif). */
export function canSummonOnEnemySide(
  effects: readonly CardEffect[] | null | undefined,
): boolean {
  return (effects ?? []).some(
    (e) =>
      e.trigger === EffectTrigger.PASSIVE &&
      e.actions.some((a) => a.type === ActionType.SUMMONABLE_ON_ENEMY_SIDE),
  );
}
```

Dans `game/rules.test.ts`, ajouter :

```ts
describe("canSummonOnEnemySide", () => {
  it("vrai seulement avec le passif SUMMONABLE_ON_ENEMY_SIDE", () => {
    expect(
      canSummonOnEnemySide([
        { trigger: "PASSIVE", actions: [{ type: "SUMMONABLE_ON_ENEMY_SIDE", target: "SELF" }] },
      ]),
    ).toBe(true);
    expect(canSummonOnEnemySide(null)).toBe(false);
  });
});
```

(avec `canSummonOnEnemySide` ajouté à l'import).

Dans `game/state.ts`, la propriété `freeSummonAvailable?: boolean` de `MyClientState` devient :

```ts
  /** Cartes de la main invocables gratuitement (instanceId). */
  freeSummonInstanceIds: string[];
```

Dans `socket/fight.ts` :
- ajouter dans `SummonPayload` :

```ts
  /** Invocation sur une zone adverse libre (cartes SUMMONABLE_ON_ENEMY_SIDE). */
  onOpponentSide?: boolean;
```

- supprimer la ligne `"fight:summon_opponent"`.

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: PASS.

- [ ] **Step 2: Tests (ils échouent)**

`apps/backend/src/fights/engine/generic-cards.spec.ts` :

```ts
import {
  ActionType,
  Archetype,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';
import { createEngine } from '../testing/engine';
import { act, effect, ephemeralCard, monsterCard } from '../testing/cards';
import { handNames, monsterNamed, scenario, P1_ID } from '../testing/scenario';

describe('GameEngine — effets génériques (ex-cartes codées en dur)', () => {
  const engine = createEngine();

  it('Clairon : recycler la carte déclenche ON_RECYCLE (pioche)', () => {
    const clairon = ephemeralCard('Clairon', [
      effect(EffectTrigger.ON_PLAY, [
        act(ActionType.GAIN_RECYCLE_ENERGY, EffectTarget.PLAYER, { value: 2 }),
      ]),
      effect(EffectTrigger.ON_RECYCLE, [
        act(ActionType.DRAW, EffectTarget.PLAYER, { value: 1 }),
      ]),
    ]);
    const game = scenario({ p1: { hand: [clairon], deck: [monsterCard('Renfort')] } });

    engine.dispatch(game, 'p1', { type: 'recycle', handIndex: 0 });

    expect(game.player1.recycleEnergy).toBe(1);
    expect(handNames(game, 'p1')).toEqual(['Renfort']);
  });

  it('Touille : seule la carte source devient gratuite, une fois', () => {
    const touille = monsterCard('Touille', {
      cost: 2,
      archetype: Archetype.PIPOU,
      effects: [
        effect(
          EffectTrigger.ON_ALLY_SUMMON,
          [act(ActionType.SET_FREE_SUMMON, EffectTarget.PLAYER, { value: 1 })],
          { type: EffectConditionType.ARCHETYPE_ON_BOARD, value: 'pipou' },
        ),
      ],
    });
    const game = scenario({
      p1: {
        hand: [
          monsterCard('Recrue', { archetype: Archetype.PIPOU }),
          touille,
          monsterCard('Lourdaud', { cost: 2 }),
        ],
      },
    });

    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, paymentHandIndices: [] });
    expect(game.player1.freeSummonInstanceIds).toEqual([game.player1.hand[0].instanceId]);

    expect(
      engine.dispatch(game, 'p1', { type: 'summon', handIndex: 1, zoneIndex: 1, paymentHandIndices: [] }).error,
    ).toContain('Pas assez de cartes');
    expect(
      engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 1, paymentHandIndices: [] }),
    ).toEqual({});
    expect(game.player1.freeSummonInstanceIds).toEqual([]);
  });

  it('Zeta : invocable sur le terrain adverse grâce à son passif, et seulement elle', () => {
    const zeta = monsterCard('Zeta', {
      atk: 0,
      hp: 400,
      effects: [
        effect(EffectTrigger.ON_SUMMON, [
          act(ActionType.SET_TURN_COUNTER, EffectTarget.SELF, { value: 3 }),
        ]),
        effect(EffectTrigger.PASSIVE, [
          act(ActionType.SUMMONABLE_ON_ENEMY_SIDE, EffectTarget.SELF),
        ]),
      ],
    });
    const game = scenario({ p1: { hand: [monsterCard('Banal'), zeta] } });

    expect(
      engine.dispatch(game, 'p1', {
        type: 'summon', handIndex: 0, zoneIndex: 0, paymentHandIndices: [], onOpponentSide: true,
      }).error,
    ).toBe('Banal ne peut pas être invoqué sur le terrain adverse');

    engine.dispatch(game, 'p1', {
      type: 'summon', handIndex: 1, zoneIndex: 2, paymentHandIndices: [], onOpponentSide: true,
    });
    const placed = monsterNamed(game, 'p2', 'Zeta');
    expect(game.player2.monsterZones[2]).toBe(placed);
    expect(placed).toMatchObject({ ownerUserId: P1_ID, turnCounter: 3 });
  });
});
```

Dans `apps/backend/src/cards/dto/create-card.dto.spec.ts`, ajouter :

```ts
  it('refuse DEAL_DAMAGE visant un joueur', async () => {
    const errors = await errorsFor([
      { trigger: 'ON_PLAY', actions: [{ type: 'DEAL_DAMAGE', target: 'OPPONENT', value: 100 }] },
    ]);
    expect(errors).not.toEqual([]);
  });
```

Run: `pnpm --filter @pipou/backend exec jest generic-cards create-card.dto`
Expected: FAIL.

- [ ] **Step 3: Backend**

`interfaces/game-state.interface.ts` : dans `PlayerGameState`, remplacer `freeSummonAvailable?: boolean;` par `freeSummonInstanceIds: string[];`. Initialiser `freeSummonInstanceIds: []` dans `matchmaking.service.ts` (`createEmptyPlayerState`) et dans `testing/scenario.ts` (`buildPlayer`). Dans `client-state.builder.ts`, remplacer `freeSummonAvailable: me.freeSummonAvailable` par `freeSummonInstanceIds: me.freeSummonInstanceIds`.

`effects/effect-actions.applier.ts` :
- supprimer le `case ActionType.STEAL_PRIME` ;
- dans `DEAL_DAMAGE`, supprimer la boucle sur `targets.players` : les dégâts ne visent que des monstres ;
- remplacer `DRAW` et `SET_FREE_SUMMON` (importer `drawCard`) par :

```ts
      case ActionType.DRAW:
        for (const p of targets.players) {
          for (let i = 0; i < (action.value ?? 1); i++) drawCard(ctx.game, p.userId);
        }
        break;
```

```ts
      case ActionType.SET_FREE_SUMMON:
        // La carte source (en main) devient invocable gratuitement
        for (const p of targets.players) {
          if (!p.hand.includes(card)) continue;
          if (p.freeSummonInstanceIds.includes(card.instanceId)) continue;
          p.freeSummonInstanceIds.push(card.instanceId);
          ctx.log.push(`⚡ ${card.baseCard.name} peut être invoqué gratuitement !`);
        }
        break;
```

`services/summon.service.ts` :
- supprimer `ZETA_CARD_ID` ;
- importer `canSummonOnEnemySide` depuis `@pipou/shared` ;
- `summon` devient :

```ts
  /** Invoque un monstre de la main, sur son terrain ou sur une zone adverse libre. */
  summon(
    game: GameState,
    userId: number,
    handIndex: number,
    zoneIndex: number,
    paymentHandIndices: number[],
    onOpponentSide: boolean,
  ): { error?: string } {
    if (onOpponentSide) {
      const card = getPlayerState(game, userId).hand[handIndex];
      if (!card) return { error: 'Index main invalide' };
      if (!canSummonOnEnemySide(card.baseCard.effects))
        return {
          error: `${card.baseCard.name} ne peut pas être invoqué sur le terrain adverse`,
        };
    }
    return this.doSummon(
      game,
      userId,
      handIndex,
      zoneIndex,
      paymentHandIndices,
      onOpponentSide,
    );
  }
```

- dans `doSummon`, les deux lignes sur `isFree` deviennent :

```ts
    const isFree = player.freeSummonInstanceIds.includes(card.instanceId);
    if (isFree)
      player.freeSummonInstanceIds = player.freeSummonInstanceIds.filter(
        (id) => id !== card.instanceId,
      );
```

`services/support.service.ts` : dans `recycleFromHand`, remplacer tout ce qui suit le `player.graveyard.push(card);` par :

```ts
    player.recycleEnergy += 1;
    addLog(
      game,
      `♻️ ${player.username} recycle ${card.baseCard.name} → +1 énergie (${player.recycleEnergy} total)`,
    );

    const log: string[] = [];
    this.effectsResolver.resolve(card, EffectTrigger.ON_RECYCLE, {
      game,
      ownerUserId: userId,
      log,
    });
    log.forEach((l) => addLog(game, l));
    return {};
```

Retirer l'import de `drawCard` s'il ne sert plus.

`fights.gateway.ts` :
- supprimer le handler `fight:summon_opponent` ;
- dans `fight:summon`, ajouter `onOpponentSide: data.onOpponentSide ?? false` à l'action.

`cards/dto/create-card.dto.ts` : ajouter la contrainte suivante (avec `Validate`, `ValidatorConstraint`, `ValidatorConstraintInterface` et `ValidationArguments` importés de `class-validator`) :

```ts
/** DEAL_DAMAGE ne vise que des monstres. */
@ValidatorConstraint({ name: 'damageTargetsMonsters' })
class DamageTargetsMonsters implements ValidatorConstraintInterface {
  validate(target: EffectTarget, args: ValidationArguments): boolean {
    const action = args.object as EffectActionDto;
    return (
      action.type !== ActionType.DEAL_DAMAGE ||
      (target !== EffectTarget.PLAYER && target !== EffectTarget.OPPONENT)
    );
  }

  defaultMessage(): string {
    return 'DEAL_DAMAGE ne peut viser que des monstres';
  }
}
```

et décorer `target` dans `EffectActionDto` :

```ts
  @IsEnum(EffectTarget)
  @Validate(DamageTargetsMonsters)
  target!: EffectTarget;
```

La classe `DamageTargetsMonsters` doit être déclarée avant `EffectActionDto`.

- [ ] **Step 4: Frontend**

`fight.types.ts` : supprimer `FREE_SUMMON_CARD_ID` et `NOYAU_ZETA_CARD_ID`.

`handCard.ts` : ajouter `instanceId: string;` à `HandCard` et `instanceId: c.instanceId,` dans `toHandCard`.

`FightBoard.tsx` (importer `canSummonOnEnemySide` depuis `@pipou/shared`, retirer l'import des constantes) :

```tsx
  // Carte invocable sur le terrain adverse (passif SUMMONABLE_ON_ENEMY_SIDE)
  const isZeta =
    selectedHandCard?.type === "monster" &&
    selectedCard !== null &&
    canSummonOnEnemySide(gs.me.hand[selectedCard]?.baseCard.effects);
```

Dans `handleZoneClick` et `handleOpponentZoneClick`, le test de gratuité devient :

```tsx
        const isFreeCard =
          selectedHandCard !== null &&
          gs.me.freeSummonInstanceIds.includes(selectedHandCard.instanceId);
```

(dans `handleOpponentZoneClick`, utiliser `card.instanceId`). L'indice affiché devient `🦠 Sélectionne une zone adverse vide pour implanter {selectedHandCard?.name}`. Les props `freeSummonAvailable={gs.me.freeSummonAvailable}` deviennent `freeSummonInstanceIds={gs.me.freeSummonInstanceIds}`, pour `FightHand` comme pour `FightActionBar`.

`FightActionBar.tsx` : la prop `freeSummonAvailable?: boolean` devient `freeSummonInstanceIds: string[]`, et `const isFreeCard = card !== null && freeSummonInstanceIds.includes(card.instanceId);`.

`FightHand.tsx` : même remplacement, avec `const isFree = freeSummonInstanceIds.includes(card.instanceId);`.

`FightPage.tsx`, `summonZeta` : émettre `"fight:summon"` avec `onOpponentSide: true` au lieu de `"fight:summon_opponent"`.

`fight.effects.ts` :
- ajouter `ON_RECYCLE: "Recyclage",` à `TRIGGER_LABEL` ;
- supprimer `STEAL_PRIME` de `ACTION_META` ;
- ajouter :

```ts
  SUMMONABLE_ON_ENEMY_SIDE: {
    icon: "🦠",
    label: () => "Invocable sur le terrain adverse",
    type: "neutral",
  },
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest`
Expected: PASS. Aucune suite qui passe sur `main` ne doit échouer.

Run: `pnpm typecheck && pnpm --filter @pipou/frontend test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src apps/backend/src apps/frontend/src/features/fight
git commit -m "refactor(fights): replace hardcoded card ids with generic effects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Timer et reconnexion

**Files:**
- Modify: `packages/shared/src/socket/fight.ts`
- Modify: `apps/backend/src/fights/fights.service.ts`, `fights.gateway.ts`
- Modify: `apps/frontend/src/features/fight/FightPage.tsx`
- Test: `apps/backend/src/fights/fights.service.spec.ts` (ajouts)

**Interfaces:**
- Produces :
  - l'événement `"fight:resumed": (payload: MatchFoundPayload) => void` ;
  - `RECONNECT_GRACE_MS = 60_000` ;
  - `FightsService.handleDisconnect(userId, socketId, server): void` (désormais synchrone, avec délai de grâce) ;
  - `FightsService.reconnect(userId, socketId): { matchId: number; opponentName: string; phase: GamePhase } | null` ;
  - `FightsService.emitState(matchId, server): void`.

- [ ] **Step 1: Tests (ils échouent)**

Ajouter dans le `describe('FightsService')` de `fights.service.spec.ts` :

```ts
  it('un timeout fait avancer la phase et relance le timer', async () => {
    const { service, server, game, timer } = setup();
    await service.act(game.matchId, P1_ID, { type: 'end_phase' }, server);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(game.phase).toBe('end');
    expect(timer.has(game.matchId)).toBe(true);
  });

  it('aucun timer ne tourne après la fin de la partie', async () => {
    const { service, server, game, timer } = setup();
    await service.act(game.matchId, P1_ID, { type: 'end_phase' }, server);

    await service.surrender(game.matchId, P1_ID, server);

    expect(timer.has(game.matchId)).toBe(false);
  });

  it('déconnexion puis retour sous 60 s : la partie continue sur le nouveau socket', async () => {
    const { service, server, game } = setup();
    service.handleDisconnect(P1_ID, 'socket-1', server);
    await jest.advanceTimersByTimeAsync(30_000);

    expect(service.reconnect(P1_ID, 'socket-neuf')).toEqual({
      matchId: game.matchId,
      opponentName: 'Bob',
      phase: 'main',
    });
    await jest.advanceTimersByTimeAsync(60_000);

    expect(game.phase).toBe('main');
    expect(game.player1.socketId).toBe('socket-neuf');
  });

  it('sans retour sous 60 s : défaite par déconnexion', async () => {
    const { service, server, game, gameEnd } = setup();
    service.handleDisconnect(P1_ID, 'socket-1', server);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(game).toMatchObject({ phase: 'finished', winner: P2_ID, endReason: 'disconnect' });
    expect(gameEnd.persistResult).toHaveBeenCalledWith(game);
  });

  it("ignore la fermeture d'un ancien socket du joueur", async () => {
    const { service, server, game } = setup();
    service.handleDisconnect(P1_ID, 'ancien-onglet', server);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(game.phase).toBe('main');
  });
```

Run: `pnpm --filter @pipou/backend exec jest fights/fights.service`
Expected: FAIL (`reconnect` n'existe pas, et la déconnexion fait perdre immédiatement).

- [ ] **Step 2: Implémenter**

Dans `packages/shared/src/socket/fight.ts`, ajouter à `ServerToClientEvents` :

```ts
  /** Reconnexion : une partie en cours a été retrouvée pour ce joueur. */
  "fight:resumed": (payload: MatchFoundPayload) => void;
```

Run: `pnpm build:shared`

Dans `fights.service.ts` :
- ajouter la constante de module `export const RECONNECT_GRACE_MS = 60_000;` ;
- ajouter le champ `private disconnectTimers = new Map<number, NodeJS.Timeout>();` ;
- importer le type `GamePhase` ;
- remplacer `handleDisconnect` par les méthodes ci-dessous :

```ts
  /** Fermeture d'un socket : sortie de file, puis délai de grâce avant la défaite. */
  handleDisconnect(userId: number, socketId: string, server: FightServer): void {
    this.leaveQueue(userId);
    const matchId = this.userToMatch.get(userId);
    if (matchId === undefined || this.disconnectTimers.has(userId)) return;
    const game = this.games.get(matchId);
    if (!game || game.phase === 'finished') return;

    const player = getPlayerState(game, userId);
    // Un ancien onglet qui se ferme ne compte pas
    if (player.socketId !== socketId) return;

    addLog(
      game,
      `🔌 ${player.username} s'est déconnecté — ${RECONNECT_GRACE_MS / 1000} s pour revenir`,
    );
    this.disconnectTimers.set(
      userId,
      setTimeout(() => {
        this.disconnectTimers.delete(userId);
        this.forfeit(matchId, userId, server).catch((err: unknown) =>
          this.logger.error(
            `Défaite par déconnexion du match ${matchId} en échec`,
            err instanceof Error ? err.stack : String(err),
          ),
        );
      }, RECONNECT_GRACE_MS),
    );
  }

  /** Reconnexion : rattache le nouveau socket à la partie en cours, s'il y en a une. */
  reconnect(
    userId: number,
    socketId: string,
  ): { matchId: number; opponentName: string; phase: GamePhase } | null {
    const matchId = this.userToMatch.get(userId);
    const game = matchId === undefined ? undefined : this.games.get(matchId);
    if (!game || game.phase === 'finished') return null;

    const player = getPlayerState(game, userId);
    const pending = this.disconnectTimers.get(userId);
    if (pending) {
      clearTimeout(pending);
      this.disconnectTimers.delete(userId);
      addLog(game, `🔌 ${player.username} est de retour`);
    }
    player.socketId = socketId;
    return {
      matchId: game.matchId,
      opponentName: getOpponentState(game, userId).username,
      phase: game.phase,
    };
  }

  /** Renvoie l'état d'une partie commencée à ses deux joueurs. */
  emitState(matchId: number, server: FightServer): void {
    const game = this.games.get(matchId);
    if (game && game.phase !== 'waiting') emitGameState(game, server);
  }

  private forfeit(
    matchId: number,
    userId: number,
    server: FightServer,
  ): Promise<void> {
    return this.withLock(matchId, async () => {
      const game = this.games.get(matchId);
      if (!game || game.phase === 'finished') return;
      finishGame(game, getOpponentState(game, userId).userId, 'disconnect');
      await this.afterChange(game, server);
    });
  }
```

Dans `cleanupGame`, annuler aussi les délais de grâce :

```ts
  private cleanupGame(game: GameState): void {
    for (const p of [game.player1, game.player2]) {
      clearTimeout(this.disconnectTimers.get(p.userId));
      this.disconnectTimers.delete(p.userId);
      this.userToMatch.delete(p.userId);
    }
    this.games.delete(game.matchId);
  }
```

Dans `fights.gateway.ts` :
- `handleDisconnect` devient :

```ts
  handleDisconnect(client: FightSocket): void {
    if (client.data.userId) {
      this.fightsService.handleDisconnect(
        client.data.userId,
        client.id,
        this.server,
      );
    }
  }
```

- à la fin du `try` de `handleConnection`, après `client.data.username = payload.username;`, ajouter :

```ts
      const resumed = this.fightsService.reconnect(client.data.userId, client.id);
      if (resumed) {
        client.emit('fight:resumed', {
          matchId: resumed.matchId,
          opponentName: resumed.opponentName,
        });
        this.fightsService.emitState(resumed.matchId, this.server);
      }
```

Dans `apps/frontend/src/features/fight/FightPage.tsx`, ajouter dans le `useEffect` du socket :

```tsx
    socket.on("fight:resumed", ({ matchId: mid, opponentName: oName }) => {
      setMatchId(mid);
      setOpponentName(oName);
      // fight:state suit si la partie a commencé ; sinon on revient au choix du deck
      setStatus((s) => (s === "playing" ? s : "selecting"));
      showToast("🔌 Partie en cours retrouvée", "ok");
    });
```

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS.

Run: `pnpm typecheck`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src apps/backend/src/fights apps/frontend/src/features/fight/FightPage.tsx
git commit -m "feat(fights): restart the turn timer on timeout and allow 60s to reconnect

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Vraies cartes — instantané, couverture des effets et combos

**Files:**
- Create: `apps/backend/scripts/extract-cards-snapshot.mjs`
- Modify: `apps/backend/package.json` (script `cards:snapshot`)
- Create: `apps/backend/src/fights/testing/fixtures/cards.snapshot.json` (généré)
- Create: `apps/backend/src/database/card-effect-patches.ts`
- Create: `apps/backend/src/fights/testing/real-cards.ts`
- Create: `apps/backend/src/fights/engine/supported-effects.ts`
- Test: `apps/backend/src/fights/engine/effects-coverage.spec.ts`, `apps/backend/src/fights/engine/real-cards.spec.ts`, `apps/backend/src/database/card-effect-patches.spec.ts`

**Interfaces:**
- Produces :
  - `CARD_EFFECT_PATCHES: CardEffectPatch[]` avec `CardEffectPatch { cardId: number; cardName: string; before: CardEffect[]; after: CardEffect[] }` ;
  - `canonicalEffects(value: unknown): string` ;
  - `planPatch(current: unknown, from: CardEffect[], to: CardEffect[]): 'apply' | 'already-done' | 'skip-diverged'` ;
  - `rawSnapshotCards(): Card[]`, `allRealCards(): Card[]`, `realCard(name: string): Card` ;
  - `SUPPORTED_TRIGGERS`, `SUPPORTED_CONDITIONS`, `SUPPORTED_ACTIONS`, `SUPPORTED_TARGETS` (de type `ReadonlySet`).

- [ ] **Step 1: Script d'extraction et instantané**

`apps/backend/scripts/extract-cards-snapshot.mjs` :

```js
// Extrait la table `card` du dump local (apps/backend/.e2e/aiven-dump.sql) vers
// src/fights/testing/fixtures/cards.snapshot.json. Seules les données de jeu
// (table card) sont lues : aucune donnée de joueur n'est écrite.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dumpPath = join(backendDir, '.e2e', 'aiven-dump.sql');
const outPath = join(backendDir, 'src', 'fights', 'testing', 'fixtures', 'cards.snapshot.json');

// Ordre des colonnes de la table `card` dans le dump
const COLUMNS = [
  'id', 'name', 'rarity', 'type', 'atk', 'hp', 'cost', 'supportType',
  'archetype', 'effects', 'description', 'imageId', 'cardSetId',
];

const line = readFileSync(dumpPath, 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('INSERT INTO `card` VALUES'));
if (!line) throw new Error('INSERT INTO `card` introuvable dans le dump');

/** Découpe les tuples SQL `(1,'a\'b',NULL),(...)` en tableaux de valeurs. */
function parseTuples(values) {
  const rows = [];
  let row = null;
  let i = 0;
  while (i < values.length) {
    const ch = values[i];
    if (row === null) {
      if (ch === '(') row = [];
      i++;
      continue;
    }
    if (ch === ')') {
      rows.push(row);
      row = null;
      i++;
      continue;
    }
    if (ch === ',') {
      i++;
      continue;
    }
    if (ch === "'") {
      let s = '';
      i++;
      while (values[i] !== "'") {
        if (values[i] === '\\') {
          const next = values[i + 1];
          s += next === 'n' ? '\n' : next;
          i += 2;
        } else {
          s += values[i];
          i++;
        }
      }
      row.push(s);
      i++;
      continue;
    }
    let j = i;
    while (values[j] !== ',' && values[j] !== ')') j++;
    const raw = values.slice(i, j);
    row.push(raw === 'NULL' ? null : Number(raw));
    i = j;
  }
  return rows;
}

const cards = parseTuples(line.slice(line.indexOf('VALUES') + 'VALUES'.length)).map((r) => {
  const c = Object.fromEntries(COLUMNS.map((key, idx) => [key, r[idx]]));
  return {
    id: c.id,
    name: c.name,
    rarity: c.rarity,
    type: c.type,
    atk: c.atk,
    hp: c.hp,
    cost: c.cost,
    supportType: c.supportType,
    archetype: c.archetype,
    effects: c.effects ? JSON.parse(c.effects) : null,
    description: c.description,
  };
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(cards, null, 2)}\n`);
console.log(`${cards.length} cartes écrites dans ${outPath}`);
```

Dans `apps/backend/package.json`, ajouter `"cards:snapshot": "node scripts/extract-cards-snapshot.mjs",`.

Run: `pnpm --filter @pipou/backend cards:snapshot`
Expected: `69 cartes écrites dans …/cards.snapshot.json` (le nombre exact dépend du dump). Ouvrir le fichier et vérifier deux points : la carte 22 s'appelle `"Noyau Alpha "` (avec l'espace final), et le fichier ne contient que les clés listées ci-dessus.

- [ ] **Step 2: Effets avant/après des cartes migrées**

`apps/backend/src/database/card-effect-patches.ts` :

```ts
import type { CardEffect } from '@pipou/shared';

/** Effets d'une carte avant/après la généralisation des cartes codées en dur. */
export interface CardEffectPatch {
  cardId: number;
  cardName: string;
  before: CardEffect[];
  after: CardEffect[];
}

const onBoard = (value: string) =>
  ({ type: 'SPECIFIC_CARD_ON_BOARD', value }) as const;
const equippedOn = (value: string) => ({ type: 'EQUIPPED_ON', value }) as const;

/** Partagé par la migration GenericCardEffects et les tests de vraies cartes. */
export const CARD_EFFECT_PATCHES: CardEffectPatch[] = [
  {
    cardId: 9,
    cardName: 'Commandant Quenouille',
    before: [
      {
        actions: [{ type: 'SET_DELAY_DOUBLE_ATK', value: 1, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
    after: [
      {
        actions: [
          { type: 'CANNOT_ATTACK_ON_SUMMON_TURN', target: 'SELF' },
          { type: 'SET_DELAY_DOUBLE_ATK', value: 1, target: 'SELF' },
        ],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
  },
  {
    cardId: 17,
    cardName: "Clairon de l'Union",
    before: [
      {
        actions: [{ type: 'GAIN_RECYCLE_ENERGY', value: 2, target: 'PLAYER' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'GAIN_RECYCLE_ENERGY', value: 2, target: 'PLAYER' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
      {
        actions: [{ type: 'DRAW', value: 1, target: 'PLAYER' }],
        trigger: 'ON_RECYCLE',
        condition: null,
      },
    ],
  },
  {
    cardId: 97,
    cardName: 'Canon à Particules .vxd',
    before: [
      {
        actions: [{ type: 'BUFF_ATK', value: 400, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: null,
      },
      {
        actions: [{ type: 'SET_PIERCING', value: 1, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'BUFF_ATK', value: 400, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: null,
      },
      {
        actions: [{ type: 'SET_PIERCING', value: 1, target: 'SELF' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
  },
  {
    cardId: 99,
    cardName: 'Rootkit de Transmission',
    before: [
      {
        actions: [{ type: 'FORCE_ATTACK_MODE_ENEMY', target: 'ALL_ENEMIES' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'FORCE_ATTACK_MODE_ENEMY', target: 'ENEMY_MONSTER' }],
        trigger: 'ON_PLAY',
        condition: null,
      },
    ],
  },
  {
    cardId: 122,
    cardName: 'Noyau Zeta',
    before: [
      {
        actions: [{ type: 'SET_TURN_COUNTER', value: 3, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
    ],
    after: [
      {
        actions: [{ type: 'SET_TURN_COUNTER', value: 3, target: 'SELF' }],
        trigger: 'ON_SUMMON',
        condition: null,
      },
      {
        actions: [{ type: 'SUMMONABLE_ON_ENEMY_SIDE', target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: null,
      },
    ],
  },
  {
    cardId: 127,
    cardName: "Module d'Extension .v2",
    before: [
      {
        actions: [{ type: 'SET_TAUNT', target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: onBoard('Noyau Alpha'),
      },
      {
        actions: [{ type: 'DEAL_DAMAGE', value: 400, target: 'ALL_ENEMIES' }],
        trigger: 'ON_TURN_START',
        condition: onBoard('Noyau Beta'),
      },
      {
        actions: [{ type: 'BUFF_ATK', value: 600, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: onBoard('Noyau Delta'),
      },
    ],
    after: [
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
  {
    cardId: 128,
    cardName: 'Firewall de Surcharge .sys',
    before: [
      {
        actions: [{ type: 'SET_DAMAGE_REDUCTION', value: 2, target: 'SELF' }],
        trigger: 'PASSIVE',
        condition: onBoard('Noyau Alpha'),
      },
      {
        actions: [{ type: 'HEAL', value: 300, target: 'SELF' }],
        trigger: 'ON_TURN_START',
        condition: onBoard('Noyau Beta'),
      },
      {
        actions: [{ type: 'SET_DELAY_DOUBLE_ATK', target: 'SELF' }],
        trigger: 'ON_PLAY',
        condition: onBoard('Noyau Delta'),
      },
    ],
    after: [
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
];

/** JSON stable (clés d'objets triées) pour comparer deux listes d'effets. */
export function canonicalEffects(value: unknown): string {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return JSON.stringify(parsed, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : v,
  );
}

export type PatchDecision = 'apply' | 'already-done' | 'skip-diverged';

/** Que faire d'une carte selon ses effets actuels (JSON brut ou déjà parsé). */
export function planPatch(
  current: unknown,
  from: CardEffect[],
  to: CardEffect[],
): PatchDecision {
  if (current === null || current === undefined) return 'skip-diverged';
  const actual = canonicalEffects(current);
  if (actual === canonicalEffects(to)) return 'already-done';
  if (actual === canonicalEffects(from)) return 'apply';
  return 'skip-diverged';
}
```

- [ ] **Step 3: Accès aux vraies cartes et liste des effets gérés**

`apps/backend/src/fights/testing/real-cards.ts` :

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Card } from '../../cards/card.entity';
import { CARD_EFFECT_PATCHES } from '../../database/card-effect-patches';
import { normalizeCardName } from '../effects/card-name';

const SNAPSHOT = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'cards.snapshot.json'), 'utf8'),
) as Card[];

/** Cartes telles qu'extraites du dump (avant la migration GenericCardEffects). */
export function rawSnapshotCards(): Card[] {
  return SNAPSHOT.map((c) => ({ ...c, image: null }) as Card);
}

/** Cartes avec les effets attendus après la migration GenericCardEffects. */
export function allRealCards(): Card[] {
  return rawSnapshotCards().map((c) => {
    const patch = CARD_EFFECT_PATCHES.find((p) => p.cardId === c.id);
    return patch ? ({ ...c, effects: patch.after } as Card) : c;
  });
}

/** Vraie carte par son nom (comparaison normalisée), effets post-migration. */
export function realCard(name: string): Card {
  const card = allRealCards().find(
    (c) => normalizeCardName(c.name) === normalizeCardName(name),
  );
  if (!card) throw new Error(`Carte « ${name} » absente de l'instantané`);
  return card;
}
```

`apps/backend/src/fights/engine/supported-effects.ts` :

```ts
import {
  ActionType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
} from '@pipou/shared';

// Ce que le moteur sait résoudre. Ajouter une valeur à un enum d'effet sans
// l'implémenter puis la déclarer ici fait échouer effects-coverage.spec.ts.

export const SUPPORTED_TRIGGERS: ReadonlySet<EffectTrigger> = new Set([
  EffectTrigger.ON_SUMMON,
  EffectTrigger.ON_DEATH,
  EffectTrigger.ON_ATTACK,
  EffectTrigger.ON_DEFEND,
  EffectTrigger.ON_PLAY,
  EffectTrigger.ON_TURN_START,
  EffectTrigger.ON_TURN_END,
  EffectTrigger.ON_ALLY_SUMMON,
  EffectTrigger.PASSIVE,
  EffectTrigger.ON_RECYCLE,
]);

export const SUPPORTED_CONDITIONS: ReadonlySet<EffectConditionType> = new Set([
  EffectConditionType.ARCHETYPE_ON_BOARD,
  EffectConditionType.HP_BELOW,
  EffectConditionType.HAND_SIZE_MIN,
  EffectConditionType.OPPONENT_HAS_NO_MONSTERS,
  EffectConditionType.SPECIFIC_CARD_ON_BOARD,
  EffectConditionType.EQUIPPED_ON,
]);

export const SUPPORTED_ACTIONS: ReadonlySet<ActionType> = new Set([
  ActionType.DEAL_DAMAGE,
  ActionType.HEAL,
  ActionType.DRAW,
  ActionType.BUFF_ATK,
  ActionType.BUFF_HP,
  ActionType.BUFF_ATK_TEMP,
  ActionType.DESTROY_MONSTER,
  ActionType.RETURN_TO_HAND,
  ActionType.DISCARD,
  ActionType.SET_TAUNT,
  ActionType.SET_PIERCING,
  ActionType.SET_ATTACKS_PER_TURN,
  ActionType.SET_DEBUFF_IMMUNITY,
  ActionType.SET_DELAY_DOUBLE_ATK,
  ActionType.FORCE_ATTACK_MODE,
  ActionType.RETURN_FROM_GRAVEYARD,
  ActionType.RETURN_FROM_GRAVEYARD_OR_DECK,
  ActionType.SEARCH_DECK,
  ActionType.GAIN_RECYCLE_ENERGY,
  ActionType.SET_FREE_SUMMON,
  ActionType.SET_DAMAGE_REDUCTION,
  ActionType.BUFF_HP_PER_ADJACENT_ALLY,
  ActionType.SET_TURN_COUNTER,
  ActionType.FORCE_ATTACK_MODE_ENEMY,
  ActionType.BLOCK_ATTACK,
  ActionType.FORCE_GUARD_LOCK_ENEMY,
  ActionType.CANNOT_ATTACK_ON_SUMMON_TURN,
  ActionType.SUMMONABLE_ON_ENEMY_SIDE,
]);

export const SUPPORTED_TARGETS: ReadonlySet<EffectTarget> = new Set(
  Object.values(EffectTarget),
);
```

- [ ] **Step 4: Tests**

`apps/backend/src/database/card-effect-patches.spec.ts` :

```ts
import { CARD_EFFECT_PATCHES, canonicalEffects, planPatch } from './card-effect-patches';
import { rawSnapshotCards } from '../fights/testing/real-cards';

describe('card-effect-patches', () => {
  const [quenouille] = CARD_EFFECT_PATCHES;

  it('chaque « before » correspond exactement aux effets du dump', () => {
    const snapshot = rawSnapshotCards();
    for (const patch of CARD_EFFECT_PATCHES) {
      const card = snapshot.find((c) => c.id === patch.cardId);
      expect({ id: patch.cardId, effects: canonicalEffects(card?.effects) }).toEqual({
        id: patch.cardId,
        effects: canonicalEffects(patch.before),
      });
    }
  });

  it("applique le patch quand les effets valent « before », quel que soit l'ordre des clés", () => {
    const reordered = JSON.stringify([
      { condition: null, trigger: 'ON_SUMMON', actions: [{ target: 'SELF', value: 1, type: 'SET_DELAY_DOUBLE_ATK' }] },
    ]);
    expect(planPatch(reordered, quenouille.before, quenouille.after)).toBe('apply');
  });

  it('ne refait rien si le patch est déjà appliqué', () => {
    expect(planPatch(quenouille.after, quenouille.before, quenouille.after)).toBe('already-done');
  });

  it('ne touche pas une carte modifiée entre-temps, ni une carte sans effets', () => {
    expect(planPatch([], quenouille.before, quenouille.after)).toBe('skip-diverged');
    expect(planPatch(null, quenouille.before, quenouille.after)).toBe('skip-diverged');
  });
});
```

`apps/backend/src/fights/engine/effects-coverage.spec.ts` :

```ts
import {
  ActionType,
  CardType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
  SupportType,
  canSummonOnEnemySide,
  ephemeralTargetSide,
} from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { allRealCards } from '../testing/real-cards';
import { monsterNamed, scenario } from '../testing/scenario';
import {
  SUPPORTED_ACTIONS,
  SUPPORTED_CONDITIONS,
  SUPPORTED_TARGETS,
  SUPPORTED_TRIGGERS,
} from './supported-effects';

const sorted = (values: Iterable<string>) => [...values].sort();

describe('couverture des effets', () => {
  it("le moteur déclare gérer chaque valeur des enums d'effets", () => {
    expect(sorted(SUPPORTED_TRIGGERS)).toEqual(sorted(Object.values(EffectTrigger)));
    expect(sorted(SUPPORTED_CONDITIONS)).toEqual(sorted(Object.values(EffectConditionType)));
    expect(sorted(SUPPORTED_ACTIONS)).toEqual(sorted(Object.values(ActionType)));
    expect(sorted(SUPPORTED_TARGETS)).toEqual(sorted(Object.values(EffectTarget)));
  });

  it("les vraies cartes n'utilisent que des effets gérés", () => {
    const problems: string[] = [];
    for (const card of allRealCards()) {
      for (const eff of card.effects ?? []) {
        if (!SUPPORTED_TRIGGERS.has(eff.trigger))
          problems.push(`${card.name} : déclencheur ${eff.trigger}`);
        if (eff.condition && !SUPPORTED_CONDITIONS.has(eff.condition.type))
          problems.push(`${card.name} : condition ${eff.condition.type}`);
        for (const a of eff.actions) {
          if (!SUPPORTED_ACTIONS.has(a.type)) problems.push(`${card.name} : action ${a.type}`);
          if (!SUPPORTED_TARGETS.has(a.target)) problems.push(`${card.name} : cible ${a.target}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  describe('chaque vraie carte se joue sans erreur', () => {
    const engine = createEngine();

    function play(card: Card) {
      const game = scenario({
        p1: {
          hand: [card],
          recycleEnergy: 3,
          monsters: [monsterCard('Allié', { hp: 5000 })],
        },
        p2: { monsters: [monsterCard('Ennemi', { hp: 5000 })] },
      });
      const ally = monsterNamed(game, 'p1', 'Allié');
      const enemy = monsterNamed(game, 'p2', 'Ennemi');

      if (card.type === CardType.MONSTER)
        return engine.dispatch(game, 'p1', {
          type: 'summon',
          handIndex: 0,
          zoneIndex: 1,
          paymentHandIndices: [],
          onOpponentSide: canSummonOnEnemySide(card.effects),
        });
      if (card.supportType === SupportType.EQUIPMENT)
        return engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          targetInstanceId: ally.instanceId,
        });
      if (card.supportType === SupportType.TERRAIN)
        return engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, zoneIndex: 0 });

      const side = ephemeralTargetSide(card.effects);
      return engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId:
          side === 'ally' ? ally.instanceId : side === 'enemy' ? enemy.instanceId : undefined,
      });
    }

    it.each(allRealCards().map((c) => [`#${c.id} ${c.name}`, c] as const))('%s', (_label, card) => {
      expect(play(card)).toEqual({});
    });
  });
});
```

`apps/backend/src/fights/engine/real-cards.spec.ts` :

```ts
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { realCard } from '../testing/real-cards';
import {
  attackWith,
  graveyardNames,
  handNames,
  monsterNamed,
  passTurn,
  scenario,
} from '../testing/scenario';

const engine = createEngine();

describe('vraies cartes — combos', () => {
  it('Noyau Alpha + Module .v2 + Firewall .sys : Provocation et dégâts divisés par 2', () => {
    const game = scenario({
      p1: {
        monsters: [realCard('Noyau Alpha')],
        hand: [realCard("Module d'Extension .v2"), realCard('Firewall de Surcharge .sys')],
      },
    });
    const alpha = monsterNamed(game, 'p1', 'Noyau Alpha ');

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, targetInstanceId: alpha.instanceId });
    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0, targetInstanceId: alpha.instanceId });

    expect(alpha.hasTaunt).toBe(true);
    expect(alpha.damageReduction).toBe(2);
  });

  it('Noyau Beta + Module .v2 : 300 + 400 dégâts à chaque début de tour', () => {
    const game = scenario({
      turn: 'p2',
      phase: 'end',
      p1: { monsters: [{ card: realCard('Noyau Beta'), equipments: [realCard("Module d'Extension .v2")] }] },
      p2: { monsters: [monsterCard('Cible', { hp: 1000 })] },
    });

    engine.dispatch(game, 'p2', { type: 'end_phase' });

    expect(monsterNamed(game, 'p2', 'Cible').currentHp).toBe(300);
  });

  it('Noyau Delta + Firewall .sys : deux attaques par tour dès l’équipement', () => {
    const game = scenario({
      p1: { monsters: [realCard('Noyau Delta')], hand: [realCard('Firewall de Surcharge .sys')] },
      p2: { monsters: [monsterCard('Mur', { atk: 0, hp: 99_999 })] },
    });
    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Noyau Delta').instanceId,
    });
    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(attackWith(engine, game, 'p1', 'Noyau Delta', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Noyau Delta', 'Mur')).toEqual({});
    expect(attackWith(engine, game, 'p1', 'Noyau Delta', 'Mur').error).toContain('toutes ses attaques');
  });

  it('Noyau Delta + Module .v2 : +600 ATK', () => {
    const game = scenario({
      p1: { monsters: [{ card: realCard('Noyau Delta'), equipments: [realCard("Module d'Extension .v2")] }] },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Noyau Delta').atkBuff).toBe(600);
  });

  it('Lieutenants Bidouille et Fripouille : +150/+150 seulement ensemble', () => {
    const game = scenario({
      p1: { monsters: [realCard('Lieutenant Bidouille'), realCard('Lieutenant Fripouille')] },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Lieutenant Bidouille').atkBuff).toBe(150);
    expect(monsterNamed(game, 'p1', 'Lieutenant Fripouille').atkBuff).toBe(150);
  });

  it("Commandant Quenouille ne peut pas attaquer le tour de son invocation", () => {
    const game = scenario({
      p1: { hand: [realCard('Commandant Quenouille')], recycleEnergy: 2 },
      p2: { monsters: [monsterCard('Mur', { atk: 0, hp: 99_999 })] },
    });
    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, paymentHandIndices: [] });
    engine.dispatch(game, 'p1', { type: 'end_phase' });

    expect(attackWith(engine, game, 'p1', 'Commandant Quenouille', 'Mur').error).toContain(
      'ne peut pas attaquer',
    );
  });

  it('Noyau Zeta : posé chez l’adversaire, il rapporte une Prime au poseur après 3 de ses tours', () => {
    const game = scenario({ p1: { hand: [realCard('Noyau Zeta')], recycleEnergy: 2 } });
    engine.dispatch(game, 'p1', {
      type: 'summon',
      handIndex: 0,
      zoneIndex: 0,
      paymentHandIndices: [],
      onOpponentSide: true,
    });

    for (let i = 0; i < 6; i++) passTurn(engine, game);

    expect(game.player1.primes).toBe(5);
    expect(graveyardNames(game, 'p2')).toContain('Noyau Zeta');
  });

  it("Clairon de l'Union : +2 énergie en jeu, une pioche s'il est recyclé", () => {
    const game = scenario({
      p1: { hand: [realCard("Clairon de l'Union"), realCard("Clairon de l'Union")], deck: [monsterCard('Renfort')] },
    });

    engine.dispatch(game, 'p1', { type: 'play_support', handIndex: 0 });
    engine.dispatch(game, 'p1', { type: 'recycle', handIndex: 0 });

    expect(game.player1.recycleEnergy).toBe(3);
    expect(handNames(game, 'p1')).toEqual(['Renfort']);
  });

  it('Chevalier Touille devient gratuit après l’invocation d’un pipou', () => {
    const game = scenario({
      p1: { hand: [realCard('Lieutenant Fripouille'), realCard('Chevalier Touille')], recycleEnergy: 1 },
    });

    engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 0, paymentHandIndices: [] });

    expect(
      engine.dispatch(game, 'p1', { type: 'summon', handIndex: 0, zoneIndex: 1, paymentHandIndices: [] }),
    ).toEqual({});
  });

  it("Soin d'urgence avec Médecin Citrouille : +600 puis +200", () => {
    const game = scenario({
      p1: {
        hand: [realCard("Soin d'urgence")],
        monsters: [
          { card: monsterCard('Blessé', { hp: 2000 }), currentHp: 100 },
          realCard('Médecin Citrouille'),
        ],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Blessé').instanceId,
    });

    expect(monsterNamed(game, 'p1', 'Blessé').currentHp).toBe(900);
  });

  it('Rootkit de Transmission ne force que le monstre choisi', () => {
    const game = scenario({
      p1: { hand: [realCard('Rootkit de Transmission')] },
      p2: {
        monsters: [
          { card: monsterCard('Lutin'), mode: 'guard' },
          { card: monsterCard('Golem'), mode: 'guard' },
        ],
      },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p2', 'Golem').instanceId,
    });

    expect(monsterNamed(game, 'p2', 'Golem')).toMatchObject({ mode: 'attack', forcedAttackMode: true });
    expect(monsterNamed(game, 'p2', 'Lutin').mode).toBe('guard');
  });

  it('Canon à Particules : +400 ATK et Perçant une fois équipé', () => {
    const game = scenario({
      p1: { monsters: [monsterCard('Porteur')], hand: [realCard('Canon à Particules .vxd')] },
    });

    engine.dispatch(game, 'p1', {
      type: 'play_support',
      handIndex: 0,
      targetInstanceId: monsterNamed(game, 'p1', 'Porteur').instanceId,
    });

    expect(monsterNamed(game, 'p1', 'Porteur')).toMatchObject({ atkBuff: 400, hasPiercing: true });
  });

  it("Champion Ouille-Ouille : +300 PV par allié adjacent", () => {
    const game = scenario({
      p1: { monsters: [monsterCard('Gauche'), realCard('Champion Ouille-Ouille'), monsterCard('Droite')] },
    });

    engine.settle(game);

    expect(monsterNamed(game, 'p1', 'Champion Ouille-Ouille').hpBuff).toBe(600);
  });

  it('Pixel Ghost .tmp : sa destruction propose de chercher un Noyau', () => {
    const game = scenario({
      phase: 'battle',
      p1: { monsters: [monsterCard('Ogre', { atk: 2000, hp: 2000 })] },
      p2: {
        monsters: [realCard('Pixel Ghost .tmp')],
        deck: [monsterCard('Bouche-trou'), realCard('Noyau Beta')],
      },
    });

    attackWith(engine, game, 'p1', 'Ogre', 'Pixel Ghost .tmp');

    expect(game.pendingChoices[0]).toMatchObject({ forUserId: game.player2.userId, resolution: 'pick_to_hand' });
    expect(game.pendingChoices[0].candidates.map((c) => c.baseCard.name)).toEqual(['Noyau Beta']);
  });
});
```

Notes sur les données : `Noyau Alpha ` garde son espace final dans l'instantané, c'est pourquoi `monsterNamed` le reçoit avec l'espace. `realCard` normalise. Dans le test de Zeta, Zeta est posée au tour 2 de p1, et son compteur décompte aux tours 4, 6 et 8 de p1.

Run: `pnpm --filter @pipou/backend exec jest card-effect-patches effects-coverage real-cards`
Expected: PASS.

Si un cas de « chaque vraie carte se joue sans erreur » ou un combo échoue, c'est un vrai bug du moteur ou une donnée de carte mal saisie : ne pas l'affaiblir. Le corriger dans le moteur avec un test synthétique, ou le noter dans le rapport de la Task 18.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/scripts/extract-cards-snapshot.mjs apps/backend/package.json apps/backend/src/fights apps/backend/src/database/card-effect-patches.ts apps/backend/src/database/card-effect-patches.spec.ts
git commit -m "test(fights): cover every real card and the main combos from a card snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Migration des effets en production et migrations au démarrage

**Files:**
- Create: `apps/backend/src/database/migrations/1791000000001-GenericCardEffects.ts`
- Modify: `apps/backend/Dockerfile` (`CMD`)

**Interfaces:**
- Consumes: `CARD_EFFECT_PATCHES`, `planPatch` (Task 14), scripts `migration:*:local` (Task 4).

- [ ] **Step 1: Écrire la migration**

`apps/backend/src/database/migrations/1791000000001-GenericCardEffects.ts` :

```ts
import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { CARD_EFFECT_PATCHES, planPatch } from '../card-effect-patches';

/**
 * Remplace les comportements codés en dur (#9, #17, #29, #122) et les
 * conditions « Sur X » des équipements (#127, #128) par des effets génériques.
 * Une carte modifiée depuis le dump du 23/09 n'est pas touchée : elle est
 * signalée dans les logs pour être corrigée via l'admin.
 */
export class GenericCardEffects1791000000001 implements MigrationInterface {
  name = 'GenericCardEffects1791000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await applyPatches(queryRunner, 'up');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await applyPatches(queryRunner, 'down');
  }
}

async function applyPatches(
  queryRunner: QueryRunner,
  direction: 'up' | 'down',
): Promise<void> {
  const logger = new Logger('GenericCardEffects');
  for (const patch of CARD_EFFECT_PATCHES) {
    const [from, to] =
      direction === 'up'
        ? [patch.before, patch.after]
        : [patch.after, patch.before];
    const rows = (await queryRunner.query(
      'SELECT `effects` FROM `card` WHERE `id` = ?',
      [patch.cardId],
    )) as { effects: unknown }[];

    const decision = planPatch(rows[0]?.effects, from, to);
    if (decision === 'apply') {
      await queryRunner.query('UPDATE `card` SET `effects` = ? WHERE `id` = ?', [
        JSON.stringify(to),
        patch.cardId,
      ]);
    } else if (decision === 'skip-diverged') {
      logger.warn(
        `Carte #${patch.cardId} (${patch.cardName}) : effets différents de l'attendu, non modifiée — à corriger via l'admin`,
      );
    }
  }
}
```

- [ ] **Step 2: Lancer les migrations au démarrage du conteneur**

Dans `apps/backend/Dockerfile`, remplacer la dernière ligne `CMD ["node", "dist/main"]` par :

```dockerfile
# Applique les migrations en attente avant de démarrer : si l'une échoue,
# le conteneur s'arrête au lieu de servir un schéma incohérent.
CMD ["sh", "-c", "node ./node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run && node dist/main"]
```

- [ ] **Step 3: Tester les deux migrations sur une copie locale du dump**

**Ne jamais utiliser `apps/backend/.env` (Aiven).** Toutes les commandes ci-dessous visent la base MySQL du `docker-compose.yml` racine, via `.env.e2e` (`DB_HOST=127.0.0.1`), avec une base jetable `pipou_migr`.

```bash
docker compose up -d db
docker compose exec -T db mysql -uroot -ppassword -e "DROP DATABASE IF EXISTS pipou_migr; CREATE DATABASE pipou_migr;"
docker compose exec -T db mysql -uroot -ppassword pipou_migr < apps/backend/.e2e/aiven-dump.sql
cd apps/backend
DB_NAME=pipou_migr pnpm migration:run:local
```

Expected : les deux migrations `MatchDoubleKo1791000000000` et `GenericCardEffects1791000000001` s'exécutent, sans avertissement « non modifiée ». Une variable déjà définie dans l'environnement l'emporte sur `.env.e2e`, d'où `DB_NAME=…` en préfixe.

```bash
docker compose exec -T db mysql -uroot -ppassword pipou_migr -e "SELECT id, effects FROM card WHERE id IN (9,17,97,99,122,127,128); SHOW COLUMNS FROM \`match\` LIKE 'end_reason';"
```

Expected : les effets correspondent aux `after` de `card-effect-patches.ts`, et l'enum contient `double_ko`.

```bash
DB_NAME=pipou_migr pnpm migration:run:local   # idempotence : « No migrations are pending »
DB_NAME=pipou_migr pnpm migration:revert:local
DB_NAME=pipou_migr pnpm migration:revert:local
docker compose exec -T db mysql -uroot -ppassword pipou_migr -e "SELECT id, effects FROM card WHERE id IN (9,17,97,99,122,127,128); SHOW COLUMNS FROM \`match\` LIKE 'end_reason';"
```

Expected : les effets reviennent aux `before`, et l'enum n'a plus `double_ko`.

```bash
docker compose exec -T db mysql -uroot -ppassword -e "DROP DATABASE pipou_migr;"
```

- [ ] **Step 4: Vérifier l'image Docker**

Run (racine du repo) : `docker build -f apps/backend/Dockerfile -t pipou-backend-test .`
Expected : build OK.

Run : `docker run --rm --entrypoint sh pipou-backend-test -c "ls node_modules/typeorm/cli.js dist/database/data-source.js dist/database/migrations"`
Expected : les deux fichiers et les migrations compilées (`*.js`) sont listés.

Ne pas lancer le conteneur avec les secrets de production.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/database/migrations/1791000000001-GenericCardEffects.ts apps/backend/Dockerfile
git commit -m "feat(db): migrate hardcoded card behaviours to generic effects and run migrations on start

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Frontend — écran de mulligan

**Files:**
- Create: `apps/frontend/src/features/fight/MulliganPanel.tsx`, `MulliganPanel.css`
- Modify: `apps/frontend/src/features/fight/FightPage.tsx`
- Test: `apps/frontend/src/__tests__/components/MulliganPanel.test.tsx`

**Interfaces:**
- Consumes: `MyClientState.mulliganDone`, `OpponentClientState.mulliganDone`, l'événement `fight:mulligan` (Task 8).
- Produces: `MulliganPanel({ hand, decided, opponentDecided, opponentName, onDecide })`.

- [ ] **Step 1: Test (il échoue)**

`apps/frontend/src/__tests__/components/MulliganPanel.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CardInstance } from "@pipou/shared";
import MulliganPanel from "../../features/fight/MulliganPanel";

const card = (name: string): CardInstance => ({
  instanceId: name,
  ownerId: 1,
  baseCard: {
    id: 1,
    name,
    rarity: "common",
    type: "monster",
    atk: 100,
    hp: 500,
    cost: 1,
    supportType: null,
    archetype: null,
    effects: null,
    description: null,
    image: null,
  },
});

describe("MulliganPanel", () => {
  it("affiche la main et transmet la décision", async () => {
    const onDecide = vi.fn();
    render(
      <MulliganPanel
        hand={[card("Gobelin"), card("Ogre")]}
        decided={false}
        opponentDecided={false}
        opponentName="Bob"
        onDecide={onDecide}
      />,
    );

    expect(screen.getByText("Gobelin")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Mulligan/ }));
    await userEvent.click(screen.getByRole("button", { name: "Garder cette main" }));

    expect(onDecide.mock.calls).toEqual([[true], [false]]);
  });

  it("attend l'adversaire une fois la décision prise", () => {
    render(
      <MulliganPanel hand={[]} decided opponentDecided={false} opponentName="Bob" onDecide={vi.fn()} />,
    );

    expect(screen.getByText("En attente de Bob…")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/MulliganPanel.test.tsx`
Expected: FAIL (le module n'existe pas).

- [ ] **Step 2: Composant**

`apps/frontend/src/features/fight/MulliganPanel.tsx` :

```tsx
import type { CardInstance } from "@pipou/shared";
import Button from "../../components/Button";
import "./MulliganPanel.css";

interface Props {
  hand: CardInstance[];
  decided: boolean;
  opponentDecided: boolean;
  opponentName: string;
  onDecide: (redraw: boolean) => void;
}

/** Main de départ : la garder, ou la remélanger une seule fois. */
export default function MulliganPanel({
  hand,
  decided,
  opponentDecided,
  opponentName,
  onDecide,
}: Props) {
  return (
    <div className="mull-root">
      <h2 className="mull-title">Ta main de départ</h2>
      <div className="mull-hand">
        {hand.map((c) => (
          <div key={c.instanceId} className="mull-card">
            <div className="mull-card-name">{c.baseCard.name}</div>
            <div className="mull-card-sub">
              {c.baseCard.type === "monster"
                ? `${c.baseCard.atk}⚔ ${c.baseCard.hp}❤ · ${c.baseCard.cost}⚡`
                : c.baseCard.supportType}
            </div>
          </div>
        ))}
      </div>
      {decided ? (
        <p className="mull-wait">
          {opponentDecided ? "La partie commence…" : `En attente de ${opponentName}…`}
        </p>
      ) : (
        <div className="mull-actions">
          <Button onClick={() => onDecide(false)}>Garder cette main</Button>
          <Button variant="ghost-bordeaux" onClick={() => onDecide(true)}>
            Mulligan (1 fois)
          </Button>
        </div>
      )}
    </div>
  );
}
```

`apps/frontend/src/features/fight/MulliganPanel.css` :

```css
.mull-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
}

.mull-title {
  margin: 0;
  color: var(--color-bordeaux);
}

.mull-hand {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.mull-card {
  width: 120px;
  padding: 10px;
  border: 2px solid var(--color-bordeaux);
  border-radius: 10px;
  background: var(--color-cream);
  text-align: center;
}

.mull-card-name {
  font-weight: 700;
}

.mull-card-sub {
  font-size: 0.8rem;
  opacity: 0.8;
}

.mull-actions {
  display: flex;
  gap: 12px;
}

.mull-wait {
  margin: 0;
  font-style: italic;
}
```

- [ ] **Step 3: Brancher dans `FightPage`**

Dans `FightPage.tsx` :

```tsx
  const decideMulligan = (redraw: boolean) =>
    matchId && emit("fight:mulligan", { matchId, redraw });
```

Dans le rendu, remplacer `{status === "playing" && gameState && ( <> <FightBoard ... /> ... </> )}` par une alternative sur la phase :

```tsx
          {status === "playing" && gameState?.phase === "mulligan" && (
            <MulliganPanel
              hand={gameState.me.hand}
              decided={gameState.me.mulliganDone}
              opponentDecided={gameState.opponent.mulliganDone}
              opponentName={gameState.opponent.username}
              onDecide={decideMulligan}
            />
          )}

          {status === "playing" && gameState && gameState.phase !== "mulligan" && (
            <>
              {/* contenu existant : bandeau opponentChoosing, FightBoard, CardPickModal */}
            </>
          )}
```

Le contenu existant du fragment ne change pas. Importer `MulliganPanel`.

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src
git commit -m "feat(fight): add the mulligan screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Frontend — écran de règles et libellés alignés

**Files:**
- Modify: `apps/frontend/src/features/fight/FightRules.tsx` (tableau `STEPS`)
- Modify: `apps/frontend/src/features/fight/fight.effects.ts` (libellé Terrain)
- Modify: `apps/frontend/src/features/fight/FightBoard.tsx`, `FightActionBar.tsx` (`HAND_LIMIT` partagé)

- [ ] **Step 1: Libellés et limite de main**

Dans `fight.effects.ts`, le chip Terrain devient :

```ts
    entries.push({
      icon: "🗺️",
      label: "Terrain — affecte vos monstres",
      type: "neutral",
    });
```

Dans `FightBoard.tsx` (`handleCardClick`) et `FightActionBar.tsx` (`overhandLimit` et message de défausse), importer `HAND_LIMIT` depuis `@pipou/shared` et remplacer chaque `7` littéral de limite de main par `HAND_LIMIT`.

- [ ] **Step 2: Réécrire les règles**

Dans `FightRules.tsx`, importer `DECK_RULES`, `HAND_LIMIT`, `STARTING_HAND` et `STARTING_PRIMES` depuis `@pipou/shared`, et remplacer le tableau `STEPS` par :

```tsx
const STEPS: Step[] = [
  {
    icon: "🏆",
    label: "But du jeu",
    content: (
      <>
        <div className="fr-win-banner">
          <span className="fr-win-icon">🏆</span>
          <div>
            <div className="fr-win-sub">Condition de victoire</div>
            <div className="fr-win-val">
              Récupérer ses {STARTING_PRIMES} Cartes Primes en premier
            </div>
          </div>
        </div>
        <div className="fr-rule-list">
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              Le jeu se joue en <strong>1 contre 1</strong>.
            </div>
          </div>
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              Si les deux joueurs récupèrent leur dernière Prime en même temps :{" "}
              <strong>match nul</strong>.
            </div>
          </div>
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              Un joueur qui doit piocher avec un deck vide <strong>perd</strong>.
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    icon: "🃏",
    label: "Préparation",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Deck :</strong> {DECK_RULES.MIN_CARDS} à {DECK_RULES.MAX_CARDS}{" "}
            cartes, {DECK_RULES.MAX_COPIES} exemplaires max par carte.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Zone Prime :</strong> les {STARTING_PRIMES} premières cartes du
            deck mélangé, face cachée.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Main de départ :</strong> {STARTING_HAND} cartes.{" "}
            <strong>Mulligan :</strong> une fois, tu peux remélanger ta main dans le
            deck et repiocher {STARTING_HAND} cartes.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            Le premier joueur est <strong>tiré au sort</strong>.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "🗺️",
    label: "Plateau",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>3 Zones Monstre</strong> pour les invocations.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>3 Zones Support</strong> pour les Terrains.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>1 Zone Prime</strong> avec {STARTING_PRIMES} cartes face cachée.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "🎴",
    label: "Types de cartes",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Monstres :</strong> ATK / PV, archétype, coût de 0 à 3 Énergies,
            effets passifs ou déclenchés. Un monstre peut attaquer dès son
            invocation, sauf si sa carte dit le contraire.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Cartes Support :</strong>
            <div className="fr-sub">
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Éphémère</span>
                Utilisation unique puis défausse. Certaines demandent de choisir
                un monstre cible.
              </div>
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Terrain</span>
                Permanent, agit sur tes monstres uniquement.
              </div>
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Équipement</span>
                Attaché à un de tes monstres ; certains effets ne s'activent que
                sur un monstre précis.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "✨",
    label: "Status monstres",
    content: (
      <div className="fr-status-grid">
        {[
          ["🛡", "Provocation", "Les ennemis doivent attaquer ce monstre en priorité."],
          [
            "🗡",
            "Perçant",
            "Ignore la réduction de dégâts, et rapporte une Prime en détruisant un monstre en Garde.",
          ],
          ["✨", "Immunité débuffs", "Le monstre ne peut pas recevoir de malus d'ATK temporaire."],
          ["⚡", "Double attaque", "Deux attaques au prochain tour, puis une."],
          ["✖️", "Attaques ×N", "Peut attaquer plusieurs fois par tour."],
          ["😈", "Attaque forcée", "Le monstre est bloqué en mode Attaque."],
          ["🔒", "Garde verrouillée", "Bloqué en Garde jusqu'à ce qu'il soit attaqué."],
          ["🧊", "Gel", "Ne peut pas attaquer pendant N de ses tours."],
          ["🛡", "Réduction dégâts", "Les dégâts reçus sont divisés par un coefficient."],
          ["⚡", "ATK temporaire", "Bonus d'ATK actif jusqu'à la fin du tour."],
        ].map(([ic, name, desc], i) => (
          <div key={i} className="fr-status-card">
            <div className="fr-status-icon">{ic}</div>
            <div>
              <div className="fr-status-name">{name}</div>
              <div className="fr-status-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "⚡",
    label: "Énergie",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Générer :</strong> recycle des cartes de ta main pendant la Main
            Phase. <strong>1 carte = 1 Énergie.</strong>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            Sans assez d'énergie, tu paies le reste en défaussant des cartes au
            moment d'invoquer.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Réinitialisation :</strong> l'énergie retombe à 0 en fin de tour.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "⚔️",
    label: "Combat",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <span className="fr-tag fr-tag--atk">Mode ATK</span>
            <div className="fr-sub">
              <div className="fr-rule-text">
                Une attaque par tour (sauf effet). Riposte s'il est attaqué.
              </div>
              <div className="fr-rule-text">
                Si détruit → l'adversaire gagne <strong>1 Prime</strong>.
              </div>
            </div>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <span className="fr-tag fr-tag--guard">Mode Garde</span>
            <div className="fr-sub">
              <div className="fr-rule-text">Ne peut pas attaquer ni riposter.</div>
              <div className="fr-rule-text">
                Si détruit → <strong>aucune Prime</strong>, sauf contre un attaquant
                Perçant.
              </div>
            </div>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Attaque directe</strong> (pas au tour 1) si l'adversaire n'a
            aucun monstre : tu gagnes 1 Prime et l'adversaire pioche 1 carte.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "🔄",
    label: "Primes & Comeback",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Destruction :</strong> quand un de tes monstres est détruit en
            combat ou par un effet adverse, tu pioches 1 carte.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Récupération :</strong> une Prime gagnée rejoint ta main.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Double K.O :</strong> deux monstres ATK se détruisent → chaque
            joueur pioche 1 carte et récupère 1 Prime.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "⏱️",
    label: "Structure du tour",
    content: (
      <div className="fr-phase-list">
        {[
          [
            "Début de tour",
            "Effets de début de tour, puis pioche d'1 carte (tour 1 compris).",
          ],
          [
            "Main Phase",
            "Recycle pour l'Énergie, invoque, joue des Supports, change la position de tes monstres.",
          ],
          ["Battle Phase", "Attaque les monstres adverses, ou directement si le terrain adverse est vide."],
          [
            "Ending Phase",
            `Effets de fin de tour, Énergie → 0, ${HAND_LIMIT} cartes max en main (défausse l'excédent).`,
          ],
        ].map(([label, desc], i) => (
          <div key={i} className="fr-phase">
            <div className="fr-phase-num">{i + 1}</div>
            <div className="fr-phase-text">
              <strong>{label}</strong> — {desc}
            </div>
          </div>
        ))}
        <p className="fr-rule-text">
          ⏱ 90 s par phase : à l'expiration, la phase suivante commence
          automatiquement.
        </p>
      </div>
    ),
  },
];
```

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend exec eslint src/features/fight`
Expected: PASS, sans nouvelle erreur de lint.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/fight
git commit -m "docs(fight): align the in-game rules with the engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Rapport d'écarts des cartes

**Files:**
- Create: `docs/duel-cards-audit.md`

- [ ] **Step 1: Écrire le rapport**

Le rapport s'adresse à l'admin qui corrigera les données. Partir de cette base, puis la compléter en relisant `apps/backend/src/fights/testing/fixtures/cards.snapshot.json` carte par carte : la description dit-elle autre chose que les effets ?

`docs/duel-cards-audit.md` :

```markdown
# Audit des cartes du duel

Date : 2026-10-02 — source : dump de production du 23/09, extrait dans
`apps/backend/src/fights/testing/fixtures/cards.snapshot.json`.

Ce rapport liste les écarts entre la description d'une carte et ses effets,
ainsi que les données suspectes. **Le moteur ne les corrige pas** : c'est à
faire carte par carte dans l'admin. Les cartes #9, #17, #97, #99, #122, #127
et #128 sont déjà migrées automatiquement au déploiement (migration
`GenericCardEffects`).

## Écarts entre description et effets

| Carte | Description | Effets actuels | À décider |
|---|---|---|---|
| #13 Soin d'urgence | « 30 % des PV max, ou 60 % avec un pipouman médecin » | +600 PV, puis +200 avec Médecin Citrouille (valeurs fixes) | Garder les valeurs fixes et corriger le texte, ou ajouter un soin en pourcentage au moteur |
| #14 Ouille au rapport | « récupérer un ouille commun ou non commun ; invocation gratuite si Capitaine présent » | récupère **3** cartes pipou commune/peu commune du cimetière ; aucune invocation gratuite | Nombre de cartes (1 ou 3) et effet Capitaine |
| #94 Noyau Delta | « ignore la Garde » | Perçant (Prime en détruisant une Garde, ignore la réduction de dégâts) | Texte à aligner sur Perçant |

## Cartes sans effet

| Cartes | Constat |
|---|---|
| #115 Incubation Rapide, #116 Écaille de Dragon, #117 Souffle Primordial, #118 Potion de Lucidité, #119 Bouclier de Fortune, #120 Frappe Préventive | `effects` vide : jouables, mais sans effet |
| #18 Vice Capitaine Patouille | effet présent, **description vide** |

## Noms à nettoyer

| Carte | Constat |
|---|---|
| #22 « Noyau Alpha␣ » | espace final (sans conséquence depuis la normalisation des noms, mais à nettoyer) |
| #30 « Sorcier Ratatouille␣ » | espace final |

## Rappel des règles appliquées par le moteur

Voir `docs/superpowers/specs/2026-10-02-duel-engine-audit-design.md`, section « Règles de référence ».
```

Si un test de la Task 14 a révélé une donnée de carte incohérente qui n'a pas été corrigée dans le moteur, l'ajouter dans la section adaptée.

- [ ] **Step 2: Commit**

```bash
git add docs/duel-cards-audit.md
git commit -m "docs: list card description/effect mismatches for admin follow-up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Vérification finale

**Files:** aucun (sauf correctifs éventuels).

- [ ] **Step 1: Suites complètes**

Run: `pnpm build:shared && pnpm typecheck && pnpm test`
Expected: PASS. Aucune suite qui passe sur `main` ne doit échouer.

Run: `pnpm --filter @pipou/backend exec eslint src/fights src/decks src/database src/cards/dto` et `pnpm --filter @pipou/frontend exec eslint src/features/fight src/features/deck src/__tests__/components/MulliganPanel.test.tsx`
Expected: aucune erreur dans les fichiers touchés.

Run: `pnpm --filter @pipou/backend exec jest fights --coverage --collectCoverageFrom='fights/**/*.ts'`
Expected : relever la couverture de `fights/` (lignes et branches) pour la mentionner dans la PR.

- [ ] **Step 2: Recherche de résidus**

Run: `git grep -nE "STEAL_PRIME|summon_opponent|test_match|FREE_SUMMON_CARD_ID|NOYAU_ZETA_CARD_ID|QUENOUILLE_CARD_ID|ZETA_CARD_ID|baseCard\.id === |pendingChoice\b|freeSummonAvailable|loadDeckCards" -- apps packages`
Expected : aucun résultat. Seule exception tolérée : `pendingChoice` dans `ClientGameState` (shared), le front et le client builder, où il désigne le choix exposé au client.

- [ ] **Step 3: Partie manuelle en local**

Lancer `pnpm dev`, ouvrir deux navigateurs (dont un en navigation privée) avec deux comptes de la base locale, chacun ayant un deck de 30 cartes ou plus. Vérifier :

1. Un deck de moins de 30 cartes est refusé avec un message clair.
2. Le mulligan s'affiche : un joueur garde sa main, l'autre refait la sienne. Le joueur tiré au sort commence et pioche au tour 1.
3. Un Éphémère ciblé (Force Delta ou Soin d'urgence) ouvre le choix de cible, et un seul choix suffit.
4. Pendant un choix de l'adversaire, le bandeau « fait un choix… » s'affiche et les actions sont refusées.
5. Après 90 s sans action, la phase avance, et le compte à rebours repart.
6. Recharger la page d'un joueur en pleine partie : il retrouve la partie (toast « Partie en cours retrouvée »).
7. Fermer un onglet et attendre 60 s : l'autre joueur gagne par déconnexion.
8. L'abandon fonctionne. L'écran de règles affiche 30 cartes, une main de 7, le mulligan et la pioche au début du tour.

Noter toute anomalie et la corriger, test d'abord, avant de passer à l'intégration de la branche.

- [ ] **Step 4: Intégration**

Utiliser le skill `superpowers:finishing-a-development-branch`. La PR doit mentionner :
- les deux migrations, appliquées au démarrage du conteneur ;
- le nouveau `CMD` du Dockerfile ;
- le rapport `docs/duel-cards-audit.md` ;
- le fait que les decks de moins de 30 cartes ne sont plus jouables.

Le déploiement passe uniquement par la CI, après merge sur `main`.
