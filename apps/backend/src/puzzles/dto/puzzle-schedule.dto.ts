import {
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PuzzleScheduleBody } from '@pipou/shared';

export class PuzzleScheduleDto implements PuzzleScheduleBody {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date attendue : AAAA-MM-JJ.' })
  date!: string;

  /** null : libère la date. */
  @ValidateIf((o: PuzzleScheduleDto) => o.puzzleId !== null)
  @IsInt()
  puzzleId!: number | null;
}

export class PuzzleScheduleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;
}
