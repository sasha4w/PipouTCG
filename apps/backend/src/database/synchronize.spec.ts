import { shouldSynchronize } from './synchronize';

describe('shouldSynchronize', () => {
  it.each(['localhost', '127.0.0.1', '::1', 'db'])(
    'synchronise une base locale (%s) hors production',
    (host) => {
      expect(
        shouldSynchronize({ NODE_ENV: 'development', DB_HOST: host }),
      ).toBe(true);
      expect(shouldSynchronize({ NODE_ENV: 'test', DB_HOST: host })).toBe(true);
    },
  );

  it('ne synchronise jamais une base distante, même en développement', () => {
    const aiven = 'mysql-pipou-project.aivencloud.com';
    expect(shouldSynchronize({ NODE_ENV: 'development', DB_HOST: aiven })).toBe(
      false,
    );
    expect(shouldSynchronize({ DB_HOST: aiven })).toBe(false);
  });

  it('ne synchronise jamais en production, même en local', () => {
    expect(
      shouldSynchronize({ NODE_ENV: 'production', DB_HOST: 'localhost' }),
    ).toBe(false);
  });

  it('ne synchronise pas sans DB_HOST', () => {
    expect(shouldSynchronize({ NODE_ENV: 'development' })).toBe(false);
  });
});
