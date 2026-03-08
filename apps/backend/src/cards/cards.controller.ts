import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  // PUBLIC
  @Get('set/:setId')
  findBySet(@Param('setId') setId: string, @Query() pagination: PaginationDto) {
    return this.cardsService.findBySet(Number(setId), pagination);
  }

  // PUBLIC //
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.cardsService.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cardsService.findOne(Number(id));
  }

  // ADMIN //

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createCardDto: CreateCardDto,
  ) {
    return this.cardsService.create(file, createCardDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.cardsService.update(Number(id), file, updateCardDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cardsService.remove(Number(id));
  }
}
