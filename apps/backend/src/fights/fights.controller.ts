import {
  Controller,
  Get,
  Query,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FightsService } from './fights.service';

@UseGuards(JwtAuthGuard)
@Controller('fights')
export class FightsController {
  constructor(private readonly fightsService: FightsService) {}

  /** My match history (paginated, newest first). */
  @Get('history')
  getHistory(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.fightsService.getMatchHistory(req.user.userId, page, limit);
  }

  /** My personal stats (wins, losses, ELO). */
  @Get('stats')
  getMyStats(@Request() req: any) {
    return this.fightsService.getMyStats(req.user.userId);
  }

  /** Global leaderboard sorted by ELO. */
  @Get('leaderboard')
  getLeaderboard(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.fightsService.getLeaderboard(limit);
  }
}
