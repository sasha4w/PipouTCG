import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto } from '../dto/create-card.dto';
import { UpdateCardDto } from '../dto/update-card.dto';

@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  // GET /cards/set/:setId
  @Get('set/:setId')
  findBySet(@Param('setId') setId: string) {
    return this.cardsService.findBySet(Number(setId));
  }

  // GET /cards
  @Get()
  findAll() {
    return this.cardsService.findAll();
  }

  // GET /cards/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cardsService.findOne(Number(id));
  }

  // POST /cards
  @Post()
  create(@Body() createCardDto: CreateCardDto) {
    return this.cardsService.create(createCardDto);
  }

  // PUT /cards/:id
  @Put(':id')
  update(@Param('id') id: string, @Body() updateCardDto: UpdateCardDto) {
    return this.cardsService.update(Number(id), updateCardDto);
  }

  // DELETE /cards/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cardsService.remove(Number(id));
  }
}
