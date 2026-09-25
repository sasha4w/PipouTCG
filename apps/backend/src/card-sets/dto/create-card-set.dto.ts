import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import type { CreateCardSetRequest } from '@pipou/shared';

export class CreateCardSetDto implements CreateCardSetRequest {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
