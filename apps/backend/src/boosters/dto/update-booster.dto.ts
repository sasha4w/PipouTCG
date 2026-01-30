import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
  IsOptional,
} from 'class-validator';
import { CardNumber } from '../enums/cardnumber.enum';

export class UpdateBoosterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(CardNumber, {
    message: 'cardNumber must be a valid CardNumber enum value',
  })
  cardNumber?: CardNumber;

  @IsOptional()
  @IsInt()
  @Min(1)
  cardSetId?: number;
}
