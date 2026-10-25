import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ForgeInput, ForgeRequest } from '@pipou/shared';

export class ForgeInputDto implements ForgeInput {
  @IsInt()
  @Min(1)
  cardId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ForgeDto implements ForgeRequest {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => ForgeInputDto)
  inputs!: ForgeInputDto[];

  @IsInt()
  @Min(1)
  targetCardId!: number;
}
