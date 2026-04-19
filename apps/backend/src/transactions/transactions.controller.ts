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
  // Subject pour les events privés (vendeur uniquement)
  private readonly sseSubject = new Subject<ListingSoldPayload>();

  // Subject pour les events publics (tout le monde : création, annulation)
  private readonly sseMarketSubject = new Subject<{
    type: string;
    [key: string]: any;
  }>();

  constructor(private readonly transactionService: TransactionService) {}

  // ─────────────────────────────────────────────────────────────────
  // 📡 SSE privé — listing.sold → vendeur uniquement
  // ─────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Sse('events')
  sseEvents(@Req() req: any): Observable<MessageEvent> {
    const userId: number = req.user.userId;

    return this.sseSubject.asObservable().pipe(
      filter((payload) => payload.sellerId === userId),
      map(
        (payload): MessageEvent => ({
          data: JSON.stringify(payload),
          type: 'listing.sold',
        }),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // 📡 SSE public — listing.created / listing.cancelled → tout le monde
  // ─────────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Sse('events/new-listings')
  sseNewListings(): Observable<MessageEvent> {
    return this.sseMarketSubject.asObservable().pipe(
      map(
        (payload): MessageEvent => ({
          data: JSON.stringify(payload),
          type: 'market.update',
        }),
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // 🔔 Handlers EventEmitter → push dans les subjects SSE
  // ─────────────────────────────────────────────────────────────────
  @OnEvent('listing.sold')
  handleListingSold(payload: ListingSoldPayload) {
    this.sseSubject.next(payload);
  }

  @OnEvent('listing.created')
  handleListingCreated(payload: any) {
    this.sseMarketSubject.next({ type: 'listing.created', ...payload });
  }

  @OnEvent('listing.cancelled')
  handleListingCancelled(payload: any) {
    this.sseMarketSubject.next({ type: 'listing.cancelled', ...payload });
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
