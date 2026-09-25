import { IsString, MinLength } from 'class-validator';
import type { ResetPasswordRequest } from '@pipou/shared';

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
