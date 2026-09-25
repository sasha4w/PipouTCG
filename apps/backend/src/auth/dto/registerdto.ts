import { IsEmail, IsString, MinLength } from 'class-validator';
import type { RegisterRequest } from '@pipou/shared';

export class RegisterDto implements RegisterRequest {
  @IsString()
  username!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;
}
