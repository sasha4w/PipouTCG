import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import type { AdventureOverview } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AdventureService } from './adventure.service';

@Controller('adventure')
@UseGuards(JwtAuthGuard)
export class AdventureController {
  constructor(private readonly adventure: AdventureService) {}

  @Get()
  overview(@Request() req: AuthenticatedRequest): Promise<AdventureOverview> {
    return this.adventure.getOverview(req.user.userId);
  }
}
