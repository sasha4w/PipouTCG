import { IsInt, Min, IsOptional } from 'class-validator';

export class AddBundleContentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  cardId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  boosterId?: number;
}
