import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // GET /users/:id/portfolio
  @Get(':id/portfolio')
  getCardPortfolio(@Param('id') id: string) {
    return this.usersService.getCardPortfolio(Number(id));
  }

  // GET /users/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }
  // GET /users/:id/profile
  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(Number(id));
  }
  // POST /users
  @Post()
  create(@Body() body: any) {
    return this.usersService.create(body);
  }
}
