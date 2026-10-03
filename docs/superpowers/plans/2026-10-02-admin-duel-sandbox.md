# Sandbox de duel pour les admins — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un admin compose les deux decks, joue les deux joueurs sur un seul écran, ordonne ses pioches, met en place un état précis (placer des cartes, éditer des valeurs), annule ou refait, et sauvegarde des scénarios partagés.

**Architecture:** Un namespace Socket.io dédié `/sandbox`, réservé aux admins, pilote un `SandboxService`. Ce service tient en mémoire un sandbox par admin : une partie `GameState` normale, jouée par le même `GameEngine` que les matchs classés (par siège), plus des outils de mise en place qui ne déclenchent aucun effet. Il gère aussi une pile d'annulation par snapshots. Les scénarios sont sérialisés (cartes réduites à leur id) dans une table `sandbox_scenario`. Le front réutilise le plateau du duel grâce à un hook commun `useBoardControls`.

**Tech Stack:** NestJS 11, TypeORM 0.3 (MySQL), Socket.io, Jest 30, React 18, TanStack Query, Vitest + Testing Library, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-02-admin-duel-sandbox-design.md`. Ce plan s'appuie sur le moteur livré par `docs/superpowers/plans/2026-10-02-duel-engine-audit.md`.

## Global Constraints

- Tout type, enum ou événement échangé entre front et back vit dans `@pipou/shared`. Après toute modification : `pnpm build:shared`.
- **Ne jamais exécuter de script `migration:*` sans le suffixe `:local`, ni utiliser `apps/backend/.env`** : ce fichier pointe sur Aiven (la prod). Les migrations se testent sur la base locale du `docker-compose.yml` racine.
- Le sandbox n'écrit **rien** en BDD hors de la table `sandbox_scenario` : ni match, ni ELO, ni stats, ni quête.
- Les outils de mise en place ne déclenchent **aucun effet** et n'ont **aucun coût**. Les actions de jeu, elles, suivent les règles normales.
- Les cartes viennent toujours du deck du joueur, jamais du catalogue, sauf à la composition des decks.
- Règles de deck du sandbox : celles de `DECK_RULES` (30 à 40 cartes, 3 exemplaires max), sans condition de possession.
- Pile d'annulation : 50 étapes au maximum. Un sandbox est supprimé 10 minutes après la déconnexion de l'admin.
- Front : conventions de `apps/frontend/CLAUDE.md` (TanStack Query, clés dans `QUERY_KEYS`, pas de `any`, pas de composant déclaré dans un composant).
- Tests backend : `pnpm --filter @pipou/backend exec jest <motif>`. Tests front : `pnpm --filter @pipou/frontend exec vitest run <fichier>`.
- Formater **uniquement les fichiers modifiés** (`pnpm exec prettier --write <fichiers>`), jamais un dossier entier.
- Un commit par tâche, terminé par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Écarts assumés par rapport à la spec

- **Namespace `/sandbox` au lieu de `/fight`.** Le gateway du duel reste inchangé, et l'authentification commune est extraite dans un helper `readSocketUser`.
- **Pas de `sandboxId` dans les événements.** Un admin n'a qu'un sandbox à la fois, identifié par son `userId`.
- **Sauvegarde et chargement par socket** (`sandbox:save`, `sandbox:load`), puisque l'état vit côté serveur. La liste et la suppression des scénarios passent par HTTP.

## Carte des fichiers

| Fichier | Responsabilité |
|---|---|
| `packages/shared/src/socket/sandbox.ts` (créé) | Contrat du sandbox : payloads, commandes de mise en place, `SandboxState`, événements. |
| `apps/backend/src/fights/helpers/game-factory.ts` (créé) | `createGameState` et `createPlayerState`, partagés par le matchmaking et le sandbox. |
| `apps/backend/src/fights/socket-auth.ts` (créé) | `readSocketUser` : utilisateur et droit admin lus dans le cookie JWT d'un handshake. |
| `apps/backend/src/sandbox/sandbox-setup.ts` (créé) | `applySetup` : outils de mise en place (fonction pure). |
| `apps/backend/src/sandbox/scenario-serializer.ts` (créé) | Sérialisation d'une partie (cartes réduites à leur id) et reconstruction. |
| `apps/backend/src/sandbox/sandbox-state.ts` (créé) | `buildSandboxState` : vue complète envoyée à l'admin. |
| `apps/backend/src/sandbox/sandbox.service.ts` (créé) | Sandboxes en mémoire, actions, annulation, timer, sauvegarde et chargement. |
| `apps/backend/src/sandbox/scenarios.service.ts`, `scenarios.controller.ts`, `sandbox-scenario.entity.ts` (créés) | Persistance et CRUD HTTP des scénarios. |
| `apps/backend/src/sandbox/sandbox.gateway.ts`, `sandbox-socket.types.ts`, `sandbox.module.ts` (créés) | Namespace Socket.io `/sandbox` et module Nest. |
| `apps/backend/src/database/migrations/1791000000002-SandboxScenario.ts` (créé) | Table `sandbox_scenario`. |
| `apps/frontend/src/features/fight/useBoardControls.ts` (créé) | Sélections et actions du plateau, partagées par le duel et le sandbox. |
| `apps/frontend/src/features/sandbox/*` (créés) | Écran du sandbox : configuration, page, barre d'outils, panneau deck, outils de mise en place, liste des scénarios. |
| `apps/frontend/src/services/sandbox.service.ts` (créé) | API HTTP des scénarios et catalogue. |

---

### Task 1: Contrat partagé du sandbox

**Files:**
- Create: `packages/shared/src/socket/sandbox.ts`
- Modify: `packages/shared/src/socket/index.ts`
- Test: `packages/shared/src/socket/sandbox.test-d.ts`

**Interfaces:**
- Produces : `SANDBOX_NAMESPACE`, `SandboxDeckEntry`, `SandboxCreatePayload`, `SandboxActionPayload`, `SandboxDestination`, `SandboxMonsterPatch`, `SandboxSetupCommand`, `SandboxSavePayload`, `SandboxLoadPayload`, `SandboxState`, `SandboxClientEvents`, `SandboxServerEvents`, `SandboxScenarioSummary`.

- [ ] **Step 1: Écrire le contrat**

`packages/shared/src/socket/sandbox.ts` :

```ts
import type { GameAction } from "../game/action";
import type { CardInstance, CombatMode } from "../game/instance";
import type { Seat } from "../game/seat";
import type { ClientGameState, GamePhase } from "../game/state";

/** Namespace Socket.io du sandbox admin (SandboxGateway). */
export const SANDBOX_NAMESPACE = "/sandbox";

/** Ligne d'un deck de sandbox : n'importe quelle carte du catalogue. */
export interface SandboxDeckEntry {
  cardId: number;
  quantity: number;
}

export interface SandboxCreatePayload {
  decks: Record<Seat, SandboxDeckEntry[]>;
  /** Joueur qui commence. */
  firstSeat: Seat;
  /** Timer de 90 s par phase (désactivé par défaut). */
  timer: boolean;
}

export interface SandboxActionPayload {
  seat: Seat;
  action: GameAction;
}

/** Destination d'une carte déplacée par l'admin. */
export type SandboxDestination =
  | { zone: "hand" }
  /** index 0 = dessus du deck (prochaine pioche). */
  | { zone: "deck"; index: number }
  | { zone: "graveyard" }
  | { zone: "monster"; index: number; mode: CombatMode }
  | { zone: "support"; index: number }
  | { zone: "equipment"; hostInstanceId: string };

/** Valeurs éditables d'un monstre posé (les bonus deviennent permanents). */
export interface SandboxMonsterPatch {
  currentHp?: number;
  atkBonus?: number;
  hpBonus?: number;
  mode?: CombatMode;
  taunt?: boolean;
  piercing?: boolean;
  debuffImmune?: boolean;
  /** null : retire la réduction de dégâts. */
  damageReduction?: number | null;
  attacksPerTurn?: number;
  /** null : retire le gel. */
  blockAttackTurns?: number | null;
  summonedThisTurn?: boolean;
}

/** Outils de mise en place : aucun effet déclenché, aucun coût. */
export type SandboxSetupCommand =
  | { type: "move_card"; seat: Seat; instanceId: string; to: SandboxDestination }
  | {
      type: "edit_monster";
      seat: Seat;
      instanceId: string;
      patch: SandboxMonsterPatch;
    }
  | {
      type: "edit_player";
      seat: Seat;
      patch: { primes?: number; recycleEnergy?: number };
    }
  | {
      type: "edit_game";
      patch: { phase?: GamePhase; turnNumber?: number; activeSeat?: Seat };
    };

export interface SandboxSavePayload {
  name: string;
  description?: string;
}

export interface SandboxLoadPayload {
  scenarioId: number;
}

/** État complet envoyé à l'admin : vue de chaque siège et decks ordonnés. */
export interface SandboxState {
  views: Record<Seat, ClientGameState>;
  /** Decks dans l'ordre de pioche (index 0 = prochaine carte). */
  decks: Record<Seat, CardInstance[]>;
  canUndo: boolean;
  canRedo: boolean;
  timer: boolean;
}

export interface SandboxClientEvents {
  "sandbox:create": (payload: SandboxCreatePayload) => void;
  "sandbox:action": (payload: SandboxActionPayload) => void;
  "sandbox:setup": (command: SandboxSetupCommand) => void;
  "sandbox:undo": () => void;
  "sandbox:redo": () => void;
  "sandbox:save": (payload: SandboxSavePayload) => void;
  "sandbox:load": (payload: SandboxLoadPayload) => void;
  "sandbox:close": () => void;
}

export interface SandboxServerEvents {
  "sandbox:state": (state: SandboxState) => void;
  "sandbox:closed": () => void;
  "sandbox:saved": (payload: { scenarioId: number }) => void;
  "sandbox:error": (payload: { message: string }) => void;
}

/** Scénario sauvegardé, tel que listé par GET /sandbox/scenarios. */
export interface SandboxScenarioSummary {
  id: number;
  name: string;
  description: string | null;
  createdBy: string;
  updatedAt: string;
}
```

Dans `packages/shared/src/socket/index.ts`, ajouter `export * from "./sandbox";`.

- [ ] **Step 2: Test de typage**

`packages/shared/src/socket/sandbox.test-d.ts` :

```ts
import { describe, expectTypeOf, it } from "vitest";
import type {
  GameAction,
  SandboxClientEvents,
  SandboxSetupCommand,
  SandboxState,
  SandboxServerEvents,
} from "../index";

describe("sandbox socket events", () => {
  it("joue une action de jeu pour un siège", () => {
    expectTypeOf<
      Parameters<SandboxClientEvents["sandbox:action"]>[0]
    >().toEqualTypeOf<{ seat: "p1" | "p2"; action: GameAction }>();
  });

  it("renvoie l'état complet du sandbox", () => {
    expectTypeOf<
      Parameters<SandboxServerEvents["sandbox:state"]>[0]
    >().toEqualTypeOf<SandboxState>();
  });

  it("distingue les commandes de mise en place par leur type", () => {
    expectTypeOf<SandboxSetupCommand["type"]>().toEqualTypeOf<
      "move_card" | "edit_monster" | "edit_player" | "edit_game"
    >();
  });
});
```

Run: `pnpm build:shared && pnpm --filter @pipou/shared test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/socket
git commit -m "feat(shared): sandbox socket contract

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Socle backend — fabrique de partie et authentification socket partagées

**Files:**
- Create: `apps/backend/src/fights/helpers/game-factory.ts`
- Modify: `apps/backend/src/fights/services/matchmaking.service.ts`
- Create: `apps/backend/src/fights/socket-auth.ts`
- Modify: `apps/backend/src/fights/fights.gateway.ts` (`handleConnection`)
- Modify: `apps/backend/src/fights/fights.module.ts` (`exports`)
- Test: `apps/backend/src/fights/socket-auth.spec.ts`

**Interfaces:**
- Produces :
  - `SeatEntry { userId: number; username: string; socketId: string }` ;
  - `createPlayerState(entry: SeatEntry): PlayerGameState` ;
  - `createGameState(matchId: number, p1: SeatEntry, p2: SeatEntry): GameState` ;
  - `SocketUser { userId: number; username: string; isAdmin: boolean }` ;
  - `readSocketUser(cookieHeader: string | undefined, jwt: JwtService, secret: string): SocketUser | null` ;
  - `FightsModule` exporte `GameEngine`.

- [ ] **Step 1: Test de l'authentification socket (il échoue)**

`apps/backend/src/fights/socket-auth.spec.ts` :

```ts
import { JwtService } from '@nestjs/jwt';
import { readSocketUser } from './socket-auth';

const SECRET = 'secret-de-test-assez-long-pour-hs256';

describe('readSocketUser', () => {
  const jwt = new JwtService();
  const cookieFor = (payload: object) =>
    `autre=1; token=${jwt.sign(payload, { secret: SECRET })}`;

  it("lit l'utilisateur et son droit admin depuis le cookie token", () => {
    expect(
      readSocketUser(
        cookieFor({ sub: 4, username: 'Admin', is_admin: true }),
        jwt,
        SECRET,
      ),
    ).toEqual({ userId: 4, username: 'Admin', isAdmin: true });
  });

  it("un joueur sans is_admin n'est pas admin", () => {
    expect(
      readSocketUser(cookieFor({ sub: 2, username: 'Bob' }), jwt, SECRET)
        ?.isAdmin,
    ).toBe(false);
  });

  it('renvoie null sans cookie ou avec un jeton invalide', () => {
    expect(readSocketUser(undefined, jwt, SECRET)).toBeNull();
    expect(readSocketUser('token=pas-un-jwt', jwt, SECRET)).toBeNull();
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest fights/socket-auth`
Expected: FAIL (`Cannot find module './socket-auth'`).

- [ ] **Step 2: Implémenter les deux helpers**

`apps/backend/src/fights/socket-auth.ts` :

```ts
import type { JwtService } from '@nestjs/jwt';
import * as cookie from 'cookie';

export interface SocketUser {
  userId: number;
  username: string;
  isAdmin: boolean;
}

/** Utilisateur authentifié par le cookie JWT d'un handshake Socket.io, ou null. */
export function readSocketUser(
  cookieHeader: string | undefined,
  jwt: JwtService,
  secret: string,
): SocketUser | null {
  const token = cookie.parse(cookieHeader ?? '')['token'];
  if (!token) return null;
  try {
    const payload = jwt.verify<{
      sub: number;
      username: string;
      is_admin?: boolean;
    }>(token, { secret });
    return {
      userId: Number(payload.sub),
      username: payload.username,
      isAdmin: payload.is_admin === true,
    };
  } catch {
    return null;
  }
}
```

`apps/backend/src/fights/helpers/game-factory.ts` :

```ts
import type {
  GameState,
  PlayerGameState,
} from '../interfaces/game-state.interface';

/** Joueur assis à une table : identité et socket de notification. */
export interface SeatEntry {
  userId: number;
  username: string;
  socketId: string;
}

/** Joueur sans deck, en attente de sa soumission. */
export function createPlayerState(entry: SeatEntry): PlayerGameState {
  return {
    userId: entry.userId,
    username: entry.username,
    socketId: entry.socketId,
    primes: 0,
    primeDeck: [],
    hand: [],
    deck: [],
    graveyard: [],
    banished: [],
    monsterZones: [null, null, null],
    supportZones: [null, null, null],
    recycleEnergy: 0,
    hasDrawnThisTurn: false,
    handLimitEnforced: false,
    ready: false,
    mulliganDone: false,
    freeSummonInstanceIds: [],
  };
}

/** Partie créée, decks pas encore installés (phase waiting). */
export function createGameState(
  matchId: number,
  p1: SeatEntry,
  p2: SeatEntry,
): GameState {
  return {
    matchId,
    player1: createPlayerState(p1),
    player2: createPlayerState(p2),
    currentTurnUserId: p1.userId,
    phase: 'waiting',
    turnNumber: 0,
    log: [],
    pendingChoices: [],
  };
}
```

Dans `services/matchmaking.service.ts`, les corps de `createEmptyPlayerState` et `buildInitialGameState` deviennent respectivement `return createPlayerState(entry);` et `return createGameState(matchId, p1, p2);`. Importer ces fonctions depuis `../helpers/game-factory`, puis retirer l'import de `PlayerGameState` s'il ne sert plus.

Dans `fights.gateway.ts` (`handleConnection`), remplacer la lecture manuelle du cookie et `jwtService.verify` par :

```ts
  handleConnection(client: FightSocket): void {
    const user = readSocketUser(
      client.handshake.headers.cookie,
      this.jwtService,
      this.configService.getOrThrow<string>('JWT_SECRET'),
    );
    if (!user) {
      console.error('WS auth error: jeton absent ou invalide');
      client.emit('fight:error', { message: 'Authentification invalide' });
      client.disconnect();
      return;
    }
    client.data.userId = user.userId;
    client.data.username = user.username;

    const resumed = this.fightsService.reconnect(user.userId, client.id);
    if (resumed) {
      client.emit('fight:resumed', {
        matchId: resumed.matchId,
        opponentName: resumed.opponentName,
      });
      this.fightsService.emitState(resumed.matchId, this.server);
    }
  }
```

Puis retirer l'import de `cookie`.

Dans `fights.module.ts`, ajouter `exports: [GameEngine],` au décorateur `@Module`.

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest fights`
Expected: PASS (dont les 3 tests de `socket-auth`).

Run: `pnpm --filter @pipou/backend typecheck`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/fights
git commit -m "refactor(fights): share game creation and socket authentication helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Outils de mise en place (`applySetup`)

**Files:**
- Create: `apps/backend/src/sandbox/sandbox-setup.ts`
- Test: `apps/backend/src/sandbox/sandbox-setup.spec.ts`

**Interfaces:**
- Consumes : `SandboxSetupCommand` (Task 1), `createMonsterOnBoard`, `seatPlayer`, `scenario` et cartes de test (partie A).
- Produces : `applySetup(game: GameState, command: SandboxSetupCommand): { error?: string }`. L'appelant fait ensuite `engine.settle(game)`.

- [ ] **Step 1: Tests (ils échouent)**

`apps/backend/src/sandbox/sandbox-setup.spec.ts` :

```ts
import { ActionType, EffectTarget, EffectTrigger } from '@pipou/shared';
import { applySetup } from './sandbox-setup';
import { createEngine } from '../fights/testing/engine';
import {
  act,
  effect,
  equipmentCard,
  monsterCard,
  terrainCard,
} from '../fights/testing/cards';
import {
  graveyardNames,
  handNames,
  monsterNamed,
  scenario,
  P2_ID,
} from '../fights/testing/scenario';

const names = (cards: { baseCard: { name: string } }[]) =>
  cards.map((c) => c.baseCard.name);

describe('applySetup', () => {
  it('déplace une carte du deck vers la main', () => {
    const game = scenario({
      p1: { deck: [monsterCard('A'), monsterCard('B')] },
    });
    const b = game.player1.deck[1];

    expect(
      applySetup(game, {
        type: 'move_card',
        seat: 'p1',
        instanceId: b.instanceId,
        to: { zone: 'hand' },
      }),
    ).toEqual({});

    expect(handNames(game, 'p1')).toEqual(['B']);
    expect(names(game.player1.deck)).toEqual(['A']);
  });

  it('réordonne le deck : une carte remonte sur le dessus', () => {
    const game = scenario({
      p1: { deck: [monsterCard('A'), monsterCard('B'), monsterCard('C')] },
    });

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.deck[2].instanceId,
      to: { zone: 'deck', index: 0 },
    });

    expect(names(game.player1.deck)).toEqual(['C', 'A', 'B']);
  });

  it("pose un monstre sans déclencher son effet d'invocation", () => {
    const gardien = monsterCard('Gardien', {
      effects: [
        effect(EffectTrigger.ON_SUMMON, [
          act(ActionType.SET_TAUNT, EffectTarget.SELF),
        ]),
      ],
    });
    const game = scenario({ p1: { hand: [gardien] } });

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.hand[0].instanceId,
      to: { zone: 'monster', index: 1, mode: 'guard' },
    });

    const posed = monsterNamed(game, 'p1', 'Gardien');
    expect(game.player1.monsterZones[1]).toBe(posed);
    expect(posed).toMatchObject({
      mode: 'guard',
      hasTaunt: false,
      summonedThisTurn: false,
    });
  });

  it('équipe un monstre, pose un terrain et envoie au cimetière', () => {
    const game = scenario({
      p1: {
        monsters: [monsterCard('Porteur')],
        hand: [equipmentCard('Casque', []), terrainCard('Plaine', [])],
        deck: [monsterCard('Perdu')],
      },
    });
    const host = monsterNamed(game, 'p1', 'Porteur');

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.hand[0].instanceId,
      to: { zone: 'equipment', hostInstanceId: host.instanceId },
    });
    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.hand[0].instanceId,
      to: { zone: 'support', index: 2 },
    });
    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: game.player1.deck[0].instanceId,
      to: { zone: 'graveyard' },
    });

    expect(names(host.equipments)).toEqual(['Casque']);
    expect(game.player1.supportZones[2]?.baseCard.name).toBe('Plaine');
    expect(graveyardNames(game, 'p1')).toEqual(['Perdu']);
  });

  it('refuse une zone occupée ou une carte du mauvais type, sans rien déplacer', () => {
    const game = scenario({
      p1: { monsters: [monsterCard('Occupant')], hand: [monsterCard('Nouveau')] },
    });
    const card = game.player1.hand[0];

    expect(
      applySetup(game, {
        type: 'move_card',
        seat: 'p1',
        instanceId: card.instanceId,
        to: { zone: 'monster', index: 0, mode: 'attack' },
      }).error,
    ).toBe('Zone monstre occupée');
    expect(
      applySetup(game, {
        type: 'move_card',
        seat: 'p1',
        instanceId: card.instanceId,
        to: { zone: 'support', index: 0 },
      }).error,
    ).toBe('Seul un Terrain va en zone support');
    expect(handNames(game, 'p1')).toEqual(['Nouveau']);
  });

  it('retire un monstre du terrain vers la main, ses équipements au cimetière', () => {
    const game = scenario({
      p1: {
        monsters: [
          { card: monsterCard('Pion'), equipments: [equipmentCard('Casque', [])] },
        ],
      },
    });

    applySetup(game, {
      type: 'move_card',
      seat: 'p1',
      instanceId: monsterNamed(game, 'p1', 'Pion').instanceId,
      to: { zone: 'hand' },
    });

    expect(game.player1.monsterZones[0]).toBeNull();
    expect(handNames(game, 'p1')).toEqual(['Pion']);
    expect(graveyardNames(game, 'p1')).toEqual(['Casque']);
  });

  it('édite un monstre : bonus permanents et statuts, conservés au recalcul', () => {
    const game = scenario({ p1: { monsters: [monsterCard('Cobaye')] } });
    const cobaye = monsterNamed(game, 'p1', 'Cobaye');

    applySetup(game, {
      type: 'edit_monster',
      seat: 'p1',
      instanceId: cobaye.instanceId,
      patch: { atkBonus: 300, taunt: true, blockAttackTurns: 2, currentHp: 50 },
    });
    createEngine().settle(game);

    expect(cobaye).toMatchObject({
      atkBuff: 300,
      hasTaunt: true,
      blockAttackTurns: 2,
      currentHp: 50,
    });
  });

  it('édite le joueur et la partie', () => {
    const game = scenario();

    applySetup(game, {
      type: 'edit_player',
      seat: 'p2',
      patch: { primes: 2, recycleEnergy: 3 },
    });
    applySetup(game, {
      type: 'edit_game',
      patch: { phase: 'battle', turnNumber: 7, activeSeat: 'p2' },
    });

    expect(game.player2).toMatchObject({ primes: 2, recycleEnergy: 3 });
    expect(game).toMatchObject({
      phase: 'battle',
      turnNumber: 7,
      currentTurnUserId: P2_ID,
    });
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest sandbox/sandbox-setup`
Expected: FAIL (`Cannot find module './sandbox-setup'`).

- [ ] **Step 2: Implémenter**

`apps/backend/src/sandbox/sandbox-setup.ts` :

```ts
import { CardType, SupportType } from '@pipou/shared';
import type {
  SandboxDestination,
  SandboxMonsterPatch,
  SandboxSetupCommand,
} from '@pipou/shared';
import type {
  CardInstance,
  GameState,
  PlayerGameState,
} from '../fights/interfaces/game-state.interface';
import { seatPlayer } from '../fights/helpers/game-state.helper';
import { createMonsterOnBoard } from '../fights/helpers/monster.factory';

type Result = { error?: string };

interface Located {
  card: CardInstance;
  /** Retire la carte de sa position actuelle. */
  detach: () => void;
}

/**
 * Outils de mise en place du sandbox : déplacent et éditent sans déclencher
 * d'effet ni payer de coût. L'appelant stabilise ensuite l'état (settle).
 */
export function applySetup(
  game: GameState,
  command: SandboxSetupCommand,
): Result {
  switch (command.type) {
    case 'move_card':
      return moveCard(
        seatPlayer(game, command.seat),
        command.instanceId,
        command.to,
      );
    case 'edit_monster':
      return editMonster(
        seatPlayer(game, command.seat),
        command.instanceId,
        command.patch,
      );
    case 'edit_player': {
      const player = seatPlayer(game, command.seat);
      const { primes, recycleEnergy } = command.patch;
      if (primes !== undefined)
        player.primes = clamp(primes, 0, player.primeDeck.length);
      if (recycleEnergy !== undefined)
        player.recycleEnergy = Math.max(0, recycleEnergy);
      return {};
    }
    case 'edit_game': {
      const { phase, turnNumber, activeSeat } = command.patch;
      if (phase !== undefined) {
        if (phase !== 'main' && phase !== 'battle' && phase !== 'end')
          return { error: 'Phase modifiable : principale, combat ou fin' };
        game.phase = phase;
      }
      if (turnNumber !== undefined) game.turnNumber = Math.max(1, turnNumber);
      if (activeSeat !== undefined)
        game.currentTurnUserId = seatPlayer(game, activeSeat).userId;
      return {};
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Trouve une carte du joueur, où qu'elle soit (main, deck, cimetière, terrain). */
function locate(player: PlayerGameState, instanceId: string): Located | null {
  for (const pile of [player.hand, player.deck, player.graveyard]) {
    const card = pile.find((c) => c.instanceId === instanceId);
    if (card) return { card, detach: () => pile.splice(pile.indexOf(card), 1) };
  }

  for (let i = 0; i < player.monsterZones.length; i++) {
    const monster = player.monsterZones[i];
    if (!monster) continue;
    if (monster.instanceId === instanceId) {
      return {
        card: monster.card,
        detach: () => {
          player.graveyard.push(...monster.equipments);
          player.monsterZones[i] = null;
        },
      };
    }
    const equipment = monster.equipments.find(
      (e) => e.instanceId === instanceId,
    );
    if (equipment) {
      return {
        card: equipment,
        detach: () =>
          monster.equipments.splice(monster.equipments.indexOf(equipment), 1),
      };
    }
  }

  const supportIdx = player.supportZones.findIndex(
    (c) => c?.instanceId === instanceId,
  );
  if (supportIdx !== -1) {
    return {
      card: player.supportZones[supportIdx]!,
      detach: () => {
        player.supportZones[supportIdx] = null;
      },
    };
  }
  return null;
}

/** Erreur si la carte ne peut pas aller à cette destination, sinon null. */
function destinationError(
  player: PlayerGameState,
  card: CardInstance,
  to: SandboxDestination,
): string | null {
  switch (to.zone) {
    case 'monster':
      if (card.baseCard.type !== CardType.MONSTER)
        return 'Seul un Monstre va en zone monstre';
      if (to.index < 0 || to.index > 2) return 'Zone invalide (0-2)';
      if (player.monsterZones[to.index]) return 'Zone monstre occupée';
      return null;
    case 'support':
      if (card.baseCard.supportType !== SupportType.TERRAIN)
        return 'Seul un Terrain va en zone support';
      if (to.index < 0 || to.index > 2) return 'Zone invalide (0-2)';
      if (player.supportZones[to.index]) return 'Zone support occupée';
      return null;
    case 'equipment':
      if (card.baseCard.supportType !== SupportType.EQUIPMENT)
        return "Seul un Équipement s'attache à un monstre";
      if (!player.monsterZones.some((m) => m?.instanceId === to.hostInstanceId))
        return 'Monstre porteur introuvable';
      return null;
    default:
      return null;
  }
}

function moveCard(
  player: PlayerGameState,
  instanceId: string,
  to: SandboxDestination,
): Result {
  const located = locate(player, instanceId);
  if (!located) return { error: 'Carte introuvable chez ce joueur' };
  const error = destinationError(player, located.card, to);
  if (error) return { error };

  located.detach();
  const card = located.card;
  switch (to.zone) {
    case 'hand':
      player.hand.push(card);
      break;
    case 'deck':
      player.deck.splice(clamp(to.index, 0, player.deck.length), 0, card);
      break;
    case 'graveyard':
      player.graveyard.push(card);
      break;
    case 'monster': {
      const monster = createMonsterOnBoard(card);
      monster.mode = to.mode;
      monster.summonedThisTurn = false;
      player.monsterZones[to.index] = monster;
      break;
    }
    case 'support':
      player.supportZones[to.index] = card;
      break;
    case 'equipment':
      player.monsterZones
        .find((m) => m?.instanceId === to.hostInstanceId)!
        .equipments.push(card);
      break;
  }
  return {};
}

function editMonster(
  player: PlayerGameState,
  instanceId: string,
  patch: SandboxMonsterPatch,
): Result {
  const m = player.monsterZones.find((z) => z?.instanceId === instanceId);
  if (!m) return { error: 'Monstre introuvable chez ce joueur' };

  if (patch.atkBonus !== undefined) m.perm.atk = patch.atkBonus;
  if (patch.hpBonus !== undefined) m.perm.hp = patch.hpBonus;
  if (patch.taunt !== undefined) m.perm.taunt = patch.taunt;
  if (patch.piercing !== undefined) m.perm.piercing = patch.piercing;
  if (patch.debuffImmune !== undefined) m.perm.debuffImmune = patch.debuffImmune;
  if (patch.damageReduction !== undefined)
    m.perm.damageReduction = patch.damageReduction ?? undefined;
  if (patch.attacksPerTurn !== undefined)
    m.perm.attacksPerTurn = Math.max(1, patch.attacksPerTurn);
  if (patch.mode !== undefined) m.mode = patch.mode;
  if (patch.blockAttackTurns !== undefined)
    m.blockAttackTurns = patch.blockAttackTurns ?? undefined;
  if (patch.summonedThisTurn !== undefined)
    m.summonedThisTurn = patch.summonedThisTurn;
  // Les PV courants s'appliquent en dernier ; le recalcul (settle) les borne au max
  if (patch.currentHp !== undefined) m.currentHp = patch.currentHp;
  return {};
}
```

Le recalcul de `settle` repart de `perm` : les bonus et statuts édités survivent donc aux recalculs, comme ceux d'un effet déclenché.

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest sandbox/sandbox-setup`
Expected: PASS (8 tests).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/sandbox/sandbox-setup.ts apps/backend/src/sandbox/sandbox-setup.spec.ts
git commit -m "feat(sandbox): setup tools that move cards and edit values without effects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sérialisation des scénarios

**Files:**
- Create: `apps/backend/src/sandbox/scenario-serializer.ts`
- Test: `apps/backend/src/sandbox/scenario-serializer.spec.ts`

**Interfaces:**
- Consumes : `SeatEntry` (Task 2).
- Produces :
  - `SerializedGame = Record<string, unknown>` ;
  - `serializeGame(game: GameState): SerializedGame` ;
  - `collectCardIds(state: SerializedGame): number[]` ;
  - `deserializeGame(state: SerializedGame, cards: Map<number, Card>, seats: { matchId: number; p1: SeatEntry; p2: SeatEntry }): GameState`.

- [ ] **Step 1: Tests (ils échouent)**

`apps/backend/src/sandbox/scenario-serializer.spec.ts` :

```ts
import type { Card } from '../cards/card.entity';
import {
  collectCardIds,
  deserializeGame,
  serializeGame,
} from './scenario-serializer';
import { equipmentCard, monsterCard } from '../fights/testing/cards';
import { monsterNamed, scenario, P2_ID } from '../fights/testing/scenario';

function savedGame() {
  const game = scenario({
    turn: 'p2',
    p1: {
      hand: [monsterCard('Main')],
      monsters: [
        {
          card: monsterCard('Posé'),
          equipments: [equipmentCard('Casque', [])],
          patch: { ownerUserId: P2_ID },
        },
      ],
    },
  });
  return game;
}

describe('scenario-serializer', () => {
  it('réduit chaque carte à son id', () => {
    const json = JSON.stringify(serializeGame(savedGame()));

    expect(json).not.toContain('"effects"');
    expect(json).toContain('"baseCard":');
  });

  it('liste les ids de cartes utilisés, sans doublon', () => {
    const game = savedGame();
    const ids = collectCardIds(serializeGame(game));

    expect(ids).toContain(game.player1.hand[0].baseCard.id);
    expect(ids).toContain(monsterNamed(game, 'p1', 'Posé').card.baseCard.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reconstruit la partie avec les cartes de la BDD et les sièges du nouvel admin', () => {
    const game = savedGame();
    const state = serializeGame(game);
    const cards = new Map<number, Card>();
    for (const p of [game.player1, game.player2])
      for (const c of [...p.hand, ...p.deck, ...p.primeDeck])
        cards.set(c.baseCard.id, c.baseCard);
    const posed = monsterNamed(game, 'p1', 'Posé');
    cards.set(posed.card.baseCard.id, posed.card.baseCard);
    cards.set(posed.equipments[0].baseCard.id, posed.equipments[0].baseCard);

    const restored = deserializeGame(state, cards, {
      matchId: -7,
      p1: { userId: 40, username: 'Admin (J1)', socketId: 's' },
      p2: { userId: -40, username: 'Admin (J2)', socketId: 's' },
    });

    expect(restored.matchId).toBe(-7);
    expect(restored.player1).toMatchObject({ userId: 40, username: 'Admin (J1)' });
    expect(restored.player2.userId).toBe(-40);
    expect(restored.currentTurnUserId).toBe(-40);
    expect(restored.player1.hand[0].ownerId).toBe(40);
    expect(restored.player1.hand[0].baseCard).toBe(
      cards.get(game.player1.hand[0].baseCard.id),
    );
    expect(monsterNamed(restored, 'p1', 'Posé').ownerUserId).toBe(-40);
  });

  it("échoue clairement si une carte n'existe plus", () => {
    const state = serializeGame(savedGame());

    expect(() =>
      deserializeGame(state, new Map(), {
        matchId: -1,
        p1: { userId: 1, username: 'a', socketId: 's' },
        p2: { userId: -1, username: 'b', socketId: 's' },
      }),
    ).toThrow(/Carte #\d+ introuvable/);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest sandbox/scenario-serializer`
Expected: FAIL (`Cannot find module './scenario-serializer'`).

- [ ] **Step 2: Implémenter**

`apps/backend/src/sandbox/scenario-serializer.ts` :

```ts
import type { Card } from '../cards/card.entity';
import type { GameState } from '../fights/interfaces/game-state.interface';
import type { SeatEntry } from '../fights/helpers/game-factory';

/** Partie sauvegardée : JSON où chaque `baseCard` est remplacé par l'id de la carte. */
export type SerializedGame = Record<string, unknown>;

/** Champs portant un userId, à réattribuer au chargement. */
const USER_ID_KEYS = new Set([
  'userId',
  'ownerId',
  'ownerUserId',
  'currentTurnUserId',
  'forUserId',
  'winner',
]);

export function serializeGame(game: GameState): SerializedGame {
  return JSON.parse(
    JSON.stringify(game, (key, value: unknown) =>
      key === 'baseCard' ? (value as Card).id : value,
    ),
  ) as SerializedGame;
}

export function collectCardIds(state: SerializedGame): number[] {
  const ids = new Set<number>();
  JSON.stringify(state, (key, value: unknown) => {
    if (key === 'baseCard' && typeof value === 'number') ids.add(value);
    return value;
  });
  return [...ids];
}

/**
 * Reconstruit une partie : cartes rechargées depuis la BDD (effets à jour),
 * sièges réattribués au nouvel admin.
 */
export function deserializeGame(
  state: SerializedGame,
  cards: Map<number, Card>,
  seats: { matchId: number; p1: SeatEntry; p2: SeatEntry },
): GameState {
  const raw = state as unknown as GameState;
  const remap = new Map<number, number>([
    [raw.player1.userId, seats.p1.userId],
    [raw.player2.userId, seats.p2.userId],
  ]);

  const game = JSON.parse(JSON.stringify(state), (key, value: unknown) => {
    if (key === 'baseCard' && typeof value === 'number') {
      const card = cards.get(value);
      if (!card) throw new Error(`Carte #${value} introuvable`);
      return card;
    }
    if (USER_ID_KEYS.has(key) && typeof value === 'number')
      return remap.get(value) ?? value;
    return value;
  }) as GameState;

  game.matchId = seats.matchId;
  for (const [player, seat] of [
    [game.player1, seats.p1],
    [game.player2, seats.p2],
  ] as const) {
    player.username = seat.username;
    player.socketId = seat.socketId;
  }
  return game;
}
```

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest sandbox/scenario-serializer`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/sandbox/scenario-serializer.ts apps/backend/src/sandbox/scenario-serializer.spec.ts
git commit -m "feat(sandbox): serialize scenarios with card ids and reattach them on load

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `SandboxService` — sandboxes en mémoire, annulation, timer, scénarios

**Files:**
- Create: `apps/backend/src/sandbox/sandbox-scenario.entity.ts`
- Create: `apps/backend/src/sandbox/scenarios.service.ts`
- Create: `apps/backend/src/sandbox/sandbox-socket.types.ts`
- Create: `apps/backend/src/sandbox/sandbox-state.ts`
- Create: `apps/backend/src/sandbox/sandbox.service.ts`
- Test: `apps/backend/src/sandbox/sandbox.service.spec.ts`

**Interfaces:**
- Consumes :
  - `GameEngine` (`dispatch`, `setupDeck`, `settle`, `timeout`) et `TurnTimeoutService` (partie A) ;
  - `createGameState`, `SeatEntry` (Task 2) ;
  - `applySetup` (Task 3) ;
  - `serializeGame`, `collectCardIds`, `deserializeGame` (Task 4) ;
  - `checkDeckForMatch` (partie A) ;
  - `buildClientState`.
- Produces :
  - `SandboxScenario` (entité, table `sandbox_scenario`) ;
  - `ScenariosService.list(): Promise<SandboxScenarioSummary[]>`, `create(input: { name: string; description: string | null; state: SerializedGame; createdById: number }): Promise<number>`, `findState(id): Promise<SerializedGame | null>`, `remove(id): Promise<void>` ;
  - `SandboxServer`, `SandboxSocket`, `SandboxSocketData` ;
  - `buildSandboxState(sb): SandboxState` ;
  - `SandboxAdmin { userId; username; socketId }` ;
  - les méthodes de `SandboxService` :
    - `create(admin, payload, server): Promise<Result>` ;
    - `act(adminUserId, seat, action, server): Result` ;
    - `setup(adminUserId, command, server): Result` ;
    - `undo(adminUserId, server)` et `redo(adminUserId, server)`, qui renvoient un `Result` ;
    - `close(adminUserId): void` ;
    - `save(adminUserId, payload): Promise<{ error?: string; scenarioId?: number }>` ;
    - `load(admin, scenarioId, server): Promise<Result>` ;
    - `resume(adminUserId, socketId, server): boolean` ;
    - `disconnect(adminUserId, socketId): void` ;
    - `get(adminUserId): Sandbox | undefined` ;
  - les constantes `UNDO_LIMIT = 50` et `CLEANUP_DELAY_MS = 600000`.

- [ ] **Step 1: Entité, service des scénarios et types socket**

`apps/backend/src/sandbox/sandbox-scenario.entity.ts` :

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Scénario de sandbox sauvegardé, partagé entre tous les admins. */
@Entity('sandbox_scenario')
export class SandboxScenario {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  description!: string | null;

  /** Partie sérialisée (cartes réduites à leur id), voir scenario-serializer. */
  @Column({ type: 'json' })
  state!: Record<string, unknown>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'created_by_id',
    foreignKeyConstraintName: 'fk_sandbox_scenario_user',
  })
  createdBy!: User;

  @Index('idx_sandbox_scenario_created_by')
  @Column({ name: 'created_by_id' })
  createdById!: number;

  @CreateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 0,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
```

`apps/backend/src/sandbox/scenarios.service.ts` :

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SandboxScenarioSummary } from '@pipou/shared';
import { SandboxScenario } from './sandbox-scenario.entity';
import type { SerializedGame } from './scenario-serializer';

@Injectable()
export class ScenariosService {
  constructor(
    @InjectRepository(SandboxScenario)
    private repo: Repository<SandboxScenario>,
  ) {}

  async list(): Promise<SandboxScenarioSummary[]> {
    const rows = await this.repo.find({
      relations: { createdBy: true },
      order: { updatedAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdBy: r.createdBy.username,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async create(input: {
    name: string;
    description: string | null;
    state: SerializedGame;
    createdById: number;
  }): Promise<number> {
    const row = await this.repo.save(this.repo.create(input));
    return row.id;
  }

  async findState(id: number): Promise<SerializedGame | null> {
    const row = await this.repo.findOneBy({ id });
    return row?.state ?? null;
  }

  async remove(id: number): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('Scénario introuvable');
  }
}
```

`apps/backend/src/sandbox/sandbox-socket.types.ts` :

```ts
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import type { SandboxClientEvents, SandboxServerEvents } from '@pipou/shared';

/** Renseigné par SandboxGateway.handleConnection (admins uniquement). */
export interface SandboxSocketData {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export type SandboxServer = Server<
  SandboxClientEvents,
  SandboxServerEvents,
  DefaultEventsMap,
  SandboxSocketData
>;

export type SandboxSocket = Socket<
  SandboxClientEvents,
  SandboxServerEvents,
  DefaultEventsMap,
  SandboxSocketData
>;
```

`apps/backend/src/sandbox/sandbox-state.ts` :

```ts
import type { SandboxState } from '@pipou/shared';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { buildClientState } from '../fights/helpers/client-state.builder';

/** Vue complète du sandbox : chaque siège, decks ordonnés, annulation. */
export function buildSandboxState(sb: {
  game: GameState;
  undo: unknown[];
  redo: unknown[];
  timer: boolean;
}): SandboxState {
  const { game } = sb;
  return {
    views: {
      p1: buildClientState(game, game.player1.userId),
      p2: buildClientState(game, game.player2.userId),
    },
    decks: { p1: game.player1.deck, p2: game.player2.deck },
    canUndo: sb.undo.length > 0,
    canRedo: sb.redo.length > 0,
    timer: sb.timer,
  };
}
```

- [ ] **Step 2: Tests du service (ils échouent)**

`apps/backend/src/sandbox/sandbox.service.spec.ts` :

```ts
import type { Repository } from 'typeorm';
import type { Card } from '../cards/card.entity';
import type { SandboxDeckEntry, SandboxState } from '@pipou/shared';
import { TurnTimeoutService } from '../fights/services/turn-timeout.service';
import { createEngine } from '../fights/testing/engine';
import { monsterCard } from '../fights/testing/cards';
import {
  CLEANUP_DELAY_MS,
  SandboxService,
  UNDO_LIMIT,
  type SandboxAdmin,
} from './sandbox.service';
import type { ScenariosService } from './scenarios.service';
import type { SandboxServer } from './sandbox-socket.types';
import type { SerializedGame } from './scenario-serializer';

const ADMIN: SandboxAdmin = { userId: 4, username: 'Admin', socketId: 'sock-a' };
const OTHER_ADMIN: SandboxAdmin = { userId: 9, username: 'Autre', socketId: 'sock-b' };

const catalog: Card[] = Array.from({ length: 30 }, (_, i) =>
  monsterCard(`Carte ${i}`),
);
const deck = (n = 30): SandboxDeckEntry[] =>
  catalog.slice(0, n).map((c) => ({ cardId: c.id, quantity: 1 }));

function setup() {
  const states: SandboxState[] = [];
  const server = {
    to: () => ({
      emit: (event: string, payload: SandboxState) => {
        if (event === 'sandbox:state') states.push(payload);
        return true;
      },
    }),
  } as unknown as SandboxServer;
  const store = new Map<number, SerializedGame>();
  const scenarios = {
    create: jest.fn((input: { state: SerializedGame }) => {
      const id = store.size + 1;
      store.set(id, input.state);
      return Promise.resolve(id);
    }),
    findState: jest.fn((id: number) => Promise.resolve(store.get(id) ?? null)),
  };
  const cards = { findBy: jest.fn(() => Promise.resolve(catalog)) };
  const service = new SandboxService(
    createEngine(),
    scenarios as unknown as ScenariosService,
    cards as unknown as Repository<Card>,
    new TurnTimeoutService(),
  );
  const last = () => states[states.length - 1];
  return { service, server, states, last, scenarios, cards };
}

async function inGame(firstSeat: 'p1' | 'p2' = 'p1', timer = false) {
  const ctx = setup();
  await ctx.service.create(
    ADMIN,
    { decks: { p1: deck(), p2: deck() }, firstSeat, timer },
    ctx.server,
  );
  ctx.service.act(ADMIN.userId, 'p1', { type: 'mulligan', redraw: false }, ctx.server);
  ctx.service.act(ADMIN.userId, 'p2', { type: 'mulligan', redraw: false }, ctx.server);
  return ctx;
}

describe('SandboxService', () => {
  afterEach(() => jest.useRealTimers());

  it('crée une partie au mulligan avec le premier joueur choisi', async () => {
    const { service, server, last } = setup();

    await expect(
      service.create(
        ADMIN,
        { decks: { p1: deck(), p2: deck() }, firstSeat: 'p2', timer: false },
        server,
      ),
    ).resolves.toEqual({});

    expect(last().views.p1.phase).toBe('mulligan');
    expect(last().views.p2.isMyTurn).toBe(true);
    expect(last().decks.p1).toHaveLength(19);
    expect(last().views.p1.me.hand).toHaveLength(5);
  });

  it('refuse un deck hors règles, sans rien créer', async () => {
    const { service, server, states } = setup();

    const result = await service.create(
      ADMIN,
      { decks: { p1: deck(29), p2: deck() }, firstSeat: 'p1', timer: false },
      server,
    );

    expect(result.error).toContain('Deck J1');
    expect(result.error).toContain('entre 30 et 40');
    expect(states).toHaveLength(0);
  });

  it('joue les deux sièges avec les règles normales', async () => {
    const { service, server, last } = await inGame('p2');

    expect(last().views.p2.phase).toBe('main');
    expect(
      service.act(ADMIN.userId, 'p1', { type: 'end_phase' }, server).error,
    ).toBe("Ce n'est pas ton tour");
    expect(service.act(ADMIN.userId, 'p2', { type: 'end_phase' }, server)).toEqual({});
    expect(last().views.p2.phase).toBe('battle');
  });

  it('annule et refait une action, sans rien écrire en base', async () => {
    const { service, server, last, scenarios } = await inGame();
    service.act(ADMIN.userId, 'p1', { type: 'end_phase' }, server);
    expect(last().views.p1.phase).toBe('battle');

    expect(service.undo(ADMIN.userId, server)).toEqual({});
    expect(last().views.p1.phase).toBe('main');
    expect(last().canRedo).toBe(true);

    service.redo(ADMIN.userId, server);
    expect(last().views.p1.phase).toBe('battle');
    expect(scenarios.create).not.toHaveBeenCalled();
  });

  it('une action refusée ne laisse aucune trace dans la pile', async () => {
    const { service, server } = await inGame();
    const before = service.get(ADMIN.userId)!.undo.length;

    service.setup(
      ADMIN.userId,
      { type: 'move_card', seat: 'p1', instanceId: 'inconnue', to: { zone: 'hand' } },
      server,
    );

    expect(service.get(ADMIN.userId)!.undo).toHaveLength(before);
  });

  it(`garde au plus ${UNDO_LIMIT} étapes d'annulation`, async () => {
    const { service, server } = await inGame();

    for (let i = 0; i < UNDO_LIMIT + 5; i++)
      service.setup(
        ADMIN.userId,
        { type: 'edit_player', seat: 'p1', patch: { recycleEnergy: i } },
        server,
      );

    expect(service.get(ADMIN.userId)!.undo).toHaveLength(UNDO_LIMIT);
  });

  it('sauvegarde un scénario puis le recharge chez un autre admin', async () => {
    const { service, server, last } = await inGame();
    const hand = last().views.p1.me.hand.map((c) => c.baseCard.name);

    const saved = await service.save(ADMIN.userId, { name: 'Combo test' });
    expect(saved.scenarioId).toBe(1);

    await expect(
      service.load(OTHER_ADMIN, 1, server),
    ).resolves.toEqual({});
    const loaded = service.get(OTHER_ADMIN.userId)!.game;
    expect(loaded.player1.userId).toBe(OTHER_ADMIN.userId);
    expect(loaded.player2.userId).toBe(-OTHER_ADMIN.userId);
    expect(last().views.p1.me.hand.map((c) => c.baseCard.name)).toEqual(hand);
  });

  it('refuse une sauvegarde sans nom', async () => {
    const { service } = await inGame();

    expect((await service.save(ADMIN.userId, { name: '  ' })).error).toBe(
      'Donne un nom au scénario',
    );
  });

  it('supprime le sandbox 10 minutes après la déconnexion, sauf retour', async () => {
    jest.useFakeTimers();
    const { service, server } = await inGame();

    service.disconnect(ADMIN.userId, 'sock-a');
    await jest.advanceTimersByTimeAsync(CLEANUP_DELAY_MS / 2);
    expect(service.resume(ADMIN.userId, 'sock-neuf', server)).toBe(true);
    await jest.advanceTimersByTimeAsync(CLEANUP_DELAY_MS);
    expect(service.get(ADMIN.userId)).toBeDefined();

    service.disconnect(ADMIN.userId, 'sock-neuf');
    await jest.advanceTimersByTimeAsync(CLEANUP_DELAY_MS);
    expect(service.get(ADMIN.userId)).toBeUndefined();
  });

  it('le timer, activé, fait avancer la phase après 90 s', async () => {
    jest.useFakeTimers();
    const { service, last } = await inGame('p1', true);

    await jest.advanceTimersByTimeAsync(90_000);

    expect(last().views.p1.phase).toBe('battle');
    expect(service.get(ADMIN.userId)!.undo.length).toBeGreaterThan(0);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest sandbox/sandbox.service`
Expected: FAIL (`Cannot find module './sandbox.service'`).

- [ ] **Step 3: Implémenter le service**

`apps/backend/src/sandbox/sandbox.service.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import type {
  GameAction,
  SandboxCreatePayload,
  SandboxDeckEntry,
  SandboxSavePayload,
  SandboxSetupCommand,
  Seat,
} from '@pipou/shared';
import { Card } from '../cards/card.entity';
import { checkDeckForMatch } from '../decks/deck-rules';
import { GameEngine } from '../fights/engine/game-engine';
import { TurnTimeoutService } from '../fights/services/turn-timeout.service';
import { createGameState, type SeatEntry } from '../fights/helpers/game-factory';
import { seatPlayer } from '../fights/helpers/game-state.helper';
import type {
  CardInstance,
  GameState,
} from '../fights/interfaces/game-state.interface';
import { applySetup } from './sandbox-setup';
import { buildSandboxState } from './sandbox-state';
import {
  collectCardIds,
  deserializeGame,
  serializeGame,
} from './scenario-serializer';
import { ScenariosService } from './scenarios.service';
import type { SandboxServer } from './sandbox-socket.types';

export const UNDO_LIMIT = 50;
export const CLEANUP_DELAY_MS = 10 * 60_000;

export interface SandboxAdmin {
  userId: number;
  username: string;
  socketId: string;
}

export interface Sandbox {
  admin: SandboxAdmin;
  game: GameState;
  undo: GameState[];
  redo: GameState[];
  timer: boolean;
  cleanup?: NodeJS.Timeout;
}

type Result = { error?: string };

const SEATS: Seat[] = ['p1', 'p2'];

/**
 * Sandboxes de test des admins : une partie jouée par le moteur normal,
 * tenue en mémoire (un sandbox par admin), sans aucune écriture de match.
 */
@Injectable()
export class SandboxService {
  private sandboxes = new Map<number, Sandbox>();
  private lastMatchId = 0;

  constructor(
    private engine: GameEngine,
    private scenarios: ScenariosService,
    @InjectRepository(Card) private cards: Repository<Card>,
    private turnTimeout: TurnTimeoutService,
  ) {}

  get(adminUserId: number): Sandbox | undefined {
    return this.sandboxes.get(adminUserId);
  }

  async create(
    admin: SandboxAdmin,
    payload: SandboxCreatePayload,
    server: SandboxServer,
  ): Promise<Result> {
    const ids = [
      ...new Set(SEATS.flatMap((s) => payload.decks[s].map((e) => e.cardId))),
    ];
    const cards = await this.loadCards(ids);
    const missing = ids.find((id) => !cards.has(id));
    if (missing !== undefined) return { error: `Carte #${missing} introuvable` };

    for (const seat of SEATS) {
      const problem = checkDeckForMatch(
        payload.decks[seat].map((e) => ({
          cardId: e.cardId,
          cardName: cards.get(e.cardId)!.name,
          quantity: e.quantity,
          owned: e.quantity,
        })),
      );
      if (problem)
        return { error: `Deck ${seat === 'p1' ? 'J1' : 'J2'} : ${problem}` };
    }

    const seats = this.seats(admin);
    const game = createGameState(this.nextMatchId(), seats.p1, seats.p2);
    for (const seat of SEATS) {
      const owner = seatPlayer(game, seat).userId;
      this.engine.setupDeck(
        game,
        seat,
        this.instances(payload.decks[seat], cards, owner),
      );
    }
    game.currentTurnUserId = seatPlayer(game, payload.firstSeat).userId;

    this.open(admin, game, payload.timer, server);
    return {};
  }

  act(
    adminUserId: number,
    seat: Seat,
    action: GameAction,
    server: SandboxServer,
  ): Result {
    return this.mutate(adminUserId, server, (game) =>
      this.engine.dispatch(game, seat, action),
    );
  }

  setup(
    adminUserId: number,
    command: SandboxSetupCommand,
    server: SandboxServer,
  ): Result {
    return this.mutate(adminUserId, server, (game) => {
      const result = applySetup(game, command);
      if (!result.error) this.engine.settle(game);
      return result;
    });
  }

  undo(adminUserId: number, server: SandboxServer): Result {
    const sb = this.sandboxes.get(adminUserId);
    const previous = sb?.undo.pop();
    if (!sb || !previous) return { error: 'Rien à annuler' };
    sb.redo.push(sb.game);
    sb.game = previous;
    this.publish(sb, server);
    return {};
  }

  redo(adminUserId: number, server: SandboxServer): Result {
    const sb = this.sandboxes.get(adminUserId);
    const next = sb?.redo.pop();
    if (!sb || !next) return { error: 'Rien à refaire' };
    sb.undo.push(sb.game);
    sb.game = next;
    this.publish(sb, server);
    return {};
  }

  close(adminUserId: number): void {
    const sb = this.sandboxes.get(adminUserId);
    if (!sb) return;
    clearTimeout(sb.cleanup);
    this.turnTimeout.clear(sb.game.matchId);
    this.sandboxes.delete(adminUserId);
  }

  async save(
    adminUserId: number,
    payload: SandboxSavePayload,
  ): Promise<{ error?: string; scenarioId?: number }> {
    const sb = this.sandboxes.get(adminUserId);
    if (!sb) return { error: 'Aucun sandbox ouvert' };
    const name = payload.name.trim();
    if (!name) return { error: 'Donne un nom au scénario' };
    if (name.length > 80) return { error: 'Nom trop long (80 caractères max)' };

    const scenarioId = await this.scenarios.create({
      name,
      description: payload.description?.trim() || null,
      state: serializeGame(sb.game),
      createdById: adminUserId,
    });
    return { scenarioId };
  }

  async load(
    admin: SandboxAdmin,
    scenarioId: number,
    server: SandboxServer,
  ): Promise<Result> {
    const state = await this.scenarios.findState(scenarioId);
    if (!state) return { error: 'Scénario introuvable' };

    const cards = await this.loadCards(collectCardIds(state));
    let game: GameState;
    try {
      game = deserializeGame(state, cards, {
        matchId: this.nextMatchId(),
        ...this.seats(admin),
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Scénario illisible' };
    }
    this.open(admin, game, false, server);
    return {};
  }

  /** Reconnexion de l'admin : annule la suppression et renvoie l'état. */
  resume(adminUserId: number, socketId: string, server: SandboxServer): boolean {
    const sb = this.sandboxes.get(adminUserId);
    if (!sb) return false;
    clearTimeout(sb.cleanup);
    sb.cleanup = undefined;
    sb.admin.socketId = socketId;
    sb.game.player1.socketId = socketId;
    sb.game.player2.socketId = socketId;
    this.publish(sb, server);
    return true;
  }

  /** Déconnexion de l'admin : le sandbox est supprimé s'il ne revient pas. */
  disconnect(adminUserId: number, socketId: string): void {
    const sb = this.sandboxes.get(adminUserId);
    if (!sb || sb.admin.socketId !== socketId) return;
    clearTimeout(sb.cleanup);
    sb.cleanup = setTimeout(() => this.close(adminUserId), CLEANUP_DELAY_MS);
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  /** Applique un changement ; snapshot pour l'annulation, rien si erreur. */
  private mutate(
    adminUserId: number,
    server: SandboxServer,
    change: (game: GameState) => Result,
  ): Result {
    const sb = this.sandboxes.get(adminUserId);
    if (!sb) return { error: 'Aucun sandbox ouvert' };

    const before = structuredClone(sb.game);
    const result = change(sb.game);
    if (result.error) {
      sb.game = before;
      return result;
    }
    this.pushUndo(sb, before);
    this.publish(sb, server);
    return {};
  }

  private pushUndo(sb: Sandbox, snapshot: GameState): void {
    sb.undo.push(snapshot);
    if (sb.undo.length > UNDO_LIMIT) sb.undo.shift();
    sb.redo = [];
  }

  private open(
    admin: SandboxAdmin,
    game: GameState,
    timer: boolean,
    server: SandboxServer,
  ): void {
    this.close(admin.userId);
    const sb: Sandbox = { admin: { ...admin }, game, undo: [], redo: [], timer };
    this.sandboxes.set(admin.userId, sb);
    this.publish(sb, server);
  }

  private publish(sb: Sandbox, server: SandboxServer): void {
    server.to(sb.admin.socketId).emit('sandbox:state', buildSandboxState(sb));
    this.scheduleTimer(sb, server);
  }

  private scheduleTimer(sb: Sandbox, server: SandboxServer): void {
    const phase = sb.game.phase;
    if (!sb.timer || phase === 'finished' || phase === 'waiting') {
      this.turnTimeout.clear(sb.game.matchId);
      return;
    }
    this.turnTimeout.schedule(sb.game.matchId, () => {
      if (this.sandboxes.get(sb.admin.userId) !== sb) return;
      const before = structuredClone(sb.game);
      this.engine.timeout(sb.game);
      this.pushUndo(sb, before);
      this.publish(sb, server);
    });
  }

  private seats(admin: SandboxAdmin): { p1: SeatEntry; p2: SeatEntry } {
    return {
      p1: {
        userId: admin.userId,
        username: `${admin.username} (J1)`,
        socketId: admin.socketId,
      },
      p2: {
        userId: -admin.userId,
        username: `${admin.username} (J2)`,
        socketId: admin.socketId,
      },
    };
  }

  /** Ids négatifs : jamais confondus avec un match enregistré. */
  private nextMatchId(): number {
    this.lastMatchId -= 1;
    return this.lastMatchId;
  }

  private async loadCards(ids: number[]): Promise<Map<number, Card>> {
    if (ids.length === 0) return new Map();
    const rows = await this.cards.findBy({ id: In(ids) });
    return new Map(rows.map((c) => [c.id, c]));
  }

  private instances(
    entries: SandboxDeckEntry[],
    cards: Map<number, Card>,
    ownerId: number,
  ): CardInstance[] {
    return entries.flatMap((e) =>
      Array.from({ length: e.quantity }, () => ({
        instanceId: uuidv4(),
        baseCard: cards.get(e.cardId)!,
        ownerId,
      })),
    );
  }
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest sandbox`
Expected: PASS (`sandbox.service` : 10 tests ; `sandbox-setup` et `scenario-serializer` restent verts).

Run: `pnpm --filter @pipou/backend typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/sandbox
git commit -m "feat(sandbox): in-memory sandboxes with undo, timer and saved scenarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Gateway `/sandbox`, API des scénarios, module et migration

**Files:**
- Create: `apps/backend/src/sandbox/sandbox.gateway.ts`
- Create: `apps/backend/src/sandbox/scenarios.controller.ts`
- Create: `apps/backend/src/sandbox/sandbox.module.ts`
- Modify: `apps/backend/src/app.module.ts` (import de `SandboxModule`)
- Create: `apps/backend/src/database/migrations/1791000000002-SandboxScenario.ts`
- Test: `apps/backend/src/sandbox/sandbox.gateway.spec.ts`

**Interfaces:**
- Consumes : `SandboxService`, `ScenariosService` (Task 5), `readSocketUser` (Task 2).
- Produces :
  - le namespace Socket.io `/sandbox` (événements de la Task 1) ;
  - `GET /sandbox/scenarios` qui renvoie `SandboxScenarioSummary[]` ;
  - `DELETE /sandbox/scenarios/:id`, réservé aux admins.

- [ ] **Step 1: Test du gateway (il échoue)**

`apps/backend/src/sandbox/sandbox.gateway.spec.ts` :

```ts
import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { SandboxGateway } from './sandbox.gateway';
import type { SandboxService } from './sandbox.service';
import type { SandboxSocket } from './sandbox-socket.types';

const SECRET = 'secret-de-test-assez-long-pour-hs256';

function setup() {
  const jwt = new JwtService();
  const sandbox = { resume: jest.fn(), disconnect: jest.fn() };
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;
  const gateway = new SandboxGateway(
    sandbox as unknown as SandboxService,
    jwt,
    config,
  );
  const client = (payload?: object) =>
    ({
      id: 'sock',
      handshake: {
        headers: {
          cookie: payload
            ? `token=${jwt.sign(payload, { secret: SECRET })}`
            : undefined,
        },
      },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    }) as unknown as SandboxSocket;
  return { gateway, sandbox, client };
}

describe('SandboxGateway', () => {
  it('refuse un joueur qui n’est pas admin', () => {
    const { gateway, sandbox, client } = setup();
    const c = client({ sub: 2, username: 'Bob', is_admin: false });

    gateway.handleConnection(c);

    expect(c.emit).toHaveBeenCalledWith('sandbox:error', {
      message: 'Sandbox réservé aux admins',
    });
    expect(c.disconnect).toHaveBeenCalled();
    expect(sandbox.resume).not.toHaveBeenCalled();
  });

  it('refuse une connexion sans jeton', () => {
    const { gateway, client } = setup();
    const c = client();

    gateway.handleConnection(c);

    expect(c.disconnect).toHaveBeenCalled();
  });

  it('un admin retrouve son sandbox en cours', () => {
    const { gateway, sandbox, client } = setup();
    const c = client({ sub: 4, username: 'Admin', is_admin: true });

    gateway.handleConnection(c);

    expect(c.disconnect).not.toHaveBeenCalled();
    expect(c.data).toMatchObject({ userId: 4, username: 'Admin', isAdmin: true });
    expect(sandbox.resume).toHaveBeenCalledWith(4, 'sock', gateway.server);
  });
});
```

Run: `pnpm --filter @pipou/backend exec jest sandbox/sandbox.gateway`
Expected: FAIL (`Cannot find module './sandbox.gateway'`).

- [ ] **Step 2: Gateway, contrôleur, module**

`apps/backend/src/sandbox/sandbox.gateway.ts` :

```ts
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type {
  SandboxActionPayload,
  SandboxCreatePayload,
  SandboxLoadPayload,
  SandboxSavePayload,
  SandboxSetupCommand,
} from '@pipou/shared';
import { readSocketUser } from '../fights/socket-auth';
import { SandboxService, type SandboxAdmin } from './sandbox.service';
import type { SandboxServer, SandboxSocket } from './sandbox-socket.types';

@WebSocketGateway({
  cors: {
    origin: ['https://pipoutcg.netlify.app', 'http://localhost:5173'],
    credentials: true,
  },
  namespace: 'sandbox',
})
export class SandboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: SandboxServer;

  constructor(
    private readonly sandbox: SandboxService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: SandboxSocket): void {
    const user = readSocketUser(
      client.handshake.headers.cookie,
      this.jwtService,
      this.configService.getOrThrow<string>('JWT_SECRET'),
    );
    if (!user?.isAdmin) {
      client.emit('sandbox:error', { message: 'Sandbox réservé aux admins' });
      client.disconnect();
      return;
    }
    client.data.userId = user.userId;
    client.data.username = user.username;
    client.data.isAdmin = true;
    this.sandbox.resume(user.userId, client.id, this.server);
  }

  handleDisconnect(client: SandboxSocket): void {
    if (client.data.userId)
      this.sandbox.disconnect(client.data.userId, client.id);
  }

  @SubscribeMessage('sandbox:create')
  async create(
    @ConnectedSocket() client: SandboxSocket,
    @MessageBody() payload: SandboxCreatePayload,
  ): Promise<void> {
    this.reply(
      client,
      await this.sandbox.create(this.adminOf(client), payload, this.server),
    );
  }

  @SubscribeMessage('sandbox:action')
  action(
    @ConnectedSocket() client: SandboxSocket,
    @MessageBody() payload: SandboxActionPayload,
  ): void {
    this.reply(
      client,
      this.sandbox.act(
        client.data.userId,
        payload.seat,
        payload.action,
        this.server,
      ),
    );
  }

  @SubscribeMessage('sandbox:setup')
  setup(
    @ConnectedSocket() client: SandboxSocket,
    @MessageBody() command: SandboxSetupCommand,
  ): void {
    this.reply(
      client,
      this.sandbox.setup(client.data.userId, command, this.server),
    );
  }

  @SubscribeMessage('sandbox:undo')
  undo(@ConnectedSocket() client: SandboxSocket): void {
    this.reply(client, this.sandbox.undo(client.data.userId, this.server));
  }

  @SubscribeMessage('sandbox:redo')
  redo(@ConnectedSocket() client: SandboxSocket): void {
    this.reply(client, this.sandbox.redo(client.data.userId, this.server));
  }

  @SubscribeMessage('sandbox:save')
  async save(
    @ConnectedSocket() client: SandboxSocket,
    @MessageBody() payload: SandboxSavePayload,
  ): Promise<void> {
    const result = await this.sandbox.save(client.data.userId, payload);
    if (result.scenarioId !== undefined)
      client.emit('sandbox:saved', { scenarioId: result.scenarioId });
    else this.reply(client, result);
  }

  @SubscribeMessage('sandbox:load')
  async load(
    @ConnectedSocket() client: SandboxSocket,
    @MessageBody() payload: SandboxLoadPayload,
  ): Promise<void> {
    this.reply(
      client,
      await this.sandbox.load(
        this.adminOf(client),
        payload.scenarioId,
        this.server,
      ),
    );
  }

  @SubscribeMessage('sandbox:close')
  close(@ConnectedSocket() client: SandboxSocket): void {
    this.sandbox.close(client.data.userId);
    client.emit('sandbox:closed');
  }

  private adminOf(client: SandboxSocket): SandboxAdmin {
    return {
      userId: client.data.userId,
      username: client.data.username,
      socketId: client.id,
    };
  }

  private reply(client: SandboxSocket, result: { error?: string }): void {
    if (result.error) client.emit('sandbox:error', { message: result.error });
  }
}
```

`apps/backend/src/sandbox/scenarios.controller.ts` :

```ts
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { SandboxScenarioSummary } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { ScenariosService } from './scenarios.service';

@Controller('sandbox/scenarios')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get()
  list(): Promise<SandboxScenarioSummary[]> {
    return this.scenarios.list();
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.scenarios.remove(id);
  }
}
```

`apps/backend/src/sandbox/sandbox.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Card } from '../cards/card.entity';
import { FightsModule } from '../fights/fights.module';
import { TurnTimeoutService } from '../fights/services/turn-timeout.service';
import { SandboxScenario } from './sandbox-scenario.entity';
import { SandboxGateway } from './sandbox.gateway';
import { SandboxService } from './sandbox.service';
import { ScenariosService } from './scenarios.service';
import { ScenariosController } from './scenarios.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Card, SandboxScenario]),
    FightsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ScenariosController],
  providers: [
    SandboxService,
    ScenariosService,
    SandboxGateway,
    // Timer propre au sandbox, distinct de celui des matchs classés
    TurnTimeoutService,
  ],
})
export class SandboxModule {}
```

Dans `app.module.ts`, importer `SandboxModule` depuis `./sandbox/sandbox.module` et l'ajouter après `FightsModule` dans `imports`.

- [ ] **Step 3: Migration de la table**

`apps/backend/src/database/migrations/1791000000002-SandboxScenario.ts` :

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Scénarios du sandbox admin, partagés entre tous les admins. */
export class SandboxScenario1791000000002 implements MigrationInterface {
  name = 'SandboxScenario1791000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `sandbox_scenario` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`name` varchar(80) NOT NULL, ' +
        '`description` varchar(500) NULL DEFAULT NULL, ' +
        '`state` json NOT NULL, ' +
        '`created_by_id` int NOT NULL, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        '`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ' +
        'INDEX `idx_sandbox_scenario_created_by` (`created_by_id`), ' +
        'PRIMARY KEY (`id`)' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'ALTER TABLE `sandbox_scenario` ADD CONSTRAINT `fk_sandbox_scenario_user` ' +
        'FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `sandbox_scenario`');
  }
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/backend exec jest sandbox fights`
Expected: PASS.

Run: `pnpm --filter @pipou/backend typecheck && pnpm --filter @pipou/backend exec eslint src/sandbox src/fights/socket-auth.ts src/fights/helpers/game-factory.ts`
Expected: aucune erreur.

Migration et alignement entité/table, **uniquement sur la base locale** (MySQL du `docker-compose.yml`, base `pipou_migr` issue du dump, cf. partie A) :

```bash
cd apps/backend
DB_NAME=pipou_migr DB_HOST=127.0.0.1 pnpm migration:run:local
DB_NAME=pipou_migr DB_HOST=127.0.0.1 pnpm exec dotenv -e .env.e2e -- node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d src/database/data-source.ts schema:log | grep -i sandbox_scenario || echo "aucun écart pour sandbox_scenario"
DB_NAME=pipou_migr DB_HOST=127.0.0.1 pnpm migration:revert:local
DB_NAME=pipou_migr DB_HOST=127.0.0.1 pnpm migration:run:local
```

Expected :
- la migration `SandboxScenario1791000000002` s'exécute ;
- `schema:log` n'affiche aucune requête sur `sandbox_scenario`, ce qui confirme que l'entité correspond exactement à la table ;
- le revert supprime la table, et le run la recrée.

Si `schema:log` signale un écart, aligner l'entité sur la migration et non l'inverse.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/sandbox apps/backend/src/app.module.ts apps/backend/src/database/migrations/1791000000002-SandboxScenario.ts
git commit -m "feat(sandbox): admin-only socket namespace, scenarios API and table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Front — contrôles du plateau partagés (`useBoardControls`)

Le plateau du duel (`FightBoard`) reçoit ses sélections et ses actions de `FightPage`. Pour que le sandbox réutilise le même plateau, cette logique sort dans un hook qui produit des `GameAction`. Seul le transport change : `fight:*` pour un match, `sandbox:action` pour le sandbox.

**Files:**
- Create: `apps/frontend/src/features/fight/emitGameAction.ts`
- Create: `apps/frontend/src/features/fight/useBoardControls.ts`
- Modify: `apps/frontend/src/features/fight/FightPage.tsx`
- Modify: `apps/frontend/src/features/fight/FightBoard.tsx` (props `timeLeft`, `onSurrender`)
- Modify: `apps/frontend/src/features/fight/FightHUD.tsx` (timer masqué si `null`)
- Modify: `apps/frontend/src/features/fight/FightActionBar.tsx` (abandon optionnel)
- Test: `apps/frontend/src/__tests__/unit/emitGameAction.test.ts`
- Test: `apps/frontend/src/__tests__/unit/useBoardControls.test.ts`

**Interfaces:**
- Consumes : `GameAction` (`@pipou/shared`), `FightClientSocket`, `GameState` (`fight.types.ts`).
- Produces :
  - `emitGameAction(socket: Pick<FightClientSocket, "emit">, matchId: number, action: GameAction): void` ;
  - `useBoardControls(gs: GameState | null, send: (action: GameAction) => void)`, qui renvoie :
    - `board`, un objet `BoardControls` à étaler dans `<FightBoard>` (sélections, setters, `onAttackMonster`, `onDirectAttack`, `onSummon`, `onSummonZeta`, `onPlaySupport`, `onChangeMode`, `onRecycleSupport`, `onDiscardCard`, `onEndPhase`) ;
    - `pickCards(instanceIds: string[])` ;
    - `decideMulligan(redraw: boolean)` ;
    - `clearSelection()`, stable d'un rendu à l'autre ;
  - `FightBoard` accepte `timeLeft: number | null` (`null` : pas de timer) et `onSurrender?: () => void` (absent : pas de bouton d'abandon).

- [ ] **Step 1: Tests (ils échouent)**

`apps/frontend/src/__tests__/unit/emitGameAction.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import type { GameAction } from "@pipou/shared";
import { emitGameAction } from "../../features/fight/emitGameAction";
import type { FightClientSocket } from "../../features/fight/fight.types";

function socket() {
  const emit = vi.fn();
  return { emit, socket: { emit } as unknown as FightClientSocket };
}

describe("emitGameAction", () => {
  it.each<[GameAction, string, object]>([
    [{ type: "mulligan", redraw: true }, "fight:mulligan", { redraw: true }],
    [{ type: "end_phase" }, "fight:end_phase", {}],
    [
      {
        type: "summon",
        handIndex: 1,
        zoneIndex: 2,
        paymentHandIndices: [0],
        onOpponentSide: true,
      },
      "fight:summon",
      {
        handIndex: 1,
        zoneIndex: 2,
        paymentHandIndices: [0],
        onOpponentSide: true,
      },
    ],
    [
      { type: "play_support", handIndex: 0, targetInstanceId: "m1" },
      "fight:play_support",
      { handIndex: 0, targetInstanceId: "m1" },
    ],
    [{ type: "recycle", handIndex: 3 }, "fight:recycle_support", { handIndex: 3 }],
    [
      { type: "change_mode", instanceId: "m1", mode: "guard" },
      "fight:change_mode",
      { instanceId: "m1", mode: "guard" },
    ],
    [
      { type: "attack", attackerInstanceId: "m1", direct: true },
      "fight:attack",
      { attackerInstanceId: "m1", direct: true },
    ],
    [{ type: "discard", handIndex: 4 }, "fight:discard", { handIndex: 4 }],
    [
      { type: "pick_cards", instanceIds: ["a", "b"] },
      "fight:pick_cards",
      { instanceIds: ["a", "b"] },
    ],
  ])("%o → %s", (action, event, payload) => {
    const { emit, socket: s } = socket();

    emitGameAction(s, 7, action);

    expect(emit).toHaveBeenCalledWith(event, { matchId: 7, ...payload });
  });
});
```

`apps/frontend/src/__tests__/unit/useBoardControls.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBoardControls } from "../../features/fight/useBoardControls";
import type { GameState } from "../../features/fight/fight.types";

const gs = {
  me: { monsterZones: [null, { instanceId: "attaquant" }, null] },
} as unknown as GameState;

describe("useBoardControls", () => {
  it("invoque la carte sélectionnée sur la zone choisie, puis vide la sélection", () => {
    const send = vi.fn();
    const { result } = renderHook(() => useBoardControls(gs, send));

    act(() => {
      result.current.board.onSetSelectedCard(2);
      result.current.board.onSetSelectedZone(0);
      result.current.board.onSetPayIndices([1]);
    });
    act(() => result.current.board.onSummon());

    expect(send).toHaveBeenCalledWith({
      type: "summon",
      handIndex: 2,
      zoneIndex: 0,
      paymentHandIndices: [1],
    });
    expect(result.current.board.selectedCard).toBeNull();
    expect(result.current.board.payIndices).toEqual([]);
  });

  it("attaque avec le monstre de la zone sélectionnée", () => {
    const send = vi.fn();
    const { result } = renderHook(() => useBoardControls(gs, send));

    act(() => result.current.board.onSetSelectedZone(1));
    act(() => result.current.board.onAttackMonster("cible"));

    expect(send).toHaveBeenCalledWith({
      type: "attack",
      attackerInstanceId: "attaquant",
      targetInstanceId: "cible",
    });
  });

  it("n'envoie rien sans carte sélectionnée", () => {
    const send = vi.fn();
    const { result } = renderHook(() => useBoardControls(gs, send));

    act(() => result.current.board.onSummonZeta(1));

    expect(send).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/emitGameAction.test.ts src/__tests__/unit/useBoardControls.test.ts`
Expected: FAIL (modules introuvables).

- [ ] **Step 2: Implémenter**

`apps/frontend/src/features/fight/emitGameAction.ts` :

```ts
import type { GameAction } from "@pipou/shared";
import type { FightClientSocket } from "./fight.types";

/** Traduit une action de jeu en événement du namespace /fight. */
export function emitGameAction(
  socket: Pick<FightClientSocket, "emit">,
  matchId: number,
  action: GameAction,
): void {
  switch (action.type) {
    case "mulligan":
      socket.emit("fight:mulligan", { matchId, redraw: action.redraw });
      return;
    case "end_phase":
      socket.emit("fight:end_phase", { matchId });
      return;
    case "summon":
      socket.emit("fight:summon", {
        matchId,
        handIndex: action.handIndex,
        zoneIndex: action.zoneIndex,
        paymentHandIndices: action.paymentHandIndices,
        ...(action.onOpponentSide && { onOpponentSide: true }),
      });
      return;
    case "play_support":
      socket.emit("fight:play_support", {
        matchId,
        handIndex: action.handIndex,
        ...(action.zoneIndex !== undefined && { zoneIndex: action.zoneIndex }),
        ...(action.targetInstanceId !== undefined && {
          targetInstanceId: action.targetInstanceId,
        }),
      });
      return;
    case "recycle":
      socket.emit("fight:recycle_support", {
        matchId,
        handIndex: action.handIndex,
      });
      return;
    case "change_mode":
      socket.emit("fight:change_mode", {
        matchId,
        instanceId: action.instanceId,
        mode: action.mode,
      });
      return;
    case "attack":
      socket.emit("fight:attack", {
        matchId,
        attackerInstanceId: action.attackerInstanceId,
        ...(action.targetInstanceId !== undefined && {
          targetInstanceId: action.targetInstanceId,
        }),
        ...(action.direct && { direct: true }),
      });
      return;
    case "discard":
      socket.emit("fight:discard", { matchId, handIndex: action.handIndex });
      return;
    case "pick_cards":
      socket.emit("fight:pick_cards", {
        matchId,
        instanceIds: action.instanceIds,
      });
      return;
  }
}
```

`apps/frontend/src/features/fight/useBoardControls.ts` :

```ts
import { useCallback, useState } from "react";
import type { CombatMode, GameAction } from "@pipou/shared";
import type { GameState } from "./fight.types";

/**
 * Sélections du plateau et actions de jeu, partagées par le duel et le
 * sandbox : seul `send` (le transport) diffère.
 */
export function useBoardControls(
  gs: GameState | null,
  send: (action: GameAction) => void,
) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [payIndices, setPayIndices] = useState<number[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedCard(null);
    setSelectedZone(null);
    setPayIndices([]);
  }, []);

  const summonAt = (
    zoneIndex: number,
    paymentHandIndices: number[],
    onOpponentSide: boolean,
  ) => {
    if (selectedCard === null) return;
    send({
      type: "summon",
      handIndex: selectedCard,
      zoneIndex,
      paymentHandIndices,
      ...(onOpponentSide && { onOpponentSide: true }),
    });
    clearSelection();
  };

  const attack = (target: { targetInstanceId: string } | { direct: true }) => {
    const attacker =
      selectedZone === null ? null : gs?.me.monsterZones[selectedZone];
    if (!attacker) return;
    send({ type: "attack", attackerInstanceId: attacker.instanceId, ...target });
    setSelectedZone(null);
  };

  return {
    board: {
      selectedCard,
      selectedZone,
      payIndices,
      onSetSelectedCard: setSelectedCard,
      onSetSelectedZone: setSelectedZone,
      onSetPayIndices: setPayIndices,
      onAttackMonster: (targetInstanceId: string) =>
        attack({ targetInstanceId }),
      onDirectAttack: () => attack({ direct: true }),
      /** Le paiement passe en argument : l'état payIndices n'est pas encore à jour. */
      onSummon: (paymentIndices: number[] = payIndices) => {
        if (selectedZone !== null) summonAt(selectedZone, paymentIndices, false);
      },
      onSummonZeta: (zoneIndex: number, paymentIndices: number[] = payIndices) =>
        summonAt(zoneIndex, paymentIndices, true),
      onPlaySupport: (
        handIndex: number,
        zoneIndex?: number,
        targetInstanceId?: string,
      ) => {
        send({
          type: "play_support",
          handIndex,
          ...(zoneIndex !== undefined && { zoneIndex }),
          ...(targetInstanceId !== undefined && { targetInstanceId }),
        });
        clearSelection();
      },
      onChangeMode: (instanceId: string, mode: CombatMode) =>
        send({ type: "change_mode", instanceId, mode }),
      onRecycleSupport: (handIndex: number) =>
        send({ type: "recycle", handIndex }),
      onDiscardCard: (handIndex: number) => send({ type: "discard", handIndex }),
      onEndPhase: () => send({ type: "end_phase" }),
    },
    pickCards: (instanceIds: string[]) =>
      send({ type: "pick_cards", instanceIds }),
    decideMulligan: (redraw: boolean) => send({ type: "mulligan", redraw }),
    clearSelection,
  };
}
```

- [ ] **Step 3: Timer et abandon optionnels sur le plateau**

Dans `FightBoard.tsx`, changer les deux props :

```ts
  /** null : pas de timer (sandbox sans timer). */
  timeLeft: number | null;
  /** Absent : pas de bouton d'abandon. */
  onSurrender?: () => void;
```

Dans `FightHUD.tsx`, typer la prop `timeLeft: number | null;` et n'afficher le timer que s'il existe :

```tsx
        {isMyTurn && timeLeft !== null && (
          <span
            className={`hud-timer${timeLeft < 20 ? " hud-timer--urgent" : ""}`}
          >
```

Dans `FightActionBar.tsx`, typer `onSurrender?: () => void;` et entourer le bouton :

```tsx
      {onSurrender && (
        <button onClick={onSurrender} className="fab-btn-surrender">
          🏳️ Abandonner
        </button>
      )}
```

- [ ] **Step 4: Brancher `FightPage` sur le hook**

Dans `FightPage.tsx` :

1. Supprimer les états `selectedCard`, `selectedZone`, `payIndices` et les fonctions `endPhase`, `summon`, `summonZeta`, `attackMonster`, `directAttack`, `changeMode`, `recycleFromHand`, `playSupport`, `discardCard`, `decideMulligan`, `pickCards`, ainsi que l'import de `CombatMode`.

2. Après la déclaration de `socketRef` et `timerRef`, ajouter :

```tsx
  const send = useCallback(
    (action: GameAction) => {
      if (socketRef.current && matchId)
        emitGameAction(socketRef.current, matchId, action);
    },
    [matchId],
  );
  const controls = useBoardControls(gameState, send);
  const { clearSelection } = controls;
```

Les imports à ajouter sont `import type { GameAction } from "@pipou/shared";`, `import { emitGameAction } from "./emitGameAction";` et `import { useBoardControls } from "./useBoardControls";`.

3. Dans le handler `fight:state`, remplacer les trois appels `setSelectedCard(null)`, `setSelectedZone(null)` et `setPayIndices([])` par `clearSelection();`, puis ajouter `clearSelection` aux dépendances de l'effet.

4. Dans le rendu :

```tsx
            <MulliganPanel
              hand={gameState.me.hand}
              decided={gameState.me.mulliganDone}
              opponentDecided={gameState.opponent.mulliganDone}
              opponentName={gameState.opponent.username}
              onDecide={controls.decideMulligan}
            />
```

```tsx
                <FightBoard
                  gs={gameState}
                  {...controls.board}
                  timeLeft={timeLeft}
                  onSurrender={surrender}
                />

                {gameState.pendingChoice && (
                  <CardPickModal
                    choice={gameState.pendingChoice}
                    onConfirm={controls.pickCards}
                  />
                )}
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/emitGameAction.test.ts src/__tests__/unit/useBoardControls.test.ts`
Expected: PASS (12 tests).

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend test && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur. Les tests existants, dont `MulliganPanel`, restent verts.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/fight apps/frontend/src/__tests__/unit/emitGameAction.test.ts apps/frontend/src/__tests__/unit/useBoardControls.test.ts
git commit -m "refactor(fight): extract board controls so the sandbox can reuse the board

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Front — onglet admin, liste des scénarios et route `/admin/sandbox`

**Files:**
- Create: `apps/frontend/src/services/sandbox.service.ts`
- Modify: `apps/frontend/src/utils/querykeys.ts`
- Create: `apps/frontend/src/features/sandbox/ScenarioList.tsx`
- Create: `apps/frontend/src/features/sandbox/Sandbox.css`
- Modify: `apps/frontend/src/pages/Admin.tsx`
- Create: `apps/frontend/src/pages/AdminSandbox.tsx`
- Create: `apps/frontend/src/features/sandbox/SandboxPage.tsx` (version minimale, complétée en Task 10)
- Modify: `apps/frontend/src/App.tsx`
- Test: `apps/frontend/src/__tests__/components/ScenarioList.test.tsx`

**Interfaces:**
- Consumes : `GET /sandbox/scenarios` et `DELETE /sandbox/scenarios/:id` (Task 6), `cardService.findAll`.
- Produces :
  - `sandboxService.listScenarios(): Promise<SandboxScenarioSummary[]>` ;
  - `sandboxService.deleteScenario(id: number): Promise<void>` ;
  - `sandboxService.catalog(): Promise<Card[]>` ;
  - `QUERY_KEYS.sandbox.scenarios` et `QUERY_KEYS.sandbox.catalog` ;
  - la route `/admin/sandbox?scenario=<id>` ;
  - le composant par défaut `SandboxPage` (sans props).

- [ ] **Step 1: Test de la liste (il échoue)**

`apps/frontend/src/__tests__/components/ScenarioList.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ScenarioList from "../../features/sandbox/ScenarioList";
import { sandboxService } from "../../services/sandbox.service";

vi.mock("../../services/sandbox.service", () => ({
  sandboxService: {
    listScenarios: vi.fn(),
    deleteScenario: vi.fn(),
  },
}));

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<ScenarioList />} />
          <Route path="/admin/sandbox" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ScenarioList", () => {
  beforeEach(() => {
    vi.mocked(sandboxService.listScenarios).mockResolvedValue([
      {
        id: 3,
        name: "Combo Noyaux",
        description: "Alpha + Module .v2",
        createdBy: "Admin",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    ]);
    vi.mocked(sandboxService.deleteScenario).mockResolvedValue();
  });

  it("ouvre un scénario dans le sandbox", async () => {
    renderList();

    await userEvent.click(await screen.findByRole("button", { name: "Charger" }));

    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/sandbox?scenario=3",
    );
  });

  it("supprime un scénario après confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderList();

    await userEvent.click(
      await screen.findByRole("button", { name: "Supprimer" }),
    );

    expect(sandboxService.deleteScenario).toHaveBeenCalledWith(3);
  });

  it("lance un sandbox vierge", async () => {
    renderList();

    await userEvent.click(
      screen.getByRole("button", { name: /Nouveau sandbox/ }),
    );

    expect(screen.getByTestId("where")).toHaveTextContent("/admin/sandbox");
  });
});
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/ScenarioList.test.tsx`
Expected: FAIL (modules introuvables).

- [ ] **Step 2: Service et clés de requête**

`apps/frontend/src/services/sandbox.service.ts` :

```ts
import { api } from "../api/api";
import type { SandboxScenarioSummary } from "@pipou/shared";
import { cardService, type Card } from "./card.service";

export type { SandboxScenarioSummary };

export const sandboxService = {
  async listScenarios(): Promise<SandboxScenarioSummary[]> {
    const res = await api.get("/sandbox/scenarios");
    return res.data;
  },

  async deleteScenario(id: number): Promise<void> {
    await api.delete(`/sandbox/scenarios/${id}`);
  },

  /** Tout le catalogue ; 500 est le plafond de pagination de l'API. */
  async catalog(): Promise<Card[]> {
    const res = await cardService.findAll(1, 500);
    return res.data;
  },
};
```

Dans `utils/querykeys.ts`, ajouter après le bloc `admin` :

```ts
  // ── Sandbox admin ─────────────────────────────────────────────────────────
  sandbox: {
    scenarios: ["sandbox", "scenarios"] as const,
    catalog: ["sandbox", "catalog"] as const,
  },
```

- [ ] **Step 3: Liste des scénarios**

`apps/frontend/src/features/sandbox/ScenarioList.tsx` :

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { sandboxService } from "../../services/sandbox.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import "./Sandbox.css";

/** Onglet admin : scénarios partagés et accès au sandbox. */
export default function ScenarioList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scenarios = useQuery({
    queryKey: QUERY_KEYS.sandbox.scenarios,
    queryFn: () => sandboxService.listScenarios(),
  });
  const remove = useMutation({
    mutationFn: (id: number) => sandboxService.deleteScenario(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sandbox.scenarios }),
  });

  return (
    <div className="sb-scenarios">
      <div className="sb-scenarios__head">
        <p>
          Joue les deux joueurs avec des decks libres, pour tester les combos.
          Rien n'est enregistré (ni match, ni ELO), sauf les scénarios.
        </p>
        <Button onClick={() => navigate("/admin/sandbox")}>
          🧪 Nouveau sandbox
        </Button>
      </div>

      {scenarios.isLoading && <Loading message="Chargement des scénarios…" />}
      {scenarios.isError && (
        <p className="sb-error">{apiErrorMessage(scenarios.error)}</p>
      )}
      {remove.isError && (
        <p className="sb-error">{apiErrorMessage(remove.error)}</p>
      )}
      {scenarios.data?.length === 0 && <p>Aucun scénario sauvegardé.</p>}

      <ul className="sb-scenarios__list">
        {scenarios.data?.map((s) => (
          <li key={s.id} className="sb-scenarios__item">
            <div>
              <strong>{s.name}</strong>
              {s.description && <p>{s.description}</p>}
              <small>
                {s.createdBy} · {new Date(s.updatedAt).toLocaleString("fr-FR")}
              </small>
            </div>
            <div className="sb-scenarios__actions">
              <Button
                size="sm"
                onClick={() => navigate(`/admin/sandbox?scenario=${s.id}`)}
              >
                Charger
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Supprimer « ${s.name} » ?`))
                    remove.mutate(s.id);
                }}
              >
                Supprimer
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`apps/frontend/src/features/sandbox/Sandbox.css`, avec les styles de toutes les vues du sandbox (les tâches suivantes s'y appuient) :

```css
.sb-error { color: var(--color-danger, #c0392b); }

.sb-scenarios { display: flex; flex-direction: column; gap: 1rem; }
.sb-scenarios__head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.sb-scenarios__list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .5rem; }
.sb-scenarios__item { display: flex; justify-content: space-between; gap: 1rem; padding: .75rem; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; }
.sb-scenarios__item p { margin: .25rem 0; }
.sb-scenarios__actions { display: flex; gap: .5rem; align-items: center; }

.sb-page { min-height: 100vh; display: flex; flex-direction: column; gap: .75rem; padding: .75rem; box-sizing: border-box; }
.sb-toast { position: fixed; top: 1rem; left: 50%; transform: translateX(-50%); padding: .5rem 1rem; border-radius: 8px; z-index: 50; background: #2d6a4f; color: #fff; }
.sb-toast--err { background: #9b2226; }
.sb-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: .75rem; align-items: start; }
.sb-side { display: flex; flex-direction: column; gap: .75rem; }
@media (max-width: 900px) { .sb-layout { grid-template-columns: minmax(0, 1fr); } }

.sb-toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.sb-toolbar__group { display: flex; gap: .25rem; align-items: center; }
.sb-banner { padding: .5rem 1rem; border-radius: 8px; background: rgba(212,175,55,.2); font-weight: 600; }

.sb-panel { border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: .75rem; display: flex; flex-direction: column; gap: .5rem; }
.sb-panel h3 { margin: 0; font-size: 1rem; }
.sb-cardlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .25rem; max-height: 320px; overflow-y: auto; }
.sb-cardrow { display: flex; justify-content: space-between; align-items: center; gap: .5rem; padding: .25rem .5rem; border-radius: 6px; background: rgba(255,255,255,.05); }
.sb-cardrow--drag { cursor: grab; }
.sb-cardrow--over { outline: 2px dashed rgba(212,175,55,.8); }
.sb-cardrow__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-form { display: grid; grid-template-columns: auto 1fr; gap: .35rem .5rem; align-items: center; }
.sb-form input[type="number"] { width: 6rem; }

.sb-setup { display: flex; flex-direction: column; gap: 1rem; max-width: 960px; margin: 0 auto; width: 100%; }
.sb-setup__decks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
@media (max-width: 700px) { .sb-setup__decks { grid-template-columns: minmax(0, 1fr); } }
.sb-setup__options { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
```

- [ ] **Step 4: Onglet admin, page et route**

Dans `pages/Admin.tsx` :
- ajouter `| "sandbox"` à `AdminTab` ;
- ajouter `{ key: "sandbox", label: "Sandbox", icon: "🧪" }` à la fin de `TABS` ;
- importer `ScenarioList from "../features/sandbox/ScenarioList"` ;
- ajouter `{tab === "sandbox" && <ScenarioList />}` après la ligne des bannières.

`apps/frontend/src/features/sandbox/SandboxPage.tsx`, en version minimale (la Task 10 la remplace) :

```tsx
import "./Sandbox.css";

export default function SandboxPage() {
  return <div className="sb-page">Sandbox</div>;
}
```

`apps/frontend/src/pages/AdminSandbox.tsx` :

```tsx
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import { QUERY_KEYS } from "../utils/querykeys";
import Loading from "../components/Loading";
import SandboxPage from "../features/sandbox/SandboxPage";

/** Sandbox de duel, réservé aux admins (le serveur le vérifie aussi). */
export default function AdminSandbox() {
  const { data: user, isLoading } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
  });

  if (isLoading) return <Loading message="Vérification des droits..." />;
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return <SandboxPage />;
}
```

Dans `App.tsx`, importer `AdminSandbox from "./pages/AdminSandbox"`. Ajouter ensuite la route en plein écran, **hors du layout** et protégée, juste avant `<Route path="*" …>` :

```tsx
            <Route
              path="/admin/sandbox"
              element={
                <ProtectedRoute>
                  <AdminSandbox />
                </ProtectedRoute>
              }
            />
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/ScenarioList.test.tsx`
Expected: PASS (3 tests).

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/services/sandbox.service.ts apps/frontend/src/utils/querykeys.ts apps/frontend/src/features/sandbox apps/frontend/src/pages/Admin.tsx apps/frontend/src/pages/AdminSandbox.tsx apps/frontend/src/App.tsx apps/frontend/src/__tests__/components/ScenarioList.test.tsx
git commit -m "feat(admin): sandbox tab with shared scenarios and /admin/sandbox route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Front — composition des deux decks (`SandboxSetup`)

**Files:**
- Create: `apps/frontend/src/features/sandbox/deckDraft.ts`
- Create: `apps/frontend/src/features/sandbox/SandboxSetup.tsx`
- Test: `apps/frontend/src/__tests__/unit/deckDraft.test.ts`
- Test: `apps/frontend/src/__tests__/components/SandboxSetup.test.tsx`

**Interfaces:**
- Consumes : `DECK_RULES`, `SandboxCreatePayload`, `SandboxDeckEntry` (`@pipou/shared`), `Card` (`services/card.service`).
- Produces :
  - `DeckDraft = Record<number, number>` (cardId → quantité) ;
  - les fonctions `addCard(draft, cardId)`, `removeCard(draft, cardId)`, `draftSize(draft)`, `draftIsValid(draft)`, `fillTo(draft, cardIds, target)` et `draftToEntries(draft)` ;
  - `<SandboxSetup catalog={Card[]} onStart={(payload: SandboxCreatePayload) => void} />`.

- [ ] **Step 1: Tests (ils échouent)**

`apps/frontend/src/__tests__/unit/deckDraft.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { DECK_RULES } from "@pipou/shared";
import {
  addCard,
  draftIsValid,
  draftSize,
  draftToEntries,
  fillTo,
  removeCard,
} from "../../features/sandbox/deckDraft";

describe("deckDraft", () => {
  it(`ajoute au plus ${DECK_RULES.MAX_COPIES} exemplaires d'une carte`, () => {
    let draft = {};
    for (let i = 0; i < 5; i++) draft = addCard(draft, 7);
    expect(draft).toEqual({ 7: DECK_RULES.MAX_COPIES });
  });

  it("retire un exemplaire, puis la ligne", () => {
    expect(removeCard({ 7: 2 }, 7)).toEqual({ 7: 1 });
    expect(removeCard({ 7: 1 }, 7)).toEqual({});
    expect(removeCard({}, 7)).toEqual({});
  });

  it("complète jusqu'à la taille voulue en parcourant les cartes", () => {
    const ids = Array.from({ length: 12 }, (_, i) => i + 1);
    const draft = fillTo({ 1: 3 }, ids, DECK_RULES.MIN_CARDS);

    expect(draftSize(draft)).toBe(DECK_RULES.MIN_CARDS);
    expect(Object.values(draft).every((q) => q <= DECK_RULES.MAX_COPIES)).toBe(
      true,
    );
    expect(draftIsValid(draft)).toBe(true);
  });

  it("s'arrête si le catalogue ne suffit pas", () => {
    expect(draftSize(fillTo({}, [1, 2], DECK_RULES.MIN_CARDS))).toBe(
      2 * DECK_RULES.MAX_COPIES,
    );
  });

  it(`n'accepte que ${DECK_RULES.MIN_CARDS} à ${DECK_RULES.MAX_CARDS} cartes`, () => {
    expect(draftIsValid({ 1: 3 })).toBe(false);
    expect(draftToEntries({ 4: 2, 9: 1 })).toEqual([
      { cardId: 4, quantity: 2 },
      { cardId: 9, quantity: 1 },
    ]);
  });
});
```

`apps/frontend/src/__tests__/components/SandboxSetup.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardType, Rarity } from "@pipou/shared";
import SandboxSetup from "../../features/sandbox/SandboxSetup";
import type { Card } from "../../services/card.service";

const catalog: Card[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Carte ${i + 1}`,
  rarity: Rarity.COMMON,
  type: CardType.MONSTER,
  atk: 100,
  hp: 500,
  cost: 1,
  cardSet: { id: 1, name: "Base" },
}));

describe("SandboxSetup", () => {
  it("lance le sandbox quand les deux decks sont valides", async () => {
    const onStart = vi.fn();
    render(<SandboxSetup catalog={catalog} onStart={onStart} />);
    const start = screen.getByRole("button", { name: /Lancer/ });
    expect(start).toBeDisabled();

    for (const deck of ["Deck J1", "Deck J2"]) {
      const panel = screen.getByRole("region", { name: deck });
      await userEvent.click(
        within(panel).getByRole("button", { name: /Compléter/ }),
      );
    }
    await userEvent.click(screen.getByLabelText("J2 commence"));
    await userEvent.click(start);

    const payload = onStart.mock.calls[0][0];
    expect(payload.firstSeat).toBe("p2");
    expect(payload.timer).toBe(false);
    for (const seat of ["p1", "p2"] as const) {
      expect(
        payload.decks[seat].reduce(
          (n: number, e: { quantity: number }) => n + e.quantity,
          0,
        ),
      ).toBe(30);
    }
  });

  it("ajoute une carte du catalogue au deck édité", async () => {
    render(<SandboxSetup catalog={catalog} onStart={vi.fn()} />);
    const panel = screen.getByRole("region", { name: "Deck J1" });

    await userEvent.click(
      screen.getByRole("button", { name: "Ajouter Carte 3 au deck J1" }),
    );

    expect(within(panel).getByText("Carte 3")).toBeInTheDocument();
    expect(within(panel).getByText(/1 \/ 30/)).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/deckDraft.test.ts src/__tests__/components/SandboxSetup.test.tsx`
Expected: FAIL (modules introuvables).

- [ ] **Step 2: Implémenter**

`apps/frontend/src/features/sandbox/deckDraft.ts` :

```ts
import { DECK_RULES, type SandboxDeckEntry } from "@pipou/shared";

/** Deck en cours de composition : cardId → quantité. */
export type DeckDraft = Record<number, number>;

export function draftSize(draft: DeckDraft): number {
  return Object.values(draft).reduce((sum, q) => sum + q, 0);
}

/** +1 exemplaire, dans la limite des exemplaires et de la taille du deck. */
export function addCard(draft: DeckDraft, cardId: number): DeckDraft {
  const count = draft[cardId] ?? 0;
  if (count >= DECK_RULES.MAX_COPIES || draftSize(draft) >= DECK_RULES.MAX_CARDS)
    return draft;
  return { ...draft, [cardId]: count + 1 };
}

export function removeCard(draft: DeckDraft, cardId: number): DeckDraft {
  const count = draft[cardId] ?? 0;
  if (count === 0) return draft;
  const next = { ...draft };
  if (count === 1) delete next[cardId];
  else next[cardId] = count - 1;
  return next;
}

/** Ajoute les cartes une à une, en boucle, jusqu'à `target` (ou saturation). */
export function fillTo(
  draft: DeckDraft,
  cardIds: number[],
  target: number,
): DeckDraft {
  let next = draft;
  let progressed = true;
  while (draftSize(next) < target && progressed) {
    progressed = false;
    for (const id of cardIds) {
      if (draftSize(next) >= target) break;
      const added = addCard(next, id);
      if (added !== next) progressed = true;
      next = added;
    }
  }
  return next;
}

export function draftIsValid(draft: DeckDraft): boolean {
  const size = draftSize(draft);
  return size >= DECK_RULES.MIN_CARDS && size <= DECK_RULES.MAX_CARDS;
}

export function draftToEntries(draft: DeckDraft): SandboxDeckEntry[] {
  return Object.entries(draft).map(([id, quantity]) => ({
    cardId: Number(id),
    quantity,
  }));
}
```

`apps/frontend/src/features/sandbox/SandboxSetup.tsx` :

```tsx
import { useState } from "react";
import {
  DECK_RULES,
  type SandboxCreatePayload,
  type Seat,
} from "@pipou/shared";
import Button from "../../components/Button";
import type { Card } from "../../services/card.service";
import {
  addCard,
  draftIsValid,
  draftSize,
  draftToEntries,
  fillTo,
  removeCard,
  type DeckDraft,
} from "./deckDraft";

const SEAT_LABEL: Record<Seat, string> = { p1: "J1", p2: "J2" };

interface DeckPanelProps {
  seat: Seat;
  draft: DeckDraft;
  catalog: Card[];
  editing: boolean;
  onEdit: () => void;
  onChange: (draft: DeckDraft) => void;
  onCopyOther: () => void;
}

/** Contenu d'un deck en cours de composition. */
function DraftPanel({
  seat,
  draft,
  catalog,
  editing,
  onEdit,
  onChange,
  onCopyOther,
}: DeckPanelProps) {
  const label = `Deck ${SEAT_LABEL[seat]}`;
  const lines = catalog.filter((c) => draft[c.id]);
  return (
    <section className="sb-panel" aria-label={label}>
      <h3>
        {label} — {draftSize(draft)} / {DECK_RULES.MIN_CARDS}
        {draftIsValid(draft) ? " ✅" : ""}
      </h3>
      <div className="sb-toolbar">
        <Button size="sm" variant="ghost-gold" active={editing} onClick={onEdit}>
          {editing ? "En cours d'édition" : "Éditer ce deck"}
        </Button>
        <Button
          size="sm"
          variant="ghost-gold"
          onClick={() =>
            onChange(
              fillTo(
                draft,
                catalog.map((c) => c.id),
                DECK_RULES.MIN_CARDS,
              ),
            )
          }
        >
          Compléter jusqu'à {DECK_RULES.MIN_CARDS}
        </Button>
        <Button size="sm" variant="ghost-gold" onClick={onCopyOther}>
          Copier l'autre deck
        </Button>
        <Button size="sm" variant="ghost-bordeaux" onClick={() => onChange({})}>
          Vider
        </Button>
      </div>
      <ul className="sb-cardlist">
        {lines.map((c) => (
          <li key={c.id} className="sb-cardrow">
            <span className="sb-cardrow__name">{c.name}</span>
            <span>×{draft[c.id]}</span>
            <Button
              size="icon"
              variant="ghost-bordeaux"
              aria-label={`Retirer ${c.name} du deck ${SEAT_LABEL[seat]}`}
              onClick={() => onChange(removeCard(draft, c.id))}
            >
              −
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Props {
  catalog: Card[];
  onStart: (payload: SandboxCreatePayload) => void;
}

/** Composition libre des deux decks (tout le catalogue, règles de deck). */
export default function SandboxSetup({ catalog, onStart }: Props) {
  const [drafts, setDrafts] = useState<Record<Seat, DeckDraft>>({
    p1: {},
    p2: {},
  });
  const [editing, setEditing] = useState<Seat>("p1");
  const [filter, setFilter] = useState("");
  const [firstSeat, setFirstSeat] = useState<Seat>("p1");
  const [timer, setTimer] = useState(false);

  const setDraft = (seat: Seat, draft: DeckDraft) =>
    setDrafts((d) => ({ ...d, [seat]: draft }));
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? catalog.filter((c) => c.name.toLowerCase().includes(needle))
    : catalog;
  const ready = draftIsValid(drafts.p1) && draftIsValid(drafts.p2);

  return (
    <div className="sb-setup">
      <h1>🧪 Sandbox de duel</h1>
      <div className="sb-setup__decks">
        {(["p1", "p2"] as const).map((seat) => (
          <DraftPanel
            key={seat}
            seat={seat}
            draft={drafts[seat]}
            catalog={catalog}
            editing={editing === seat}
            onEdit={() => setEditing(seat)}
            onChange={(d) => setDraft(seat, d)}
            onCopyOther={() =>
              setDraft(seat, { ...drafts[seat === "p1" ? "p2" : "p1"] })
            }
          />
        ))}
      </div>

      <section className="sb-panel" aria-label="Catalogue">
        <h3>Catalogue → deck {SEAT_LABEL[editing]}</h3>
        <input
          type="search"
          placeholder="Filtrer par nom…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="sb-cardlist">
          {visible.map((c) => (
            <li key={c.id} className="sb-cardrow">
              <span className="sb-cardrow__name">
                {c.name}{" "}
                <small>
                  {c.type === "monster"
                    ? `${c.atk}⚔ ${c.hp}❤ · ${c.cost}⚡`
                    : (c.supportType ?? c.type)}
                </small>
              </span>
              <span>×{drafts[editing][c.id] ?? 0}</span>
              <Button
                size="icon"
                variant="ghost-gold"
                aria-label={`Ajouter ${c.name} au deck ${SEAT_LABEL[editing]}`}
                onClick={() => setDraft(editing, addCard(drafts[editing], c.id))}
              >
                +
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="sb-setup__options">
        {(["p1", "p2"] as const).map((seat) => (
          <label key={seat}>
            <input
              type="radio"
              name="first-seat"
              checked={firstSeat === seat}
              onChange={() => setFirstSeat(seat)}
            />{" "}
            {SEAT_LABEL[seat]} commence
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={timer}
            onChange={(e) => setTimer(e.target.checked)}
          />{" "}
          Timer de 90 s
        </label>
        <Button
          disabled={!ready}
          onClick={() =>
            onStart({
              decks: {
                p1: draftToEntries(drafts.p1),
                p2: draftToEntries(drafts.p2),
              },
              firstSeat,
              timer,
            })
          }
        >
          ▶ Lancer le sandbox
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/deckDraft.test.ts src/__tests__/components/SandboxSetup.test.tsx`
Expected: PASS (7 tests).

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/sandbox/deckDraft.ts apps/frontend/src/features/sandbox/SandboxSetup.tsx apps/frontend/src/__tests__/unit/deckDraft.test.ts apps/frontend/src/__tests__/components/SandboxSetup.test.tsx
git commit -m "feat(sandbox): compose both decks from the whole catalogue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Front — page du sandbox : socket, vue qui suit le tour, barre d'outils

**Files:**
- Create: `apps/frontend/src/features/sandbox/viewSeat.ts`
- Create: `apps/frontend/src/features/sandbox/SandboxToolbar.tsx`
- Create: `apps/frontend/src/features/sandbox/OpponentHand.tsx`
- Modify: `apps/frontend/src/features/sandbox/SandboxPage.tsx` (remplace la version minimale)
- Test: `apps/frontend/src/__tests__/unit/viewSeat.test.ts`
- Test: `apps/frontend/src/__tests__/components/SandboxToolbar.test.tsx`

**Interfaces:**
- Consumes :
  - le namespace `/sandbox` (Task 6) ;
  - `useBoardControls` (Task 7) ;
  - `SandboxSetup` (Task 9) ;
  - `sandboxService.catalog` et `QUERY_KEYS.sandbox` (Task 8) ;
  - `FightBoard`, `MulliganPanel`, `CardPickModal`.
- Produces :
  - `autoViewSeat(state: SandboxState): Seat` ;
  - `SandboxClientSocket` ;
  - `<SandboxToolbar … />` et `<OpponentHand cards={CardInstance[]} name={string} />` ;
  - dans `SandboxPage`, les valeurs `state`, `seat` et `sendSetup(command)`, que la Task 11 utilise.

- [ ] **Step 1: Tests (ils échouent)**

`apps/frontend/src/__tests__/unit/viewSeat.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import type { SandboxState } from "@pipou/shared";
import { autoViewSeat } from "../../features/sandbox/viewSeat";

function state(
  p1: Record<string, unknown>,
  p2: Record<string, unknown>,
  phase = "main",
): SandboxState {
  const view = (v: Record<string, unknown>) => ({
    phase,
    isMyTurn: false,
    me: { mulliganDone: true },
    ...v,
  });
  return { views: { p1: view(p1), p2: view(p2) } } as unknown as SandboxState;
}

describe("autoViewSeat", () => {
  it("suit le joueur actif", () => {
    expect(autoViewSeat(state({}, { isMyTurn: true }))).toBe("p2");
  });

  it("passe au joueur qui doit faire un choix, même hors de son tour", () => {
    expect(
      autoViewSeat(
        state(
          { isMyTurn: true },
          { pendingChoice: { candidates: [], count: 1, prompt: "" } },
        ),
      ),
    ).toBe("p2");
  });

  it("au mulligan, montre le premier joueur qui n'a pas décidé", () => {
    expect(
      autoViewSeat(
        state(
          { isMyTurn: true, me: { mulliganDone: true } },
          { me: { mulliganDone: false } },
          "mulligan",
        ),
      ),
    ).toBe("p2");
  });
});
```

`apps/frontend/src/__tests__/components/SandboxToolbar.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SandboxToolbar from "../../features/sandbox/SandboxToolbar";

function renderToolbar(over: Partial<Parameters<typeof SandboxToolbar>[0]> = {}) {
  const props = {
    seat: "p1" as const,
    forcedSeat: null,
    onForceSeat: vi.fn(),
    showOpponentHand: false,
    onToggleOpponentHand: vi.fn(),
    canUndo: true,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<SandboxToolbar {...props} />);
  return props;
}

describe("SandboxToolbar", () => {
  it("force la vue sur un joueur, puis revient en automatique", async () => {
    const props = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "J2" }));
    await userEvent.click(screen.getByRole("button", { name: /Auto/ }));

    expect(props.onForceSeat).toHaveBeenNthCalledWith(1, "p2");
    expect(props.onForceSeat).toHaveBeenNthCalledWith(2, null);
  });

  it("désactive Refaire quand il n'y a rien à refaire", () => {
    renderToolbar();

    expect(screen.getByRole("button", { name: /Annuler/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Refaire/ })).toBeDisabled();
  });

  it("demande un nom, et une description facultative, avant de sauvegarder", async () => {
    vi.spyOn(window, "prompt")
      .mockReturnValueOnce("Combo Zeta")
      .mockReturnValueOnce("");
    const props = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: /Sauver/ }));

    expect(props.onSave).toHaveBeenCalledWith("Combo Zeta", undefined);
  });
});
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/viewSeat.test.ts src/__tests__/components/SandboxToolbar.test.tsx`
Expected: FAIL (modules introuvables).

- [ ] **Step 2: Vue automatique, barre d'outils et main adverse**

`apps/frontend/src/features/sandbox/viewSeat.ts` :

```ts
import type { SandboxState, Seat } from "@pipou/shared";

const SEATS: Seat[] = ["p1", "p2"];

/** Siège à afficher : celui qui doit choisir, sinon décider son mulligan, sinon jouer. */
export function autoViewSeat(state: SandboxState): Seat {
  const choosing = SEATS.find((s) => state.views[s].pendingChoice);
  if (choosing) return choosing;
  if (state.views.p1.phase === "mulligan")
    return SEATS.find((s) => !state.views[s].me.mulliganDone) ?? "p1";
  return SEATS.find((s) => state.views[s].isMyTurn) ?? "p1";
}
```

`apps/frontend/src/features/sandbox/SandboxToolbar.tsx` :

```tsx
import type { Seat } from "@pipou/shared";
import Button from "../../components/Button";

interface Props {
  /** Siège affiché. */
  seat: Seat;
  /** null : la vue suit le tour. */
  forcedSeat: Seat | null;
  onForceSeat: (seat: Seat | null) => void;
  showOpponentHand: boolean;
  onToggleOpponentHand: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: (name: string, description?: string) => void;
  onClose: () => void;
}

export default function SandboxToolbar({
  seat,
  forcedSeat,
  onForceSeat,
  showOpponentHand,
  onToggleOpponentHand,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="sb-toolbar" role="toolbar" aria-label="Outils du sandbox">
      <div className="sb-toolbar__group">
        <span>Vue :</span>
        <Button
          size="sm"
          variant="ghost-gold"
          active={forcedSeat === null}
          onClick={() => onForceSeat(null)}
        >
          Auto ({seat === "p1" ? "J1" : "J2"})
        </Button>
        {(["p1", "p2"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="ghost-gold"
            active={forcedSeat === s}
            onClick={() => onForceSeat(s)}
          >
            {s === "p1" ? "J1" : "J2"}
          </Button>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost-gold"
        active={showOpponentHand}
        onClick={onToggleOpponentHand}
      >
        👁 Main adverse
      </Button>
      <div className="sb-toolbar__group">
        <Button size="sm" variant="ghost-gold" disabled={!canUndo} onClick={onUndo}>
          ↶ Annuler
        </Button>
        <Button size="sm" variant="ghost-gold" disabled={!canRedo} onClick={onRedo}>
          ↷ Refaire
        </Button>
      </div>
      <Button
        size="sm"
        onClick={() => {
          const name = window.prompt("Nom du scénario ?")?.trim();
          if (!name) return;
          const description = window.prompt("Description (facultative) ?")?.trim();
          onSave(name, description || undefined);
        }}
      >
        💾 Sauver
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={() => {
          if (window.confirm("Fermer ce sandbox ? L'état non sauvegardé sera perdu."))
            onClose();
        }}
      >
        ✖ Fermer
      </Button>
    </div>
  );
}
```

`apps/frontend/src/features/sandbox/OpponentHand.tsx` :

```tsx
import type { CardInstance } from "@pipou/shared";

/** Main du joueur non affiché, visible en sandbox uniquement. */
export default function OpponentHand({
  cards,
  name,
}: {
  cards: CardInstance[];
  name: string;
}) {
  return (
    <section className="sb-panel" aria-label={`Main de ${name}`}>
      <h3>
        🖐 Main de {name} ({cards.length})
      </h3>
      <ul className="sb-cardlist">
        {cards.map((c) => (
          <li key={c.instanceId} className="sb-cardrow">
            <span className="sb-cardrow__name">{c.baseCard.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Page du sandbox**

`apps/frontend/src/features/sandbox/SandboxPage.tsx` remplace la version minimale :

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SANDBOX_NAMESPACE,
  type GameAction,
  type SandboxClientEvents,
  type SandboxServerEvents,
  type SandboxSetupCommand,
  type SandboxState,
  type Seat,
} from "@pipou/shared";
import Loading from "../../components/Loading";
import FightBoard from "../fight/FightBoard";
import MulliganPanel from "../fight/MulliganPanel";
import CardPickModal from "../fight/CardPickModal";
import { useBoardControls } from "../fight/useBoardControls";
import { sandboxService } from "../../services/sandbox.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import SandboxSetup from "./SandboxSetup";
import SandboxToolbar from "./SandboxToolbar";
import OpponentHand from "./OpponentHand";
import { autoViewSeat } from "./viewSeat";
import "../fight/FightPage.css";
import "./Sandbox.css";

export type SandboxClientSocket = Socket<SandboxServerEvents, SandboxClientEvents>;

const OTHER: Record<Seat, Seat> = { p1: "p2", p2: "p1" };

function finishedLabel(state: SandboxState): string {
  const view = state.views.p1;
  if (view.endReason === "double_ko") return "🤝 Match nul";
  const winner = view.winner === view.me.userId ? "J1" : "J2";
  return `🏆 Victoire de ${winner} (${view.endReason ?? "fin"})`;
}

/** Sandbox de duel : l'admin joue les deux sièges sur un seul écran. */
export default function SandboxPage() {
  const [params] = useSearchParams();
  const scenarioId = Number(params.get("scenario")) || null;
  const queryClient = useQueryClient();

  const [state, setState] = useState<SandboxState | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(scenarioId !== null);
  const [forcedSeat, setForcedSeat] = useState<Seat | null>(null);
  const [showOpponentHand, setShowOpponentHand] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(
    null,
  );
  const socketRef = useRef<SandboxClientSocket | null>(null);
  const scenarioLoadedRef = useRef(false);

  const catalog = useQuery({
    queryKey: QUERY_KEYS.sandbox.catalog,
    queryFn: () => sandboxService.catalog(),
    staleTime: Infinity,
  });

  const seat: Seat = forcedSeat ?? (state ? autoViewSeat(state) : "p1");

  const send = useCallback(
    (action: GameAction) =>
      socketRef.current?.emit("sandbox:action", { seat, action }),
    [seat],
  );
  const controls = useBoardControls(state?.views[seat] ?? null, send);
  const { clearSelection } = controls;

  const sendSetup = (command: SandboxSetupCommand) =>
    socketRef.current?.emit("sandbox:setup", command);

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const socket: SandboxClientSocket = io(
      `${import.meta.env.VITE_API_URL}${SANDBOX_NAMESPACE}`,
      { withCredentials: true, transports: ["websocket"] },
    );
    socketRef.current = socket;

    // Charge le scénario demandé une seule fois, à la première connexion
    // effective (en StrictMode, le premier socket est fermé avant de se connecter).
    socket.on("connect", () => {
      if (scenarioId === null || scenarioLoadedRef.current) return;
      scenarioLoadedRef.current = true;
      socket.emit("sandbox:load", { scenarioId });
    });
    socket.on("sandbox:state", (next) => {
      setState(next);
      setLoadingScenario(false);
      clearSelection();
    });
    socket.on("sandbox:closed", () => {
      setState(null);
      setForcedSeat(null);
    });
    socket.on("sandbox:saved", () => {
      showToast("💾 Scénario sauvegardé");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sandbox.scenarios });
    });
    socket.on("sandbox:error", ({ message }) => {
      setLoadingScenario(false);
      showToast(message, "err");
    });

    return () => {
      socket.disconnect();
    };
  }, [scenarioId, clearSelection, showToast, queryClient]);

  const toastNode = toast && (
    <div className={`sb-toast${toast.type === "err" ? " sb-toast--err" : ""}`}>
      {toast.msg}
    </div>
  );

  if (!state) {
    if (loadingScenario || catalog.isLoading)
      return <Loading message="Préparation du sandbox…" />;
    return (
      <div className="sb-page">
        {toastNode}
        <Link to="/admin">← Retour à l'admin</Link>
        <SandboxSetup
          catalog={catalog.data ?? []}
          onStart={(payload) => socketRef.current?.emit("sandbox:create", payload)}
        />
      </div>
    );
  }

  const view = state.views[seat];
  const other = state.views[OTHER[seat]];

  return (
    <div className="sb-page">
      {toastNode}
      <SandboxToolbar
        seat={seat}
        forcedSeat={forcedSeat}
        onForceSeat={setForcedSeat}
        showOpponentHand={showOpponentHand}
        onToggleOpponentHand={() => setShowOpponentHand((v) => !v)}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onUndo={() => socketRef.current?.emit("sandbox:undo")}
        onRedo={() => socketRef.current?.emit("sandbox:redo")}
        onSave={(name, description) =>
          socketRef.current?.emit("sandbox:save", { name, description })
        }
        onClose={() => socketRef.current?.emit("sandbox:close")}
      />
      {view.phase === "finished" && (
        <div className="sb-banner">{finishedLabel(state)}</div>
      )}

      <div className="sb-layout">
        <div>
          {view.phase === "mulligan" ? (
            <MulliganPanel
              hand={view.me.hand}
              decided={view.me.mulliganDone}
              opponentDecided={view.opponent.mulliganDone}
              opponentName={view.opponent.username}
              onDecide={controls.decideMulligan}
            />
          ) : (
            <FightBoard gs={view} {...controls.board} timeLeft={null} />
          )}
          {view.pendingChoice && (
            <CardPickModal
              choice={view.pendingChoice}
              onConfirm={controls.pickCards}
            />
          )}
        </div>
        <aside className="sb-side">
          {showOpponentHand && (
            <OpponentHand cards={other.me.hand} name={other.me.username} />
          )}
        </aside>
      </div>
    </div>
  );
}
```

> Avec le timer activé, le plateau n'affiche pas de compte à rebours : le serveur fait avancer la phase au bout de 90 s. C'est voulu, le timer sert surtout à tester le timeout.

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/unit/viewSeat.test.ts src/__tests__/components/SandboxToolbar.test.tsx`
Expected: PASS (6 tests).

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/sandbox apps/frontend/src/__tests__/unit/viewSeat.test.ts apps/frontend/src/__tests__/components/SandboxToolbar.test.tsx
git commit -m "feat(sandbox): play both seats on one screen with undo, redo and save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Front — panneau deck (pioches) et outils de mise en place

**Files:**
- Create: `apps/frontend/src/features/sandbox/DeckPanel.tsx`
- Create: `apps/frontend/src/features/sandbox/SetupDrawer.tsx`
- Modify: `apps/frontend/src/features/sandbox/SandboxPage.tsx` (colonne latérale)
- Test: `apps/frontend/src/__tests__/components/DeckPanel.test.tsx`
- Test: `apps/frontend/src/__tests__/components/SetupDrawer.test.tsx`

**Interfaces:**
- Consumes : `SandboxSetupCommand`, `SandboxDestination`, `SandboxState` (Task 1), `sendSetup` (Task 10).
- Produces :
  - `<DeckPanel seat deck hand onCommand />`, où `onCommand: (command: SandboxSetupCommand) => void` ;
  - `<SetupDrawer state={SandboxState} seat={Seat} onCommand />`.

- [ ] **Step 1: Tests (ils échouent)**

`apps/frontend/src/__tests__/components/DeckPanel.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CardInstance } from "@pipou/shared";
import DeckPanel from "../../features/sandbox/DeckPanel";

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

function renderPanel() {
  const onCommand = vi.fn();
  render(
    <DeckPanel
      seat="p2"
      deck={[card("A"), card("B"), card("C")]}
      hand={[card("Main1")]}
      onCommand={onCommand}
    />,
  );
  return onCommand;
}

describe("DeckPanel", () => {
  it("remonte une carte en prochaine pioche", async () => {
    const onCommand = renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "Mettre C en prochaine pioche" }),
    );

    expect(onCommand).toHaveBeenCalledWith({
      type: "move_card",
      seat: "p2",
      instanceId: "C",
      to: { zone: "deck", index: 0 },
    });
  });

  it("prend une carte du deck en main, et remet une carte de la main sur le deck", async () => {
    const onCommand = renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "Prendre B en main" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remettre Main1 sur le deck" }),
    );

    expect(onCommand).toHaveBeenNthCalledWith(1, {
      type: "move_card",
      seat: "p2",
      instanceId: "B",
      to: { zone: "hand" },
    });
    expect(onCommand).toHaveBeenNthCalledWith(2, {
      type: "move_card",
      seat: "p2",
      instanceId: "Main1",
      to: { zone: "deck", index: 0 },
    });
  });

  it("réordonne le deck par glisser-déposer", () => {
    const onCommand = renderPanel();
    const deck = screen.getByRole("list", { name: "Deck dans l'ordre de pioche" });
    const [a, , c] = within(deck).getAllByRole("listitem");

    fireEvent.dragStart(a);
    fireEvent.dragOver(c);
    fireEvent.drop(c);

    expect(onCommand).toHaveBeenCalledWith({
      type: "move_card",
      seat: "p2",
      instanceId: "A",
      to: { zone: "deck", index: 2 },
    });
  });
});
```

`apps/frontend/src/__tests__/components/SetupDrawer.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SandboxState } from "@pipou/shared";
import SetupDrawer from "../../features/sandbox/SetupDrawer";

const base = (name: string) => ({
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
});

const monster = {
  instanceId: "m1",
  card: { instanceId: "m1", ownerId: 1, baseCard: base("Gobelin") },
  currentHp: 500,
  mode: "attack",
  equipments: [],
  perm: {
    atk: 0,
    hp: 0,
    taunt: false,
    piercing: false,
    debuffImmune: false,
    attacksPerTurn: 1,
  },
  attacksPerTurn: 1,
  summonedThisTurn: false,
};

const state = {
  views: {
    p1: {
      phase: "main",
      turnNumber: 3,
      isMyTurn: true,
      me: {
        username: "Admin (J1)",
        primes: 6,
        recycleEnergy: 0,
        hand: [{ instanceId: "h1", ownerId: 1, baseCard: base("Ogre") }],
        monsterZones: [monster, null, null],
        supportZones: [null, null, null],
      },
    },
    p2: {
      phase: "main",
      turnNumber: 3,
      isMyTurn: false,
      me: {
        username: "Admin (J2)",
        primes: 6,
        recycleEnergy: 0,
        hand: [],
        monsterZones: [null, null, null],
        supportZones: [null, null, null],
      },
    },
  },
  decks: { p1: [], p2: [] },
  canUndo: false,
  canRedo: false,
  timer: false,
} as unknown as SandboxState;

describe("SetupDrawer", () => {
  it("pose une carte de la main sur une zone monstre, sans coût", async () => {
    const onCommand = vi.fn();
    render(<SetupDrawer state={state} seat="p1" onCommand={onCommand} />);

    await userEvent.selectOptions(screen.getByLabelText("Carte"), "h1");
    await userEvent.selectOptions(screen.getByLabelText("Vers"), "monster:1");
    await userEvent.click(screen.getByRole("button", { name: "Placer" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "move_card",
      seat: "p1",
      instanceId: "h1",
      to: { zone: "monster", index: 1, mode: "attack" },
    });
  });

  it("modifie les PV et le bonus d'ATK d'un monstre", async () => {
    const onCommand = vi.fn();
    render(<SetupDrawer state={state} seat="p1" onCommand={onCommand} />);

    await userEvent.selectOptions(screen.getByLabelText("Monstre"), "p1:m1");
    const hp = screen.getByLabelText("PV actuels");
    await userEvent.clear(hp);
    await userEvent.type(hp, "120");
    const atk = screen.getByLabelText("Bonus ATK");
    await userEvent.clear(atk);
    await userEvent.type(atk, "300");
    await userEvent.click(screen.getByRole("button", { name: "Appliquer au monstre" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "edit_monster",
      seat: "p1",
      instanceId: "m1",
      patch: expect.objectContaining({ currentHp: 120, atkBonus: 300 }),
    });
  });

  it("change le joueur actif et la phase", async () => {
    const onCommand = vi.fn();
    render(<SetupDrawer state={state} seat="p1" onCommand={onCommand} />);

    await userEvent.selectOptions(screen.getByLabelText("Joueur actif"), "p2");
    await userEvent.selectOptions(screen.getByLabelText("Phase"), "battle");
    await userEvent.click(screen.getByRole("button", { name: "Appliquer à la partie" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "edit_game",
      patch: { phase: "battle", turnNumber: 3, activeSeat: "p2" },
    });
  });
});
```

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/DeckPanel.test.tsx src/__tests__/components/SetupDrawer.test.tsx`
Expected: FAIL (modules introuvables).

- [ ] **Step 2: Panneau deck**

`apps/frontend/src/features/sandbox/DeckPanel.tsx` :

```tsx
import { useState } from "react";
import type {
  CardInstance,
  SandboxDestination,
  SandboxSetupCommand,
  Seat,
} from "@pipou/shared";
import Button from "../../components/Button";

interface Props {
  seat: Seat;
  /** Deck dans l'ordre de pioche (index 0 = prochaine carte). */
  deck: CardInstance[];
  hand: CardInstance[];
  onCommand: (command: SandboxSetupCommand) => void;
}

/** Ordre des pioches : remonter, réordonner, échanger avec la main. */
export default function DeckPanel({ seat, deck, hand, onCommand }: Props) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const move = (instanceId: string, to: SandboxDestination) =>
    onCommand({ type: "move_card", seat, instanceId, to });

  return (
    <section className="sb-panel" aria-label="Deck">
      <h3>📚 Deck ({deck.length})</h3>
      <ol className="sb-cardlist" aria-label="Deck dans l'ordre de pioche">
        {deck.map((c, index) => (
          <li
            key={c.instanceId}
            className={`sb-cardrow sb-cardrow--drag${over === index ? " sb-cardrow--over" : ""}`}
            draggable
            onDragStart={() => setDragged(c.instanceId)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(index);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragged && dragged !== c.instanceId)
                move(dragged, { zone: "deck", index });
              setDragged(null);
              setOver(null);
            }}
          >
            <span>{index + 1}.</span>
            <span className="sb-cardrow__name">{c.baseCard.name}</span>
            {index > 0 && (
              <Button
                size="icon"
                variant="ghost-gold"
                aria-label={`Mettre ${c.baseCard.name} en prochaine pioche`}
                onClick={() => move(c.instanceId, { zone: "deck", index: 0 })}
              >
                ⬆
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost-gold"
              aria-label={`Prendre ${c.baseCard.name} en main`}
              onClick={() => move(c.instanceId, { zone: "hand" })}
            >
              🖐
            </Button>
          </li>
        ))}
      </ol>

      <h3>🖐 Main ({hand.length})</h3>
      <ul className="sb-cardlist">
        {hand.map((c) => (
          <li key={c.instanceId} className="sb-cardrow">
            <span className="sb-cardrow__name">{c.baseCard.name}</span>
            <Button
              size="icon"
              variant="ghost-gold"
              aria-label={`Remettre ${c.baseCard.name} sur le deck`}
              onClick={() => move(c.instanceId, { zone: "deck", index: 0 })}
            >
              📚
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Outils de mise en place**

`apps/frontend/src/features/sandbox/SetupDrawer.tsx` :

```tsx
import { useId, useState } from "react";
import type {
  CardInstance,
  CombatMode,
  GamePhase,
  MonsterOnBoard,
  SandboxDestination,
  SandboxMonsterPatch,
  SandboxSetupCommand,
  SandboxState,
  Seat,
} from "@pipou/shared";
import Button from "../../components/Button";

type OnCommand = (command: SandboxSetupCommand) => void;

const SEAT_LABEL: Record<Seat, string> = { p1: "J1", p2: "J2" };
const PHASES: GamePhase[] = ["main", "battle", "end"];

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </>
  );
}

/** Destination encodée dans une option de <select> : "hand", "monster:1"… */
function parseDestination(
  value: string,
  mode: CombatMode,
): SandboxDestination | null {
  const [zone, arg] = value.split(":");
  if (zone === "hand") return { zone: "hand" };
  if (zone === "graveyard") return { zone: "graveyard" };
  if (zone === "deck") return { zone: "deck", index: 0 };
  if (zone === "monster") return { zone: "monster", index: Number(arg), mode };
  if (zone === "support") return { zone: "support", index: Number(arg) };
  if (zone === "equipment") return { zone: "equipment", hostInstanceId: arg };
  return null;
}

/** Poser une carte de la main ou du deck n'importe où, sans coût ni effet. */
function PlaceCardForm({
  seat,
  hand,
  deck,
  monsters,
  supportCount,
  onCommand,
}: {
  seat: Seat;
  hand: CardInstance[];
  deck: CardInstance[];
  monsters: (MonsterOnBoard | null)[];
  supportCount: number;
  onCommand: OnCommand;
}) {
  const [instanceId, setInstanceId] = useState("");
  const [destination, setDestination] = useState(() => {
    const free = monsters.findIndex((m) => m === null);
    return free >= 0 ? `monster:${free}` : "hand";
  });
  const [mode, setMode] = useState<CombatMode>("attack");

  const place = () => {
    const to = parseDestination(destination, mode);
    if (instanceId && to)
      onCommand({ type: "move_card", seat, instanceId, to });
  };

  return (
    <div className="sb-form">
      <label htmlFor="sb-place-card">Carte</label>
      <select
        id="sb-place-card"
        value={instanceId}
        onChange={(e) => setInstanceId(e.target.value)}
      >
        <option value="">— choisir —</option>
        <optgroup label="Main">
          {hand.map((c) => (
            <option key={c.instanceId} value={c.instanceId}>
              {c.baseCard.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Deck">
          {deck.map((c, i) => (
            <option key={c.instanceId} value={c.instanceId}>
              {i + 1}. {c.baseCard.name}
            </option>
          ))}
        </optgroup>
      </select>

      <label htmlFor="sb-place-to">Vers</label>
      <select
        id="sb-place-to"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      >
        {monsters.map((m, i) => (
          <option key={`m${i}`} value={`monster:${i}`} disabled={m !== null}>
            Zone monstre {i + 1}
          </option>
        ))}
        {Array.from({ length: supportCount }, (_, i) => (
          <option key={`s${i}`} value={`support:${i}`}>
            Zone support {i + 1}
          </option>
        ))}
        {monsters.map(
          (m) =>
            m && (
              <option key={`e${m.instanceId}`} value={`equipment:${m.instanceId}`}>
                Équiper sur {m.card.baseCard.name}
              </option>
            ),
        )}
        <option value="hand">Main</option>
        <option value="deck">Dessus du deck</option>
        <option value="graveyard">Cimetière</option>
      </select>

      <label htmlFor="sb-place-mode">Mode</label>
      <select
        id="sb-place-mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as CombatMode)}
      >
        <option value="attack">Attaque</option>
        <option value="guard">Garde</option>
      </select>

      <span />
      <Button size="sm" disabled={!instanceId} onClick={place}>
        Placer
      </Button>
    </div>
  );
}

function initialPatch(m: MonsterOnBoard): Required<
  Pick<
    SandboxMonsterPatch,
    | "currentHp"
    | "atkBonus"
    | "hpBonus"
    | "attacksPerTurn"
    | "mode"
    | "taunt"
    | "piercing"
    | "summonedThisTurn"
  >
> & { blockAttackTurns: number } {
  return {
    currentHp: m.currentHp,
    atkBonus: m.perm.atk,
    hpBonus: m.perm.hp,
    attacksPerTurn: m.perm.attacksPerTurn,
    mode: m.mode,
    taunt: m.perm.taunt,
    piercing: m.perm.piercing,
    summonedThisTurn: m.summonedThisTurn,
    blockAttackTurns: m.blockAttackTurns ?? 0,
  };
}

/** Valeurs d'un monstre posé ; remonté (key) à chaque changement de monstre. */
function MonsterForm({
  seat,
  monster,
  onCommand,
}: {
  seat: Seat;
  monster: MonsterOnBoard;
  onCommand: OnCommand;
}) {
  const [patch, setPatch] = useState(() => initialPatch(monster));
  const set = <K extends keyof typeof patch>(key: K, value: (typeof patch)[K]) =>
    setPatch((p) => ({ ...p, [key]: value }));

  return (
    <div className="sb-form">
      <NumberField label="PV actuels" value={patch.currentHp} onChange={(v) => set("currentHp", v)} />
      <NumberField label="Bonus ATK" value={patch.atkBonus} onChange={(v) => set("atkBonus", v)} />
      <NumberField label="Bonus PV max" value={patch.hpBonus} onChange={(v) => set("hpBonus", v)} />
      <NumberField label="Attaques par tour" value={patch.attacksPerTurn} onChange={(v) => set("attacksPerTurn", v)} />
      <NumberField label="Tours de gel" value={patch.blockAttackTurns} onChange={(v) => set("blockAttackTurns", v)} />
      <label htmlFor="sb-monster-mode">Mode</label>
      <select
        id="sb-monster-mode"
        value={patch.mode}
        onChange={(e) => set("mode", e.target.value as CombatMode)}
      >
        <option value="attack">Attaque</option>
        <option value="guard">Garde</option>
      </select>
      {(
        [
          ["taunt", "Provocation"],
          ["piercing", "Perçant"],
          ["summonedThisTurn", "Invoqué ce tour"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} style={{ gridColumn: "1 / -1" }}>
          <input
            type="checkbox"
            checked={patch[key]}
            onChange={(e) => set(key, e.target.checked)}
          />{" "}
          {label}
        </label>
      ))}
      <span />
      <Button
        size="sm"
        onClick={() =>
          onCommand({
            type: "edit_monster",
            seat,
            instanceId: monster.instanceId,
            patch: {
              ...patch,
              blockAttackTurns: patch.blockAttackTurns > 0 ? patch.blockAttackTurns : null,
            },
          })
        }
      >
        Appliquer au monstre
      </Button>
    </div>
  );
}

/** Primes et énergie de chaque joueur, phase, tour et joueur actif. */
function GameForm({ state, onCommand }: { state: SandboxState; onCommand: OnCommand }) {
  const p1 = state.views.p1;
  const [players, setPlayers] = useState({
    p1: { primes: p1.me.primes, recycleEnergy: p1.me.recycleEnergy },
    p2: {
      primes: state.views.p2.me.primes,
      recycleEnergy: state.views.p2.me.recycleEnergy,
    },
  });
  const [phase, setPhase] = useState<GamePhase>(p1.phase);
  const [turnNumber, setTurnNumber] = useState(p1.turnNumber);
  const [activeSeat, setActiveSeat] = useState<Seat>(p1.isMyTurn ? "p1" : "p2");

  return (
    <div className="sb-form">
      {(["p1", "p2"] as const).map((s) => (
        <PlayerFields
          key={s}
          seat={s}
          value={players[s]}
          onChange={(v) => setPlayers((p) => ({ ...p, [s]: v }))}
          onApply={() => onCommand({ type: "edit_player", seat: s, patch: players[s] })}
        />
      ))}
      <label htmlFor="sb-game-active">Joueur actif</label>
      <select
        id="sb-game-active"
        value={activeSeat}
        onChange={(e) => setActiveSeat(e.target.value as Seat)}
      >
        <option value="p1">J1</option>
        <option value="p2">J2</option>
      </select>
      <label htmlFor="sb-game-phase">Phase</label>
      <select
        id="sb-game-phase"
        value={phase}
        onChange={(e) => setPhase(e.target.value as GamePhase)}
      >
        {PHASES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <NumberField label="Tour" value={turnNumber} onChange={setTurnNumber} />
      <span />
      <Button
        size="sm"
        onClick={() =>
          onCommand({ type: "edit_game", patch: { phase, turnNumber, activeSeat } })
        }
      >
        Appliquer à la partie
      </Button>
    </div>
  );
}

function PlayerFields({
  seat,
  value,
  onChange,
  onApply,
}: {
  seat: Seat;
  value: { primes: number; recycleEnergy: number };
  onChange: (value: { primes: number; recycleEnergy: number }) => void;
  onApply: () => void;
}) {
  return (
    <>
      <NumberField
        label={`Primes ${SEAT_LABEL[seat]}`}
        value={value.primes}
        onChange={(primes) => onChange({ ...value, primes })}
      />
      <NumberField
        label={`Énergie ${SEAT_LABEL[seat]}`}
        value={value.recycleEnergy}
        onChange={(recycleEnergy) => onChange({ ...value, recycleEnergy })}
      />
      <span />
      <Button size="sm" variant="ghost-gold" onClick={onApply}>
        Appliquer à {SEAT_LABEL[seat]}
      </Button>
    </>
  );
}

interface Props {
  state: SandboxState;
  /** Siège affiché : la carte posée vient de sa main ou de son deck. */
  seat: Seat;
  onCommand: OnCommand;
}

/** Outils « mode dieu » : aucun effet déclenché, aucun coût. */
export default function SetupDrawer({ state, seat, onCommand }: Props) {
  const [monsterKey, setMonsterKey] = useState("");
  const me = state.views[seat].me;

  const allMonsters = (["p1", "p2"] as const).flatMap((s) =>
    state.views[s].me.monsterZones
      .filter((m): m is MonsterOnBoard => m !== null)
      .map((m) => ({ seat: s, monster: m, key: `${s}:${m.instanceId}` })),
  );
  const selected = allMonsters.find((m) => m.key === monsterKey);

  return (
    <section className="sb-panel" aria-label="Mise en place">
      <h3>🛠 Placer une carte ({SEAT_LABEL[seat]})</h3>
      <PlaceCardForm
        seat={seat}
        hand={me.hand}
        deck={state.decks[seat]}
        monsters={me.monsterZones}
        supportCount={me.supportZones.length}
        onCommand={onCommand}
      />

      <h3>🧬 Modifier un monstre</h3>
      <div className="sb-form">
        <label htmlFor="sb-monster">Monstre</label>
        <select
          id="sb-monster"
          value={monsterKey}
          onChange={(e) => setMonsterKey(e.target.value)}
        >
          <option value="">— choisir —</option>
          {allMonsters.map((m) => (
            <option key={m.key} value={m.key}>
              {SEAT_LABEL[m.seat]} · {m.monster.card.baseCard.name}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <MonsterForm
          key={selected.key}
          seat={selected.seat}
          monster={selected.monster}
          onCommand={onCommand}
        />
      )}

      <h3>🎲 Joueurs et partie</h3>
      <GameForm
        key={`${state.views.p1.turnNumber}-${state.views.p1.phase}-${state.views.p1.isMyTurn}`}
        state={state}
        onCommand={onCommand}
      />
    </section>
  );
}
```

> `GameForm` est remonté (`key`) quand le tour, la phase ou le joueur actif changent. Ses valeurs suivent donc la partie sans `useEffect` de synchronisation. Les primes et l'énergie modifiées mais non appliquées sont perdues à ce moment-là, ce qui est acceptable.

- [ ] **Step 4: Colonne latérale de la page**

Dans `SandboxPage.tsx`, importer `DeckPanel from "./DeckPanel"` et `SetupDrawer from "./SetupDrawer"`. Remplacer ensuite le contenu de `<aside className="sb-side">` par :

```tsx
        <aside className="sb-side">
          <DeckPanel
            seat={seat}
            deck={state.decks[seat]}
            hand={state.views[seat].me.hand}
            onCommand={sendSetup}
          />
          {showOpponentHand && (
            <OpponentHand cards={other.me.hand} name={other.me.username} />
          )}
          <SetupDrawer state={state} seat={seat} onCommand={sendSetup} />
        </aside>
```

- [ ] **Step 5: Vérifier**

Run: `pnpm --filter @pipou/frontend exec vitest run src/__tests__/components/DeckPanel.test.tsx src/__tests__/components/SetupDrawer.test.tsx`
Expected: PASS (6 tests).

Run: `pnpm --filter @pipou/frontend typecheck && pnpm --filter @pipou/frontend lint`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/features/sandbox apps/frontend/src/__tests__/components/DeckPanel.test.tsx apps/frontend/src/__tests__/components/SetupDrawer.test.tsx
git commit -m "feat(sandbox): order draws and set up the board without costs or effects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Vérification complète

**Files:** aucun fichier nouveau (corrections éventuelles uniquement).

- [ ] **Step 1: Suites complètes**

Run: `pnpm build:shared && pnpm typecheck && pnpm lint && pnpm test`
Expected : tout est vert. Les compteurs doivent dépasser ceux de la partie A (shared 34, backend 436, frontend 63).

- [ ] **Step 2: Migration sur la base locale**

Rejouer le Step 4 de la Task 6 sur `pipou_migr` (run, `schema:log`, revert, run). **Jamais avec `apps/backend/.env`.**

- [ ] **Step 3: Test manuel en local**

Le backend tourne sur la base locale (`ENV_FILE=.env.e2e DB_NAME=pipou_migr DB_HOST=127.0.0.1 pnpm dev`) et le front pointe dessus (`VITE_API_URL=http://localhost:3001`). Avec le compte admin local :

1. Admin → onglet **Sandbox** → **Nouveau sandbox**.
2. Composer J1 avec Noyau Alpha, Module .v2 et Firewall .sys, puis compléter jusqu'à 30. Copier vers J2. J2 commence. Lancer.
3. Mulligan : la vue passe sur J2, puis sur J1. Garder les deux mains.
4. Panneau deck : remonter Firewall .sys en prochaine pioche. Finir le tour de J2 et vérifier que J1 pioche Firewall.
5. Placer Noyau Alpha sur une zone monstre (outils), puis équiper Firewall depuis la main en jouant normalement. Vérifier le buff et les 2 attaques.
6. **Annuler** deux fois, puis **Refaire**. L'état doit suivre.
7. **Sauver** « Combo Noyaux ». Fermer, puis recharger depuis l'onglet Sandbox. La main et le plateau doivent être identiques.
8. Tester la sécurité avec le compte `testlocal@example.com`, qui n'est pas admin : `/admin/sandbox` redirige vers l'accueil, et une connexion socket directe au namespace reçoit « Sandbox réservé aux admins ».
9. Lancer un match classé normal et vérifier qu'il fonctionne toujours (sélection, invocation, attaque, abandon), puisque le refactor de la Task 7 touche `FightPage`.
10. Vérifier en BDD locale qu'aucun `match` n'a été créé par le sandbox (`SELECT COUNT(*) FROM \`match\`` avant et après).

- [ ] **Step 4: Commit des corrections éventuelles**

```bash
git add <fichiers corrigés>
git commit -m "fix(sandbox): <correction>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
