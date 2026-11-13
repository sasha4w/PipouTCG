import { BadRequestException } from '@nestjs/common';
import { PuzzleObjectiveType } from '@pipou/shared';
import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { SandboxGateway } from './sandbox.gateway';
import type { SandboxService } from './sandbox.service';
import type { PuzzlesAdminService } from '../puzzles/puzzles-admin.service';
import type { SandboxSocket } from './sandbox-socket.types';

const SECRET = 'secret-de-test-assez-long-pour-hs256';

function setup() {
  const jwt = new JwtService();
  const sandbox = {
    resume: jest.fn(),
    disconnect: jest.fn(),
    snapshot: jest.fn(),
  };
  const puzzlesAdmin = { createFromSandbox: jest.fn() };
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;
  const gateway = new SandboxGateway(
    sandbox as unknown as SandboxService,
    jwt,
    config,
    puzzlesAdmin as unknown as PuzzlesAdminService,
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
  return { gateway, sandbox, puzzlesAdmin, client };
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

  describe('sandbox:save_puzzle', () => {
    const payload = {
      title: 'Défi',
      objective: { type: PuzzleObjectiveType.WIN_GAME },
    };
    const socketOf = (c: ReturnType<ReturnType<typeof setup>['client']>) => {
      c.socket.data.userId = 4;
      c.socket.data.username = 'Admin';
      return c;
    };

    it('enregistre le défi depuis l’état du sandbox', async () => {
      const { gateway, sandbox, puzzlesAdmin, client } = setup();
      const c = socketOf(client());
      sandbox.snapshot.mockReturnValue({ a: 1 });
      puzzlesAdmin.createFromSandbox.mockResolvedValue(9);

      await gateway.savePuzzle(c.socket, payload);

      expect(puzzlesAdmin.createFromSandbox).toHaveBeenCalledWith(
        { userId: 4, username: 'Admin' },
        { a: 1 },
        payload,
      );
      expect(c.emit).toHaveBeenCalledWith('sandbox:puzzle_saved', {
        puzzleId: 9,
      });
    });

    it('renvoie l’erreur de validation au client', async () => {
      const { gateway, sandbox, puzzlesAdmin, client } = setup();
      const c = socketOf(client());
      sandbox.snapshot.mockReturnValue({ a: 1 });
      puzzlesAdmin.createFromSandbox.mockRejectedValue(
        new BadRequestException('Phase KO'),
      );

      await gateway.savePuzzle(c.socket, payload);

      expect(c.emit).toHaveBeenCalledWith('sandbox:error', {
        message: 'Phase KO',
      });
    });

    it('refuse sans sandbox ouvert', async () => {
      const { gateway, sandbox, puzzlesAdmin, client } = setup();
      const c = socketOf(client());
      sandbox.snapshot.mockReturnValue(null);

      await gateway.savePuzzle(c.socket, payload);

      expect(puzzlesAdmin.createFromSandbox).not.toHaveBeenCalled();
      expect(c.emit).toHaveBeenCalledWith('sandbox:error', {
        message: 'Aucun sandbox ouvert',
      });
    });
  });
});
