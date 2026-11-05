import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Archetype } from '@pipou/shared';
import type { StarterDeckView } from '@pipou/shared';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { StarterDecksService } from './starter-decks.service';
import { StarterDeckDto } from './dto/starter-deck.dto';

@Controller('admin/starter-decks')
@UseGuards(JwtAuthGuard, AdminGuard)
export class StarterDecksAdminController {
  constructor(private readonly starterDecks: StarterDecksService) {}

  @Get()
  list(): Promise<StarterDeckView[]> {
    return this.starterDecks.adminList();
  }

  @Put(':archetype')
  save(
    @Param('archetype') archetype: string,
    @Body() dto: StarterDeckDto,
  ): Promise<StarterDeckView> {
    if (!Object.values(Archetype).includes(archetype as Archetype)) {
      throw new BadRequestException('Archétype invalide');
    }
    return this.starterDecks.saveDeck(archetype as Archetype, dto);
  }
}
