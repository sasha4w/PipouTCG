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
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { TransactionService } from './transactions.service';
import type { ListingSoldPayload } from './transactions.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('transactions')
export class TransactionController {
  // Subject global : tous les clients SSE connectés reçoivent les événements
  // filtrés ensuite par sellerId côté serveur avant envoi
  private readonly sseSubject = new Subject<ListingSoldPayload>();

  constructor(private readonly transactionService: TransactionService) {}

  // ─────────────────────────────────────────────────────────────────
  // 📡 SSE — GET /transactions/events?userId=42
  //
  // Le client s'abonne une fois au montage du composant.
  // Seuls les événements destinés à cet userId sont transmis.
  // ─────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Sse('events')
  sseEvents(@Req() req: any): Observable<MessageEvent> {
    const userId: number = req.user.userId;

    return this.sseSubject.asObservable().pipe(
      // Ne transmettre que les événements destinés à CE vendeur
      filter((payload) => payload.sellerId === userId),
      map(
        (payload): MessageEvent => ({
          data: JSON.stringify(payload), // sérialisé en JSON pour le client
          type: 'listing.sold',
        }),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // 🔔 Écoute de l'EventEmitter → pousse dans le Subject SSE
  // ─────────────────────────────────────────────────────────────────
  @OnEvent('listing.sold')
  handleListingSold(payload: ListingSoldPayload) {
    this.sseSubject.next(payload);
  }

  // ─────────────────────────────────────────────────────────────────
  // ROUTES CLASSIQUES
  // ─────────────────────────────────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.transactionService.findAll(pagination);
  }

  @UseGuards(JwtAuthGuard)
  @Get('offers')
  findOtherListings(@Query() pagination: PaginationDto, @Req() req: any) {
    return this.transactionService.findOtherListings(
      pagination,
      req.user.userId,
    );
  }

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
