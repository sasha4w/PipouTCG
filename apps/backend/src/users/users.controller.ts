import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /* ===================== CONNECTÉ (toujours visible) ===================== */

  @UseGuards(JwtAuthGuard)
  @Get(':id/portfolio')
  getCardPortfolio(
    @Param('id', ParseIntPipe) id: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.usersService.getCardPortfolio(id, pagination);
  }

  /* ===================== CONNECTÉ (respecte la privacy) ===================== */

  @UseGuards(JwtAuthGuard)
  @Get(':id/profile')
  async getProfile(@Param('id', ParseIntPipe) id: number, @Request() req) {
    await this.assertCanView(req, id);
    return this.usersService.getProfile(id);
  }
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req) {
    return this.usersService.findOne(req.user.userId);
  }
  @UseGuards(JwtAuthGuard)
  @Get('me/inventory')
  getMyInventory(@Request() req) {
    return this.usersService.getInventory(req.user.userId);
  }
  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  getMyStats(@Request() req) {
    return this.usersService.getProfile(req.user.userId);
  }
  @UseGuards(JwtAuthGuard)
  @Get(':id/inventory')
  async getInventory(@Param('id', ParseIntPipe) id: number, @Request() req) {
    await this.assertCanView(req, id);
    return this.usersService.getInventory(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/boosters')
  async getUserBoosters(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Query() pagination: PaginationDto,
  ) {
    await this.assertCanView(req, id);
    return this.usersService.getUserBoosters(id, pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/bundles')
  async getUserBundles(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Query() pagination: PaginationDto,
  ) {
    await this.assertCanView(req, id);
    return this.usersService.getUserBundles(id, pagination);
  }
  @UseGuards(JwtAuthGuard)
  @Get('me/collection')
  getMyCollection(@Request() req) {
    return this.usersService.getCollection(req.user.userId);
  }
  /* ===================== OWNER ONLY ===================== */

  @UseGuards(JwtAuthGuard)
  @Patch(':id/privacy')
  togglePrivacy(@Param('id', ParseIntPipe) id: number, @Request() req) {
    this.assertOwner(req.user.userId, id);
    return this.usersService.togglePrivacy(id);
  }

  /* ===================== ADMIN ===================== */

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  /* ===================== HELPERS ===================== */

  private async assertCanView(req: any, targetId: number) {
    const target = await this.usersService.findOne(targetId);
    if (!target) throw new ForbiddenException('User not found');

    const isOwner = req.user.userId === targetId;
    const isAdmin = req.user.isAdmin;

    if (target.isPrivate && !isOwner && !isAdmin) {
      throw new ForbiddenException('This profile is private');
    }
  }

  private assertOwner(requesterId: number, targetId: number) {
    if (requesterId !== targetId) {
      throw new ForbiddenException('You can only do this on your own account');
    }
  }
}
