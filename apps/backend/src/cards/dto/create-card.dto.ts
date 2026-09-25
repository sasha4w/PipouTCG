import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MinLength,
  MaxLength,
  IsInt,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CardType,
  Rarity,
  SupportType,
  Archetype,
  EffectTrigger,
  EffectConditionType as ConditionType,
  ActionType,
  EffectTarget,
} from '@pipou/shared';
import type {
  CardEffect,
  CreateCardRequest,
  EffectAction,
  EffectCondition,
} from '@pipou/shared';

export class EffectConditionDto implements EffectCondition {
  @IsEnum(ConditionType)
  type!: ConditionType;

  @IsOptional()
  value?: number | string;
}

export class EffectActionDto implements EffectAction {
  @IsEnum(ActionType)
  type!: ActionType;

  @IsEnum(EffectTarget)
  target!: EffectTarget;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsEnum(Archetype)
  archetype?: Archetype;
}

export class CardEffectDto implements CardEffect {
  @IsEnum(EffectTrigger)
  trigger!: EffectTrigger;

  @IsOptional()
  @ValidateNested()
  @Type(() => EffectConditionDto)
  condition?: EffectConditionDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EffectActionDto)
  actions!: EffectActionDto[];
}

export class CreateCardDto implements CreateCardRequest {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(Rarity)
  @IsNotEmpty()
  rarity!: Rarity;

  @IsEnum(CardType)
  @IsNotEmpty()
  type!: CardType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  atk!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hp!: number;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  cardSetId!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  imageId?: number;

  // ── Nouveau ──────────────────────────────────────────────────

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  @Type(() => Number)
  cost?: number = 0;

  @IsOptional()
  @IsEnum(SupportType)
  supportType?: SupportType;

  @IsOptional()
  @IsEnum(Archetype)
  archetype?: Archetype;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardEffectDto)
  effects?: CardEffectDto[];
}
