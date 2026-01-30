import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { BoostersService } from './boosters.service';
import { CreateBoosterDto } from './dto/create-booster.dto';
import { UpdateBoosterDto } from './dto/update-booster.dto';

@Controller('boosters')
export class BoostersController {
  constructor(private readonly boostersService: BoostersService) {}

  @Get()
  findAll() {
    return this.boostersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.boostersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBoosterDto) {
    return this.boostersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoosterDto) {
    return this.boostersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.boostersService.remove(id);
  }
}
