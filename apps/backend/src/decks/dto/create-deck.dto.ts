import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class DeckCardEntryDto {
  @IsInt()
  @Min(1)
  userCardId!: number;

  @IsInt()
  @Min(1)
  @Max(3)
  quantity!: number;
}

export class CreateDeckDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  /**
   * Total card count (sum of quantities) must be between 20 and 40.
   * The array entries represent unique card slots; duplicates are expressed
   * via `quantity`.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => DeckCardEntryDto)
  cards!: DeckCardEntryDto[];
}
