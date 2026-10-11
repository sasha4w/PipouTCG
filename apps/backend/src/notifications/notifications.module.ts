import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { Patchnote } from './patchnote.entity';
import { PatchnoteRead } from './patchnote-read.entity';
import { NotificationsService } from './notifications.service';
import {
  NotificationsController,
  PatchnotesController,
} from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Patchnote, PatchnoteRead])],
  controllers: [NotificationsController, PatchnotesController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
