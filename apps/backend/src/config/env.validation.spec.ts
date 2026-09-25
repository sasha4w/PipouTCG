import { validateEnv } from './env.validation';

const base = {
  DB_HOST: 'localhost',
  DB_USER: 'root',
  DB_NAME: 'cardcollect',
  JWT_SECRET: 'a-secret-of-at-least-32-chars!!',
};

describe('validateEnv', () => {
  it('accepte une configuration minimale', () => {
    expect(validateEnv(base)).toMatchObject(base);
  });

  it('traite une variable vide (KEY=) comme absente', () => {
    const env = validateEnv({
      ...base,
      IMGBB_API_KEY: '',
      RESEND_API_KEY: '',
      DB_SSL_CA_BASE64: '',
    });
    expect(env.IMGBB_API_KEY).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.DB_SSL_CA_BASE64).toBeUndefined();
  });

  it('refuse toujours une variable obligatoire vide', () => {
    expect(() => validateEnv({ ...base, DB_HOST: '' })).toThrow(/DB_HOST/);
  });

  it('refuse un JWT_SECRET trop court', () => {
    expect(() => validateEnv({ ...base, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });
});
