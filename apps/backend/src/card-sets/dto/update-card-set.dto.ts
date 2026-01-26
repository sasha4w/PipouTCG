import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateCardSetDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
