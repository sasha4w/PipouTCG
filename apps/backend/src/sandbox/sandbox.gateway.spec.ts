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
    } as unknown as SandboxSocket;
    return { socket, emit, disconnect };
  };
  return { gateway, sandbox, client };
}

describe('SandboxGateway', () => {
  it('refuse un joueur qui n’est pas admin', () => {
    const { gateway, sandbox, client } = setup();
    const {
      socket: c,
      emit,
      disconnect,
    } = client({ sub: 2, username: 'Bob', is_admin: false });

    gateway.handleConnection(c);

    expect(emit).toHaveBeenCalledWith('sandbox:error', {
      message: 'Sandbox réservé aux admins',
    });
    expect(disconnect).toHaveBeenCalled();
    expect(sandbox.resume).not.toHaveBeenCalled();
  });

  it('refuse une connexion sans jeton', () => {
    const { gateway, client } = setup();
    const { socket: c, disconnect } = client();

    gateway.handleConnection(c);

    expect(disconnect).toHaveBeenCalled();
  });

  it('un admin retrouve son sandbox en cours', () => {
    const { gateway, sandbox, client } = setup();
    const { socket: c, disconnect } = client({
      sub: 4,
      username: 'Admin',
      is_admin: true,
    });

    gateway.handleConnection(c);

    expect(disconnect).not.toHaveBeenCalled();
    expect(c.data).toMatchObject({
      userId: 4,
      username: 'Admin',
      isAdmin: true,
    });
    expect(sandbox.resume).toHaveBeenCalledWith(4, 'sock', gateway.server);
  });
});
