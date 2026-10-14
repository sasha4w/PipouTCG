import {
  Body,
  Controller,
  Get,
  HttpCode,
  MessageEvent,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import type { NotificationsResponse } from '@pipou/shared';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';
import type { AuthenticatedRequest } from '../auth/auth-user';
import { NotificationsService } from './notifications.service';
import { Patchnote } from './patchnote.entity';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { CreatePatchnoteDto } from './dto/create-patchnote.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  /** userId null = diffusion (nouveau patchnote). */
  private readonly created = new Subject<{ userId: number | null }>();

  constructor(private readonly service: NotificationsService) {}

  @OnEvent('notification.created')
  onCreated(payload: { userId: number | null }): void {
    this.created.next(payload);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationsResponse> {
    return this.service.list(req.user.userId, query.category, query.limit);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@Req() req: AuthenticatedRequest): Promise<void> {
    await this.service.markAllRead(req.user.userId);
  }

  // 📡 SSE privé : prévient le front d'un nouveau message (il refetch ensuite)
  @Sse('events')
  events(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    const userId = req.user.userId;
    return this.created.asObservable().pipe(
      filter((e) => e.userId === null || e.userId === userId),
      map((): MessageEvent => ({ type: 'notification.created', data: '{}' })),
    );
  }
}

@Controller('patchnotes')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PatchnotesController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  create(@Body() dto: CreatePatchnoteDto): Promise<Patchnote> {
    return this.service.createPatchnote(dto);
  }
}
