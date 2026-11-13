import { PuzzleObjectiveType } from '@pipou/shared';
import type { PuzzleObjective, PuzzleState } from '@pipou/shared';
import * as step from './puzzle-step';
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
  await service.act(userId, { type: 'end_phase' }, 's');
  await service.act(userId, attackWall(game), 's');
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
    await expect(service.act(USER.userId, bad, 's')).rejects.toThrow();
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
      await service.act(USER.userId, { type: 'end_phase' }, 's');
    expect(states().at(-1)?.outcome).toBe('failed');
    await expect(
      service.act(USER.userId, { type: 'end_phase' }, 's'),
    ).rejects.toThrow('Le défi est terminé');
  });

  it('restart : retour au départ, mêmes instanceId, outcome ongoing', async () => {
    const { game, service, states } = setup();
    await service.start(USER, 's', {});
    await attackTurn(service, USER.userId, game);
    service.restart(USER.userId, 's');
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
    service.restart(USER.userId, 's');
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
    await service.act(USER.userId, { type: 'end_phase' }, 's');
    const next = states().at(-1)!.view.events;
    expect(attackEvents.some((e) => e.kind === 'monster_destroyed')).toBe(true);
    expect(next.some((e) => e.kind === 'monster_destroyed')).toBe(false);
    service.restart(USER.userId, 's');
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
      service.act(USER.userId, { type: 'end_phase' }, 's'),
    ).rejects.toThrow('Aucun défi en cours.');
  });

  it('disconnect : la partie disparaît après dix minutes', async () => {
    jest.useFakeTimers();
    try {
      const { service } = setup();
      await service.start(USER, 's', {});
      service.disconnect(USER.userId, 's');
      jest.advanceTimersByTime(10 * 60_000 + 1);
      await expect(
        service.act(USER.userId, { type: 'end_phase' }, 's'),
      ).rejects.toThrow('Aucun défi en cours.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('disconnect d’un ancien socket : la partie reprise ailleurs survit', async () => {
    jest.useFakeTimers();
    try {
      const { service, states } = setup();
      await service.start(USER, 'vieux', {});
      // reconnexion : un nouveau socket reprend la partie
      service.restart(USER.userId, 'neuf');
      service.disconnect(USER.userId, 'vieux');
      jest.advanceTimersByTime(10 * 60_000 + 1);
      await service.act(USER.userId, { type: 'end_phase' }, 'neuf');
      expect(states().length).toBeGreaterThan(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('act après coupure : annule le nettoyage et rattache le socket', async () => {
    jest.useFakeTimers();
    try {
      const { service, server } = setup();
      await service.start(USER, 'a', {});
      service.disconnect(USER.userId, 'a');
      await service.act(USER.userId, { type: 'end_phase' }, 'b');
      jest.advanceTimersByTime(10 * 60_000 + 1);
      expect(server.to).toHaveBeenLastCalledWith('b');
      await service.act(USER.userId, { type: 'end_phase' }, 'b');
    } finally {
      jest.useRealTimers();
    }
  });

  it('restart après coupure : annule le nettoyage', async () => {
    jest.useFakeTimers();
    try {
      const { service, server } = setup();
      await service.start(USER, 'a', {});
      service.disconnect(USER.userId, 'a');
      service.restart(USER.userId, 'b');
      jest.advanceTimersByTime(10 * 60_000 + 1);
      expect(server.to).toHaveBeenLastCalledWith('b');
      service.restart(USER.userId, 'b');
    } finally {
      jest.useRealTimers();
    }
  });

  it('restart pendant l’attente de la récompense : refusé, pas d’état remis à zéro', async () => {
    const { game, service, puzzles, states } = setup();
    let release!: (r: unknown) => void;
    puzzles.completeToday.mockReturnValue(
      new Promise((resolve) => (release = resolve)),
    );
    await service.start(USER, 's', {});
    await service.act(USER.userId, { type: 'end_phase' }, 's');
    const pending = service.act(USER.userId, attackWall(game), 's');
    expect(() => service.restart(USER.userId, 's')).toThrow(
      'Une action est déjà en cours.',
    );
    release({ firstSolve: true, gold: 1, xp: 1 });
    await pending;
    const last = states().at(-1)!;
    expect(last.outcome).toBe('solved');
    expect(last.reward?.firstSolve).toBe(true);
  });

  it('deux actions simultanées : la seconde est refusée', async () => {
    const { game, service, puzzles } = setup();
    let release!: (r: unknown) => void;
    puzzles.completeToday.mockReturnValue(
      new Promise((resolve) => (release = resolve)),
    );
    await service.start(USER, 's', {});
    await service.act(USER.userId, { type: 'end_phase' }, 's');
    const first = service.act(USER.userId, attackWall(game), 's');
    await expect(
      service.act(USER.userId, { type: 'end_phase' }, 's'),
    ).rejects.toThrow('Une action est déjà en cours.');
    release({ firstSolve: true, gold: 1, xp: 1 });
    await first;
    expect(puzzles.completeToday).toHaveBeenCalledTimes(1);
  });

  it('playPuzzleAction qui lève : état restauré, erreur propre, partie jouable', async () => {
    const { game, service, states } = setup();
    await service.start(USER, 's', {});
    const spy = jest
      .spyOn(step, 'playPuzzleAction')
      .mockImplementationOnce((_e, g) => {
        g.turnNumber = 999;
        throw new Error('boum interne');
      });
    await expect(
      service.act(USER.userId, { type: 'end_phase' }, 's'),
    ).rejects.toThrow('Action impossible.');
    spy.mockRestore();
    expect(states()).toHaveLength(1);
    await attackTurn(service, USER.userId, game);
    expect(states().at(-1)?.outcome).toBe('solved');
  });

  it('start avec puzzleId non entier : refus', async () => {
    const { service, puzzles } = setup();
    for (const bad of [1.5, NaN, '5' as unknown as number])
      await expect(
        service.start(ADMIN, 's', { puzzleId: bad }),
      ).rejects.toThrow('Défi invalide.');
    expect(puzzles.load).not.toHaveBeenCalled();
  });
});
