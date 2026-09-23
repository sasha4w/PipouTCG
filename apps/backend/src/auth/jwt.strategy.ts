import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AuthUser, JwtPayload } from './auth-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request): string | null => {
        const cookies = req?.cookies as Record<string, string> | undefined;
        return cookies?.token ?? null;
      },
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      userId: payload.sub,
      isAdmin: payload.is_admin,
    };
  }
}
