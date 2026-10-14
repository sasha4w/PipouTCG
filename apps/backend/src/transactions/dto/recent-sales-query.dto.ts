import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { RecentSalesQuery, SaleSort } from '@pipou/shared';

export class RecentSalesQueryDto
  extends PaginationDto
  implements RecentSalesQuery
{
  @IsOptional()
  @IsIn(['date', 'price'])
  sort?: SaleSort;
}
