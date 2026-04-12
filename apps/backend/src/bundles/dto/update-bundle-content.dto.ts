import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBundleContentDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}
