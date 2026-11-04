import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import type { DestroyBatchRequest } from '@pipou/shared';
import { DestroyDto } from './destroy.dto';

export class DestroyBatchDto implements DestroyBatchRequest {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DestroyDto)
  items!: DestroyDto[];
}
