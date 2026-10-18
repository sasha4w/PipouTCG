import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { AdminAdventureOpponentBody } from '@pipou/shared';

export class AdminOpponentDto implements AdminAdventureOpponentBody {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  quote!: string;

  @IsInt()
  portraitCardId!: number;

  @IsInt()
  @Min(0)
  firstWinGold!: number;

  @IsInt()
  @Min(0)
  firstWinXp!: number;

  @IsInt()
  @Min(0)
  farmGold!: number;

  @IsInt()
  @Min(0)
  farmXp!: number;

  /** Colonne decimal(5,2) : 2 décimales au plus. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  farmBoosterPct!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  farmLegendaryPct!: number;
}
