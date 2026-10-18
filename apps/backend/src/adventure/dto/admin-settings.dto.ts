import { IsInt, Max, Min } from 'class-validator';
import type { AdminAdventureSettingsBody } from '@pipou/shared';

export class AdminSettingsDto implements AdminAdventureSettingsBody {
  @IsInt()
  @Min(0)
  @Max(1000)
  dailyCap!: number;
}
