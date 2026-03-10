import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { QuestService } from './quests.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('quests')
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  /* ===================== CONNECTÉ ===================== */

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyQuests(@Request() req) {
    await this.questService.syncUserQuests(req.user.userId);
    return this.questService.getUserQuests(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/claim')
  claimReward(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.questService.claimReward(req.user.userId, id);
  }

  /* ===================== ADMIN ===================== */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll() {
    return this.questService.findAllQuests();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.questService.findOneQuest(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateQuestDto) {
    return this.questService.createQuest(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateQuestDto) {
    return this.questService.updateQuest(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/toggle')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.questService.toggleQuestActive(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.questService.deleteQuest(id);
  }
}
