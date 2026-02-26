import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // CONNECTÉ //
  @UseGuards(JwtAuthGuard)
  @Post('listing')
  createListing(@Body() dto: CreateListingDto, @Req() req) {
    return this.transactionService.createListing(dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/buy')
  buyListing(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.transactionService.buyListing(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(@Req() req) {
    return this.transactionService.getUserHistory(req.user.userId);
  }
}
