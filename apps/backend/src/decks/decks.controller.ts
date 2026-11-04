import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { DecksService } from './decks.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SetDeckFavoriteDto } from './dto/set-deck-favorite.dto';
import type { AuthenticatedRequest } from '../auth/auth-user';

@UseGuards(JwtAuthGuard)
@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Get()
  findAll(@Request() req: AuthenticatedRequest) {
    return this.decksService.findAllByUser(req.user.userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.decksService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() dto: CreateDeckDto, @Request() req: AuthenticatedRequest) {
    return this.decksService.create(req.user.userId, dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDeckDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.decksService.update(id, req.user.userId, dto);
  }

  @Patch(':id/favorite')
  setFavorite(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetDeckFavoriteDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.decksService.setFavorite(id, req.user.userId, dto.favorite);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.decksService.remove(id, req.user.userId);
  }
}
