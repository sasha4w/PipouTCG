import { GameEndService, calcElo } from './game-end.service';
import { scenario, P1_ID, P2_ID } from '../testing/scenario';

function setup() {
  const stats = new Map<number, Record<string, number>>();
  const matchRepo = { update: jest.fn().mockResolvedValue(undefined) };
  const statsRepo = {
    findOne: jest.fn(({ where }: { where: { userId: number } }) =>
      Promise.resolve(stats.get(where.userId) ?? null),
    ),
    create: jest.fn((s: { userId: number }) => {
      const row = { wins: 0, losses: 0, draws: 0, elo: 1000, ...s };
      stats.set(s.userId, row);
      return row;
    }),
    save: jest.fn((s: unknown) => Promise.resolve(s)),
  };
  const service = new GameEndService(matchRepo as never, statsRepo as never);
  return { service, matchRepo, stats };
}

describe('GameEndService.persistResult', () => {
  it('match nul : aucun gagnant, un nul pour chacun, ELO inchangé à niveau égal', async () => {
    const { service, matchRepo, stats } = setup();
    const game = scenario();
    game.phase = 'finished';
    game.endReason = 'double_ko';

    await service.persistResult(game);

    expect(matchRepo.update).toHaveBeenCalledWith(
      game.matchId,
      expect.objectContaining({ winnerId: null, endReason: 'double_ko' }),
    );
    expect(stats.get(P1_ID)).toMatchObject({
      draws: 1,
      wins: 0,
      losses: 0,
      elo: 1000,
    });
    expect(stats.get(P2_ID)).toMatchObject({
      draws: 1,
      wins: 0,
      losses: 0,
      elo: 1000,
    });
  });

  it('victoire : +1 victoire, +1 défaite et ±16 ELO à niveau égal', async () => {
    const { service, stats } = setup();
    const game = scenario();
    game.phase = 'finished';
    game.winner = P1_ID;
    game.endReason = 'surrender';

    await service.persistResult(game);

    expect(stats.get(P1_ID)).toMatchObject({ wins: 1, elo: 1016 });
    expect(stats.get(P2_ID)).toMatchObject({ losses: 1, elo: 984 });
  });
});

describe('calcElo', () => {
  it('ne descend jamais sous 100', () => {
    expect(calcElo(2000, 100, 1)[1]).toBe(100);
  });
});
