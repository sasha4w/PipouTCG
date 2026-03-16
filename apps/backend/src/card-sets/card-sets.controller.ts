import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CardSetsService } from './card-sets.service';
import { CreateCardSetDto } from './dto/create-card-set.dto';
import { UpdateCardSetDto } from './dto/update-card-set.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
@Controller('card-sets')
export class CardSetsController {
  constructor(private readonly cardSetsService: CardSetsService) {}

  // PUBLIC //
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.cardSetsService.findAll(pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cardSetsService.findOne(id);
  }
  // ADMIN //
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() createCardSetDto: CreateCardSetDto) {
    return this.cardSetsService.create(createCardSetDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCardSetDto: UpdateCardSetDto,
  ) {
    return this.cardSetsService.update(id, updateCardSetDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cardSetsService.remove(id);
  }
}
