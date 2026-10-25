import { IsInt, IsNotEmpty, Min } from 'class-validator';
import type { DestroyRequest } from '@pipou/shared';

export class DestroyDto implements DestroyRequest {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  cardId!: number;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  quantity!: number;
}
