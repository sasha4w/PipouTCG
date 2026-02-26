import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // PUBLIC //
  @Get(':id/profile')
  getProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getProfile(id);
  }

  @Get(':id/portfolio')
  getCardPortfolio(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getCardPortfolio(id);
  }

  // CONNECTÉ //
  @UseGuards(JwtAuthGuard)
  @Get(':id/boosters')
  getUserBoosters(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserBoosters(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/bundles')
  getUserBundles(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserBundles(id);
  }

  // ADMIN //
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() body: any) {
    return this.usersService.create(body);
  }
}
