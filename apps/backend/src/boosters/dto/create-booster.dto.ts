import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { CardNumber } from '../enums/cardnumber.enum';

export class CreateBoosterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEnum(CardNumber, {
    message: 'cardNumber must be a valid CardNumber enum value',
  })
  cardNumber: CardNumber;

  @IsInt()
  @Min(1)
  cardSetId: number;
}
