import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { AdventureOverview } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AdventureController } from './adventure.controller';
import type { AdventureService } from './adventure.service';

describe('AdventureController', () => {
  const overview: AdventureOverview = {
    worlds: [],
    farmRewardsToday: 3,
    dailyCap: 20,
  };
  const service = { getOverview: jest.fn(() => Promise.resolve(overview)) };
  const controller = new AdventureController(
    service as unknown as AdventureService,
  );

  it('GET /adventure : vue du joueur connecté', async () => {
    const req = { user: { userId: 42 } } as AuthenticatedRequest;
    await expect(controller.overview(req)).resolves.toBe(overview);
    expect(service.getOverview).toHaveBeenCalledWith(42);
  });

  it('protégé par JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdventureController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
  });
});
