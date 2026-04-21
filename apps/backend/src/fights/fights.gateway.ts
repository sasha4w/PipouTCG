import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FightsService } from './fights.service';

// ─── Payload shapes received from client ─────────────────────────────────────

interface SubmitDeckPayload {
  matchId: number;
  deckId: number;
}

interface EndPhasePayload {
  matchId: number;
}

interface SummonPayload {
  matchId: number;
  /** Index of the monster in the player's hand. */
  handIndex: number;
  /** Board zone to place the monster (0-2). */
  zoneIndex: number;
  /** Indices in hand used as cost payment (excluding the monster itself). */
  paymentHandIndices: number[];
}

interface PlaySupportPayload {
  matchId: number;
  handIndex: number;
  /** For Terrain: zone index (0-2). */
  zoneIndex?: number;
  /** For Equipment: target monster instanceId. */
  targetInstanceId?: string;
}

interface RecycleSupportPayload {
  matchId: number;
  zoneIndex: number;
}

interface ChangeModePayload {
  matchId: number;
  instanceId: string;
  mode: 'attack' | 'guard';
}

interface AttackPayload {
  matchId: number;
  attackerInstanceId: string;
  /** Omit for direct attack. */
  targetInstanceId?: string;
  direct?: boolean;
}

interface DiscardPayload {
  matchId: number;
  handIndex: number;
}

// ─────────────────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin: ['https://pipoutcg.netlify.app', 'http://localhost:5173'],
    credentials: true,
  },
  namespace: 'fight',
})
export class FightsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly fightsService: FightsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  handleConnection(client: Socket): void {
    try {
      const cookies = client.handshake.headers.cookie;

      if (!cookies) throw new Error('No cookies');

      const token = cookies
        .split(';')
        .find((c) => c.trim().startsWith('token='))
        ?.split('=')[1];

      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<{
        sub: number;
        username: string;
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.username = payload.username;
    } catch (err) {
      if (err instanceof Error) {
        console.error('WS auth error:', err.message);
      } else {
        console.error('WS auth error:', err);
      }

      client.emit('fight:error', { message: 'Authentification invalide' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    if (client.data.userId) {
      await this.fightsService.handleDisconnect(
        client.data.userId,
        this.server,
      );
    }
  }

  // ── Matchmaking ────────────────────────────────────────────────────────────

  /** Enter the matchmaking queue. */
  @SubscribeMessage('fight:queue')
  async joinQueue(@ConnectedSocket() client: Socket): Promise<void> {
    const match = await this.fightsService.joinQueue(
      client.data.userId,
      client.data.username,
      client.id,
      this.server,
    );

    if (!match) {
      client.emit('fight:queued', { message: "En attente d'un adversaire…" });
      return;
    }

    // Notify both players
    this.server.to(match.p1.socketId).emit('fight:matched', {
      matchId: match.matchId,
      opponentName: match.p2.username,
    });
    this.server.to(match.p2.socketId).emit('fight:matched', {
      matchId: match.matchId,
      opponentName: match.p1.username,
    });
  }

  /** Leave the matchmaking queue without starting a game. */
  @SubscribeMessage('fight:dequeue')
  leaveQueue(@ConnectedSocket() client: Socket): void {
    this.fightsService.leaveQueue(client.data.userId);
    client.emit('fight:dequeued');
  }

  // ── Deck submission ────────────────────────────────────────────────────────

  @SubscribeMessage('fight:submit_deck')
  async submitDeck(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubmitDeckPayload,
  ): Promise<void> {
    const result = await this.fightsService.submitDeck(
      data.matchId,
      client.data.userId,
      data.deckId,
      this.server,
    );
    if (result.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  // ── Phase management ───────────────────────────────────────────────────────

  @SubscribeMessage('fight:end_phase')
  async endPhase(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: EndPhasePayload,
  ): Promise<void> {
    const result = await this.fightsService.endPhase(
      data.matchId,
      client.data.userId,
      this.server,
    );
    if (result?.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  // ── Main phase actions ─────────────────────────────────────────────────────

  @SubscribeMessage('fight:summon')
  async summonMonster(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SummonPayload,
  ): Promise<void> {
    const result = await this.fightsService.summonMonster(
      data.matchId,
      client.data.userId,
      data.handIndex,
      data.zoneIndex,
      data.paymentHandIndices ?? [],
      this.server,
    );
    if (result?.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  @SubscribeMessage('fight:play_support')
  async playSupport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlaySupportPayload,
  ): Promise<void> {
    const result = await this.fightsService.playSupport(
      data.matchId,
      client.data.userId,
      data.handIndex,
      data.zoneIndex,
      data.targetInstanceId,
      this.server,
    );
    if (result?.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  @SubscribeMessage('fight:recycle_support')
  async recycleSupport(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RecycleSupportPayload,
  ): Promise<void> {
    const result = await this.fightsService.recycleSupport(
      data.matchId,
      client.data.userId,
      data.zoneIndex,
      this.server,
    );
    if (result?.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  @SubscribeMessage('fight:change_mode')
  async changeMode(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ChangeModePayload,
  ): Promise<void> {
    const result = await this.fightsService.changeMode(
      data.matchId,
      client.data.userId,
      data.instanceId,
      data.mode,
      this.server,
    );
    if (result?.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  // ── Battle phase ───────────────────────────────────────────────────────────

  @SubscribeMessage('fight:attack')
  async attack(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AttackPayload,
  ): Promise<void> {
    const result = await this.fightsService.attack(
      data.matchId,
      client.data.userId,
      data.attackerInstanceId,
      data.targetInstanceId,
      data.direct ?? false,
      this.server,
    );
    if (result?.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  // ── End phase ──────────────────────────────────────────────────────────────

  @SubscribeMessage('fight:discard')
  async discard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DiscardPayload,
  ): Promise<void> {
    const result = await this.fightsService.discard(
      data.matchId,
      client.data.userId,
      data.handIndex,
      this.server,
    );
    if (result?.error) {
      client.emit('fight:error', { message: result.error });
    }
  }

  // ── Surrender ──────────────────────────────────────────────────────────────

  @SubscribeMessage('fight:surrender')
  async surrender(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { matchId: number },
  ): Promise<void> {
    await this.fightsService.surrender(
      data.matchId,
      client.data.userId,
      this.server,
    );
  }
}
