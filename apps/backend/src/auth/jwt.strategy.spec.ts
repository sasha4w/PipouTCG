import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { sseTicketSecret } from './sse-ticket';

const SECRET = 'secret-de-test-assez-long-pour-hs256';

type Opts = {
  jwtFromRequest: (req: Request) => string | null;
  secretOrKeyProvider: (
    req: Request,
    raw: string,
    done: (err: unknown, secret: string) => void,
  ) => void;
};

describe('JwtStrategy', () => {
  const jwt = new JwtService();
  const strategy = new JwtStrategy({
    getOrThrow: () => SECRET,
  } as unknown as ConfigService) as unknown as {
    _jwtFromRequest: Opts['jwtFromRequest'];
    _secretOrKeyProvider: Opts['secretOrKeyProvider'];
  };

  const req = (r: Partial<Request>) =>
    ({ headers: {}, query: {}, path: '/x', ...r }) as Request;
  const secretFor = (r: Request, token: string) => {
    let out = '';
    strategy._secretOrKeyProvider(r, token, (_e, s) => {
      out = s;
    });
    return out;
  };

  it('lit le jeton du cookie en priorité', () => {
    expect(
      strategy._jwtFromRequest(
        req({
          cookies: { token: 'c' },
          headers: { authorization: 'Bearer h' },
        }),
      ),
    ).toBe('c');
  });

  it('lit le jeton du header Authorization: Bearer', () => {
    const r = req({ headers: { authorization: 'Bearer abc' } });
    expect(strategy._jwtFromRequest(r)).toBe('abc');
    expect(secretFor(r, 'abc')).toBe(SECRET);
  });

  it('accepte un ticket en query sur une route /events, avec le secret SSE', () => {
    const r = req({ query: { token: 't' }, path: '/transactions/events' });
    expect(strategy._jwtFromRequest(r)).toBe('t');
    expect(secretFor(r, 't')).toBe(sseTicketSecret(SECRET));
  });

  it('refuse un jeton en query hors des routes /events', () => {
    const r = req({ query: { token: 't' }, path: '/users/me' });
    expect(strategy._jwtFromRequest(r)).toBeNull();
  });

  it('un jeton de session passé en query est rejeté (secret SSE différent)', () => {
    const session = jwt.sign({ sub: 1 }, { secret: SECRET });
    const r = req({ query: { token: session }, path: '/notifications/events' });
    expect(() => {
      jwt.verify(session, { secret: secretFor(r, session) });
    }).toThrow();
  });
});
