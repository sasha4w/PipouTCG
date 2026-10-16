import { IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { RecentSalesQuery, SaleRole, SaleSort } from '@pipou/shared';

export class RecentSalesQueryDto
  extends PaginationDto
  implements RecentSalesQuery
{
  @IsOptional()
  @IsIn(['date', 'price'])
  sort?: SaleSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsIn(['seller', 'buyer', 'both'])
  role?: SaleRole;
}
