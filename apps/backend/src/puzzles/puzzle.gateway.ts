import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { GameAction, PuzzleStartPayload } from '@pipou/shared';
import { readSocketUser } from '../fights/socket-auth';
import { PuzzleSessionService } from './puzzle-session.service';
import type { PuzzleServer, PuzzleSocket } from './puzzle-socket.types';

@WebSocketGateway({
  cors: {
    origin: ['https://pipoutcg.netlify.app', 'http://localhost:5173'],
    credentials: true,
  },
  namespace: 'puzzle',
})
export class PuzzleGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly sessions: PuzzleSessionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: PuzzleServer): void {
    this.sessions.bind(server);
  }

  handleConnection(client: PuzzleSocket): void {
    const user = readSocketUser(
      client.handshake.headers.cookie,
      this.jwtService,
      this.configService.getOrThrow<string>('JWT_SECRET'),
      client.handshake.auth?.token,
    );
    if (!user) {
      client.emit('puzzle:error', { message: 'Non authentifié.' });
      client.disconnect();
      return;
    }
    client.data.userId = user.userId;
    client.data.username = user.username;
    client.data.isAdmin = user.isAdmin;
  }

  handleDisconnect(client: PuzzleSocket): void {
    if (client.data.userId) this.sessions.disconnect(client.data.userId);
  }

  @SubscribeMessage('puzzle:start')
  start(
    @ConnectedSocket() client: PuzzleSocket,
    @MessageBody() payload: PuzzleStartPayload | undefined,
  ): Promise<void> {
    return this.guard(client, () =>
      this.sessions.start(
        {
          userId: client.data.userId,
          username: client.data.username,
          isAdmin: client.data.isAdmin,
        },
        client.id,
        payload ?? {},
      ),
    );
  }

  @SubscribeMessage('puzzle:action')
  action(
    @ConnectedSocket() client: PuzzleSocket,
    @MessageBody() action: GameAction,
  ): Promise<void> {
    return this.guard(client, () =>
      this.sessions.act(client.data.userId, action),
    );
  }

  @SubscribeMessage('puzzle:restart')
  restart(@ConnectedSocket() client: PuzzleSocket): Promise<void> {
    return this.guard(client, () => this.sessions.restart(client.data.userId));
  }

  @SubscribeMessage('puzzle:close')
  close(@ConnectedSocket() client: PuzzleSocket): Promise<void> {
    return this.guard(client, () => this.sessions.close(client.data.userId));
  }

  /** Toute erreur de service revient au seul client concerné. */
  private async guard(
    client: PuzzleSocket,
    run: () => void | Promise<void>,
  ): Promise<void> {
    if (!client.data.userId) return;
    try {
      await run();
    } catch (e) {
      client.emit('puzzle:error', {
        message: e instanceof Error ? e.message : 'Erreur inattendue.',
      });
    }
  }
}
