import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from '../enums/type.enum';
import { Rarity } from '../enums/rarity.enum';

export class CreateCardDto {
  @IsNumber()
  @IsNotEmpty()
  atk: number;

  @IsNumber()
  @IsNotEmpty()
  hp: number;

  @IsNumber()
  @IsNotEmpty()
  cardSetId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(Rarity)
  rarity: Rarity;

  @IsEnum(Type)
  type: Type;
}
