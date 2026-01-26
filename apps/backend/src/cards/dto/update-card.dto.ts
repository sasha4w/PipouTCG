import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateCardDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  rarity?: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  level?: number;

  @IsNumber()
  @IsOptional()
  cardSetId?: number;
}
