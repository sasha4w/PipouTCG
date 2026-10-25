import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ForgeInput, ForgeRequest } from '@pipou/shared';

export class ForgeInputDto implements ForgeInput {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  cardId!: number;

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  quantity!: number;
}

export class ForgeDto implements ForgeRequest {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ForgeInputDto)
  inputs!: ForgeInputDto[];

  @IsInt()
  @IsNotEmpty()
  @Min(1)
  targetCardId!: number;
}
