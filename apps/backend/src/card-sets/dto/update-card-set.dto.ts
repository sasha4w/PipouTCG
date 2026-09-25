import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import type { UpdateCardSetRequest } from '@pipou/shared';

export class UpdateCardSetDto implements UpdateCardSetRequest {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
