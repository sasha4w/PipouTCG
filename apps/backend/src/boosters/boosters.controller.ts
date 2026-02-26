import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { BoostersService } from './boosters.service';
import { CreateBoosterDto } from './dto/create-booster.dto';
import { UpdateBoosterDto } from './dto/update-booster.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
@Controller('boosters')
export class BoostersController {
  constructor(private readonly boostersService: BoostersService) {}

  // PUBLIC //
  @Get()
  findAll() {
    return this.boostersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.boostersService.findOne(id);
  }

  // ADMIN //
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateBoosterDto) {
    return this.boostersService.create(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoosterDto) {
    return this.boostersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.boostersService.remove(id);
  }
}
