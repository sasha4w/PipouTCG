import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Req,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { TransactionService } from './transactions.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // Toutes les annonces PENDING (pour l'admin)
  @UseGuards(AdminGuard)
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.transactionService.findAll(pagination);
  }

  // Toutes les annonces PENDING (sauf celles de l'utilisateur connecté)
  @UseGuards(JwtAuthGuard)
  @Get('offers')
  findOtherListings(@Query() pagination: PaginationDto, @Req() req: any) {
    return this.transactionService.findOtherListings(
      pagination,
      req.user.userId,
    );
  }

  // Annonces PENDING de l'utilisateur connecté
  @UseGuards(JwtAuthGuard)
  @Get('me')
  findUserListings(@Query() pagination: PaginationDto, @Req() req: any) {
    return this.transactionService.findUserListings(
      pagination,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('listing')
  createListing(@Body() dto: CreateListingDto, @Req() req: any) {
    return this.transactionService.createListing(dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/buy')
  buyListing(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.transactionService.buyListing(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancelListing(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.transactionService.cancelListing(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.transactionService.getUserHistory(req.user.userId, pagination);
  }
}
