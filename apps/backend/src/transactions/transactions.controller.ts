import {
  Controller,
  Post,
  Patch,
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
import { UpdateListingDto } from './dto/update-listing.dto';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { IsInt, IsOptional, Min } from 'class-validator';

class BuyListingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

@Controller('transactions')
export class TransactionController {
  private readonly sseSubject = new Subject<ListingSoldPayload>();
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
  // 📡 SSE public — listing.created / listing.cancelled / listing.updated
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
  // 🔔 Handlers EventEmitter
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

  @OnEvent('listing.updated')
  handleListingUpdated(payload: any) {
    this.sseMarketSubject.next({ type: 'listing.updated', ...payload });
  }

  // ─────────────────────────────────────────────────────────────────
  // ROUTES — listings actifs
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
  @Get('history')
  getHistory(
    @Req() req: any,
    @Query() pagination: PaginationDto, // ?page=1&limit=20
    @Query('role') role?: 'seller' | 'buyer', // ?role=seller
  ) {
    return this.transactionService.getUserHistory(
      req.user.userId,
      pagination,
      role,
    );
  }
  // ─────────────────────────────────────────────────────────────────
  // ROUTES — transactions complétées
  // ─────────────────────────────────────────────────────────────────

  /**
   * GET /transactions/completed
   * Toutes les transactions COMPLETED — admin uniquement
   */
  @UseGuards(AdminGuard)
  @Get('completed')
  findCompleted(@Query() pagination: PaginationDto) {
    return this.transactionService.findCompleted(pagination);
  }

  /**
   * GET /transactions/completed/:id
   * Détail d'une transaction COMPLETED par ID — auth requis
   */
  @UseGuards(JwtAuthGuard)
  @Get('completed/:id')
  findCompletedById(@Param('id', ParseIntPipe) id: number) {
    return this.transactionService.findCompletedById(id);
  }

  // GET /transactions/recent-sales — toutes les completed, pour tous les users connectés
  @UseGuards(JwtAuthGuard)
  @Get('recent-sales')
  getRecentSales(@Query() pagination: PaginationDto) {
    return this.transactionService.getRecentSales(pagination);
  }

  // ─────────────────────────────────────────────────────────────────
  // ROUTES — actions sur un listing
  // ─────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('listing')
  createListing(@Body() dto: CreateListingDto, @Req() req: any) {
    return this.transactionService.createListing(dto, req.user.userId);
  }

  /**
   * PATCH /transactions/:id
   * Modifier le prix unitaire et/ou la quantité d'un listing PENDING
   * Seul le vendeur peut modifier sa propre annonce
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateListing(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateListingDto,
    @Req() req: any,
  ) {
    return this.transactionService.updateListing(id, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/buy')
  buyListing(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() body: BuyListingDto,
  ) {
    return this.transactionService.buyListing(
      id,
      req.user.userId,
      body.quantity,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancelListing(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.transactionService.cancelListing(id, req.user.userId);
  }
}
