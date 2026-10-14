import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { HistoryQuery, SaleSort } from '@pipou/shared';

export class HistoryQueryDto extends PaginationDto implements HistoryQuery {
  @IsOptional()
  @IsIn(['seller', 'buyer'])
  role?: 'seller' | 'buyer';

  @IsOptional()
  @IsIn(['date', 'price'])
  sort?: SaleSort;
}
