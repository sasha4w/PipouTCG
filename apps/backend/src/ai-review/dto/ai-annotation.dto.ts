import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { AI_OUTCOMES, AI_PROBLEM_CATEGORIES, AI_VERDICTS } from '@pipou/shared';
import type {
  AiOutcome,
  AiProblemCategory,
  AiReviewAnnotationRequest,
  AiVerdict,
} from '@pipou/shared';

export class AiAnnotationDto implements AiReviewAnnotationRequest {
  @IsIn(AI_VERDICTS)
  verdict!: AiVerdict;

  @IsOptional()
  @IsInt()
  @Min(0)
  preferredIndex?: number;

  @IsOptional()
  @IsIn(AI_PROBLEM_CATEGORIES)
  category?: AiProblemCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsIn(AI_OUTCOMES)
  outcome?: AiOutcome;
}
