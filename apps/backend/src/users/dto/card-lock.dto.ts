import { IsInt, Min } from 'class-validator';
import type { CardLockRequest } from '@pipou/shared';

export class CardLockDto implements CardLockRequest {
  @IsInt()
  @Min(0)
  locked!: number;
}
