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
import {
  createGameState,
  type SeatEntry,
} from '../fights/helpers/game-factory';
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
    if (missing !== undefined)
      return { error: `Carte #${missing} introuvable` };

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
      return {
        error: err instanceof Error ? err.message : 'Scénario illisible',
      };
    }
    this.open(admin, game, false, server);
    return {};
  }

  /** Reconnexion de l'admin : annule la suppression et renvoie l'état. */
  resume(
    adminUserId: number,
    socketId: string,
    server: SandboxServer,
  ): boolean {
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
    const sb: Sandbox = {
      admin: { ...admin },
      game,
      undo: [],
      redo: [],
      timer,
    };
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
