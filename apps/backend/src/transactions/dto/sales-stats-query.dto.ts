import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { SaleRole, SalesFilter } from '@pipou/shared';

/** GET /transactions/stats — sans userId : tout le marché. */
export class SalesStatsQueryDto implements SalesFilter {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsIn(['seller', 'buyer', 'both'])
  role?: SaleRole;
}
