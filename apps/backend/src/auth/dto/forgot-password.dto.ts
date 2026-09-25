import { IsEmail } from 'class-validator';
import type { ForgotPasswordRequest } from '@pipou/shared';

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsEmail()
  email!: string;
}
