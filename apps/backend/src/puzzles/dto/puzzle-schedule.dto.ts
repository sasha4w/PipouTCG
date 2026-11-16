import {
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { PuzzleScheduleBody } from '@pipou/shared';

/** Date réelle du calendrier (refuse 2026-13-45 ou 2026-02-30). */
@ValidatorConstraint({ name: 'calendarDate' })
export class CalendarDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    return (
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === mo - 1 &&
      date.getUTCDate() === d
    );
  }

  defaultMessage(): string {
    return 'Date inexistante.';
  }
}

export class PuzzleScheduleDto implements PuzzleScheduleBody {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date attendue : AAAA-MM-JJ.' })
  @Validate(CalendarDateConstraint)
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
