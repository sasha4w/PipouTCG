import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NotificationCategory } from '@pipou/shared';
import type { NotificationsQuery } from '@pipou/shared';

export class ListNotificationsQueryDto implements NotificationsQuery {
  @IsOptional()
  @IsIn(Object.values(NotificationCategory))
  category?: NotificationCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
