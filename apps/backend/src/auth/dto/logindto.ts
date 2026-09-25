import { IsEmail, IsBoolean, IsOptional, MinLength } from 'class-validator';
import type { LoginRequest } from '@pipou/shared';

export class LoginDto implements LoginRequest {
  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
