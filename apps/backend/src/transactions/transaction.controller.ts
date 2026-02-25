import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransactionService } from './transaction.service';
import { CreateListingDto } from './dto/create-listing.dto';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // Créer une annonce
  @UseGuards(AuthGuard('jwt'))
  @Post('listing')
  createListing(@Body() dto: CreateListingDto, @Req() req) {
    const sellerId = req.user.userId;
    return this.transactionService.createListing(dto, sellerId);
  }

  // Acheter une annonce
  // Acheter une annonce
  @UseGuards(AuthGuard('jwt'))
  @Post(':id/buy') // ← on retire :buyerId de l'URL
  buyListing(@Param('id') id: string, @Req() req) {
    const buyerId = req.user.userId; // ← depuis le JWT
    return this.transactionService.buyListing(Number(id), buyerId);
  }

  // Historique utilisateur
  @UseGuards(AuthGuard('jwt'))
  @Get('history') // ← plus besoin de :id dans l'URL
  getHistory(@Req() req) {
    const userId = req.user.userId; // ← depuis le JWT
    return this.transactionService.getUserHistory(userId);
  }
}
