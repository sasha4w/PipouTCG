import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import type { StarterDeckBody, StarterDeckCardView } from '@pipou/shared';

export class StarterDeckCardDto implements StarterDeckCardView {
  @IsInt()
  cardId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsBoolean()
  isFeatured!: boolean;
}

export class StarterDeckDto implements StarterDeckBody {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StarterDeckCardDto)
  cards!: StarterDeckCardDto[];
}
