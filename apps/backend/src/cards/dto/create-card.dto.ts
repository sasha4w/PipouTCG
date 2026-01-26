import { IsString, IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  rarity: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  level: number;

  @IsNumber()
  @IsNotEmpty()
  cardSetId: number; // ID du set
}
