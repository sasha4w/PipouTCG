import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { PuzzleGateway } from './puzzle.gateway';
import type { PuzzleSessionService } from './puzzle-session.service';
import type { PuzzleSocket } from './puzzle-socket.types';

const SECRET = 'secret-de-test-assez-long-pour-hs256';

function setup() {
  const jwt = new JwtService();
  const sessions = {
    bind: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    act: jest.fn().mockResolvedValue(undefined),
    restart: jest.fn(),
    close: jest.fn(),
    disconnect: jest.fn(),
  };
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;
  const gateway = new PuzzleGateway(
    sessions as unknown as PuzzleSessionService,
    jwt,
    config,
  );
  const client = (payload?: object) => {
    const emit = jest.fn();
    const disconnect = jest.fn();
    const socket = {
      id: 'sock',
      handshake: {
        headers: {
          cookie: payload
            ? `token=${jwt.sign(payload, { secret: SECRET })}`
            : undefined,
        },
      },
      data: {},
      emit,
      disconnect,
    } as unknown as PuzzleSocket;
    return { socket, emit, disconnect };
  };
  return { gateway, sessions, client };
}

describe('PuzzleGateway', () => {
  it('connexion sans jeton : déconnecte', () => {
    const { gateway, client } = setup();
    const { socket, disconnect } = client();
    gateway.handleConnection(socket);
    expect(disconnect).toHaveBeenCalled();
  });

  it('accepte un joueur non admin', () => {
    const { gateway, client } = setup();
    const { socket, disconnect } = client({ sub: 4, username: 'Bob' });
    gateway.handleConnection(socket);
    expect(disconnect).not.toHaveBeenCalled();
    expect(socket.data).toMatchObject({ userId: 4, isAdmin: false });
  });

  it('afterInit lie le serveur à la session', () => {
    const { gateway, sessions } = setup();
    const server = {} as never;
    gateway.afterInit(server);
    expect(sessions.bind).toHaveBeenCalledWith(server);
  });

  it('start transmet utilisateur, socket et payload', async () => {
    const { gateway, sessions, client } = setup();
    const { socket } = client({ sub: 4, username: 'Bob', is_admin: true });
    gateway.handleConnection(socket);
    await gateway.start(socket, { puzzleId: 2 });
    expect(sessions.start).toHaveBeenCalledWith(
      { userId: 4, username: 'Bob', isAdmin: true },
      'sock',
      { puzzleId: 2 },
    );
  });

  it('erreur de service : puzzle:error', async () => {
    const { gateway, sessions, client } = setup();
    sessions.act.mockRejectedValue(new Error('Boum'));
    const { socket, emit } = client({ sub: 4, username: 'Bob' });
    gateway.handleConnection(socket);
    await gateway.action(socket, { type: 'end_phase' });
    expect(emit).toHaveBeenCalledWith('puzzle:error', { message: 'Boum' });
  });

  it('erreur synchrone (restart) : puzzle:error', async () => {
    const { gateway, sessions, client } = setup();
    sessions.restart.mockImplementation(() => {
      throw new Error('Aucun défi en cours.');
    });
    const { socket, emit } = client({ sub: 4, username: 'Bob' });
    gateway.handleConnection(socket);
    await gateway.restart(socket);
    expect(emit).toHaveBeenCalledWith('puzzle:error', {
      message: 'Aucun défi en cours.',
    });
  });

  it('déconnexion : prévient la session', () => {
    const { gateway, sessions, client } = setup();
    const { socket } = client({ sub: 4, username: 'Bob' });
    gateway.handleConnection(socket);
    gateway.handleDisconnect(socket);
    expect(sessions.disconnect).toHaveBeenCalledWith(4);
  });
});
