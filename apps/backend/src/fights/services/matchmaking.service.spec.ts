import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { MatchmakingService } from './matchmaking.service';
import type { Match } from '../entities/match.entity';

describe('MatchmakingService.joinQueue', () => {
  const build = (find: jest.Mock) => {
    const matchRepo = {
      create: jest.fn((x: object) => x),
      save: jest.fn((x: object) => Promise.resolve({ ...x, id: 7 })),
      manager: { getRepository: jest.fn(() => ({ find })) },
    };
    return new MatchmakingService(matchRepo as unknown as Repository<Match>);
  };

  it('apparie deux joueurs avec leur titre équipé', async () => {
    const service = build(
      jest.fn().mockResolvedValue([{ id: 1, equippedTitle: 'WINS' }]),
    );
    await service.joinQueue(1, 'a', 's1', false);
    const found = await service.joinQueue(2, 'b', 's2', false);
    expect(found?.matchId).toBe(7);
    expect(found?.p1.title).toBe('WINS');
    expect(found?.p2.title).toBeNull();
  });

  it('retombe sur title null si la lecture des titres échoue', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const service = build(jest.fn().mockRejectedValue(new Error('db down')));
    await service.joinQueue(1, 'a', 's1', false);
    const found = await service.joinQueue(2, 'b', 's2', false);
    expect(found?.matchId).toBe(7);
    expect(found?.p1.title).toBeNull();
    expect(found?.p2.title).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
