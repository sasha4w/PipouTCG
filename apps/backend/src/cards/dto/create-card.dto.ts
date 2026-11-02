import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsEnum,
  IsDefined,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  MinLength,
  MaxLength,
  IsInt,
  Max,
  IsIn,
  IsBoolean,
  ValidateIf,
  Validate,
  ValidatorConstraint,
} from 'class-validator';
import type {
  ValidationArguments,
  ValidatorConstraintInterface,
} from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  CardType,
  Rarity,
  SupportType,
  EquipmentSlot,
  ChargeMode,
  Archetype,
  DrakonElement,
  DrakonStage,
  EffectTrigger,
  EffectConditionType as ConditionType,
  ActionType,
  EffectTarget,
} from '@pipou/shared';
import type {
  CardEffect,
  CardNameMatch,
  EffectFilter,
  CreateCardRequest,
  EffectAction,
  EffectCondition,
  EffectValueIf,
} from '@pipou/shared';

export class EffectConditionDto implements EffectCondition {
  @IsEnum(ConditionType)
  type!: ConditionType;

  @IsOptional()
  value?: number | string;

  @IsOptional()
  @IsIn(['exact', 'contains'])
  match?: CardNameMatch;

  @IsOptional()
  @IsEnum(DrakonElement)
  element?: DrakonElement;

  @IsOptional()
  @IsEnum(DrakonStage)
  stage?: DrakonStage;
}

export class EffectValueIfDto implements EffectValueIf {
  @IsDefined()
  @ValidateNested()
  @Type(() => EffectConditionDto)
  condition!: EffectConditionDto;

  @IsNumber()
  value!: number;
}

export class EffectFilterDto implements EffectFilter {
  @IsOptional()
  @IsEnum(Archetype)
  archetype?: Archetype;

  @IsOptional()
  @IsEnum(DrakonElement)
  element?: DrakonElement;

  @IsOptional()
  @IsEnum(DrakonStage)
  stage?: DrakonStage;

  @IsOptional()
  @IsArray()
  @IsEnum(Rarity, { each: true })
  rarities?: Rarity[];

  @IsOptional()
  @IsEnum(CardType)
  type?: CardType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  excludeName?: string;
}

/** DEAL_DAMAGE ne vise que des monstres. */
@ValidatorConstraint({ name: 'damageTargetsMonsters' })
class DamageTargetsMonsters implements ValidatorConstraintInterface {
  validate(target: EffectTarget, args: ValidationArguments): boolean {
    const action = args.object as EffectActionDto;
    return (
      action.type !== ActionType.DEAL_DAMAGE ||
      (target !== EffectTarget.PLAYER && target !== EffectTarget.OPPONENT)
    );
  }

  defaultMessage(): string {
    return 'DEAL_DAMAGE ne peut viser que des monstres';
  }
}

export class EffectActionDto implements EffectAction {
  @IsEnum(ActionType)
  type!: ActionType;

  @IsEnum(EffectTarget)
  @Validate(DamageTargetsMonsters)
  target!: EffectTarget;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsEnum(Archetype)
  archetype?: Archetype;

  @IsOptional()
  @ValidateNested()
  @Type(() => EffectFilterDto)
  filter?: EffectFilterDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EffectValueIfDto)
  valueIf?: EffectValueIfDto;
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

/** Champs propres à un sous-type : interdits ailleurs. */
@ValidatorConstraint({ name: 'supportFieldsMatchType' })
class SupportFieldsMatchType implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateCardDto;
    if (o.equipmentSlot != null && o.supportType !== SupportType.EQUIPMENT)
      return false;
    if (o.isTerrain && o.supportType !== SupportType.PERSISTENT) return false;
    if (
      (o.chargeMax != null || o.chargeMode != null) &&
      o.supportType !== SupportType.CHARGE
    )
      return false;
    return true;
  }

  defaultMessage(): string {
    return 'Champ incompatible avec ce type de support';
  }
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
  @Validate(SupportFieldsMatchType)
  supportType?: SupportType;

  @ValidateIf(
    (o: CreateCardDto) =>
      o.supportType === SupportType.EQUIPMENT || o.equipmentSlot != null,
  )
  @IsEnum(EquipmentSlot)
  @Validate(SupportFieldsMatchType)
  equipmentSlot?: EquipmentSlot;

  @IsOptional()
  @IsBoolean()
  @Validate(SupportFieldsMatchType)
  isTerrain?: boolean;

  @ValidateIf(
    (o: CreateCardDto) =>
      o.supportType === SupportType.CHARGE || o.chargeMax != null,
  )
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  @Validate(SupportFieldsMatchType)
  chargeMax?: number;

  @IsOptional()
  @IsEnum(ChargeMode)
  @Validate(SupportFieldsMatchType)
  chargeMode?: ChargeMode;

  @IsOptional()
  @IsEnum(Archetype)
  archetype?: Archetype;

  @IsOptional()
  @IsEnum(DrakonElement)
  element?: DrakonElement;

  @IsOptional()
  @IsEnum(DrakonStage)
  stage?: DrakonStage;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineage?: string;

  // En multipart (FormData) les effets arrivent sérialisés en JSON texte.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    try {
      const parsed = JSON.parse(value) as unknown;
      // @Type ne voit pas le résultat : on instancie les DTO ici
      return Array.isArray(parsed)
        ? plainToInstance(CardEffectDto, parsed)
        : parsed;
    } catch {
      return value;
    }
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CardEffectDto)
  effects?: CardEffectDto[];
}
