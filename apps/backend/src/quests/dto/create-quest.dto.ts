import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsObject,
  ValidateNested,
  IsArray,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QuestResetType,
  RewardType,
  ConditionType,
  ConditionOperator,
} from '../enums/quest.enums';

export class QuestConditionDto {
  @IsEnum(ConditionType)
  type!: ConditionType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  rarity?: string;

  @IsOptional()
  @IsNumber()
  setId?: number;

  @IsOptional()
  @IsNumber()
  boosterId?: number;

  @IsOptional()
  @IsNumber()
  level?: number;
}

export class QuestConditionGroupDto {
  @IsEnum(ConditionOperator)
  operator!: ConditionOperator;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestConditionDto)
  conditions!: QuestConditionDto[];
}

export class CreateQuestDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(QuestResetType)
  resetType!: QuestResetType;

  // Heure du reset (0-23), défaut 4h00
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  resetHour?: number = 4;

  // Jour de la semaine pour WEEKLY (0=dimanche ... 6=samedi)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  resetDayOfWeek?: number;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => QuestConditionGroupDto)
  conditionGroup!: QuestConditionGroupDto;

  @IsEnum(RewardType)
  rewardType!: RewardType;

  @IsNumber()
  @Min(0)
  rewardAmount!: number;

  @IsOptional()
  @IsNumber()
  rewardItemId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
