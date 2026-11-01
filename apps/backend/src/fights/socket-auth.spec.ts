import { JwtService } from '@nestjs/jwt';
import { readSocketUser } from './socket-auth';

const SECRET = 'secret-de-test-assez-long-pour-hs256';

describe('readSocketUser', () => {
  const jwt = new JwtService();
  const cookieFor = (payload: object) =>
    `autre=1; token=${jwt.sign(payload, { secret: SECRET })}`;

  it("lit l'utilisateur et son droit admin depuis le cookie token", () => {
    expect(
      readSocketUser(
        cookieFor({ sub: 4, username: 'Admin', is_admin: true }),
        jwt,
        SECRET,
      ),
    ).toEqual({ userId: 4, username: 'Admin', isAdmin: true });
  });

  it("un joueur sans is_admin n'est pas admin", () => {
    expect(
      readSocketUser(cookieFor({ sub: 2, username: 'Bob' }), jwt, SECRET)
        ?.isAdmin,
    ).toBe(false);
  });

  it('lit le jeton dans auth.token quand le cookie est bloqué', () => {
    const token = jwt.sign({ sub: 7, username: 'Opera' }, { secret: SECRET });
    expect(readSocketUser(undefined, jwt, SECRET, token)).toEqual({
      userId: 7,
      username: 'Opera',
      isAdmin: false,
    });
  });

  it('rejette un auth.token invalide, mal typé ou signé par un autre secret', () => {
    const foreign = jwt.sign({ sub: 7, username: 'X' }, { secret: 'autre' });
    expect(readSocketUser(undefined, jwt, SECRET, foreign)).toBeNull();
    expect(readSocketUser(undefined, jwt, SECRET, 'nimportequoi')).toBeNull();
    expect(readSocketUser(undefined, jwt, SECRET, { x: 1 })).toBeNull();
  });

  it('renvoie null sans cookie ou avec un jeton invalide', () => {
    expect(readSocketUser(undefined, jwt, SECRET)).toBeNull();
    expect(readSocketUser('token=pas-un-jwt', jwt, SECRET)).toBeNull();
  });
});
