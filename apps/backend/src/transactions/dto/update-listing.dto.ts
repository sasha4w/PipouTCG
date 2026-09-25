import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';
import type { UpdateListingRequest } from '@pipou/shared';

export class UpdateListingDto implements UpdateListingRequest {
  @IsOptional()
  @IsInt()
  @Min(1)
  unitPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ValidateIf(
    (o: UpdateListingDto) =>
      o.unitPrice === undefined && o.quantity === undefined,
  )
  @IsInt({ message: 'Au moins unitPrice ou quantity doit être fourni.' })
  _atLeastOne?: never;
}
