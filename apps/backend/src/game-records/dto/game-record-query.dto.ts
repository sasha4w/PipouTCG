import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import type { GameRecordMode } from '@pipou/shared';

export class GameRecordQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['pvp', 'pve'])
  mode?: GameRecordMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
