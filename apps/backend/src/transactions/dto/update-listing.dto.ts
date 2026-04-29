import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class UpdateListingDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  unitPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ValidateIf((o) => o.unitPrice === undefined && o.quantity === undefined)
  @IsInt({ message: 'Au moins unitPrice ou quantity doit être fourni.' })
  _atLeastOne?: never;
}
