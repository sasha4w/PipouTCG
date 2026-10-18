import { IsEnum, IsOptional } from 'class-validator';
import { AchievementFamily, type SetTitleRequest } from '@pipou/shared';

export class SetTitleDto implements SetTitleRequest {
  /** null retire le titre. */
  @IsOptional()
  @IsEnum(AchievementFamily)
  family!: AchievementFamily | null;
}
