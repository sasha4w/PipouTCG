import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type {
  AttackPayload,
  ChangeModePayload,
  DiscardPayload,
  GameAction,
  MatchPayload,
  MulliganPayload,
  PickCardsPayload,
  PlaySupportPayload,
  RecycleSupportPayload,
  SubmitDeckPayload,
  SummonPayload,
} from '@pipou/shared';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FightsService } from './fights.service';
import * as cookie from 'cookie';
import type { FightServer, FightSocket } from './fight-socket.types';

@WebSocketGateway({
  cors: {
    origin: ['https://pipoutcg.netlify.app', 'http://localhost:5173'],
    credentials: true,
  },
  namespace: 'fight',
})
export class FightsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: FightServer;

  constructor(
    private readonly fightsService: FightsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  handleConnection(client: FightSocket): void {
    try {
      const rawCookies = client.handshake.headers.cookie ?? '';
      const cookies = cookie.parse(rawCookies);
      const token = cookies['token'];

      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<{
        sub: number;
        username: string;
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      client.data.userId = Number(payload.sub);
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

  async handleDisconnect(client: FightSocket): Promise<void> {
    if (client.data.userId) {
      await this.fightsService.handleDisconnect(
        client.data.userId,
        this.server,
      );
    }
  }

  // ── Matchmaking ────────────────────────────────────────────────────────────

  @SubscribeMessage('fight:queue')
  async joinQueue(@ConnectedSocket() client: FightSocket): Promise<void> {
    const match = await this.fightsService.joinQueue(
      client.data.userId,
      client.data.username,
      client.id,
    );

    if (!match) {
      client.emit('fight:queued', { message: "En attente d'un adversaire…" });
      return;
    }

    this.server.to(match.p1.socketId).emit('fight:matched', {
      matchId: match.matchId,
      opponentName: match.p2.username,
    });
    this.server.to(match.p2.socketId).emit('fight:matched', {
      matchId: match.matchId,
      opponentName: match.p1.username,
    });
  }

  @SubscribeMessage('fight:dequeue')
  leaveQueue(@ConnectedSocket() client: FightSocket): void {
    this.fightsService.leaveQueue(client.data.userId);
    client.emit('fight:dequeued');
  }

  // ── Deck submission ────────────────────────────────────────────────────────

  @SubscribeMessage('fight:submit_deck')
  async submitDeck(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: SubmitDeckPayload,
  ): Promise<void> {
    this.reply(
      client,
      await this.fightsService.submitDeck(
        data.matchId,
        client.data.userId,
        data.deckId,
        this.server,
      ),
    );
  }

  // ── Actions de jeu ─────────────────────────────────────────────────────────

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

  @SubscribeMessage('fight:end_phase')
  async endPhase(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: MatchPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, { type: 'end_phase' });
  }

  @SubscribeMessage('fight:summon')
  async summonMonster(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: SummonPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'summon',
      handIndex: data.handIndex,
      zoneIndex: data.zoneIndex,
      paymentHandIndices: data.paymentHandIndices ?? [],
    });
  }

  /** Invoque Noyau Zeta sur une zone adverse vide */
  @SubscribeMessage('fight:summon_opponent')
  async summonZetaOnOpponent(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: SummonPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'summon',
      handIndex: data.handIndex,
      zoneIndex: data.zoneIndex,
      paymentHandIndices: data.paymentHandIndices ?? [],
      onOpponentSide: true,
    });
  }

  @SubscribeMessage('fight:play_support')
  async playSupport(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: PlaySupportPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'play_support',
      handIndex: data.handIndex,
      zoneIndex: data.zoneIndex,
      targetInstanceId: data.targetInstanceId,
    });
  }

  @SubscribeMessage('fight:recycle_support')
  async recycleFromHand(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: RecycleSupportPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'recycle',
      handIndex: data.handIndex,
    });
  }

  @SubscribeMessage('fight:change_mode')
  async changeMode(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: ChangeModePayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'change_mode',
      instanceId: data.instanceId,
      mode: data.mode,
    });
  }

  @SubscribeMessage('fight:attack')
  async attack(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: AttackPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'attack',
      attackerInstanceId: data.attackerInstanceId,
      targetInstanceId: data.targetInstanceId,
      direct: data.direct ?? false,
    });
  }

  @SubscribeMessage('fight:discard')
  async discard(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: DiscardPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'discard',
      handIndex: data.handIndex,
    });
  }

  @SubscribeMessage('fight:pick_cards')
  async pickCards(
    @ConnectedSocket() client: FightSocket,
    @MessageBody() data: PickCardsPayload,
  ): Promise<void> {
    await this.play(client, data.matchId, {
      type: 'pick_cards',
      instanceIds: data.instanceIds,
    });
  }

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
}
