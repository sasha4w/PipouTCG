import { IsOptional, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class HistoryQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['seller', 'buyer'])
  role?: 'seller' | 'buyer';
}
