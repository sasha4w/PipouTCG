import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import type { DailyPuzzleInfo } from '@pipou/shared';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { PuzzlesService } from './puzzles.service';

@Controller('puzzles')
@UseGuards(JwtAuthGuard)
export class PuzzlesController {
  constructor(private readonly puzzles: PuzzlesService) {}

  @Get('today')
  today(@Request() req: AuthenticatedRequest): Promise<DailyPuzzleInfo> {
    return this.puzzles.getToday(req.user.userId);
  }
}
