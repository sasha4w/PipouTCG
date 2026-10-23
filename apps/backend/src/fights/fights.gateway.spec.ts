import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { FightsGateway } from './fights.gateway';
import type { FightsService } from './fights.service';

describe('FightsGateway : fight:summon', () => {
  it('transmet au moteur les alliés sacrifiés par la Relève', async () => {
    const act = jest.fn(() => Promise.resolve({}));
    const gateway = new FightsGateway(
      { act } as unknown as FightsService,
      {} as JwtService,
      {} as ConfigService,
    );
    const client = { data: { userId: 7 }, emit: jest.fn() };
    await gateway.summonMonster(client as never, {
      matchId: 3,
      handIndex: 0,
      zoneIndex: 1,
      paymentHandIndices: [],
      releveInstanceIds: ['a', 'b'],
    });
    expect(act).toHaveBeenCalledWith(
      3,
      7,
      expect.objectContaining({
        type: 'summon',
        releveInstanceIds: ['a', 'b'],
      }),
      undefined,
    );
  });
});
