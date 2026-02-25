import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(Number(id));
  }

  @Get(':id/portfolio')
  getCardPortfolio(@Param('id') id: string) {
    return this.usersService.getCardPortfolio(Number(id));
  }

  @Get(':id/boosters')
  getUserBoosters(@Param('id') id: string) {
    return this.usersService.getUserBoosters(Number(id));
  }

  @Get(':id/bundles')
  getUserBundles(@Param('id') id: string) {
    return this.usersService.getUserBundles(Number(id));
  }

  @Post()
  create(@Body() body: any) {
    return this.usersService.create(body);
  }
}
