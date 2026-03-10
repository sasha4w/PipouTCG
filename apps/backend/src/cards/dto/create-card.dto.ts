import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Type as CardType } from '../enums/type.enum';
import { Rarity } from '../enums/rarity.enum';

export class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(Rarity)
  @IsNotEmpty()
  rarity: Rarity;

  @IsEnum(CardType)
  @IsNotEmpty()
  type: CardType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  atk: number;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  hp: number;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  cardSetId: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  imageId?: number;
}
