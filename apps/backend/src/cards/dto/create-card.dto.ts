import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUrl,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from '../enums/type.enum';
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
  description?: string; // optionnel, pas toutes les cartes en ont besoin

  @IsEnum(Rarity)
  @IsNotEmpty()
  rarity: Rarity;

  @IsEnum(Type)
  @IsNotEmpty()
  type: Type;

  @IsNumber()
  @Min(0)
  atk: number;

  @IsNumber()
  @Min(1)
  hp: number;

  @IsNumber()
  @Min(1)
  cardSetId: number;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;
}
