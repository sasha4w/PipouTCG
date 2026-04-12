import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { DailyRewardService } from './daily-reward.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import {
  CreateDailyRewardDefinitionDto,
  UpdateDailyRewardDefinitionDto,
  CreateMilestoneRewardDto,
  UpdateMilestoneRewardDto,
  RescueStreakDto,
} from './dto/daily-reward.dto';

@Controller('daily-reward')
export class DailyRewardController {
  constructor(private readonly dailyRewardService: DailyRewardService) {}

  // ── USER ───────────────────────────────────────────────────────────────────

  /** Statut actuel : streak, prochain claim, rescue dispo... */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Req() req: any) {
    return this.dailyRewardService.getStatus(req.user.userId);
  }

  /** Réclame la récompense du jour */
  @UseGuards(JwtAuthGuard)
  @Post('claim')
  claimDaily(@Req() req: any) {
    return this.dailyRewardService.claimDaily(req.user.userId);
  }

  /** Rachète les jours manqués en gold pour maintenir la streak */
  @UseGuards(JwtAuthGuard)
  @Post('rescue')
  rescueStreak(@Req() req: any, @Body() dto: RescueStreakDto) {
    return this.dailyRewardService.rescueStreak(req.user.userId, dto);
  }

  /** Reset volontaire de la streak (si l'user ne veut pas payer) */
  @UseGuards(JwtAuthGuard)
  @Post('reset')
  resetStreak(@Req() req: any) {
    return this.dailyRewardService.resetStreak(req.user.userId);
  }

  /** Historique des claims de l'utilisateur */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(@Req() req: any, @Query('limit') limit?: string) {
    return this.dailyRewardService.getHistory(
      req.user.userId,
      limit ? parseInt(limit) : 30,
    );
  }

  // ── ADMIN — Définitions journalières ──────────────────────────────────────

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('definitions')
  findAllDefinitions() {
    return this.dailyRewardService.findAllDefinitions();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('definitions/:id')
  findOneDefinition(@Param('id', ParseIntPipe) id: number) {
    return this.dailyRewardService.findOneDefinition(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('definitions')
  createDefinition(@Body() dto: CreateDailyRewardDefinitionDto) {
    return this.dailyRewardService.createDefinition(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('definitions/:id')
  updateDefinition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDailyRewardDefinitionDto,
  ) {
    return this.dailyRewardService.updateDefinition(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('definitions/:id')
  removeDefinition(@Param('id', ParseIntPipe) id: number) {
    return this.dailyRewardService.removeDefinition(id);
  }

  // ── ADMIN — Milestones ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('milestones')
  findAllMilestones() {
    return this.dailyRewardService.findAllMilestones();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('milestones/:id')
  findOneMilestone(@Param('id', ParseIntPipe) id: number) {
    return this.dailyRewardService.findOneMilestone(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('milestones')
  createMilestone(@Body() dto: CreateMilestoneRewardDto) {
    return this.dailyRewardService.createMilestone(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('milestones/:id')
  updateMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMilestoneRewardDto,
  ) {
    return this.dailyRewardService.updateMilestone(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('milestones/:id')
  removeMilestone(@Param('id', ParseIntPipe) id: number) {
    return this.dailyRewardService.removeMilestone(id);
  }
}
