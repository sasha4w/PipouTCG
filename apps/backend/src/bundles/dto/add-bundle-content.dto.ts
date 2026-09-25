import { IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';
import type { AddBundleContentRequest, BundleItemEntry } from '@pipou/shared';

export class BundleItemDto implements BundleItemEntry {
  @IsOptional()
  @IsInt()
  @Min(1)
  cardId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  boosterId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity?: number;
}

export class AddBundleContentDto implements AddBundleContentRequest {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  items!: BundleItemDto[];
}
