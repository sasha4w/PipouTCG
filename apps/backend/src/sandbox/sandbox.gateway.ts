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
export class SandboxGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
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
