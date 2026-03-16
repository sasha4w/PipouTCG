import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { BundlesService } from './bundles.service';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';
import { AddBundleContentDto } from './dto/add-bundle-content.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
@Controller('bundles')
export class BundlesController {
  constructor(private readonly bundlesService: BundlesService) {}

  // PUBLIC //
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.bundlesService.findAll(pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bundlesService.findOne(id);
  }

  // USER //
  @UseGuards(JwtAuthGuard)
  @Post(':id/buy')
  buyBundle(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.bundlesService.buyBundle(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/open')
  openBundle(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.bundlesService.openBundle(id, req.user.userId);
  }

  // ADMIN //
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateBundleDto) {
    return this.bundlesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBundleDto) {
    return this.bundlesService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bundlesService.remove(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post(':id/contents')
  addContent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddBundleContentDto,
  ) {
    return this.bundlesService.addContent(id, dto);
  }
}
