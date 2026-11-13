import { PuzzleObjectiveType } from '@pipou/shared';
import type { PuzzleObjective, PuzzleState } from '@pipou/shared';
import { createEngine } from '../fights/testing/engine';
import { P1_ID } from '../fights/testing/scenario';
import type { GameState } from '../fights/interfaces/game-state.interface';
import { PuzzleSessionService } from './puzzle-session.service';
import type { PuzzleServer } from './puzzle-socket.types';
import type { PuzzlesService } from './puzzles.service';
import { attackScenario, attackWall } from './testing/attack-scenario';

/** Passe en combat puis attaque le « Mur » (la fixture démarre en phase principale). */
async function attackTurn(
  service: PuzzleSessionService,
  userId: number,
  game: GameState,
) {
  await service.act(userId, { type: 'end_phase' });
  await service.act(userId, attackWall(game));
}

const USER = { userId: P1_ID, username: 'Alice', isAdmin: false };
const ADMIN = { ...USER, isAdmin: true };

function setup(
  opts: {
    game?: GameState;
    objective?: PuzzleObjective;
    today?: { id: number } | null;
  } = {},
) {
  const game = opts.game ?? attackScenario({ phase: 'main' });
  const objective: PuzzleObjective = opts.objective ?? {
    type: PuzzleObjectiveType.CLEAR_ENEMY_BOARD,
  };
  const puzzles = {
    today: jest.fn().mockResolvedValue({
      date: '2026-11-13',
      puzzle: opts.today === undefined ? { id: 5 } : opts.today,
    }),
    load: jest.fn().mockImplementation(() =>
      Promise.resolve({
        puzzle: { id: 5, seed: 7 },
        objective,
        game: structuredClone(game),
      }),
    ),
    objectiveView: jest.fn().mockReturnValue({ type: objective.type }),
    completeToday: jest.fn().mockResolvedValue({
      firstSolve: true,
      gold: 100,
      xp: 50,
      booster: false,
      streak: { current: 1, best: 1 },
    }),
  };
  // Socket.io sérialise à l'émission : on fige l'état comme le ferait le réseau.
  const emit = jest.fn((event: string, payload: unknown) => {
    frozen.push([event, JSON.parse(JSON.stringify(payload ?? null))]);
  });
  const frozen: [string, unknown][] = [];
  const server = { to: jest.fn().mockReturnValue({ emit }) };
  const service = new PuzzleSessionService(
    createEngine(),
    puzzles as unknown as PuzzlesService,
  );
  service.bind(server as unknown as PuzzleServer);
  const states = () =>
    frozen
      .filter(([e]) => e === 'puzzle:state')
      .map(([, p]) => p as PuzzleState);
  return { service, puzzles, emit, server, states, game };
}

describe('PuzzleSessionService', () => {
  it('start : envoie l’état de départ, outcome ongoing', async () => {
    const { service, states, server } = setup();
    await service.start(USER, 'sock', {});
    expect(server.to).toHaveBeenCalledWith('sock');
    const [state] = states();
    expect(state).toMatchObject({
      puzzleId: 5,
      outcome: 'ongoing',
      test: false,
    });
    expect(state.view.me.userId).toBe(P1_ID);
  });

  it('start sans puzzleId, aucun défi du jour : erreur', async () => {
    const { service } = setup({ today: null });
    await expect(service.start(USER, 's', {})).rejects.toThrow(
      'Aucun défi aujourd’hui.',
    );
  });

  it('start avec puzzleId par un non-admin : refus', async () => {
    const { service, puzzles } = setup();
    await expect(service.start(USER, 's', { puzzleId: 5 })).rejects.toThrow(
      'Réservé aux administrateurs.',
    );
    expect(puzzles.load).not.toHaveBeenCalled();
  });

  it('action invalide : état inchangé, erreur renvoyée', async () => {
    const { game, service, states } = setup();
    await service.start(USER, 's', {});
    const bad = { type: 'discard', handIndex: 99 } as const;
    await expect(service.act(USER.userId, bad)).rejects.toThrow();
    expect(states()).toHaveLength(1);
    // la partie reste jouable
    await attackTurn(service, USER.userId, game);
    expect(states().at(-1)?.outcome).toBe('solved');
  });

  it('objectif atteint : completeToday une fois, reward, outcome solved', async () => {
    const { game, service, puzzles, states } = setup();
    await service.start(USER, 's', {});
    await attackTurn(service, USER.userId, game);
    const last = states().at(-1)!;
    expect(last.outcome).toBe('solved');
    expect(last.reward?.firstSolve).toBe(true);
    expect(puzzles.completeToday).toHaveBeenCalledTimes(1);
    expect(puzzles.completeToday).toHaveBeenCalledWith(USER.userId, 5);
  });

  it('partie de test admin : completeToday jamais appelé, test true', async () => {
    const { game, service, puzzles, states } = setup();
    await service.start(ADMIN, 's', { puzzleId: 5 });
    await attackTurn(service, ADMIN.userId, game);
    const last = states().at(-1)!;
    expect(last).toMatchObject({ outcome: 'solved', test: true });
    expect(last.reward).toBeUndefined();
    expect(puzzles.completeToday).not.toHaveBeenCalled();
  });

  it('fin de tour sans objectif : failed, toute action suivante refusée', async () => {
    const { service, states } = setup({
      game: attackScenario({ phase: 'main', wallHp: 2000 }),
    });
    await service.start(USER, 's', {});
    // on passe les phases jusqu'à la fin du tour
    for (let i = 0; i < 4 && states().at(-1)?.outcome === 'ongoing'; i++)
      await service.act(USER.userId, { type: 'end_phase' });
    expect(states().at(-1)?.outcome).toBe('failed');
    await expect(
      service.act(USER.userId, { type: 'end_phase' }),
    ).rejects.toThrow('Le défi est terminé');
  });

  it('restart : retour au départ, mêmes instanceId, outcome ongoing', async () => {
    const { game, service, states } = setup();
    await service.start(USER, 's', {});
    await attackTurn(service, USER.userId, game);
    service.restart(USER.userId);
    const first = states()[0];
    const again = states().at(-1)!;
    expect(again.outcome).toBe('ongoing');
    expect(again.view.opponent.monsterZones.map((m) => m?.instanceId)).toEqual(
      first.view.opponent.monsterZones.map((m) => m?.instanceId),
    );
    expect(again.view.opponent.monsterZones[0]).not.toBeNull();
  });

  it('restart après résolution : rejouable, completeToday renvoie firstSolve false', async () => {
    const { game, service, puzzles, states } = setup();
    puzzles.completeToday
      .mockResolvedValueOnce({ firstSolve: true, gold: 1, xp: 1 })
      .mockResolvedValueOnce({ firstSolve: false, gold: 0, xp: 0 });
    await service.start(USER, 's', {});
    await attackTurn(service, USER.userId, game);
    service.restart(USER.userId);
    await attackTurn(service, USER.userId, game);
    expect(states().at(-1)?.reward?.firstSolve).toBe(false);
    expect(puzzles.completeToday).toHaveBeenCalledTimes(2);
  });

  it('les événements sont publiés une fois puis vidés', async () => {
    // la mort du mur ne gagne pas la partie : le défi continue après l'attaque
    const { game, service, states } = setup({
      objective: { type: PuzzleObjectiveType.WIN_GAME },
    });
    await service.start(USER, 's', {});
    await attackTurn(service, USER.userId, game);
    const attackEvents = states().at(-1)!.view.events;
    expect(attackEvents.length).toBeGreaterThan(0);
    await service.act(USER.userId, { type: 'end_phase' });
    const next = states().at(-1)!.view.events;
    expect(attackEvents.some((e) => e.kind === 'monster_destroyed')).toBe(true);
    expect(next.some((e) => e.kind === 'monster_destroyed')).toBe(false);
    service.restart(USER.userId);
    expect(states().at(-1)?.view.events).toEqual([]);
  });

  it('le défi a changé pendant la partie : état publié sans récompense, erreur', async () => {
    const { game, service, puzzles, states } = setup();
    puzzles.completeToday.mockRejectedValue(
      new Error('Ce défi n’est plus le défi du jour.'),
    );
    await service.start(USER, 's', {});
    await expect(attackTurn(service, USER.userId, game)).rejects.toThrow(
      'Ce défi n’est plus le défi du jour.',
    );
    const last = states().at(-1)!;
    expect(last.outcome).toBe('solved');
    expect(last.reward).toBeUndefined();
  });

  it('close : retire la partie et prévient le client', async () => {
    const { service, emit } = setup();
    await service.start(USER, 's', {});
    service.close(USER.userId);
    expect(emit).toHaveBeenCalledWith('puzzle:closed');
    await expect(
      service.act(USER.userId, { type: 'end_phase' }),
    ).rejects.toThrow('Aucun défi en cours.');
  });

  it('disconnect : la partie disparaît après dix minutes', async () => {
    jest.useFakeTimers();
    try {
      const { service } = setup();
      await service.start(USER, 's', {});
      service.disconnect(USER.userId);
      jest.advanceTimersByTime(10 * 60_000 + 1);
      await expect(
        service.act(USER.userId, { type: 'end_phase' }),
      ).rejects.toThrow('Aucun défi en cours.');
    } finally {
      jest.useRealTimers();
    }
  });
});
