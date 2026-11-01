import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AuthUser, JwtPayload } from './auth-user';
import { sseTicketSecret } from './sse-ticket';

interface ExtractedToken {
  token: string | null;
  /** Ticket SSE passé en query (EventSource ne sait pas poser de header). */
  isSseTicket: boolean;
}

function extractToken(req: Request): ExtractedToken {
  const cookies = req?.cookies as Record<string, string> | undefined;
  if (cookies?.token) return { token: cookies.token, isSseTicket: false };

  // Repli des navigateurs qui bloquent les cookies tiers (Opera GX, Safari).
  const bearer = /^Bearer (.+)$/i.exec(req?.headers?.authorization ?? '');
  if (bearer) return { token: bearer[1], isSseTicket: false };

  // Query : uniquement un ticket SSE court, et seulement sur les routes
  // `/events`, pour que le jeton ne finisse pas dans les logs d'une autre URL.
  const queryToken = req?.query?.token;
  if (typeof queryToken === 'string' && req.path.includes('/events')) {
    return { token: queryToken, isSseTicket: true };
  }
  return { token: null, isSseTicket: false };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.getOrThrow<string>('JWT_SECRET');
    const ticketSecret = sseTicketSecret(secret);
    super({
      jwtFromRequest: (req: Request): string | null => extractToken(req).token,
      secretOrKeyProvider: (req: Request, _raw: unknown, done) =>
        done(null, extractToken(req).isSseTicket ? ticketSecret : secret),
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
