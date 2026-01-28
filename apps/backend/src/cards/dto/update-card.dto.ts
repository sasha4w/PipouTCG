import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { Type } from '../enums/type.enum';
import { Rarity } from '../enums/rarity.enum';

export class UpdateCardDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(Rarity)
  @IsOptional()
  rarity?: Rarity;

  @IsEnum(Type)
  @IsOptional()
  type?: Type;

  @IsNumber()
  @IsOptional()
  atk?: number;

  @IsNumber()
  @IsOptional()
  hp?: number;

  @IsNumber()
  @IsOptional()
  cardSetId?: number;
}
