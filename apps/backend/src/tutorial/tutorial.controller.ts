import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import type { TutorialOverview } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { TutorialService } from './tutorial.service';

@Controller('tutorial')
@UseGuards(JwtAuthGuard)
export class TutorialController {
  constructor(private readonly tutorial: TutorialService) {}

  @Get()
  overview(@Request() req: AuthenticatedRequest): Promise<TutorialOverview> {
    return this.tutorial.getOverview(req.user.userId);
  }
}
