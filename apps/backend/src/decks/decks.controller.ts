import {
  Controller,
  Get,
  Post,
  Put,
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

@UseGuards(JwtAuthGuard)
@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.decksService.findAllByUser(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.decksService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() dto: CreateDeckDto, @Request() req: any) {
    return this.decksService.create(req.user.userId, dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDeckDto,
    @Request() req: any,
  ) {
    return this.decksService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.decksService.remove(id, req.user.userId);
  }
}
