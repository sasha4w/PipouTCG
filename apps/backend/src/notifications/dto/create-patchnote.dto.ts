import { IsString, MaxLength, MinLength } from 'class-validator';
import type { CreatePatchnoteRequest } from '@pipou/shared';

export class CreatePatchnoteDto implements CreatePatchnoteRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}
