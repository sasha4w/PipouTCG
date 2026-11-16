import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PuzzleObjectiveType } from '@pipou/shared';
import type {
  PuzzleObjective,
  PuzzlePublishBody,
  PuzzleSaveBody,
} from '@pipou/shared';

export class PuzzleObjectiveDto implements PuzzleObjective {
  @IsEnum(PuzzleObjectiveType)
  type!: PuzzleObjectiveType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetInstanceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  primes?: number;
}

export class PuzzleSaveDto implements PuzzleSaveBody {
  @IsString()
  @Length(1, 80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ValidateNested()
  @Type(() => PuzzleObjectiveDto)
  objective!: PuzzleObjectiveDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  rewardGold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_000)
  rewardXp?: number;
}

export class PuzzlePublishDto implements PuzzlePublishBody {
  @IsOptional()
  @IsBoolean()
  manualOverride?: boolean;
}
