import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsEnum,
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

  @IsEnum(Rarity)
  @IsNotEmpty()
  rarity: Rarity;

  @IsEnum(Type)
  @IsNotEmpty()
  type: Type;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  atk: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  hp: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  cardSetId: number;
}
