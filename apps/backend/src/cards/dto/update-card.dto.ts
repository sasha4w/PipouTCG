import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from '../enums/type.enum';
import { Rarity } from '../enums/rarity.enum';

export class UpdateCardDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsEnum(Rarity)
  @IsOptional()
  rarity?: Rarity;

  @IsEnum(Type)
  @IsOptional()
  type?: Type;

  @IsNumber()
  @IsOptional()
  @Min(0)
  atk?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  hp?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  cardSetId?: number;
}
