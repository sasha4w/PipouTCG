import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateBundleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
