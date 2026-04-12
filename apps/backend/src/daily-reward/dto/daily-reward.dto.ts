import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { RewardType } from '../enums/reward-type.enum';

// ── Daily Reward Definition ────────────────────────────────────────────────

export class CreateDailyRewardDefinitionDto {
  @IsInt()
  @Min(1)
  @Max(7)
  cycleDay!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  weekNumber?: number;

  @IsEnum(RewardType)
  rewardType!: RewardType;

  @IsInt()
  @Min(1)
  rewardValue!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDailyRewardDefinitionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  cycleDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  weekNumber?: number | null;

  @IsOptional()
  @IsEnum(RewardType)
  rewardType?: RewardType;

  @IsOptional()
  @IsInt()
  @Min(1)
  rewardValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Milestone Reward ───────────────────────────────────────────────────────

export class CreateMilestoneRewardDto {
  @IsInt()
  @Min(1)
  dayThreshold!: number;

  @IsEnum(RewardType)
  rewardType!: RewardType;

  @IsInt()
  @Min(1)
  rewardValue!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMilestoneRewardDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  dayThreshold?: number;

  @IsOptional()
  @IsEnum(RewardType)
  rewardType?: RewardType;

  @IsOptional()
  @IsInt()
  @Min(1)
  rewardValue?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Streak Rescue ──────────────────────────────────────────────────────────

export class RescueStreakDto {
  /** Nombre de jours à racheter */
  @IsInt()
  @Min(1)
  daysToBuy!: number;
}
