import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import type { AdminAdventureDeckBody } from '@pipou/shared';

export class AdminDeckCardDto {
  @IsInt()
  cardId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class AdminDeckDto implements AdminAdventureDeckBody {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AdminDeckCardDto)
  cards!: AdminDeckCardDto[];
}
