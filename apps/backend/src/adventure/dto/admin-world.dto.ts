import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import type { AdminAdventureWorldBody } from '@pipou/shared';

export class AdminWorldDto implements AdminAdventureWorldBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsInt()
  cardSetId!: number;

  @IsInt()
  boosterId!: number;

  @IsInt()
  order!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  prerequisiteIds!: number[];
}
