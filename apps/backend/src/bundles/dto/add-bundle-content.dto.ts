import { IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';

export class BundleItemDto {
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

export class AddBundleContentDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  items!: BundleItemDto[];
}
