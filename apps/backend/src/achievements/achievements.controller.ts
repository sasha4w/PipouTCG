import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AchievementFamily } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AchievementsService } from './achievements.service';
import { SetTitleDto } from './dto/set-title.dto';

@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  getMine(@Request() req: AuthenticatedRequest) {
    return this.achievements.getAchievements(req.user.userId);
  }

  @Post('claim-all')
  claimAll(
    @Request() req: AuthenticatedRequest,
    @Query('family', new ParseEnumPipe(AchievementFamily, { optional: true }))
    family?: AchievementFamily,
  ) {
    return this.achievements.claimAll(req.user.userId, family);
  }

  @Post(':family/claim')
  claim(
    @Param('family', new ParseEnumPipe(AchievementFamily))
    family: AchievementFamily,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.achievements.claim(req.user.userId, family);
  }

  @Put('title')
  setTitle(@Body() dto: SetTitleDto, @Request() req: AuthenticatedRequest) {
    return this.achievements.setTitle(req.user.userId, dto.family ?? null);
  }
}
