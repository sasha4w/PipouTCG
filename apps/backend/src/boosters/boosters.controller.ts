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
  Req,
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

  // USER //
  @UseGuards(JwtAuthGuard)
  @Post(':id/buy')
  buyBooster(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.boostersService.buyBooster(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/open')
  openBooster(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.boostersService.openBooster(id, req.user.id);
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
