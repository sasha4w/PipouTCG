import { IsBoolean } from 'class-validator';
import type { SetDeckFavoriteRequest } from '@pipou/shared';

export class SetDeckFavoriteDto implements SetDeckFavoriteRequest {
  @IsBoolean()
  favorite!: boolean;
}
