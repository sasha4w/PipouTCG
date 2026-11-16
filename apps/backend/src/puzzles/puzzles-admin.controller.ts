import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminPuzzle,
  PuzzleScheduleEntry,
  PuzzleVerifyResult,
} from '@pipou/shared';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { PuzzlePublishDto, PuzzleSaveDto } from './dto/puzzle-save.dto';
import {
  PuzzleScheduleDto,
  PuzzleScheduleQueryDto,
} from './dto/puzzle-schedule.dto';
import { PuzzlesAdminService } from './puzzles-admin.service';

@Controller('admin/puzzles')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PuzzlesAdminController {
  constructor(private readonly admin: PuzzlesAdminService) {}

  @Get()
  list(): Promise<AdminPuzzle[]> {
    return this.admin.list();
  }

  // Routes `schedule` déclarées avant `:id` pour ne pas être prises pour un id.
  @Get('schedule')
  getSchedule(
    @Query() query: PuzzleScheduleQueryDto,
  ): Promise<PuzzleScheduleEntry[]> {
    return this.admin.getSchedule(query.days ?? 14);
  }

  @Put('schedule')
  setSchedule(@Body() body: PuzzleScheduleDto): Promise<void> {
    return this.admin.setSchedule(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PuzzleSaveDto,
  ): Promise<void> {
    return this.admin.update(id, body);
  }

  @Post(':id/verify')
  @HttpCode(200)
  verify(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<PuzzleVerifyResult> {
    return this.admin.verify(id, { userId: req.user.userId, username: '' });
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PuzzlePublishDto,
  ): Promise<void> {
    return this.admin.publish(id, body);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.admin.unpublish(id);
  }

  @Post(':id/scenario')
  scenario(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ scenarioId: number }> {
    return this.admin.createScenario(id, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.admin.remove(id);
  }
}
