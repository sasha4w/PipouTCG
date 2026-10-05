import type { JwtService } from '@nestjs/jwt';
import * as cookie from 'cookie';

export interface SocketUser {
  userId: number;
  username: string;
  isAdmin: boolean;
}

/** Utilisateur authentifié par le cookie JWT d'un handshake Socket.io, ou null. */
export function readSocketUser(
  cookieHeader: string | undefined,
  jwt: JwtService,
  secret: string,
): SocketUser | null {
  const token = cookie.parse(cookieHeader ?? '')['token'];
  if (!token) return null;
  try {
    const payload = jwt.verify<{
      sub: number;
      username: string;
      is_admin?: boolean;
    }>(token, { secret });
    return {
      userId: Number(payload.sub),
      username: payload.username,
      isAdmin: payload.is_admin === true,
    };
  } catch {
    return null;
  }
}
