import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminAdventureOverview,
  AdminAdventureWorld,
} from '@pipou/shared';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdventureAdminService } from './adventure-admin.service';
import { AdminDeckDto } from './dto/admin-deck.dto';
import { AdminOpponentDto } from './dto/admin-opponent.dto';
import { AdminSettingsDto } from './dto/admin-settings.dto';
import { AdminWorldDto } from './dto/admin-world.dto';

@Controller('admin/adventure')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdventureAdminController {
  constructor(private readonly admin: AdventureAdminService) {}

  @Get()
  overview(): Promise<AdminAdventureOverview> {
    return this.admin.getOverview();
  }

  @Post('worlds')
  createWorld(@Body() dto: AdminWorldDto): Promise<AdminAdventureWorld> {
    return this.admin.createWorld(dto);
  }

  @Patch('worlds/:id')
  updateWorld(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminWorldDto,
  ): Promise<AdminAdventureWorld> {
    return this.admin.updateWorld(id, dto);
  }

  @Patch('opponents/:id')
  updateOpponent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminOpponentDto,
  ): Promise<AdminAdventureWorld> {
    return this.admin.updateOpponent(id, dto);
  }

  @Put('opponents/:id/deck')
  updateDeck(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminDeckDto,
  ): Promise<AdminAdventureWorld> {
    return this.admin.updateDeck(id, dto);
  }

  @Post('opponents/:id/deck/regenerate')
  regenerateDeck(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdminAdventureWorld> {
    return this.admin.regenerateDeck(id);
  }

  @Patch('settings')
  updateSettings(@Body() dto: AdminSettingsDto): Promise<{ dailyCap: number }> {
    return this.admin.updateSettings(dto);
  }
}
