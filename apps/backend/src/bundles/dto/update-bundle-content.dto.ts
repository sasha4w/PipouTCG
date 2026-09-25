import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { UpdateBundleContentRequest } from '@pipou/shared';

export class UpdateBundleContentDto implements UpdateBundleContentRequest {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}
