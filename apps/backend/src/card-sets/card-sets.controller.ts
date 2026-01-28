import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { CardSetsService } from './card-sets.service';
import { CreateCardSetDto } from './dto/create-card-set.dto';
import { UpdateCardSetDto } from './dto/update-card-set.dto';

@Controller('card-sets')
export class CardSetsController {
  constructor(private readonly cardSetsService: CardSetsService) {}

  // GET /card-sets
  @Get()
  findAll() {
    return this.cardSetsService.findAll();
  }

  // GET /card-sets/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cardSetsService.findOne(Number(id));
  }

  // POST /card-sets
  @Post()
  create(@Body() createCardSetDto: CreateCardSetDto) {
    return this.cardSetsService.create(createCardSetDto);
  }

  // PUT /card-sets/:id
  @Put(':id')
  update(@Param('id') id: string, @Body() updateCardSetDto: UpdateCardSetDto) {
    return this.cardSetsService.update(Number(id), updateCardSetDto);
  }

  // DELETE /card-sets/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cardSetsService.remove(Number(id));
  }
}
